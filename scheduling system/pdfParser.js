/**
 * pdfParser.js
 * 
 * Parses Harvard-Westlake student schedule PDFs into structured data.
 * Extracts student name, grade, and all courses with their block patterns.
 * 
 * Uses the course table at the top of the PDF (the structured rows with
 * course codes, rooms, and schedule patterns like "x.6.x.6.x.6"),
 * NOT the rendered grid below it.
 */

const fs = require("fs");
const { PDFParse } = require("pdf-parse");

// ── Pattern Constants ───────────────────────────────────────────────────────

// Matches HW course codes like "2745-FY-B", "8720-T1-A", "9012-FY-I"
const COURSE_CODE_REGEX = /^\d{4}-[A-Z0-9]+-[A-Z]/;

// Matches schedule patterns like "x.6.x.6.x.6", "CC.CC.CC.CC.CC.CC", "DS.x.x.x.DS.x", "x.x.x.M12.x.x"
const SCHEDULE_PATTERN_REGEX = /(?:[x\dA-Z]+\.){5}[x\dA-Z]+/i;

// Matches room codes like "RG211", "CH306", "SV112", "MG100", "TPSC", "CFP", "TPGYM", "FH202", "ML100"
const ROOM_REGEX = /\b([A-Z]{2,4}\d{2,3}|TPSC|CFP|TPGYM)\b/;

// ── PDF Text Extraction ─────────────────────────────────────────────────────

/**
 * Extract raw text from a PDF file.
 * @param {string} filePath - absolute path to the PDF
 * @returns {Promise<string>} raw text content
 */
async function extractTextFromPDF(filePath) {
  const buffer = fs.readFileSync(filePath);
  const uint8 = new Uint8Array(buffer);
  const parser = new PDFParse(uint8);
  await parser.load();
  const result = await parser.getText();
  return result.text;
}

// ── Header Parsing ──────────────────────────────────────────────────────────

/**
 * Parse student name and grade from the PDF header.
 * 
 * Example header line:
 *   "211-563 2/6/2026	12	YOU, NATHAN Grade:	Student:"
 * 
 * @param {string[]} lines - array of text lines from the PDF
 * @returns {{ name: string, grade: number }}
 */
function parseHeader(lines) {
  // The header is typically on line 3 (index 2), containing the student ID,
  // date, grade number, and name in format "LAST, FIRST"
  for (const line of lines.slice(0, 10)) {
    // Match pattern: ID DATE GRADE NAME Grade: Student:
    const headerMatch = line.match(
      /\d{3}-\d{3}\s+\d+\/\d+\/\d+\s+(\d+)\s+([A-Z,\s]+?)\s*Grade:/
    );
    if (headerMatch) {
      const grade = parseInt(headerMatch[1], 10);
      const name = headerMatch[2].trim();
      return { name, grade };
    }
  }

  // Fallback: try a looser match
  for (const line of lines.slice(0, 10)) {
    const looseMatch = line.match(/(\d{1,2})\s+([A-Z][A-Z, ]+?)\s*Grade:/);
    if (looseMatch) {
      return {
        name: looseMatch[2].trim(),
        grade: parseInt(looseMatch[1], 10),
      };
    }
  }

  throw new Error("Could not parse student header from PDF");
}

// ── Course Table Parsing ────────────────────────────────────────────────────

/**
 * Parse the schedule pattern string into per-day block assignments.
 * 
 * Pattern format: "val1.val2.val3.val4.val5.val6" where each value
 * corresponds to Days 1-6. Values can be:
 *   - "x"   → no class that day
 *   - "1-7" → which block the course occupies
 *   - "CC"  → co-curricular (every day)
 *   - "DS"  → directed study
 *   - "M12" → midday seminar (Day 4 only typically)
 * 
 * @param {string} pattern - e.g. "x.6.x.6.x.6"
 * @returns {{ dayAssignments: Object<number, string>, type: string }}
 */
function parseSchedulePattern(pattern) {
  const parts = pattern.split(".");
  if (parts.length !== 6) {
    throw new Error(`Invalid schedule pattern: ${pattern}`);
  }

  const dayAssignments = {};
  let type = "academic"; // default

  for (let i = 0; i < 6; i++) {
    const day = i + 1;
    const val = parts[i].toUpperCase();

    if (val === "X") {
      dayAssignments[day] = null; // no class this day
    } else if (val === "CC") {
      dayAssignments[day] = "CC";
      type = "co-curricular";
    } else if (val === "DS") {
      dayAssignments[day] = "DS";
      type = "directed_study";
    } else if (val === "M12") {
      dayAssignments[day] = "M12";
      type = "seminar";
    } else if (/^\d+$/.test(val)) {
      dayAssignments[day] = parseInt(val, 10);
    } else {
      dayAssignments[day] = val; // unknown, store as-is
    }
  }

  return { dayAssignments, type };
}

/**
 * Determine the primary block number from a schedule pattern.
 * For academic courses, this is the numbered block (1-7).
 * For CC/DS/M12, returns the special identifier.
 * 
 * @param {string} pattern - e.g. "x.6.x.6.x.6"
 * @returns {number|string|null} block number or type identifier
 */
