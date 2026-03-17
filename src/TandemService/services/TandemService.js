/**
 * TandemService.js
 * Main orchestrator for all tandem parking operations.
 *
 * This service coordinates the model classes (TandemProfile, TandemPairing,
 * TandemRequest, TandemMatch, Emote) and the TandemCompatibilityEngine to
 * implement the full tandem lifecycle described in MVP.md, Design.md,
 * TechSpecification.md, and Review.md.
 *
 * ── Capabilities ──────────────────────────────────────────────────────────
 *  1. Profile management      (register, update, deactivate tandem profiles)
 *  2. Match discovery          (find compatible tandem partners)
 *  3. Pairing request workflow (request → accept/reject → create pairing)
 *  4. Pairing lifecycle        (activate, complete, cancel)
 *  5. Emote communication      (send predefined emotes with anti-spam)
 *  6. Queries                  (my pairing, my matches, emote history)
 *
 * ── Secondary Features (Not Implemented) ──────────────────────────────────
 *  - Push notifications (will use Firebase Cloud Messaging)
 *  - Admin panel / report system
 *  - Photo verification
 *
 * ── Integration Points (other team members' services) ─────────────────────
 *  - User / Auth (Max)        → userId validation, account status checks
 *  - API Service (Max)        → REST endpoints call into this service
 *  - Schedule System (Nathan) → schedule data for compatibility scoring
 *  - Location Service (Lauren)→ not directly used (tandem is on-campus)
 *  - Rental Service (Daniel)  → cross-reference for tandem spot availability
 *  - App UI (Hannah)          → renders matches, pairing management, emotes
 *
 * ── Data Store Abstraction ────────────────────────────────────────────────
 * Like the Carpool and Rental services, this uses in-memory Maps so it can
 * run standalone for development and testing.  In production these would be
 * swapped for database queries (PostgreSQL via the API service).
 */

const TandemProfile = require('../models/TandemProfile');
const TandemPairing = require('../models/TandemPairing');
const TandemRequest = require('../models/TandemRequest');
const Emote = require('../models/Emote');
const TandemCompatibilityEngine = require('./TandemCompatibilityEngine');
const {
  TANDEM_STATUS,
  TANDEM_REQUEST_STATUS,
  TANDEM_CONFIG,
  EMOTE_TYPES,
} = require('../utils/constants');

// ── Tiny UUID helper (swap for `uuid` package in production) ──────────────
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

