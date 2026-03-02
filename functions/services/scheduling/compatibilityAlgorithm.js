/**
 * compatibilityAlgorithm.js
 * 
 * Computes tandem parking compatibility between two students based on
 * their built schedules.
 * 
 * Weights:
 *   - Schedule Overlap:         35%
 *   - Arrival & Departure:      25%
 *   - Lunch Schedule:           15%
 *   - Extracurriculars:         15%
 *   - Grade Level:              10%
 * 
 * Scoring approach:
 *   - For each of the 6 rotation days, compute 4 sub-scores (all except grade level)
 *   - Average the per-day scores across all 6 days (out of 90)
 *   - Add the grade level score (out of 10) once
 *   - Final score: 0 - 100
 */

const { overlapMinutes } = require("./bellSchedule");

// ── Weight Configuration ────────────────────────────────────────────────────

const WEIGHTS = {
  scheduleOverlap: 35,
  arrivalDeparture: 25,
  lunchSchedule: 15,
  extracurriculars: 15,
  gradeLevel: 10,
};

// Maximum possible overlap in a school day (minutes).
// School runs from 8:00 (480) to 15:00 (900) = 420 minutes.
const MAX_DAY_MINUTES = 420;

// Maximum possible stagger gap (minutes) for normalization.
// Considering co-curriculars, the day can extend from 8:00 to 18:00 (600 min range).
// We use this to normalize the arrival/departure score.
const MAX_STAGGER_MINUTES = 600;

// ── Grade Level Compatibility ───────────────────────────────────────────────

// Valid grade pairings for tandem parking.
// Senior(12)+Senior(12), Junior(11)+Junior(11), Junior(11)+Sophomore(10),
// Sophomore(10)+Sophomore(10), Sophomore(10)+Junior(11)
const VALID_GRADE_PAIRS = new Set([
  "12-12",
  "11-11",
  "11-10",
  "10-11",
  "10-10",
]);

/**
 * Compute grade level compatibility score.
 * 
 * @param {number} gradeA - student A grade (10, 11, 12)
 * @param {number} gradeB - student B grade (10, 11, 12)
 * @returns {{ score: number, compatible: boolean }}
 */
function scoreGradeLevel(gradeA, gradeB) {
  const key = `${gradeA}-${gradeB}`;
  const compatible = VALID_GRADE_PAIRS.has(key);
  return {
    score: compatible ? WEIGHTS.gradeLevel : 0,
    compatible,
  };
}

// ── Schedule Overlap Scorer ─────────────────────────────────────────────────

/**
 * Compute schedule overlap score for a single day.
 * 
 * Measures how many minutes both students are simultaneously on campus
 * with occupied time slots (both have class at the same time).
 * 
 * Perfect: 0 overlap = full points (35)
 * Worst: entire day overlaps = 0 points
 * 
 * @param {Object} dayA - day schedule for student A
 * @param {Object} dayB - day schedule for student B
 * @returns {{ score: number, overlapMin: number, detail: string }}
 */
function scoreScheduleOverlap(dayA, dayB) {
  // If either student has no classes, there's no overlap
  if (dayA.arrival === null || dayB.arrival === null) {
    return { score: WEIGHTS.scheduleOverlap, overlapMin: 0, detail: "One or both students have no classes" };
  }

  // Calculate overlap between occupied slots
  const occupiedA = dayA.slots.filter((s) => s.status === "occupied");
  const occupiedB = dayB.slots.filter((s) => s.status === "occupied");

  let totalOverlap = 0;

  for (const slotA of occupiedA) {
    for (const slotB of occupiedB) {
      totalOverlap += overlapMinutes(slotA.startMin, slotA.endMin, slotB.startMin, slotB.endMin);
    }
  }

  // Normalize: 0 overlap = full score, MAX overlap = 0 score
  const maxOverlap = Math.min(
    occupiedA.reduce((sum, s) => sum + (s.endMin - s.startMin), 0),
    occupiedB.reduce((sum, s) => sum + (s.endMin - s.startMin), 0)
  );

  const normalizedOverlap = maxOverlap > 0 ? totalOverlap / maxOverlap : 0;
  const score = WEIGHTS.scheduleOverlap * (1 - normalizedOverlap);

  return {
    score: Math.round(score * 100) / 100,
    overlapMin: totalOverlap,
    detail: `${totalOverlap} min overlap out of ${maxOverlap} max possible`,
  };
}

