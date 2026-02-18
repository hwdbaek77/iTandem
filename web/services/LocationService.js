/**
 * LocationService
 *
 * Server-side utility that wraps the Google Maps Distance Matrix and
 * Geocoding APIs.  Given two addresses it returns:
 *   - driving distance (text + meters)
 *   - driving duration (text + seconds)
 *   - resolved / formatted addresses
 *   - lat/lng coordinates for both endpoints
 */

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BASE = "https://maps.googleapis.com/maps/api";

export class LocationService {
  /* ------------------------------------------------------------------ */
  /*  Distance Matrix                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Call the Distance Matrix API and return distance + duration between
   * the two addresses (driving, imperial units).
   */
  static async getDistance(origin, destination) {
    const url = new URL(`${BASE}/distancematrix/json`);
    url.searchParams.set("origins", origin);
    url.searchParams.set("destinations", destination);
    url.searchParams.set("units", "imperial");
    url.searchParams.set("key", API_KEY);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      throw new Error(
        `Distance Matrix API error: ${data.status} – ${data.error_message || "unknown"}`
      );
    }

    const element = data.rows[0]?.elements[0];

    if (!element || element.status !== "OK") {
      throw new Error(`Route not found: ${element?.status || "UNKNOWN"}`);
    }

    return {
      originAddress: data.origin_addresses[0],
      destinationAddress: data.destination_addresses[0],
      distance: element.distance, // { text, value }
      duration: element.duration, // { text, value }
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Geocoding                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Geocode a single address → { lat, lng, formattedAddress }.
   */
  static async geocode(address) {
    const url = new URL(`${BASE}/geocode/json`);
    url.searchParams.set("address", address);
    url.searchParams.set("key", API_KEY);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      throw new Error(`Geocoding error for "${address}": ${data.status}`);
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng, formattedAddress: data.results[0].formatted_address };
  }

  /* ------------------------------------------------------------------ */
  /*  Combined helper                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Full lookup: distance/duration + coordinates for both endpoints.
   */
  static async getFullDistanceInfo(origin, destination) {
    const [distanceResult, originGeo, destGeo] = await Promise.all([
      this.getDistance(origin, destination),
      this.geocode(origin),
      this.geocode(destination),
    ]);

    return {
      ...distanceResult,
      originCoords: { lat: originGeo.lat, lng: originGeo.lng },
      destinationCoords: { lat: destGeo.lat, lng: destGeo.lng },
    };
  }
}
