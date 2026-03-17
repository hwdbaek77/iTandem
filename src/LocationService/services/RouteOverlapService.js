/**
 * RouteOverlapService.js
 * Determines whether two users' home→school routes share significant overlap.
 *
 * This feeds into CarpoolCompatibilityEngine's `onSameRoute` parameter
 * (which grants a ROUTE_OVERLAP_BONUS to the proximity score).
 *
 * Strategy:
 *   1. Fetch route polylines from the Routes API for both users.
 *   2. Decode the polylines into arrays of lat/lng points.
 *   3. Sample points along each route and check how many of route B's
 *      points fall within a tolerance distance of route A.
 *   4. If the overlap fraction >= ROUTE_OVERLAP_THRESHOLD → onSameRoute = true.
 */

const EtaCalculator = require('./EtaCalculator');
const GeofenceEngine = require('./GeofenceEngine');
const { MAPS_CONFIG, SCHOOL_COORDINATES } = require('../utils/constants');

const OVERLAP_TOLERANCE_METERS = 200; // Points within 200m of the other route count as overlap

class RouteOverlapService {
  /**
   * @param {Object} options
   * @param {EtaCalculator} options.etaCalculator
   */
  constructor({ etaCalculator }) {
    this.etaCalculator = etaCalculator;
  }

  /**
   * Check if two users share a similar route from home to school.
   *
   * @param  {{ lat: number, lng: number }} homeA - User A's home coordinates
   * @param  {{ lat: number, lng: number }} homeB - User B's home coordinates
   * @return {Promise<{ onSameRoute: boolean, overlapFraction: number }>}
   */
  async checkRouteOverlap(homeA, homeB) {
    const [routeA, routeB] = await Promise.all([
      this.etaCalculator.computeRoute(homeA, SCHOOL_COORDINATES),
      this.etaCalculator.computeRoute(homeB, SCHOOL_COORDINATES),
    ]);

    const pointsA = RouteOverlapService.decodePolyline(routeA.polyline);
    const pointsB = RouteOverlapService.decodePolyline(routeB.polyline);

    if (pointsA.length === 0 || pointsB.length === 0) {
      return { onSameRoute: false, overlapFraction: 0 };
    }

    // Sample the shorter route's points and check proximity to the longer route
    const [shorter, longer] = pointsA.length <= pointsB.length
      ? [pointsA, pointsB]
      : [pointsB, pointsA];

    let overlapCount = 0;
    for (const point of shorter) {
      if (RouteOverlapService._isNearRoute(point, longer)) {
        overlapCount++;
      }
    }

    const overlapFraction = overlapCount / shorter.length;
    return {
      onSameRoute: overlapFraction >= MAPS_CONFIG.ROUTE_OVERLAP_THRESHOLD,
      overlapFraction: Math.round(overlapFraction * 100) / 100,
    };
  }

  /**
   * Batch check: for a target user, determine which candidate users share a route.
   * Returns a Set of userIds that have route overlap with the target.
   *
   * @param  {{ lat: number, lng: number }} targetHome
   * @param  {Array<{ userId: string, homeCoordinates: { lat: number, lng: number } }>} candidates
   * @return {Promise<Set<string>>}
   */
  async findOverlappingUsers(targetHome, candidates) {
    const results = await Promise.allSettled(
      candidates.map(async (c) => {
        const { onSameRoute } = await this.checkRouteOverlap(targetHome, c.homeCoordinates);
        return { userId: c.userId, onSameRoute };
      })
    );

    const overlapping = new Set();
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.onSameRoute) {
        overlapping.add(result.value.userId);
      }
    }
    return overlapping;
  }

  /**
   * Check if a point is within OVERLAP_TOLERANCE_METERS of any point on a route.
   * Uses binary-search-like early exit for performance on long routes.
   * @private
   */
  static _isNearRoute(point, routePoints) {
    for (const rp of routePoints) {
      const dist = GeofenceEngine.distanceMeters(point, rp);
      if (dist <= OVERLAP_TOLERANCE_METERS) return true;
    }
    return false;
  }

  /**
   * Decode a Google-encoded polyline string into an array of { lat, lng } points.
   *
   * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
   *
   * @param  {string} encoded
   * @return {{ lat: number, lng: number }[]}
   */
  static decodePolyline(encoded) {
    if (!encoded) return [];

    const points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return points;
  }
}

module.exports = RouteOverlapService;