function extractBlockFromPattern(pattern) {
  const parts = pattern.split(".");
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (upper === "X") continue;
    if (upper === "CC") return "CC";
    if (upper === "DS") return "DS";
    if (upper === "M12") return "M12";
    if (/^\d+$/.test(upper)) return parseInt(upper, 10);
  }
  return null;
}

/**
 * Parse the course table from extracted PDF text lines.
 * 
 * The course table starts after "Course Title Room Schedule Teacher"
 * and ends at "1st Semester" or "2nd Semester".
 * 
 * Handles multi-line course titles (where the title wraps to the next line).
 * 
 * @param {string[]} lines - array of text lines from PDF
 * @returns {Array<Object>} parsed course objects
 */
function parseCourseTable(lines) {
  // Find the start and end of the course table
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "Course Title Room Schedule Teacher") {
      startIdx = i + 1;
    }
    if (startIdx > 0 && (trimmed === "1st Semester" || trimmed === "2nd Semester")) {
      endIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    throw new Error("Could not find course table in PDF");
  }

  // First pass: join continuation lines back onto their parent course line.
  // A continuation line is one that does NOT start with a course code.
  const rawCourseLines = [];
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (COURSE_CODE_REGEX.test(line)) {
      rawCourseLines.push(line);
    } else if (rawCourseLines.length > 0) {
      // Continuation of previous course line
      rawCourseLines[rawCourseLines.length - 1] += " " + line;
    }
  }

  // Second pass: extract structured data from each joined course line
  const courses = [];

  for (const line of rawCourseLines) {
    const course = parseSingleCourseLine(line);
    if (course) {
      courses.push(course);
    }
  }

  return courses;
}

/**
 * Parse a single (possibly joined) course line into a structured object.
 * 
 * Example lines:
 *   "2745-FY-B English IV: Criminal Minds RG211 x.6.x.6.x.6 Medawar, Jocelyn"
 *   "3586-FY-B Honors Spanish Seminar: Hist of Spain & Latin Amer SV112 2.x.2.x.2.x Fernandez-Castro, Joaquin"
 *   "8720-T1-A Water Polo - Varsity Boys CFP CC.CC.CC.CC.CC.CC Grover, John D."
 * 
 * @param {string} line - joined course line
 * @returns {Object|null} parsed course object
 */
function parseSingleCourseLine(line) {
  // Extract course code (at the start)
  const codeMatch = line.match(/^(\d{4}-[A-Z0-9]+-[A-Z])\s+/);
  if (!codeMatch) return null;

  const code = codeMatch[1];
  let remainder = line.slice(codeMatch[0].length);

  // Extract schedule pattern (the "x.6.x.6.x.6" part)
  const patternMatch = remainder.match(SCHEDULE_PATTERN_REGEX);
  if (!patternMatch) return null;

  const pattern = patternMatch[0];
  const patternIdx = remainder.indexOf(pattern);

  // Everything before the pattern contains the title and room
  const beforePattern = remainder.slice(0, patternIdx).trim();
  // Everything after the pattern is the teacher name
  const teacher = remainder.slice(patternIdx + pattern.length).trim();

  // Extract room code from the end of the before-pattern section
  const roomMatch = beforePattern.match(/\s+([A-Z]{2,4}\d{2,3}|TPSC|CFP|TPGYM|FH\d+|ML\d+)\s*$/);
  let room = null;
  let title = beforePattern;

  if (roomMatch) {
    room = roomMatch[1];
    title = beforePattern.slice(0, roomMatch.index).trim();
  }

  // Parse the schedule pattern
  const { dayAssignments, type } = parseSchedulePattern(pattern);
  const block = extractBlockFromPattern(pattern);

  return {
    code,
    title,
    room,
    pattern,
    block,
    type,
    dayAssignments,
    teacher: teacher.replace(/,\s*$/, ""), // remove trailing comma if any
  };
}

// ── Main Parse Function ─────────────────────────────────────────────────────

/**
 * Parse a Harvard-Westlake student schedule PDF into a structured object.
 * 
 * @param {string} filePath - absolute path to the PDF file
 * @returns {Promise<Object>} structured student schedule
 */
async function parsePDF(filePath) {
  const rawText = await extractTextFromPDF(filePath);
  const lines = rawText.split("\n").map((l) => l.trimEnd());

  // Parse header
  const { name, grade } = parseHeader(lines);

  // Parse courses
  const allCourses = parseCourseTable(lines);

  // Separate course types
  const academicCourses = [];
  const coCurriculars = [];
  const directedStudies = [];
  const seminars = [];

  for (const course of allCourses) {
    switch (course.type) {
      case "co-curricular":
        coCurriculars.push(course);
        break;
      case "directed_study":
        directedStudies.push(course);
        break;
      case "seminar":
        seminars.push(course);
        break;
      default:
        academicCourses.push(course);
        break;
    }
  }

  return {
    name,
    grade,
    courses: academicCourses,
    coCurriculars,
    directedStudies,
    seminars,
    allCourses,
  };
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  parsePDF,
  parseHeader,
  parseCourseTable,
  parseSchedulePattern,
  extractBlockFromPattern,
  parseSingleCourseLine,
};
