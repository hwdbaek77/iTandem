/**
 * PricingEngine.js
 * Calculates rental prices based on distance-to-campus and a tunable market rate.
 *
 * Business rules (MVP.md):
 *   - "Spots get more expensive by distance"
 *   - "Market rate can be fine-tuned"
 *
 * Pricing formula:
 *   price = (BASE_RATE + distanceToCampus * DISTANCE_RATE) * MARKET_MULTIPLIER
 *
 * All values are in cents to avoid floating-point rounding issues.
 * The platform takes a configurable percentage fee on every transaction.
 */

const { PRICING } = require('../utils/constants');

class PricingEngine {
  /**
   * @param {Object} [overrides] - Override default pricing constants
   * @param {number} [overrides.baseRateCents]
   * @param {number} [overrides.distanceRateCentsPerMeter]
   * @param {number} [overrides.marketRateMultiplier]
   * @param {number} [overrides.platformFeePercent]
   */
  constructor(overrides = {}) {
    this.baseRateCents = overrides.baseRateCents ?? PRICING.BASE_RATE_CENTS;
    this.distanceRateCentsPerMeter = overrides.distanceRateCentsPerMeter ?? PRICING.DISTANCE_RATE_CENTS_PER_METER;
    this.marketRateMultiplier = overrides.marketRateMultiplier ?? PRICING.MARKET_RATE_MULTIPLIER;
    this.platformFeePercent = overrides.platformFeePercent ?? PRICING.PLATFORM_FEE_PERCENT;
  }

  // ── Core Pricing ────────────────────────────────────────────────────────

  /**
   * Calculate the rental price for a parking spot.
   * @param  {ParkingSpot} spot - The spot being rented
   * @return {number} Price in cents
   */
  calculateSpotPrice(spot) {
    const distanceSurcharge = Math.round(spot.distanceToCampus * this.distanceRateCentsPerMeter);
    const rawPrice = this.baseRateCents + distanceSurcharge;
    const adjusted = Math.round(rawPrice * this.marketRateMultiplier);
    return Math.max(adjusted, 0);
  }

  /**
   * Break down the price into owner payout and platform fee.
   * @param  {number} priceCents - Total price charged to the renter
   * @return {{ totalCents: number, platformFeeCents: number, ownerPayoutCents: number }}
   */
  calculateFeeBreakdown(priceCents) {
    const platformFeeCents = Math.round(priceCents * (this.platformFeePercent / 100));
    const ownerPayoutCents = priceCents - platformFeeCents;
    return {
      totalCents: priceCents,
      platformFeeCents,
      ownerPayoutCents,
    };
  }

  // ── Market Rate Adjustment ──────────────────────────────────────────────

  /**
   * Update the market rate multiplier (admin-tunable).
   * @param {number} multiplier - e.g. 1.2 = 20% above base, 0.8 = 20% discount
   */
  setMarketRateMultiplier(multiplier) {
    if (typeof multiplier !== 'number' || multiplier < 0) {
      throw new Error('Market rate multiplier must be a non-negative number');
    }
    this.marketRateMultiplier = multiplier;
  }

  // ── Bulk Pricing ────────────────────────────────────────────────────────

  /**
   * Price a list of available spots, sorted cheapest-first.
   * Useful for the "available spots" page where green spots are listed.
   * @param  {ParkingSpot[]} spots
   * @return {Array<{ spot: ParkingSpot, priceCents: number, priceDollars: string }>}
   */
  priceAvailableSpots(spots) {
    return spots
      .map((spot) => {
        const priceCents = this.calculateSpotPrice(spot);
        return {
          spot,
          priceCents,
          priceDollars: `$${(priceCents / 100).toFixed(2)}`,
        };
      })
      .sort((a, b) => a.priceCents - b.priceCents);
  }

  // ── Reassignment Pricing ────────────────────────────────────────────────

  /**
   * When a renter is reassigned to a new spot (because their original was
   * blocked), determine if additional payment or a refund is needed.
   *
   * Per the Review.md recommendation: "Only reassign to spots of equal or
   * lesser distance" — so this should usually return 0 or a negative diff.
   *
   * @param  {number} originalPriceCents - What the renter originally paid
   * @param  {ParkingSpot} newSpot       - The replacement spot
   * @return {{ newPriceCents: number, differencesCents: number }}
   */
  calculateReassignmentDifference(originalPriceCents, newSpot) {
    const newPriceCents = this.calculateSpotPrice(newSpot);
    return {
      newPriceCents,
      differenceCents: newPriceCents - originalPriceCents,
    };
  }
}

module.exports = PricingEngine;
