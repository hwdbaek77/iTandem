/**
 * TandemRequest.js
 * Represents a request from one user to pair with another for tandem parking.
 *
 * Supports the API endpoints from Review.md §V:
 *   - POST /api/tandem/request         → creates a TandemRequest
 *   - PUT  /api/tandem/:pairingId/accept → accepts the request
 *   - DELETE /api/tandem/:pairingId     → rejects/withdraws/ends pairing
 *
 * Lifecycle:
 *   pending  ──→  accepted   (partner approves → TandemPairing created)
 *            ↘  rejected    (partner denies)
 *            ↘  withdrawn   (requester cancels before decision)
 *
 * When a request is accepted, the TandemService creates a TandemPairing
 * and links both users to the shared tandem spot.
 */

const { TANDEM_REQUEST_STATUS } = require('../utils/constants');

class TandemRequest {
  /**
   * @param {Object} data
   * @param {string}  data.requestId           - UUID primary key
   * @param {string}  data.requesterUserId     - User who initiated the request
   * @param {string}  data.targetUserId        - User being asked to pair
   * @param {string}  data.status              - Current request status
   * @param {string}  [data.message]           - Optional note from the requester
   * @param {number}  [data.compatibilityScore] - Score between the two users
   * @param {Date}    [data.createdAt]
   * @param {Date}    [data.respondedAt]       - When the target user responded
   */
  constructor({
    requestId,
    requesterUserId,
    targetUserId,
    status = TANDEM_REQUEST_STATUS.PENDING,
    message = '',
    compatibilityScore = null,
    createdAt = new Date(),
    respondedAt = null,
  }) {
    if (!requestId) throw new Error('TandemRequest requires a requestId');
    if (!requesterUserId) throw new Error('TandemRequest requires a requesterUserId');
    if (!targetUserId) throw new Error('TandemRequest requires a targetUserId');
    if (requesterUserId === targetUserId) {
      throw new Error('Cannot send a tandem request to yourself');
    }
    if (!Object.values(TANDEM_REQUEST_STATUS).includes(status)) {
      throw new Error(`Invalid request status: ${status}`);
    }

    this.requestId = requestId;
    this.requesterUserId = requesterUserId;
    this.targetUserId = targetUserId;
    this.status = status;
    this.message = message;
    this.compatibilityScore = compatibilityScore;
    this.createdAt = createdAt;
    this.respondedAt = respondedAt;
  }

  // ── Status Checks ───────────────────────────────────────────────────────

  isPending()   { return this.status === TANDEM_REQUEST_STATUS.PENDING; }
  isAccepted()  { return this.status === TANDEM_REQUEST_STATUS.ACCEPTED; }
  isRejected()  { return this.status === TANDEM_REQUEST_STATUS.REJECTED; }
  isWithdrawn() { return this.status === TANDEM_REQUEST_STATUS.WITHDRAWN; }

  /** Has the request been finalized (no longer pending)? */
  isFinalized() { return !this.isPending(); }

  /**
   * Is a specific user involved in this request (as requester or target)?
   * @param  {string} userId
   * @return {boolean}
   */
  involvesUser(userId) {
    return this.requesterUserId === userId || this.targetUserId === userId;
  }

  // ── Status Transitions ──────────────────────────────────────────────────

  /**
   * Target user accepts the pairing request.
   * After this, the TandemService should create a TandemPairing.
   */
  accept() {
    if (!this.isPending()) {
      throw new Error(`Cannot accept request in '${this.status}' status`);
    }
    this.status = TANDEM_REQUEST_STATUS.ACCEPTED;
    this.respondedAt = new Date();
  }

  /** Target user rejects the pairing request. */
  reject() {
    if (!this.isPending()) {
      throw new Error(`Cannot reject request in '${this.status}' status`);
    }
    this.status = TANDEM_REQUEST_STATUS.REJECTED;
    this.respondedAt = new Date();
  }

  /** Requester withdraws before the target responds. */
  withdraw() {
    if (!this.isPending()) {
      throw new Error(`Cannot withdraw request in '${this.status}' status`);
    }
    this.status = TANDEM_REQUEST_STATUS.WITHDRAWN;
    this.respondedAt = new Date();
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      requestId: this.requestId,
      requesterUserId: this.requesterUserId,
      targetUserId: this.targetUserId,
      status: this.status,
      message: this.message,
      compatibilityScore: this.compatibilityScore,
      createdAt: this.createdAt,
      respondedAt: this.respondedAt,
    };
  }

  /** Reconstruct a TandemRequest from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new TandemRequest({
      requestId: data.request_id || data.requestId,
      requesterUserId: data.requester_user_id || data.requesterUserId,
      targetUserId: data.target_user_id || data.targetUserId,
      status: data.status || TANDEM_REQUEST_STATUS.PENDING,
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

module.exports = TandemRequest;
