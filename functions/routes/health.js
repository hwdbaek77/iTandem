const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const axios = require("axios");

/**
 * GET /health
 * Basic health check endpoint
 */
router.get("/", async (req, res) => {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: "iTandem API",
      version: "1.0.0",
    };

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

/**
 * GET /health/detailed
 * Detailed health check including database and external services
 */
router.get("/detailed", async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    service: "iTandem API",
    version: "1.0.0",
    uptime: process.uptime(),
    checks: {},
  };

  let overallStatus = "healthy";

  // Check Firestore connection
  try {
    const db = admin.firestore();
    const testDoc = await db.collection("_health").doc("test").get();
    checks.checks.firestore = {
      status: "healthy",
      message: "Connected to Firestore",
    };
  } catch (error) {
    checks.checks.firestore = {
      status: "unhealthy",
      error: error.message,
    };
    overallStatus = "unhealthy";
  }

  // Check Firebase Auth
  try {
    await admin.auth().listUsers(1);
    checks.checks.firebaseAuth = {
      status: "healthy",
      message: "Firebase Authentication is operational",
    };
  } catch (error) {
    checks.checks.firebaseAuth = {
      status: "unhealthy",
      error: error.message,
    };
    overallStatus = "unhealthy";
  }

  // Check Canvas API connectivity (without auth, just base URL)
  try {
    const canvasBaseUrl = process.env.CANVAS_API_BASE_URL || "https://canvas.instructure.com/api/v1";
    const response = await axios.get(canvasBaseUrl, { timeout: 5000 });
    checks.checks.canvasApi = {
      status: "healthy",
      message: "Canvas API is reachable",
      responseTime: response.headers["x-response-time"] || "N/A",
    };
  } catch (error) {
    checks.checks.canvasApi = {
      status: "warning",
      message: "Canvas API check failed (may require authentication)",
      error: error.message,
    };
    // Don't mark overall as unhealthy for Canvas API issues
  }

  checks.status = overallStatus;

  const statusCode = overallStatus === "healthy" ? 200 : 503;
  res.status(statusCode).json(checks);
});

/**
 * GET /health/stats
 * Get platform statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const db = admin.firestore();

    // Get user statistics
    const usersSnapshot = await db.collection("users").count().get();
    const totalUsers = usersSnapshot.data().count;

    // Get users with Canvas linked
    const canvasLinkedSnapshot = await db.collection("users")
        .where("canvasDataLinked", "==", true)
        .count()
        .get();
    const usersWithCanvas = canvasLinkedSnapshot.data().count;

    // Get parking spots count
    const parkingSpotsSnapshot = await db.collection("parkingSpots").count().get();
    const totalParkingSpots = parkingSpotsSnapshot.data().count;

    // Get active tandems
    const tandemsSnapshot = await db.collection("tandemPairings").count().get();
    const activeTandems = tandemsSnapshot.data().count;

    // Get active carpools
    const carpoolsSnapshot = await db.collection("carpools").count().get();
    const activeCarpools = carpoolsSnapshot.data().count;

    // Get rental statistics
    const rentalsSnapshot = await db.collection("rentals").count().get();
    const totalRentals = rentalsSnapshot.data().count;

    const stats = {
      timestamp: new Date().toISOString(),
      platform: {
        totalUsers,
        usersWithCanvas,
        canvasLinkageRate: totalUsers > 0 ?
          `${((usersWithCanvas / totalUsers) * 100).toFixed(1)}%` : "0%",
      },
      parking: {
        totalSpots: totalParkingSpots,
        totalRentals,
      },
      social: {
        activeTandems,
        activeCarpools,
      },
    };

    res.json(stats);
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch platform statistics",
      details: error.message,
    });
  }
});

/**
 * GET /health/database
 * Check database collections and their document counts
 */
router.get("/database", async (req, res) => {
  try {
    const db = admin.firestore();

    const collections = [
      "users",
      "canvasData",
      "parkingSpots",
      "tandemPairings",
      "carpools",
      "rentals",
      "apiKeys",
    ];

    const collectionStats = {};

    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).count().get();
      collectionStats[collectionName] = {
        documentCount: snapshot.data().count,
      };
    }

    res.json({
      timestamp: new Date().toISOString(),
      collections: collectionStats,
    });
  } catch (error) {
    console.error("Database check error:", error);
    res.status(500).json({
      error: "Failed to check database",
      details: error.message,
    });
  }
});

module.exports = router;
