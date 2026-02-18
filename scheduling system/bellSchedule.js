/**
 * bellSchedule.js
 * 
 * Harvard-Westlake 6-day rotating bell schedule configuration.
 * Each day maps to an ordered array of time slots with start/end times.
 * 
 * Source: HW 2025-2026 Bell Schedule
 */

// ── Time Utility Helpers ────────────────────────────────────────────────────

/**
 * Convert "HH:MM" string to minutes since midnight.
 * @param {string} timeStr - e.g. "8:00", "14:15"
 * @returns {number} minutes since midnight
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to "H:MM" or "HH:MM" string.
 * @param {number} minutes - minutes since midnight
 * @returns {string} formatted time string
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/**
 * Calculate the overlap in minutes between two time ranges.
 * @param {number} startA - start of range A (minutes)
 * @param {number} endA   - end of range A (minutes)
 * @param {number} startB - start of range B (minutes)
 * @param {number} endB   - end of range B (minutes)
 * @returns {number} overlap in minutes (0 if no overlap)
 */
function overlapMinutes(startA, endA, startB, endB) {
  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  return Math.max(0, overlapEnd - overlapStart);
}

// ── Bell Schedule Data ──────────────────────────────────────────────────────

/**
 * The full 6-day rotating bell schedule.
 * 
 * Each day has an ordered array of slots. Each slot has:
 *   - slot: display name (matches block identifiers from schedule PDFs)
 *   - block: the numbered block (1-7), or null for non-block slots
 *   - type: "block" | "seminar" | "lunch" | "break" | "ds" | "collab" | "office_hours" | "community"
 *   - start: start time as "HH:MM"
 *   - end: end time as "HH:MM"
 *   - startMin: start time in minutes (computed below)
 *   - endMin: end time in minutes (computed below)
 */
const BELL_SCHEDULE = {
  1: [
    { slot: "Block 1",            block: 1,    type: "block",    start: "8:00",  end: "9:15"  },
    { slot: "Junior Seminar/OH",  block: null,  type: "seminar",  start: "9:20",  end: "10:25" },
    { slot: "Block 2",            block: 2,    type: "block",    start: "10:30", end: "11:45" },
    { slot: "Lunch",              block: null,  type: "lunch",    start: "11:45", end: "12:45" },
    { slot: "Block 3",            block: 3,    type: "block",    start: "12:45", end: "14:00" },
    { slot: "Break",              block: null,  type: "break",    start: "14:00", end: "14:15" },
    { slot: "DS/OH",              block: null,  type: "ds",       start: "14:15", end: "15:00" },
  ],
  2: [
    { slot: "Block 4",               block: 4,    type: "block",    start: "8:00",  end: "9:15"  },
    { slot: "Sophomore Seminar/OH",   block: null,  type: "seminar",  start: "9:20",  end: "9:55"  },
    { slot: "Block 5",               block: 5,    type: "block",    start: "10:00", end: "11:15" },
    { slot: "Lunch",                 block: null,  type: "lunch",    start: "11:15", end: "12:15" },
    { slot: "Block 6",               block: 6,    type: "block",    start: "12:15", end: "13:30" },
    { slot: "Break",                 block: null,  type: "break",    start: "13:30", end: "13:45" },
    { slot: "Block 7",               block: 7,    type: "block",    start: "13:45", end: "15:00" },
  ],
  3: [
    { slot: "Faculty Collaboration",  block: null,  type: "collab",   start: "8:00",  end: "9:50"  },
    { slot: "Block 2",               block: 2,    type: "block",    start: "10:00", end: "11:15" },
    { slot: "Lunch",                 block: null,  type: "lunch",    start: "11:15", end: "12:15" },
    { slot: "Block 3",               block: 3,    type: "block",    start: "12:15", end: "13:30" },
    { slot: "Break",                 block: null,  type: "break",    start: "13:30", end: "13:45" },
    { slot: "Block 1",               block: 1,    type: "block",    start: "13:45", end: "15:00" },
  ],
  4: [
    { slot: "Block 5",                        block: 5,    type: "block",    start: "8:00",  end: "9:15"  },
    { slot: "Senior Seminar/Soph Advisory",    block: null,  type: "seminar",  start: "9:20",  end: "9:55"  },
    { slot: "Block 6",                        block: 6,    type: "block",    start: "10:00", end: "11:15" },
    { slot: "Lunch",                          block: null,  type: "lunch",    start: "11:15", end: "12:15" },
    { slot: "Block 7",                        block: 7,    type: "block",    start: "12:15", end: "13:30" },
    { slot: "Break",                          block: null,  type: "break",    start: "13:30", end: "13:45" },
    { slot: "Block 4",                        block: 4,    type: "block",    start: "13:45", end: "15:00" },
  ],
  5: [
    { slot: "Block 3",          block: 3,    type: "block",      start: "8:00",  end: "9:15"  },
    { slot: "Community Time",   block: null,  type: "community",  start: "9:20",  end: "10:25" },
    { slot: "Block 1",          block: 1,    type: "block",      start: "10:30", end: "11:45" },
    { slot: "Lunch",            block: null,  type: "lunch",      start: "11:45", end: "12:45" },
    { slot: "Block 2",          block: 2,    type: "block",      start: "12:45", end: "14:00" },
    { slot: "Break",            block: null,  type: "break",      start: "14:00", end: "14:15" },
    { slot: "DS/OH",            block: null,  type: "ds",         start: "14:15", end: "15:00" },
  ],
  6: [
    { slot: "Block 6",      block: 6,    type: "block",         start: "8:00",  end: "9:15"  },
    { slot: "Office Hours", block: null,  type: "office_hours",  start: "9:15",  end: "10:00" },
    { slot: "Block 7",      block: 7,    type: "block",         start: "10:00", end: "11:15" },
    { slot: "Lunch",        block: null,  type: "lunch",         start: "11:15", end: "12:15" },
    { slot: "Block 4",      block: 4,    type: "block",         start: "12:15", end: "13:30" },
    { slot: "Break",        block: null,  type: "break",         start: "13:30", end: "13:45" },
    { slot: "Block 5",      block: 5,    type: "block",         start: "13:45", end: "15:00" },
  ],
};

// ── Pre-compute minute values ───────────────────────────────────────────────

for (const day of Object.keys(BELL_SCHEDULE)) {
  for (const slot of BELL_SCHEDULE[day]) {
    slot.startMin = timeToMinutes(slot.start);
    slot.endMin = timeToMinutes(slot.end);
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  BELL_SCHEDULE,
  timeToMinutes,
  minutesToTime,
  overlapMinutes,
};
