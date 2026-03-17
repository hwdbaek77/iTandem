/**
 * TandemProfile.js
 * Represents a user's tandem-specific profile data.
 *
 * This model stores the inputs required by the TandemCompatibilityEngine:
 *   - Grade level (for pairing rules: seniors w/ seniors, etc.)
 *   - Spot preference (lot, spot type)
 *   - Whether the user is actively seeking a tandem partner
 *
 * The general User model is handled by Max's auth service.  This class
 * captures only the tandem-specific data that other team members' services
 * don't cover.
 *
 * Schedule data comes from Nathan's scheduling system and is passed into the
 * compatibility engine at match-time — it is NOT stored here.
 *
 * Maps to user-level data referenced by the TandemPairings table (Review.md §II).
 */

const { GRADE_LEVELS } = require('../utils/constants');

class TandemProfile {
  /**
   * @param {Object} data
   * @param {string}  data.profileId          - UUID primary key
   * @param {string}  data.userId             - Foreign key → User (Max's auth service)
   * @param {string}  data.gradeLevel         - 'sophomore' | 'junior' | 'senior'
   * @param {string}  [data.spotId]           - Preferred/assigned tandem spot (FK → ParkingSpot)
   * @param {string}  [data.preferredLot]     - Preferred lot name (Taper, Coldwater, etc.)
   * @param {string}  [data.licensePlate]     - For security check-in (Design.md)
   * @param {string}  [data.vehicleSize]      - 'compact' | 'standard' | 'large'
   * @param {string}  [data.bio]              - Free-text bio (music, interests, etc.)
   * @param {string[]} [data.musicPreferences] - e.g. ['pop', 'hip-hop', 'indie']
   * @param {boolean} [data.isActive]         - Is this profile actively seeking a partner?
   * @param {Date}    [data.createdAt]
   * @param {Date}    [data.updatedAt]
   */
  constructor({
    profileId,
    userId,
    gradeLevel,
    spotId = null,
    preferredLot = null,
    licensePlate = null,
    vehicleSize = 'standard',
    bio = '',
    musicPreferences = [],
    isActive = true,
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    if (!profileId) throw new Error('TandemProfile requires a profileId');
    if (!userId) throw new Error('TandemProfile requires a userId');
    if (!gradeLevel || !Object.values(GRADE_LEVELS).includes(gradeLevel)) {
      throw new Error(
        `Invalid grade level: ${gradeLevel}. Must be one of: ${Object.values(GRADE_LEVELS).join(', ')}`
      );
    }

    this.profileId = profileId;
    this.userId = userId;
    this.gradeLevel = gradeLevel;
    this.spotId = spotId;
    this.preferredLot = preferredLot;
    this.licensePlate = licensePlate;
    this.vehicleSize = vehicleSize;
    this.bio = bio;
    this.musicPreferences = musicPreferences;
    this.isActive = isActive;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Is this user a senior? */
  isSenior() {
    return this.gradeLevel === GRADE_LEVELS.SENIOR;
  }

  /** Is this user a junior? */
  isJunior() {
    return this.gradeLevel === GRADE_LEVELS.JUNIOR;
  }

  /** Is this user a sophomore? */
  isSophomore() {
    return this.gradeLevel === GRADE_LEVELS.SOPHOMORE;
  }

  /** Does this user have an assigned spot? */
  hasSpot() {
    return this.spotId !== null;
  }

  /**
   * Check if this user's grade is compatible with another user's grade.
   * Per MVP.md:
   *   - Seniors should be paired with other seniors
   *   - Juniors can be paired with juniors + sophomores
   *   - Sophomores can be paired with sophomores + juniors
   *
   * @param  {TandemProfile} other
   * @return {boolean}
   */
  isGradeCompatibleWith(other) {
    const a = this.gradeLevel;
    const b = other.gradeLevel;

    // Seniors only with seniors
    if (a === GRADE_LEVELS.SENIOR || b === GRADE_LEVELS.SENIOR) {
      return a === GRADE_LEVELS.SENIOR && b === GRADE_LEVELS.SENIOR;
    }

    // Juniors and sophomores can pair with each other
    return true;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Assign a specific tandem spot to this user. */
  assignSpot(spotId) {
    this.spotId = spotId;
    this.updatedAt = new Date();
  }

  /** Update vehicle info (for compact spot checks). */
  updateVehicle({ licensePlate, vehicleSize }) {
    if (licensePlate !== undefined) this.licensePlate = licensePlate;
    if (vehicleSize !== undefined) this.vehicleSize = vehicleSize;
    this.updatedAt = new Date();
  }

  /** Update bio and music preferences. */
  updatePreferences({ bio, musicPreferences }) {
    if (bio !== undefined) this.bio = bio;
    if (musicPreferences !== undefined) this.musicPreferences = musicPreferences;
    this.updatedAt = new Date();
  }

  /** Deactivate this profile (stop appearing in matches). */
  deactivate() {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /** Reactivate this profile. */
  activate() {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      profileId: this.profileId,
      userId: this.userId,
      gradeLevel: this.gradeLevel,
      spotId: this.spotId,
      preferredLot: this.preferredLot,
      licensePlate: this.licensePlate,
      vehicleSize: this.vehicleSize,
      bio: this.bio,
      musicPreferences: this.musicPreferences,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /** Reconstruct a TandemProfile from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new TandemProfile({
      profileId: data.profile_id || data.profileId,
      userId: data.user_id || data.userId,
      gradeLevel: data.grade_level || data.gradeLevel,
      spotId: data.spot_id || data.spotId || null,
      preferredLot: data.preferred_lot || data.preferredLot || null,
      licensePlate: data.license_plate || data.licensePlate || null,
      vehicleSize: data.vehicle_size || data.vehicleSize || 'standard',
      bio: data.bio || '',
      musicPreferences: data.music_preferences || data.musicPreferences || [],
      isActive: data.is_active ?? data.isActive ?? true,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(data.updatedAt),
    });
  }
}

module.exports = TandemProfile;
