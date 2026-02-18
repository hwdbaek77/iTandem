/**
 * CarpoolService.js
 * Main orchestrator for all carpool operations.
 *
 * This service coordinates the model classes (CarpoolProfile, CarpoolGroup,
 * CarpoolRequest, CarpoolMatch, GasEstimate) and the engines
 * (CarpoolCompatibilityEngine, GasEstimator) to implement the full
 * carpool lifecycle described in MVP.md, Design.md, and Review.md.
 *
 * ── Capabilities ──────────────────────────────────────────────────────────
 *  1. Profile management     (register, update, deactivate carpool profiles)
 *  2. Match discovery         (find compatible carpool partners)
 *  3. Group creation          (driver creates a carpool group)
 *  4. Join request workflow   (request → accept/reject → add to group)
 *  5. Group lifecycle         (activate, leave, disband, complete)
 *  6. Gas cost estimation     (per-trip and weekly cost breakdowns)
 *  7. Queries                 (my groups, my matches, group details)
 *
 * ── Secondary Features (Not Implemented) ──────────────────────────────────
 *  - Messaging/emotes (will be added later)
 *  - Report system (admin panel feature)
 *  - Photo verification (admin panel feature)
 *  - Vehicle API integration (secondary until more users)
 *
 * ── Integration Points (other team members' services) ─────────────────────
 *  - User / Auth (Max)        → userId validation, account status checks
 *  - API Service (Max)        → REST endpoints call into this service
 *  - Schedule System (Nathan) → schedule data for compatibility scoring
 *  - Location Service (Lauren)→ route distances, route overlap detection
 *  - Rental Service (Daniel)  → check if user is renting (can't carpool)
 *  - App UI (Hannah)          → renders matches, group management, gas info
 *
 * ── Data Store Abstraction ────────────────────────────────────────────────
 * Like the RentalService, this uses in-memory Maps so it can run standalone
 * for development and testing.  In production these would be swapped for
 * database queries (PostgreSQL via the API service).
 */

const CarpoolProfile = require('../models/CarpoolProfile');
const CarpoolGroup = require('../models/CarpoolGroup');
const CarpoolRequest = require('../models/CarpoolRequest');
const CarpoolCompatibilityEngine = require('./CarpoolCompatibilityEngine');
const GasEstimator = require('./GasEstimator');
const {
  CARPOOL_STATUS,
  CARPOOL_REQUEST_STATUS,
  CARPOOL_CONFIG,
} = require('../utils/constants');

// ── Tiny UUID helper (swap for `uuid` package in production) ──────────────
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

