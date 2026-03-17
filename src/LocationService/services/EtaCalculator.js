/**
 * EtaCalculator.js
 * Wrapper around the Google Routes API (v2) for computing driving ETA
 * between two points.
 *
 * Used when a user leaves home to calculate "ETA: X min" for their
 * carpool group notification, and for the route overlap service.
 *
 * Requires: GOOGLE_MAPS_API_KEY environment variable.
 *
 * API reference:
 *   https://developers.google.com/maps/documentation/routes/compute_route_matrix
 */

const { MAPS_CONFIG } = require('../utils/constants');

class EtaCalculator {
  /**
   * @param {Object} options
   * @param {string} options.apiKey - Google Maps API key
   */
  constructor({ apiKey }) {
    if (!apiKey) {
      throw new Error('EtaCalculator requires a Google Maps API key (GOOGLE_MAPS_API_KEY)');
    }
    this.apiKey = apiKey;
  }

  /**
   * Compute driving route from origin to destination via the Routes API.
   *
   * Returns ETA in minutes, distance in meters, and the encoded polyline
   * (used by RouteOverlapService for route comparison).
   *
   * @param  {{ lat: number, lng: number }} origin
   * @param  {{ lat: number, lng: number }} destination
   * @return {Promise<{ etaMinutes: number, distanceMeters: number, polyline: string }>}
   */
  async computeRoute(origin, destination) {
    const body = {
      origin: {
        location: {
          latLng: { latitude: origin.lat, longitude: origin.lng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: destination.lat, longitude: destination.lng },
        },
      },
      travelMode: MAPS_CONFIG.TRAVEL_MODE,
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
    };

    const response = await fetch(MAPS_CONFIG.ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Routes API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route) {
      throw new Error('Routes API returned no routes');
    }

    const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);

    return {
      etaMinutes: Math.ceil(durationSeconds / 60),
      distanceMeters: route.distanceMeters || 0,
      polyline: route.polyline?.encodedPolyline || '',
    };
  }

  /**
   * Convenience: get just the ETA in minutes.
   * @param  {{ lat: number, lng: number }} origin
   * @param  {{ lat: number, lng: number }} destination
   * @return {Promise<number>} ETA in minutes
   */
  async getEtaMinutes(origin, destination) {
    const result = await this.computeRoute(origin, destination);
    return result.etaMinutes;
  }

  /**
   * Geocode an address string to lat/lng coordinates.
   * @param  {string} address
   * @return {Promise<{ lat: number, lng: number, formattedAddress: string }>}
   */
  async geocodeAddress(address) {
    const url = `${MAPS_CONFIG.GEOCODING_API_URL}?address=${encodeURIComponent(address)}&key=${this.apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Geocoding API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result) {
      throw new Error(`Geocoding failed: no results for "${address}"`);
    }

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  }
}

module.exports = EtaCalculator;
