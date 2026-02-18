const admin = require("firebase-admin");

/**
 * Middleware to verify Firebase Authentication token
 * Checks for Bearer token in Authorization header
 */
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized - No token provided",
      });
    }

    const token = authHeader.split("Bearer ")[1];

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    req.userId = decodedToken.uid;

    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      error: "Unauthorized - Invalid token",
    });
  }
};

/**
 * Middleware to verify API key for mobile app access
 * Checks for API key in x-api-key header
 */
const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
      return res.status(401).json({
        error: "Unauthorized - No API key provided",
      });
    }

    const db = admin.firestore();

    // Query for the API key
    const apiKeySnapshot = await db.collection("apiKeys")
        .where("key", "==", apiKey)
        .where("active", "==", true)
        .limit(1)
        .get();

    if (apiKeySnapshot.empty) {
      return res.status(401).json({
        error: "Unauthorized - Invalid API key",
      });
    }

    const apiKeyDoc = apiKeySnapshot.docs[0];
    const apiKeyData = apiKeyDoc.data();

    // Check if key is expired
    if (apiKeyData.expiresAt && apiKeyData.expiresAt.toDate() < new Date()) {
      return res.status(401).json({
        error: "Unauthorized - API key expired",
      });
    }

    // Get user data
    const userDoc = await db.collection("users").doc(apiKeyData.userId).get();

    if (!userDoc.exists) {
      return res.status(401).json({
        error: "Unauthorized - User not found",
      });
    }

    req.user = userDoc.data();
    req.userId = apiKeyData.userId;
    req.apiKeyId = apiKeyDoc.id;

    // Update last used timestamp
    await apiKeyDoc.ref.update({
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    next();
  } catch (error) {
    console.error("API key verification error:", error);
    return res.status(401).json({
      error: "Unauthorized - API key verification failed",
    });
  }
};

/**
 * Middleware to check if user has admin permissions
 * Checks the admins collection for active admin status
 */
const requireAdmin = async (req, res, next) => {
  try {
    const db = admin.firestore();
    
    // Check if user exists in admins collection
    const adminDoc = await db.collection("admins").doc(req.userId).get();

    if (!adminDoc.exists) {
      return res.status(403).json({
        error: "Forbidden - Admin access required",
      });
    }

    const adminData = adminDoc.data();

    // Check if admin is active
    if (!adminData.active) {
      return res.status(403).json({
        error: "Forbidden - Admin account is inactive",
      });
    }

    // Attach admin info to request
    req.admin = adminData;
    req.adminRole = adminData.role;

    next();
  } catch (error) {
    console.error("Admin check error:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

/**
 * Middleware that accepts either Firebase token or API key
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers["x-api-key"];

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return verifyFirebaseToken(req, res, next);
  } else if (apiKey) {
    return verifyApiKey(req, res, next);
  } else {
    return res.status(401).json({
      error: "Unauthorized - No valid authentication method provided",
    });
  }
};

module.exports = {
  verifyFirebaseToken,
  verifyApiKey,
  requireAdmin,
  authenticate,
};
