/**
 * GeofenceEngine.js
 * Determines whether a GPS coordinate falls inside a circular geofence zone.
 *
 * Uses the Haversine formula (consistent with CarpoolCompatibilityEngine)
 * to compute the great-circle distance between two points, then compares
 * it to the zone's radius.
 *
 * Also handles transition detection: given a user's previous status and
 * current position, it determines which geofence events have fired
 * (entered home, left home, entered school, etc.).
 */

const {
  EARTH_RADIUS_METERS,
  LOCATION_STATUS,
  GEOFENCE_CONFIG,
} = require('../utils/constants');

class GeofenceEngine {
  /**
   * Haversine distance between two coordinates in meters.
   * @param  {{ lat: number, lng: number }} a
   * @param  {{ lat: number, lng: number }} b
   * @return {number} Distance in meters
   */
  static distanceMeters(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);

    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
  }

  /**
   * Is the given point inside the geofence zone?
   * @param  {{ lat: number, lng: number }} point
   * @param  {GeofenceZone} zone
   * @return {boolean}
   */
  static isInsideZone(point, zone) {
    const dist = GeofenceEngine.distanceMeters(point, zone.center);
    return dist <= zone.radiusMeters;
  }

  /**
   * Given a user's current coordinates and their set of geofence zones,
   * determine which zone (if any) they are currently inside.
   *
   * Priority: school > carpool_pickup > home  (most specific wins)
   *
   * @param  {{ lat: number, lng: number }} coordinates
   * @param  {GeofenceZone[]} zones
   * @return {GeofenceZone|null} The matched zone, or null
   */
  static detectCurrentZone(coordinates, zones) {
    const priority = ['school', 'carpool_pickup', 'home'];

    const sorted = [...zones].sort(
      (a, b) => priority.indexOf(a.zoneType) - priority.indexOf(b.zoneType)
    );

    for (const zone of sorted) {
      if (GeofenceEngine.isInsideZone(coordinates, zone)) {
        return zone;
      }
    }
    return null;
  }

  /**
   * Determine the new LOCATION_STATUS based on zone detection and previous status.
   *
   * Handles the "left school" buffer: a user is only marked LEFT_SCHOOL if
   * they have been AT_SCHOOL for at least GEOFENCE_CONFIG.LEFT_SCHOOL_BUFFER_MINUTES.
   *
   * @param {Object} params
   * @param {{ lat: number, lng: number }} params.coordinates
   * @param {GeofenceZone[]} params.zones
   * @param {string}         params.previousStatus
   * @param {Date|null}      params.arrivedAtSchoolAt
   * @return {{ status: string, zone: GeofenceZone|null, events: string[] }}
   */
  static evaluateTransition({ coordinates, zones, previousStatus, arrivedAtSchoolAt }) {
    const zone = GeofenceEngine.detectCurrentZone(coordinates, zones);
    const events = [];
    let status = LOCATION_STATUS.UNKNOWN;

    if (zone) {
      switch (zone.zoneType) {
        case 'school':
          status = LOCATION_STATUS.AT_SCHOOL;
          if (previousStatus !== LOCATION_STATUS.AT_SCHOOL) {
            events.push('entered_school');
          }
          break;

        case 'carpool_pickup':
          status = LOCATION_STATUS.AT_CARPOOL_PICKUP;
          if (previousStatus !== LOCATION_STATUS.AT_CARPOOL_PICKUP) {
            events.push('arrived_carpool');
          }
          break;

        case 'home':
          status = LOCATION_STATUS.AT_HOME;
          if (previousStatus !== LOCATION_STATUS.AT_HOME) {
            events.push('arrived_home');
          }
          break;
      }
    } else {
      // User is outside all zones
      if (previousStatus === LOCATION_STATUS.AT_HOME) {
        status = LOCATION_STATUS.EN_ROUTE_TO_SCHOOL;
        events.push('left_home');
      } else if (previousStatus === LOCATION_STATUS.AT_SCHOOL) {
        const minutesAtSchool = arrivedAtSchoolAt
          ? (Date.now() - new Date(arrivedAtSchoolAt).getTime()) / 60000
          : Infinity;

        if (minutesAtSchool >= GEOFENCE_CONFIG.LEFT_SCHOOL_BUFFER_MINUTES) {
          status = LOCATION_STATUS.LEFT_SCHOOL;
          events.push('left_school');
        } else {
          // Still within buffer — keep them as AT_SCHOOL (probably just stepped off campus briefly)
          status = LOCATION_STATUS.AT_SCHOOL;
        }
      } else if (previousStatus === LOCATION_STATUS.AT_CARPOOL_PICKUP) {
        status = LOCATION_STATUS.EN_ROUTE_TO_SCHOOL;
        events.push('left_carpool_pickup');
      } else {
        status = previousStatus || LOCATION_STATUS.UNKNOWN;
      }
    }

    return { status, zone, events };
  }
}

module.exports = GeofenceEngine;
