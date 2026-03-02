/**
 * Schedule routes - PDF upload, parsing, storage, and compatibility matching.
 * Handles the full scheduling pipeline: upload PDF -> parse -> store -> compare.
 */

const express = require("express");
const admin = require("firebase-admin");
const Busboy = require("busboy");
const { authenticate, requireAdmin } = require("../middleware/auth");
const { parsePDFBuffer, buildSchedule, computeCompatibility, rankPartners } = require("../services/scheduling");

const router = express.Router();

// ── Helper: Parse multipart upload using Busboy ─────────────────────────────

/**
 * Extract a single file buffer from a multipart/form-data request.
 * In Cloud Functions v2, req.rawBody contains the raw bytes (pre-buffered
 * by the runtime) so we feed that directly to Busboy.
 */
function parseFileUpload(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart")) {
      return reject(new Error(`Expected multipart/form-data but got: ${contentType || "none"}`));
    }

    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = null;
    let mimeType = null;
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      reject(new Error("File upload timed out - no file data received"));
    }, 15000);

    busboy.on("file", (fieldname, file, info) => {
      const { filename, mimeType: mime } = info;
      fileName = filename;
      mimeType = mime;
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("finish", () => {
      clearTimeout(timeout);
      if (timedOut) return;
      if (!fileBuffer || fileBuffer.length === 0) {
        return reject(new Error("No file uploaded or file is empty"));
      }
      resolve({ buffer: fileBuffer, filename: fileName, mimetype: mimeType });
    });

    busboy.on("error", (err) => {
      clearTimeout(timeout);
      if (timedOut) return;
      reject(new Error(`File upload parsing failed: ${err.message}`));
    });

    // Cloud Functions v2 pre-buffers the body into rawBody
    const body = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null);
    if (body) {
      busboy.end(body);
    } else {
      req.pipe(busboy);
    }
  });
}

// ── POST /schedules/upload ──────────────────────────────────────────────────

/**
 * Upload a schedule PDF, parse it, store parsed data in Firestore and
 * the raw PDF in Firebase Storage.
 */
router.post("/upload", authenticate, async (req, res) => {
  try {
    const { buffer, filename, mimetype } = await parseFileUpload(req);

    const isPdf = (mimetype && mimetype.includes("pdf")) || filename?.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return res.status(400).json({
        error: "Only PDF files are accepted",
        received: { mimetype, filename },
      });
    }

    let parsedSchedule;
    try {
      parsedSchedule = await parsePDFBuffer(buffer);
    } catch (parseErr) {
      console.error("PDF parse error:", parseErr);
      return res.status(400).json({
        error: `PDF parsing failed: ${parseErr.message}`,
        hint: "Ensure you're uploading a Harvard-Westlake student schedule PDF.",
      });
    }

    const builtSchedule = buildSchedule(parsedSchedule);

    const bucket = admin.storage().bucket();
    const storagePath = `schedules/${req.userId}/schedule.pdf`;
    const file = bucket.file(storagePath);

    await file.save(buffer, {
      metadata: { contentType: "application/pdf" },
    });

    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("schedules").doc(req.userId).set({
      userId: req.userId,
      name: parsedSchedule.name,
      grade: parsedSchedule.grade,
      courses: parsedSchedule.courses,
      coCurriculars: parsedSchedule.coCurriculars,
      directedStudies: parsedSchedule.directedStudies,
      seminars: parsedSchedule.seminars,
      builtSchedule: JSON.parse(JSON.stringify(builtSchedule)),
      pdfStoragePath: storagePath,
      originalFilename: filename,
      uploadedAt: now,
      parsedAt: now,
    });

    res.json({
      message: "Schedule uploaded and parsed successfully",
      schedule: {
        name: parsedSchedule.name,
        grade: parsedSchedule.grade,
        courseCount: parsedSchedule.courses.length,
        coCurricularCount: parsedSchedule.coCurriculars.length,
        hasCoCurricular: builtSchedule.hasCoCurricular,
        coCurricularName: builtSchedule.coCurricularName,
      },
    });
  } catch (error) {
    console.error("Schedule upload error:", error);
    if (error.message.includes("multipart")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: `Failed to upload schedule: ${error.message}` });
  }
});

// ── GET /schedules/me ───────────────────────────────────────────────────────

/**
 * Get the current user's parsed schedule data.
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const scheduleDoc = await db.collection("schedules").doc(req.userId).get();

    if (!scheduleDoc.exists) {
      return res.status(404).json({ error: "No schedule found. Please upload your schedule PDF." });
    }

    const data = scheduleDoc.data();
    res.json({
      name: data.name,
      grade: data.grade,
      courses: data.courses,
      coCurriculars: data.coCurriculars,
      directedStudies: data.directedStudies,
      seminars: data.seminars,
      builtSchedule: data.builtSchedule,
      uploadedAt: data.uploadedAt,
    });
  } catch (error) {
    console.error("Get schedule error:", error);
    res.status(500).json({ error: "Failed to retrieve schedule" });
  }
});

// ── GET /schedules/:userId ──────────────────────────────────────────────────

/**
 * Get another user's schedule. Admin-only.
 */
