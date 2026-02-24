/**
 * Public-facing parking spots routes.
 * Allows authenticated users to browse available parking spots by lot.
 */

const express = require("express");
const admin = require("firebase-admin");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ── GET /spots ──────────────────────────────────────────────────────────────

/**
 * List all available parking spots.
 * Supports optional query params: ?lot=Taper&available=true
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    let query = db.collection("parkingSpots");

    if (req.query.lot) {
      query = query.where("lot", "==", req.query.lot);
    }

    if (req.query.available === "true") {
      query = query.where("isAvailable", "==", true);
    }

    const snapshot = await query.get();
    const spots = [];

    snapshot.forEach((doc) => {
      spots.push({ id: doc.id, ...doc.data() });
    });

    res.json({ spots, total: spots.length });
  } catch (error) {
    console.error("List spots error:", error);
    res.status(500).json({ error: "Failed to list parking spots" });
  }
});

// ── GET /spots/lots ─────────────────────────────────────────────────────────

/**
 * Get a summary of all lots with their spot counts.
 */
router.get("/lots", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("parkingSpots").get();

    const lotMap = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      const lot = data.lot || "Unknown";
      if (!lotMap[lot]) {
        lotMap[lot] = { total: 0, available: 0 };
      }
      lotMap[lot].total++;
      if (data.isAvailable) {
        lotMap[lot].available++;
      }
    });

    const lots = Object.entries(lotMap).map(([name, counts]) => ({
      name,
      totalSpots: counts.total,
      availableSpots: counts.available,
    }));

    res.json({ lots });
  } catch (error) {
    console.error("List lots error:", error);
    res.status(500).json({ error: "Failed to list lots" });
  }
});

// ── GET /spots/lot/:lotName ─────────────────────────────────────────────────

/**
 * Get all spots for a specific lot.
 */
router.get("/lot/:lotName", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("parkingSpots")
      .where("lot", "==", req.params.lotName)
      .get();

    const spots = [];
    snapshot.forEach((doc) => {
      spots.push({ id: doc.id, ...doc.data() });
    });

    res.json({ lot: req.params.lotName, spots, total: spots.length });
  } catch (error) {
    console.error("Get lot spots error:", error);
    res.status(500).json({ error: "Failed to get lot spots" });
  }
});

// ── GET /spots/:spotId ──────────────────────────────────────────────────────

/**
 * Get details for a single parking spot.
 */
router.get("/:spotId", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection("parkingSpots").doc(req.params.spotId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Spot not found" });
    }

    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Get spot error:", error);
    res.status(500).json({ error: "Failed to get spot details" });
  }
});

module.exports = router;
