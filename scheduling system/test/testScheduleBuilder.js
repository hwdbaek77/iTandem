/**
 * testScheduleBuilder.js
 * 
 * Unit tests for scheduleBuilder.js
 * Tests schedule construction from parsed student data, including
 * arrival/departure times, slot classification, lunch status, and
 * co-curricular handling.
 * 
 * Run: node test/testScheduleBuilder.js
 */

const { buildSchedule, buildDaySchedule } = require("../scheduleBuilder");
const { timeToMinutes, minutesToTime, BELL_SCHEDULE } = require("../bellSchedule");

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

// ── Mock Data Factories ─────────────────────────────────────────────────────

/**
 * Create a mock parsed student with a full schedule (all 7 blocks).
 */
function makeFullStudent(name, grade) {
  return {
    name,
    grade,
    courses: [
      { code: "C1", title: "Course 1", block: 1, type: "academic", dayAssignments: { 1: 1, 2: null, 3: 1, 4: null, 5: 1, 6: null } },
      { code: "C2", title: "Course 2", block: 2, type: "academic", dayAssignments: { 1: 2, 2: null, 3: 2, 4: null, 5: 2, 6: null } },
      { code: "C3", title: "Course 3", block: 3, type: "academic", dayAssignments: { 1: 3, 2: null, 3: 3, 4: null, 5: 3, 6: null } },
      { code: "C4", title: "Course 4", block: 4, type: "academic", dayAssignments: { 1: null, 2: 4, 3: null, 4: 4, 5: null, 6: 4 } },
      { code: "C5", title: "Course 5", block: 5, type: "academic", dayAssignments: { 1: null, 2: 5, 3: null, 4: 5, 5: null, 6: 5 } },
      { code: "C6", title: "Course 6", block: 6, type: "academic", dayAssignments: { 1: null, 2: 6, 3: null, 4: 6, 5: null, 6: 6 } },
      { code: "C7", title: "Course 7", block: 7, type: "academic", dayAssignments: { 1: null, 2: 7, 3: null, 4: 7, 5: null, 6: 7 } },
    ],
    coCurriculars: [],
    directedStudies: [],
    seminars: [],
  };
}

/**
 * Create a mock student with only morning classes (Blocks 1 and 2 on odd days).
 */
function makeMorningStudent(name, grade) {
  return {
    name,
    grade,
    courses: [
      { code: "C1", title: "Course 1", block: 1, type: "academic", dayAssignments: { 1: 1, 2: null, 3: 1, 4: null, 5: 1, 6: null } },
      { code: "C2", title: "Course 2", block: 2, type: "academic", dayAssignments: { 1: 2, 2: null, 3: 2, 4: null, 5: 2, 6: null } },
    ],
    coCurriculars: [],
    directedStudies: [],
    seminars: [],
  };
}

/**
 * Create a mock student with only afternoon classes (Block 3 on odd days).
 */
function makeAfternoonStudent(name, grade) {
  return {
    name,
    grade,
    courses: [
      { code: "C3", title: "Course 3", block: 3, type: "academic", dayAssignments: { 1: 3, 2: null, 3: 3, 4: null, 5: 3, 6: null } },
    ],
    coCurriculars: [],
    directedStudies: [],
    seminars: [],
  };
}

/**
 * Create a mock student with co-curricular.
 */
