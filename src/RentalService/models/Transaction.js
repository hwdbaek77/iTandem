/**
 * Transaction.js
 * Records a financial transaction tied to a rental.
 *
 * Maps to the Transactions table in the database schema (Review.md §II).
 * Each SpotRental may have one or more Transactions (initial payment,
 * refund on cancellation, reassignment transfer, etc.).
 */

const { TRANSACTION_STATUS } = require('../utils/constants');

class Transaction {
  /**
   * @param {Object} data
   * @param {string}  data.transactionId   - UUID primary key
   * @param {string}  data.rentalId        - Foreign key → SpotRental
   * @param {number}  data.amountCents     - Amount in cents (positive = charge, negative = refund)
   * @param {string}  [data.stripeChargeId]- Stripe charge/refund ID
   * @param {string}  data.status          - pending | completed | refunded | failed
   * @param {string}  [data.description]   - Human-readable note
   * @param {Date}    [data.createdAt]
   */
  constructor({
    transactionId,
    rentalId,
    amountCents,
    stripeChargeId = null,
    status = TRANSACTION_STATUS.PENDING,
    description = '',
    createdAt = new Date(),
  }) {
    if (!transactionId) throw new Error('Transaction requires a transactionId');
    if (!rentalId) throw new Error('Transaction requires a rentalId');
    if (typeof amountCents !== 'number') {
      throw new Error('amountCents must be a number');
    }
    if (!Object.values(TRANSACTION_STATUS).includes(status)) {
      throw new Error(`Invalid transaction status: ${status}`);
    }

    this.transactionId = transactionId;
    this.rentalId = rentalId;
    this.amountCents = amountCents;
    this.stripeChargeId = stripeChargeId;
    this.status = status;
    this.description = description;
    this.createdAt = createdAt;
  }

  // ── Status Transitions ──────────────────────────────────────────────────

  markCompleted(stripeChargeId) {
    this.status = TRANSACTION_STATUS.COMPLETED;
    if (stripeChargeId) this.stripeChargeId = stripeChargeId;
  }

  markRefunded() {
    this.status = TRANSACTION_STATUS.REFUNDED;
  }

  markFailed() {
    this.status = TRANSACTION_STATUS.FAILED;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Returns the dollar amount (for display). */
  toDollars() {
    return (this.amountCents / 100).toFixed(2);
  }

  isCharge() { return this.amountCents > 0; }
  isRefund() { return this.amountCents < 0; }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      transactionId: this.transactionId,
      rentalId: this.rentalId,
      amountCents: this.amountCents,
      stripeChargeId: this.stripeChargeId,
      status: this.status,
      description: this.description,
      createdAt: this.createdAt,
    };
  }

  static fromJSON(data) {
    return new Transaction({
      transactionId: data.transaction_id || data.transactionId,
      rentalId: data.rental_id || data.rentalId,
      amountCents: data.amount_cents ?? data.amountCents,
      stripeChargeId: data.stripe_charge_id || data.stripeChargeId || null,
      status: data.status || TRANSACTION_STATUS.PENDING,
      description: data.description || '',
      createdAt: data.created_at || data.createdAt,
    });
  }
}

module.exports = Transaction;
