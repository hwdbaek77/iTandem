/**
 * GasEstimate.js
 * Represents a gas cost estimate for a carpool route.
 *
 * Per MVP.md:
 *   "Fetch average gas prices in the area from license plate using public
 *    vehicle API and then get combined city/highway to calculate approximate
 *    gas price"
 *
 * Per Review.md §VI (revised recommendation):
 *   - Let users manually input vehicle make/model
 *   - Use EPA fuel economy database for MPG estimates
 *   - Fetch local gas prices from GasBuddy API
 *   - Calculate estimated cost sharing transparently
 *
 * This model captures the full breakdown of a gas estimate so the UI
 * can display it transparently (total cost, per-person split, inputs used).
 */

class GasEstimate {
  /**
   * @param {Object} data
   * @param {string}  data.estimateId          - UUID primary key
   * @param {string}  [data.carpoolId]         - Foreign key → CarpoolGroup (if tied to a group)
   * @param {number}  data.totalDistanceMiles  - One-way distance from home to school
   * @param {boolean} data.isRoundTrip         - Whether the estimate covers both ways
   * @param {number}  data.combinedMpg         - Combined city/highway MPG of the vehicle
   * @param {number}  data.gasPricePerGallon   - Current gas price in USD per gallon
   * @param {number}  data.totalGasCostCents   - Total gas cost in cents
   * @param {number}  data.numPassengers       - Number of people splitting (driver + passengers)
   * @param {number}  data.costPerPersonCents  - Cost per person in cents
   * @param {number}  [data.weeklyTotalCents]  - Estimated weekly cost (5 school days)
   * @param {number}  [data.weeklyPerPersonCents] - Estimated weekly per-person cost
   * @param {string}  [data.vehicleDescription]- e.g. "2022 Toyota Camry"
   * @param {Date}    [data.createdAt]
   */
  constructor({
    estimateId,
    carpoolId = null,
    totalDistanceMiles,
    isRoundTrip = true,
    combinedMpg,
    gasPricePerGallon,
    totalGasCostCents,
    numPassengers,
    costPerPersonCents,
    weeklyTotalCents = null,
    weeklyPerPersonCents = null,
    vehicleDescription = '',
    createdAt = new Date(),
  }) {
    if (!estimateId) throw new Error('GasEstimate requires an estimateId');
    if (typeof totalDistanceMiles !== 'number' || totalDistanceMiles < 0) {
      throw new Error('totalDistanceMiles must be a non-negative number');
    }
    if (typeof combinedMpg !== 'number' || combinedMpg <= 0) {
      throw new Error('combinedMpg must be a positive number');
    }
    if (typeof numPassengers !== 'number' || numPassengers < 1) {
      throw new Error('numPassengers must be at least 1');
    }

    this.estimateId = estimateId;
    this.carpoolId = carpoolId;
    this.totalDistanceMiles = totalDistanceMiles;
    this.isRoundTrip = isRoundTrip;
    this.combinedMpg = combinedMpg;
    this.gasPricePerGallon = gasPricePerGallon;
    this.totalGasCostCents = totalGasCostCents;
    this.numPassengers = numPassengers;
    this.costPerPersonCents = costPerPersonCents;
    this.weeklyTotalCents = weeklyTotalCents;
    this.weeklyPerPersonCents = weeklyPerPersonCents;
    this.vehicleDescription = vehicleDescription;
    this.createdAt = createdAt;
  }

  // ── Display Helpers ─────────────────────────────────────────────────────

  /** Total gas cost as a dollar string. */
  totalGasCostDollars() {
    return `$${(this.totalGasCostCents / 100).toFixed(2)}`;
  }

  /** Per-person cost as a dollar string. */
  costPerPersonDollars() {
    return `$${(this.costPerPersonCents / 100).toFixed(2)}`;
  }

  /** Weekly total cost as a dollar string. */
  weeklyTotalDollars() {
    if (this.weeklyTotalCents === null) return null;
    return `$${(this.weeklyTotalCents / 100).toFixed(2)}`;
  }

  /** Weekly per-person cost as a dollar string. */
  weeklyPerPersonDollars() {
    if (this.weeklyPerPersonCents === null) return null;
    return `$${(this.weeklyPerPersonCents / 100).toFixed(2)}`;
  }

  /**
   * How many gallons are used per trip?
   * @return {number}
   */
  gallonsPerTrip() {
    const effectiveDistance = this.isRoundTrip
      ? this.totalDistanceMiles * 2
      : this.totalDistanceMiles;
    return effectiveDistance / this.combinedMpg;
  }

  /**
   * Get a transparency-friendly summary of how the estimate was calculated.
   * Per Review.md: "Calculate estimated cost sharing transparently"
   * @return {Object}
   */
  getBreakdown() {
    return {
      vehicle: this.vehicleDescription || 'Unknown vehicle',
      distanceOneWay: `${this.totalDistanceMiles.toFixed(1)} miles`,
      roundTrip: this.isRoundTrip,
      combinedMpg: `${this.combinedMpg.toFixed(1)} MPG`,
      gasPrice: `$${this.gasPricePerGallon.toFixed(2)}/gal`,
      gallonsUsed: `${this.gallonsPerTrip().toFixed(2)} gal`,
      totalCost: this.totalGasCostDollars(),
      splitBetween: `${this.numPassengers} people`,
      perPerson: this.costPerPersonDollars(),
    };
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      estimateId: this.estimateId,
      carpoolId: this.carpoolId,
      totalDistanceMiles: this.totalDistanceMiles,
      isRoundTrip: this.isRoundTrip,
      combinedMpg: this.combinedMpg,
      gasPricePerGallon: this.gasPricePerGallon,
      totalGasCostCents: this.totalGasCostCents,
      numPassengers: this.numPassengers,
      costPerPersonCents: this.costPerPersonCents,
      weeklyTotalCents: this.weeklyTotalCents,
      weeklyPerPersonCents: this.weeklyPerPersonCents,
      vehicleDescription: this.vehicleDescription,
      createdAt: this.createdAt,
    };
  }

  /** Reconstruct a GasEstimate from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new GasEstimate({
      estimateId: data.estimate_id || data.estimateId,
      carpoolId: data.carpool_id || data.carpoolId || null,
      totalDistanceMiles: data.total_distance_miles ?? data.totalDistanceMiles,
      isRoundTrip: data.is_round_trip ?? data.isRoundTrip ?? true,
      combinedMpg: data.combined_mpg ?? data.combinedMpg,
      gasPricePerGallon: data.gas_price_per_gallon ?? data.gasPricePerGallon,
      totalGasCostCents: data.total_gas_cost_cents ?? data.totalGasCostCents,
      numPassengers: data.num_passengers ?? data.numPassengers,
      costPerPersonCents: data.cost_per_person_cents ?? data.costPerPersonCents,
      weeklyTotalCents: data.weekly_total_cents ?? data.weeklyTotalCents ?? null,
      weeklyPerPersonCents: data.weekly_per_person_cents ?? data.weeklyPerPersonCents ?? null,
      vehicleDescription: data.vehicle_description || data.vehicleDescription || '',
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
    });
  }
}

module.exports = GasEstimate;
