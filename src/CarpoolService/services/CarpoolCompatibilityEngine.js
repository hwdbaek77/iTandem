/**
 * CarpoolCompatibilityEngine.js
 * Core algorithm that scores compatibility between two users for carpooling.
 *
 * Implements the Carpool Compatibility Algorithm from Review.md §III:
 *
 * ── Scoring System (0–100 points) ──────────────────────────────────────────
 *
 *  1. Geographic Proximity  (35 points max)
 *     - Haversine distance between home coordinates
 *     - < 1 mile  = 35 pts
 *     - 1–3 miles = 25 pts
 *     - 3–5 miles = 15 pts
 *     - > 5 miles =  0 pts
 *     - Bonus: homes on same route (Lauren's Location Service will provide this)
 *
 *  2. Schedule Alignment    (35 points max)
 *     - Compare arrival times (±15 min window = full points)
 *     - Compare departure times
 *     - Check consistency across weekdays
 *     - Schedule data comes from Nathan's scheduling system
 *
 *  3. Grade Level Priority  (15 points max)
 *     - Senior participants get bonus points
 *     - Helps prioritize seniors who need carpools most (MVP.md)
 *
 *  4. Personal Compatibility (15 points max)
 *     - Music preference similarity
 *     - Bio keyword matching
 *     - User-set preferences
 *
 * ── Integration Points ─────────────────────────────────────────────────────
 *   - Location Service (Lauren)  → route overlap bonus (future)
 *   - Schedule System (Nathan)   → schedule entries per day
 *   - User / Auth (Max)          → user profile data
 *
 * ── Haversine Formula ──────────────────────────────────────────────────────
 * Calculates great-circle distance between two lat/lng points on Earth.
 * Used for geographic proximity scoring.
 */

const CarpoolMatch = require('../models/CarpoolMatch');
const {
  GRADE_LEVELS,
  COMPATIBILITY_WEIGHTS,
  PROXIMITY_THRESHOLDS,
  SCHEDULE_TOLERANCE_MINUTES,
  GRADE_LEVEL_SCORES,
  CARPOOL_CONFIG,
  ALL_SCHOOL_DAYS,
} = require('../utils/constants');

// ── Earth radius in miles (for haversine) ──────────────────────────────────
const EARTH_RADIUS_MILES = 3958.8;

// ── Tiny UUID helper (same as RentalService — swap for `uuid` in production)
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

