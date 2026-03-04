const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { authenticate, requireAdmin } = require("../middleware/auth");

/**
 * GET /users/me
 * Get current user's profile
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User profile not found",
      });
    }

    const userData = userDoc.data();

    // Don't send sensitive data
    delete userData.canvasAccessToken;
    delete userData.apiKey;

    res.json({
      user: userData,
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      error: "Failed to retrieve user profile",
    });
  }
});

/**
 * PUT /users/me
 * Update current user's profile
 */
router.put("/me", authenticate, async (req, res) => {
  try {
    const {
      name, phoneNumber, licensePlate, email,
      address, zipCode, commuteMethod,
      parkingSpot, hasSpot, doesTandem, doesCarpool,
      isListedForRent, rentDays,
    } = req.body;

    const db = admin.firestore();
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (name !== undefined) updateData.name = name;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (licensePlate !== undefined) updateData.licensePlate = licensePlate;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (zipCode !== undefined) updateData.zipCode = zipCode;
    if (commuteMethod !== undefined) updateData.commuteMethod = commuteMethod;
    if (parkingSpot !== undefined) updateData.parkingSpot = parkingSpot;
    if (hasSpot !== undefined) updateData.hasSpot = hasSpot;
    if (doesTandem !== undefined) updateData.doesTandem = doesTandem;
    if (doesCarpool !== undefined) updateData.doesCarpool = doesCarpool;
    if (isListedForRent !== undefined) updateData.isListedForRent = !!isListedForRent;
    if (rentDays !== undefined) updateData.rentDays = Array.isArray(rentDays) ? rentDays : [];

    // Update Firestore user doc
    await db.collection("users").doc(req.userId).update(updateData);

    // Sync user-owned spot listing to parkingSpots collection.
    // Each user who owns a spot gets a doc with id "user_{userId}".
    // It is only marked available when they list it for rent with at least one day.
    const spotDocId = `user_${req.userId}`;
    const shouldList = updateData.hasSpot && updateData.isListedForRent
      && Array.isArray(updateData.rentDays) && updateData.rentDays.length > 0;
    const spotRef = db.collection("parkingSpots").doc(spotDocId);
    const spotSnap = await spotRef.get();

    if (updateData.hasSpot === true || shouldList !== undefined) {
      const currentUserDoc = await db.collection("users").doc(req.userId).get();
      const userData = currentUserDoc.data();
      const effectiveHasSpot = updateData.hasSpot !== undefined ? updateData.hasSpot : userData.hasSpot;
      const effectiveListed = updateData.isListedForRent !== undefined ? updateData.isListedForRent : userData.isListedForRent;
      const effectiveDays = updateData.rentDays !== undefined ? updateData.rentDays : (userData.rentDays || []);
      const effectiveSpotNum = updateData.parkingSpot !== undefined ? updateData.parkingSpot : userData.parkingSpot;
      const isActive = effectiveHasSpot && effectiveListed && effectiveDays.length > 0;

      if (isActive && effectiveSpotNum) {
        const spotData = {
          lot: "Personal",
          number: effectiveSpotNum,
          type: "standard",
          isAvailable: true,
          ownerId: req.userId,
          currentRenterId: spotSnap.exists ? (spotSnap.data().currentRenterId || null) : null,
          rentDays: effectiveDays,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (spotSnap.exists) {
          await spotRef.update(spotData);
        } else {
          await spotRef.set({ ...spotData, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        }
      } else if (spotSnap.exists) {
        // Unlist — mark unavailable but keep the doc (preserves rental history)
        await spotRef.update({ isAvailable: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }

    // If email is being updated, also update Firebase Auth
    if (email) {
      await admin.auth().updateUser(req.userId, {
        email,
      });
    }

    // If name is being updated, also update Firebase Auth
    if (name) {
      await admin.auth().updateUser(req.userId, {
        displayName: name,
      });
    }

    // Get updated user data
    const userDoc = await db.collection("users").doc(req.userId).get();
    const userData = userDoc.data();

    delete userData.canvasAccessToken;
    delete userData.apiKey;

    res.json({
      message: "Profile updated successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({
      error: "Failed to update user profile",
      details: error.message,
    });
  }
});

/**
 * GET /users
 * List all users (admin only)
 */
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const { limit = 50, offset = 0, userType } = req.query;

    let query = db.collection("users");

    if (userType) {
      query = query.where("userType", "==", userType);
    }

    const usersSnapshot = await query
        .orderBy("createdAt", "desc")
        .limit(parseInt(limit))
        .offset(parseInt(offset))
        .get();

    const users = usersSnapshot.docs.map((doc) => {
      const data = doc.data();
      // Remove sensitive fields
      delete data.canvasAccessToken;
      delete data.apiKey;
      return data;
    });

    res.json({
      users,
      count: users.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({
      error: "Failed to retrieve users",
    });
  }
});

/**
 * GET /users/:userId
 * Get another user's public profile (for tandem/carpool matching)
 */
router.get("/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userData = userDoc.data();

    // Return only public information
    const publicProfile = {
      userID: userData.userID,
      name: userData.name,
      userType: userData.userType,
      // Don't include sensitive data like email, phone, license plate, tokens
    };

    res.json({
      user: publicProfile,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: "Failed to retrieve user",
    });
  }
});

/**
 * PUT /users/:userId/user-type
 * Change a user's type (admin only)
 * Prevents privilege escalation by requiring admin authentication
 */
router.put("/:userId/user-type", authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { userType } = req.body;

    // Validate userType
    const validUserTypes = ["STUDENT", "FACULTY", "STAFF", "ADMIN"];
    if (!userType || !validUserTypes.includes(userType)) {
      return res.status(400).json({
        error: `Invalid userType. Must be one of: ${validUserTypes.join(", ")}`,
      });
    }

    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Update user type
    await db.collection("users").doc(userId).update({
      userType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: "User type updated successfully",
      userId,
      userType,
    });
  } catch (error) {
    console.error("Update user type error:", error);
    res.status(500).json({
      error: "Failed to update user type",
      details: error.message,
    });
  }
});

/**
 * DELETE /users/:userId
 * Delete a user account (admin only or self)
 */
router.delete("/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = admin.firestore();

    // Check if user is deleting their own account or is an admin
    if (req.userId !== userId) {
      const userDoc = await db.collection("users").doc(req.userId).get();
      if (!userDoc.exists || userDoc.data().userType !== "ADMIN") {
        return res.status(403).json({
          error: "Forbidden - You can only delete your own account",
        });
      }
    }

    // Delete user from Firebase Auth
    await admin.auth().deleteUser(userId);

    // Delete user document from Firestore
    await db.collection("users").doc(userId).delete();

    // Delete associated Canvas data
    await db.collection("canvasData").doc(userId).delete();

    // Delete user's API keys
    const apiKeysSnapshot = await db.collection("apiKeys")
        .where("userId", "==", userId)
        .get();

    const batch = db.batch();
    apiKeysSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    res.json({
      message: "User account deleted successfully",
      userId,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      error: "Failed to delete user account",
      details: error.message,
    });
  }
});

module.exports = router;
