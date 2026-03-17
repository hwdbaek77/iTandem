/**
 * CarpoolMatch.js
 * Represents the result of running the CarpoolCompatibilityEngine between
 * two users.  Stores the overall score and the per-category breakdown.
 *
 * Review.md §IV (Matching Service) specifies that match results should be
 * cached in Redis with a TTL.  This model provides `toJSON()` / `fromJSON()`
 * serialization to support that caching layer.
 *
 * The CarpoolCompatibilityEngine produces CarpoolMatch instances, and the
 * CarpoolService surfaces them via `GET /api/carpool/matches`.
 *
 * Scoring breakdown (Review.md §III):
 *   - Geographic Proximity : 0–35 points
 *   - Schedule Alignment   : 0–35 points
 *   - Grade Level Priority : 0–15 points
 *   - Personal Compatibility: 0–15 points
 *   ─────────────────────────────────────
 *   Total                  : 0–100 points
 */

class CarpoolMatch {
  /**
   * @param {Object} data
   * @param {string}  data.matchId            - UUID primary key
   * @param {string}  data.userAId            - First user in the pair
   * @param {string}  data.userBId            - Second user in the pair
   * @param {number}  data.overallScore       - Combined score (0–100)
   * @param {number}  data.proximityScore     - Geographic proximity score (0–35)
   * @param {number}  data.scheduleScore      - Schedule alignment score (0–35)
   * @param {number}  data.gradeLevelScore    - Grade level priority score (0–15)
   * @param {number}  data.personalScore      - Personal compatibility score (0–15)
   * @param {number}  [data.distanceMiles]    - Haversine distance between homes
   * @param {Object}  [data.scheduleDetails]  - Per-day schedule comparison details
   * @param {Date}    [data.createdAt]        - When this match was computed
   */
  constructor({
    matchId,
    userAId,
    userBId,
    overallScore,
    proximityScore,
    scheduleScore,
    gradeLevelScore,
    personalScore,
    distanceMiles = null,
    scheduleDetails = null,
    createdAt = new Date(),
  }) {
    if (!matchId) throw new Error('CarpoolMatch requires a matchId');
    if (!userAId) throw new Error('CarpoolMatch requires a userAId');
    if (!userBId) throw new Error('CarpoolMatch requires a userBId');
    if (userAId === userBId) throw new Error('Cannot match a user with themselves');

    this.matchId = matchId;
    this.userAId = userAId;
    this.userBId = userBId;
    this.overallScore = Math.round(overallScore);
    this.proximityScore = Math.round(proximityScore);
    this.scheduleScore = Math.round(scheduleScore);
    this.gradeLevelScore = Math.round(gradeLevelScore);
    this.personalScore = Math.round(personalScore);
    this.distanceMiles = distanceMiles;
    this.scheduleDetails = scheduleDetails;
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
   * Useful for UI: "Matched primarily by location" etc.
   * @return {string} 'proximity' | 'schedule' | 'gradeLevel' | 'personal'
   */
  getDominantFactor() {
    const factors = [
      { name: 'proximity', score: this.proximityScore, max: 35 },
      { name: 'schedule', score: this.scheduleScore, max: 35 },
      { name: 'gradeLevel', score: this.gradeLevelScore, max: 15 },
      { name: 'personal', score: this.personalScore, max: 15 },
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
      proximityScore: this.proximityScore,
      scheduleScore: this.scheduleScore,
      gradeLevelScore: this.gradeLevelScore,
      personalScore: this.personalScore,
      distanceMiles: this.distanceMiles,
      scheduleDetails: this.scheduleDetails,
      createdAt: this.createdAt,
    };
  }

  /** Reconstruct a CarpoolMatch from a plain object (e.g. Redis cache). */
  static fromJSON(data) {
    return new CarpoolMatch({
      matchId: data.match_id || data.matchId,
      userAId: data.user_a_id || data.userAId,
      userBId: data.user_b_id || data.userBId,
      overallScore: data.overall_score ?? data.overallScore ?? 0,
      proximityScore: data.proximity_score ?? data.proximityScore ?? 0,
      scheduleScore: data.schedule_score ?? data.scheduleScore ?? 0,
      gradeLevelScore: data.grade_level_score ?? data.gradeLevelScore ?? 0,
      personalScore: data.personal_score ?? data.personalScore ?? 0,
      distanceMiles: data.distance_miles ?? data.distanceMiles ?? null,
      scheduleDetails: data.schedule_details || data.scheduleDetails || null,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
    });
  }
}

module.exports = CarpoolMatch;
