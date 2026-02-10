const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const crypto = require("crypto");
const { verifyFirebaseToken } = require("../middleware/auth");
const CanvasService = require("../services/canvasService");

/**
 * POST /auth/signup
 * Create a new user account with email/password
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, phoneNumber, licensePlate, userType } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Missing required fields: email, password, name",
      });
    }

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // Create user document in Firestore
    const db = admin.firestore();
    const userDoc = {
      userID: userRecord.uid,
      name,
      email,
      licensePlate: licensePlate || null,
      phoneNumber: phoneNumber || null,
      userType: userType || "STUDENT",
      permissions: [],
      canvasAccessToken: null,
      canvasDataLinked: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("users").doc(userRecord.uid).set(userDoc);

    // Generate custom token for immediate login
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    res.status(201).json({
      message: "User created successfully",
      userId: userRecord.uid,
      customToken,
      user: userDoc,
    });
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    res.status(500).json({
      error: "Failed to create user account",
      details: error.message,
    });
  }
});

/**
 * POST /auth/login
 * Verify user credentials (handled by Firebase client SDK)
 * This endpoint is for custom login flows if needed
 */
router.post("/login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Get user data from Firestore
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(userRecord.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User profile not found",
      });
    }

    res.json({
      message: "User found",
      userId: userRecord.uid,
      user: userDoc.data(),
    });
  } catch (error) {
    console.error("Login error:", error);

    if (error.code === "auth/user-not-found") {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.status(500).json({
      error: "Login failed",
      details: error.message,
    });
  }
});

/**
 * POST /auth/canvas-token
 * Store Canvas access token for the authenticated user
 * This allows the system to fetch Canvas data on behalf of the user
 */
router.post("/canvas-token", verifyFirebaseToken, async (req, res) => {
  try {
    const { canvasAccessToken } = req.body;

    if (!canvasAccessToken) {
      return res.status(400).json({
        error: "Canvas access token is required",
      });
    }

    // Verify the token works by fetching user profile
    const canvasService = new CanvasService(canvasAccessToken);
    let canvasProfile;

    try {
      canvasProfile = await canvasService.getUserProfile();
    } catch (error) {
      return res.status(400).json({
        error: "Invalid Canvas access token",
        details: "Unable to authenticate with Canvas API",
      });
    }

    // Fetch comprehensive Canvas data
    const canvasData = await canvasService.getComprehensiveUserData();

    const db = admin.firestore();

    // Store Canvas token in user document (encrypted in production)
    await db.collection("users").doc(req.userId).update({
      canvasAccessToken,
      canvasDataLinked: true,
      canvasUserId: canvasProfile.id,
      canvasUserName: canvasProfile.name,
      canvasEmail: canvasProfile.primary_email || canvasProfile.email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Store comprehensive Canvas data in separate collection
    await db.collection("canvasData").doc(req.userId).set({
      userId: req.userId,
      ...canvasData,
      tokenLastVerified: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: "Canvas access token stored successfully",
      canvasProfile: {
        id: canvasProfile.id,
        name: canvasProfile.name,
        email: canvasProfile.primary_email || canvasProfile.email,
        avatarUrl: canvasProfile.avatar_url,
      },
      dataFetched: {
        coursesCount: canvasData.courses?.length || 0,
        upcomingEventsCount: canvasData.calendar?.length || 0,
        assignmentsCount: canvasData.assignments?.length || 0,
      },
    });
  } catch (error) {
    console.error("Canvas token storage error:", error);
    res.status(500).json({
      error: "Failed to store Canvas access token",
      details: error.message,
    });
  }
});

/**
 * GET /auth/canvas-token
 * Check if user has linked Canvas account
 */
router.get("/canvas-token", verifyFirebaseToken, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userData = userDoc.data();

    res.json({
      canvasLinked: userData.canvasDataLinked || false,
      canvasUserId: userData.canvasUserId || null,
      canvasUserName: userData.canvasUserName || null,
    });
  } catch (error) {
    console.error("Canvas token check error:", error);
    res.status(500).json({
      error: "Failed to check Canvas token status",
    });
  }
});

/**
 * POST /auth/generate-api-key
 * Generate API key for mobile app access
 */
router.post("/generate-api-key", verifyFirebaseToken, async (req, res) => {
  try {
    const { name, expiresInDays } = req.body;

    // Generate secure random API key
    const apiKey = crypto.randomBytes(32).toString("hex");

    const db = admin.firestore();

    // Calculate expiration date if provided
    let expiresAt = null;
    if (expiresInDays) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);
      expiresAt = admin.firestore.Timestamp.fromDate(expirationDate);
    }

    // Store API key in Firestore
    const apiKeyDoc = {
      userId: req.userId,
      key: apiKey,
      name: name || "Mobile App Key",
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      lastUsedAt: null,
    };

    const docRef = await db.collection("apiKeys").add(apiKeyDoc);

    // Also update user document with API key reference
    await db.collection("users").doc(req.userId).update({
      apiKey,
      apiKeyId: docRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: "API key generated successfully",
      apiKey,
      apiKeyId: docRef.id,
      expiresAt: expiresAt ? expiresAt.toDate().toISOString() : null,
      warning: "Store this API key securely. It will not be shown again.",
    });
  } catch (error) {
    console.error("API key generation error:", error);
    res.status(500).json({
      error: "Failed to generate API key",
      details: error.message,
    });
  }
});

/**
 * GET /auth/api-keys
 * List all API keys for the authenticated user
 */
router.get("/api-keys", verifyFirebaseToken, async (req, res) => {
  try {
    const db = admin.firestore();
    const apiKeysSnapshot = await db.collection("apiKeys")
        .where("userId", "==", req.userId)
        .orderBy("createdAt", "desc")
        .get();

    const apiKeys = apiKeysSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        active: data.active,
        createdAt: data.createdAt?.toDate().toISOString(),
        expiresAt: data.expiresAt?.toDate().toISOString() || null,
        lastUsedAt: data.lastUsedAt?.toDate().toISOString() || null,
        // Don't return the actual key for security
        keyPreview: data.key ? `${data.key.substring(0, 8)}...` : null,
      };
    });

    res.json({
      apiKeys,
      count: apiKeys.length,
    });
  } catch (error) {
    console.error("API keys list error:", error);
    res.status(500).json({
      error: "Failed to retrieve API keys",
    });
  }
});

/**
 * DELETE /auth/api-keys/:keyId
 * Revoke an API key
 */
router.delete("/api-keys/:keyId", verifyFirebaseToken, async (req, res) => {
  try {
    const { keyId } = req.params;
    const db = admin.firestore();

    const apiKeyDoc = await db.collection("apiKeys").doc(keyId).get();

    if (!apiKeyDoc.exists) {
      return res.status(404).json({
        error: "API key not found",
      });
    }

    const apiKeyData = apiKeyDoc.data();

    // Verify the key belongs to the requesting user
    if (apiKeyData.userId !== req.userId) {
      return res.status(403).json({
        error: "Forbidden - This API key belongs to another user",
      });
    }

    // Soft delete by marking as inactive
    await apiKeyDoc.ref.update({
      active: false,
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: "API key revoked successfully",
      keyId,
    });
  } catch (error) {
    console.error("API key revocation error:", error);
    res.status(500).json({
      error: "Failed to revoke API key",
    });
  }
});

module.exports = router;
