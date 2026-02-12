/**
 * constants.js
 * Shared enumerations and configuration constants for the iTandem tandem system.
 *
 * These enums mirror the database schema from Review.md §II (TandemPairings table)
 * and the business rules described in MVP.md, Design.md, and TechSpecification.md.
 *
 * Tandem compatibility factors (from Review.md §III):
 *   1. Schedule Overlap          (40 points max)
 *   2. Grade Level Compatibility (20 points max)
 *   3. Arrival Time Compatibility(20 points max)
 *   4. Extracurricular Alignment (10 points max)
 *   5. Lunch Habits              (10 points max)
 */

// ── Re-export shared constants from the rental module ───────────────────────
const { GRADE_LEVELS } = require('../../RentalService/utils/constants');

// ── Tandem Pairing Status Lifecycle ─────────────────────────────────────────
// pending → active → completed
//         ↘ cancelled
const TANDEM_STATUS = Object.freeze({
  PENDING: 'pending',       // Pairing created, awaiting partner acceptance
  ACTIVE: 'active',         // Both partners agreed, pairing is live
  COMPLETED: 'completed',   // Pairing ended normally (e.g. semester over)
  CANCELLED: 'cancelled',   // Pairing was dissolved by one or both partners
});

// ── Tandem Request Status ───────────────────────────────────────────────────
// pending → accepted
//         ↘ rejected
//         ↘ withdrawn
const TANDEM_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',       // Awaiting partner approval
  ACCEPTED: 'accepted',     // Partner approved the pairing request
  REJECTED: 'rejected',     // Partner rejected the request
  WITHDRAWN: 'withdrawn',   // Requester withdrew before decision
});

// ── Days of the Week (for schedule comparison) ──────────────────────────────
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

// ── Compatibility Algorithm Weights (Review.md §III — Tandem) ───────────────
// Total score: 0–100 points
const TANDEM_COMPATIBILITY_WEIGHTS = Object.freeze({
  SCHEDULE_OVERLAP_MAX: 40,       // Time overlap when both need the spot
  GRADE_LEVEL_MAX: 20,            // Grade-level pairing rules
  ARRIVAL_COMPATIBILITY_MAX: 20,  // One leaves before other arrives
  EXTRACURRICULAR_MAX: 10,        // Similar after-school end times
  LUNCH_HABITS_MAX: 10,           // Lunch off-campus conflict check
  TOTAL_MAX: 100,
});

// ── Schedule Overlap Scoring ────────────────────────────────────────────────
// Per Review.md: "Perfect score = 0 hours overlap per week"
//                "Deduct 5 points per overlapping hour"
const SCHEDULE_OVERLAP_CONFIG = Object.freeze({
  PENALTY_PER_OVERLAP_HOUR: 5,    // Points deducted per hour of overlap
});

// ── Grade Level Compatibility (Tandem-specific rules from MVP.md) ───────────
// "Seniors should be paired with other seniors"
// "Juniors can be paired with juniors + sophomores"
// "Sophomores can be paired with sophomores + juniors"
const TANDEM_GRADE_COMPATIBILITY = Object.freeze({
  SENIOR_SENIOR: 20,          // Full points — seniors pair with seniors
  JUNIOR_JUNIOR: 20,          // Full points — same grade
  SOPHOMORE_SOPHOMORE: 20,    // Full points — same grade
  JUNIOR_SOPHOMORE: 20,       // Full points — allowed cross-grade pair
  SOPHOMORE_JUNIOR: 20,       // Full points — allowed cross-grade pair
  INCOMPATIBLE: 0,            // Senior + Junior/Sophomore = not allowed
});

// ── Arrival/Departure Gap Scoring ───────────────────────────────────────────
// Per Review.md: "If User A leaves before User B arrives consistently = 20 points"
//                "Deduct points for negative gaps"
const ARRIVAL_GAP_CONFIG = Object.freeze({
  PERFECT_GAP_MINUTES: 15,          // Ideal gap: 15+ min between leave/arrive
  MAX_NEGATIVE_GAP_MINUTES: -30,    // Beyond this, 0 points
});

