/**
 * TandemCompatibilityEngine.js
 * Core algorithm that scores compatibility between two users for tandem parking.
 *
 * Implements the Tandem Compatibility Algorithm from Review.md §III:
 *
 * ── Scoring System (0–100 points) ──────────────────────────────────────────
 *
 *  1. Schedule Overlap          (40 points max)
 *     - Calculate time overlap when both need the spot simultaneously
 *     - Perfect score = 0 hours overlap per week
 *     - Deduct 5 points per overlapping hour
 *
 *  2. Grade Level Compatibility (20 points max)
 *     - Senior + Senior = 20 points
 *     - Junior + Junior/Sophomore = 20 points
 *     - Sophomore + Sophomore/Junior = 20 points
 *     - Other combinations = 0 points (seniors can't pair with underclassmen)
 *
 *  3. Arrival Time Compatibility (20 points max)
 *     - If User A leaves before User B arrives consistently = 20 points
 *     - Calculate average gap between departure and arrival
 *     - Deduct points for negative gaps (both at school simultaneously)
 *
 *  4. Extracurricular Alignment (10 points max)
 *     - Both have similar end times = 10 points
 *     - Mixed schedules = 5 points
 *
 *  5. Lunch Habits              (10 points max)
 *     - Both leave for lunch = potential conflict, 0 points
 *     - Only one leaves = 10 points
 *     - Neither leaves = 10 points
 *
 * ── Integration Points ─────────────────────────────────────────────────────
 *   - Schedule System (Nathan)   → schedule entries per day
 *   - User / Auth (Max)          → user profile data
 *   - Rental Service (Daniel)    → spot availability for tandem spots
 */

const TandemMatch = require('../models/TandemMatch');
const {
  GRADE_LEVELS,
  TANDEM_COMPATIBILITY_WEIGHTS,
  SCHEDULE_OVERLAP_CONFIG,
  TANDEM_GRADE_COMPATIBILITY,
  ARRIVAL_GAP_CONFIG,
  EXTRACURRICULAR_CONFIG,
  LUNCH_SCORING,
  ALL_SCHOOL_DAYS,
  TANDEM_CONFIG,
} = require('../utils/constants');

// ── Tiny UUID helper (same pattern as Carpool/RentalService) ────────────────
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

class TandemCompatibilityEngine {
  /**
   * @param {Object} [options]
   * @param {number} [options.minScore] - Override minimum score threshold
   */
  constructor(options = {}) {
    this.minScore = options.minScore ?? TANDEM_CONFIG.MIN_COMPATIBILITY_SCORE;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Compute the compatibility score between two users for tandem parking.
   *
   * @param {Object} params
   * @param {TandemProfile} params.profileA  - First user's tandem profile
   * @param {TandemProfile} params.profileB  - Second user's tandem profile
   * @param {Object[]} params.scheduleA      - User A's schedule entries (from Nathan's system)
   * @param {Object[]} params.scheduleB      - User B's schedule entries
   *   Each schedule entry: {
   *     dayOfWeek: string,              // 'Monday'–'Friday'
   *     arrivalTime: string,            // 'HH:MM' (24-hour)
   *     departureTime: string,          // 'HH:MM' (24-hour)
   *     extracurricularEndTime: string|null, // 'HH:MM' or null
   *     hasLunchOffCampus: boolean,     // Whether the user leaves for lunch
   *   }
   *
   * @return {TandemMatch} The match result with score breakdown
   */
  computeMatch({ profileA, profileB, scheduleA = [], scheduleB = [] }) {
    // ── 1. Grade Level Compatibility (0–20) ─────────────────────────────
    const { score: gradeLevelScore, compatible: gradeCompatible } =
      this.scoreGradeLevel(profileA.gradeLevel, profileB.gradeLevel);

    // If grades are incompatible, short-circuit with 0 for everything
    // Per MVP.md: Seniors ONLY with seniors, juniors/sophomores with each other
    if (!gradeCompatible) {
      return new TandemMatch({
        matchId: generateId(),
        userAId: profileA.userId,
        userBId: profileB.userId,
        overallScore: 0,
        scheduleOverlapScore: 0,
        gradeLevelScore: 0,
        arrivalCompatibilityScore: 0,
        extracurricularScore: 0,
        lunchHabitsScore: 0,
        weeklyOverlapHours: null,
        scheduleDetails: { note: 'Grade levels are incompatible for tandem pairing' },
        gradeCompatible: false,
      });
    }

    // ── 2. Schedule Overlap (0–40) ──────────────────────────────────────
    const {
      score: scheduleOverlapScore,
      weeklyOverlapHours,
      details: overlapDetails,
    } = this.scoreScheduleOverlap(scheduleA, scheduleB);

    // ── 3. Arrival Time Compatibility (0–20) ────────────────────────────
    const {
      score: arrivalCompatibilityScore,
      details: arrivalDetails,
    } = this.scoreArrivalCompatibility(scheduleA, scheduleB);

    // ── 4. Extracurricular Alignment (0–10) ─────────────────────────────
    const {
      score: extracurricularScore,
      details: extracurricularDetails,
    } = this.scoreExtracurricularAlignment(scheduleA, scheduleB);

    // ── 5. Lunch Habits (0–10) ──────────────────────────────────────────
    const {
      score: lunchHabitsScore,
      details: lunchDetails,
    } = this.scoreLunchHabits(scheduleA, scheduleB);

    // ── Build the TandemMatch ───────────────────────────────────────────
    const overallScore =
      scheduleOverlapScore +
      gradeLevelScore +
      arrivalCompatibilityScore +
      extracurricularScore +
      lunchHabitsScore;

    return new TandemMatch({
      matchId: generateId(),
      userAId: profileA.userId,
      userBId: profileB.userId,
      overallScore,
      scheduleOverlapScore,
      gradeLevelScore,
      arrivalCompatibilityScore,
      extracurricularScore,
      lunchHabitsScore,
      weeklyOverlapHours: Math.round(weeklyOverlapHours * 10) / 10,
      scheduleDetails: {
        overlap: overlapDetails,
        arrival: arrivalDetails,
        extracurricular: extracurricularDetails,
        lunch: lunchDetails,
      },
      gradeCompatible: true,
    });
  }

