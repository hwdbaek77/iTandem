/**
 * constants.js
 * Shared enumerations and configuration constants for the iTandem carpool system.
 *
 * These enums mirror the database schema from Review.md §II (CarpoolGroups table)
 * and the business rules described in MVP.md, Design.md, and TechSpecification.md.
 *
 * Carpool matching factors (in order by weight, per MVP.md):
 *   1. Location (geographic proximity)
 *   2. Class schedule (arrival/departure alignment)
 *   3. Extracurricular commitments
 *   4. Senior priority
 *   5. Miscellaneous (music, bio, personal preferences)
 */

// ── Re-export shared constants from the rental module ───────────────────────
const { GRADE_LEVELS } = require('../../RentalService/utils/constants');

// ── Carpool Group Status Lifecycle ─────────────────────────────────────────
// pending → active → completed
//         ↘ cancelled
const CARPOOL_STATUS = Object.freeze({
  PENDING: 'pending',       // Group created, awaiting first member
  ACTIVE: 'active',         // Group is active with driver + passengers
  COMPLETED: 'completed',   // Carpool arrangement has ended normally
  CANCELLED: 'cancelled',   // Group was dissolved
});

// ── Carpool Join Request Status ────────────────────────────────────────────
// pending → accepted
//         ↘ rejected
//         ↘ withdrawn
const CARPOOL_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',       // Awaiting driver approval
  ACCEPTED: 'accepted',     // Driver approved the request
  REJECTED: 'rejected',     // Driver rejected the request
  WITHDRAWN: 'withdrawn',   // Requester withdrew before decision
});

// ── Days of the Week (for schedule alignment) ──────────────────────────────
const DAYS_OF_WEEK = Object.freeze({
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
});

const ALL_SCHOOL_DAYS = Object.freeze([
  DAYS_OF_WEEK.MONDAY,
  DAYS_OF_WEEK.TUESDAY,
  DAYS_OF_WEEK.WEDNESDAY,
  DAYS_OF_WEEK.THURSDAY,
  DAYS_OF_WEEK.FRIDAY,
]);

// ── Compatibility Algorithm Weights (Review.md §III) ───────────────────────
// Total score: 0–100 points
const COMPATIBILITY_WEIGHTS = Object.freeze({
  PROXIMITY_MAX: 35,      // Geographic proximity (haversine distance)
  SCHEDULE_MAX: 35,       // Schedule alignment (arrival/departure times)
  GRADE_LEVEL_MAX: 15,    // Senior priority
  PERSONAL_MAX: 15,       // Music, bio, personal preferences
  TOTAL_MAX: 100,
});

// ── Geographic Proximity Scoring Thresholds (Review.md §III) ───────────────
// Haversine distance between home coordinates
const PROXIMITY_THRESHOLDS = Object.freeze([
  { maxMiles: 1, points: 35 },    // < 1 mile  = 35 points
  { maxMiles: 3, points: 25 },    // 1–3 miles = 25 points
  { maxMiles: 5, points: 15 },    // 3–5 miles = 15 points
  { maxMiles: Infinity, points: 0 }, // > 5 miles = 0 points
]);

// ── Schedule Tolerance ─────────────────────────────────────────────────────
// Arrival/departure times within this window = full points (Review.md)
const SCHEDULE_TOLERANCE_MINUTES = 15;

// ── Grade Level Compatibility Scoring ──────────────────────────────────────
// Per MVP.md: "Give priority to seniors w/ carpools or just seniors in general"
const GRADE_LEVEL_SCORES = Object.freeze({
  BOTH_SENIORS: 15,            // Maximum priority
  ONE_SENIOR: 12,              // High priority — seniors need carpools most
  BOTH_JUNIORS: 8,             // Moderate
  JUNIOR_SOPHOMORE: 5,         // Lower
  BOTH_SOPHOMORES: 3,          // Minimal
});

// ── Carpool Configuration ──────────────────────────────────────────────────
const CARPOOL_CONFIG = Object.freeze({
  MAX_PASSENGERS: 4,           // Maximum passengers per carpool (excluding driver)
  MIN_COMPATIBILITY_SCORE: 30, // Minimum score to surface as a potential match
  ROUTE_OVERLAP_BONUS: 5,      // Bonus points if homes are on the same route
  MATCH_CACHE_TTL_SECONDS: 3600, // Cache match results for 1 hour (Redis TTL)
});

// ── Gas Estimation Configuration ───────────────────────────────────────────
// Per MVP.md: "Fetch average gas prices … then get combined city/highway
//              to calculate approximate gas price"
const GAS_ESTIMATION = Object.freeze({
  DEFAULT_GAS_PRICE_PER_GALLON: 4.50,  // Default LA-area gas price (USD)
  CITY_HIGHWAY_SPLIT: 0.55,            // 55% city / 45% highway (typical commute)
  ROUND_TRIP_MULTIPLIER: 2,            // Commute is round trip
  SCHOOL_DAYS_PER_WEEK: 5,
});

module.exports = {
  GRADE_LEVELS,
  CARPOOL_STATUS,
  CARPOOL_REQUEST_STATUS,
  DAYS_OF_WEEK,
  ALL_SCHOOL_DAYS,
  COMPATIBILITY_WEIGHTS,
  PROXIMITY_THRESHOLDS,
  SCHEDULE_TOLERANCE_MINUTES,
  GRADE_LEVEL_SCORES,
  CARPOOL_CONFIG,
  GAS_ESTIMATION,
};
