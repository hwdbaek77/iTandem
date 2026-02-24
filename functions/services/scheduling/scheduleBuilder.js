/**
 * scheduleBuilder.js
 * 
 * Transforms parsed student course data into a per-day campus presence map
 * by mapping courses onto the HW bell schedule.
 * 
 * For each of the 6 rotation days, determines:
 *   - Arrival time (when the student first needs to be on campus)
 *   - Departure time (when the student's last obligation ends)
 *   - Which slots are occupied (class in session) vs free
 *   - Lunch status (free or in class, and whether they can leave campus)
 *   - Co-curricular end time (if applicable)
 */

const { BELL_SCHEDULE, timeToMinutes } = require("./bellSchedule");

// ── Constants ───────────────────────────────────────────────────────────────

// Slots that are NOT academic obligations (students may or may not be on campus)
const NON_ACADEMIC_SLOT_TYPES = ["lunch", "break", "collab", "community", "office_hours"];

// Grade levels that can leave campus for lunch (seniors only at HW)
const LUNCH_OFF_CAMPUS_GRADES = [12];

// Default co-curricular end time if a student has a co-curricular but no
// specific end time is provided. Can be overridden per-student.
const DEFAULT_CO_CURRICULAR_END = "17:00"; // 5:00 PM

// ── Core Builder ────────────────────────────────────────────────────────────

/**
 * Build a per-day campus presence schedule from parsed student data.
 * 
 * @param {Object} parsedStudent - output from pdfParser.parsePDF()
 * @param {Object} [options] - optional overrides
 * @param {string} [options.coCurricularEndTime] - "HH:MM" when co-curricular ends (e.g. "17:30")
 * @returns {Object} built schedule with per-day presence data
 */
function buildSchedule(parsedStudent, options = {}) {
  const { name, grade, courses, coCurriculars, directedStudies, seminars } = parsedStudent;

  // Determine co-curricular end time in minutes
  const hasCoCurricular = coCurriculars && coCurriculars.length > 0;
  const coCurricularEndMin = hasCoCurricular
    ? timeToMinutes(options.coCurricularEndTime || DEFAULT_CO_CURRICULAR_END)
    : null;

  // Determine which days have directed study
  const dsDays = new Set();
  if (directedStudies && directedStudies.length > 0) {
    // Use the first directed study's pattern (they typically share the same pattern)
    const dsPattern = directedStudies[0].dayAssignments;
    for (const [day, val] of Object.entries(dsPattern)) {
      if (val === "DS") dsDays.add(parseInt(day, 10));
    }
  }

  // Determine which days have seminar (Senior Seminar = M12, typically Day 4)
  const seminarDays = new Set();
  if (seminars && seminars.length > 0) {
    for (const sem of seminars) {
      for (const [day, val] of Object.entries(sem.dayAssignments)) {
        if (val === "M12") seminarDays.add(parseInt(day, 10));
      }
    }
  }

  // Build per-day schedule
  const days = {};

  for (let day = 1; day <= 6; day++) {
    days[day] = buildDaySchedule(
      day,
      courses,
      grade,
      dsDays.has(day),
      seminarDays.has(day),
      hasCoCurricular,
      coCurricularEndMin
    );
  }

  return {
    name,
    grade,
    days,
    hasCoCurricular,
    coCurricularEndMin,
    coCurricularName: hasCoCurricular ? coCurriculars[0].title : null,
  };
}

/**
 * Build the schedule for a single day.
 * 
 * @param {number} day - day number (1-6)
 * @param {Array} courses - academic courses from parser
 * @param {number} grade - student grade level
 * @param {boolean} hasDS - whether student has directed study this day
 * @param {boolean} hasSeminar - whether student has senior seminar this day (M12)
 * @param {boolean} hasCoCurricular - whether student has co-curricular
 * @param {number|null} coCurricularEndMin - co-curricular end time in minutes
 * @returns {Object} day schedule
 */
