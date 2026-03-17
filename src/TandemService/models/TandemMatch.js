/**
 * TandemMatch.js
 * Represents the result of running the TandemCompatibilityEngine between
 * two users.  Stores the overall score and the per-category breakdown.
 *
 * Review.md §IV (Matching Service) specifies that match results should be
 * cached in Redis with a TTL.  This model provides `toJSON()` / `fromJSON()`
 * serialization to support that caching layer.
 *
 * The TandemCompatibilityEngine produces TandemMatch instances, and the
 * TandemService surfaces them via `GET /api/tandem/matches`.
 *
 * Scoring breakdown (Review.md §III — Tandem):
 *   - Schedule Overlap          : 0–40 points
 *   - Grade Level Compatibility : 0–20 points
 *   - Arrival Time Compatibility: 0–20 points
 *   - Extracurricular Alignment : 0–10 points
 *   - Lunch Habits              : 0–10 points
 *   ─────────────────────────────────────────
 *   Total                       : 0–100 points
 */

class TandemMatch {
  /**
   * @param {Object} data
   * @param {string}  data.matchId                  - UUID primary key
   * @param {string}  data.userAId                  - First user in the pair
   * @param {string}  data.userBId                  - Second user in the pair
   * @param {number}  data.overallScore             - Combined score (0–100)
   * @param {number}  data.scheduleOverlapScore     - Schedule overlap score (0–40)
   * @param {number}  data.gradeLevelScore          - Grade level compatibility score (0–20)
   * @param {number}  data.arrivalCompatibilityScore - Arrival/departure gap score (0–20)
   * @param {number}  data.extracurricularScore     - Extracurricular alignment score (0–10)
   * @param {number}  data.lunchHabitsScore         - Lunch habits score (0–10)
   * @param {number}  [data.weeklyOverlapHours]     - Total hours of schedule overlap per week
   * @param {Object}  [data.scheduleDetails]        - Per-day schedule comparison details
   * @param {boolean} [data.gradeCompatible]        - Whether grade levels are compatible
   * @param {Date}    [data.createdAt]              - When this match was computed
   */
  constructor({
    matchId,
    userAId,
    userBId,
    overallScore,
    scheduleOverlapScore,
    gradeLevelScore,
    arrivalCompatibilityScore,
    extracurricularScore,
    lunchHabitsScore,
    weeklyOverlapHours = null,
    scheduleDetails = null,
    gradeCompatible = true,
    createdAt = new Date(),
  }) {
    if (!matchId) throw new Error('TandemMatch requires a matchId');
    if (!userAId) throw new Error('TandemMatch requires a userAId');
    if (!userBId) throw new Error('TandemMatch requires a userBId');
    if (userAId === userBId) throw new Error('Cannot match a user with themselves');

    this.matchId = matchId;
    this.userAId = userAId;
    this.userBId = userBId;
    this.overallScore = Math.round(overallScore);
    this.scheduleOverlapScore = Math.round(scheduleOverlapScore);
    this.gradeLevelScore = Math.round(gradeLevelScore);
    this.arrivalCompatibilityScore = Math.round(arrivalCompatibilityScore);
    this.extracurricularScore = Math.round(extracurricularScore);
    this.lunchHabitsScore = Math.round(lunchHabitsScore);
    this.weeklyOverlapHours = weeklyOverlapHours;
    this.scheduleDetails = scheduleDetails;
    this.gradeCompatible = gradeCompatible;
    this.createdAt = createdAt;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /**
   * Does this match meet the minimum score threshold?
   * @param  {number} [minScore=30] - Minimum acceptable score
   * @return {boolean}
   */
  meetsMinimumScore(minScore = 30) {
    return this.overallScore >= minScore;
  }

  /**
   * Are the two users grade-compatible for tandem pairing?
   * @return {boolean}
   */
  isGradeCompatible() {
    return this.gradeCompatible;
  }

  /**
   * Is a specific user part of this match pair?
   * @param  {string} userId
   * @return {boolean}
   */
  involvesUser(userId) {
    return this.userAId === userId || this.userBId === userId;
  }

  /**
   * Get the other user in the match pair.
   * @param  {string} userId - The "current" user
   * @return {string} The other user's ID
   */
  getOtherUserId(userId) {
    if (this.userAId === userId) return this.userBId;
    if (this.userBId === userId) return this.userAId;
    throw new Error(`User ${userId} is not part of this match`);
  }

  /**
   * Get the dominant factor (category with highest score relative to max).
   * Useful for UI: "Matched primarily by schedule compatibility" etc.
   * @return {string}
   */
  getDominantFactor() {
    const factors = [
      { name: 'scheduleOverlap', score: this.scheduleOverlapScore, max: 40 },
      { name: 'gradeLevel', score: this.gradeLevelScore, max: 20 },
      { name: 'arrivalCompatibility', score: this.arrivalCompatibilityScore, max: 20 },
      { name: 'extracurricular', score: this.extracurricularScore, max: 10 },
      { name: 'lunchHabits', score: this.lunchHabitsScore, max: 10 },
    ];
    // Compare by percentage of max, not raw score
    factors.sort((a, b) => (b.score / b.max) - (a.score / a.max));
    return factors[0].name;
  }

  /**
   * Get a human-readable summary of the match quality.
   * @return {string}
   */
  getQualityLabel() {
    if (this.overallScore >= 80) return 'Excellent';
    if (this.overallScore >= 60) return 'Good';
    if (this.overallScore >= 40) return 'Fair';
    return 'Low';
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      matchId: this.matchId,
      userAId: this.userAId,
      userBId: this.userBId,
      overallScore: this.overallScore,
      scheduleOverlapScore: this.scheduleOverlapScore,
      gradeLevelScore: this.gradeLevelScore,
      arrivalCompatibilityScore: this.arrivalCompatibilityScore,
      extracurricularScore: this.extracurricularScore,
      lunchHabitsScore: this.lunchHabitsScore,
      weeklyOverlapHours: this.weeklyOverlapHours,
      scheduleDetails: this.scheduleDetails,
      gradeCompatible: this.gradeCompatible,
      createdAt: this.createdAt,
    };
  }

  /** Reconstruct a TandemMatch from a plain object (e.g. Redis cache). */
  static fromJSON(data) {
    return new TandemMatch({
      matchId: data.match_id || data.matchId,
      userAId: data.user_a_id || data.userAId,
      userBId: data.user_b_id || data.userBId,
      overallScore: data.overall_score ?? data.overallScore ?? 0,
      scheduleOverlapScore: data.schedule_overlap_score ?? data.scheduleOverlapScore ?? 0,
      gradeLevelScore: data.grade_level_score ?? data.gradeLevelScore ?? 0,
      arrivalCompatibilityScore: data.arrival_compatibility_score ?? data.arrivalCompatibilityScore ?? 0,
      extracurricularScore: data.extracurricular_score ?? data.extracurricularScore ?? 0,
      lunchHabitsScore: data.lunch_habits_score ?? data.lunchHabitsScore ?? 0,
      weeklyOverlapHours: data.weekly_overlap_hours ?? data.weeklyOverlapHours ?? null,
      scheduleDetails: data.schedule_details || data.scheduleDetails || null,
      gradeCompatible: data.grade_compatible ?? data.gradeCompatible ?? true,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
    });
  }
}

module.exports = TandemMatch;
