/**
 * testBellSchedule.js
 * 
 * Unit tests for bellSchedule.js
 * Tests time utility functions and bell schedule data integrity.
 * 
 * Run: node test/testBellSchedule.js
 */

const {
  BELL_SCHEDULE,
  timeToMinutes,
  minutesToTime,
  overlapMinutes,
} = require("../bellSchedule");

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

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ── Tests ───────────────────────────────────────────────────────────────────

section("timeToMinutes");
assertEq(timeToMinutes("0:00"), 0, "Midnight");
assertEq(timeToMinutes("8:00"), 480, "8:00 AM");
assertEq(timeToMinutes("9:15"), 555, "9:15 AM");
assertEq(timeToMinutes("12:00"), 720, "Noon");
assertEq(timeToMinutes("12:45"), 765, "12:45 PM");
assertEq(timeToMinutes("14:15"), 855, "2:15 PM");
assertEq(timeToMinutes("15:00"), 900, "3:00 PM");
assertEq(timeToMinutes("17:30"), 1050, "5:30 PM");
assertEq(timeToMinutes("23:59"), 1439, "11:59 PM");

section("minutesToTime");
assertEq(minutesToTime(0), "0:00", "Midnight");
assertEq(minutesToTime(480), "8:00", "8:00 AM");
assertEq(minutesToTime(555), "9:15", "9:15 AM");
assertEq(minutesToTime(720), "12:00", "Noon");
assertEq(minutesToTime(900), "15:00", "3:00 PM");
assertEq(minutesToTime(1050), "17:30", "5:30 PM");

section("minutesToTime round-trip");
const testTimes = ["8:00", "9:15", "10:30", "11:45", "12:45", "14:00", "15:00"];
for (const t of testTimes) {
  assertEq(minutesToTime(timeToMinutes(t)), t, `Round-trip: ${t}`);
}

section("overlapMinutes");
// No overlap
assertEq(overlapMinutes(480, 555, 600, 675), 0, "No overlap: 8:00-9:15 vs 10:00-11:15");
// Full overlap (identical ranges)
assertEq(overlapMinutes(480, 555, 480, 555), 75, "Full overlap: identical ranges");
// Partial overlap
assertEq(overlapMinutes(480, 600, 555, 675), 45, "Partial overlap: 8:00-10:00 vs 9:15-11:15");
// One contains the other
assertEq(overlapMinutes(480, 900, 555, 675), 120, "Contained: 8:00-15:00 contains 9:15-11:15");
// Adjacent (touching but not overlapping)
assertEq(overlapMinutes(480, 555, 555, 675), 0, "Adjacent: 8:00-9:15 then 9:15-11:15");
// Zero-width range
assertEq(overlapMinutes(480, 480, 480, 555), 0, "Zero-width range A");
// Reversed order args (A after B)
assertEq(overlapMinutes(600, 675, 480, 555), 0, "No overlap: B before A");

section("Bell Schedule Data Integrity");
// All 6 days exist
assertEq(Object.keys(BELL_SCHEDULE).length, 6, "6 days in schedule");
for (let day = 1; day <= 6; day++) {
  assert(Array.isArray(BELL_SCHEDULE[day]), `Day ${day} is an array`);
  assert(BELL_SCHEDULE[day].length >= 6, `Day ${day} has at least 6 slots`);
}

section("Bell Schedule - Day Structure");
// Every day has exactly one Lunch slot and one Break slot
for (let day = 1; day <= 6; day++) {
  const slots = BELL_SCHEDULE[day];
  const lunchSlots = slots.filter((s) => s.type === "lunch");
  const breakSlots = slots.filter((s) => s.type === "break");
  assertEq(lunchSlots.length, 1, `Day ${day} has 1 lunch slot`);
  assertEq(breakSlots.length, 1, `Day ${day} has 1 break slot`);
}

section("Bell Schedule - Pre-computed Minutes");
// All slots should have startMin and endMin computed
for (let day = 1; day <= 6; day++) {
  for (const slot of BELL_SCHEDULE[day]) {
    assert(typeof slot.startMin === "number", `Day ${day} ${slot.slot}: startMin is number`);
    assert(typeof slot.endMin === "number", `Day ${day} ${slot.slot}: endMin is number`);
    assert(slot.endMin > slot.startMin, `Day ${day} ${slot.slot}: end > start`);
    assertEq(slot.startMin, timeToMinutes(slot.start), `Day ${day} ${slot.slot}: startMin matches start`);
    assertEq(slot.endMin, timeToMinutes(slot.end), `Day ${day} ${slot.slot}: endMin matches end`);
  }
}

section("Bell Schedule - Time Ordering");
// Slots within each day should be in chronological order
for (let day = 1; day <= 6; day++) {
  const slots = BELL_SCHEDULE[day];
  for (let i = 1; i < slots.length; i++) {
    assert(
      slots[i].startMin >= slots[i - 1].startMin,
      `Day ${day}: ${slots[i].slot} starts after ${slots[i - 1].slot}`
    );
  }
}

section("Bell Schedule - All 7 Blocks Present Across Week");
// Blocks 1-7 should each appear on at least 3 days (they appear every other day)
for (let block = 1; block <= 7; block++) {
  let count = 0;
  for (let day = 1; day <= 6; day++) {
    if (BELL_SCHEDULE[day].some((s) => s.block === block)) count++;
  }
  assert(count >= 3, `Block ${block} appears on ${count} days (expected >= 3)`);
}

section("Bell Schedule - Day 3 Late Start");
// Day 3 starts with Faculty Collaboration, not a block
const day3First = BELL_SCHEDULE[3][0];
assertEq(day3First.type, "collab", "Day 3 starts with Faculty Collaboration");
assertEq(day3First.start, "8:00", "Day 3 Faculty Collab starts at 8:00");
// First actual block on Day 3 should be Block 2 at 10:00
const day3FirstBlock = BELL_SCHEDULE[3].find((s) => s.type === "block");
assertEq(day3FirstBlock.block, 2, "Day 3 first block is Block 2");
assertEq(day3FirstBlock.start, "10:00", "Day 3 Block 2 starts at 10:00");

// ── Results ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`  bellSchedule.js: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(50)}`);
process.exit(failed > 0 ? 1 : 0);
