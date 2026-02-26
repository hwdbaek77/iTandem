/**
 * pdfParser.js (Cloud Functions adaptation)
 *
 * Parses Harvard-Westlake student schedule PDFs into structured data.
 * Adapted for the actual pdf-parse output format where columns are
 * concatenated without whitespace separators.
 */

const pdfParse = require("pdf-parse");

// ── Pattern Constants ───────────────────────────────────────────────────────

const COURSE_CODE_REGEX = /^\d{4}-[A-Z0-9]+-[A-Z]/;

// Each segment is: x, single digit 1-7, CC, DS, or M followed by digits (M12)
const SEGMENT = "(?:x|\\d|CC|DS|M\\d+)";
const SCHEDULE_PATTERN_REGEX = new RegExp(
  `${SEGMENT}(?:\\.${SEGMENT}){5}`, "i"
);

// ── PDF Text Extraction ─────────────────────────────────────────────────────

/**
 * Extract raw text from a PDF buffer.
 */
async function extractTextFromBuffer(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

// ── Header Parsing ──────────────────────────────────────────────────────────

/**
 * Parse student name and grade from the PDF header.
 * pdf-parse concatenates columns, so the header line looks like:
 *   "208-9412/26/202612MEYER, MAX STEPHEN"
 * with "Grade:Student:" on the next line.
 */
function parseHeader(lines) {
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i].trim();

    // Format: NNN-NNN[date][grade][NAME]
    // e.g. "208-9412/26/202612MEYER, MAX STEPHEN"
    const concatMatch = line.match(
      /\d{3}-\d{3,4}\d{1,2}\/\d{1,2}\/\d{4}(\d{1,2})([A-Z][A-Z, ]+)/
    );
    if (concatMatch) {
      return {
        grade: parseInt(concatMatch[1], 10),
        name: concatMatch[2].trim(),
      };
    }

    // Original format with spaces (in case some PDF extractors add them)
    const spacedMatch = line.match(
      /\d{3}-\d{3}\s+\d+\/\d+\/\d+\s+(\d+)\s+([A-Z,\s]+?)\s*Grade:/
    );
    if (spacedMatch) {
      return {
        grade: parseInt(spacedMatch[1], 10),
        name: spacedMatch[2].trim(),
      };
    }

    // Loose fallback
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
 * Parse a single (possibly joined) course line.
 * Handles both spaced and concatenated (no-space) formats.
 *
 * Concatenated example:
 *   "4540-FY-AMultivariable CalculusCH3032.x.2.x.2.xLamberto-Egan, Laffite"
 * Spaced example:
 *   "4540-FY-A Multivariable Calculus CH303 2.x.2.x.2.x Lamberto-Egan, Laffite"
 */
function parseSingleCourseLine(line) {
  const codeMatch = line.match(/^(\d{4}-[A-Z0-9]+-[A-Z])\s*/);
  if (!codeMatch) return null;

  const code = codeMatch[1];
  let remainder = line.slice(codeMatch[0].length);

  const patternMatch = remainder.match(SCHEDULE_PATTERN_REGEX);
  if (!patternMatch) return null;

  const pattern = patternMatch[0];
  const patternIdx = remainder.indexOf(pattern);

  const beforePattern = remainder.slice(0, patternIdx);
  const teacher = remainder.slice(patternIdx + pattern.length).trim();

  // Extract room from the end of beforePattern.
  // Handles concatenated format like "Honors StatisticsCH304" and spaced "Honors Statistics CH304"
  // Room codes: 2-4 uppercase letters + 2-3 digits (CH303, MG202, RG211, TPSC, CFP, ML100, SV112, FH202)
  // Also handle special codes like TPSC, CFP, TPGYM that may not end in digits
  // Standard HW rooms: 2 uppercase letters + 3 digits (CH303, MG202, RG211, etc.)
  // Special rooms without digits: TPSC, CFP, TPGYM
  const roomMatch = beforePattern.match(
    /([A-Z]{2}\d{3}|TPSC|CFP|TPGYM)\s*$/
  );
  let room = null;
  let title = beforePattern.trim();

  if (roomMatch) {
    room = roomMatch[1];
    title = beforePattern.slice(0, roomMatch.index).trim();
  }

  // Handle "(No Room)" or "No Room" — if title contains that, extract it
  if (!room) {
    const noRoomMatch = title.match(/\(?\s*No\s*Room\s*\)?/i);
    if (noRoomMatch) {
      room = null;
      title = title.replace(/\(?\s*No\s*Room\s*\)?/i, "").trim();
    }
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
 * Handles the concatenated header "CourseTitleRoomScheduleTeacher".
 */
function parseCourseTable(lines) {
  let startIdx = -1;
  let endIdx = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Match both spaced and concatenated course table header
    if (
      trimmed === "Course Title Room Schedule Teacher" ||
      trimmed === "CourseTitleRoomScheduleTeacher"
    ) {
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

  // Join continuation lines to their parent course line.
  // A continuation line is one that doesn't start with a course code.
  const rawCourseLines = [];
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (COURSE_CODE_REGEX.test(line)) {
      rawCourseLines.push(line);
    } else if (rawCourseLines.length > 0) {
      // Join with space; handles multi-line entries like "Robotics—FRC (No Room) CC.CC..."
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
