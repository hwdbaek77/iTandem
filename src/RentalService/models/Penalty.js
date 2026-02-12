/**
 * Penalty.js
 * Represents a fine or penalty applied to a user for a rule violation.
 *
 * Maps to the Penalties table in the database schema (Review.md §II).
 *
 * Offenses (from MVP.md / Design.md):
 *   - late_cancellation : Renter cancels on the day of the rental
 *   - spot_blocking     : A student parks in someone else's rented spot
 *   - false_report      : Filing a fraudulent dispute report
 */

const { OFFENSE_TYPES, PRICING } = require('../utils/constants');

class Penalty {
  /**
   * @param {Object} data
   * @param {string}  data.penaltyId    - UUID primary key
   * @param {string}  data.userId       - Foreign key → User receiving the penalty
   * @param {string}  data.offenseType  - One of OFFENSE_TYPES
   * @param {number}  data.amountCents  - Fine amount in cents
   * @param {Date}    data.incidentDate - When the offense occurred
   * @param {boolean} data.isPaid       - Whether the fine has been paid
   * @param {string}  [data.rentalId]   - Optional link to the related rental
   * @param {string}  [data.notes]      - Admin notes
   * @param {Date}    [data.createdAt]
   */
  constructor({
    penaltyId,
    userId,
    offenseType,
    amountCents,
    incidentDate,
    isPaid = false,
    rentalId = null,
    notes = '',
    createdAt = new Date(),
  }) {
    if (!penaltyId) throw new Error('Penalty requires a penaltyId');
    if (!userId) throw new Error('Penalty requires a userId');
    if (!Object.values(OFFENSE_TYPES).includes(offenseType)) {
      throw new Error(`Invalid offense type: ${offenseType}`);
    }
    if (typeof amountCents !== 'number' || amountCents < 0) {
      throw new Error('amountCents must be a non-negative number');
    }

    this.penaltyId = penaltyId;
    this.userId = userId;
    this.offenseType = offenseType;
    this.amountCents = amountCents;
    this.incidentDate = incidentDate ? new Date(incidentDate) : new Date();
    this.isPaid = isPaid;
    this.rentalId = rentalId;
    this.notes = notes;
    this.createdAt = createdAt;
  }

  // ── Factory Methods ─────────────────────────────────────────────────────

  /**
   * Create a late-cancellation penalty (renter cancels day-of).
   * Fine amount comes from PRICING.LATE_CANCEL_FINE_CENTS.
   */
  static createLateCancellation({ penaltyId, userId, rentalId }) {
    return new Penalty({
      penaltyId,
      userId,
      offenseType: OFFENSE_TYPES.LATE_CANCELLATION,
      amountCents: PRICING.LATE_CANCEL_FINE_CENTS,
      incidentDate: new Date(),
      rentalId,
      notes: 'Automatic fine: rental cancelled with less than 24 hours notice',
    });
  }

  /**
   * Create a spot-blocking penalty (someone parks in a rented spot).
   * Fine amount comes from PRICING.SPOT_BLOCKING_FINE_CENTS.
   * Per MVP: "ban their license plate until they pay".
   */
  static createSpotBlocking({ penaltyId, userId, rentalId }) {
    return new Penalty({
      penaltyId,
      userId,
      offenseType: OFFENSE_TYPES.SPOT_BLOCKING,
      amountCents: PRICING.SPOT_BLOCKING_FINE_CENTS,
      incidentDate: new Date(),
      rentalId,
      notes: 'Automatic fine: blocked a rented parking spot. License plate banned until paid.',
    });
  }

  // ── Mutations ───────────────────────────────────────────────────────────

  markPaid() {
    this.isPaid = true;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Should the offender's license plate be banned? */
  requiresLicenseBan() {
    return this.offenseType === OFFENSE_TYPES.SPOT_BLOCKING && !this.isPaid;
  }

  /** Returns the dollar amount (for display). */
  toDollars() {
    return (this.amountCents / 100).toFixed(2);
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      penaltyId: this.penaltyId,
      userId: this.userId,
      offenseType: this.offenseType,
      amountCents: this.amountCents,
      incidentDate: this.incidentDate,
      isPaid: this.isPaid,
      rentalId: this.rentalId,
      notes: this.notes,
      createdAt: this.createdAt,
    };
  }

  static fromJSON(data) {
    return new Penalty({
      penaltyId: data.penalty_id || data.penaltyId,
      userId: data.user_id || data.userId,
      offenseType: data.offense_type || data.offenseType,
      amountCents: data.amount_cents ?? data.amountCents,
      incidentDate: data.incident_date || data.incidentDate,
      isPaid: data.is_paid ?? data.isPaid ?? false,
      rentalId: data.rental_id || data.rentalId || null,
      notes: data.notes || '',
      createdAt: data.created_at || data.createdAt,
    });
  }
}

module.exports = Penalty;
