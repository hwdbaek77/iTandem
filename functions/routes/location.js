const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { authenticate } = require("../middleware/auth");

const {
  LocationService,
  SCHOOL_COORDINATES,
  LOCATION_STATUS,
  GEOFENCE_CONFIG,
} = require("../../src/LocationService");

// Lazily initialize LocationService with the API key from environment
let _locationService = null;
function getLocationService() {
  if (!_locationService) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    _locationService = new LocationService({ apiKey });
  }
  return _locationService;
}

/**
 * POST /location/update
 * Receive a location update from the client (foreground polling or manual).
 *
 * Body: { coordinates: { lat, lng }, source?: 'manual'|'polling' }
 *
 * Runs geofence detection, persists to Firestore, returns events + notifications.
 */
router.post("/update", authenticate, async (req, res) => {
  try {
    const { coordinates, source } = req.body;
    const userId = req.userId;

    if (!coordinates || typeof coordinates.lat !== "number" || typeof coordinates.lng !== "number") {
      return res.status(400).json({ error: "coordinates { lat, lng } required" });
    }

    const svc = getLocationService();

    // Load user's zones from Firestore if not already cached in-memory
    if (svc.getUserZones(userId).length === 0) {
      const userDoc = await admin.firestore().collection("userGeofenceSettings").doc(userId).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        svc.setupUserZones(
          userId,
          data.homeCoordinates || { lat: 0, lng: 0 },
          data.carpoolPickupCoordinates || null,
        );
      }
    }

    // Load carpool member IDs for notifications
    let carpoolMemberIds = [];
    const carpoolSnap = await admin.firestore()
      .collection("carpools")
      .where("memberIds", "array-contains", userId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!carpoolSnap.empty) {
      const carpoolData = carpoolSnap.docs[0].data();
      carpoolMemberIds = (carpoolData.memberIds || []).filter((id) => id !== userId);
    }

    const result = await svc.updateLocation({
      userId,
      coordinates,
      source: source || "polling",
      carpoolMemberIds,
    });

    // Persist to Firestore
    await admin.firestore().collection("userLocations").doc(userId).set(result.location.toJSON());

    res.json({
      status: result.location.status,
      events: result.events,
      notifications: result.notifications.map((n) => ({
        type: n.type,
        message: n.message,
      })),
      eta: result.location.currentEtaMinutes,
    });
  } catch (error) {
    console.error("Location update error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /location/status
 * Manual status update — user taps "I'm leaving", "I'm here", etc.
 *
 * Body: { coordinates: { lat, lng } }
 */
router.post("/status", authenticate, async (req, res) => {
  try {
    const { coordinates } = req.body;
    const userId = req.userId;

    if (!coordinates || typeof coordinates.lat !== "number" || typeof coordinates.lng !== "number") {
      return res.status(400).json({ error: "coordinates { lat, lng } required" });
    }

    const svc = getLocationService();

    // Ensure zones are loaded
    if (svc.getUserZones(userId).length === 0) {
      const userDoc = await admin.firestore().collection("userGeofenceSettings").doc(userId).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        svc.setupUserZones(userId, data.homeCoordinates, data.carpoolPickupCoordinates);
      }
    }

    let carpoolMemberIds = [];
    const carpoolSnap = await admin.firestore()
      .collection("carpools")
      .where("memberIds", "array-contains", userId)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (!carpoolSnap.empty) {
      carpoolMemberIds = (carpoolSnap.docs[0].data().memberIds || []).filter((id) => id !== userId);
    }

    const result = await svc.setManualStatus({
      userId,
      coordinates,
      carpoolMemberIds,
    });

    await admin.firestore().collection("userLocations").doc(userId).set(result.location.toJSON());

    res.json({
      status: result.location.status,
      events: result.events,
      notifications: result.notifications.map((n) => ({
        type: n.type,
        message: n.message,
      })),
      eta: result.location.currentEtaMinutes,
    });
  } catch (error) {
    console.error("Manual status error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /location/eta?originLat=...&originLng=...&destLat=...&destLng=...
 * Calculate ETA between two points.
 * If no destination provided, defaults to school.
 */
router.get("/eta", authenticate, async (req, res) => {
  try {
    const originLat = parseFloat(req.query.originLat);
    const originLng = parseFloat(req.query.originLng);
    const destLat = parseFloat(req.query.destLat) || SCHOOL_COORDINATES.lat;
    const destLng = parseFloat(req.query.destLng) || SCHOOL_COORDINATES.lng;

    if (isNaN(originLat) || isNaN(originLng)) {
      return res.status(400).json({ error: "originLat and originLng required" });
    }

    const svc = getLocationService();
    const result = await svc.getEta(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
    );

    res.json({
      etaMinutes: result.etaMinutes,
      distanceMeters: result.distanceMeters,
    });
  } catch (error) {
    console.error("ETA calculation error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /location/on-campus
 * List users currently on campus (fresh locations only).
 * Powers the "Find ride home" feature.
 */
router.get("/on-campus", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const staleThreshold = new Date(
      Date.now() - GEOFENCE_CONFIG.ON_CAMPUS_STALE_MINUTES * 60 * 1000,
    );

    const snap = await db.collection("userLocations")
      .where("status", "==", LOCATION_STATUS.AT_SCHOOL)
      .where("timestamp", ">=", staleThreshold)
      .get();

    const users = snap.docs
      .map((doc) => ({
        userId: doc.id,
        status: doc.data().status,
        timestamp: doc.data().timestamp,
      }))
      .filter((u) => u.userId !== req.userId);

    res.json({ count: users.length, users });
  } catch (error) {
    console.error("On-campus query error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /location/find-ride-home
 * Broadcast a "looking for a ride home" notification to users on campus.
 *
 * Body: (empty — uses authenticated user)
 */
router.post("/find-ride-home", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const staleThreshold = new Date(
      Date.now() - GEOFENCE_CONFIG.ON_CAMPUS_STALE_MINUTES * 60 * 1000,
    );

    const snap = await db.collection("userLocations")
      .where("status", "==", LOCATION_STATUS.AT_SCHOOL)
      .where("timestamp", ">=", staleThreshold)
      .get();

    const onCampusUserIds = snap.docs
      .map((doc) => doc.id)
      .filter((id) => id !== req.userId);

    // Store the ride request in Firestore
    await db.collection("rideHomeRequests").add({
      requesterId: req.userId,
      onCampusUserIds,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "open",
    });

    res.json({
      message: "Ride home request broadcast",
      notifiedCount: onCampusUserIds.length,
      onCampusUserIds,
    });
  } catch (error) {
    console.error("Find ride home error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /location/geofence-settings
 * Get the current user's geofence zone configuration.
 */
router.get("/geofence-settings", authenticate, async (req, res) => {
  try {
    const doc = await admin.firestore()
      .collection("userGeofenceSettings")
      .doc(req.userId)
      .get();

    if (!doc.exists) {
      return res.json({ configured: false, zones: [] });
    }

    const data = doc.data();
    res.json({
      configured: true,
      homeCoordinates: data.homeCoordinates,
      homeAddress: data.homeAddress || null,
      carpoolPickupCoordinates: data.carpoolPickupCoordinates || null,
    });
  } catch (error) {
    console.error("Geofence settings error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /location/geofence-settings
 * Update the current user's geofence configuration (home address, carpool pickup).
 *
 * Body: {
 *   homeAddress?: string,
 *   homeCoordinates?: { lat, lng },
 *   carpoolPickupCoordinates?: { lat, lng }
 * }
 *
 * If homeAddress is provided without homeCoordinates, geocodes the address.
 */
router.put("/geofence-settings", authenticate, async (req, res) => {
  try {
    const { homeAddress, homeCoordinates, carpoolPickupCoordinates } = req.body;
    const svc = getLocationService();
    const update = {};

    if (homeAddress && !homeCoordinates) {
      const geocoded = await svc.geocodeAddress(homeAddress);
      update.homeCoordinates = { lat: geocoded.lat, lng: geocoded.lng };
      update.homeAddress = geocoded.formattedAddress;
    } else {
      if (homeCoordinates) update.homeCoordinates = homeCoordinates;
      if (homeAddress) update.homeAddress = homeAddress;
    }

    if (carpoolPickupCoordinates) {
      update.carpoolPickupCoordinates = carpoolPickupCoordinates;
    }

    update.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await admin.firestore()
      .collection("userGeofenceSettings")
      .doc(req.userId)
      .set(update, { merge: true });

    // Refresh in-memory zones
    const finalCoords = update.homeCoordinates || homeCoordinates;
    if (finalCoords) {
      svc.setupUserZones(req.userId, finalCoords, update.carpoolPickupCoordinates);
    }

    res.json({ message: "Geofence settings updated", ...update });
  } catch (error) {
    console.error("Geofence settings update error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /location/geocode
 * Geocode an address to coordinates.
 *
 * Body: { address: string }
 */
router.post("/geocode", authenticate, async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: "address string required" });
    }

    const svc = getLocationService();
    const result = await svc.geocodeAddress(address);

    res.json(result);
  } catch (error) {
    console.error("Geocode error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
