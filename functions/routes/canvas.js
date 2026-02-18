const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const { authenticate } = require("../middleware/auth");
const CanvasService = require("../services/canvasService");

/**
 * GET /canvas/profile
 * Get user's Canvas profile data
 */
router.get("/profile", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userData = userDoc.data();

    if (!userData.canvasAccessToken) {
      return res.status(400).json({
        error: "Canvas access token not configured",
        message: "Please link your Canvas account first",
      });
    }

    const canvasService = new CanvasService(userData.canvasAccessToken);
    const profile = await canvasService.getUserProfile();

    res.json({
      profile,
    });
  } catch (error) {
    console.error("Canvas profile fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch Canvas profile",
      details: error.message,
    });
  }
});

/**
 * GET /canvas/courses
 * Get user's Canvas courses
 */
router.get("/courses", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userData = userDoc.data();

    if (!userData.canvasAccessToken) {
      return res.status(400).json({
        error: "Canvas access token not configured",
      });
    }

    const canvasService = new CanvasService(userData.canvasAccessToken);
    const courses = await canvasService.getUserCourses();

    res.json({
      courses,
      count: courses.length,
    });
  } catch (error) {
    console.error("Canvas courses fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch Canvas courses",
      details: error.message,
    });
  }
});

/**
 * GET /canvas/schedule
 * Get user's Canvas schedule/calendar
 */
router.get("/schedule", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userData = userDoc.data();

    if (!userData.canvasAccessToken) {
      return res.status(400).json({
        error: "Canvas access token not configured",
      });
    }

    // Get date range from query params or default to next 30 days
    const startDate = req.query.startDate || new Date().toISOString();
    const endDate = req.query.endDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const canvasService = new CanvasService(userData.canvasAccessToken);
    const calendar = await canvasService.getUserCalendar(startDate, endDate);

    res.json({
      calendar,
      count: calendar.length,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    });
  } catch (error) {
    console.error("Canvas schedule fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch Canvas schedule",
      details: error.message,
    });
  }
});

/**
 * GET /canvas/assignments
 * Get user's upcoming Canvas assignments
 */
router.get("/assignments", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userData = userDoc.data();

    if (!userData.canvasAccessToken) {
      return res.status(400).json({
        error: "Canvas access token not configured",
      });
    }

    const canvasService = new CanvasService(userData.canvasAccessToken);
    const assignments = await canvasService.getUpcomingAssignments();

    res.json({
      assignments,
      count: assignments.length,
    });
  } catch (error) {
    console.error("Canvas assignments fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch Canvas assignments",
      details: error.message,
    });
  }
});

/**
 * GET /canvas/data
 * Get cached comprehensive Canvas data from Firestore
 */
router.get("/data", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const canvasDataDoc = await db.collection("canvasData").doc(req.userId).get();

    if (!canvasDataDoc.exists) {
      return res.status(404).json({
        error: "Canvas data not found",
        message: "Please link your Canvas account and wait for data to sync",
      });
    }

    const canvasData = canvasDataDoc.data();

    res.json({
      data: canvasData,
      lastUpdated: canvasData.lastUpdated,
    });
  } catch (error) {
    console.error("Canvas data fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch Canvas data",
      details: error.message,
    });
  }
});

/**
 * POST /canvas/refresh
 * Refresh Canvas data from API and update cache
 */
router.post("/refresh", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection("users").doc(req.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const userData = userDoc.data();

    if (!userData.canvasAccessToken) {
      return res.status(400).json({
        error: "Canvas access token not configured",
      });
    }

    const canvasService = new CanvasService(userData.canvasAccessToken);
    const canvasData = await canvasService.getComprehensiveUserData();

    // Extract and store schedule information for matching algorithms
    const scheduleInfo = CanvasService.extractScheduleInfo(canvasData);

    // Update Canvas data in Firestore
    await db.collection("canvasData").doc(req.userId).set({
      userId: req.userId,
      ...canvasData,
      scheduleInfo,
      tokenLastVerified: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user document
    await db.collection("users").doc(req.userId).update({
      canvasDataLastRefreshed: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      message: "Canvas data refreshed successfully",
      dataFetched: {
        coursesCount: canvasData.courses?.length || 0,
        calendarEventsCount: canvasData.calendar?.length || 0,
        assignmentsCount: canvasData.assignments?.length || 0,
        enrollmentsCount: canvasData.enrollments?.length || 0,
      },
      scheduleExtracted: {
        coursesCount: scheduleInfo.courses?.length || 0,
        upcomingEventsCount: scheduleInfo.upcomingEvents?.length || 0,
      },
    });
  } catch (error) {
    console.error("Canvas data refresh error:", error);
    res.status(500).json({
      error: "Failed to refresh Canvas data",
      details: error.message,
    });
  }
});

/**
 * GET /canvas/schedule-info
 * Get extracted schedule information for matching algorithms
 */
router.get("/schedule-info", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const canvasDataDoc = await db.collection("canvasData").doc(req.userId).get();

    if (!canvasDataDoc.exists) {
      return res.status(404).json({
        error: "Canvas data not found",
      });
    }

    const canvasData = canvasDataDoc.data();

    if (!canvasData.scheduleInfo) {
      return res.status(404).json({
        error: "Schedule information not available",
        message: "Try refreshing your Canvas data",
      });
    }

    res.json({
      scheduleInfo: canvasData.scheduleInfo,
    });
  } catch (error) {
    console.error("Schedule info fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch schedule information",
      details: error.message,
    });
  }
});

module.exports = router;
