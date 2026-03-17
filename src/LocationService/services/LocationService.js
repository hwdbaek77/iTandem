/**
 * LocationService.js
 * Main orchestrator for all location-related operations in iTandem.
 *
 * Coordinates the GeofenceEngine, EtaCalculator, and RouteOverlapService
 * to provide the following capabilities:
 *
 *  1. Update a user's location and detect geofence transitions
 *  2. Calculate ETA when a user leaves home ("left house, ETA: X min")
 *  3. Track school arrival and departure (with 30-minute buffer)
 *  4. Query which users are currently on campus ("find ride home")
 *  5. Provide route overlap data to CarpoolCompatibilityEngine
 *
 * ── Data Store ────────────────────────────────────────────────────────────
 * Uses in-memory Maps for development/testing (same pattern as RentalService
 * and CarpoolService).  In production, swap for Firestore queries.
 *
 * ── Integration Points ───────────────────────────────────────────────────
 *  - CarpoolService → route overlap for compatibility scoring
 *  - NotificationService (future) → push notifications on events
 *  - Frontend → manual status updates, "find ride home" button
 */

const UserLocation = require('../models/UserLocation');
const GeofenceZone = require('../models/GeofenceZone');
const GeofenceEngine = require('./GeofenceEngine');
const EtaCalculator = require('./EtaCalculator');
const RouteOverlapService = require('./RouteOverlapService');
const {
  LOCATION_STATUS,
  LOCATION_SOURCE,
  LOCATION_NOTIFICATION_TYPE,
  GEOFENCE_CONFIG,
  SCHOOL_COORDINATES,
} = require('../utils/constants');

