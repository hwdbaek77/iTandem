/**
 * SpotRental.js
 * Core rental transaction between a spot owner and a renter.
 *
 * Maps to the SpotRentals table in the database schema (Review.md §II).
 *
 * Lifecycle:
 *   pending  ──→  confirmed  ──→  completed
 *            ↘    cancelled
 *            ↘    disputed
 *
 * Business rules (MVP.md / Design.md):
 *   - Cancellation ≥24 hrs before rental_date → full refund
 *   - Cancellation <24 hrs before rental_date → renter receives a fine
 *   - If the rented spot is blocked, the system triggers reassignment
 */

const { RENTAL_STATUS, CANCELLATION_POLICY } = require('../utils/constants');

class SpotRental {
  /**
   * @param {Object} data
   * @param {string}  data.rentalId            - UUID primary key
   * @param {string}  data.spotId              - Foreign key → ParkingSpot
   * @param {string}  data.ownerUserId         - Foreign key → User (spot owner)
   * @param {string}  data.renterUserId        - Foreign key → User (renter)
   * @param {Date}    data.rentalDate           - The date the spot is rented for
   * @param {number}  data.priceCents           - Price in cents (avoids floating-point)
   * @param {string}  data.status               - Current rental status
   * @param {string}  [data.paymentIntentId]    - Stripe payment intent ID
   * @param {Date}    [data.createdAt]
   * @param {Date}    [data.updatedAt]
   * @param {Date}    [data.cancellationTimestamp]
   * @param {string}  [data.reassignedFromRentalId] - If this rental was created via reassignment
   */
  constructor({
    rentalId,
    spotId,
    ownerUserId,
    renterUserId,
    rentalDate,
    priceCents,
    status = RENTAL_STATUS.PENDING,
    paymentIntentId = null,
    createdAt = new Date(),
    updatedAt = new Date(),
    cancellationTimestamp = null,
    reassignedFromRentalId = null,
  }) {
    if (!rentalId) throw new Error('SpotRental requires a rentalId');
    if (!spotId) throw new Error('SpotRental requires a spotId');
    if (!ownerUserId) throw new Error('SpotRental requires an ownerUserId');
    if (!renterUserId) throw new Error('SpotRental requires a renterUserId');
    if (!rentalDate) throw new Error('SpotRental requires a rentalDate');
    if (typeof priceCents !== 'number' || priceCents < 0) {
      throw new Error('priceCents must be a non-negative number');
    }

    this.rentalId = rentalId;
    this.spotId = spotId;
    this.ownerUserId = ownerUserId;
    this.renterUserId = renterUserId;
    this.rentalDate = new Date(rentalDate);
    this.priceCents = priceCents;
    this.status = status;
    this.paymentIntentId = paymentIntentId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.cancellationTimestamp = cancellationTimestamp;
    this.reassignedFromRentalId = reassignedFromRentalId;
  }

  // ── Status Checks ───────────────────────────────────────────────────────

  isPending()   { return this.status === RENTAL_STATUS.PENDING; }
  isConfirmed() { return this.status === RENTAL_STATUS.CONFIRMED; }
  isCompleted() { return this.status === RENTAL_STATUS.COMPLETED; }
  isCancelled() { return this.status === RENTAL_STATUS.CANCELLED; }
  isDisputed()  { return this.status === RENTAL_STATUS.DISPUTED; }
  isActive()    { return this.isPending() || this.isConfirmed(); }

  /** Was this rental created through automatic reassignment? */
  isReassignment() { return this.reassignedFromRentalId !== null; }

  // ── Cancellation Logic ──────────────────────────────────────────────────

  /**
   * Determine the cancellation outcome at the given point in time.
   * @param  {Date}   [now=new Date()]
   * @return {{ eligible: boolean, fullRefund: boolean, reason: string }}
   */
  getCancellationOutcome(now = new Date()) {
    if (!this.isActive()) {
      return { eligible: false, fullRefund: false, reason: 'Rental is no longer active' };
    }

    const msUntilRental = this.rentalDate.getTime() - now.getTime();
    const hoursUntilRental = msUntilRental / (1000 * 60 * 60);

    if (hoursUntilRental >= CANCELLATION_POLICY.FULL_REFUND_HOURS_BEFORE) {
      return { eligible: true, fullRefund: true, reason: 'Cancelled with ≥24 hours notice' };
    }

    return { eligible: true, fullRefund: false, reason: 'Cancelled with <24 hours notice — renter fined' };
  }

  // ── Status Transitions ──────────────────────────────────────────────────

  confirm(paymentIntentId) {
    if (!this.isPending()) {
      throw new Error(`Cannot confirm rental in '${this.status}' status`);
    }
    this.status = RENTAL_STATUS.CONFIRMED;
    this.paymentIntentId = paymentIntentId || this.paymentIntentId;
    this.updatedAt = new Date();
  }

  complete() {
    if (!this.isConfirmed()) {
      throw new Error(`Cannot complete rental in '${this.status}' status`);
    }
    this.status = RENTAL_STATUS.COMPLETED;
    this.updatedAt = new Date();
  }

  cancel() {
    if (!this.isActive()) {
      throw new Error(`Cannot cancel rental in '${this.status}' status`);
    }
    this.status = RENTAL_STATUS.CANCELLED;
    this.cancellationTimestamp = new Date();
    this.updatedAt = new Date();
  }

  dispute() {
    if (!this.isConfirmed()) {
      throw new Error(`Cannot dispute rental in '${this.status}' status`);
    }
    this.status = RENTAL_STATUS.DISPUTED;
    this.updatedAt = new Date();
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      rentalId: this.rentalId,
      spotId: this.spotId,
      ownerUserId: this.ownerUserId,
      renterUserId: this.renterUserId,
      rentalDate: this.rentalDate,
      priceCents: this.priceCents,
      status: this.status,
      paymentIntentId: this.paymentIntentId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      cancellationTimestamp: this.cancellationTimestamp,
      reassignedFromRentalId: this.reassignedFromRentalId,
    };
  }

  static fromJSON(data) {
    return new SpotRental({
      rentalId: data.rental_id || data.rentalId,
      spotId: data.spot_id || data.spotId,
      ownerUserId: data.owner_user_id || data.ownerUserId,
      renterUserId: data.renter_user_id || data.renterUserId,
      rentalDate: data.rental_date || data.rentalDate,
      priceCents: data.price_cents ?? data.priceCents,
      status: data.status || RENTAL_STATUS.PENDING,
      paymentIntentId: data.payment_intent_id || data.paymentIntentId || null,
      createdAt: data.created_at || data.createdAt,
      updatedAt: data.updated_at || data.updatedAt,
      cancellationTimestamp: data.cancellation_timestamp || data.cancellationTimestamp || null,
      reassignedFromRentalId: data.reassigned_from_rental_id || data.reassignedFromRentalId || null,
    });
  }
}

module.exports = SpotRental;
