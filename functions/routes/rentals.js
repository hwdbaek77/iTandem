/**
 * Rental routes - create, view, and manage parking spot rentals.
 */

const express = require("express");
const admin = require("firebase-admin");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ── POST /rentals ───────────────────────────────────────────────────────────

/**
 * Create a new rental reservation for a parking spot.
 * Body: { spotId, startDate?, endDate?, type? }
 */
router.post("/", authenticate, async (req, res) => {
  try {
    const { spotId, startDate, endDate, type } = req.body;

    if (!spotId) {
      return res.status(400).json({ error: "spotId is required" });
    }

    const db = admin.firestore();

    const spotDoc = await db.collection("parkingSpots").doc(spotId).get();
    if (!spotDoc.exists) {
      return res.status(404).json({ error: "Parking spot not found" });
    }

    const spot = spotDoc.data();
    if (!spot.isAvailable) {
      return res.status(409).json({ error: "Spot is no longer available" });
    }

    const rental = {
      renterId: req.userId,
      spotId,
      ownerId: spot.ownerId || null,
      lot: spot.lot,
      spotNumber: spot.number,
      type: type || "standard",
      status: "active",
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const batch = db.batch();

    const rentalRef = db.collection("rentals").doc();
    batch.set(rentalRef, rental);

    batch.update(spotDoc.ref, {
      isAvailable: false,
      currentRenterId: req.userId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    res.status(201).json({
      message: "Rental created successfully",
      rentalId: rentalRef.id,
      rental: { id: rentalRef.id, ...rental },
    });
  } catch (error) {
    console.error("Create rental error:", error);
    res.status(500).json({ error: "Failed to create rental" });
  }
});

// ── GET /rentals/me ─────────────────────────────────────────────────────────

/**
 * Get all rentals for the current user (as renter).
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("rentals")
      .where("renterId", "==", req.userId)
      .get();

    const rentals = [];
    snapshot.forEach((doc) => {
      rentals.push({ id: doc.id, ...doc.data() });
    });
    rentals.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    res.json({ rentals, total: rentals.length });
  } catch (error) {
    console.error("Get my rentals error:", error);
    res.status(500).json({ error: "Failed to get rentals" });
  }
});

// ── GET /rentals/:rentalId ──────────────────────────────────────────────────

/**
 * Get details for a specific rental.
 */
router.get("/:rentalId", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection("rentals").doc(req.params.rentalId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Rental not found" });
    }

    const rental = doc.data();

    if (rental.renterId !== req.userId && rental.ownerId !== req.userId) {
      return res.status(403).json({ error: "You don't have access to this rental" });
    }

    res.json({ id: doc.id, ...rental });
  } catch (error) {
    console.error("Get rental error:", error);
    res.status(500).json({ error: "Failed to get rental details" });
  }
});

// ── PUT /rentals/:rentalId/cancel ───────────────────────────────────────────

/**
 * Cancel an active rental.
 */
router.put("/:rentalId/cancel", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const rentalDoc = await db.collection("rentals").doc(req.params.rentalId).get();

    if (!rentalDoc.exists) {
      return res.status(404).json({ error: "Rental not found" });
    }

    const rental = rentalDoc.data();

    if (rental.renterId !== req.userId) {
      return res.status(403).json({ error: "Only the renter can cancel this rental" });
    }

    if (rental.status !== "active") {
      return res.status(400).json({ error: "Rental is not active" });
    }

    const batch = db.batch();

    batch.update(rentalDoc.ref, {
      status: "cancelled",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (rental.spotId) {
      const spotRef = db.collection("parkingSpots").doc(rental.spotId);
      batch.update(spotRef, {
        isAvailable: true,
        currentRenterId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    res.json({ message: "Rental cancelled successfully" });
  } catch (error) {
    console.error("Cancel rental error:", error);
    res.status(500).json({ error: "Failed to cancel rental" });
  }
});

module.exports = router;