class CarpoolService {
  /**
   * @param {Object} [options]
   * @param {CarpoolCompatibilityEngine} [options.compatibilityEngine]
   * @param {GasEstimator}               [options.gasEstimator]
   * @param {Object}                     [options.rentalService] - RentalService instance for cross-checks
   */
  constructor(options = {}) {
    this.compatibilityEngine =
      options.compatibilityEngine || new CarpoolCompatibilityEngine();
    this.gasEstimator =
      options.gasEstimator || new GasEstimator();
    this.rentalService = options.rentalService || null;

    // ── In-memory data stores (replace with DB in production) ───────────
    /** @type {Map<string, CarpoolProfile>} profileId → CarpoolProfile */
    this.profiles = new Map();

    /** @type {Map<string, CarpoolProfile>} userId → CarpoolProfile (index) */
    this.profilesByUser = new Map();

    /** @type {Map<string, CarpoolGroup>} carpoolId → CarpoolGroup */
    this.groups = new Map();

    /** @type {Map<string, CarpoolRequest>} requestId → CarpoolRequest */
    this.requests = new Map();

    /**
     * Schedule data provided by Nathan's scheduling system.
     * In production this would be fetched on demand; here we cache it.
     * @type {Map<string, Object[]>} userId → array of schedule entries
     */
    this.schedules = new Map();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  1.  PROFILE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Register a carpool profile for a user.
   * A user must have a profile before they can be matched or join groups.
   *
   * @param  {Object} profileData - Constructor args for CarpoolProfile
   * @return {CarpoolProfile}
   */
  registerProfile(profileData) {
    if (this.profilesByUser.has(profileData.userId)) {
      throw new Error(`User ${profileData.userId} already has a carpool profile`);
    }

    const profile = new CarpoolProfile({
      profileId: generateId(),
      ...profileData,
    });

    this.profiles.set(profile.profileId, profile);
    this.profilesByUser.set(profile.userId, profile);
    return profile;
  }

  /**
   * Update a user's carpool profile.
   * @param  {string} userId
   * @param  {Object} updates - Fields to update
   * @return {CarpoolProfile}
   */
  updateProfile(userId, updates) {
    const profile = this._getProfileByUser(userId);

    if (updates.homeCoordinates) {
      profile.updateLocation(updates.homeCoordinates, updates.homeAddress);
    }
    if (updates.vehicle) {
      profile.updateVehicle(updates.vehicle);
    }
    if (updates.musicPreferences !== undefined) {
      profile.musicPreferences = updates.musicPreferences;
      profile.updatedAt = new Date();
    }
    if (updates.bio !== undefined) {
      profile.bio = updates.bio;
      profile.updatedAt = new Date();
    }
    if (updates.isDriver !== undefined) {
      profile.isDriver = updates.isDriver;
      profile.updatedAt = new Date();
    }

    return profile;
  }

  /**
   * Deactivate a user's carpool profile (stop appearing in matches).
   * @param  {string} userId
   * @return {CarpoolProfile}
   */
  deactivateProfile(userId) {
    const profile = this._getProfileByUser(userId);
    profile.deactivate();
    return profile;
  }

  /**
   * Provide schedule data for a user (from Nathan's scheduling system).
   * This data is used by the compatibility engine during matching.
   *
   * @param {string}   userId
   * @param {Object[]} scheduleEntries - Array of schedule entries:
   *   [{ dayOfWeek, arrivalTime, departureTime, extracurricularEndTime }]
   */
  setUserSchedule(userId, scheduleEntries) {
    this.schedules.set(userId, scheduleEntries);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  2.  MATCH DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find compatible carpool partners for a user.
   * Corresponds to `GET /api/carpool/matches` (Review.md §V).
   *
   * @param  {string} userId
   * @param  {Object} [options]
   * @param  {Set<string>} [options.routeOverlapUserIds] - From Lauren's Location Service
   * @param  {boolean}     [options.driversOnly]          - Only match with users who can drive
   * @return {CarpoolMatch[]} Sorted by score (highest first)
   */
  findMatches(userId, options = {}) {
    const targetProfile = this._getProfileByUser(userId);
    const targetSchedule = this.schedules.get(userId) || [];

    // ── Validate user can carpool ───────────────────────────────────────
    // Design.md: "If you're renting the spot then you shouldn't do the carpool"
    if (this.rentalService && this._isUserRentingSpot(userId)) {
      throw new Error(
        'You currently have an active spot rental. ' +
        'Users who rent a spot should not also carpool.'
      );
    }

    // ── Gather candidate profiles ───────────────────────────────────────
    let candidates = [...this.profiles.values()].filter((p) => {
      if (p.userId === userId) return false;     // Skip self
      if (!p.isActive) return false;              // Skip inactive
      if (!p.hasValidLocation()) return false;    // Need location
      return true;
    });

    // Optional: filter to drivers only
    if (options.driversOnly) {
      candidates = candidates.filter((p) => p.canDrive());
    }

    // ── Run the compatibility engine ────────────────────────────────────
    return this.compatibilityEngine.findMatches({
      targetProfile,
      targetSchedule,
      candidateProfiles: candidates,
      candidateSchedules: this.schedules,
      routeOverlapUserIds: options.routeOverlapUserIds || new Set(),
    });
  }

  /**
   * Compute compatibility between two specific users.
   * Useful for checking match quality when a user views another's profile.
   *
   * @param  {string} userAId
   * @param  {string} userBId
   * @return {CarpoolMatch}
   */
  getMatchBetween(userAId, userBId) {
    const profileA = this._getProfileByUser(userAId);
    const profileB = this._getProfileByUser(userBId);

    return this.compatibilityEngine.computeMatch({
      profileA,
      profileB,
      scheduleA: this.schedules.get(userAId) || [],
      scheduleB: this.schedules.get(userBId) || [],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  3.  GROUP CREATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Create a new carpool group (the creator becomes the driver).
   * Corresponds to `POST /api/carpool/create` (Review.md §V).
   *
   * @param  {Object} params
   * @param  {string} params.driverUserId - The user creating the group (must be a driver)
   * @param  {string} [params.name]       - Optional group name
   * @return {CarpoolGroup}
   */
  createGroup({ driverUserId, name = '' }) {
    const profile = this._getProfileByUser(driverUserId);

    // Validate the user can be a driver
    if (!profile.canDrive()) {
      throw new Error(
        'Cannot create a carpool group: your profile does not indicate ' +
        'you can drive (set isDriver=true and vehicleCapacity > 0)'
      );
    }

    // Check rental exclusion
    if (this.rentalService && this._isUserRentingSpot(driverUserId)) {
      throw new Error(
        'Cannot create a carpool group while you have an active spot rental'
      );
    }

    // Prevent creating multiple active groups as driver
    for (const group of this.groups.values()) {
      if (group.driverUserId === driverUserId && group.isOpen()) {
        throw new Error('You already have an active carpool group');
      }
    }

    const group = new CarpoolGroup({
      carpoolId: generateId(),
      driverUserId,
      name,
    });

    this.groups.set(group.carpoolId, group);
    return group;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  4.  JOIN REQUEST WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Request to join a carpool group.
   * Corresponds to `POST /api/carpool/:carpoolId/join` (Review.md §V).
   *
   * @param  {Object} params
   * @param  {string} params.carpoolId       - The group to join
   * @param  {string} params.requesterUserId - The user requesting to join
   * @param  {string} [params.message]       - Optional note to the driver
   * @return {CarpoolRequest}
   */
  requestToJoin({ carpoolId, requesterUserId, message = '' }) {
    const group = this._getGroup(carpoolId);

    // ── Validation ──────────────────────────────────────────────────────
    if (!group.isOpen()) {
      throw new Error('This carpool group is no longer accepting members');
    }
    if (group.isMember(requesterUserId)) {
      throw new Error('You are already a member of this carpool');
    }
    if (group.isFull()) {
      throw new Error('This carpool group is full');
    }

    // Check for rental exclusion
    if (this.rentalService && this._isUserRentingSpot(requesterUserId)) {
      throw new Error(
        'Cannot join a carpool while you have an active spot rental'
      );
    }

    // Prevent duplicate pending requests
    for (const req of this.requests.values()) {
      if (
        req.carpoolId === carpoolId &&
        req.requesterUserId === requesterUserId &&
        req.isPending()
      ) {
        throw new Error('You already have a pending request for this carpool');
      }
    }

    // ── Compute compatibility score with the group driver ───────────────
    const requesterProfile = this._getProfileByUser(requesterUserId);
    const driverProfile = this._getProfileByUser(group.driverUserId);
    const match = this.compatibilityEngine.computeMatch({
      profileA: requesterProfile,
      profileB: driverProfile,
      scheduleA: this.schedules.get(requesterUserId) || [],
      scheduleB: this.schedules.get(group.driverUserId) || [],
    });

    const request = new CarpoolRequest({
      requestId: generateId(),
      carpoolId,
      requesterUserId,
      message,
      compatibilityScore: match.overallScore,
    });

    this.requests.set(request.requestId, request);
    return request;
  }

  /**
   * Driver accepts a join request, adding the requester to the group.
   *
   * @param  {string} requestId  - The request to accept
   * @param  {string} driverUserId - Must be the group's driver (authorization)
   * @return {{ request: CarpoolRequest, group: CarpoolGroup }}
   */
  acceptRequest(requestId, driverUserId) {
    const request = this._getRequest(requestId);
    const group = this._getGroup(request.carpoolId);

    // Authorization: only the driver can accept
    if (group.driverUserId !== driverUserId) {
      throw new Error('Only the group driver can accept join requests');
    }

    request.accept();
    group.addPassenger(request.requesterUserId);

    // Recalculate group compatibility score (average across all member pairs)
    this._recalculateGroupScore(group);

    return { request, group };
  }

  /**
   * Driver rejects a join request.
   *
   * @param  {string} requestId
   * @param  {string} driverUserId
   * @return {CarpoolRequest}
   */
  rejectRequest(requestId, driverUserId) {
    const request = this._getRequest(requestId);
    const group = this._getGroup(request.carpoolId);

    if (group.driverUserId !== driverUserId) {
      throw new Error('Only the group driver can reject join requests');
    }

    request.reject();
    return request;
  }

  /**
   * Requester withdraws their pending request.
   *
   * @param  {string} requestId
   * @param  {string} requesterUserId
   * @return {CarpoolRequest}
   */
  withdrawRequest(requestId, requesterUserId) {
    const request = this._getRequest(requestId);

    if (request.requesterUserId !== requesterUserId) {
      throw new Error('Only the requester can withdraw their request');
    }

    request.withdraw();
    return request;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  5.  GROUP LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Activate a carpool group (driver confirms it's ready to go).
   *
   * @param  {string} carpoolId
   * @param  {string} driverUserId
   * @return {CarpoolGroup}
   */
  activateGroup(carpoolId, driverUserId) {
    const group = this._getGroup(carpoolId);

    if (group.driverUserId !== driverUserId) {
      throw new Error('Only the group driver can activate the carpool');
    }

    group.activate();
    return group;
  }

  /**
   * A passenger leaves a carpool group.
   * Corresponds to `DELETE /api/carpool/:carpoolId/leave` (Review.md §V).
   *
   * @param  {string} carpoolId
   * @param  {string} userId - The passenger leaving
   * @return {CarpoolGroup}
   */
  leaveGroup(carpoolId, userId) {
    const group = this._getGroup(carpoolId);

    if (group.driverUserId === userId) {
      throw new Error(
        'The driver cannot leave. Use disbandGroup() to cancel the entire carpool.'
      );
    }

    group.removePassenger(userId);

    // Recalculate group score after member leaves
    if (group.passengerUserIds.length > 0) {
      this._recalculateGroupScore(group);
    }

    return group;
  }

  /**
   * Driver disbands (cancels) the entire carpool group.
   *
   * @param  {string} carpoolId
   * @param  {string} driverUserId
   * @return {CarpoolGroup}
   */
  disbandGroup(carpoolId, driverUserId) {
    const group = this._getGroup(carpoolId);

    if (group.driverUserId !== driverUserId) {
      throw new Error('Only the group driver can disband the carpool');
    }

    group.cancel();

    // Cancel all pending requests for this group
    for (const request of this.requests.values()) {
      if (request.carpoolId === carpoolId && request.isPending()) {
        request.reject();
      }
    }

    return group;
  }

  /**
   * Mark a carpool group as completed (e.g. semester ended).
   *
   * @param  {string} carpoolId
   * @param  {string} driverUserId
   * @return {CarpoolGroup}
   */
  completeGroup(carpoolId, driverUserId) {
    const group = this._getGroup(carpoolId);

    if (group.driverUserId !== driverUserId) {
      throw new Error('Only the group driver can complete the carpool');
    }

    group.complete();
    return group;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  6.  GAS COST ESTIMATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Estimate gas cost for an existing carpool group.
   * Uses the driver's vehicle info and the distance from home to school.
   *
   * @param  {string} carpoolId
   * @param  {number} distanceMiles   - One-way distance (from Lauren's service)
   * @param  {Object} [options]
   * @param  {number} [options.gasPricePerGallon] - Override gas price
   * @return {GasEstimate}
   */
  estimateGasCost(carpoolId, distanceMiles, options = {}) {
    const group = this._getGroup(carpoolId);
    const driverProfile = this._getProfileByUser(group.driverUserId);

    return this.gasEstimator.estimate({
      driverProfile,
      distanceMiles,
      numPassengers: group.getMemberCount(),
      roundTrip: true,
      gasPricePerGallon: options.gasPricePerGallon,
      carpoolId,
    });
  }

  /**
   * Quick gas estimate without an existing group (e.g. match preview).
   *
   * @param  {string} driverUserId
   * @param  {number} distanceMiles
   * @param  {number} numPassengers
   * @param  {Object} [options]
   * @return {GasEstimate}
   */
  estimateGasCostForUser(driverUserId, distanceMiles, numPassengers, options = {}) {
    const driverProfile = this._getProfileByUser(driverUserId);

    return this.gasEstimator.estimate({
      driverProfile,
      distanceMiles,
      numPassengers,
      roundTrip: true,
      gasPricePerGallon: options.gasPricePerGallon,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  7.  QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a user's carpool profile.
   * @param  {string} userId
   * @return {CarpoolProfile|null}
   */
  getProfile(userId) {
    return this.profilesByUser.get(userId) || null;
  }

  /**
   * Get all carpool groups a user belongs to (as driver or passenger).
   * @param  {string} userId
   * @return {CarpoolGroup[]}
   */
  getMyGroups(userId) {
    return [...this.groups.values()].filter((g) => g.isMember(userId));
  }

  /**
   * Get all active carpool groups a user belongs to.
   * @param  {string} userId
   * @return {CarpoolGroup[]}
   */
  getMyActiveGroups(userId) {
    return [...this.groups.values()].filter(
      (g) => g.isMember(userId) && g.isOpen()
    );
  }

  /**
   * Get a specific carpool group by ID.
   * @param  {string} carpoolId
   * @return {CarpoolGroup}
   */
  getGroup(carpoolId) {
    return this._getGroup(carpoolId);
  }

  /**
   * Get all pending join requests for a carpool group.
   * Only the driver should call this.
   * @param  {string} carpoolId
   * @return {CarpoolRequest[]}
   */
  getPendingRequests(carpoolId) {
    return [...this.requests.values()].filter(
      (r) => r.carpoolId === carpoolId && r.isPending()
    );
  }

  /**
   * Get a user's pending outgoing requests.
   * @param  {string} userId
   * @return {CarpoolRequest[]}
   */
  getMyPendingRequests(userId) {
    return [...this.requests.values()].filter(
      (r) => r.requesterUserId === userId && r.isPending()
    );
  }

  /**
   * Get detailed info about a carpool group including member profiles.
   * @param  {string} carpoolId
   * @return {{ group: CarpoolGroup, driver: CarpoolProfile, passengers: CarpoolProfile[] }}
   */
  getGroupDetails(carpoolId) {
    const group = this._getGroup(carpoolId);
    const driver = this.profilesByUser.get(group.driverUserId) || null;
    const passengers = group.passengerUserIds
      .map((uid) => this.profilesByUser.get(uid))
      .filter(Boolean);

    return { group, driver, passengers };
  }

  /**
   * Get all open (pending/active) carpool groups.
   * Useful for browsing available carpools.
   * @return {CarpoolGroup[]}
   */
  getOpenGroups() {
    return [...this.groups.values()].filter((g) => g.isOpen() && !g.isFull());
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a user's carpool profile or throw.
   * @param  {string} userId
   * @return {CarpoolProfile}
   */
  _getProfileByUser(userId) {
    const profile = this.profilesByUser.get(userId);
    if (!profile) {
      throw new Error(`No carpool profile found for user ${userId}`);
    }
    return profile;
  }

  /**
   * Get a carpool group by ID or throw.
   * @param  {string} carpoolId
   * @return {CarpoolGroup}
   */
  _getGroup(carpoolId) {
    const group = this.groups.get(carpoolId);
    if (!group) {
      throw new Error(`Carpool group ${carpoolId} not found`);
    }
    return group;
  }

  /**
   * Get a request by ID or throw.
   * @param  {string} requestId
   * @return {CarpoolRequest}
   */
  _getRequest(requestId) {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Carpool request ${requestId} not found`);
    }
    return request;
  }

  /**
   * Recalculate a group's compatibility score as the average of all
   * pairwise scores between members.
   * @param {CarpoolGroup} group
   */
  _recalculateGroupScore(group) {
    const memberIds = group.getAllMemberIds();
    if (memberIds.length < 2) return;

    let totalScore = 0;
    let pairCount = 0;

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        const profileA = this.profilesByUser.get(memberIds[i]);
        const profileB = this.profilesByUser.get(memberIds[j]);
        if (!profileA || !profileB) continue;

        const match = this.compatibilityEngine.computeMatch({
          profileA,
          profileB,
          scheduleA: this.schedules.get(memberIds[i]) || [],
          scheduleB: this.schedules.get(memberIds[j]) || [],
        });

        totalScore += match.overallScore;
        pairCount++;
      }
    }

    const averageScore = pairCount > 0 ? totalScore / pairCount : 0;
    group.updateCompatibilityScore(averageScore);
  }

  /**
   * Check if a user currently has an active spot rental.
   * Per Design.md: "If you're renting the spot then you shouldn't do the carpool"
   *
   * @param  {string} userId
   * @return {boolean}
   */
  _isUserRentingSpot(userId) {
    if (!this.rentalService) return false;

    try {
      const rentals = this.rentalService.getMyRentals(userId);
      return rentals.length > 0;
    } catch {
      // If rental service isn't available, allow carpooling
      return false;
    }
  }
}

module.exports = CarpoolService;
