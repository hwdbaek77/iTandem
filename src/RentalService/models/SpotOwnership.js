/**
 * SpotOwnership.js
 * Tracks which user owns (or currently rents) a parking spot and for what period.
 *
 * Maps to the SpotOwnership table in the database schema (Review.md §II).
 * A spot can be permanently assigned by the school or temporarily rented
 * through the platform.  Only active ownerships participate in rental logic.
 */

const { OWNERSHIP_TYPES } = require('../utils/constants');

class SpotOwnership {
  /**
   * @param {Object} data
   * @param {string}  data.ownershipId   - UUID primary key
   * @param {string}  data.spotId        - Foreign key → ParkingSpot
   * @param {string}  data.userId        - Foreign key → User (the owner)
   * @param {Date}    data.startDate     - When ownership begins
   * @param {Date}    data.endDate       - When ownership ends (e.g. semester end)
   * @param {string}  data.ownershipType - 'permanent' or 'rented'
   * @param {boolean} data.isActive      - Whether this ownership is currently valid
   */
  constructor({
    ownershipId,
    spotId,
    userId,
    startDate,
    endDate,
    ownershipType = OWNERSHIP_TYPES.PERMANENT,
    isActive = true,
  }) {
    if (!ownershipId) throw new Error('SpotOwnership requires an ownershipId');
    if (!spotId) throw new Error('SpotOwnership requires a spotId');
    if (!userId) throw new Error('SpotOwnership requires a userId');
    if (!Object.values(OWNERSHIP_TYPES).includes(ownershipType)) {
      throw new Error(`Invalid ownership type: ${ownershipType}`);
    }

    this.ownershipId = ownershipId;
    this.spotId = spotId;
    this.userId = userId;
    this.startDate = startDate ? new Date(startDate) : new Date();
    this.endDate = endDate ? new Date(endDate) : null;
    this.ownershipType = ownershipType;
    this.isActive = isActive;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Is this ownership valid on the given date? */
  isValidOn(date) {
    if (!this.isActive) return false;
    const d = new Date(date);
    if (d < this.startDate) return false;
    if (this.endDate && d > this.endDate) return false;
    return true;
  }

  /** Is this a permanent (school-assigned) ownership? */
  isPermanent() {
    return this.ownershipType === OWNERSHIP_TYPES.PERMANENT;
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  /** Deactivate this ownership (e.g. semester ended, or spot transferred). */
  deactivate() {
    this.isActive = false;
    this.endDate = this.endDate || new Date();
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      ownershipId: this.ownershipId,
      spotId: this.spotId,
      userId: this.userId,
      startDate: this.startDate,
      endDate: this.endDate,
      ownershipType: this.ownershipType,
      isActive: this.isActive,
    };
  }

  static fromJSON(data) {
    return new SpotOwnership({
      ownershipId: data.ownership_id || data.ownershipId,
      spotId: data.spot_id || data.spotId,
      userId: data.user_id || data.userId,
      startDate: data.start_date || data.startDate,
      endDate: data.end_date || data.endDate,
      ownershipType: data.ownership_type || data.ownershipType,
      isActive: data.is_active ?? data.isActive ?? true,
    });
  }
}

module.exports = SpotOwnership;
