/**
 * CarpoolGroup.js
 * Represents a carpool arrangement between a driver and one or more passengers.
 *
 * Maps to the CarpoolGroups table in the database schema (Review.md §II):
 *   - carpool_id (UUID, primary key)
 *   - driver_user_id (foreign key)
 *   - passenger_user_ids (array of UUIDs)
 *   - home_location (lat/lng — driver's home, used as route anchor)
 *   - compatibility_score (0–100, average across all members)
 *   - status (pending/active/completed/cancelled)
 *   - created_at
 *
 * Lifecycle:
 *   pending  ──→  active  ──→  completed
 *            ↘  cancelled
 *
 * Business rules:
 *   - A driver creates the group and approves join requests
 *   - Maximum passengers defined in CARPOOL_CONFIG.MAX_PASSENGERS
 *   - Design.md: "If you're renting the spot then you shouldn't do the carpool"
 *     → validated in CarpoolService, not here
 */

const { CARPOOL_STATUS, CARPOOL_CONFIG } = require('../utils/constants');

class CarpoolGroup {
  /**
   * @param {Object}   data
   * @param {string}   data.carpoolId            - UUID primary key
   * @param {string}   data.driverUserId         - Foreign key → User (the driver)
   * @param {string[]} [data.passengerUserIds]    - Array of passenger user IDs
   * @param {string}   [data.name]               - Optional group name (e.g. "Morning Crew")
   * @param {number}   [data.compatibilityScore] - Average compatibility (0–100)
   * @param {string}   data.status               - Current group status
   * @param {Date}     [data.createdAt]
   * @param {Date}     [data.updatedAt]
   */
  constructor({
    carpoolId,
    driverUserId,
    passengerUserIds = [],
    name = '',
    compatibilityScore = 0,
    status = CARPOOL_STATUS.PENDING,
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    if (!carpoolId) throw new Error('CarpoolGroup requires a carpoolId');
    if (!driverUserId) throw new Error('CarpoolGroup requires a driverUserId');
    if (!Object.values(CARPOOL_STATUS).includes(status)) {
      throw new Error(`Invalid carpool status: ${status}`);
    }

    this.carpoolId = carpoolId;
    this.driverUserId = driverUserId;
    this.passengerUserIds = [...passengerUserIds];
    this.name = name;
    this.compatibilityScore = compatibilityScore;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // ── Status Checks ───────────────────────────────────────────────────────

  isPending()   { return this.status === CARPOOL_STATUS.PENDING; }
  isActive()    { return this.status === CARPOOL_STATUS.ACTIVE; }
  isCompleted() { return this.status === CARPOOL_STATUS.COMPLETED; }
  isCancelled() { return this.status === CARPOOL_STATUS.CANCELLED; }

  /** Is the group still accepting members or actively operating? */
  isOpen() { return this.isPending() || this.isActive(); }

  // ── Member Queries ────────────────────────────────────────────────────────

  /** Get the total number of members (driver + passengers). */
  getMemberCount() {
    return 1 + this.passengerUserIds.length; // 1 for the driver
  }

  /** Get all member IDs (driver + passengers). */
  getAllMemberIds() {
    return [this.driverUserId, ...this.passengerUserIds];
  }

  /** Is a specific user a member of this group (driver or passenger)? */
  isMember(userId) {
    return this.driverUserId === userId || this.passengerUserIds.includes(userId);
  }

  /** Is a specific user the driver of this group? */
  isDriver(userId) {
    return this.driverUserId === userId;
  }

  /** Is the group full (at maximum passenger capacity)? */
  isFull() {
    return this.passengerUserIds.length >= CARPOOL_CONFIG.MAX_PASSENGERS;
  }

  /** How many more passengers can join? */
  getRemainingCapacity() {
    return Math.max(0, CARPOOL_CONFIG.MAX_PASSENGERS - this.passengerUserIds.length);
  }

  // ── Member Management ─────────────────────────────────────────────────────

  /**
   * Add a passenger to the group.
   * @param {string} userId - The new passenger's user ID
   * @throws {Error} If group is full, user is already a member, or group is not open
   */
  addPassenger(userId) {
    if (!this.isOpen()) {
      throw new Error(`Cannot add passengers to a '${this.status}' carpool group`);
    }
    if (this.isMember(userId)) {
      throw new Error(`User ${userId} is already a member of this carpool`);
    }
    if (this.isFull()) {
      throw new Error('Carpool group is at maximum capacity');
    }

    this.passengerUserIds.push(userId);
    this.updatedAt = new Date();
  }

  /**
   * Remove a passenger from the group.
   * @param  {string} userId - The passenger to remove
   * @throws {Error}  If user is not a passenger (cannot remove the driver this way)
   */
  removePassenger(userId) {
    if (this.driverUserId === userId) {
      throw new Error('Cannot remove the driver as a passenger. Disband the group instead.');
    }

    const index = this.passengerUserIds.indexOf(userId);
    if (index === -1) {
      throw new Error(`User ${userId} is not a passenger in this carpool`);
    }

    this.passengerUserIds.splice(index, 1);
    this.updatedAt = new Date();
  }

  // ── Status Transitions ────────────────────────────────────────────────────

  /** Activate the group (driver confirms, at least 1 passenger). */
  activate() {
    if (!this.isPending()) {
      throw new Error(`Cannot activate carpool in '${this.status}' status`);
    }
    if (this.passengerUserIds.length === 0) {
      throw new Error('Cannot activate a carpool with no passengers');
    }
    this.status = CARPOOL_STATUS.ACTIVE;
    this.updatedAt = new Date();
  }

  /** Mark the carpool as completed (e.g. semester ended). */
  complete() {
    if (!this.isActive()) {
      throw new Error(`Cannot complete carpool in '${this.status}' status`);
    }
    this.status = CARPOOL_STATUS.COMPLETED;
    this.updatedAt = new Date();
  }

  /** Cancel / disband the group. */
  cancel() {
    if (!this.isOpen()) {
      throw new Error(`Cannot cancel carpool in '${this.status}' status`);
    }
    this.status = CARPOOL_STATUS.CANCELLED;
    this.updatedAt = new Date();
  }

  /**
   * Update the group's compatibility score.
   * Called by CarpoolService after recalculating with the engine.
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
      carpoolId: this.carpoolId,
      driverUserId: this.driverUserId,
      passengerUserIds: [...this.passengerUserIds],
      name: this.name,
      compatibilityScore: this.compatibilityScore,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /** Reconstruct a CarpoolGroup from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new CarpoolGroup({
      carpoolId: data.carpool_id || data.carpoolId,
      driverUserId: data.driver_user_id || data.driverUserId,
      passengerUserIds: data.passenger_user_ids || data.passengerUserIds || [],
      name: data.name || '',
      compatibilityScore: data.compatibility_score ?? data.compatibilityScore ?? 0,
      status: data.status || CARPOOL_STATUS.PENDING,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(data.updatedAt),
    });
  }
}

module.exports = CarpoolGroup;
