/**
 * pdfParser.js (Cloud Functions adaptation)
 * 
 * Parses Harvard-Westlake student schedule PDFs into structured data.
 * Adapted from the standalone scheduling system to accept Buffers
 * instead of file paths, for use with Firebase Storage.
 */

const pdfParse = require("pdf-parse");

// ── Pattern Constants ───────────────────────────────────────────────────────

const COURSE_CODE_REGEX = /^\d{4}-[A-Z0-9]+-[A-Z]/;
const SCHEDULE_PATTERN_REGEX = /(?:[x\dA-Z]+\.){5}[x\dA-Z]+/i;

// ── PDF Text Extraction ─────────────────────────────────────────────────────

/**
 * Extract raw text from a PDF buffer.
 * @param {Buffer} buffer - PDF file contents as a Buffer
 * @returns {Promise<string>} raw text content
 */
async function extractTextFromBuffer(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

// ── Header Parsing ──────────────────────────────────────────────────────────

/**
 * Parse student name and grade from the PDF header.
 * @param {string[]} lines - array of text lines from the PDF
 * @returns {{ name: string, grade: number }}
 */
function parseHeader(lines) {
  for (const line of lines.slice(0, 10)) {
    const headerMatch = line.match(
      /\d{3}-\d{3}\s+\d+\/\d+\/\d+\s+(\d+)\s+([A-Z,\s]+?)\s*Grade:/
    );
    if (headerMatch) {
      const grade = parseInt(headerMatch[1], 10);
      const name = headerMatch[2].trim();
      return { name, grade };
    }
  }

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
 * @param {string} pattern - e.g. "x.6.x.6.x.6"
 * @returns {{ dayAssignments: Object<number, string>, type: string }}
 */
function parseSchedulePattern(pattern) {
  const parts = pattern.split(".");
  if (parts.length !== 6) {
    throw new Error(`Invalid schedule pattern: ${pattern}`);
  }

  const dayAssignments = {};
  let type = "academic";

  for (let i = 0; i < 6; i++) {
    const day = i + 1;
    const val = parts[i].toUpperCase();

    if (val === "X") {
      dayAssignments[day] = null;
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
      dayAssignments[day] = val;
    }
  }

  return { dayAssignments, type };
}

/**
 * Determine the primary block number from a schedule pattern.
 * @param {string} pattern - e.g. "x.6.x.6.x.6"
 * @returns {number|string|null}
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
 * Parse a single (possibly joined) course line into a structured object.
 * @param {string} line - joined course line
 * @returns {Object|null}
 */
function parseSingleCourseLine(line) {
  const codeMatch = line.match(/^(\d{4}-[A-Z0-9]+-[A-Z])\s+/);
  if (!codeMatch) return null;

  const code = codeMatch[1];
  let remainder = line.slice(codeMatch[0].length);

  const patternMatch = remainder.match(SCHEDULE_PATTERN_REGEX);
  if (!patternMatch) return null;

  const pattern = patternMatch[0];
  const patternIdx = remainder.indexOf(pattern);

  const beforePattern = remainder.slice(0, patternIdx).trim();
  const teacher = remainder.slice(patternIdx + pattern.length).trim();

  const roomMatch = beforePattern.match(/\s+([A-Z]{2,4}\d{2,3}|TPSC|CFP|TPGYM|FH\d+|ML\d+)\s*$/);
  let room = null;
  let title = beforePattern;

  if (roomMatch) {
    room = roomMatch[1];
    title = beforePattern.slice(0, roomMatch.index).trim();
  }

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
    teacher: teacher.replace(/,\s*$/, ""),
  };
}

/**
 * Parse the course table from extracted PDF text lines.
 * @param {string[]} lines - array of text lines from PDF
 * @returns {Array<Object>}
 */
function parseCourseTable(lines) {
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

  const rawCourseLines = [];
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (COURSE_CODE_REGEX.test(line)) {
      rawCourseLines.push(line);
    } else if (rawCourseLines.length > 0) {
      rawCourseLines[rawCourseLines.length - 1] += " " + line;
    }
  }

  const courses = [];
  for (const line of rawCourseLines) {
    const course = parseSingleCourseLine(line);
    if (course) {
      courses.push(course);
    }
  }

  return courses;
}

// ── Main Parse Function ─────────────────────────────────────────────────────

/**
 * Parse a Harvard-Westlake student schedule PDF from a Buffer.
 * @param {Buffer} pdfBuffer - PDF file contents
 * @returns {Promise<Object>} structured student schedule
 */
async function parsePDFBuffer(pdfBuffer) {
  const rawText = await extractTextFromBuffer(pdfBuffer);
  const lines = rawText.split("\n").map((l) => l.trimEnd());

  const { name, grade } = parseHeader(lines);
  const allCourses = parseCourseTable(lines);

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
  parsePDFBuffer,
  parseHeader,
  parseCourseTable,
  parseSchedulePattern,
  extractBlockFromPattern,
  parseSingleCourseLine,
};
