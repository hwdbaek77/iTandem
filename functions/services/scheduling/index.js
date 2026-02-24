/**
 * Scheduling system barrel export.
 * Re-exports all scheduling modules for convenient imports.
 */

const { parsePDFBuffer } = require("./pdfParser");
const { buildSchedule, printSchedule } = require("./scheduleBuilder");
const {
  computeCompatibility,
  rankPartners,
  scoreGradeLevel,
  WEIGHTS,
} = require("./compatibilityAlgorithm");
const { BELL_SCHEDULE, timeToMinutes, minutesToTime, overlapMinutes } = require("./bellSchedule");

module.exports = {
  parsePDFBuffer,
  buildSchedule,
  printSchedule,
  computeCompatibility,
  rankPartners,
  scoreGradeLevel,
  WEIGHTS,
  BELL_SCHEDULE,
  timeToMinutes,
  minutesToTime,
  overlapMinutes,
};
