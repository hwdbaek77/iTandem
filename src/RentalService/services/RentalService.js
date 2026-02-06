/**
 * RentalService.js
 * Main orchestrator for all parking-spot rental operations.
 *
 * This service coordinates the model classes (ParkingSpot, SpotOwnership,
 * SpotRental, Transaction, Penalty, Report) and the PricingEngine to
 * implement the full rental lifecycle described in MVP.md, Design.md,
 * and Review.md.
 *
 * ── Capabilities ──────────────────────────────────────────────────────────
 *  1. List a spot for rent (owner makes their spot available)
 *  2. Query available spots for a given date
 *  3. Request & confirm a rental
 *  4. Cancel a rental (with refund / fine logic)
 *  5. Complete a rental at end of day
 *  6. Handle blocked-spot reports → automatic reassignment
 *  7. Apply penalties and track license-plate bans
 *  8. File and manage dispute reports
 *
 * ── Integration Points (other team members' services) ─────────────────────
 *  - User / Auth (Max)       → userId validation, account status checks
 *  - API Service (Max)       → REST endpoints call into this service
 *  - Schedule System (Nathan)→ availability windows for tandem spots
 *  - Location Service (Lauren)→ distance calculations (we use distanceToCampus)
 *  - App UI (Hannah)         → renders available spots, confirmation flows
 *
 * ── Data Store Abstraction ────────────────────────────────────────────────
 * This service uses in-memory Maps as its data store so it can run
 * standalone for development and testing.  In production these would be
 * swapped for database queries (PostgreSQL via the API service).
 */

const ParkingSpot = require('../models/ParkingSpot');
const SpotOwnership = require('../models/SpotOwnership');
const SpotRental = require('../models/SpotRental');
const Transaction = require('../models/Transaction');
const Penalty = require('../models/Penalty');
const Report = require('../models/Report');
const PricingEngine = require('./PricingEngine');
const {
  RENTAL_STATUS,
  TRANSACTION_STATUS,
  OFFENSE_TYPES,
  REPORT_TYPES,
  REPORT_STATUS,
  PRICING,
  CANCELLATION_POLICY,
} = require('../utils/constants');

// ── Tiny UUID helper (swap for `uuid` package in production) ──────────────
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

