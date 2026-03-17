/**
 * UserLocation.js
 * Represents a snapshot of a user's current location and commute status.
 *
 * Stored in the `userLocations` Firestore collection (one document per user,
 * overwritten on each update).  Historical location data is NOT retained —
 * only the latest position matters for geofence checks, on-campus queries,
 * and ETA calculations.
 */

const { LOCATION_STATUS, LOCATION_SOURCE } = require('../utils/constants');

class UserLocation {
  /**
   * @param {Object} data
   * @param {string}  data.userId               - Foreign key → User
   * @param {Object}  data.coordinates          - { lat: number, lng: number }
   * @param {string}  data.status               - One of LOCATION_STATUS values
   * @param {string}  data.source               - One of LOCATION_SOURCE values
   * @param {Date}    [data.timestamp]          - When this update was recorded
   * @param {Date}    [data.arrivedAtSchoolAt]  - When the user entered the school zone
   * @param {number}  [data.currentEtaMinutes]  - Latest ETA to destination (minutes)
   * @param {string}  [data.etaDestination]     - 'school' | 'home' | 'carpool_pickup'
   */
  constructor({
    userId,
    coordinates = { lat: 0, lng: 0 },
    status = LOCATION_STATUS.UNKNOWN,
    source = LOCATION_SOURCE.MANUAL,
    timestamp = new Date(),
    arrivedAtSchoolAt = null,
    currentEtaMinutes = null,
    etaDestination = null,
  }) {
    if (!userId) throw new Error('UserLocation requires a userId');
    if (!Object.values(LOCATION_STATUS).includes(status)) {
      throw new Error(`Invalid location status: ${status}`);
    }
    if (!Object.values(LOCATION_SOURCE).includes(source)) {
      throw new Error(`Invalid location source: ${source}`);
    }

    this.userId = userId;
    this.coordinates = coordinates;
    this.status = status;
    this.source = source;
    this.timestamp = timestamp;
    this.arrivedAtSchoolAt = arrivedAtSchoolAt;
    this.currentEtaMinutes = currentEtaMinutes;
    this.etaDestination = etaDestination;
  }

  hasValidCoordinates() {
    return (
      this.coordinates &&
      typeof this.coordinates.lat === 'number' &&
      typeof this.coordinates.lng === 'number' &&
      this.coordinates.lat !== 0 &&
      this.coordinates.lng !== 0
    );
  }

  isAtSchool() {
    return this.status === LOCATION_STATUS.AT_SCHOOL;
  }

  isEnRoute() {
    return (
      this.status === LOCATION_STATUS.EN_ROUTE_TO_SCHOOL ||
      this.status === LOCATION_STATUS.EN_ROUTE_HOME
    );
  }

  /**
   * Check if this location update is recent enough to be trusted.
   * @param  {number} maxAgeMinutes
   * @return {boolean}
   */
  isFresh(maxAgeMinutes = 15) {
    const ageMs = Date.now() - new Date(this.timestamp).getTime();
    return ageMs <= maxAgeMinutes * 60 * 1000;
  }

  /**
   * How many minutes the user has been at school (null if not at school).
   * @return {number|null}
   */
  minutesAtSchool() {
    if (!this.arrivedAtSchoolAt) return null;
    return (Date.now() - new Date(this.arrivedAtSchoolAt).getTime()) / 60000;
  }

  toJSON() {
    return {
      userId: this.userId,
      coordinates: this.coordinates,
      status: this.status,
      source: this.source,
      timestamp: this.timestamp,
      arrivedAtSchoolAt: this.arrivedAtSchoolAt,
      currentEtaMinutes: this.currentEtaMinutes,
      etaDestination: this.etaDestination,
    };
  }

  static fromJSON(data) {
    return new UserLocation({
      userId: data.userId || data.user_id,
      coordinates: data.coordinates || { lat: 0, lng: 0 },
      status: data.status || LOCATION_STATUS.UNKNOWN,
      source: data.source || LOCATION_SOURCE.MANUAL,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      arrivedAtSchoolAt: data.arrivedAtSchoolAt ? new Date(data.arrivedAtSchoolAt) : null,
      currentEtaMinutes: data.currentEtaMinutes ?? null,
      etaDestination: data.etaDestination ?? null,
    });
  }
}

module.exports = UserLocation;