function buildDaySchedule(day, courses, grade, hasDS, hasSeminar, hasCoCurricular, coCurricularEndMin) {
  const bellDay = BELL_SCHEDULE[day];
  if (!bellDay) throw new Error(`Invalid day: ${day}`);

  // Determine which blocks the student has class in on this day
  const activeBlocks = new Set();
  for (const course of courses) {
    const dayVal = course.dayAssignments[day];
    if (dayVal !== null && typeof dayVal === "number") {
      activeBlocks.add(dayVal);
    }
  }

  // Classify each bell schedule slot
  const slots = [];
  for (const bellSlot of bellDay) {
    const slotInfo = {
      ...bellSlot,
      status: "free", // default
      courseName: null,
    };

    if (bellSlot.type === "block") {
      // Check if student has a course in this block
      if (activeBlocks.has(bellSlot.block)) {
        slotInfo.status = "occupied";
        // Find the course name
        const course = courses.find((c) => c.dayAssignments[day] === bellSlot.block);
        if (course) slotInfo.courseName = course.title;
      }
    } else if (bellSlot.type === "ds") {
      // Directed Study / Office Hours slot
      if (hasDS) {
        slotInfo.status = "occupied";
        slotInfo.courseName = "Directed Study";
      }
    } else if (bellSlot.type === "seminar") {
      // Seminar slots: students attend if it's their grade's seminar OR if they
      // have a scheduled seminar (like Senior Seminar on Day 4)
      if (hasSeminar && bellSlot.slot.includes("Senior")) {
        slotInfo.status = "occupied";
        slotInfo.courseName = "Senior Seminar";
      } else if (isGradeSeminar(bellSlot.slot, grade)) {
        slotInfo.status = "occupied";
        slotInfo.courseName = bellSlot.slot;
      }
    } else if (bellSlot.type === "lunch") {
      slotInfo.status = "lunch";
    } else if (bellSlot.type === "break") {
      slotInfo.status = "break";
    } else if (bellSlot.type === "collab") {
      // Faculty Collaboration (Day 3) - students don't attend
      slotInfo.status = "free";
    } else if (bellSlot.type === "community" || bellSlot.type === "office_hours") {
      // Community Time / Office Hours - optional, treat as free
      slotInfo.status = "free";
    }

    slots.push(slotInfo);
  }

  // Determine arrival and departure times
  // Arrival = start of first occupied slot
  // Departure = end of last occupied slot (before co-curricular)
  const occupiedSlots = slots.filter((s) => s.status === "occupied");
  const arrival = occupiedSlots.length > 0
    ? Math.min(...occupiedSlots.map((s) => s.startMin))
    : null;
  const classEnd = occupiedSlots.length > 0
    ? Math.max(...occupiedSlots.map((s) => s.endMin))
    : null;

  // Actual departure accounts for co-curricular
  // Co-curricular happens every day after the last bell schedule slot
  const departure = (hasCoCurricular && coCurricularEndMin && classEnd !== null)
    ? Math.max(classEnd, coCurricularEndMin)
    : classEnd;

  // Determine lunch status
  const lunchSlot = slots.find((s) => s.type === "lunch");
  const canLeaveLunch = LUNCH_OFF_CAMPUS_GRADES.includes(grade);

  // Check if there are occupied slots both before AND after lunch
  // If not (e.g., student has no class before lunch), lunch overlaps with
  // their absence from campus
  let lunchFree = true;
  if (lunchSlot && occupiedSlots.length > 0) {
    const hasClassBeforeLunch = occupiedSlots.some((s) => s.endMin <= lunchSlot.startMin);
    const hasClassAfterLunch = occupiedSlots.some((s) => s.startMin >= lunchSlot.endMin);
    // Lunch is "free" (potential to leave) if they have class both before and after
    // If they only have class on one side, they might just arrive late or leave early
    lunchFree = hasClassBeforeLunch && hasClassAfterLunch;
  }

  // Collect occupied and free slot names
  const occupiedSlotNames = occupiedSlots.map((s) => s.slot);
  const freeSlotNames = slots
    .filter((s) => s.status === "free" && s.type === "block")
    .map((s) => s.slot);

  return {
    arrival,
    classEnd,
    departure,
    occupiedSlots: occupiedSlotNames,
    freeSlots: freeSlotNames,
    lunchFree,
    canLeaveLunch,
    hasCoCurricular,
    coCurricularEnd: hasCoCurricular ? coCurricularEndMin : null,
    slots, // full slot detail for debugging/advanced use
  };
}

/**
 * Check if a seminar slot name matches the student's grade.
 * 
 * @param {string} slotName - e.g. "Junior Seminar/OH", "Sophomore Seminar/OH"
 * @param {number} grade - student grade (10, 11, 12)
 * @returns {boolean}
 */
function isGradeSeminar(slotName, grade) {
  const lower = slotName.toLowerCase();
  if (grade === 10 && lower.includes("sophomore")) return true;
  if (grade === 11 && lower.includes("junior")) return true;
  if (grade === 12 && lower.includes("senior")) return true;
  return false;
}

/**
 * Pretty-print a built schedule for debugging.
 * 
 * @param {Object} schedule - output from buildSchedule()
 */
function printSchedule(schedule) {
  const { minutesToTime } = require("./bellSchedule");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Student: ${schedule.name} (Grade ${schedule.grade})`);
  if (schedule.hasCoCurricular) {
    console.log(`Co-curricular: ${schedule.coCurricularName} (ends ${minutesToTime(schedule.coCurricularEndMin)})`);
  }
  console.log(`${"=".repeat(60)}`);

  for (let day = 1; day <= 6; day++) {
    const d = schedule.days[day];
    console.log(`\n  Day ${day}:`);
    if (d.arrival === null) {
      console.log("    No classes this day");
      continue;
    }
    console.log(`    Arrival: ${minutesToTime(d.arrival)} | Class End: ${minutesToTime(d.classEnd)} | Departure: ${minutesToTime(d.departure)}`);
    console.log(`    Occupied: ${d.occupiedSlots.join(", ") || "none"}`);
    console.log(`    Free blocks: ${d.freeSlots.join(", ") || "none"}`);
    console.log(`    Lunch: ${d.lunchFree ? "free" : "n/a (not between classes)"} | Can leave: ${d.canLeaveLunch ? "yes" : "no"}`);
    if (d.hasCoCurricular) {
      console.log(`    Co-curricular until: ${minutesToTime(d.coCurricularEnd)}`);
    }
  }
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  buildSchedule,
  buildDaySchedule,
  printSchedule,
};
