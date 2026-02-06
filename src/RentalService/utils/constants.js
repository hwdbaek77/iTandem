/**
 * constants.js
 * Shared enumerations and configuration constants for the iTandem rental system.
 *
 * These enums mirror the database schema from Review.md and the business rules
 * described in MVP.md and Design.md.
 */

// ── Parking Lots at Harvard-Westlake ────────────────────────────────────────
const LOT_NAMES = Object.freeze({
  TAPER: 'Taper',
  COLDWATER: 'Coldwater',
  HACIENDA: 'Hacienda',
  ST_MICHAEL: 'StMichael',
  HAMILTON: 'Hamilton',
});

// ── Spot Types ──────────────────────────────────────────────────────────────
const SPOT_TYPES = Object.freeze({
  SINGLE: 'single',
  TANDEM: 'tandem',
});

// ── Vehicle Sizes ───────────────────────────────────────────────────────────
const VEHICLE_SIZES = Object.freeze({
  COMPACT: 'compact',
  STANDARD: 'standard',
  LARGE: 'large',
});

// ── Ownership Types ─────────────────────────────────────────────────────────
const OWNERSHIP_TYPES = Object.freeze({
  PERMANENT: 'permanent', // School-assigned spot
  RENTED: 'rented',       // Spot rented through the platform
});

// ── Rental Status Lifecycle ─────────────────────────────────────────────────
// pending → confirmed → completed
//         ↘ cancelled
//         ↘ disputed → resolved
const RENTAL_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
});

// ── Transaction Status ──────────────────────────────────────────────────────
const TRANSACTION_STATUS = Object.freeze({
  PENDING: 'pending',
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  FAILED: 'failed',
});

// ── Penalty / Offense Types ─────────────────────────────────────────────────
const OFFENSE_TYPES = Object.freeze({
  LATE_CANCELLATION: 'late_cancellation', // Cancelled day-of
  SPOT_BLOCKING: 'spot_blocking',         // Blocked someone else's rented spot
  FALSE_REPORT: 'false_report',           // Filed a fraudulent report
});

// ── Report Types ────────────────────────────────────────────────────────────
const REPORT_TYPES = Object.freeze({
  BLOCKED_SPOT: 'blocked_spot',
  DAMAGE: 'damage',
  HARASSMENT: 'harassment',
  SCAM: 'scam',
});

// ── Report Status ───────────────────────────────────────────────────────────
const REPORT_STATUS = Object.freeze({
  PENDING: 'pending',
  INVESTIGATING: 'investigating',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
});

// ── Grade Levels ────────────────────────────────────────────────────────────
const GRADE_LEVELS = Object.freeze({
  SOPHOMORE: 'sophomore',
  JUNIOR: 'junior',
  SENIOR: 'senior',
});

// ── Account Status ──────────────────────────────────────────────────────────
const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
});

// ── Pricing Configuration ───────────────────────────────────────────────────
// All monetary values stored in cents to avoid floating-point issues.
const PRICING = Object.freeze({
  BASE_RATE_CENTS: 500,             // $5.00 base rate per rental
  DISTANCE_RATE_CENTS_PER_METER: 1, // +$0.01 per meter from campus
  MARKET_RATE_MULTIPLIER: 1.0,      // Tunable multiplier (1.0 = no adjustment)
  LATE_CANCEL_FINE_CENTS: 1000,     // $10.00 fine for day-of cancellation
  SPOT_BLOCKING_FINE_CENTS: 2500,   // $25.00 fine for blocking a rented spot
  PLATFORM_FEE_PERCENT: 5,          // 5% platform fee on transactions
});

// ── Cancellation Policy ─────────────────────────────────────────────────────
const CANCELLATION_POLICY = Object.freeze({
  FULL_REFUND_HOURS_BEFORE: 24, // Cancel ≥24 hrs before → full refund
  FINE_HOURS_BEFORE: 0,         // Cancel <24 hrs before → renter gets fined
});

module.exports = {
  LOT_NAMES,
  SPOT_TYPES,
  VEHICLE_SIZES,
  OWNERSHIP_TYPES,
  RENTAL_STATUS,
  TRANSACTION_STATUS,
  OFFENSE_TYPES,
  REPORT_TYPES,
  REPORT_STATUS,
  GRADE_LEVELS,
  ACCOUNT_STATUS,
  PRICING,
  CANCELLATION_POLICY,
};
