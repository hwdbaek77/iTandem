/**
 * constants.js
 * Shared enumerations and configuration constants for the iTandem location system.
 *
 * Covers geofence zones, location status tracking, notification types,
 * and Google Maps API configuration used across the LocationService.
 */

// ── Harvard-Westlake Campus Coordinates ─────────────────────────────────────
// Upper school campus — center point for the school geofence
const SCHOOL_COORDINATES = Object.freeze({
  lat: 34.1425,
  lng: -118.4314,
});

// ── User Location Status ────────────────────────────────────────────────────
// Tracks where a user currently is in their commute lifecycle
const LOCATION_STATUS = Object.freeze({
  AT_HOME: 'at_home',
  EN_ROUTE_TO_SCHOOL: 'en_route_to_school',
  AT_CARPOOL_PICKUP: 'at_carpool_pickup',
  AT_SCHOOL: 'at_school',
  LEFT_SCHOOL: 'left_school',
  EN_ROUTE_HOME: 'en_route_home',
  UNKNOWN: 'unknown',
});

// ── Location Update Source ──────────────────────────────────────────────────
const LOCATION_SOURCE = Object.freeze({
  MANUAL: 'manual',       // User tapped a status button
  GEOFENCE: 'geofence',   // Automatic geofence trigger (foreground polling)
  POLLING: 'polling',     // Periodic foreground location poll
});

// ── Geofence Zone Types ─────────────────────────────────────────────────────
const ZONE_TYPE = Object.freeze({
  HOME: 'home',
  SCHOOL: 'school',
  CARPOOL_PICKUP: 'carpool_pickup',
});

// ── Geofence Configuration ──────────────────────────────────────────────────
const GEOFENCE_CONFIG = Object.freeze({
  HOME_RADIUS_METERS: 150,            // Radius for "at home" detection
  SCHOOL_RADIUS_METERS: 200,          // Radius for "at school" detection
  CARPOOL_PICKUP_RADIUS_METERS: 100,  // Radius for carpool pickup point
  LEFT_SCHOOL_BUFFER_MINUTES: 30,     // Must be at school 30 min before "left school" fires
  ON_CAMPUS_STALE_MINUTES: 15,        // Location older than this = stale for "find ride home"
  POLLING_INTERVAL_MS: 30000,         // Foreground polling every 30 seconds
});

// ── Notification Types ──────────────────────────────────────────────────────
const LOCATION_NOTIFICATION_TYPE = Object.freeze({
  LEFT_HOME: 'left_home',                // "Sarah left house, ETA: 8 min"
  ARRIVED_CARPOOL: 'arrived_carpool',     // "Sarah arrived at pickup"
  ARRIVED_SCHOOL: 'arrived_school',       // "Sarah arrived at school"
  LEFT_SCHOOL: 'left_school',            // "Sarah left school"
  RIDE_HOME_REQUEST: 'ride_home_request', // "Alex is looking for a ride home"
  ETA_UPDATE: 'eta_update',              // Periodic ETA refresh
});

// ── Google Maps / Routes API Configuration ──────────────────────────────────
const MAPS_CONFIG = Object.freeze({
  ROUTES_API_URL: 'https://routes.googleapis.com/directions/v2:computeRoutes',
  GEOCODING_API_URL: 'https://maps.googleapis.com/maps/api/geocode/json',
  TRAVEL_MODE: 'DRIVE',
  ROUTE_OVERLAP_THRESHOLD: 0.40, // 40% shared route → onSameRoute = true
  ETA_CACHE_TTL_SECONDS: 300,    // Cache ETA results for 5 minutes
});

// ── Earth radius in meters (for geofence distance checks) ──────────────────
const EARTH_RADIUS_METERS = 6371000;

module.exports = {
  SCHOOL_COORDINATES,
  LOCATION_STATUS,
  LOCATION_SOURCE,
  ZONE_TYPE,
  GEOFENCE_CONFIG,
  LOCATION_NOTIFICATION_TYPE,
  MAPS_CONFIG,
  EARTH_RADIUS_METERS,
};
