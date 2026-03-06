const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { authenticate, requireAdmin } = require("../middleware/auth");

// ==================== USER MANAGEMENT ====================

/** GET /admin-panel/users — list / search users */
router.get("/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const { search, status, userType, limit = 50, offset = 0 } = req.query;
    const db = admin.firestore();

    let query = db.collection("users");
    if (status) query = query.where("accountStatus", "==", status);
    if (userType) query = query.where("userType", "==", userType);

    const snapshot = await query.limit(parseInt(limit)).offset(parseInt(offset)).get();

    let users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (search) {
      const s = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s) ||
          u.licensePlate?.toLowerCase().includes(s)
      );
    }

    res.json({ users, total: users.length, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error("Admin list users error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** GET /admin-panel/users/:userId — full user detail */
router.get("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "not_found", message: "User not found" });

    const [canvasData, apiKeys, adminStatus] = await Promise.all([
      db.collection("canvasData").doc(userId).get(),
      db.collection("apiKeys").where("userId", "==", userId).get(),
      db.collection("admins").doc(userId).get(),
    ]);

    res.json({
      user: { id: userId, ...userDoc.data() },
      canvasData: canvasData.exists ? canvasData.data() : null,
      apiKeys: apiKeys.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      isAdmin: adminStatus.exists,
      adminRole: adminStatus.exists ? adminStatus.data().role : null,
    });
  } catch (error) {
    console.error("Admin get user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** PUT /admin-panel/users/:userId — update user */
router.put("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = { ...req.body };
    const db = admin.firestore();

    delete updates.id;
    delete updates.createdAt;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.lastModifiedBy = req.userId;

    await db.collection("users").doc(userId).update(updates);
    const updatedDoc = await db.collection("users").doc(userId).get();

    res.json({ message: "User updated successfully", user: { id: userId, ...updatedDoc.data() } });
  } catch (error) {
    console.error("Admin update user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** POST /admin-panel/users/:userId/ban */
router.post("/users/:userId/ban", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration, type = "permanent" } = req.body;
    const db = admin.firestore();

    const banData = {
      accountStatus: "banned",
      banReason: reason,
      banType: type,
      bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      bannedBy: req.userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (type === "temporary" && duration) {
      const unbanDate = new Date();
      unbanDate.setDate(unbanDate.getDate() + parseInt(duration));
      banData.unbanAt = admin.firestore.Timestamp.fromDate(unbanDate);
    }

    await db.collection("users").doc(userId).update(banData);
    await admin.auth().updateUser(userId, { disabled: true });

    res.json({ message: `User ${type === "temporary" ? "temporarily" : "permanently"} banned`, banData });
  } catch (error) {
    console.error("Admin ban user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** POST /admin-panel/users/:userId/unban */
router.post("/users/:userId/unban", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();

    await db.collection("users").doc(userId).update({
      accountStatus: "active",
      banReason: admin.firestore.FieldValue.delete(),
      banType: admin.firestore.FieldValue.delete(),
      bannedAt: admin.firestore.FieldValue.delete(),
      bannedBy: admin.firestore.FieldValue.delete(),
      unbanAt: admin.firestore.FieldValue.delete(),
      unbannedAt: admin.firestore.FieldValue.serverTimestamp(),
      unbannedBy: req.userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.auth().updateUser(userId, { disabled: false });
    res.json({ message: "User unbanned successfully" });
  } catch (error) {
    console.error("Admin unban user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** DELETE /admin-panel/users/:userId — permanently delete user + all related data */
router.delete("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();

    // Release any claimed parking spot
    const userSnap = await db.collection("users").doc(userId).get();
    if (userSnap.exists) {
      const claimedSpotId = userSnap.data().claimedSpotId;
      if (claimedSpotId) {
        const spotRef = db.collection("parkingSpots").doc(claimedSpotId);
        const spotSnap = await spotRef.get();
        if (spotSnap.exists && spotSnap.data().ownerId === userId) {
          await spotRef.update({ ownerId: null, isAvailable: true, rentDays: [] });
        }
      }
    }

    // End any active/pending matches
    const matchesAsRequester = await db.collection("matches").where("requesterId", "==", userId).get();
    const matchesAsTarget = await db.collection("matches").where("targetId", "==", userId).get();
    const allMatchDocs = [...matchesAsRequester.docs, ...matchesAsTarget.docs];
    for (const doc of allMatchDocs) {
      if (["pending", "active"].includes(doc.data().status)) {
        await doc.ref.update({ status: "ended", endedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }

    // Delete user doc, canvas data, schedule, api keys
    const batch = db.batch();
    batch.delete(db.collection("users").doc(userId));
    batch.delete(db.collection("canvasData").doc(userId));

    const scheduleSnap = await db.collection("schedules").where("userId", "==", userId).limit(1).get();
    scheduleSnap.docs.forEach((d) => batch.delete(d.ref));

    const apiKeys = await db.collection("apiKeys").where("userId", "==", userId).get();
    apiKeys.docs.forEach((d) => batch.delete(d.ref));

    const adminDoc = await db.collection("admins").doc(userId).get();
    if (adminDoc.exists) batch.delete(adminDoc.ref);

    await batch.commit();

    // Delete from Firebase Auth last
    await admin.auth().deleteUser(userId);

    res.json({ message: "User permanently deleted" });
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ==================== MATCHES (TANDEMS & CARPOOLS) ====================

/** GET /admin-panel/matches — list all matches, optional ?type=tandem|carpool&status=active */
router.get("/matches", authenticate, requireAdmin, async (req, res) => {
  try {
    const { type, status } = req.query;
    const db = admin.firestore();

    let query = db.collection("matches");
    if (type) query = query.where("type", "==", type);
    if (status) query = query.where("status", "==", status);

    const snap = await query.get();
    const matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Batch-resolve user names
    const userIds = new Set();
    matches.forEach((m) => { userIds.add(m.requesterId); userIds.add(m.targetId); });
    const nameMap = {};
    const idArr = [...userIds].filter(Boolean);
    const chunks = [];
    while (idArr.length) chunks.push(idArr.splice(0, 10));
    for (const chunk of chunks) {
      const snaps = await Promise.all(chunk.map((id) => db.collection("users").doc(id).get()));
      snaps.forEach((s) => { if (s.exists) nameMap[s.id] = s.data().name || s.data().email; });
    }

    const enriched = matches.map((m) => ({
      ...m,
      requesterName: nameMap[m.requesterId] || m.requesterId,
      targetName: nameMap[m.targetId] || m.targetId,
    }));

    res.json({ matches: enriched, total: enriched.length });
  } catch (error) {
    console.error("Admin list matches error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** PUT /admin-panel/matches/:matchId/end — force-end a match */
router.put("/matches/:matchId/end", authenticate, requireAdmin, async (req, res) => {
  try {
    const { matchId } = req.params;
    const db = admin.firestore();
    await db.collection("matches").doc(matchId).update({
      status: "ended",
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      endedBy: req.userId,
    });
    res.json({ message: "Match ended by admin" });
  } catch (error) {
    console.error("Admin end match error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ==================== RENTALS ====================

/** GET /admin-panel/rentals — list all rentals */
router.get("/rentals", authenticate, requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const db = admin.firestore();

    let query = db.collection("rentals");
    if (status) query = query.where("status", "==", status);

    const snap = await query.get();
    const rentals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Resolve renter names
    const renterIds = new Set(rentals.map((r) => r.renterId).filter(Boolean));
    const nameMap = {};
    for (const id of renterIds) {
      const u = await db.collection("users").doc(id).get();
      if (u.exists) nameMap[id] = u.data().name || u.data().email;
    }

    const enriched = rentals.map((r) => ({
      ...r,
      renterName: nameMap[r.renterId] || r.renterId,
    }));

    res.json({ rentals: enriched, total: enriched.length });
  } catch (error) {
    console.error("Admin list rentals error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** PUT /admin-panel/rentals/:rentalId/cancel — admin-cancel a rental */
router.put("/rentals/:rentalId/cancel", authenticate, requireAdmin, async (req, res) => {
  try {
    const { rentalId } = req.params;
    const db = admin.firestore();
    await db.collection("rentals").doc(rentalId).update({
      status: "cancelled",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelledBy: req.userId,
    });
    res.json({ message: "Rental cancelled by admin" });
  } catch (error) {
    console.error("Admin cancel rental error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ==================== PARKING SPOT MANAGEMENT ====================

/** GET /admin-panel/spots — list all parking spots (uses correct field names) */
router.get("/spots", authenticate, requireAdmin, async (req, res) => {
  try {
    const { lot, type, available } = req.query;
    const db = admin.firestore();

    let query = db.collection("parkingSpots");
    if (lot) query = query.where("lot", "==", lot);
    if (type) query = query.where("type", "==", type);
    if (available !== undefined) query = query.where("isAvailable", "==", available === "true");

    const snapshot = await query.get();
    const spots = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    res.json({ spots, total: spots.length });
  } catch (error) {
    console.error("Admin list spots error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** POST /admin-panel/spots — create parking spot */
router.post("/spots", authenticate, requireAdmin, async (req, res) => {
  try {
    const spotData = {
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.userId,
    };
    const db = admin.firestore();
    const docRef = await db.collection("parkingSpots").add(spotData);
    const newDoc = await docRef.get();
    res.status(201).json({ message: "Parking spot created", spot: { id: docRef.id, ...newDoc.data() } });
  } catch (error) {
    console.error("Admin create spot error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** PUT /admin-panel/spots/:spotId — update parking spot */
router.put("/spots/:spotId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { spotId } = req.params;
    const updates = { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: req.userId };
    const db = admin.firestore();
    await db.collection("parkingSpots").doc(spotId).update(updates);
    const updatedDoc = await db.collection("parkingSpots").doc(spotId).get();
    res.json({ message: "Spot updated", spot: { id: spotId, ...updatedDoc.data() } });
  } catch (error) {
    console.error("Admin update spot error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/** DELETE /admin-panel/spots/:spotId */
router.delete("/spots/:spotId", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection("parkingSpots").doc(req.params.spotId).delete();
    res.json({ message: "Spot deleted" });
  } catch (error) {
    console.error("Admin delete spot error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ==================== APP CONTROL ====================

router.get("/system/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const statusDoc = await db.collection("system").doc("status").get();
    res.json(statusDoc.exists ? statusDoc.data() : { appActive: true, message: null });
  } catch (error) {
    console.error("Admin get system status error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

router.post("/system/freeze", authenticate, requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const db = admin.firestore();
    await db.collection("system").doc("status").set({
      appActive: false,
      frozenAt: admin.firestore.FieldValue.serverTimestamp(),
      frozenBy: req.userId,
      message: message || "App is temporarily unavailable for maintenance",
    });
    res.json({ message: "App frozen successfully" });
  } catch (error) {
    console.error("Admin freeze app error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

router.post("/system/unfreeze", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    await db.collection("system").doc("status").set({
      appActive: true,
      unfrozenAt: admin.firestore.FieldValue.serverTimestamp(),
      unfrozenBy: req.userId,
      message: null,
    });
    res.json({ message: "App unfrozen successfully" });
  } catch (error) {
    console.error("Admin unfreeze app error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ==================== ANALYTICS ====================

/** GET /admin-panel/analytics/overview — reads from actual collections */
router.get("/analytics/overview", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();

    const [usersSnap, spotsSnap, matchesSnap, rentalsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("parkingSpots").get(),
      db.collection("matches").get(),
      db.collection("rentals").get(),
    ]);

    const users = usersSnap.docs.map((d) => d.data());
    const matches = matchesSnap.docs.map((d) => d.data());
    const rentals = rentalsSnap.docs.map((d) => d.data());
    const spots = spotsSnap.docs.map((d) => d.data());

    res.json({
      overview: {
        totalUsers: usersSnap.size,
        activeUsers: users.filter((u) => u.accountStatus !== "banned").length,
        bannedUsers: users.filter((u) => u.accountStatus === "banned").length,
        totalSpots: spotsSnap.size,
        availableSpots: spots.filter((s) => s.isAvailable).length,
        claimedSpots: spots.filter((s) => !!s.ownerId).length,
        activeTandems: matches.filter((m) => m.type === "tandem" && m.status === "active").length,
        pendingTandems: matches.filter((m) => m.type === "tandem" && m.status === "pending").length,
        activeCarpools: matches.filter((m) => m.type === "carpool" && m.status === "active").length,
        pendingCarpools: matches.filter((m) => m.type === "carpool" && m.status === "pending").length,
        totalRentals: rentalsSnap.size,
        activeRentals: rentals.filter((r) => r.status === "active").length,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

module.exports = router;