// ── Arrival & Departure Scorer ──────────────────────────────────────────────

/**
 * Compute arrival and departure stagger score for a single day.
 * 
 * Ideal: one student departs, then the other arrives (positive gap).
 * This means the parking spot is never needed by both at the same time.
 * 
 * Calculation:
 *   gap = later_arrival - earlier_departure
 *   Positive gap = great (one left before other arrived)
 *   Zero gap = they swap exactly
 *   Negative gap = both need spot simultaneously (bad)
 * 
 * @param {Object} dayA - day schedule for student A
 * @param {Object} dayB - day schedule for student B
 * @returns {{ score: number, gapMinutes: number, detail: string }}
 */
function scoreArrivalDeparture(dayA, dayB) {
  if (dayA.arrival === null || dayB.arrival === null) {
    return { score: WEIGHTS.arrivalDeparture, gapMinutes: MAX_STAGGER_MINUTES, detail: "One or both students have no classes" };
  }

  // Use classEnd (before co-curricular) for departure comparison,
  // since the spot exchange happens at the end of academic classes.
  // But also consider actual departure (with co-curricular) as a secondary factor.
  const departA = dayA.departure;
  const departB = dayB.departure;
  const arriveA = dayA.arrival;
  const arriveB = dayB.arrival;

  // Determine who arrives earlier vs later
  let gap;
  if (arriveA <= arriveB) {
    // A arrives first. Best case: A departs before B arrives
    gap = arriveB - departA;
  } else {
    // B arrives first. Best case: B departs before A arrives
    gap = arriveA - departB;
  }

  // Normalize gap to a 0-1 scale
  // gap > 0: great (larger gap = better, up to MAX_STAGGER)
  // gap = 0: okay (they swap exactly)
  // gap < 0: bad (both need spot, larger negative = worse)
  
  // Map from [-MAX_STAGGER, MAX_STAGGER] to [0, 1]
  const normalized = (gap + MAX_STAGGER_MINUTES) / (2 * MAX_STAGGER_MINUTES);
  const clamped = Math.max(0, Math.min(1, normalized));
  const score = WEIGHTS.arrivalDeparture * clamped;

  return {
    score: Math.round(score * 100) / 100,
    gapMinutes: gap,
    detail: `${gap > 0 ? "+" : ""}${gap} min gap (${gap > 0 ? "good - no overlap" : gap === 0 ? "exact swap" : "overlap"})`,
  };
}

// ── Lunch Schedule Scorer ───────────────────────────────────────────────────

/**
 * Compute lunch schedule compatibility score for a single day.
 * 
 * For tandem parking, lunch matters because seniors can leave campus.
 * 
 * Scoring:
 *   - Both have free lunch AND both can leave: conflict (both might need spot) = low score
 *   - One has free lunch, other doesn't: complementary = high score
 *   - Neither has free lunch (or can't leave): neutral = moderate score
 *   - One can leave, other can't: no conflict = high score
 * 
 * @param {Object} dayA - day schedule for student A
 * @param {Object} dayB - day schedule for student B
 * @returns {{ score: number, detail: string }}
 */