class LocationService {
  /**
   * @param {Object} options
   * @param {string} options.apiKey - Google Maps API key
   */
  constructor({ apiKey } = {}) {
    this.etaCalculator = apiKey ? new EtaCalculator({ apiKey }) : null;
    this.routeOverlapService = this.etaCalculator
      ? new RouteOverlapService({ etaCalculator: this.etaCalculator })
      : null;

    // In-memory stores (swap for Firestore in production)
    this.locations = new Map();    // userId → UserLocation
    this.zones = new Map();        // userId → GeofenceZone[]
    this.notifications = [];       // { type, recipientUserIds, message, timestamp }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ZONE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Set up geofence zones for a user.  Call this when a user registers or
   * updates their home address / carpool group.
   *
   * @param {string} userId
   * @param {{ lat: number, lng: number }} homeCoordinates
   * @param {{ lat: number, lng: number }} [carpoolPickupCoordinates]
   */
  setupUserZones(userId, homeCoordinates, carpoolPickupCoordinates = null) {
    const userZones = [
      GeofenceZone.createSchoolZone(),
      GeofenceZone.createHomeZone(userId, homeCoordinates),
    ];

    if (carpoolPickupCoordinates) {
      userZones.push(GeofenceZone.createCarpoolPickupZone(userId, carpoolPickupCoordinates));
    }

    this.zones.set(userId, userZones);
    return userZones;
  }

  /**
   * Get a user's configured geofence zones.
   * @param  {string} userId
   * @return {GeofenceZone[]}
   */
  getUserZones(userId) {
    return this.zones.get(userId) || [];
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  LOCATION UPDATES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Process an incoming location update for a user.
   *
   * 1. Run geofence detection against user's zones.
   * 2. Determine status transitions and events.
   * 3. If "left_home" event → compute ETA via Routes API.
   * 4. Queue notifications for carpool group members.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {{ lat: number, lng: number }} params.coordinates
   * @param {string} [params.source] - 'manual' | 'geofence' | 'polling'
   * @param {string[]} [params.carpoolMemberIds] - User IDs in the same carpool group
   * @return {Promise<{ location: UserLocation, events: string[], notifications: Object[] }>}
   */
  async updateLocation({ userId, coordinates, source = LOCATION_SOURCE.POLLING, carpoolMemberIds = [] }) {
    const userZones = this.getUserZones(userId);
    const previous = this.locations.get(userId);
    const previousStatus = previous?.status || LOCATION_STATUS.UNKNOWN;
    const arrivedAtSchoolAt = previous?.arrivedAtSchoolAt || null;

    // Evaluate geofence transitions
    const transition = GeofenceEngine.evaluateTransition({
      coordinates,
      zones: userZones,
      previousStatus,
      arrivedAtSchoolAt,
    });

    // Build updated UserLocation
    const location = new UserLocation({
      userId,
      coordinates,
      status: transition.status,
      source,
      timestamp: new Date(),
      arrivedAtSchoolAt:
        transition.status === LOCATION_STATUS.AT_SCHOOL
          ? (arrivedAtSchoolAt || new Date())
          : null,
    });

    // Compute ETA when leaving home
    const newNotifications = [];
    if (transition.events.includes('left_home') && this.etaCalculator) {
      try {
        const eta = await this.etaCalculator.getEtaMinutes(coordinates, SCHOOL_COORDINATES);
        location.currentEtaMinutes = eta;
        location.etaDestination = 'school';

        newNotifications.push({
          type: LOCATION_NOTIFICATION_TYPE.LEFT_HOME,
          recipientUserIds: carpoolMemberIds,
          message: `Left house, ETA: ${eta} min`,
          userId,
          timestamp: new Date(),
        });
      } catch (err) {
        // ETA calculation failed — still record the location update
        console.error(`ETA calculation failed for user ${userId}:`, err.message);
      }
    }

    // Carpool arrival notification
    if (transition.events.includes('arrived_carpool')) {
      newNotifications.push({
        type: LOCATION_NOTIFICATION_TYPE.ARRIVED_CARPOOL,
        recipientUserIds: carpoolMemberIds,
        message: 'Arrived at carpool pickup',
        userId,
        timestamp: new Date(),
      });
    }

    // School arrival notification
    if (transition.events.includes('entered_school')) {
      newNotifications.push({
        type: LOCATION_NOTIFICATION_TYPE.ARRIVED_SCHOOL,
        recipientUserIds: carpoolMemberIds,
        message: 'Arrived at school',
        userId,
        timestamp: new Date(),
      });
    }

    // Left school notification
    if (transition.events.includes('left_school')) {
      newNotifications.push({
        type: LOCATION_NOTIFICATION_TYPE.LEFT_SCHOOL,
        recipientUserIds: carpoolMemberIds,
        message: 'Left school',
        userId,
        timestamp: new Date(),
      });
    }

    // Persist
    this.locations.set(userId, location);
    this.notifications.push(...newNotifications);

    return {
      location,
      events: transition.events,
      notifications: newNotifications,
    };
  }

  /**
   * Manual status update (user taps a button like "I'm leaving").
   * Delegates to updateLocation with the MANUAL source.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {{ lat: number, lng: number }} params.coordinates
   * @param {string[]} [params.carpoolMemberIds]
   */
  async setManualStatus({ userId, coordinates, carpoolMemberIds = [] }) {
    return this.updateLocation({
      userId,
      coordinates,
      source: LOCATION_SOURCE.MANUAL,
      carpoolMemberIds,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get the current location record for a user.
   * @param  {string} userId
   * @return {UserLocation|null}
   */
  getUserLocation(userId) {
    return this.locations.get(userId) || null;
  }

  /**
   * Find all users currently on campus with a fresh location.
   * Powers the "find ride home" feature.
   *
   * @param  {number} [maxAgeMinutes] - Max age of location update
   * @return {UserLocation[]}
   */
  getUsersOnCampus(maxAgeMinutes = GEOFENCE_CONFIG.ON_CAMPUS_STALE_MINUTES) {
    const onCampus = [];
    for (const loc of this.locations.values()) {
      if (loc.isAtSchool() && loc.isFresh(maxAgeMinutes)) {
        onCampus.push(loc);
      }
    }
    return onCampus;
  }

  /**
   * "Find ride home" — ping users who are currently on campus.
   *
   * @param {Object} params
   * @param {string} params.requesterId  - User requesting a ride
   * @param {number} [params.maxAgeMinutes]
   * @return {{ onCampusUsers: UserLocation[], notification: Object }}
   */
  findRideHome({ requesterId, maxAgeMinutes }) {
    const onCampus = this.getUsersOnCampus(maxAgeMinutes)
      .filter((loc) => loc.userId !== requesterId);

    const notification = {
      type: LOCATION_NOTIFICATION_TYPE.RIDE_HOME_REQUEST,
      recipientUserIds: onCampus.map((loc) => loc.userId),
      message: 'Looking for a ride home today',
      userId: requesterId,
      timestamp: new Date(),
    };

    this.notifications.push(notification);

    return { onCampusUsers: onCampus, notification };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ETA & ROUTE OVERLAP (delegates to sub-services)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get ETA from origin to destination.
   * @param  {{ lat: number, lng: number }} origin
   * @param  {{ lat: number, lng: number }} destination
   * @return {Promise<{ etaMinutes: number, distanceMeters: number }>}
   */
  async getEta(origin, destination) {
    if (!this.etaCalculator) {
      throw new Error('EtaCalculator unavailable — missing Google Maps API key');
    }
    return this.etaCalculator.computeRoute(origin, destination);
  }

  /**
   * Get ETA from a user's current location to school.
   * @param  {string} userId
   * @return {Promise<number>} ETA in minutes
   */
  async getEtaToSchool(userId) {
    if (!this.etaCalculator) {
      throw new Error('EtaCalculator unavailable — missing Google Maps API key');
    }
    const loc = this.getUserLocation(userId);
    if (!loc || !loc.hasValidCoordinates()) {
      throw new Error(`No valid location for user ${userId}`);
    }
    return this.etaCalculator.getEtaMinutes(loc.coordinates, SCHOOL_COORDINATES);
  }

  /**
   * Check if two users share a driving route to school.
   * @param  {{ lat: number, lng: number }} homeA
   * @param  {{ lat: number, lng: number }} homeB
   * @return {Promise<{ onSameRoute: boolean, overlapFraction: number }>}
   */
  async checkRouteOverlap(homeA, homeB) {
    if (!this.routeOverlapService) {
      throw new Error('RouteOverlapService unavailable — missing Google Maps API key');
    }
    return this.routeOverlapService.checkRouteOverlap(homeA, homeB);
  }

  /**
   * For a target user, find which candidates share a route.
   * Returns a Set<string> of overlapping user IDs — plug directly
   * into CarpoolCompatibilityEngine.findMatches({ routeOverlapUserIds }).
   *
   * @param  {{ lat: number, lng: number }} targetHome
   * @param  {Array<{ userId: string, homeCoordinates: { lat: number, lng: number } }>} candidates
   * @return {Promise<Set<string>>}
   */
  async findRouteOverlaps(targetHome, candidates) {
    if (!this.routeOverlapService) {
      return new Set();
    }
    return this.routeOverlapService.findOverlappingUsers(targetHome, candidates);
  }

  /**
   * Geocode an address string to coordinates.
   * @param  {string} address
   * @return {Promise<{ lat: number, lng: number, formattedAddress: string }>}
   */
  async geocodeAddress(address) {
    if (!this.etaCalculator) {
      throw new Error('EtaCalculator unavailable — missing Google Maps API key');
    }
    return this.etaCalculator.geocodeAddress(address);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  NOTIFICATION LOG (for testing / future push integration)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all queued notifications (for a specific user or all).
   * In production, replace with FCM push delivery.
   */
  getNotifications(userId = null) {
    if (!userId) return [...this.notifications];
    return this.notifications.filter(
      (n) => n.recipientUserIds.includes(userId) || n.userId === userId
    );
  }

  /** Clear notification log (testing). */
  clearNotifications() {
    this.notifications = [];
  }
}

module.exports = LocationService;