class CarpoolCompatibilityEngine {
  /**
   * @param {Object} [options]
   * @param {number} [options.minScore]           - Override minimum score threshold
   * @param {number} [options.routeOverlapBonus]  - Override route overlap bonus points
   */
  constructor(options = {}) {
    this.minScore = options.minScore ?? CARPOOL_CONFIG.MIN_COMPATIBILITY_SCORE;
    this.routeOverlapBonus = options.routeOverlapBonus ?? CARPOOL_CONFIG.ROUTE_OVERLAP_BONUS;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Compute the compatibility score between two users.
   *
   * @param {Object} params
   * @param {CarpoolProfile} params.profileA  - First user's carpool profile
   * @param {CarpoolProfile} params.profileB  - Second user's carpool profile
   * @param {Object[]} params.scheduleA       - User A's schedule entries (from Nathan's system)
   * @param {Object[]} params.scheduleB       - User B's schedule entries
   *   Each schedule entry: {
   *     dayOfWeek: string,       // 'Monday'–'Friday'
   *     arrivalTime: string,     // 'HH:MM' (24-hour)
   *     departureTime: string,   // 'HH:MM' (24-hour)
   *     extracurricularEndTime: string|null, // 'HH:MM' or null
   *   }
   * @param {boolean} [params.onSameRoute]    - Route overlap flag (from Lauren's service)
   *
   * @return {CarpoolMatch} The match result with score breakdown
   */
  computeMatch({ profileA, profileB, scheduleA = [], scheduleB = [], onSameRoute = false }) {
    // ── 1. Geographic Proximity (0–35) ──────────────────────────────────
    const distanceMiles = this.calculateHaversineDistance(
      profileA.homeCoordinates,
      profileB.homeCoordinates
    );
    let proximityScore = this.scoreProximity(distanceMiles);

    // Bonus for being on the same route (from Lauren's Location Service)
    if (onSameRoute && proximityScore > 0) {
      proximityScore = Math.min(
        COMPATIBILITY_WEIGHTS.PROXIMITY_MAX,
        proximityScore + this.routeOverlapBonus
      );
    }

    // ── 2. Schedule Alignment (0–35) ────────────────────────────────────
    const { score: scheduleScore, details: scheduleDetails } =
      this.scoreScheduleAlignment(scheduleA, scheduleB);

    // ── 3. Grade Level Priority (0–15) ──────────────────────────────────
    const gradeLevelScore = this.scoreGradeLevel(
      profileA.gradeLevel,
      profileB.gradeLevel
    );

    // ── 4. Personal Compatibility (0–15) ────────────────────────────────
    const personalScore = this.scorePersonalCompatibility(profileA, profileB);

    // ── Build the CarpoolMatch ──────────────────────────────────────────
    const overallScore = proximityScore + scheduleScore + gradeLevelScore + personalScore;

    return new CarpoolMatch({
      matchId: generateId(),
      userAId: profileA.userId,
      userBId: profileB.userId,
      overallScore,
      proximityScore,
      scheduleScore,
      gradeLevelScore,
      personalScore,
      distanceMiles: Math.round(distanceMiles * 100) / 100, // Round to 2 decimals
      scheduleDetails,
    });
  }

  /**
   * Find all compatible matches for a single user from a pool of candidates.
   * Returns matches sorted by score (highest first), filtered by minimum threshold.
   *
   * @param {Object} params
   * @param {CarpoolProfile} params.targetProfile   - The user seeking matches
   * @param {Object[]}       params.targetSchedule  - The user's schedule
   * @param {CarpoolProfile[]} params.candidateProfiles - Pool of other users
   * @param {Map<string,Object[]>} params.candidateSchedules - userId → schedule entries
   * @param {Set<string>}    [params.routeOverlapUserIds] - User IDs on the same route
   *
   * @return {CarpoolMatch[]} Sorted matches above minimum score
   */
  findMatches({
    targetProfile,
    targetSchedule,
    candidateProfiles,
    candidateSchedules,
    routeOverlapUserIds = new Set(),
  }) {
    const matches = [];

    for (const candidateProfile of candidateProfiles) {
      // Skip self
      if (candidateProfile.userId === targetProfile.userId) continue;

      // Skip inactive profiles
      if (!candidateProfile.isActive) continue;

      // Both need valid locations
      if (!targetProfile.hasValidLocation() || !candidateProfile.hasValidLocation()) continue;

      const candidateSchedule = candidateSchedules.get(candidateProfile.userId) || [];
      const onSameRoute = routeOverlapUserIds.has(candidateProfile.userId);

      const match = this.computeMatch({
        profileA: targetProfile,
        profileB: candidateProfile,
        scheduleA: targetSchedule,
        scheduleB: candidateSchedule,
        onSameRoute,
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
   * Score geographic proximity based on haversine distance.
   * Thresholds from Review.md §III.
   *
   * @param  {number} distanceMiles - Distance between homes in miles
   * @return {number} Score (0–35)
   */
  scoreProximity(distanceMiles) {
    for (const threshold of PROXIMITY_THRESHOLDS) {
      if (distanceMiles < threshold.maxMiles) {
        return threshold.points;
      }
    }
    return 0;
  }

  /**
   * Score schedule alignment across weekdays.
   *
   * For each school day where both users have schedules:
   *   - Arrival match:   within ±15 min → up to 3.5 pts per day
   *   - Departure match: within ±15 min → up to 3.5 pts per day
   * Max: 5 days * 7 pts = 35 points
   *
   * Points degrade linearly as the time gap exceeds the tolerance window.
   *
   * @param  {Object[]} scheduleA - User A's schedule entries
   * @param  {Object[]} scheduleB - User B's schedule entries
   * @return {{ score: number, details: Object }}
   */
  scoreScheduleAlignment(scheduleA, scheduleB) {
    if (scheduleA.length === 0 || scheduleB.length === 0) {
      return { score: 0, details: { note: 'One or both schedules are empty' } };
    }

    // Index schedules by day
    const byDayA = this._indexByDay(scheduleA);
    const byDayB = this._indexByDay(scheduleB);

    const pointsPerDay = COMPATIBILITY_WEIGHTS.SCHEDULE_MAX / ALL_SCHOOL_DAYS.length; // 7
    const pointsPerSlot = pointsPerDay / 2; // 3.5 for arrival, 3.5 for departure

    let totalScore = 0;
    const dayDetails = {};

    for (const day of ALL_SCHOOL_DAYS) {
      const entryA = byDayA[day];
      const entryB = byDayB[day];

      if (!entryA || !entryB) {
        dayDetails[day] = { matched: false, reason: 'Missing schedule for one user' };
        continue;
      }

      // ── Arrival comparison ──────────────────────────────────────────
      const arrivalDiffMin = this._timeDifferenceMinutes(
        entryA.arrivalTime,
        entryB.arrivalTime
      );
      const arrivalPts = this._decayScore(arrivalDiffMin, pointsPerSlot);

      // ── Departure comparison ────────────────────────────────────────
      // Use extracurricular end time if available, otherwise departure time
      const depTimeA = entryA.extracurricularEndTime || entryA.departureTime;
      const depTimeB = entryB.extracurricularEndTime || entryB.departureTime;
      const departureDiffMin = this._timeDifferenceMinutes(depTimeA, depTimeB);
      const departurePts = this._decayScore(departureDiffMin, pointsPerSlot);

      const dayScore = arrivalPts + departurePts;
      totalScore += dayScore;

      dayDetails[day] = {
        matched: true,
        arrivalDiffMin,
        arrivalPts: Math.round(arrivalPts * 10) / 10,
        departureDiffMin,
        departurePts: Math.round(departurePts * 10) / 10,
        dayScore: Math.round(dayScore * 10) / 10,
      };
    }

    return {
      score: Math.min(Math.round(totalScore), COMPATIBILITY_WEIGHTS.SCHEDULE_MAX),
      details: dayDetails,
    };
  }

  /**
   * Score grade-level compatibility.
   *
   * Per MVP.md: "Give priority to seniors w/ carpools or just seniors in general"
   * Seniors get the highest priority because they need carpools most.
   *
   * @param  {string} gradeA - Grade level of user A
   * @param  {string} gradeB - Grade level of user B
   * @return {number} Score (0–15)
   */
  scoreGradeLevel(gradeA, gradeB) {
    const bothSeniors =
      gradeA === GRADE_LEVELS.SENIOR && gradeB === GRADE_LEVELS.SENIOR;
    const oneSenior =
      gradeA === GRADE_LEVELS.SENIOR || gradeB === GRADE_LEVELS.SENIOR;
    const bothJuniors =
      gradeA === GRADE_LEVELS.JUNIOR && gradeB === GRADE_LEVELS.JUNIOR;
    const bothSophomores =
      gradeA === GRADE_LEVELS.SOPHOMORE && gradeB === GRADE_LEVELS.SOPHOMORE;

    if (bothSeniors) return GRADE_LEVEL_SCORES.BOTH_SENIORS;
    if (oneSenior) return GRADE_LEVEL_SCORES.ONE_SENIOR;
    if (bothJuniors) return GRADE_LEVEL_SCORES.BOTH_JUNIORS;
    if (bothSophomores) return GRADE_LEVEL_SCORES.BOTH_SOPHOMORES;
    // Junior + Sophomore
    return GRADE_LEVEL_SCORES.JUNIOR_SOPHOMORE;
  }

  /**
   * Score personal compatibility (music preferences, bio overlap).
   *
   * Music preferences: Jaccard similarity (intersection / union) × 10 pts
   * Bio overlap:       Keyword matching × 5 pts
   *
   * @param  {CarpoolProfile} profileA
   * @param  {CarpoolProfile} profileB
   * @return {number} Score (0–15)
   */
  scorePersonalCompatibility(profileA, profileB) {
    let score = 0;

    // ── Music preference similarity (up to 10 points) ────────────────
    score += this._scoreMusicPreferences(
      profileA.musicPreferences,
      profileB.musicPreferences
    );

    // ── Bio keyword matching (up to 5 points) ───────────────────────
    score += this._scoreBioOverlap(profileA.bio, profileB.bio);

    return Math.min(score, COMPATIBILITY_WEIGHTS.PERSONAL_MAX);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  HAVERSINE DISTANCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Calculate the great-circle distance between two points using the
   * Haversine formula.
   *
   * @param  {{ lat: number, lng: number }} coordA
   * @param  {{ lat: number, lng: number }} coordB
   * @return {number} Distance in miles
   */
  calculateHaversineDistance(coordA, coordB) {
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(coordB.lat - coordA.lat);
    const dLng = toRad(coordB.lng - coordA.lng);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(coordA.lat)) *
        Math.cos(toRad(coordB.lat)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_MILES * c;
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
   * Calculate absolute difference in minutes between two time strings.
   * @param  {string} timeA - 'HH:MM' format
   * @param  {string} timeB - 'HH:MM' format
   * @return {number} Absolute difference in minutes
   */
  _timeDifferenceMinutes(timeA, timeB) {
    const toMinutes = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };
    return Math.abs(toMinutes(timeA) - toMinutes(timeB));
  }

  /**
   * Decay scoring function for schedule alignment.
   * Full points when difference ≤ tolerance, linear decay to 0 at 3× tolerance.
   *
   * @param  {number} diffMinutes - Time difference in minutes
   * @param  {number} maxPoints   - Maximum points for this slot
   * @return {number} Decayed score
   */
  _decayScore(diffMinutes, maxPoints) {
    if (diffMinutes <= SCHEDULE_TOLERANCE_MINUTES) {
      // Within tolerance = full points
      return maxPoints;
    }

    // Linear decay: 0 points at 3× tolerance (45 minutes)
    const maxDiff = SCHEDULE_TOLERANCE_MINUTES * 3;
    if (diffMinutes >= maxDiff) return 0;

    const fraction = 1 - (diffMinutes - SCHEDULE_TOLERANCE_MINUTES) / (maxDiff - SCHEDULE_TOLERANCE_MINUTES);
    return maxPoints * fraction;
  }

  /**
   * Score music preference similarity using Jaccard index.
   * @param  {string[]} prefsA
   * @param  {string[]} prefsB
   * @return {number} Score (0–10)
   */
  _scoreMusicPreferences(prefsA, prefsB) {
    if (!prefsA.length || !prefsB.length) return 0;

    // Normalize to lowercase
    const setA = new Set(prefsA.map((p) => p.toLowerCase().trim()));
    const setB = new Set(prefsB.map((p) => p.toLowerCase().trim()));

    // Jaccard similarity = |A ∩ B| / |A ∪ B|
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    if (union === 0) return 0;

    const similarity = intersection / union;
    return Math.round(similarity * 10); // Scale to 0–10
  }

  /**
   * Score bio overlap by extracting keywords and counting shared terms.
   * @param  {string} bioA
   * @param  {string} bioB
   * @return {number} Score (0–5)
   */
  _scoreBioOverlap(bioA, bioB) {
    if (!bioA || !bioB) return 0;

    const extractKeywords = (text) => {
      // Remove punctuation, split on whitespace, filter short/common words
      const stopWords = new Set([
        'i', 'me', 'my', 'the', 'a', 'an', 'is', 'am', 'are', 'was', 'be',
        'to', 'of', 'in', 'for', 'on', 'and', 'or', 'but', 'at', 'by',
        'with', 'from', 'it', 'its', 'this', 'that', 'have', 'has', 'do',
        'not', 'so', 'if', 'like', 'just', 'really', 'very', 'also',
      ]);
      return new Set(
        text
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 2 && !stopWords.has(w))
      );
    };

    const keywordsA = extractKeywords(bioA);
    const keywordsB = extractKeywords(bioB);

    let sharedCount = 0;
    for (const word of keywordsA) {
      if (keywordsB.has(word)) sharedCount++;
    }

    // Scale: 1 shared keyword = 1 pt, up to 5 max
    return Math.min(sharedCount, 5);
  }
}

module.exports = CarpoolCompatibilityEngine;
