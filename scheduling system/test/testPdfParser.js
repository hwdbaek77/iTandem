/**
 * testPdfParser.js
 * 
 * Unit tests for pdfParser.js
 * Tests header parsing, schedule pattern parsing, course line parsing,
 * and full PDF parsing with the three example schedules.
 * 
 * Run: node test/testPdfParser.js
 */

const {
  parseHeader,
  parseSchedulePattern,
  extractBlockFromPattern,
  parseSingleCourseLine,
  parseCourseTable,
  parsePDF,
} = require("../pdfParser");

// ── Test Harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

function assertEq(actual, expected, message) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(match, `${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ── Test PDF Paths ──────────────────────────────────────────────────────────

const path = require("path");
const PDF_PATHS = {
  nathan: path.join(__dirname, "schedule_nathan.pdf"),
  daniel: path.join(__dirname, "schedule_daniel.pdf"),
};

// ── Tests ───────────────────────────────────────────────────────────────────

function testParseHeader() {
  section("parseHeader");

  // Standard format
  const lines1 = [
    "Harvard-Westlake School",
    "2025-2026 Student Schedule",
    "211-563 2/12/2026\t12\tYOU, NATHAN Grade:\tStudent:",
    "Dean(s): Erik DeAngelis",
  ];
  const h1 = parseHeader(lines1);
  assertEq(h1.name, "YOU, NATHAN", "Nathan header name");
  assertEq(h1.grade, 12, "Nathan header grade");

  // Daniel
  const lines2 = [
    "Harvard-Westlake School",
    "2025-2026 Student Schedule",
    "251-563 2/6/2026\t12\tBAEK, DANIEL JINWOO Grade:\tStudent:",
  ];
  const h2 = parseHeader(lines2);
  assertEq(h2.name, "BAEK, DANIEL JINWOO", "Daniel header name");
  assertEq(h2.grade, 12, "Daniel header grade");

  // Error case: no header
  try {
    parseHeader(["No header here", "Nothing useful"]);
    assert(false, "Should throw on missing header");
  } catch (e) {
    assert(e.message.includes("Could not parse"), "Throws on missing header");
  }
}

function testParseSchedulePattern() {
  section("parseSchedulePattern");

  // Odd-day academic course: Block 6 on days 2, 4, 6
  const p1 = parseSchedulePattern("x.6.x.6.x.6");
  assertEq(p1.type, "academic", "x.6.x.6.x.6 is academic");
  assertEq(p1.dayAssignments[1], null, "Day 1: no class");
  assertEq(p1.dayAssignments[2], 6, "Day 2: Block 6");
  assertEq(p1.dayAssignments[3], null, "Day 3: no class");
  assertEq(p1.dayAssignments[4], 6, "Day 4: Block 6");

  // Even-day course: Block 1 on days 1, 3, 5
  const p2 = parseSchedulePattern("1.x.1.x.1.x");
  assertEq(p2.type, "academic", "1.x.1.x.1.x is academic");
  assertEq(p2.dayAssignments[1], 1, "Day 1: Block 1");
  assertEq(p2.dayAssignments[2], null, "Day 2: no class");

  // Co-curricular: every day
  const p3 = parseSchedulePattern("CC.CC.CC.CC.CC.CC");
  assertEq(p3.type, "co-curricular", "CC pattern is co-curricular");
  assertEq(p3.dayAssignments[1], "CC", "Day 1: CC");
  assertEq(p3.dayAssignments[6], "CC", "Day 6: CC");

  // Directed study: days 1 and 5
  const p4 = parseSchedulePattern("DS.x.x.x.DS.x");
  assertEq(p4.type, "directed_study", "DS pattern is directed_study");
  assertEq(p4.dayAssignments[1], "DS", "Day 1: DS");
  assertEq(p4.dayAssignments[2], null, "Day 2: no DS");
  assertEq(p4.dayAssignments[5], "DS", "Day 5: DS");

  // Senior Seminar: Day 4 only
  const p5 = parseSchedulePattern("x.x.x.M12.x.x");
  assertEq(p5.type, "seminar", "M12 pattern is seminar");
  assertEq(p5.dayAssignments[4], "M12", "Day 4: M12");
  assertEq(p5.dayAssignments[1], null, "Day 1: no seminar");

  // Invalid pattern
  try {
    parseSchedulePattern("x.6.x");
    assert(false, "Should throw on short pattern");
  } catch (e) {
    assert(e.message.includes("Invalid schedule pattern"), "Throws on invalid pattern");
  }
}

function testExtractBlockFromPattern() {
  section("extractBlockFromPattern");

  assertEq(extractBlockFromPattern("x.6.x.6.x.6"), 6, "Block 6 from x.6.x.6.x.6");
  assertEq(extractBlockFromPattern("1.x.1.x.1.x"), 1, "Block 1 from 1.x.1.x.1.x");
  assertEq(extractBlockFromPattern("x.5.x.5.x.5"), 5, "Block 5 from x.5.x.5.x.5");
  assertEq(extractBlockFromPattern("CC.CC.CC.CC.CC.CC"), "CC", "CC from co-curricular");
  assertEq(extractBlockFromPattern("DS.x.x.x.DS.x"), "DS", "DS from directed study");
  assertEq(extractBlockFromPattern("x.x.x.M12.x.x"), "M12", "M12 from senior seminar");
  assertEq(extractBlockFromPattern("x.x.x.x.x.x"), null, "null from all-x pattern");
}

function testParseSingleCourseLine() {
  section("parseSingleCourseLine");

  // Standard course
  const c1 = parseSingleCourseLine(
    "2745-FY-B English IV: Criminal Minds RG211 x.6.x.6.x.6 Medawar, Jocelyn"
  );
  assert(c1 !== null, "Parses standard course");
  assertEq(c1.code, "2745-FY-B", "Course code");
  assertEq(c1.title, "English IV: Criminal Minds", "Title");
  assertEq(c1.room, "RG211", "Room");
  assertEq(c1.pattern, "x.6.x.6.x.6", "Pattern");
  assertEq(c1.block, 6, "Block number");
  assertEq(c1.type, "academic", "Type");

  // Course with joined multi-line title
  const c2 = parseSingleCourseLine(
    "3586-FY-B Honors Spanish Seminar: Hist of Spain & Latin Amer SV112 2.x.2.x.2.x Fernandez-Castro, Joaquin"
  );
  assert(c2 !== null, "Parses multi-line joined course");
  assertEq(c2.code, "3586-FY-B", "Multi-line code");
  assert(c2.title.includes("Spanish Seminar"), "Multi-line title contains key words");
  assertEq(c2.room, "SV112", "Multi-line room");
  assertEq(c2.block, 2, "Multi-line block");

  // Co-curricular
  const c3 = parseSingleCourseLine(
    "8720-T1-A Water Polo - Varsity Boys CFP CC.CC.CC.CC.CC.CC Grover, John D."
  );
  assert(c3 !== null, "Parses co-curricular");
  assertEq(c3.type, "co-curricular", "Co-curricular type");
  assertEq(c3.block, "CC", "CC block");

  // Directed study
  const c4 = parseSingleCourseLine(
    "7066-S1-A Directed Study: Corporate and Personal Finance MG100 DS.x.x.x.DS.x Engelberg, Ari R."
  );
  assert(c4 !== null, "Parses directed study");
  assertEq(c4.type, "directed_study", "DS type");
  assertEq(c4.block, "DS", "DS block");

  // Senior Seminar
  const c5 = parseSingleCourseLine(
    "9012-FY-I Senior Seminar MG101 x.x.x.M12.x.x DeAngelis, Erik S."
  );
  assert(c5 !== null, "Parses senior seminar");
  assertEq(c5.type, "seminar", "Seminar type");
  assertEq(c5.block, "M12", "M12 block");

  // Invalid line
  const c6 = parseSingleCourseLine("This is not a course line");
  assertEq(c6, null, "Returns null for non-course line");
}

function testParseCourseTable() {
  section("parseCourseTable");

  // Simulate extracted PDF text lines for Nathan
  const lines = [
    "Harvard-Westlake School",
    "2025-2026 Student Schedule",
    "211-563 2/12/2026\t12\tYOU, NATHAN Grade:\tStudent:",
    "Dean(s): Erik DeAngelis",
    "Counselor: Kat Scardino",
    "Course Title Room Schedule Teacher",
    "2745-FY-B English IV: Criminal Minds RG211 x.6.x.6.x.6 Medawar, Jocelyn",
    "4681-FY-A Honors Economics CH311 1.x.1.x.1.x Nealis, Kent",
    "8720-T1-A Water Polo - Varsity Boys CFP CC.CC.CC.CC.CC.CC Grover, John D.",
    "9012-FY-I Senior Seminar MG101 x.x.x.M12.x.x DeAngelis, Erik S.",
    "1st Semester",
    "Day 1 Day 2 Day 3 ...",
  ];

  const courses = parseCourseTable(lines);
  assertEq(courses.length, 4, "Parsed 4 courses from mock data");
  assertEq(courses[0].block, 6, "First course is Block 6");
  assertEq(courses[1].block, 1, "Second course is Block 1");
  assertEq(courses[2].type, "co-curricular", "Third is co-curricular");
  assertEq(courses[3].type, "seminar", "Fourth is seminar");

  // Test multi-line continuation
  const linesMulti = [
    "Course Title Room Schedule Teacher",
    "3586-FY-B Honors Spanish Seminar: Hist of Spain & Latin",
    "Amer",
    "SV112 2.x.2.x.2.x Fernandez-Castro, Joaquin",
    "4532-FY-B Honors Calculus II CH309 x.7.x.7.x.7 Palmer, Kent",
    "1st Semester",
  ];

  const coursesMulti = parseCourseTable(linesMulti);
  assertEq(coursesMulti.length, 2, "Parsed 2 courses with multi-line title");
  assert(coursesMulti[0].title.includes("Spanish"), "Multi-line title captured");
  assertEq(coursesMulti[0].block, 2, "Multi-line course block correct");

  // Error case: no course table header
  try {
    parseCourseTable(["No table here", "Nothing"]);
    assert(false, "Should throw on missing course table");
  } catch (e) {
    assert(e.message.includes("Could not find course table"), "Throws on missing table");
  }
}

async function testFullPDFParsing() {
  section("Full PDF Parsing - Nathan");

  const nathan = await parsePDF(PDF_PATHS.nathan);
  assertEq(nathan.name, "YOU, NATHAN", "Name");
  assertEq(nathan.grade, 12, "Grade");
  assertEq(nathan.courses.length, 7, "7 academic courses");
  assertEq(nathan.coCurriculars.length, 2, "2 co-curriculars");
  assertEq(nathan.directedStudies.length, 1, "1 directed study");
  assertEq(nathan.seminars.length, 1, "1 seminar");
  assertEq(nathan.allCourses.length, 11, "11 total courses");

  // Verify specific courses
  const econ = nathan.courses.find((c) => c.title.includes("Economics"));
  assert(econ !== null, "Has Economics");
  assertEq(econ.block, 1, "Economics is Block 1");
  assertEq(econ.pattern, "1.x.1.x.1.x", "Economics pattern");

  const cs = nathan.courses.find((c) => c.title.includes("Computer Science"));
  assert(cs !== null, "Has CS");
  assertEq(cs.block, 5, "CS is Block 5");

  // Verify all 7 blocks covered
  const blocks = new Set(nathan.courses.map((c) => c.block));
  for (let b = 1; b <= 7; b++) {
    assert(blocks.has(b), `Nathan has a course in Block ${b}`);
  }

  section("Full PDF Parsing - Daniel");

  const daniel = await parsePDF(PDF_PATHS.daniel);
  assertEq(daniel.name, "BAEK, DANIEL JINWOO", "Name");
  assertEq(daniel.grade, 12, "Grade");
  assertEq(daniel.courses.length, 6, "6 academic courses (no Block 7)");
  assertEq(daniel.coCurriculars.length, 0, "No co-curriculars");
  assertEq(daniel.directedStudies.length, 0, "No directed studies");

  // Daniel should NOT have a Block 7 course
  const danielBlocks = new Set(daniel.courses.map((c) => c.block));
  assert(!danielBlocks.has(7), "Daniel has no Block 7 course");
  assert(danielBlocks.has(1) && danielBlocks.has(2) && danielBlocks.has(3), "Daniel has Blocks 1-3");
  assert(danielBlocks.has(4) && danielBlocks.has(5) && danielBlocks.has(6), "Daniel has Blocks 4-6");

  // Hannah tests removed — PDF no longer available
}

// ── Run All ─────────────────────────────────────────────────────────────────

async function runAll() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   pdfParser.js Unit Tests            ║");
  console.log("╚══════════════════════════════════════╝");

  testParseHeader();
  testParseSchedulePattern();
  testExtractBlockFromPattern();
  testParseSingleCourseLine();
  testParseCourseTable();
  await testFullPDFParsing();

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  pdfParser.js: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(50)}`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch((e) => {
  console.error("FATAL:", e.message, e.stack);
  process.exit(1);
});
