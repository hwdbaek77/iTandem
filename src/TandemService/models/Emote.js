/**
 * Emote.js
 * Represents a predefined chat emote message between tandem partners.
 *
 * Per TechSpecification.md (Tandem section):
 *   - Chat emotes only (no custom chats)
 *   - "Move your car!"
 *   - "Leaving soon!"
 *   - An algorithm to track spamming
 *
 * Per Design.md:
 *   - "I'm leaving" or "I'm here"
 *   - "There should also be a way for students to communicate within the app
 *      just in case anything happens"
 *
 * Per Review.md §IV (Notification Service):
 *   - "Partner sending 'Move your car!' emote" triggers a push notification
 *
 * This class is both a data model (stores the emote record) and provides
 * spam-tracking functionality.
 */

const { EMOTE_TYPES, EMOTE_LABELS, SPAM_CONFIG } = require('../utils/constants');

class Emote {
  /**
   * @param {Object} data
   * @param {string}  data.emoteId        - UUID primary key
   * @param {string}  data.pairingId      - Foreign key → TandemPairing
   * @param {string}  data.senderUserId   - User who sent the emote
   * @param {string}  data.recipientUserId - User who receives the emote
   * @param {string}  data.emoteType      - One of EMOTE_TYPES
   * @param {Date}    [data.createdAt]
   */
  constructor({
    emoteId,
    pairingId,
    senderUserId,
    recipientUserId,
    emoteType,
    createdAt = new Date(),
  }) {
    if (!emoteId) throw new Error('Emote requires an emoteId');
    if (!pairingId) throw new Error('Emote requires a pairingId');
    if (!senderUserId) throw new Error('Emote requires a senderUserId');
    if (!recipientUserId) throw new Error('Emote requires a recipientUserId');
    if (!Object.values(EMOTE_TYPES).includes(emoteType)) {
      throw new Error(
        `Invalid emote type: ${emoteType}. Must be one of: ${Object.values(EMOTE_TYPES).join(', ')}`
      );
    }

    this.emoteId = emoteId;
    this.pairingId = pairingId;
    this.senderUserId = senderUserId;
    this.recipientUserId = recipientUserId;
    this.emoteType = emoteType;
    this.createdAt = createdAt instanceof Date ? createdAt : new Date(createdAt);
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Get the human-readable label for this emote. */
  getLabel() {
    return EMOTE_LABELS[this.emoteType] || this.emoteType;
  }

  /** Is this an urgent emote that should trigger a push notification? */
  isUrgent() {
    return (
      this.emoteType === EMOTE_TYPES.MOVE_YOUR_CAR ||
      this.emoteType === EMOTE_TYPES.IM_HERE
    );
  }

  // ── Spam Detection (Static Utility) ─────────────────────────────────────

  /**
   * Check if a user is spamming emotes based on recent send history.
   *
   * Per TechSpecification.md: "An algorithm to track spamming"
   *
   * Algorithm:
   *   - Count emotes sent by this user in the last WINDOW_SECONDS
   *   - If count >= MAX_EMOTES_PER_WINDOW, user is rate-limited
   *   - After being rate-limited, user must wait COOLDOWN_SECONDS
   *
   * @param  {Emote[]} recentEmotes - All emotes from this sender (pre-filtered)
   * @param  {Date}    [now]        - Current time (for testing)
   * @return {{ allowed: boolean, reason: string, retryAfterSeconds: number|null }}
   */
  static checkSpamStatus(recentEmotes, now = new Date()) {
    const windowStart = new Date(
      now.getTime() - SPAM_CONFIG.WINDOW_SECONDS * 1000
    );

    // Count emotes within the rolling window
    const emotesInWindow = recentEmotes.filter(
      (e) => e.createdAt >= windowStart
    );

    if (emotesInWindow.length >= SPAM_CONFIG.MAX_EMOTES_PER_WINDOW) {
      // Find when the oldest emote in the window expires to calculate cooldown
      const oldestInWindow = emotesInWindow.reduce(
        (oldest, e) => (e.createdAt < oldest.createdAt ? e : oldest),
        emotesInWindow[0]
      );

      const cooldownEnd = new Date(
        oldestInWindow.createdAt.getTime() +
          (SPAM_CONFIG.WINDOW_SECONDS + SPAM_CONFIG.COOLDOWN_SECONDS) * 1000
      );

      const retryAfterSeconds = Math.max(
        0,
        Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000)
      );

      return {
        allowed: false,
        reason: `Rate limited: too many emotes sent. Try again in ${retryAfterSeconds} seconds.`,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      reason: 'OK',
      retryAfterSeconds: null,
    };
  }

  // ── Serialization ───────────────────────────────────────────────────────

  toJSON() {
    return {
      emoteId: this.emoteId,
      pairingId: this.pairingId,
      senderUserId: this.senderUserId,
      recipientUserId: this.recipientUserId,
      emoteType: this.emoteType,
      label: this.getLabel(),
      isUrgent: this.isUrgent(),
      createdAt: this.createdAt,
    };
  }

  /** Reconstruct an Emote from a plain object (e.g. DB row). */
  static fromJSON(data) {
    return new Emote({
      emoteId: data.emote_id || data.emoteId,
      pairingId: data.pairing_id || data.pairingId,
      senderUserId: data.sender_user_id || data.senderUserId,
      recipientUserId: data.recipient_user_id || data.recipientUserId,
      emoteType: data.emote_type || data.emoteType,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(data.createdAt),
    });
  }
}

module.exports = Emote;
