/**
 * GasEstimator.js
 * Estimates gas costs for a carpool route based on vehicle MPG and gas prices.
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
 * ── Integration Points ─────────────────────────────────────────────────────
 *   - CarpoolProfile.getCombinedMpg() → provides vehicle fuel economy data
 *   - External gas price API (GasBuddy) → fetches real-time local gas prices
 *     (stubbed here; requires network access from Max's API service)
 *   - Location Service (Lauren) → provides route distances via Google Maps
 *     (we accept distance as input; Lauren's service calculates it)
 */

const GasEstimate = require('../models/GasEstimate');
const { GAS_ESTIMATION } = require('../utils/constants');

// ── Tiny UUID helper ───────────────────────────────────────────────────────
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

class GasEstimator {
  /**
   * @param {Object} [overrides]
   * @param {number} [overrides.defaultGasPricePerGallon] - Override default gas price
   * @param {number} [overrides.cityHighwaySplit]          - Override city/highway ratio
   */
  constructor(overrides = {}) {
    this.defaultGasPricePerGallon =
      overrides.defaultGasPricePerGallon ?? GAS_ESTIMATION.DEFAULT_GAS_PRICE_PER_GALLON;
    this.cityHighwaySplit =
      overrides.cityHighwaySplit ?? GAS_ESTIMATION.CITY_HIGHWAY_SPLIT;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CORE ESTIMATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Estimate gas cost for a carpool trip.
   *
   * @param {Object} params
   * @param {CarpoolProfile} params.driverProfile  - Driver's carpool profile (has vehicle info)
   * @param {number} params.distanceMiles           - One-way distance from driver's home to school
   * @param {number} params.numPassengers            - Total people in car (driver + riders)
   * @param {boolean} [params.roundTrip=true]        - Include return trip?
   * @param {number}  [params.gasPricePerGallon]     - Current gas price (default: LA average)
   * @param {string}  [params.carpoolId]             - Link to a carpool group
   *
   * @return {GasEstimate}
   */
  estimate({
    driverProfile,
    distanceMiles,
    numPassengers,
    roundTrip = true,
    gasPricePerGallon = null,
    carpoolId = null,
  }) {
    // ── Determine combined MPG ──────────────────────────────────────────
    const combinedMpg = driverProfile.getCombinedMpg(this.cityHighwaySplit);
    if (combinedMpg === null || combinedMpg <= 0) {
      throw new Error(
        'Driver profile is missing vehicle MPG data. ' +
        'Please add city and highway MPG values to the carpool profile.'
      );
    }

    // ── Determine gas price ─────────────────────────────────────────────
    const gasPrice = gasPricePerGallon ?? this.defaultGasPricePerGallon;

    // ── Calculate costs ─────────────────────────────────────────────────
    const effectiveDistance = roundTrip
      ? distanceMiles * GAS_ESTIMATION.ROUND_TRIP_MULTIPLIER
      : distanceMiles;

    const gallonsUsed = effectiveDistance / combinedMpg;
    const totalGasCostCents = Math.round(gallonsUsed * gasPrice * 100);
    const costPerPersonCents = Math.round(totalGasCostCents / numPassengers);

    // ── Weekly estimates ────────────────────────────────────────────────
    const weeklyTotalCents = totalGasCostCents * GAS_ESTIMATION.SCHOOL_DAYS_PER_WEEK;
    const weeklyPerPersonCents = costPerPersonCents * GAS_ESTIMATION.SCHOOL_DAYS_PER_WEEK;

    // ── Build vehicle description ───────────────────────────────────────
    const vehicleParts = [
      driverProfile.vehicleYear,
      driverProfile.vehicleMake,
      driverProfile.vehicleModel,
    ].filter(Boolean);
    const vehicleDescription = vehicleParts.join(' ') || 'Unknown vehicle';

    return new GasEstimate({
      estimateId: generateId(),
      carpoolId,
      totalDistanceMiles: distanceMiles,
      isRoundTrip: roundTrip,
      combinedMpg: Math.round(combinedMpg * 10) / 10,
      gasPricePerGallon: gasPrice,
      totalGasCostCents,
      numPassengers,
      costPerPersonCents,
      weeklyTotalCents,
      weeklyPerPersonCents,
      vehicleDescription,
    });
  }

  /**
   * Estimate gas cost using raw vehicle data (without a CarpoolProfile).
   * Useful for quick estimates before a profile is fully set up.
   *
   * @param {Object} params
   * @param {number} params.mpgCity            - City MPG
   * @param {number} params.mpgHighway         - Highway MPG
   * @param {number} params.distanceMiles      - One-way distance
   * @param {number} params.numPassengers      - Total people splitting cost
   * @param {boolean} [params.roundTrip=true]
   * @param {number}  [params.gasPricePerGallon]
   *
   * @return {GasEstimate}
   */
  estimateFromRawData({
    mpgCity,
    mpgHighway,
    distanceMiles,
    numPassengers,
    roundTrip = true,
    gasPricePerGallon = null,
  }) {
    if (typeof mpgCity !== 'number' || mpgCity <= 0) {
      throw new Error('mpgCity must be a positive number');
    }
    if (typeof mpgHighway !== 'number' || mpgHighway <= 0) {
      throw new Error('mpgHighway must be a positive number');
    }

    // Combined MPG using harmonic mean (EPA method)
    const citySplit = this.cityHighwaySplit;
    const highwaySplit = 1 - citySplit;
    const combinedMpg = 1 / (citySplit / mpgCity + highwaySplit / mpgHighway);

    const gasPrice = gasPricePerGallon ?? this.defaultGasPricePerGallon;
    const effectiveDistance = roundTrip
      ? distanceMiles * GAS_ESTIMATION.ROUND_TRIP_MULTIPLIER
      : distanceMiles;

    const gallonsUsed = effectiveDistance / combinedMpg;
    const totalGasCostCents = Math.round(gallonsUsed * gasPrice * 100);
    const costPerPersonCents = Math.round(totalGasCostCents / numPassengers);
    const weeklyTotalCents = totalGasCostCents * GAS_ESTIMATION.SCHOOL_DAYS_PER_WEEK;
    const weeklyPerPersonCents = costPerPersonCents * GAS_ESTIMATION.SCHOOL_DAYS_PER_WEEK;

    return new GasEstimate({
      estimateId: generateId(),
      totalDistanceMiles: distanceMiles,
      isRoundTrip: roundTrip,
      combinedMpg: Math.round(combinedMpg * 10) / 10,
      gasPricePerGallon: gasPrice,
      totalGasCostCents,
      numPassengers,
      costPerPersonCents,
      weeklyTotalCents,
      weeklyPerPersonCents,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GAS PRICE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Update the default gas price (e.g. after fetching from GasBuddy API).
   * @param {number} pricePerGallon - New gas price in USD
   */
  setDefaultGasPrice(pricePerGallon) {
    if (typeof pricePerGallon !== 'number' || pricePerGallon <= 0) {
      throw new Error('Gas price must be a positive number');
    }
    this.defaultGasPricePerGallon = pricePerGallon;
  }

  /**
   * Get the current default gas price.
   * @return {number}
   */
  getDefaultGasPrice() {
    return this.defaultGasPricePerGallon;
  }

  // Note: External gas price API integration (GasBuddy) is secondary.
  // Use setDefaultGasPrice() to update the price manually for now.
}

module.exports = GasEstimator;
