/**
 * TandemPairing.js
 * Represents an active tandem parking arrangement between two users who
 * share the same tandem spot.
 *
 * Maps to the TandemPairings table in the database schema (Review.md §II):
 *   - pairing_id (UUID, primary key)
 *   - spot_id (foreign key)
 *   - user_1_id, user_2_id (foreign keys)
 *   - compatibility_score (0–100)
 *   - start_date, end_date
 *   - status (pending/active/completed/cancelled)
 *   - created_at
 *
 * Lifecycle:
 *   pending  ──→  active  ──→  completed
 *            ↘  cancelled
 *
 * Business rules (MVP.md / Design.md):
 *   - Both users must have compatible schedules (one parks in front, other in back)
 *   - Grade level pairing rules apply
 *   - Each user can only have one active tandem pairing at a time
 *   - License plate is used so security can verify the spot
 */

const { TANDEM_STATUS } = require('../utils/constants');

class TandemPairing {
  /**
   * @param {Object} data
   * @param {string}  data.pairingId           - UUID primary key
   * @param {string}  [data.spotId]            - Foreign key → ParkingSpot (tandem spot)
   * @param {string}  data.user1Id             - First user in the pair
   * @param {string}  data.user2Id             - Second user in the pair
   * @param {number}  [data.compatibilityScore] - Compatibility score (0–100)
   * @param {Date}    [data.startDate]         - When the pairing begins
   * @param {Date}    [data.endDate]           - When the pairing ends (e.g. semester end)
   * @param {string}  data.status              - Current pairing status
   * @param {Date}    [data.createdAt]
   * @param {Date}    [data.updatedAt]
   */
  constructor({
    pairingId,
    spotId = null,
    user1Id,
    user2Id,
    compatibilityScore = 0,
    startDate = null,
    endDate = null,
    status = TANDEM_STATUS.PENDING,
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    if (!pairingId) throw new Error('TandemPairing requires a pairingId');
    if (!user1Id) throw new Error('TandemPairing requires a user1Id');
    if (!user2Id) throw new Error('TandemPairing requires a user2Id');
    if (user1Id === user2Id) throw new Error('Cannot pair a user with themselves');
    if (!Object.values(TANDEM_STATUS).includes(status)) {
      throw new Error(`Invalid tandem status: ${status}`);
    }

    this.pairingId = pairingId;
    this.spotId = spotId;
    this.user1Id = user1Id;
    this.user2Id = user2Id;
    this.compatibilityScore = compatibilityScore;
    this.startDate = startDate ? new Date(startDate) : new Date();
    this.endDate = endDate ? new Date(endDate) : null;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // ── Status Checks ───────────────────────────────────────────────────────

  isPending()   { return this.status === TANDEM_STATUS.PENDING; }
  isActive()    { return this.status === TANDEM_STATUS.ACTIVE; }
  isCompleted() { return this.status === TANDEM_STATUS.COMPLETED; }
  isCancelled() { return this.status === TANDEM_STATUS.CANCELLED; }

  /** Is the pairing still open (pending or active)? */
  isOpen() { return this.isPending() || this.isActive(); }

  // ── Member Queries ────────────────────────────────────────────────────────

  /** Get both user IDs. */
  getUserIds() {
    return [this.user1Id, this.user2Id];
  }

  /** Is a specific user part of this pairing? */
  isMember(userId) {
    return this.user1Id === userId || this.user2Id === userId;
  }

  /**
   * Get the other user in the pairing.
   * @param  {string} userId - The "current" user
   * @return {string} The partner's user ID
   */
  getPartnerId(userId) {
    if (this.user1Id === userId) return this.user2Id;
    if (this.user2Id === userId) return this.user1Id;
    throw new Error(`User ${userId} is not part of this pairing`);
  }

  /** Does this pairing have an assigned spot? */
  hasSpot() {
    return this.spotId !== null;
  }

  // ── Status Transitions ──────────────────────────────────────────────────

  /**
   * Activate the pairing (both partners have agreed).
   * @param {string} [spotId] - Optionally assign a spot at activation
   */
  activate(spotId = null) {
    if (!this.isPending()) {
      throw new Error(`Cannot activate pairing in '${this.status}' status`);
    }
    this.status = TANDEM_STATUS.ACTIVE;
    if (spotId) this.spotId = spotId;
    this.updatedAt = new Date();
  }

  /** Mark the pairing as completed (e.g. semester ended). */
  complete() {
    if (!this.isActive()) {
      throw new Error(`Cannot complete pairing in '${this.status}' status`);
    }
    this.status = TANDEM_STATUS.COMPLETED;
    this.endDate = new Date();
    this.updatedAt = new Date();
  }

  /** Cancel the pairing. Either partner can do this. */
  cancel() {
    if (!this.isOpen()) {
      throw new Error(`Cannot cancel pairing in '${this.status}' status`);
    }
    this.status = TANDEM_STATUS.CANCELLED;
    this.endDate = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Assign a tandem spot to this pairing.
   * @param {string} spotId - The tandem spot ID
   */
  assignSpot(spotId) {
    if (!spotId) throw new Error('spotId is required');
    this.spotId = spotId;
    this.updatedAt = new Date();
  }

  /**
   * Update the compatibility score (after recalculation).
   * @param {number} score - New compatibility score (0–100)
   */
  updateCompatibilityScore(score) {
    if (typeof score !== 'number' || score < 0 || score > 100) {
      throw new Error('Compatibility score must be a number between 0 and 100');
    }
    this.compatibilityScore = Math.round(score);
    this.updatedAt = new Date();
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      pairingId: this.pairingId,
      spotId: this.spotId,
      user1Id: this.user1Id,
      user2Id: this.user2Id,
      compatibilityScore: this.compatibilityScore,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /** Reconstruct a TandemPairing from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new TandemPairing({
      pairingId: data.pairing_id || data.pairingId,
      spotId: data.spot_id || data.spotId || null,
      user1Id: data.user_1_id || data.user1Id,
      user2Id: data.user_2_id || data.user2Id,
      compatibilityScore: data.compatibility_score ?? data.compatibilityScore ?? 0,
      startDate: data.start_date || data.startDate || null,
      endDate: data.end_date || data.endDate || null,
      status: data.status || TANDEM_STATUS.PENDING,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(data.updatedAt),
    });
  }
}

module.exports = TandemPairing;
