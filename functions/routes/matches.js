/**
 * Match routes - tandem and carpool partner pairing.
 * Handles match requests, acceptance, and messaging between paired users.
 */

const express = require("express");
const admin = require("firebase-admin");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ── POST /matches/request ───────────────────────────────────────────────────

/**
 * Send a match request to another user.
 * Body: { targetUserId, type: "tandem" | "carpool" }
 */
router.post("/request", authenticate, async (req, res) => {
  try {
    const { targetUserId, type } = req.body;

    if (!targetUserId || !type) {
      return res.status(400).json({ error: "targetUserId and type are required" });
    }
    if (!["tandem", "carpool"].includes(type)) {
      return res.status(400).json({ error: "type must be 'tandem' or 'carpool'" });
    }
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: "Cannot match with yourself" });
    }

    const db = admin.firestore();

    // Check for existing pending/active match between these users
    const existing = await db.collection("matches")
      .where("type", "==", type)
      .where("status", "in", ["pending", "active"])
      .get();

    const duplicate = existing.docs.find((doc) => {
      const d = doc.data();
      return (
        (d.requesterId === req.userId && d.targetId === targetUserId) ||
        (d.requesterId === targetUserId && d.targetId === req.userId)
      );
    });

    if (duplicate) {
      const d = duplicate.data();
      if (d.status === "active") {
        return res.status(409).json({ error: "You are already matched with this user", matchId: duplicate.id });
      }
      // If other user already sent us a request, auto-accept
      if (d.requesterId === targetUserId && d.targetId === req.userId) {
        await duplicate.ref.update({
          status: "active",
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return res.json({ message: "Match accepted! Both users agreed.", matchId: duplicate.id, status: "active" });
      }
      return res.status(409).json({ error: "Request already sent", matchId: duplicate.id });
    }

    const matchDoc = {
      requesterId: req.userId,
      targetId: targetUserId,
      type,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("matches").add(matchDoc);

    res.status(201).json({ message: "Match request sent", matchId: ref.id, status: "pending" });
  } catch (error) {
    console.error("Match request error:", error);
    res.status(500).json({ error: "Failed to send match request" });
  }
});

// ── PUT /matches/:matchId/accept ────────────────────────────────────────────

/**
 * Accept a pending match request.
 */
router.put("/:matchId/accept", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection("matches").doc(req.params.matchId).get();

    if (!doc.exists) return res.status(404).json({ error: "Match not found" });

    const match = doc.data();
    if (match.targetId !== req.userId) {
      return res.status(403).json({ error: "Only the target user can accept this request" });
    }
    if (match.status !== "pending") {
      return res.status(400).json({ error: `Match is already ${match.status}` });
    }

    await doc.ref.update({
      status: "active",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Match accepted", matchId: doc.id });
  } catch (error) {
    console.error("Accept match error:", error);
    res.status(500).json({ error: "Failed to accept match" });
  }
});

// ── PUT /matches/:matchId/decline ───────────────────────────────────────────

/**
 * Decline or cancel a match (pending only).
 */
router.put("/:matchId/decline", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection("matches").doc(req.params.matchId).get();

    if (!doc.exists) return res.status(404).json({ error: "Match not found" });

    const match = doc.data();
    if (match.requesterId !== req.userId && match.targetId !== req.userId) {
      return res.status(403).json({ error: "Not your match" });
    }

    await doc.ref.update({
      status: "declined",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Match declined" });
  } catch (error) {
    console.error("Decline match error:", error);
    res.status(500).json({ error: "Failed to decline match" });
  }
});

// ── PUT /matches/:matchId/unmatch ───────────────────────────────────────────

/**
 * End an active match. Both users go back on the market.
 * Only works when match status is "active".
 */
router.put("/:matchId/unmatch", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection("matches").doc(req.params.matchId).get();

    if (!doc.exists) return res.status(404).json({ error: "Match not found" });

    const match = doc.data();
    if (match.requesterId !== req.userId && match.targetId !== req.userId) {
      return res.status(403).json({ error: "Not your match" });
    }
    if (match.status !== "active") {
      return res.status(400).json({ error: "Can only unmatch from an active match" });
    }

    await doc.ref.update({
      status: "ended",
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Match ended. You are back on the market." });
  } catch (error) {
    console.error("Unmatch error:", error);
    res.status(500).json({ error: "Failed to unmatch" });
  }
});

// ── GET /matches/me ─────────────────────────────────────────────────────────

/**
 * Get all matches for the current user (sent and received).
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();

    const [sentSnap, receivedSnap] = await Promise.all([
      db.collection("matches").where("requesterId", "==", req.userId).get(),
      db.collection("matches").where("targetId", "==", req.userId).get(),
    ]);

    const matches = [];
    const addMatch = (doc) => {
      const d = doc.data();
      matches.push({
        id: doc.id,
        ...d,
        direction: d.requesterId === req.userId ? "sent" : "received",
      });
    };

    sentSnap.forEach(addMatch);
    receivedSnap.forEach(addMatch);

    // Sort newest first
    matches.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    res.json({ matches });
  } catch (error) {
    console.error("Get matches error:", error);
    res.status(500).json({ error: "Failed to get matches" });
  }
});

// ── POST /matches/:matchId/message ──────────────────────────────────────────

/**
 * Send a message within a match. Both matched users can message.
 * Body: { text }
 */
router.post("/:matchId/message", authenticate, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Message text is required" });

    const db = admin.firestore();
    const matchDoc = await db.collection("matches").doc(req.params.matchId).get();

    if (!matchDoc.exists) return res.status(404).json({ error: "Match not found" });

    const match = matchDoc.data();
    if (match.requesterId !== req.userId && match.targetId !== req.userId) {
      return res.status(403).json({ error: "Not your match" });
    }
    if (match.status !== "active" && match.status !== "pending") {
      return res.status(400).json({ error: "Cannot message in a declined match" });
    }

    const msgRef = await db.collection("matches").doc(req.params.matchId)
      .collection("messages").add({
        senderId: req.userId,
        text: text.trim(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    res.status(201).json({ messageId: msgRef.id });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ── GET /matches/:matchId/messages ──────────────────────────────────────────

/**
 * Get messages for a match conversation.
 */
router.get("/:matchId/messages", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const matchDoc = await db.collection("matches").doc(req.params.matchId).get();

    if (!matchDoc.exists) return res.status(404).json({ error: "Match not found" });

    const match = matchDoc.data();
    if (match.requesterId !== req.userId && match.targetId !== req.userId) {
      return res.status(403).json({ error: "Not your match" });
    }

    const msgSnap = await db.collection("matches").doc(req.params.matchId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .limit(100)
      .get();

    const messages = [];
    msgSnap.forEach((doc) => messages.push({ id: doc.id, ...doc.data() }));

    res.json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

module.exports = router;