router.get("/:userId", authenticate, requireAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const scheduleDoc = await db.collection("schedules").doc(req.params.userId).get();

    if (!scheduleDoc.exists) {
      return res.status(404).json({ error: "No schedule found for this user" });
    }

    res.json(scheduleDoc.data());
  } catch (error) {
    console.error("Get user schedule error:", error);
    res.status(500).json({ error: "Failed to retrieve user schedule" });
  }
});

// ── POST /schedules/compare/:userId ─────────────────────────────────────────

/**
 * Compare the current user's schedule with another user's schedule.
 * Returns a detailed compatibility breakdown.
 */
router.post("/compare/:userId", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();

    const [myScheduleDoc, theirScheduleDoc] = await Promise.all([
      db.collection("schedules").doc(req.userId).get(),
      db.collection("schedules").doc(req.params.userId).get(),
    ]);

    if (!myScheduleDoc.exists) {
      return res.status(400).json({ error: "You haven't uploaded your schedule yet" });
    }
    if (!theirScheduleDoc.exists) {
      return res.status(404).json({ error: "The other user hasn't uploaded their schedule" });
    }

    const myData = myScheduleDoc.data();
    const theirData = theirScheduleDoc.data();

    const result = computeCompatibility(myData.builtSchedule, theirData.builtSchedule);

    res.json({
      compatibility: result,
      myName: myData.name,
      theirName: theirData.name,
    });
  } catch (error) {
    console.error("Schedule comparison error:", error);
    res.status(500).json({ error: "Failed to compare schedules" });
  }
});

// ── GET /schedules/matches/ranked ───────────────────────────────────────────

/**
 * Get a ranked list of compatible tandem/carpool partners for the current user.
 * Excludes users who already have an active match of the given type (taken off market).
 * Query: ?type=tandem (default) | carpool
 */
router.get("/matches/ranked", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const matchType = (req.query.type || "tandem");
    if (!["tandem", "carpool"].includes(matchType)) {
      return res.status(400).json({ error: "type must be tandem or carpool" });
    }

    const myScheduleDoc = await db.collection("schedules").doc(req.userId).get();

    if (!myScheduleDoc.exists) {
      return res.status(400).json({ error: "You haven't uploaded your schedule yet" });
    }

    const myData = myScheduleDoc.data();
    const myBuiltSchedule = myData.builtSchedule;

    // Get user IDs who are already in an active match (of this type) - taken off market
    const activeMatchesSnap = await db.collection("matches")
      .where("type", "==", matchType)
      .where("status", "==", "active")
      .get();

    const userIdsOffMarket = new Set();
    activeMatchesSnap.forEach((doc) => {
      const d = doc.data();
      userIdsOffMarket.add(d.requesterId);
      userIdsOffMarket.add(d.targetId);
    });
    userIdsOffMarket.add(req.userId); // exclude self

    const allSchedulesSnapshot = await db.collection("schedules").get();
    const otherSchedules = [];

    allSchedulesSnapshot.forEach((doc) => {
      if (doc.id !== req.userId && !userIdsOffMarket.has(doc.id)) {
        const data = doc.data();
        otherSchedules.push({
          userId: doc.id,
          builtSchedule: data.builtSchedule,
        });
      }
    });

    if (otherSchedules.length === 0) {
      return res.json({ matches: [], message: "No other users available to match (all may be matched already)" });
    }

    const builtSchedules = otherSchedules.map((s) => s.builtSchedule);
    const ranked = rankPartners(myBuiltSchedule, builtSchedules);

    const matches = ranked.map((result, index) => {
      const matchedUser = otherSchedules.find(
        (s) => s.builtSchedule.name === result.studentB
      );
      // gradeScore from algorithm is { score, compatible } - extract numeric for frontend
      const gradeScoreNum = typeof result.gradeScore === "object" && result.gradeScore !== null
        ? result.gradeScore.score
        : result.gradeScore;
      return {
        rank: index + 1,
        userId: matchedUser ? matchedUser.userId : null,
        name: result.studentB,
        score: result.finalScore,
        compatible: result.compatible,
        reason: result.reason || null,
        dayAverage: result.dayAverage,
        gradeScore: gradeScoreNum ?? 0,
      };
    });

    res.json({ matches });
  } catch (error) {
    console.error("Schedule matching error:", error);
    res.status(500).json({ error: "Failed to compute matches" });
  }
});

module.exports = router;
