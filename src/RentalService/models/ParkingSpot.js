/**
 * ParkingSpot.js
 * Represents a physical parking spot in one of the Harvard-Westlake lots.
 *
 * Maps to the ParkingSpots table in the database schema (Review.md §II).
 * Each spot has a fixed location, lot assignment, type (single/tandem),
 * and a distance-to-campus value used by the PricingEngine.
 */

const { LOT_NAMES, SPOT_TYPES } = require('../utils/constants');

class ParkingSpot {
  /**
   * @param {Object} data
   * @param {string}  data.spotId            - UUID primary key
   * @param {string}  data.lotName           - One of LOT_NAMES (Taper, Coldwater, etc.)
   * @param {string}  data.spotNumber        - Human-readable spot identifier (e.g. "A-12")
   * @param {string}  data.spotType          - 'single' or 'tandem'
   * @param {Object}  data.coordinates       - { lat: number, lng: number }
   * @param {number}  data.distanceToCampus  - Distance in meters from the main campus entrance
   * @param {boolean} data.isCompact         - True if this is a compact-only spot
   * @param {Date}    [data.createdAt]       - Timestamp of record creation
   */
  constructor({
    spotId,
    lotName,
    spotNumber,
    spotType = SPOT_TYPES.SINGLE,
    coordinates = { lat: 0, lng: 0 },
    distanceToCampus = 0,
    isCompact = false,
    createdAt = new Date(),
  }) {
    if (!spotId) throw new Error('ParkingSpot requires a spotId');
    if (!lotName || !Object.values(LOT_NAMES).includes(lotName)) {
      throw new Error(`Invalid lot name: ${lotName}. Must be one of: ${Object.values(LOT_NAMES).join(', ')}`);
    }
    if (!Object.values(SPOT_TYPES).includes(spotType)) {
      throw new Error(`Invalid spot type: ${spotType}`);
    }

    this.spotId = spotId;
    this.lotName = lotName;
    this.spotNumber = spotNumber;
    this.spotType = spotType;
    this.coordinates = coordinates;
    this.distanceToCampus = distanceToCampus;
    this.isCompact = isCompact;
    this.createdAt = createdAt;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Can the given vehicle size fit in this spot? */
  canFitVehicle(vehicleSize) {
    if (!this.isCompact) return true;          // Non-compact fits anything
    return vehicleSize === 'compact';           // Compact spot only fits compact cars
  }

  /** Is this a tandem spot? */
  isTandem() {
    return this.spotType === SPOT_TYPES.TANDEM;
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      spotId: this.spotId,
      lotName: this.lotName,
      spotNumber: this.spotNumber,
      spotType: this.spotType,
      coordinates: this.coordinates,
      distanceToCampus: this.distanceToCampus,
      isCompact: this.isCompact,
      createdAt: this.createdAt,
    };
  }

  /** Reconstruct a ParkingSpot from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new ParkingSpot({
      spotId: data.spot_id || data.spotId,
      lotName: data.lot_name || data.lotName,
      spotNumber: data.spot_number || data.spotNumber,
      spotType: data.spot_type || data.spotType,
      coordinates: data.coordinates || { lat: 0, lng: 0 },
      distanceToCampus: data.distance_to_campus ?? data.distanceToCampus ?? 0,
      isCompact: data.is_compact ?? data.isCompact ?? false,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
    });
  }
}

module.exports = ParkingSpot;