class TandemService {
  /**
   * @param {Object} [options]
   * @param {TandemCompatibilityEngine} [options.compatibilityEngine]
   * @param {Object}                    [options.rentalService] - RentalService instance for cross-checks
   */
  constructor(options = {}) {
    this.compatibilityEngine =
      options.compatibilityEngine || new TandemCompatibilityEngine();
    this.rentalService = options.rentalService || null;

    // ── In-memory data stores (replace with DB in production) ───────────
    /** @type {Map<string, TandemProfile>} profileId → TandemProfile */
    this.profiles = new Map();

    /** @type {Map<string, TandemProfile>} userId → TandemProfile (index) */
    this.profilesByUser = new Map();

    /** @type {Map<string, TandemPairing>} pairingId → TandemPairing */
    this.pairings = new Map();

    /** @type {Map<string, TandemRequest>} requestId → TandemRequest */
    this.requests = new Map();

    /** @type {Map<string, Emote[]>} pairingId → array of Emote objects */
    this.emotesByPairing = new Map();

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
   * Register a tandem profile for a user.
   * A user must have a profile before they can be matched or create pairings.
   *
   * @param  {Object} profileData - Constructor args for TandemProfile
   * @return {TandemProfile}
   */
  registerProfile(profileData) {
    if (this.profilesByUser.has(profileData.userId)) {
      throw new Error(`User ${profileData.userId} already has a tandem profile`);
    }

    const profile = new TandemProfile({
      profileId: generateId(),
      ...profileData,
    });

    this.profiles.set(profile.profileId, profile);
    this.profilesByUser.set(profile.userId, profile);
    return profile;
  }

  /**
   * Update a user's tandem profile.
   * @param  {string} userId
   * @param  {Object} updates - Fields to update
   * @return {TandemProfile}
   */
  updateProfile(userId, updates) {
    const profile = this._getProfileByUser(userId);

    if (updates.spotId !== undefined) {
      profile.assignSpot(updates.spotId);
    }
    if (updates.preferredLot !== undefined) {
      profile.preferredLot = updates.preferredLot;
      profile.updatedAt = new Date();
    }
    if (updates.vehicle) {
      profile.updateVehicle(updates.vehicle);
    }
    if (updates.bio !== undefined || updates.musicPreferences !== undefined) {
      profile.updatePreferences({
        bio: updates.bio,
        musicPreferences: updates.musicPreferences,
      });
    }

    return profile;
  }

  /**
   * Deactivate a user's tandem profile (stop appearing in matches).
   * @param  {string} userId
   * @return {TandemProfile}
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
   *   [{
   *     dayOfWeek: string,
   *     arrivalTime: string,       // 'HH:MM'
   *     departureTime: string,     // 'HH:MM'
   *     extracurricularEndTime: string|null,
   *     hasLunchOffCampus: boolean,
   *   }]
   */
  setUserSchedule(userId, scheduleEntries) {
    this.schedules.set(userId, scheduleEntries);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  2.  MATCH DISCOVERY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find compatible tandem partners for a user.
   * Corresponds to `GET /api/tandem/matches` (Review.md §V).
   *
   * @param  {string} userId
   * @return {TandemMatch[]} Sorted by score (highest first)
   */
  findMatches(userId) {
    const targetProfile = this._getProfileByUser(userId);
    const targetSchedule = this.schedules.get(userId) || [];

    // ── Validate user can use tandem ────────────────────────────────────
    // Check the user doesn't already have an active pairing
    const activePairing = this._getActivePairingForUser(userId);
    if (activePairing) {
      throw new Error(
        'You already have an active tandem pairing. ' +
        'End your current pairing before searching for new matches.'
      );
    }

    // ── Gather candidate profiles ───────────────────────────────────────
    const candidates = [...this.profiles.values()].filter((p) => {
      if (p.userId === userId) return false;          // Skip self
      if (!p.isActive) return false;                  // Skip inactive
      // Skip users who already have an active pairing
      if (this._getActivePairingForUser(p.userId)) return false;
      return true;
    });

    // ── Run the compatibility engine ────────────────────────────────────
    return this.compatibilityEngine.findMatches({
      targetProfile,
      targetSchedule,
      candidateProfiles: candidates,
      candidateSchedules: this.schedules,
    });
  }

  /**
   * Compute compatibility between two specific users.
   * Useful for checking match quality when a user views another's profile.
   *
   * @param  {string} userAId
   * @param  {string} userBId
   * @return {TandemMatch}
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
  //  3.  PAIRING REQUEST WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Request to pair with another user for tandem parking.
   * Corresponds to `POST /api/tandem/request` (Review.md §V).
   *
   * @param  {Object} params
   * @param  {string} params.requesterUserId  - User initiating the request
   * @param  {string} params.targetUserId     - User being asked to pair
   * @param  {string} [params.message]        - Optional note
   * @return {TandemRequest}
   */
  requestPairing({ requesterUserId, targetUserId, message = '' }) {
    // ── Validation ──────────────────────────────────────────────────────
    const requesterProfile = this._getProfileByUser(requesterUserId);
    const targetProfile = this._getProfileByUser(targetUserId);

    // Check grade compatibility
    if (!requesterProfile.isGradeCompatibleWith(targetProfile)) {
      throw new Error(
        `Grade levels are incompatible: ${requesterProfile.gradeLevel} cannot pair with ${targetProfile.gradeLevel}`
      );
    }

    // Check neither user has an active pairing
    if (this._getActivePairingForUser(requesterUserId)) {
      throw new Error('You already have an active tandem pairing');
    }
    if (this._getActivePairingForUser(targetUserId)) {
      throw new Error('The target user already has an active tandem pairing');
    }

    // Prevent duplicate pending requests
    for (const req of this.requests.values()) {
      if (
        req.requesterUserId === requesterUserId &&
        req.targetUserId === targetUserId &&
        req.isPending()
      ) {
        throw new Error('You already have a pending request to this user');
      }
    }

    // ── Compute compatibility score ──────────────────────────────────────
    const match = this.compatibilityEngine.computeMatch({
      profileA: requesterProfile,
      profileB: targetProfile,
      scheduleA: this.schedules.get(requesterUserId) || [],
      scheduleB: this.schedules.get(targetUserId) || [],
    });

    const request = new TandemRequest({
      requestId: generateId(),
      requesterUserId,
      targetUserId,
      message,
      compatibilityScore: match.overallScore,
    });

    this.requests.set(request.requestId, request);
    return request;
  }

  /**
   * Target user accepts a tandem pairing request.
   * Creates a TandemPairing and links both users.
   * Corresponds to `PUT /api/tandem/:pairingId/accept` (Review.md §V).
   *
   * @param  {string} requestId    - The request to accept
   * @param  {string} targetUserId - Must be the request's target (authorization)
   * @return {{ request: TandemRequest, pairing: TandemPairing }}
   */
  acceptRequest(requestId, targetUserId) {
    const request = this._getRequest(requestId);

    // Authorization: only the target can accept
    if (request.targetUserId !== targetUserId) {
      throw new Error('Only the target user can accept this request');
    }

    // Re-validate neither has gotten a pairing since the request was made
    if (this._getActivePairingForUser(request.requesterUserId)) {
      throw new Error('The requester already has an active tandem pairing');
    }
    if (this._getActivePairingForUser(request.targetUserId)) {
      throw new Error('You already have an active tandem pairing');
    }

    request.accept();

    // ── Create the TandemPairing ─────────────────────────────────────────
    // Determine spot: use whichever user has an assigned spot
    const requesterProfile = this.profilesByUser.get(request.requesterUserId);
    const targetProfile = this.profilesByUser.get(request.targetUserId);
    const spotId = requesterProfile?.spotId || targetProfile?.spotId || null;

    const pairing = new TandemPairing({
      pairingId: generateId(),
      spotId,
      user1Id: request.requesterUserId,
      user2Id: request.targetUserId,
      compatibilityScore: request.compatibilityScore || 0,
      status: TANDEM_STATUS.ACTIVE,
    });

    this.pairings.set(pairing.pairingId, pairing);

    // Cancel all other pending requests involving either user
    this._cancelConflictingRequests(request.requesterUserId, requestId);
    this._cancelConflictingRequests(request.targetUserId, requestId);

    return { request, pairing };
  }

  /**
   * Target user rejects a tandem pairing request.
   *
   * @param  {string} requestId
   * @param  {string} targetUserId
   * @return {TandemRequest}
   */
  rejectRequest(requestId, targetUserId) {
    const request = this._getRequest(requestId);

    if (request.targetUserId !== targetUserId) {
      throw new Error('Only the target user can reject this request');
    }

    request.reject();
    return request;
  }

  /**
   * Requester withdraws their pending request.
   *
   * @param  {string} requestId
   * @param  {string} requesterUserId
   * @return {TandemRequest}
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
  //  4.  PAIRING LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * End a tandem pairing (either partner can do this).
   * Corresponds to `DELETE /api/tandem/:pairingId` (Review.md §V).
   *
   * @param  {string} pairingId
   * @param  {string} userId - Must be a member of the pairing
   * @return {TandemPairing}
   */
  endPairing(pairingId, userId) {
    const pairing = this._getPairing(pairingId);

    if (!pairing.isMember(userId)) {
      throw new Error('Only members of this pairing can end it');
    }

    pairing.cancel();
    return pairing;
  }

  /**
   * Mark a pairing as completed (e.g. semester ended, admin action).
   *
   * @param  {string} pairingId
   * @return {TandemPairing}
   */
  completePairing(pairingId) {
    const pairing = this._getPairing(pairingId);
    pairing.complete();
    return pairing;
  }

  /**
   * Assign a tandem spot to an existing pairing.
   *
   * @param  {string} pairingId
   * @param  {string} spotId    - The tandem parking spot
   * @param  {string} userId    - Must be a member (authorization)
   * @return {TandemPairing}
   */
  assignSpotToPairing(pairingId, spotId, userId) {
    const pairing = this._getPairing(pairingId);

    if (!pairing.isMember(userId)) {
      throw new Error('Only members of this pairing can assign a spot');
    }

    pairing.assignSpot(spotId);
    return pairing;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  5.  EMOTE COMMUNICATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Send a predefined emote to the tandem partner.
   *
   * Per TechSpecification.md:
   *   - No custom chats, only predefined emotes
   *   - "Move your car!", "Leaving soon!", etc.
   *   - Anti-spam algorithm
   *
   * Per Review.md §IV: urgent emotes trigger push notifications.
   *
   * @param  {Object} params
   * @param  {string} params.pairingId     - The tandem pairing
   * @param  {string} params.senderUserId  - User sending the emote
   * @param  {string} params.emoteType     - One of EMOTE_TYPES
   * @return {Emote}
   */
  sendEmote({ pairingId, senderUserId, emoteType }) {
    const pairing = this._getPairing(pairingId);

    // ── Authorization ───────────────────────────────────────────────────
    if (!pairing.isMember(senderUserId)) {
      throw new Error('Only members of this pairing can send emotes');
    }
    if (!pairing.isActive()) {
      throw new Error('Can only send emotes in an active pairing');
    }

    // ── Spam check ──────────────────────────────────────────────────────
    const pairingEmotes = this.emotesByPairing.get(pairingId) || [];
    const senderEmotes = pairingEmotes.filter(
      (e) => e.senderUserId === senderUserId
    );

    const spamCheck = Emote.checkSpamStatus(senderEmotes);
    if (!spamCheck.allowed) {
      throw new Error(spamCheck.reason);
    }

    // ── Create and store the emote ──────────────────────────────────────
    const recipientUserId = pairing.getPartnerId(senderUserId);

    const emote = new Emote({
      emoteId: generateId(),
      pairingId,
      senderUserId,
      recipientUserId,
      emoteType,
    });

    if (!this.emotesByPairing.has(pairingId)) {
      this.emotesByPairing.set(pairingId, []);
    }
    this.emotesByPairing.get(pairingId).push(emote);

    return emote;
  }

  /**
   * Get emote history for a pairing.
   *
   * @param  {string} pairingId
   * @param  {string} userId   - Must be a member (authorization)
   * @param  {number} [limit]  - Max number of emotes to return
   * @return {Emote[]}
   */
  getEmoteHistory(pairingId, userId, limit = 50) {
    const pairing = this._getPairing(pairingId);

    if (!pairing.isMember(userId)) {
      throw new Error('Only members of this pairing can view emotes');
    }

    const emotes = this.emotesByPairing.get(pairingId) || [];

    // Return most recent first, limited
    return emotes.slice(-limit).reverse();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  6.  QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a user's tandem profile.
   * @param  {string} userId
   * @return {TandemProfile|null}
   */
  getProfile(userId) {
    return this.profilesByUser.get(userId) || null;
  }

  /**
   * Get a user's active tandem pairing (if any).
   * @param  {string} userId
   * @return {TandemPairing|null}
   */
  getActivePairing(userId) {
    return this._getActivePairingForUser(userId);
  }

  /**
   * Get all tandem pairings for a user (including completed/cancelled).
   * @param  {string} userId
   * @return {TandemPairing[]}
   */
  getMyPairings(userId) {
    return [...this.pairings.values()].filter((p) => p.isMember(userId));
  }

  /**
   * Get a specific pairing by ID.
   * @param  {string} pairingId
   * @return {TandemPairing}
   */
  getPairing(pairingId) {
    return this._getPairing(pairingId);
  }

  /**
   * Get detailed info about a tandem pairing including member profiles.
   * @param  {string} pairingId
   * @return {{ pairing: TandemPairing, user1: TandemProfile|null, user2: TandemProfile|null }}
   */
  getPairingDetails(pairingId) {
    const pairing = this._getPairing(pairingId);
    const user1 = this.profilesByUser.get(pairing.user1Id) || null;
    const user2 = this.profilesByUser.get(pairing.user2Id) || null;

    return { pairing, user1, user2 };
  }

  /**
   * Get all pending incoming requests for a user.
   * @param  {string} userId
   * @return {TandemRequest[]}
   */
  getIncomingRequests(userId) {
    return [...this.requests.values()].filter(
      (r) => r.targetUserId === userId && r.isPending()
    );
  }

  /**
   * Get all pending outgoing requests for a user.
   * @param  {string} userId
   * @return {TandemRequest[]}
   */
  getOutgoingRequests(userId) {
    return [...this.requests.values()].filter(
      (r) => r.requesterUserId === userId && r.isPending()
    );
  }

  /**
   * Get all active tandem pairings (for admin/analytics).
   * @return {TandemPairing[]}
   */
  getAllActivePairings() {
    return [...this.pairings.values()].filter((p) => p.isActive());
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get a user's tandem profile or throw.
   * @param  {string} userId
   * @return {TandemProfile}
   */
  _getProfileByUser(userId) {
    const profile = this.profilesByUser.get(userId);
    if (!profile) {
      throw new Error(`No tandem profile found for user ${userId}`);
    }
    return profile;
  }

  /**
   * Get a pairing by ID or throw.
   * @param  {string} pairingId
   * @return {TandemPairing}
   */
  _getPairing(pairingId) {
    const pairing = this.pairings.get(pairingId);
    if (!pairing) {
      throw new Error(`Tandem pairing ${pairingId} not found`);
    }
    return pairing;
  }

  /**
   * Get a request by ID or throw.
   * @param  {string} requestId
   * @return {TandemRequest}
   */
  _getRequest(requestId) {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Tandem request ${requestId} not found`);
    }
    return request;
  }

  /**
   * Find the active pairing for a user (if any).
   * Per TANDEM_CONFIG: only 1 active pairing per user.
   *
   * @param  {string} userId
   * @return {TandemPairing|null}
   */
  _getActivePairingForUser(userId) {
    for (const pairing of this.pairings.values()) {
      if (pairing.isMember(userId) && pairing.isOpen()) {
        return pairing;
      }
    }
    return null;
  }

  /**
   * Cancel all pending requests involving a user, except the specified one.
   * Called after a request is accepted to prevent double-pairing.
   *
   * @param {string} userId
   * @param {string} exceptRequestId - The accepted request (don't cancel it)
   */
  _cancelConflictingRequests(userId, exceptRequestId) {
    for (const request of this.requests.values()) {
      if (request.requestId === exceptRequestId) continue;
      if (!request.isPending()) continue;

      if (request.involvesUser(userId)) {
        request.withdraw();
      }
    }
  }
}

module.exports = TandemService;