// ── Extracurricular Alignment Scoring ───────────────────────────────────────
// Per Review.md: "If both have similar end times = 10 points"
//                "Mixed schedules = 5 points"
const EXTRACURRICULAR_CONFIG = Object.freeze({
  SIMILAR_END_TIME_TOLERANCE_MINUTES: 30, // "Similar" = within 30 min
  SIMILAR_SCORE: 10,                       // Both similar end times
  MIXED_SCORE: 5,                          // One has extracurricular, other doesn't
  BOTH_NONE_SCORE: 10,                     // Neither has extracurriculars (no conflict)
});

// ── Lunch Habits Scoring ────────────────────────────────────────────────────
// Per Review.md: "Both leave for lunch = potential conflict, 0 points"
//                "Only one leaves = 10 points"
//                "Neither leaves = 10 points"
const LUNCH_SCORING = Object.freeze({
  BOTH_LEAVE: 0,          // Conflict — both need the spot at lunch
  ONE_LEAVES: 10,         // No conflict
  NEITHER_LEAVES: 10,     // No conflict
});

// ── Emote Types (TechSpecification.md — Tandem section) ─────────────────────
// "No custom chats" — only predefined emotes
const EMOTE_TYPES = Object.freeze({
  MOVE_YOUR_CAR: 'move_your_car',     // "Move your car!"
  LEAVING_SOON: 'leaving_soon',       // "Leaving soon!"
  ON_MY_WAY: 'on_my_way',             // "On my way!"
  RUNNING_LATE: 'running_late',       // "Running late"
  IM_HERE: 'im_here',                 // "I'm here" (from Design.md: "I'm here")
  THANK_YOU: 'thank_you',             // "Thank you!"
});

// ── Human-readable emote labels (for UI rendering) ──────────────────────────
const EMOTE_LABELS = Object.freeze({
  [EMOTE_TYPES.MOVE_YOUR_CAR]: 'Move your car!',
  [EMOTE_TYPES.LEAVING_SOON]: 'Leaving soon!',
  [EMOTE_TYPES.ON_MY_WAY]: 'On my way!',
  [EMOTE_TYPES.RUNNING_LATE]: 'Running late',
  [EMOTE_TYPES.IM_HERE]: "I'm here",
  [EMOTE_TYPES.THANK_YOU]: 'Thank you!',
});

// ── Anti-Spam Configuration (TechSpecification.md) ──────────────────────────
// "An algorithm to track spamming"
const SPAM_CONFIG = Object.freeze({
  MAX_EMOTES_PER_WINDOW: 5,           // Max emotes in the time window
  WINDOW_SECONDS: 60,                 // Rolling window duration (1 minute)
  COOLDOWN_SECONDS: 120,              // Cooldown after hitting limit (2 minutes)
});

// ── Tandem Service Configuration ────────────────────────────────────────────
const TANDEM_CONFIG = Object.freeze({
  MIN_COMPATIBILITY_SCORE: 30,        // Minimum score to surface as a match
  MATCH_CACHE_TTL_SECONDS: 3600,      // Cache match results for 1 hour
  MAX_ACTIVE_PAIRINGS_PER_USER: 1,    // A user can only have 1 active tandem
});

module.exports = {
  GRADE_LEVELS,
  TANDEM_STATUS,
  TANDEM_REQUEST_STATUS,
  DAYS_OF_WEEK,
  ALL_SCHOOL_DAYS,
  TANDEM_COMPATIBILITY_WEIGHTS,
  SCHEDULE_OVERLAP_CONFIG,
  TANDEM_GRADE_COMPATIBILITY,
  ARRIVAL_GAP_CONFIG,
  EXTRACURRICULAR_CONFIG,
  LUNCH_SCORING,
  EMOTE_TYPES,
  EMOTE_LABELS,
  SPAM_CONFIG,
  TANDEM_CONFIG,
};