  /**
   * Find all compatible tandem matches for a single user from a pool of candidates.
   * Returns matches sorted by score (highest first), filtered by minimum threshold.
   * Only includes grade-compatible matches.
   *
   * @param {Object} params
   * @param {TandemProfile}   params.targetProfile       - The user seeking matches
   * @param {Object[]}        params.targetSchedule      - The user's schedule
   * @param {TandemProfile[]} params.candidateProfiles   - Pool of other users
   * @param {Map<string,Object[]>} params.candidateSchedules - userId → schedule entries
   *
   * @return {TandemMatch[]} Sorted matches above minimum score
   */
  findMatches({
    targetProfile,
    targetSchedule,
    candidateProfiles,
    candidateSchedules,
  }) {
    const matches = [];

    for (const candidateProfile of candidateProfiles) {
      // Skip self
      if (candidateProfile.userId === targetProfile.userId) continue;

      // Skip inactive profiles
      if (!candidateProfile.isActive) continue;

      // Pre-check grade compatibility to avoid unnecessary computation
      if (!targetProfile.isGradeCompatibleWith(candidateProfile)) continue;

      const candidateSchedule =
        candidateSchedules.get(candidateProfile.userId) || [];

      const match = this.computeMatch({
        profileA: targetProfile,
        profileB: candidateProfile,
        scheduleA: targetSchedule,
        scheduleB: candidateSchedule,
      });

      if (match.meetsMinimumScore(this.minScore)) {
        matches.push(match);
      }
    }

    // Sort by overall score descending
    matches.sort((a, b) => b.overallScore - a.overallScore);

    return matches;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SCORING FUNCTIONS (one per category)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Score grade-level compatibility for tandem pairing.
   *
   * Per MVP.md:
   *   - Seniors should be paired with other seniors
   *   - Juniors can be paired with juniors + sophomores
   *   - Sophomores can be paired with sophomores + juniors
   *
   * @param  {string} gradeA - Grade level of user A
   * @param  {string} gradeB - Grade level of user B
   * @return {{ score: number, compatible: boolean }}
   */
  scoreGradeLevel(gradeA, gradeB) {
    // Senior can ONLY pair with senior
    if (gradeA === GRADE_LEVELS.SENIOR && gradeB === GRADE_LEVELS.SENIOR) {
      return { score: TANDEM_GRADE_COMPATIBILITY.SENIOR_SENIOR, compatible: true };
    }

    // Senior + non-senior = incompatible
    if (gradeA === GRADE_LEVELS.SENIOR || gradeB === GRADE_LEVELS.SENIOR) {
      return { score: TANDEM_GRADE_COMPATIBILITY.INCOMPATIBLE, compatible: false };
    }

    // Junior + Junior
    if (gradeA === GRADE_LEVELS.JUNIOR && gradeB === GRADE_LEVELS.JUNIOR) {
      return { score: TANDEM_GRADE_COMPATIBILITY.JUNIOR_JUNIOR, compatible: true };
    }

    // Sophomore + Sophomore
    if (gradeA === GRADE_LEVELS.SOPHOMORE && gradeB === GRADE_LEVELS.SOPHOMORE) {
      return { score: TANDEM_GRADE_COMPATIBILITY.SOPHOMORE_SOPHOMORE, compatible: true };
    }

    // Junior + Sophomore (either direction)
    return { score: TANDEM_GRADE_COMPATIBILITY.JUNIOR_SOPHOMORE, compatible: true };
  }

  /**
   * Score schedule overlap — how much time both users need the spot simultaneously.
   *
   * Per Review.md §III:
   *   - Perfect score (40 pts) = 0 hours overlap per week
   *   - Deduct 5 points per overlapping hour
   *
   * The overlap is calculated as the intersection of both users' time-at-school
   * intervals across the week.
   *
   * @param  {Object[]} scheduleA - User A's schedule entries
   * @param  {Object[]} scheduleB - User B's schedule entries
   * @return {{ score: number, weeklyOverlapHours: number, details: Object }}
   */
  scoreScheduleOverlap(scheduleA, scheduleB) {
    if (scheduleA.length === 0 || scheduleB.length === 0) {
      return {
        score: 0,
        weeklyOverlapHours: 0,
        details: { note: 'One or both schedules are empty' },
      };
    }

    const byDayA = this._indexByDay(scheduleA);
    const byDayB = this._indexByDay(scheduleB);

    let totalOverlapMinutes = 0;
    const dayDetails = {};

    for (const day of ALL_SCHOOL_DAYS) {
      const entryA = byDayA[day];
      const entryB = byDayB[day];

      if (!entryA || !entryB) {
        dayDetails[day] = { overlapMinutes: 0, reason: 'Missing schedule for one user' };
        continue;
      }

      // Calculate overlap between [arrivalA, departureA] and [arrivalB, departureB]
      const arriveA = this._toMinutes(entryA.arrivalTime);
      const departA = this._toMinutes(entryA.departureTime);
      const arriveB = this._toMinutes(entryB.arrivalTime);
      const departB = this._toMinutes(entryB.departureTime);

      // Overlap = max(0, min(departA, departB) - max(arriveA, arriveB))
      const overlapStart = Math.max(arriveA, arriveB);
      const overlapEnd = Math.min(departA, departB);
      const overlapMinutes = Math.max(0, overlapEnd - overlapStart);

      totalOverlapMinutes += overlapMinutes;

      dayDetails[day] = {
        userA: { arrival: entryA.arrivalTime, departure: entryA.departureTime },
        userB: { arrival: entryB.arrivalTime, departure: entryB.departureTime },
        overlapMinutes,
      };
    }

    const weeklyOverlapHours = totalOverlapMinutes / 60;

    // Score: Start with max points, deduct per overlap hour
    const deduction =
      weeklyOverlapHours * SCHEDULE_OVERLAP_CONFIG.PENALTY_PER_OVERLAP_HOUR;
    const score = Math.max(
      0,
      TANDEM_COMPATIBILITY_WEIGHTS.SCHEDULE_OVERLAP_MAX - deduction
    );

    return {
      score: Math.round(score),
      weeklyOverlapHours,
      details: dayDetails,
    };
  }

  /**
   * Score arrival/departure gap compatibility.
   *
   * Per Review.md §III:
   *   - If User A leaves before User B arrives consistently = 20 points
   *   - Calculate average gap between departure and arrival
   *   - Deduct points for negative gaps
   *
   * For each school day, we check both directions:
   *   - gapAB = B.arrival - A.departure  (positive = A leaves before B arrives)
   *   - gapBA = A.arrival - B.departure  (positive = B leaves before A arrives)
   * We take the BEST gap direction (the pair that works better) and average.
   *
   * @param  {Object[]} scheduleA - User A's schedule entries
   * @param  {Object[]} scheduleB - User B's schedule entries
   * @return {{ score: number, details: Object }}
   */
  scoreArrivalCompatibility(scheduleA, scheduleB) {
    if (scheduleA.length === 0 || scheduleB.length === 0) {
      return { score: 0, details: { note: 'One or both schedules are empty' } };
    }

    const byDayA = this._indexByDay(scheduleA);
    const byDayB = this._indexByDay(scheduleB);

    let totalGapMinutes = 0;
    let daysCompared = 0;
    const dayDetails = {};

    for (const day of ALL_SCHOOL_DAYS) {
      const entryA = byDayA[day];
      const entryB = byDayB[day];

      if (!entryA || !entryB) {
        dayDetails[day] = { reason: 'Missing schedule for one user' };
        continue;
      }

      const departA = this._toMinutes(entryA.departureTime);
      const arriveA = this._toMinutes(entryA.arrivalTime);
      const departB = this._toMinutes(entryB.departureTime);
      const arriveB = this._toMinutes(entryB.arrivalTime);

      // Gap when A leaves before B arrives
      const gapAB = arriveB - departA;
      // Gap when B leaves before A arrives
      const gapBA = arriveA - departB;

      // Take the better gap (whichever direction works)
      const bestGap = Math.max(gapAB, gapBA);

      totalGapMinutes += bestGap;
      daysCompared++;

      dayDetails[day] = {
        gapAB_minutes: gapAB,
        gapBA_minutes: gapBA,
        bestGap_minutes: bestGap,
        direction: gapAB >= gapBA ? 'A-then-B' : 'B-then-A',
      };
    }

    if (daysCompared === 0) {
      return { score: 0, details: dayDetails };
    }

    const avgGapMinutes = totalGapMinutes / daysCompared;

    // Score based on average gap:
    //   - avgGap >= PERFECT_GAP_MINUTES (15 min) → full 20 points
    //   - avgGap between MAX_NEGATIVE_GAP and PERFECT_GAP → linear interpolation
    //   - avgGap <= MAX_NEGATIVE_GAP (-30 min) → 0 points
    let score;
    if (avgGapMinutes >= ARRIVAL_GAP_CONFIG.PERFECT_GAP_MINUTES) {
      score = TANDEM_COMPATIBILITY_WEIGHTS.ARRIVAL_COMPATIBILITY_MAX;
    } else if (avgGapMinutes <= ARRIVAL_GAP_CONFIG.MAX_NEGATIVE_GAP_MINUTES) {
      score = 0;
    } else {
      // Linear interpolation between max negative and perfect gap
      const range =
        ARRIVAL_GAP_CONFIG.PERFECT_GAP_MINUTES -
        ARRIVAL_GAP_CONFIG.MAX_NEGATIVE_GAP_MINUTES;
      const fraction =
        (avgGapMinutes - ARRIVAL_GAP_CONFIG.MAX_NEGATIVE_GAP_MINUTES) / range;
      score = fraction * TANDEM_COMPATIBILITY_WEIGHTS.ARRIVAL_COMPATIBILITY_MAX;
    }

    return {
      score: Math.round(Math.max(0, score)),
      details: { ...dayDetails, avgGapMinutes: Math.round(avgGapMinutes) },
    };
  }

  /**
   * Score extracurricular alignment.
   *
   * Per Review.md §III:
   *   - If both have similar end times = 10 points
   *   - Mixed schedules = 5 points
   *
   * @param  {Object[]} scheduleA - User A's schedule entries
   * @param  {Object[]} scheduleB - User B's schedule entries
   * @return {{ score: number, details: Object }}
   */
  scoreExtracurricularAlignment(scheduleA, scheduleB) {
    if (scheduleA.length === 0 || scheduleB.length === 0) {
      return { score: 0, details: { note: 'One or both schedules are empty' } };
    }

    const byDayA = this._indexByDay(scheduleA);
    const byDayB = this._indexByDay(scheduleB);

    let totalScore = 0;
    let daysCompared = 0;
    const dayDetails = {};

    for (const day of ALL_SCHOOL_DAYS) {
      const entryA = byDayA[day];
      const entryB = byDayB[day];

      if (!entryA || !entryB) continue;

      const hasExtracurricularA = !!entryA.extracurricularEndTime;
      const hasExtracurricularB = !!entryB.extracurricularEndTime;

      daysCompared++;

      if (!hasExtracurricularA && !hasExtracurricularB) {
        // Neither has extracurriculars — no conflict
        totalScore += EXTRACURRICULAR_CONFIG.BOTH_NONE_SCORE;
        dayDetails[day] = { type: 'both_none', dayScore: EXTRACURRICULAR_CONFIG.BOTH_NONE_SCORE };
      } else if (hasExtracurricularA && hasExtracurricularB) {
        // Both have extracurriculars — check if similar end times
        const endA = this._toMinutes(entryA.extracurricularEndTime);
        const endB = this._toMinutes(entryB.extracurricularEndTime);
        const diff = Math.abs(endA - endB);

        if (diff <= EXTRACURRICULAR_CONFIG.SIMILAR_END_TIME_TOLERANCE_MINUTES) {
          totalScore += EXTRACURRICULAR_CONFIG.SIMILAR_SCORE;
          dayDetails[day] = { type: 'both_similar', diffMinutes: diff, dayScore: EXTRACURRICULAR_CONFIG.SIMILAR_SCORE };
        } else {
          // Both have extracurriculars but different end times — decent
          totalScore += EXTRACURRICULAR_CONFIG.MIXED_SCORE;
          dayDetails[day] = { type: 'both_different', diffMinutes: diff, dayScore: EXTRACURRICULAR_CONFIG.MIXED_SCORE };
        }
      } else {
        // Mixed: one has extracurricular, other doesn't
        totalScore += EXTRACURRICULAR_CONFIG.MIXED_SCORE;
        dayDetails[day] = { type: 'mixed', dayScore: EXTRACURRICULAR_CONFIG.MIXED_SCORE };
      }
    }

    // Average across days and scale to max points
    const avgDayScore = daysCompared > 0 ? totalScore / daysCompared : 0;
    const finalScore = Math.min(
      avgDayScore,
      TANDEM_COMPATIBILITY_WEIGHTS.EXTRACURRICULAR_MAX
    );

    return {
      score: Math.round(finalScore),
      details: dayDetails,
    };
  }

  /**
   * Score lunch habits compatibility.
   *
   * Per Review.md §III:
   *   - Both leave for lunch = potential conflict, 0 points
   *   - Only one leaves = 10 points
   *   - Neither leaves = 10 points
   *
   * We evaluate per-day and average across the week.
   *
   * @param  {Object[]} scheduleA - User A's schedule entries
   * @param  {Object[]} scheduleB - User B's schedule entries
   * @return {{ score: number, details: Object }}
   */
  scoreLunchHabits(scheduleA, scheduleB) {
    if (scheduleA.length === 0 || scheduleB.length === 0) {
      return { score: 0, details: { note: 'One or both schedules are empty' } };
    }

    const byDayA = this._indexByDay(scheduleA);
    const byDayB = this._indexByDay(scheduleB);

    let totalScore = 0;
    let daysCompared = 0;
    const dayDetails = {};

    for (const day of ALL_SCHOOL_DAYS) {
      const entryA = byDayA[day];
      const entryB = byDayB[day];

      if (!entryA || !entryB) continue;

      const lunchA = !!entryA.hasLunchOffCampus;
      const lunchB = !!entryB.hasLunchOffCampus;

      daysCompared++;

      if (lunchA && lunchB) {
        // Both leave — conflict
        totalScore += LUNCH_SCORING.BOTH_LEAVE;
        dayDetails[day] = { type: 'both_leave', dayScore: LUNCH_SCORING.BOTH_LEAVE };
      } else if (!lunchA && !lunchB) {
        // Neither leaves — no conflict
        totalScore += LUNCH_SCORING.NEITHER_LEAVES;
        dayDetails[day] = { type: 'neither_leaves', dayScore: LUNCH_SCORING.NEITHER_LEAVES };
      } else {
        // Only one leaves — ideal for tandem
        totalScore += LUNCH_SCORING.ONE_LEAVES;
        dayDetails[day] = { type: 'one_leaves', dayScore: LUNCH_SCORING.ONE_LEAVES };
      }
    }

    // Average across days
    const avgDayScore = daysCompared > 0 ? totalScore / daysCompared : 0;
    const finalScore = Math.min(
      avgDayScore,
      TANDEM_COMPATIBILITY_WEIGHTS.LUNCH_HABITS_MAX
    );

    return {
      score: Math.round(finalScore),
      details: dayDetails,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Index schedule entries by day of week for O(1) lookup.
   * @param  {Object[]} schedule
   * @return {Object} dayOfWeek → schedule entry
   */
  _indexByDay(schedule) {
    const map = {};
    for (const entry of schedule) {
      map[entry.dayOfWeek] = entry;
    }
    return map;
  }

  /**
   * Convert a 'HH:MM' time string to minutes since midnight.
   * @param  {string} timeStr - 'HH:MM' format
   * @return {number} Minutes since midnight
   */
  _toMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }
}

module.exports = TandemCompatibilityEngine;
