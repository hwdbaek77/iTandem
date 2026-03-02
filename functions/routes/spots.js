/**
 * Public-facing parking spots routes.
 * Allows authenticated users to browse available parking spots by lot.
 * Includes a seed endpoint to populate all HW lots.
 */

const express = require("express");
const admin = require("firebase-admin");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// ── Lot definitions for Harvard-Westlake ─────────────────────────────────────

const HW_LOTS = {
  Taper: { prefix: "S", count: 102, compactSpots: [3,7,12,18,25,33,41,50,58,66,74,82,90,98] },
  Coldwater: { prefix: "", start: 1, count: 46, obstructed: [8,19,30] },
  Hacienda: { prefix: "HC", count: 95, compactSpots: [5,10,15,20,25,30,35,40], handicap: [1,2] },
  "St Michael": { prefix: "U", count: 43 },
  Hamilton: { prefix: "HM", count: 63, reserved: [1,2,3] },
};

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

// ── POST /spots/seed ─────────────────────────────────────────────────────────

/**
 * Populate all HW parking lots in Firestore. Idempotent — clears and rebuilds.
 * Admin-only. Call once to set up the database.
 */
router.post("/seed", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Delete existing spots
    const existing = await db.collection("parkingSpots").get();
    const deleteBatch = db.batch();
    existing.forEach((doc) => deleteBatch.delete(doc.ref));
    if (!existing.empty) await deleteBatch.commit();

    let totalCreated = 0;

    for (const [lotName, config] of Object.entries(HW_LOTS)) {
      const spots = [];
      const start = config.start || 1;

      for (let i = start; i < start + config.count; i++) {
        const num = config.prefix ? `${config.prefix}${i}` : String(i);
        const isObstructed = config.obstructed?.includes(i);
        if (isObstructed) continue;

        let type = "standard";
        if (config.compactSpots?.includes(i)) type = "compact";
        if (config.handicap?.includes(i)) type = "handicap";
        if (config.reserved?.includes(i)) type = "reserved";

        spots.push({
          lot: lotName,
          number: num,
          type,
          isAvailable: true, // for now any user can rent any spot
          ownerId: null,
          currentRenterId: null,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Write in batches of 500 (Firestore limit)
      for (let i = 0; i < spots.length; i += 450) {
        const batch = db.batch();
        const chunk = spots.slice(i, i + 450);
        for (const spot of chunk) {
          const ref = db.collection("parkingSpots").doc();
          batch.set(ref, spot);
        }
        await batch.commit();
        totalCreated += chunk.length;
      }
    }

    res.json({ message: "Parking spots seeded successfully", totalCreated });
  } catch (error) {
    console.error("Seed spots error:", error);
    res.status(500).json({ error: "Failed to seed spots" });
  }
});

module.exports = router;