function scoreLunchSchedule(dayA, dayB) {
  if (dayA.arrival === null || dayB.arrival === null) {
    return { score: WEIGHTS.lunchSchedule, detail: "One or both students have no classes" };
  }

  const aFreeLunch = dayA.lunchFree && dayA.canLeaveLunch;
  const bFreeLunch = dayB.lunchFree && dayB.canLeaveLunch;

  let normalized;
  let detail;

  if (aFreeLunch && bFreeLunch) {
    // Both might want to leave for lunch - potential spot conflict
    normalized = 0.3;
    detail = "Both can leave for lunch (potential conflict)";
  } else if (aFreeLunch || bFreeLunch) {
    // Only one leaves - great, they can swap the spot during lunch
    normalized = 1.0;
    detail = "One can leave for lunch (complementary)";
  } else {
    // Neither leaves for lunch - neutral, no mid-day swap opportunity
    normalized = 0.5;
    detail = "Neither leaves for lunch (neutral)";
  }

  const score = WEIGHTS.lunchSchedule * normalized;

  return {
    score: Math.round(score * 100) / 100,
    detail,
  };
}

// ── Extracurriculars Scorer ─────────────────────────────────────────────────

/**
 * Compute extracurricular compatibility score for a single day.
 * 
 * Measures how much the students' after-school obligations differ.
 * If one ends early (e.g., 3:00 PM) and the other ends late (e.g., 5:30 PM),
 * that's great for tandem because the spot handoff is clear.
 * 
 * @param {Object} dayA - day schedule for student A
 * @param {Object} dayB - day schedule for student B
 * @returns {{ score: number, detail: string }}
 */
function scoreExtracurriculars(dayA, dayB) {
  if (dayA.arrival === null || dayB.arrival === null) {
    return { score: WEIGHTS.extracurriculars, detail: "One or both students have no classes" };
  }

  const endA = dayA.departure;
  const endB = dayB.departure;

  if (endA === null || endB === null) {
    return { score: WEIGHTS.extracurriculars * 0.5, detail: "Cannot determine departure times" };
  }

  // Calculate the difference in departure times
  const diff = Math.abs(endA - endB);

  // Larger difference = better for tandem (more separation)
  // Max useful difference: ~3 hours (180 min) -- beyond that, diminishing returns
  const MAX_USEFUL_DIFF = 180;
  const normalized = Math.min(diff / MAX_USEFUL_DIFF, 1);
  const score = WEIGHTS.extracurriculars * normalized;

  let detail;
  if (diff === 0) {
    detail = "Both leave at the same time (no separation)";
  } else if (diff < 60) {
    detail = `${diff} min difference in departure (small separation)`;
  } else if (diff < 120) {
    detail = `${diff} min difference in departure (good separation)`;
  } else {
    detail = `${diff} min difference in departure (excellent separation)`;
  }

  return {
    score: Math.round(score * 100) / 100,
    detail,
  };
}

// ── Main Compatibility Function ─────────────────────────────────────────────

/**
 * Compute the full tandem parking compatibility score between two students.
 * 
 * Process:
 *   1. Check grade level compatibility (if incompatible, score = 0)
 *   2. For each of the 6 days, compute 4 sub-scores
 *   3. Average per-day scores across all 6 days (out of 90)
 *   4. Add grade level score (out of 10)
 *   5. Return final score (0-100)
 * 
 * @param {Object} scheduleA - built schedule for student A (from scheduleBuilder)
 * @param {Object} scheduleB - built schedule for student B
 * @returns {Object} compatibility result with scores and breakdown
 */