class RentalService {
  /**
   * @param {Object}        [options]
   * @param {PricingEngine} [options.pricingEngine] - Custom pricing engine
   */
  constructor(options = {}) {
    this.pricingEngine = options.pricingEngine || new PricingEngine();

    // ── In-memory data stores (replace with DB in production) ───────────
    /** @type {Map<string, ParkingSpot>} spotId → ParkingSpot */
    this.spots = new Map();

    /** @type {Map<string, SpotOwnership>} ownershipId → SpotOwnership */
    this.ownerships = new Map();

    /** @type {Map<string, SpotRental>} rentalId → SpotRental */
    this.rentals = new Map();

    /** @type {Map<string, Transaction>} transactionId → Transaction */
    this.transactions = new Map();

    /** @type {Map<string, Penalty>} penaltyId → Penalty */
    this.penalties = new Map();

    /** @type {Map<string, Report>} reportId → Report */
    this.reports = new Map();

    /**
     * Tracks dates a spot has been listed as available for rent.
     * @type {Map<string, Set<string>>}  spotId → Set of ISO date strings
     */
    this.availableDates = new Map();

    /**
     * License plates currently banned (unpaid spot-blocking fines).
     * @type {Set<string>}
     */
    this.bannedPlates = new Set();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  1.  SPOT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Register a parking spot in the system.
   * Typically done once during database seeding.
   * @param  {Object} spotData - Constructor args for ParkingSpot
   * @return {ParkingSpot}
   */
  addSpot(spotData) {
    const spot = new ParkingSpot({ spotId: generateId(), ...spotData });
    this.spots.set(spot.spotId, spot);
    return spot;
  }

  /**
   * Assign ownership of a spot to a user.
   * @param  {string} spotId
   * @param  {string} userId
   * @param  {Object} [opts]
   * @return {SpotOwnership}
   */
  assignOwnership(spotId, userId, opts = {}) {
    if (!this.spots.has(spotId)) throw new Error(`Spot ${spotId} not found`);
    const ownership = new SpotOwnership({
      ownershipId: generateId(),
      spotId,
      userId,
      ...opts,
    });
    this.ownerships.set(ownership.ownershipId, ownership);
    return ownership;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  2.  LISTING & AVAILABILITY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * An owner lists their spot as available for rent on a specific date.
   * @param  {string} spotId
   * @param  {string} userId  - Must be the current owner
   * @param  {string} dateStr - ISO date string (YYYY-MM-DD)
   * @return {{ spotId: string, date: string }}
   */
  listSpotForRent(spotId, userId, dateStr) {
    const ownership = this._getActiveOwnership(spotId);
    if (!ownership) {
      throw new Error(`No active ownership found for spot ${spotId}`);
    }
    if (ownership.userId !== userId) {
      throw new Error('Only the spot owner can list the spot for rent');
    }

    if (!this.availableDates.has(spotId)) {
      this.availableDates.set(spotId, new Set());
    }
    this.availableDates.get(spotId).add(dateStr);

    return { spotId, date: dateStr };
  }

  /**
   * Remove a spot's availability for a given date.
   * @param {string} spotId
   * @param {string} dateStr
   */
  unlistSpot(spotId, dateStr) {
    const dates = this.availableDates.get(spotId);
    if (dates) dates.delete(dateStr);
  }

  /**
   * Get all spots available for rent on a given date, with pricing.
   * Corresponds to `GET /api/rentals/available?date=YYYY-MM-DD`.
   *
   * @param  {string}  dateStr            - ISO date string
   * @param  {Object}  [filters]
   * @param  {string}  [filters.lotName]  - Filter to a specific lot
   * @param  {string}  [filters.vehicleSize] - Filter by vehicle compatibility
   * @return {Array<{ spot: ParkingSpot, priceCents: number, priceDollars: string }>}
   */
  getAvailableSpots(dateStr, filters = {}) {
    const availableSpots = [];

    for (const [spotId, dates] of this.availableDates.entries()) {
      if (!dates.has(dateStr)) continue;

      // Skip spots that already have a confirmed/pending rental for this date
      if (this._hasActiveRentalOnDate(spotId, dateStr)) continue;

      const spot = this.spots.get(spotId);
      if (!spot) continue;

      // Apply optional filters
      if (filters.lotName && spot.lotName !== filters.lotName) continue;
      if (filters.vehicleSize && !spot.canFitVehicle(filters.vehicleSize)) continue;

      availableSpots.push(spot);
    }

    return this.pricingEngine.priceAvailableSpots(availableSpots);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  3.  RENTING A SPOT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * A renter requests to rent an available spot.
   * Creates a SpotRental in PENDING status.
   *
   * @param  {string} spotId
   * @param  {string} renterUserId
   * @param  {string} dateStr       - Rental date (YYYY-MM-DD)
   * @return {SpotRental}
   */
  requestRental(spotId, renterUserId, dateStr) {
    // Validate the spot is available
    const dates = this.availableDates.get(spotId);
    if (!dates || !dates.has(dateStr)) {
      throw new Error(`Spot ${spotId} is not available on ${dateStr}`);
    }

    // Prevent double booking
    if (this._hasActiveRentalOnDate(spotId, dateStr)) {
      throw new Error(`Spot ${spotId} is already rented on ${dateStr}`);
    }

    // Check renter doesn't have unpaid penalties
    if (this._hasUnpaidPenalties(renterUserId)) {
      throw new Error('Cannot rent a spot while you have unpaid penalties');
    }

    // Find the owner
    const ownership = this._getActiveOwnership(spotId);
    if (!ownership) throw new Error(`No owner found for spot ${spotId}`);

    // Owner cannot rent their own spot
    if (ownership.userId === renterUserId) {
      throw new Error('You cannot rent your own spot');
    }

    // Calculate price
    const spot = this.spots.get(spotId);
    const priceCents = this.pricingEngine.calculateSpotPrice(spot);

    const rental = new SpotRental({
      rentalId: generateId(),
      spotId,
      ownerUserId: ownership.userId,
      renterUserId,
      rentalDate: dateStr,
      priceCents,
    });

    this.rentals.set(rental.rentalId, rental);
    return rental;
  }

  /**
   * Confirm a pending rental (called after payment is authorized).
   * @param  {string} rentalId
   * @param  {string} paymentIntentId - Stripe payment intent
   * @return {{ rental: SpotRental, transaction: Transaction }}
   */
  confirmRental(rentalId, paymentIntentId) {
    const rental = this.rentals.get(rentalId);
    if (!rental) throw new Error(`Rental ${rentalId} not found`);

    rental.confirm(paymentIntentId);

    // Create the transaction record
    const transaction = new Transaction({
      transactionId: generateId(),
      rentalId,
      amountCents: rental.priceCents,
      stripeChargeId: paymentIntentId,
      status: TRANSACTION_STATUS.COMPLETED,
      description: `Rental payment for spot ${rental.spotId}`,
    });
    this.transactions.set(transaction.transactionId, transaction);

    // Remove the date from available listings (spot is now taken)
    this.unlistSpot(rental.spotId, rental.rentalDate.toISOString().split('T')[0]);

    return { rental, transaction };
  }

  /**
   * Mark a confirmed rental as completed (end-of-day settlement).
   * Triggers the payout to the spot owner.
   * @param  {string} rentalId
   * @return {{ rental: SpotRental, ownerPayout: Object }}
   */
  completeRental(rentalId) {
    const rental = this.rentals.get(rentalId);
    if (!rental) throw new Error(`Rental ${rentalId} not found`);

    rental.complete();

    const payout = this.pricingEngine.calculateFeeBreakdown(rental.priceCents);

    return { rental, ownerPayout: payout };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  4.  CANCELLATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Cancel an active rental.  Applies refund or fine per cancellation policy.
   *
   * Business rules (MVP.md):
   *   - Day before (≥24 hrs): full refund
   *   - Day of    (<24 hrs) : renter gets fined
   *
   * @param  {string} rentalId
   * @return {{ rental: SpotRental, refundTransaction: Transaction|null, penalty: Penalty|null }}
   */
  cancelRental(rentalId) {
    const rental = this.rentals.get(rentalId);
    if (!rental) throw new Error(`Rental ${rentalId} not found`);

    const outcome = rental.getCancellationOutcome();
    if (!outcome.eligible) {
      throw new Error(outcome.reason);
    }

    rental.cancel();

    let refundTransaction = null;
    let penalty = null;

    if (outcome.fullRefund) {
      // ── Full refund path ──────────────────────────────────────────────
      refundTransaction = new Transaction({
        transactionId: generateId(),
        rentalId,
        amountCents: -rental.priceCents,   // Negative = refund
        status: TRANSACTION_STATUS.REFUNDED,
        description: 'Full refund: cancelled with ≥24 hours notice',
      });
      this.transactions.set(refundTransaction.transactionId, refundTransaction);
    } else {
      // ── Late cancellation → fine the renter ───────────────────────────
      penalty = Penalty.createLateCancellation({
        penaltyId: generateId(),
        userId: rental.renterUserId,
        rentalId,
      });
      this.penalties.set(penalty.penaltyId, penalty);

      // Still issue a partial refund (rental price minus the fine)
      const refundAmount = rental.priceCents - PRICING.LATE_CANCEL_FINE_CENTS;
      if (refundAmount > 0) {
        refundTransaction = new Transaction({
          transactionId: generateId(),
          rentalId,
          amountCents: -refundAmount,
          status: TRANSACTION_STATUS.REFUNDED,
          description: 'Partial refund after late-cancellation fine',
        });
        this.transactions.set(refundTransaction.transactionId, refundTransaction);
      }
    }

    // Re-list the spot so someone else can rent it
    const dateStr = rental.rentalDate.toISOString().split('T')[0];
    this.listSpotForRent(
      rental.spotId,
      rental.ownerUserId,
      dateStr,
    );

    return { rental, refundTransaction, penalty };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  5.  BLOCKED SPOT → AUTOMATIC REASSIGNMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Handle a blocked-spot report:
   *   1. File the report
   *   2. Fine the blocker (if identified)
   *   3. Find a replacement spot in the same lot
   *   4. Create a new rental for the replacement spot
   *   5. Pay the new spot owner with the original rental payment
   *
   * Per Review.md: only reassign to spots of equal or lesser distance.
   * Limit to 1 reassignment per rental.
   *
   * @param  {Object} params
   * @param  {string} params.rentalId          - The blocked rental
   * @param  {string} params.reporterUserId    - The renter who found their spot blocked
   * @param  {string} [params.blockerUserId]   - The offender (if license plate identified)
   * @param  {string} [params.blockerPlate]    - The offender's license plate
   * @param  {string} params.description       - Description of the incident
   * @param  {string[]} [params.photoUrls]     - Evidence photos
   * @return {{ report: Report, penalty: Penalty|null, newRental: SpotRental|null, message: string }}
   */
  handleBlockedSpot({
    rentalId,
    reporterUserId,
    blockerUserId = null,
    blockerPlate = null,
    description = '',
    photoUrls = [],
  }) {
    const rental = this.rentals.get(rentalId);
    if (!rental) throw new Error(`Rental ${rentalId} not found`);
    if (rental.renterUserId !== reporterUserId) {
      throw new Error('Only the renter can report a blocked spot for this rental');
    }

    // Prevent cascading reassignments (max 1 per rental)
    if (rental.isReassignment()) {
      throw new Error('This rental is already a reassignment. Please contact an admin.');
    }

    // ── 1. File the report ──────────────────────────────────────────────
    const report = new Report({
      reportId: generateId(),
      reporterUserId,
      reportedUserId: blockerUserId,
      rentalId,
      reportType: REPORT_TYPES.BLOCKED_SPOT,
      description,
      photoUrls,
    });
    this.reports.set(report.reportId, report);
    report.startInvestigation();

    // ── 2. Fine the blocker (if identified) ─────────────────────────────
    let penalty = null;
    if (blockerUserId) {
      penalty = Penalty.createSpotBlocking({
        penaltyId: generateId(),
        userId: blockerUserId,
        rentalId,
      });
      this.penalties.set(penalty.penaltyId, penalty);

      // Ban their license plate until fine is paid
      if (blockerPlate) {
        this.bannedPlates.add(blockerPlate);
      }
    }

    // ── 3. Find a replacement spot ──────────────────────────────────────
    const originalSpot = this.spots.get(rental.spotId);
    const dateStr = rental.rentalDate.toISOString().split('T')[0];
    const candidates = this.getAvailableSpots(dateStr, {
      lotName: originalSpot.lotName,  // Same lot
    });

    // Filter to spots with equal or lesser distance
    const suitable = candidates.filter(
      (c) => c.spot.distanceToCampus <= originalSpot.distanceToCampus
    );

    let newRental = null;
    let message = '';

    if (suitable.length > 0) {
      // Pick the closest spot (first in sorted list after distance filter)
      const best = suitable[0];

      // ── 4. Create new rental ──────────────────────────────────────────
      const ownership = this._getActiveOwnership(best.spot.spotId);

      newRental = new SpotRental({
        rentalId: generateId(),
        spotId: best.spot.spotId,
        ownerUserId: ownership.userId,
        renterUserId: reporterUserId,
        rentalDate: dateStr,
        priceCents: rental.priceCents,  // Pay the new owner the original price
        status: RENTAL_STATUS.CONFIRMED,
        reassignedFromRentalId: rental.rentalId,
      });
      this.rentals.set(newRental.rentalId, newRental);

      // ── 5. Create transaction for the new spot owner ──────────────────
      const txn = new Transaction({
        transactionId: generateId(),
        rentalId: newRental.rentalId,
        amountCents: rental.priceCents,
        status: TRANSACTION_STATUS.COMPLETED,
        description: `Reassignment payment: renter moved from spot ${rental.spotId}`,
      });
      this.transactions.set(txn.transactionId, txn);

      // Mark original rental as disputed and remove availability
      rental.dispute();
      this.unlistSpot(best.spot.spotId, dateStr);

      report.resolve('Automatically reassigned to a nearby spot');
      message = `Reassigned to spot ${best.spot.spotNumber} in ${best.spot.lotName} lot`;
    } else {
      // ── No suitable spot → full refund + platform credit ──────────────
      const refund = new Transaction({
        transactionId: generateId(),
        rentalId,
        amountCents: -rental.priceCents,
        status: TRANSACTION_STATUS.REFUNDED,
        description: 'Full refund: blocked spot with no available reassignment',
      });
      this.transactions.set(refund.transactionId, refund);

      rental.dispute();
      report.resolve('No suitable replacement spot available. Full refund issued.');
      message = 'No replacement spot available. You have been fully refunded.';
    }

    return { report, penalty, newRental, message };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  6.  PENALTIES & LICENSE-PLATE BANS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Pay off a penalty. If it was a spot-blocking offense, unban the plate.
   * @param  {string} penaltyId
   * @param  {string} [licensePlate] - Plate to unban on payment
   * @return {Penalty}
   */
  payPenalty(penaltyId, licensePlate = null) {
    const penalty = this.penalties.get(penaltyId);
    if (!penalty) throw new Error(`Penalty ${penaltyId} not found`);
    if (penalty.isPaid) throw new Error('Penalty is already paid');

    penalty.markPaid();

    // Unban license plate if applicable
    if (licensePlate && penalty.offenseType === OFFENSE_TYPES.SPOT_BLOCKING) {
      this.bannedPlates.delete(licensePlate);
    }

    return penalty;
  }

  /**
   * Check if a license plate is currently banned.
   * Intended for integration with school security.
   * @param  {string} plate
   * @return {boolean}
   */
  isPlateBanned(plate) {
    return this.bannedPlates.has(plate);
  }

  /**
   * Get all unpaid penalties for a user.
   * @param  {string} userId
   * @return {Penalty[]}
   */
  getUnpaidPenalties(userId) {
    return [...this.penalties.values()].filter(
      (p) => p.userId === userId && !p.isPaid
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  7.  REPORTS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * File a general dispute report (not blocked-spot; for damage, harassment, etc.).
   * @param  {Object} params
   * @return {Report}
   */
  fileReport({ reporterUserId, reportedUserId, rentalId, reportType, description, photoUrls }) {
    const report = new Report({
      reportId: generateId(),
      reporterUserId,
      reportedUserId,
      rentalId,
      reportType,
      description,
      photoUrls,
    });
    this.reports.set(report.reportId, report);
    return report;
  }

  /**
   * Admin resolves a report.
   * @param {string} reportId
   * @param {string} adminNotes
   */
  resolveReport(reportId, adminNotes) {
    const report = this.reports.get(reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);
    report.resolve(adminNotes);
    return report;
  }

  /**
   * Admin dismisses a report.
   * @param {string} reportId
   * @param {string} adminNotes
   */
  dismissReport(reportId, adminNotes) {
    const report = this.reports.get(reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);
    report.dismiss(adminNotes);
    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  8.  QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a user's active rentals (as renter).
   * @param  {string} userId
   * @return {SpotRental[]}
   */
  getMyRentals(userId) {
    return [...this.rentals.values()].filter(
      (r) => r.renterUserId === userId && r.isActive()
    );
  }

  /**
   * Get a user's spots currently listed for rent.
   * @param  {string} userId
   * @return {Array<{ spot: ParkingSpot, dates: string[] }>}
   */
  getMyListings(userId) {
    const results = [];
    for (const [spotId, dates] of this.availableDates.entries()) {
      const ownership = this._getActiveOwnership(spotId);
      if (!ownership || ownership.userId !== userId) continue;
      const spot = this.spots.get(spotId);
      if (spot) {
        results.push({ spot, dates: [...dates] });
      }
    }
    return results;
  }

  /**
   * Get all rentals for a specific spot.
   * @param  {string} spotId
   * @return {SpotRental[]}
   */
  getRentalHistory(spotId) {
    return [...this.rentals.values()].filter((r) => r.spotId === spotId);
  }

  /**
   * Get all transactions for a specific rental.
   * @param  {string} rentalId
   * @return {Transaction[]}
   */
  getTransactions(rentalId) {
    return [...this.transactions.values()].filter((t) => t.rentalId === rentalId);
  }

  /**
   * Get all open reports.
   * @return {Report[]}
   */
  getOpenReports() {
    return [...this.reports.values()].filter((r) => r.isOpen());
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find the current active ownership for a spot.
   * @param  {string} spotId
   * @return {SpotOwnership|null}
   */
  _getActiveOwnership(spotId) {
    for (const ownership of this.ownerships.values()) {
      if (ownership.spotId === spotId && ownership.isActive) {
        return ownership;
      }
    }
    return null;
  }

  /**
   * Check if a spot already has an active rental on a given date.
   * @param  {string} spotId
   * @param  {string} dateStr
   * @return {boolean}
   */
  _hasActiveRentalOnDate(spotId, dateStr) {
    for (const rental of this.rentals.values()) {
      if (
        rental.spotId === spotId &&
        rental.isActive() &&
        rental.rentalDate.toISOString().split('T')[0] === dateStr
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a user has any unpaid penalties.
   * @param  {string} userId
   * @return {boolean}
   */
  _hasUnpaidPenalties(userId) {
    for (const penalty of this.penalties.values()) {
      if (penalty.userId === userId && !penalty.isPaid) {
        return true;
      }
    }
    return false;
  }
}

module.exports = RentalService;
