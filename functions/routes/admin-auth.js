const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { authenticate, requireAdmin } = require("../middleware/auth");

/**
 * Admin Authentication Routes
 * Separate from user authentication, uses the existing admin system
 * but provides admin-specific endpoints for the admin panel
 */

/**
 * POST /admin-auth/login
 * Admin login - verifies user is in admins collection
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "bad_request",
        message: "Email and password are required"
      });
    }

    // Verify email format
    if (!email.includes("@")) {
      return res.status(400).json({
        error: "bad_request",
        message: "Invalid email format"
      });
    }

    // Return instructions for Firebase Auth login
    // The frontend will handle Firebase authentication
    res.json({
      message: "Login via Firebase Authentication",
      instructions: "Use Firebase Auth signInWithEmailAndPassword, then verify admin status",
      adminCheckEndpoint: "/admin-auth/verify"
    });

  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      error: "internal_error",
      message: error.message
    });
  }
});

/**
 * POST /admin-auth/verify
 * Verify current user is an admin
 */
router.post("/verify", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = admin.firestore();

    // Check if user is in admins collection
    const adminDoc = await db.collection("admins").doc(userId).get();

    if (!adminDoc.exists) {
      return res.status(403).json({
        error: "forbidden",
        message: "User is not an admin"
      });
    }

    const adminData = adminDoc.data();

    if (!adminData.active) {
      return res.status(403).json({
        error: "forbidden",
        message: "Admin account is inactive"
      });
    }

    // Get user profile
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    res.json({
      message: "Admin verified successfully",
      admin: {
        userId,
        role: adminData.role,
        permissions: adminData.permissions || [],
        active: adminData.active,
        user: {
          name: userData?.name,
          email: userData?.email
        }
      }
    });

  } catch (error) {
    console.error("Admin verify error:", error);
    res.status(500).json({
      error: "internal_error",
      message: error.message
    });
  }
});

/**
 * GET /admin-auth/session
 * Check current admin session
 */
router.get("/session", authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.user.uid;
    const db = admin.firestore();

    const adminDoc = await db.collection("admins").doc(userId).get();
    const userDoc = await db.collection("users").doc(userId).get();

    const adminData = adminDoc.data();
    const userData = userDoc.data();

    res.json({
      admin: {
        userId,
        role: adminData.role,
        permissions: adminData.permissions || [],
        active: adminData.active,
        user: {
          name: userData?.name,
          email: userData?.email
        }
      }
    });

  } catch (error) {
    console.error("Admin session error:", error);
    res.status(500).json({
      error: "internal_error",
      message: error.message
    });
  }
});

module.exports = router;
