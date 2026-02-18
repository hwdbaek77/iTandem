/**
 * testSchedules.js
 * 
 * Integration test for the iTandem Scheduling Compatibility System.
 * Tests the full pipeline using two real HW student schedule PDFs:
 *   - Nathan You (Grade 12, Water Polo co-curricular)
 *   - Daniel Baek (Grade 12, no co-curricular listed)
 * 
 * Run: node test/testSchedules.js
 */

const path = require("path");
const { parsePDF } = require("../pdfParser");
const { buildSchedule, printSchedule } = require("../scheduleBuilder");
const {
  computeCompatibility,
  rankPartners,
  printCompatibility,
  WEIGHTS,
} = require("../compatibilityAlgorithm");
const { minutesToTime } = require("../bellSchedule");

// ── Test PDF Paths ──────────────────────────────────────────────────────────

const PDF_PATHS = {
  nathan: path.join(__dirname, "schedule_nathan.pdf"),
  daniel: path.join(__dirname, "schedule_daniel.pdf"),
};

// ── Test Helpers ────────────────────────────────────────────────────────────

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    testsFailed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

function section(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"─".repeat(60)}`);
}

// ── Tests ───────────────────────────────────────────────────────────────────

async function testPDFParser() {
  section("TEST 1: PDF Parser");

  const nathan = await parsePDF(PDF_PATHS.nathan);
  assert(nathan.name === "YOU, NATHAN", `Nathan name: "${nathan.name}"`);
  assert(nathan.grade === 12, `Nathan grade: ${nathan.grade}`);
  assert(nathan.courses.length === 7, `Nathan academic courses: ${nathan.courses.length}`);
  assert(nathan.coCurriculars.length === 2, `Nathan co-curriculars: ${nathan.coCurriculars.length}`);
  assert(nathan.directedStudies.length === 1, `Nathan directed studies: ${nathan.directedStudies.length}`);
  assert(nathan.seminars.length === 1, `Nathan seminars: ${nathan.seminars.length}`);

  const daniel = await parsePDF(PDF_PATHS.daniel);
  assert(daniel.name === "BAEK, DANIEL JINWOO", `Daniel name: "${daniel.name}"`);
  assert(daniel.grade === 12, `Daniel grade: ${daniel.grade}`);
  assert(daniel.courses.length === 6, `Daniel academic courses: ${daniel.courses.length}`);
  assert(daniel.coCurriculars.length === 0, `Daniel co-curriculars: ${daniel.coCurriculars.length}`);

  // Verify block assignments
  const nathanCS = nathan.courses.find((c) => c.title.includes("Computer Science"));
  assert(nathanCS !== undefined, "Nathan has CS course");
  assert(nathanCS.block === 5, `Nathan CS block: ${nathanCS.block}`);
  assert(nathanCS.pattern === "x.5.x.5.x.5", `Nathan CS pattern: ${nathanCS.pattern}`);

  return { nathan, daniel };
}

async function testScheduleBuilder(parsed) {
  section("TEST 2: Schedule Builder");

  const nathanSched = buildSchedule(parsed.nathan, { coCurricularEndTime: "17:30" });
  const danielSched = buildSchedule(parsed.daniel);

  // Nathan: should have co-curricular extending departure
  assert(nathanSched.hasCoCurricular === true, "Nathan has co-curricular");
  assert(nathanSched.coCurricularEndMin === 1050, `Nathan co-curricular ends at ${minutesToTime(nathanSched.coCurricularEndMin)}`);

  // Nathan Day 1: arrives 8:00, departs 17:30 (co-curricular)
  assert(nathanSched.days[1].arrival === 480, `Nathan Day 1 arrival: ${minutesToTime(nathanSched.days[1].arrival)}`);
  assert(nathanSched.days[1].departure === 1050, `Nathan Day 1 departure: ${minutesToTime(nathanSched.days[1].departure)}`);

  // Nathan Day 3: late start (Faculty Collab), first class at 10:00
  assert(nathanSched.days[3].arrival === 600, `Nathan Day 3 arrival: ${minutesToTime(nathanSched.days[3].arrival)} (late start)`);

  // Daniel Day 2: Block 7 is free, so class ends at 13:30 (end of Block 6)
  assert(danielSched.days[2].classEnd === 810, `Daniel Day 2 class end: ${minutesToTime(danielSched.days[2].classEnd)}`);
  assert(danielSched.days[2].freeSlots.includes("Block 7"), "Daniel has Block 7 free on Day 2");

  // Daniel: no co-curricular
  assert(danielSched.hasCoCurricular === false, "Daniel has no co-curricular");

  // Both seniors can leave for lunch
  assert(nathanSched.days[1].canLeaveLunch === true, "Nathan can leave for lunch (senior)");
  assert(danielSched.days[1].canLeaveLunch === true, "Daniel can leave for lunch (senior)");

  return { nathanSched, danielSched };
}

async function testCompatibilityAlgorithm(schedules) {
  section("TEST 3: Compatibility Algorithm");

  const { nathanSched, danielSched } = schedules;

  // Nathan-Daniel should be compatible (both grade 12)
  const nd = computeCompatibility(nathanSched, danielSched);
  assert(nd.compatible === true, "Nathan-Daniel: compatible (both seniors)");
  assert(nd.gradeScore.score === WEIGHTS.gradeLevel, `Nathan-Daniel grade score: ${nd.gradeScore.score}/${WEIGHTS.gradeLevel}`);
  assert(nd.finalScore >= 0 && nd.finalScore <= 100, `Nathan-Daniel score in range: ${nd.finalScore}`);

  // Per-day scores should sum to the day total
  for (let day = 1; day <= 6; day++) {
    const d = nd.dayScores[day];
    const expectedTotal = d.overlap.score + d.arrivalDeparture.score + d.lunch.score + d.extracurricular.score;
    const diff = Math.abs(d.total - expectedTotal);
    assert(diff < 0.01, `Nathan-Daniel Day ${day}: sub-scores sum correctly (${d.total})`);
  }

  // Day average * 6 should roughly equal sum of day scores
  const daySum = Object.values(nd.dayScores).reduce((sum, d) => sum + d.total, 0);
  const expectedAvg = daySum / 6;
  assert(
    Math.abs(nd.dayAverage - expectedAvg) < 0.01,
    `Day average computed correctly: ${nd.dayAverage}`
  );

  // Final score = day average + grade score
  const expectedFinal = nd.dayAverage + nd.gradeScore.score;
  assert(
    Math.abs(nd.finalScore - expectedFinal) < 0.01,
    `Final score = day avg + grade: ${nd.finalScore}`
  );

  return { nd };
}

async function testRanking(schedules) {
  section("TEST 4: Partner Ranking");

  const { nathanSched, danielSched } = schedules;

  const allSchedules = [nathanSched, danielSched];
  const nathanRanking = rankPartners(nathanSched, allSchedules);

  assert(nathanRanking.length === 1, `Nathan has 1 potential partner: ${nathanRanking.length}`);

  console.log("\n  Nathan's ranked partners:");
  for (const r of nathanRanking) {
    console.log(`    ${r.studentB}: ${r.finalScore}/100`);
  }
}

async function testPrintOutputs(parsed, schedules, results) {
  section("TEST 5: Full Output (Visual Verification)");

  console.log("\n  === SCHEDULE DETAILS ===");
  printSchedule(schedules.nathanSched);
  printSchedule(schedules.danielSched);

  console.log("\n  === COMPATIBILITY DETAILS ===");
  printCompatibility(results.nd);
}

// ── Run All Tests ───────────────────────────────────────────────────────────

async function runAllTests() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   iTandem Scheduling System - Integration Tests         ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  try {
    const parsed = await testPDFParser();
    const schedules = await testScheduleBuilder(parsed);
    const results = await testCompatibilityAlgorithm(schedules);
    await testRanking(schedules);
    await testPrintOutputs(parsed, schedules, results);

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
    console.log(`${"═".repeat(60)}`);

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`\nFATAL ERROR: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

runAllTests();
