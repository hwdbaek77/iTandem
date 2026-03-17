/**
 * GeofenceZone.js
 * Represents a circular geographic boundary used to detect when a user
 * enters or exits a meaningful area (home, school, carpool pickup).
 *
 * Each user has up to three zones:
 *   - home:            centered on their home address
 *   - school:          centered on Harvard-Westlake campus (shared)
 *   - carpool_pickup:  centered on their carpool group's pickup point
 */

const { ZONE_TYPE, GEOFENCE_CONFIG } = require('../utils/constants');

class GeofenceZone {
  /**
   * @param {Object} data
   * @param {string}  data.zoneId          - Unique identifier (e.g. 'home_<userId>')
   * @param {string}  data.userId          - Owner of this zone (null for shared zones)
   * @param {string}  data.zoneType        - One of ZONE_TYPE values
   * @param {Object}  data.center          - { lat: number, lng: number }
   * @param {number}  data.radiusMeters    - Geofence radius in meters
   * @param {string}  [data.label]         - Human-readable label (e.g. "Home", "HW Campus")
   */
  constructor({
    zoneId,
    userId = null,
    zoneType,
    center = { lat: 0, lng: 0 },
    radiusMeters,
    label = '',
  }) {
    if (!zoneId) throw new Error('GeofenceZone requires a zoneId');
    if (!zoneType || !Object.values(ZONE_TYPE).includes(zoneType)) {
      throw new Error(`Invalid zone type: ${zoneType}`);
    }

    this.zoneId = zoneId;
    this.userId = userId;
    this.zoneType = zoneType;
    this.center = center;
    this.radiusMeters = radiusMeters;
    this.label = label;
  }

  /**
   * Create the shared school zone (same for all users).
   */
  static createSchoolZone() {
    const { SCHOOL_COORDINATES } = require('../utils/constants');
    return new GeofenceZone({
      zoneId: 'school',
      userId: null,
      zoneType: ZONE_TYPE.SCHOOL,
      center: SCHOOL_COORDINATES,
      radiusMeters: GEOFENCE_CONFIG.SCHOOL_RADIUS_METERS,
      label: 'Harvard-Westlake Campus',
    });
  }

  /**
   * Create a home zone for a specific user.
   * @param {string} userId
   * @param {{ lat: number, lng: number }} homeCoordinates
   */
  static createHomeZone(userId, homeCoordinates) {
    return new GeofenceZone({
      zoneId: `home_${userId}`,
      userId,
      zoneType: ZONE_TYPE.HOME,
      center: homeCoordinates,
      radiusMeters: GEOFENCE_CONFIG.HOME_RADIUS_METERS,
      label: 'Home',
    });
  }

  /**
   * Create a carpool pickup zone.
   * @param {string} userId
   * @param {{ lat: number, lng: number }} pickupCoordinates
   */
  static createCarpoolPickupZone(userId, pickupCoordinates) {
    return new GeofenceZone({
      zoneId: `carpool_pickup_${userId}`,
      userId,
      zoneType: ZONE_TYPE.CARPOOL_PICKUP,
      center: pickupCoordinates,
      radiusMeters: GEOFENCE_CONFIG.CARPOOL_PICKUP_RADIUS_METERS,
      label: 'Carpool Pickup',
    });
  }

  toJSON() {
    return {
      zoneId: this.zoneId,
      userId: this.userId,
      zoneType: this.zoneType,
      center: this.center,
      radiusMeters: this.radiusMeters,
      label: this.label,
    };
  }

  static fromJSON(data) {
    return new GeofenceZone({
      zoneId: data.zoneId || data.zone_id,
      userId: data.userId || data.user_id || null,
      zoneType: data.zoneType || data.zone_type,
      center: data.center || { lat: 0, lng: 0 },
      radiusMeters: data.radiusMeters ?? data.radius_meters ?? 150,
      label: data.label || '',
    });
  }
}

module.exports = GeofenceZone;
