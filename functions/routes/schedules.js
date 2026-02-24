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
 * Returns a promise that resolves with { buffer, filename, mimetype }.
 */
function parseFileUpload(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let fileName = null;
    let mimeType = null;

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
      if (!fileBuffer) {
        return reject(new Error("No file uploaded"));
      }
      resolve({ buffer: fileBuffer, filename: fileName, mimetype: mimeType });
    });

    busboy.on("error", reject);

    if (req.rawBody) {
      busboy.end(req.rawBody);
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

    if (!mimetype || !mimetype.includes("pdf")) {
      return res.status(400).json({ error: "Only PDF files are accepted" });
    }

    const parsedSchedule = await parsePDFBuffer(buffer);
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
    if (error.message.includes("Could not parse") || error.message.includes("Could not find")) {
      return res.status(400).json({ error: `PDF parsing failed: ${error.message}` });
    }
    res.status(500).json({ error: "Failed to upload and parse schedule" });
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
 * Get a ranked list of compatible tandem partners for the current user.
 * Compares against all other users who have uploaded schedules.
 */
router.get("/matches/ranked", authenticate, async (req, res) => {
  try {
    const db = admin.firestore();
    const myScheduleDoc = await db.collection("schedules").doc(req.userId).get();

    if (!myScheduleDoc.exists) {
      return res.status(400).json({ error: "You haven't uploaded your schedule yet" });
    }

    const myData = myScheduleDoc.data();
    const myBuiltSchedule = myData.builtSchedule;

    const allSchedulesSnapshot = await db.collection("schedules").get();
    const otherSchedules = [];

    allSchedulesSnapshot.forEach((doc) => {
      if (doc.id !== req.userId) {
        const data = doc.data();
        otherSchedules.push({
          userId: doc.id,
          builtSchedule: data.builtSchedule,
        });
      }
    });

    if (otherSchedules.length === 0) {
      return res.json({ matches: [], message: "No other users have uploaded schedules yet" });
    }

    const builtSchedules = otherSchedules.map((s) => s.builtSchedule);
    const ranked = rankPartners(myBuiltSchedule, builtSchedules);

    const matches = ranked.map((result, index) => {
      const matchedUser = otherSchedules.find(
        (s) => s.builtSchedule.name === result.studentB
      );
      return {
        rank: index + 1,
        userId: matchedUser ? matchedUser.userId : null,
        name: result.studentB,
        score: result.finalScore,
        compatible: result.compatible,
        reason: result.reason || null,
        dayAverage: result.dayAverage,
        gradeScore: result.gradeScore,
      };
    });

    res.json({ matches });
  } catch (error) {
    console.error("Schedule matching error:", error);
    res.status(500).json({ error: "Failed to compute matches" });
  }
});

module.exports = router;
