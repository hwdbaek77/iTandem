const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { authenticate, requireAdmin } = require("../middleware/auth");

/**
 * Comprehensive Admin Panel Backend
 * Full CRUD operations for all iTandem entities
 */

// ==================== USER MANAGEMENT ====================

/**
 * GET /admin/users
 * Search and list all users with filters
 */
router.get("/users", authenticate, requireAdmin, async (req, res) => {
  try {
    const { search, status, userType, limit = 50, offset = 0 } = req.query;
    const db = admin.firestore();
    
    let query = db.collection("users");
    
    // Apply filters
    if (status) {
      query = query.where("accountStatus", "==", status);
    }
    if (userType) {
      query = query.where("userType", "==", userType);
    }
    
    const snapshot = await query.limit(parseInt(limit)).offset(parseInt(offset)).get();
    
    let users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Client-side search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(u => 
        u.name?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        u.licensePlate?.toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      users,
      total: users.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error("Admin list users error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * GET /admin/users/:userId
 * Get complete user details including Canvas data
 */
router.get("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();
    
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "not_found", message: "User not found" });
    }
    
    // Get related data
    const [canvasData, apiKeys, adminStatus] = await Promise.all([
      db.collection("canvasData").doc(userId).get(),
      db.collection("apiKeys").where("userId", "==", userId).get(),
      db.collection("admins").doc(userId).get()
    ]);
    
    res.json({
      user: {
        id: userId,
        ...userDoc.data()
      },
      canvasData: canvasData.exists ? canvasData.data() : null,
      apiKeys: apiKeys.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      isAdmin: adminStatus.exists,
      adminRole: adminStatus.exists ? adminStatus.data().role : null
    });
    
  } catch (error) {
    console.error("Admin get user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * PUT /admin/users/:userId
 * Update any user field
 */
router.put("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const db = admin.firestore();
    
    // Remove sensitive fields that shouldn't be updated directly
    delete updates.id;
    delete updates.createdAt;
    
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.lastModifiedBy = req.user.uid;
    
    await db.collection("users").doc(userId).update(updates);
    
    const updatedDoc = await db.collection("users").doc(userId).get();
    
    res.json({
      message: "User updated successfully",
      user: {
        id: userId,
        ...updatedDoc.data()
      }
    });
    
  } catch (error) {
    console.error("Admin update user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * POST /admin/users/:userId/ban
 * Ban or temp ban a user
 */
router.post("/users/:userId/ban", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration, type = "permanent" } = req.body; // type: permanent | temporary
    const db = admin.firestore();
    
    const banData = {
      accountStatus: "banned",
      banReason: reason,
      banType: type,
      bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      bannedBy: req.user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (type === "temporary" && duration) {
      const unbanDate = new Date();
      unbanDate.setDate(unbanDate.getDate() + parseInt(duration));
      banData.unbanAt = admin.firestore.Timestamp.fromDate(unbanDate);
    }
    
    await db.collection("users").doc(userId).update(banData);
    
    // Disable Firebase Auth account
    await admin.auth().updateUser(userId, { disabled: true });
    
    res.json({
      message: `User ${type === "temporary" ? "temporarily" : "permanently"} banned`,
      banData
    });
    
  } catch (error) {
    console.error("Admin ban user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * POST /admin/users/:userId/unban
 * Unban a user
 */
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
      unbannedBy: req.user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Re-enable Firebase Auth account
    await admin.auth().updateUser(userId, { disabled: false });
    
    res.json({ message: "User unbanned successfully" });
    
  } catch (error) {
    console.error("Admin unban user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * DELETE /admin/users/:userId
 * Permanently delete a user and all related data
 */
router.delete("/users/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();
    
    // Delete user from Auth
    await admin.auth().deleteUser(userId);
    
    // Delete from Firestore
    const batch = db.batch();
    batch.delete(db.collection("users").doc(userId));
    batch.delete(db.collection("canvasData").doc(userId));
    
    // Delete API keys
    const apiKeys = await db.collection("apiKeys").where("userId", "==", userId).get();
    apiKeys.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    
    res.json({ message: "User permanently deleted" });
    
  } catch (error) {
    console.error("Admin delete user error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ==================== PARKING SPOT MANAGEMENT ====================

/**
 * GET /admin/spots
 * List all parking spots with filters
 */
router.get("/spots", authenticate, requireAdmin, async (req, res) => {
  try {
    const { lot, type, available } = req.query;
    const db = admin.firestore();
    
    let query = db.collection("parkingSpots");
    
    if (lot) query = query.where("lotName", "==", lot);
    if (type) query = query.where("spotType", "==", type);
    if (available !== undefined) query = query.where("available", "==", available === "true");
    
    const snapshot = await query.get();
    const spots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.json({ spots, total: spots.length });
    
  } catch (error) {
    console.error("Admin list spots error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * POST /admin/spots
 * Create new parking spot
 */
router.post("/spots", authenticate, requireAdmin, async (req, res) => {
  try {
    const spotData = {
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user.uid
    };
    
    const db = admin.firestore();
    const docRef = await db.collection("parkingSpots").add(spotData);
    const newDoc = await docRef.get();
    
    res.status(201).json({
      message: "Parking spot created",
      spot: { id: docRef.id, ...newDoc.data() }
    });
    
  } catch (error) {
    console.error("Admin create spot error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * PUT /admin/spots/:spotId
 * Update parking spot
 */
router.put("/spots/:spotId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { spotId } = req.params;
    const updates = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.uid
    };
    
    const db = admin.firestore();
    await db.collection("parkingSpots").doc(spotId).update(updates);
    
    const updatedDoc = await db.collection("parkingSpots").doc(spotId).get();
    
    res.json({
      message: "Spot updated",
      spot: { id: spotId, ...updatedDoc.data() }
    });
    
  } catch (error) {
    console.error("Admin update spot error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * DELETE /admin/spots/:spotId
 * Delete parking spot
 */
router.delete("/spots/:spotId", authenticate, requireAdmin, async (req, res) => {
  try {
    const { spotId } = req.params;
    const db = admin.firestore();
    
    await db.collection("parkingSpots").doc(spotId).delete();
    
    res.json({ message: "Spot deleted" });
    
  } catch (error) {
    console.error("Admin delete spot error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ==================== APP CONTROL ====================

/**
 * GET /admin/system/status
 * Get app system status
 */
router.get("/system/status", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const statusDoc = await db.collection("system").doc("status").get();
    
    const status = statusDoc.exists ? statusDoc.data() : {
      appActive: true,
      message: null
    };
    
    res.json(status);
    
  } catch (error) {
    console.error("Admin get system status error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * POST /admin/system/freeze
 * Freeze the app (disable user access)
 */
router.post("/system/freeze", authenticate, requireAdmin, async (req, res) => {
  try {
    const { message } = req.body;
    const db = admin.firestore();
    
    await db.collection("system").doc("status").set({
      appActive: false,
      frozenAt: admin.firestore.FieldValue.serverTimestamp(),
      frozenBy: req.user.uid,
      message: message || "App is temporarily unavailable for maintenance"
    });
    
    res.json({ message: "App frozen successfully" });
    
  } catch (error) {
    console.error("Admin freeze app error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

/**
 * POST /admin/system/unfreeze
 * Unfreeze the app (re-enable user access)
 */
router.post("/system/unfreeze", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    
    await db.collection("system").doc("status").set({
      appActive: true,
      unfrozenAt: admin.firestore.FieldValue.serverTimestamp(),
      unfrozenBy: req.user.uid,
      message: null
    });
    
    res.json({ message: "App unfrozen successfully" });
    
  } catch (error) {
    console.error("Admin unfreeze app error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

// ==================== ANALYTICS ====================

/**
 * GET /admin/analytics/overview
 * Get comprehensive analytics overview
 */
router.get("/analytics/overview", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    
    const [usersSnap, spotsSnap, tandemsSnap, carpoolsSnap, rentalsSnap, reportsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("parkingSpots").get(),
      db.collection("tandemPairings").get(),
      db.collection("carpools").get(),
      db.collection("rentals").get(),
      db.collection("reports").get()
    ]);
    
    // Calculate stats
    const users = usersSnap.docs.map(d => d.data());
    const tandems = tandemsSnap.docs.map(d => d.data());
    const rentals = rentalsSnap.docs.map(d => d.data());
    const reports = reportsSnap.docs.map(d => d.data());
    
    res.json({
      overview: {
        totalUsers: usersSnap.size,
        activeUsers: users.filter(u => u.accountStatus === "active").length,
        bannedUsers: users.filter(u => u.accountStatus === "banned").length,
        totalSpots: spotsSnap.size,
        activeTandems: tandems.filter(t => t.status === "active").length,
        activeCarpools: carpoolsSnap.size,
        totalRentals: rentalsSnap.size,
        activeRentals: rentals.filter(r => r.status === "confirmed").length,
        pendingReports: reports.filter(r => r.status === "pending").length,
        resolvedReports: reports.filter(r => r.status === "resolved").length
      },
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Admin analytics error:", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  }
});

module.exports = router;