function makeAthleteStudent(name, grade) {
  return {
    name,
    grade,
    courses: [
      { code: "C1", title: "Course 1", block: 1, type: "academic", dayAssignments: { 1: 1, 2: null, 3: 1, 4: null, 5: 1, 6: null } },
      { code: "C3", title: "Course 3", block: 3, type: "academic", dayAssignments: { 1: 3, 2: null, 3: 3, 4: null, 5: 3, 6: null } },
    ],
    coCurriculars: [
      { code: "CC1", title: "Varsity Sport", type: "co-curricular", dayAssignments: { 1: "CC", 2: "CC", 3: "CC", 4: "CC", 5: "CC", 6: "CC" } },
    ],
    directedStudies: [],
    seminars: [],
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

function testFullScheduleStudent() {
  section("Full Schedule Student (all 7 blocks)");

  const student = makeFullStudent("FULL, STUDENT", 12);
  const sched = buildSchedule(student);

  assertEq(sched.name, "FULL, STUDENT", "Name");
  assertEq(sched.grade, 12, "Grade");
  assertEq(sched.hasCoCurricular, false, "No co-curricular");

  // Day 1: Blocks 1, 2, 3 (odd-day blocks)
  const d1 = sched.days[1];
  assertEq(d1.arrival, timeToMinutes("8:00"), "Day 1 arrival: 8:00 (Block 1)");
  assertEq(d1.classEnd, timeToMinutes("14:00"), "Day 1 class end: 14:00 (Block 3)");
  assertEq(d1.departure, timeToMinutes("14:00"), "Day 1 departure: 14:00 (no co-curricular)");
  assert(d1.occupiedSlots.includes("Block 1"), "Day 1 has Block 1");
  assert(d1.occupiedSlots.includes("Block 2"), "Day 1 has Block 2");
  assert(d1.occupiedSlots.includes("Block 3"), "Day 1 has Block 3");
  assertEq(d1.freeSlots.length, 0, "Day 1: no free block slots");

  // Day 2: Blocks 4, 5, 6, 7 (even-day blocks)
  const d2 = sched.days[2];
  assertEq(d2.arrival, timeToMinutes("8:00"), "Day 2 arrival: 8:00 (Block 4)");
  assertEq(d2.classEnd, timeToMinutes("15:00"), "Day 2 class end: 15:00 (Block 7)");
  assert(d2.occupiedSlots.includes("Block 4"), "Day 2 has Block 4");
  assert(d2.occupiedSlots.includes("Block 7"), "Day 2 has Block 7");

  // Day 3: Blocks 2, 3, 1 (late start day)
  const d3 = sched.days[3];
  assertEq(d3.arrival, timeToMinutes("10:00"), "Day 3 arrival: 10:00 (late start, Block 2)");
  assertEq(d3.classEnd, timeToMinutes("15:00"), "Day 3 class end: 15:00 (Block 1)");
}

function testMorningOnlyStudent() {
  section("Morning-Only Student (Blocks 1 and 2)");

  const student = makeMorningStudent("MORNING, STUDENT", 12);
  const sched = buildSchedule(student);

  // Day 1: only Blocks 1 and 2
  const d1 = sched.days[1];
  assertEq(d1.arrival, timeToMinutes("8:00"), "Arrival: 8:00");
  assertEq(d1.classEnd, timeToMinutes("11:45"), "Class end: 11:45 (Block 2 end)");
  assertEq(d1.departure, timeToMinutes("11:45"), "Departure: 11:45");
  assert(d1.freeSlots.includes("Block 3"), "Block 3 is free");

  // Day 2: no classes (only has odd-day blocks)
  const d2 = sched.days[2];
  assertEq(d2.arrival, null, "Day 2: no arrival (no classes)");
  assertEq(d2.classEnd, null, "Day 2: no class end");
  assertEq(d2.departure, null, "Day 2: no departure");
}

function testAfternoonOnlyStudent() {
  section("Afternoon-Only Student (Block 3 only)");

  const student = makeAfternoonStudent("AFTERNOON, STUDENT", 12);
  const sched = buildSchedule(student);

  // Day 1: only Block 3
  const d1 = sched.days[1];
  assertEq(d1.arrival, timeToMinutes("12:45"), "Arrival: 12:45 (Block 3 start)");
  assertEq(d1.classEnd, timeToMinutes("14:00"), "Class end: 14:00 (Block 3 end)");
  assert(d1.freeSlots.includes("Block 1"), "Block 1 is free");
  assert(d1.freeSlots.includes("Block 2"), "Block 2 is free");
}

function testCoCurricularStudent() {
  section("Student with Co-Curricular");

  const student = makeAthleteStudent("ATHLETE, STUDENT", 12);

  // Default co-curricular end time (17:00)
  const sched1 = buildSchedule(student);
  assertEq(sched1.hasCoCurricular, true, "Has co-curricular");
  assertEq(sched1.coCurricularEndMin, timeToMinutes("17:00"), "Default CC end: 17:00");
  assertEq(sched1.days[1].departure, timeToMinutes("17:00"), "Day 1 departure extended to 17:00");
  assertEq(sched1.days[1].classEnd, timeToMinutes("14:00"), "Day 1 class end still 14:00");

  // Custom co-curricular end time
  const sched2 = buildSchedule(student, { coCurricularEndTime: "18:00" });
  assertEq(sched2.coCurricularEndMin, timeToMinutes("18:00"), "Custom CC end: 18:00");
  assertEq(sched2.days[1].departure, timeToMinutes("18:00"), "Day 1 departure: 18:00");

  // Even on days with no academic classes, co-curricular still extends departure
  // (Day 2 has no odd-day blocks for this student, but CC is every day)
  // Note: arrival is null because there are no occupied slots, but CC is tracked
  const d2 = sched1.days[2];
  assertEq(d2.arrival, null, "Day 2: no academic classes");
}

function testLunchStatus() {
  section("Lunch Status");

  // Senior with classes before and after lunch = free lunch, can leave
  const fullSenior = makeFullStudent("SENIOR, FULL", 12);
  const seniorSched = buildSchedule(fullSenior);
  assertEq(seniorSched.days[1].lunchFree, true, "Senior Day 1: lunch free (classes before and after)");
  assertEq(seniorSched.days[1].canLeaveLunch, true, "Senior: can leave for lunch");

  // Junior = can't leave campus for lunch
  const fullJunior = makeFullStudent("JUNIOR, FULL", 11);
  const juniorSched = buildSchedule(fullJunior);
  assertEq(juniorSched.days[1].canLeaveLunch, false, "Junior: cannot leave for lunch");

  // Sophomore = can't leave campus for lunch
  const fullSoph = makeFullStudent("SOPH, FULL", 10);
  const sophSched = buildSchedule(fullSoph);
  assertEq(sophSched.days[1].canLeaveLunch, false, "Sophomore: cannot leave for lunch");

  // Morning student: class only before lunch, not after
  const morning = makeMorningStudent("MORNING, STUDENT", 12);
  const morningSched = buildSchedule(morning);
  assertEq(morningSched.days[1].lunchFree, false, "Morning student Day 1: lunch not 'free' (no class after)");

  // Afternoon student: class only after lunch, not before
  const afternoon = makeAfternoonStudent("AFTERNOON, STUDENT", 12);
  const afternoonSched = buildSchedule(afternoon);
  assertEq(afternoonSched.days[1].lunchFree, false, "Afternoon student Day 1: lunch not 'free' (no class before)");
}

function testDirectedStudy() {
  section("Directed Study");

  const student = {
    name: "DS, STUDENT",
    grade: 12,
    courses: [
      { code: "C1", title: "Course 1", block: 1, type: "academic", dayAssignments: { 1: 1, 2: null, 3: 1, 4: null, 5: 1, 6: null } },
    ],
    coCurriculars: [],
    directedStudies: [
      { code: "DS1", title: "Directed Study: Finance", type: "directed_study", dayAssignments: { 1: "DS", 2: null, 3: null, 4: null, 5: "DS", 6: null } },
    ],
    seminars: [],
  };

  const sched = buildSchedule(student);

  // Day 1: Block 1 + DS
  const d1 = sched.days[1];
  assert(d1.occupiedSlots.includes("DS/OH"), "Day 1: DS occupied");
  assertEq(d1.classEnd, timeToMinutes("15:00"), "Day 1: class ends at 15:00 (DS end)");

  // Day 3: Block 2 + Block 3 + Block 1, but no DS
  const d3 = sched.days[3];
  assert(!d3.occupiedSlots.includes("DS/OH"), "Day 3: no DS (Day 3 has no DS slot in bell schedule)");

  // Day 5: Block 3 + Block 1 + Block 2 + DS
  const d5 = sched.days[5];
  assert(d5.occupiedSlots.includes("DS/OH"), "Day 5: DS occupied");
}

function testSeminar() {
  section("Seminar Handling");

  const senior = {
    name: "SENIOR, STUDENT",
    grade: 12,
    courses: [
      { code: "C5", title: "Course 5", block: 5, type: "academic", dayAssignments: { 1: null, 2: null, 3: null, 4: 5, 5: null, 6: null } },
    ],
    coCurriculars: [],
    directedStudies: [],
    seminars: [
      { code: "SEM", title: "Senior Seminar", type: "seminar", dayAssignments: { 1: null, 2: null, 3: null, 4: "M12", 5: null, 6: null } },
    ],
  };

  const sched = buildSchedule(senior);
  // Day 4 has "Senior Seminar/Soph Advisory" slot -- senior should attend
  const d4 = sched.days[4];
  assert(
    d4.occupiedSlots.some((s) => s.includes("Senior")),
    "Day 4: senior attends Senior Seminar slot"
  );
}

function testSlotCounts() {
  section("Slot Counts Per Day");

  const student = makeFullStudent("FULL, STUDENT", 12);
  const sched = buildSchedule(student);

  for (let day = 1; day <= 6; day++) {
    const d = sched.days[day];
    const total = d.slots.length;
    assert(total >= 6, `Day ${day}: has ${total} total slots (>= 6)`);
    // Every day should have at least one lunch and one break
    assert(d.slots.some((s) => s.type === "lunch"), `Day ${day}: has lunch slot`);
    assert(d.slots.some((s) => s.type === "break"), `Day ${day}: has break slot`);
  }
}

// ── Run All ─────────────────────────────────────────────────────────────────

function runAll() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   scheduleBuilder.js Unit Tests      ║");
  console.log("╚══════════════════════════════════════╝");

  testFullScheduleStudent();
  testMorningOnlyStudent();
  testAfternoonOnlyStudent();
  testCoCurricularStudent();
  testLunchStatus();
  testDirectedStudy();
  testSeminar();
  testSlotCounts();

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  scheduleBuilder.js: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(50)}`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
