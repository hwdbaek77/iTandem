/**
 * CarpoolProfile.js
 * Represents a user's carpool-specific profile data.
 *
 * This model stores the inputs required by the CarpoolCompatibilityEngine:
 *   - Home coordinates (for proximity scoring)
 *   - Vehicle information (for gas estimation and capacity)
 *   - Personal preferences (for personal compatibility scoring)
 *   - Grade level (for senior prioritization)
 *   - Whether the user can drive
 *
 * The general User model is handled by Max's auth service.  This class
 * captures only the carpool-specific data that other team members' services
 * don't cover.
 *
 * Schedule data comes from Nathan's scheduling system and is passed into the
 * compatibility engine at match-time — it is NOT stored here.
 *
 * Maps to user-level data referenced by the CarpoolGroups table (Review.md §II).
 */

const { GRADE_LEVELS } = require('../utils/constants');

class CarpoolProfile {
  /**
   * @param {Object} data
   * @param {string}  data.profileId         - UUID primary key
   * @param {string}  data.userId            - Foreign key → User (Max's auth service)
   * @param {Object}  data.homeCoordinates   - { lat: number, lng: number }
   * @param {string}  [data.homeAddress]     - Human-readable address (for display)
   * @param {string}  data.gradeLevel        - 'sophomore' | 'junior' | 'senior'
   * @param {boolean} [data.isDriver]        - Can this user drive? (has a car + license)
   * @param {string}  [data.vehicleMake]     - e.g. 'Toyota'
   * @param {string}  [data.vehicleModel]    - e.g. 'Camry'
   * @param {number}  [data.vehicleYear]     - e.g. 2022
   * @param {number}  [data.vehicleMpgCity]  - EPA city MPG
   * @param {number}  [data.vehicleMpgHighway] - EPA highway MPG
   * @param {number}  [data.vehicleCapacity] - Max passengers (excluding driver)
   * @param {string[]} [data.musicPreferences] - e.g. ['pop', 'hip-hop', 'indie']
   * @param {string}  [data.bio]             - Free-text bio (music, interests, etc.)
   * @param {boolean} [data.isActive]        - Is this profile actively seeking matches?
   * @param {Date}    [data.createdAt]
   * @param {Date}    [data.updatedAt]
   */
  constructor({
    profileId,
    userId,
    homeCoordinates = { lat: 0, lng: 0 },
    homeAddress = '',
    gradeLevel,
    isDriver = false,
    vehicleMake = '',
    vehicleModel = '',
    vehicleYear = null,
    vehicleMpgCity = null,
    vehicleMpgHighway = null,
    vehicleCapacity = 0,
    musicPreferences = [],
    bio = '',
    isActive = true,
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    if (!profileId) throw new Error('CarpoolProfile requires a profileId');
    if (!userId) throw new Error('CarpoolProfile requires a userId');
    if (!gradeLevel || !Object.values(GRADE_LEVELS).includes(gradeLevel)) {
      throw new Error(
        `Invalid grade level: ${gradeLevel}. Must be one of: ${Object.values(GRADE_LEVELS).join(', ')}`
      );
    }

    this.profileId = profileId;
    this.userId = userId;
    this.homeCoordinates = homeCoordinates;
    this.homeAddress = homeAddress;
    this.gradeLevel = gradeLevel;
    this.isDriver = isDriver;
    this.vehicleMake = vehicleMake;
    this.vehicleModel = vehicleModel;
    this.vehicleYear = vehicleYear;
    this.vehicleMpgCity = vehicleMpgCity;
    this.vehicleMpgHighway = vehicleMpgHighway;
    this.vehicleCapacity = vehicleCapacity;
    this.musicPreferences = musicPreferences;
    this.bio = bio;
    this.isActive = isActive;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Does this user have valid home coordinates? */
  hasValidLocation() {
    return (
      this.homeCoordinates &&
      typeof this.homeCoordinates.lat === 'number' &&
      typeof this.homeCoordinates.lng === 'number' &&
      this.homeCoordinates.lat !== 0 &&
      this.homeCoordinates.lng !== 0
    );
  }

  /** Does this user have vehicle info sufficient for gas estimation? */
  hasVehicleInfo() {
    return (
      this.vehicleMake !== '' &&
      this.vehicleModel !== '' &&
      this.vehicleMpgCity !== null &&
      this.vehicleMpgHighway !== null
    );
  }

  /** Can this user be a driver? (has car + can drive + has capacity) */
  canDrive() {
    return this.isDriver && this.vehicleCapacity > 0;
  }

  /**
   * Get combined MPG based on a city/highway split ratio.
   * @param  {number} [citySplit=0.55] - Fraction of driving in city (0–1)
   * @return {number|null} Combined MPG, or null if vehicle info is missing
   */
  getCombinedMpg(citySplit = 0.55) {
    if (this.vehicleMpgCity === null || this.vehicleMpgHighway === null) {
      return null;
    }
    const highwaySplit = 1 - citySplit;
    // Harmonic mean weighted by split (EPA method)
    return 1 / (citySplit / this.vehicleMpgCity + highwaySplit / this.vehicleMpgHighway);
  }

  /** Is this user a senior? (for prioritization) */
  isSenior() {
    return this.gradeLevel === GRADE_LEVELS.SENIOR;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Update home location (e.g. from Lauren's Location Service). */
  updateLocation(coordinates, address = '') {
    this.homeCoordinates = coordinates;
    if (address) this.homeAddress = address;
    this.updatedAt = new Date();
  }

  /** Update vehicle information. */
  updateVehicle({ make, model, year, mpgCity, mpgHighway, capacity }) {
    if (make !== undefined) this.vehicleMake = make;
    if (model !== undefined) this.vehicleModel = model;
    if (year !== undefined) this.vehicleYear = year;
    if (mpgCity !== undefined) this.vehicleMpgCity = mpgCity;
    if (mpgHighway !== undefined) this.vehicleMpgHighway = mpgHighway;
    if (capacity !== undefined) this.vehicleCapacity = capacity;
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
      homeCoordinates: this.homeCoordinates,
      homeAddress: this.homeAddress,
      gradeLevel: this.gradeLevel,
      isDriver: this.isDriver,
      vehicleMake: this.vehicleMake,
      vehicleModel: this.vehicleModel,
      vehicleYear: this.vehicleYear,
      vehicleMpgCity: this.vehicleMpgCity,
      vehicleMpgHighway: this.vehicleMpgHighway,
      vehicleCapacity: this.vehicleCapacity,
      musicPreferences: this.musicPreferences,
      bio: this.bio,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /** Reconstruct a CarpoolProfile from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new CarpoolProfile({
      profileId: data.profile_id || data.profileId,
      userId: data.user_id || data.userId,
      homeCoordinates: data.home_coordinates || data.homeCoordinates || { lat: 0, lng: 0 },
      homeAddress: data.home_address || data.homeAddress || '',
      gradeLevel: data.grade_level || data.gradeLevel,
      isDriver: data.is_driver ?? data.isDriver ?? false,
      vehicleMake: data.vehicle_make || data.vehicleMake || '',
      vehicleModel: data.vehicle_model || data.vehicleModel || '',
      vehicleYear: data.vehicle_year ?? data.vehicleYear ?? null,
      vehicleMpgCity: data.vehicle_mpg_city ?? data.vehicleMpgCity ?? null,
      vehicleMpgHighway: data.vehicle_mpg_highway ?? data.vehicleMpgHighway ?? null,
      vehicleCapacity: data.vehicle_capacity ?? data.vehicleCapacity ?? 0,
      musicPreferences: data.music_preferences || data.musicPreferences || [],
      bio: data.bio || '',
      isActive: data.is_active ?? data.isActive ?? true,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(data.updatedAt),
    });
  }
}

module.exports = CarpoolProfile;
