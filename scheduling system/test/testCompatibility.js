/**
 * testCompatibility.js
 * 
 * Unit tests for compatibilityAlgorithm.js
 * Tests each sub-scorer in isolation with mock day schedules, then tests
 * the full computeCompatibility and rankPartners functions.
 * 
 * Run: node test/testCompatibility.js
 */

const {
  scoreGradeLevel,
  scoreScheduleOverlap,
  scoreArrivalDeparture,
  scoreLunchSchedule,
  scoreExtracurriculars,
  computeCompatibility,
  rankPartners,
  WEIGHTS,
} = require("../compatibilityAlgorithm");
const { buildSchedule } = require("../scheduleBuilder");
const { timeToMinutes } = require("../bellSchedule");

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
  assert(actual === expected, `${message} (expected ${expected}, got ${actual})`);
}

function assertApprox(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (expected ~${expected}, got ${actual}, diff ${diff.toFixed(4)})`);
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ── Mock Day Schedule Factory ───────────────────────────────────────────────

/**
 * Create a mock day schedule for testing scorers.
 */
function mockDay({ arrival, classEnd, departure, occupiedSlots = [], lunchFree = true, canLeaveLunch = true, hasCoCurricular = false, coCurricularEnd = null }) {
  // Build mock slots from occupied slot descriptions
  const slots = occupiedSlots.map((s) => ({
    slot: s.name || "Block",
    block: s.block || null,
    type: "block",
    status: "occupied",
    startMin: s.start,
    endMin: s.end,
  }));

  return {
    arrival,
    classEnd,
    departure,
    occupiedSlots: slots.map((s) => s.slot),
    freeSlots: [],
    lunchFree,
    canLeaveLunch,
    hasCoCurricular,
    coCurricularEnd,
    slots,
  };
}

// ── Grade Level Tests ───────────────────────────────────────────────────────

function testGradeLevel() {
  section("scoreGradeLevel");

  // Valid pairs
  const s12 = scoreGradeLevel(12, 12);
  assertEq(s12.compatible, true, "12+12: compatible");
  assertEq(s12.score, WEIGHTS.gradeLevel, "12+12: full score");

  const s11 = scoreGradeLevel(11, 11);
  assertEq(s11.compatible, true, "11+11: compatible");
  assertEq(s11.score, WEIGHTS.gradeLevel, "11+11: full score");

  const s1110 = scoreGradeLevel(11, 10);
  assertEq(s1110.compatible, true, "11+10: compatible");

  const s1011 = scoreGradeLevel(10, 11);
  assertEq(s1011.compatible, true, "10+11: compatible");

  const s1010 = scoreGradeLevel(10, 10);
  assertEq(s1010.compatible, true, "10+10: compatible");

  // Invalid pairs
  const s1210 = scoreGradeLevel(12, 10);
  assertEq(s1210.compatible, false, "12+10: incompatible");
  assertEq(s1210.score, 0, "12+10: zero score");

  const s1012 = scoreGradeLevel(10, 12);
  assertEq(s1012.compatible, false, "10+12: incompatible");

  const s1211 = scoreGradeLevel(12, 11);
  assertEq(s1211.compatible, false, "12+11: incompatible");
}

// ── Schedule Overlap Tests ──────────────────────────────────────────────────

function testScheduleOverlap() {
  section("scoreScheduleOverlap");

  // Perfect: no overlap (A morning, B afternoon)
  const dayA1 = mockDay({
    arrival: 480, classEnd: 675, departure: 675,
    occupiedSlots: [{ name: "Block 1", start: 480, end: 555 }, { name: "Block 2", start: 630, end: 705 }],
  });
  const dayB1 = mockDay({
    arrival: 765, classEnd: 840, departure: 840,
    occupiedSlots: [{ name: "Block 3", start: 765, end: 840 }],
  });
  const r1 = scoreScheduleOverlap(dayA1, dayB1);
  assertEq(r1.overlapMin, 0, "No overlap: 0 min");
  assertEq(r1.score, WEIGHTS.scheduleOverlap, "No overlap: full score (35)");

  // Worst: complete overlap (identical schedules)
  const dayFull = mockDay({
    arrival: 480, classEnd: 900, departure: 900,
    occupiedSlots: [
      { name: "Block 1", start: 480, end: 555 },
      { name: "Block 2", start: 630, end: 705 },
      { name: "Block 3", start: 765, end: 840 },
    ],
  });
  const r2 = scoreScheduleOverlap(dayFull, dayFull);
  assertEq(r2.score, 0, "Complete overlap: 0 score");

  // One student has no classes
  const dayEmpty = mockDay({ arrival: null, classEnd: null, departure: null });
  const r3 = scoreScheduleOverlap(dayFull, dayEmpty);
  assertEq(r3.score, WEIGHTS.scheduleOverlap, "One empty: full score");

  // Partial overlap
  const dayA4 = mockDay({
    arrival: 480, classEnd: 705, departure: 705,
    occupiedSlots: [{ name: "Block 1", start: 480, end: 555 }, { name: "Block 2", start: 630, end: 705 }],
  });
  const dayB4 = mockDay({
    arrival: 630, classEnd: 840, departure: 840,
    occupiedSlots: [{ name: "Block 2", start: 630, end: 705 }, { name: "Block 3", start: 765, end: 840 }],
  });
  const r4 = scoreScheduleOverlap(dayA4, dayB4);
  assert(r4.overlapMin === 75, `Partial overlap: ${r4.overlapMin} min (Block 2 shared = 75 min)`);
  assert(r4.score > 0 && r4.score < WEIGHTS.scheduleOverlap, `Partial overlap: score between 0 and ${WEIGHTS.scheduleOverlap}`);
}

// ── Arrival/Departure Tests ─────────────────────────────────────────────────

function testArrivalDeparture() {
  section("scoreArrivalDeparture");

  // Perfect stagger: A leaves before B arrives
  const dayA1 = mockDay({ arrival: 480, classEnd: 675, departure: 675, occupiedSlots: [{ start: 480, end: 675 }] });
  const dayB1 = mockDay({ arrival: 765, classEnd: 900, departure: 900, occupiedSlots: [{ start: 765, end: 900 }] });
  const r1 = scoreArrivalDeparture(dayA1, dayB1);
  assert(r1.gapMinutes > 0, `Positive gap: ${r1.gapMinutes} min`);
  assert(r1.score > WEIGHTS.arrivalDeparture * 0.5, "Good stagger: above midpoint score");

  // Worst: both arrive and leave at same time
  const daySame = mockDay({ arrival: 480, classEnd: 900, departure: 900, occupiedSlots: [{ start: 480, end: 900 }] });
  const r2 = scoreArrivalDeparture(daySame, daySame);
  assert(r2.gapMinutes < 0, "Same schedule: negative gap");
  assert(r2.score < WEIGHTS.arrivalDeparture * 0.5, "Same schedule: below midpoint");

  // One empty
  const dayEmpty = mockDay({ arrival: null, classEnd: null, departure: null });
  const r3 = scoreArrivalDeparture(daySame, dayEmpty);
  assertEq(r3.score, WEIGHTS.arrivalDeparture, "One empty: full score");

  // Co-curricular extends departure
  const dayCC = mockDay({ arrival: 480, classEnd: 900, departure: 1050, occupiedSlots: [{ start: 480, end: 900 }], hasCoCurricular: true });
  const dayShort = mockDay({ arrival: 480, classEnd: 675, departure: 675, occupiedSlots: [{ start: 480, end: 675 }] });
  const r4 = scoreArrivalDeparture(dayCC, dayShort);
  assert(r4.gapMinutes < 0, "CC day vs short day: negative gap (both start at 8)");
}

// ── Lunch Tests ─────────────────────────────────────────────────────────────

function testLunchSchedule() {
  section("scoreLunchSchedule");

  // Both seniors, both free lunch = potential conflict (low score)
  const dayBothFree = mockDay({ arrival: 480, classEnd: 900, departure: 900, lunchFree: true, canLeaveLunch: true, occupiedSlots: [{ start: 480, end: 900 }] });
  const r1 = scoreLunchSchedule(dayBothFree, dayBothFree);
  assertApprox(r1.score, WEIGHTS.lunchSchedule * 0.3, 0.01, "Both free: low score (conflict)");

  // One free, one not = complementary (full score)
  const dayNotFree = mockDay({ arrival: 480, classEnd: 900, departure: 900, lunchFree: false, canLeaveLunch: true, occupiedSlots: [{ start: 480, end: 900 }] });
  const r2 = scoreLunchSchedule(dayBothFree, dayNotFree);
  assertApprox(r2.score, WEIGHTS.lunchSchedule * 1.0, 0.01, "One free: full score (complementary)");

  // Neither free = neutral (mid score)
  const r3 = scoreLunchSchedule(dayNotFree, dayNotFree);
  assertApprox(r3.score, WEIGHTS.lunchSchedule * 0.5, 0.01, "Neither free: mid score (neutral)");

  // Junior can't leave even if lunch is free
  const dayJunior = mockDay({ arrival: 480, classEnd: 900, departure: 900, lunchFree: true, canLeaveLunch: false, occupiedSlots: [{ start: 480, end: 900 }] });
  const r4 = scoreLunchSchedule(dayJunior, dayBothFree);
  assertApprox(r4.score, WEIGHTS.lunchSchedule * 1.0, 0.01, "Junior+Senior: complementary (junior can't leave)");

  // One empty day
  const dayEmpty = mockDay({ arrival: null, classEnd: null, departure: null });
  const r5 = scoreLunchSchedule(dayBothFree, dayEmpty);
  assertApprox(r5.score, WEIGHTS.lunchSchedule, 0.01, "One empty: full score");
}

// ── Extracurriculars Tests ──────────────────────────────────────────────────

function testExtracurriculars() {
  section("scoreExtracurriculars");

  // Large separation: one leaves at 15:00, other at 17:30
  const dayEarly = mockDay({ arrival: 480, classEnd: 900, departure: 900, occupiedSlots: [{ start: 480, end: 900 }] });
  const dayLate = mockDay({ arrival: 480, classEnd: 900, departure: 1050, occupiedSlots: [{ start: 480, end: 900 }] });
  const r1 = scoreExtracurriculars(dayEarly, dayLate);
  assert(r1.score > WEIGHTS.extracurriculars * 0.5, "Large separation: high score");

  // No separation: both leave at same time
  const r2 = scoreExtracurriculars(dayEarly, dayEarly);
  assertEq(r2.score, 0, "Same departure: 0 score");

  // Maximum separation: 3+ hours
  const dayVeryLate = mockDay({ arrival: 480, classEnd: 900, departure: 1080, occupiedSlots: [{ start: 480, end: 900 }] }); // 18:00
  const r3 = scoreExtracurriculars(dayEarly, dayVeryLate);
  assertApprox(r3.score, WEIGHTS.extracurriculars, 0.01, "3hr+ separation: max score");

  // One empty
  const dayEmpty = mockDay({ arrival: null, classEnd: null, departure: null });
  const r4 = scoreExtracurriculars(dayEarly, dayEmpty);
  assertEq(r4.score, WEIGHTS.extracurriculars, "One empty: full score");
}

// ── Full Compatibility Tests ────────────────────────────────────────────────

function testFullCompatibility() {
  section("computeCompatibility - Full Pipeline");

  // Make two mock students with very different schedules
  const morningStudent = {
    name: "MORNING, STUDENT", grade: 12,
    courses: [
      { code: "C1", title: "Course 1", block: 1, type: "academic", dayAssignments: { 1: 1, 2: null, 3: 1, 4: null, 5: 1, 6: null } },
      { code: "C2", title: "Course 2", block: 2, type: "academic", dayAssignments: { 1: 2, 2: null, 3: 2, 4: null, 5: 2, 6: null } },
      { code: "C4", title: "Course 4", block: 4, type: "academic", dayAssignments: { 1: null, 2: 4, 3: null, 4: 4, 5: null, 6: 4 } },
    ],
    coCurriculars: [], directedStudies: [], seminars: [],
  };

  const afternoonStudent = {
    name: "AFTERNOON, STUDENT", grade: 12,
    courses: [
      { code: "C3", title: "Course 3", block: 3, type: "academic", dayAssignments: { 1: 3, 2: null, 3: 3, 4: null, 5: 3, 6: null } },
      { code: "C6", title: "Course 6", block: 6, type: "academic", dayAssignments: { 1: null, 2: 6, 3: null, 4: 6, 5: null, 6: 6 } },
      { code: "C7", title: "Course 7", block: 7, type: "academic", dayAssignments: { 1: null, 2: 7, 3: null, 4: 7, 5: null, 6: 7 } },
    ],
    coCurriculars: [], directedStudies: [], seminars: [],
  };

  const schedA = buildSchedule(morningStudent);
  const schedB = buildSchedule(afternoonStudent);
  const result = computeCompatibility(schedA, schedB);

  assert(result.compatible, "Same grade: compatible");
  assert(result.finalScore > 0, `Score > 0: ${result.finalScore}`);
  assert(result.finalScore <= 100, `Score <= 100: ${result.finalScore}`);
  assertEq(result.gradeScore.score, WEIGHTS.gradeLevel, "Grade score: full");

  // Should have per-day scores for all 6 days
  for (let day = 1; day <= 6; day++) {
    assert(result.dayScores[day] !== undefined, `Day ${day} has scores`);
    assert(result.dayScores[day].total >= 0, `Day ${day} total >= 0`);
  }

  // Incompatible grades
  const grade10Student = { ...morningStudent, name: "SOPH", grade: 10 };
  const grade12Student = { ...afternoonStudent, name: "SENIOR", grade: 12 };
  const schedC = buildSchedule(grade10Student);
  const schedD = buildSchedule(grade12Student);
  const incompatible = computeCompatibility(schedC, schedD);
  assertEq(incompatible.compatible, false, "10+12: incompatible");
  assertEq(incompatible.finalScore, 0, "Incompatible: score 0");
}

function testScoreRange() {
  section("Score Range Validation");

  // Create identical full-schedule seniors -- worst case for tandem
  const fullStudent = {
    name: "FULL, A", grade: 12,
    courses: [
      { code: "C1", title: "C1", block: 1, type: "academic", dayAssignments: { 1: 1, 2: null, 3: 1, 4: null, 5: 1, 6: null } },
      { code: "C2", title: "C2", block: 2, type: "academic", dayAssignments: { 1: 2, 2: null, 3: 2, 4: null, 5: 2, 6: null } },
      { code: "C3", title: "C3", block: 3, type: "academic", dayAssignments: { 1: 3, 2: null, 3: 3, 4: null, 5: 3, 6: null } },
      { code: "C4", title: "C4", block: 4, type: "academic", dayAssignments: { 1: null, 2: 4, 3: null, 4: 4, 5: null, 6: 4 } },
      { code: "C5", title: "C5", block: 5, type: "academic", dayAssignments: { 1: null, 2: 5, 3: null, 4: 5, 5: null, 6: 5 } },
      { code: "C6", title: "C6", block: 6, type: "academic", dayAssignments: { 1: null, 2: 6, 3: null, 4: 6, 5: null, 6: 6 } },
      { code: "C7", title: "C7", block: 7, type: "academic", dayAssignments: { 1: null, 2: 7, 3: null, 4: 7, 5: null, 6: 7 } },
    ],
    coCurriculars: [], directedStudies: [], seminars: [],
  };

  const schedA = buildSchedule({ ...fullStudent, name: "FULL, A" });
  const schedB = buildSchedule({ ...fullStudent, name: "FULL, B" });
  const result = computeCompatibility(schedA, schedB);

  assert(result.finalScore >= 0, `Identical schedules score >= 0: ${result.finalScore}`);
  assert(result.finalScore <= 100, `Identical schedules score <= 100: ${result.finalScore}`);
  // Identical full schedules should score low (lots of overlap, same arrival/departure)
  assert(result.finalScore < 50, `Identical full schedules score < 50: ${result.finalScore}`);
}

function testRankPartners() {
  section("rankPartners");

  const studentA = {
    name: "STUDENT, A", grade: 12,
    courses: [
      { code: "C1", title: "C1", block: 1, type: "academic", dayAssignments: { 1: 1, 2: null, 3: 1, 4: null, 5: 1, 6: null } },
    ],
    coCurriculars: [], directedStudies: [], seminars: [],
  };
  const studentB = {
    name: "STUDENT, B", grade: 12,
    courses: [
      { code: "C1", title: "C1", block: 1, type: "academic", dayAssignments: { 1: 1, 2: null, 3: 1, 4: null, 5: 1, 6: null } },
      { code: "C3", title: "C3", block: 3, type: "academic", dayAssignments: { 1: 3, 2: null, 3: 3, 4: null, 5: 3, 6: null } },
    ],
    coCurriculars: [], directedStudies: [], seminars: [],
  };
  const studentC = {
    name: "STUDENT, C", grade: 12,
    courses: [
      { code: "C3", title: "C3", block: 3, type: "academic", dayAssignments: { 1: 3, 2: null, 3: 3, 4: null, 5: 3, 6: null } },
    ],
    coCurriculars: [], directedStudies: [], seminars: [],
  };

  const schedA = buildSchedule(studentA);
  const schedB = buildSchedule(studentB);
  const schedC = buildSchedule(studentC);

  const ranking = rankPartners(schedA, [schedA, schedB, schedC]);
  assertEq(ranking.length, 2, "Ranking excludes self");
  assert(ranking[0].finalScore >= ranking[1].finalScore, "Ranking sorted descending");

  // Student C (afternoon only) should rank higher for Student A (morning only)
  // because they have less overlap
  const topPartner = ranking[0].studentB;
  assert(topPartner === "STUDENT, C", `Best partner for A is C (least overlap): got ${topPartner}`);
}

function testWeightsSum() {
  section("Weights Configuration");

  const totalWeight = WEIGHTS.scheduleOverlap + WEIGHTS.arrivalDeparture +
    WEIGHTS.lunchSchedule + WEIGHTS.extracurriculars + WEIGHTS.gradeLevel;
  assertEq(totalWeight, 100, "All weights sum to 100");
  assertEq(WEIGHTS.scheduleOverlap, 35, "Schedule Overlap: 35");
  assertEq(WEIGHTS.arrivalDeparture, 25, "Arrival/Departure: 25");
  assertEq(WEIGHTS.lunchSchedule, 15, "Lunch: 15");
  assertEq(WEIGHTS.extracurriculars, 15, "Extracurriculars: 15");
  assertEq(WEIGHTS.gradeLevel, 10, "Grade Level: 10");
}

// ── Run All ─────────────────────────────────────────────────────────────────

function runAll() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   compatibilityAlgorithm.js Tests    ║");
  console.log("╚══════════════════════════════════════╝");

  testWeightsSum();
  testGradeLevel();
  testScheduleOverlap();
  testArrivalDeparture();
  testLunchSchedule();
  testExtracurriculars();
  testFullCompatibility();
  testScoreRange();
  testRankPartners();

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  compatibilityAlgorithm.js: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(50)}`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