function computeCompatibility(scheduleA, scheduleB) {
  // Step 1: Grade level check
  const gradeResult = scoreGradeLevel(scheduleA.grade, scheduleB.grade);

  if (!gradeResult.compatible) {
    return {
      studentA: scheduleA.name,
      studentB: scheduleB.name,
      finalScore: 0,
      compatible: false,
      reason: `Incompatible grade levels (${scheduleA.grade} + ${scheduleB.grade})`,
      gradeScore: gradeResult,
      dayScores: {},
      dayAverage: 0,
    };
  }

  // Step 2: Compute per-day scores
  const dayScores = {};
  let dayTotal = 0;

  for (let day = 1; day <= 6; day++) {
    const dayA = scheduleA.days[day];
    const dayB = scheduleB.days[day];

    const overlap = scoreScheduleOverlap(dayA, dayB);
    const arrivalDept = scoreArrivalDeparture(dayA, dayB);
    const lunch = scoreLunchSchedule(dayA, dayB);
    const extracurricular = scoreExtracurriculars(dayA, dayB);

    const dayScore = overlap.score + arrivalDept.score + lunch.score + extracurricular.score;

    dayScores[day] = {
      total: Math.round(dayScore * 100) / 100,
      overlap,
      arrivalDeparture: arrivalDept,
      lunch,
      extracurricular,
    };

    dayTotal += dayScore;
  }

  // Step 3: Average per-day scores (out of 90)
  const dayAverage = dayTotal / 6;

  // Step 4: Final score = day average + grade level (out of 100)
  const finalScore = dayAverage + gradeResult.score;

  return {
    studentA: scheduleA.name,
    studentB: scheduleB.name,
    finalScore: Math.round(finalScore * 100) / 100,
    compatible: true,
    gradeScore: gradeResult,
    dayScores,
    dayAverage: Math.round(dayAverage * 100) / 100,
  };
}

/**
 * Rank all potential tandem partners for a given student.
 * 
 * @param {Object} targetSchedule - built schedule for the target student
 * @param {Object[]} allSchedules - array of built schedules for all other students
 * @returns {Object[]} ranked list of partners with scores, highest first
 */
function rankPartners(targetSchedule, allSchedules) {
  const results = [];

  for (const otherSchedule of allSchedules) {
    // Skip self-comparison
    if (otherSchedule.name === targetSchedule.name) continue;

    const result = computeCompatibility(targetSchedule, otherSchedule);
    results.push(result);
  }

  // Sort by final score descending
  results.sort((a, b) => b.finalScore - a.finalScore);

  return results;
}

/**
 * Pretty-print a compatibility result.
 * 
 * @param {Object} result - output from computeCompatibility()
 */
function printCompatibility(result) {
  const { minutesToTime } = require("./bellSchedule");

  console.log(`\n${"═".repeat(70)}`);
  console.log(`COMPATIBILITY: ${result.studentA} <-> ${result.studentB}`);
  console.log(`${"═".repeat(70)}`);

  if (!result.compatible) {
    console.log(`  INCOMPATIBLE: ${result.reason}`);
    console.log(`  Final Score: 0/100`);
    return;
  }

  console.log(`  Final Score: ${result.finalScore}/100`);
  console.log(`  Grade Level: ${result.gradeScore.score}/${WEIGHTS.gradeLevel}`);
  console.log(`  Day Average (4 factors): ${result.dayAverage}/90`);
  console.log();

  for (let day = 1; day <= 6; day++) {
    const d = result.dayScores[day];
    console.log(`  Day ${day}: ${d.total}/90`);
    console.log(`    Schedule Overlap:   ${d.overlap.score}/${WEIGHTS.scheduleOverlap} - ${d.overlap.detail}`);
    console.log(`    Arrival/Departure:  ${d.arrivalDeparture.score}/${WEIGHTS.arrivalDeparture} - ${d.arrivalDeparture.detail}`);
    console.log(`    Lunch:              ${d.lunch.score}/${WEIGHTS.lunchSchedule} - ${d.lunch.detail}`);
    console.log(`    Extracurriculars:   ${d.extracurricular.score}/${WEIGHTS.extracurriculars} - ${d.extracurricular.detail}`);
  }

  console.log(`\n  ${"─".repeat(50)}`);
  console.log(`  FINAL: ${result.finalScore}/100`);
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  computeCompatibility,
  rankPartners,
  printCompatibility,
  scoreGradeLevel,
  scoreScheduleOverlap,
  scoreArrivalDeparture,
  scoreLunchSchedule,
  scoreExtracurriculars,
  WEIGHTS,
};
