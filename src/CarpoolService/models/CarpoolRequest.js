/**
 * CarpoolRequest.js
 * Represents a request from a user to join an existing carpool group.
 *
 * Supports the API endpoints from Review.md §V:
 *   - POST /api/carpool/:carpoolId/join   → creates a CarpoolRequest
 *   - DELETE /api/carpool/:carpoolId/leave → withdraws/removes from group
 *
 * Lifecycle:
 *   pending  ──→  accepted   (driver approves)
 *            ↘  rejected    (driver denies)
 *            ↘  withdrawn   (requester cancels before decision)
 *
 * When a request is accepted, the CarpoolService adds the requester
 * to the CarpoolGroup's passengerUserIds and updates the group's
 * compatibility score.
 */

const { CARPOOL_REQUEST_STATUS } = require('../utils/constants');

class CarpoolRequest {
  /**
   * @param {Object} data
   * @param {string}  data.requestId       - UUID primary key
   * @param {string}  data.carpoolId       - Foreign key → CarpoolGroup
   * @param {string}  data.requesterUserId - Foreign key → User (person requesting to join)
   * @param {string}  data.status          - Current request status
   * @param {string}  [data.message]       - Optional note from the requester
   * @param {number}  [data.compatibilityScore] - Score with the group (computed at request time)
   * @param {Date}    [data.createdAt]
   * @param {Date}    [data.respondedAt]   - When the driver responded
   */
  constructor({
    requestId,
    carpoolId,
    requesterUserId,
    status = CARPOOL_REQUEST_STATUS.PENDING,
    message = '',
    compatibilityScore = null,
    createdAt = new Date(),
    respondedAt = null,
  }) {
    if (!requestId) throw new Error('CarpoolRequest requires a requestId');
    if (!carpoolId) throw new Error('CarpoolRequest requires a carpoolId');
    if (!requesterUserId) throw new Error('CarpoolRequest requires a requesterUserId');
    if (!Object.values(CARPOOL_REQUEST_STATUS).includes(status)) {
      throw new Error(`Invalid request status: ${status}`);
    }

    this.requestId = requestId;
    this.carpoolId = carpoolId;
    this.requesterUserId = requesterUserId;
    this.status = status;
    this.message = message;
    this.compatibilityScore = compatibilityScore;
    this.createdAt = createdAt;
    this.respondedAt = respondedAt;
  }

  // ── Status Checks ───────────────────────────────────────────────────────

  isPending()   { return this.status === CARPOOL_REQUEST_STATUS.PENDING; }
  isAccepted()  { return this.status === CARPOOL_REQUEST_STATUS.ACCEPTED; }
  isRejected()  { return this.status === CARPOOL_REQUEST_STATUS.REJECTED; }
  isWithdrawn() { return this.status === CARPOOL_REQUEST_STATUS.WITHDRAWN; }

  /** Has the request been finalized (no longer pending)? */
  isFinalized() { return !this.isPending(); }

  // ── Status Transitions ────────────────────────────────────────────────────

  /**
   * Driver accepts the join request.
   * After this, the CarpoolService should add the user to the group.
   */
  accept() {
    if (!this.isPending()) {
      throw new Error(`Cannot accept request in '${this.status}' status`);
    }
    this.status = CARPOOL_REQUEST_STATUS.ACCEPTED;
    this.respondedAt = new Date();
  }

  /** Driver rejects the join request. */
  reject() {
    if (!this.isPending()) {
      throw new Error(`Cannot reject request in '${this.status}' status`);
    }
    this.status = CARPOOL_REQUEST_STATUS.REJECTED;
    this.respondedAt = new Date();
  }

  /** Requester withdraws before the driver responds. */
  withdraw() {
    if (!this.isPending()) {
      throw new Error(`Cannot withdraw request in '${this.status}' status`);
    }
    this.status = CARPOOL_REQUEST_STATUS.WITHDRAWN;
    this.respondedAt = new Date();
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      requestId: this.requestId,
      carpoolId: this.carpoolId,
      requesterUserId: this.requesterUserId,
      status: this.status,
      message: this.message,
      compatibilityScore: this.compatibilityScore,
      createdAt: this.createdAt,
      respondedAt: this.respondedAt,
    };
  }

  /** Reconstruct a CarpoolRequest from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new CarpoolRequest({
      requestId: data.request_id || data.requestId,
      carpoolId: data.carpool_id || data.carpoolId,
      requesterUserId: data.requester_user_id || data.requesterUserId,
      status: data.status || CARPOOL_REQUEST_STATUS.PENDING,
      message: data.message || '',
      compatibilityScore: data.compatibility_score ?? data.compatibilityScore ?? null,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
      respondedAt: data.responded_at
        ? new Date(data.responded_at)
        : data.respondedAt
          ? new Date(data.respondedAt)
          : null,
    });
  }
}

module.exports = CarpoolRequest;
