/**
 * SchedulingSystem.js
 * 
 * Main entry point for the iTandem Scheduling Compatibility System.
 * 
 * Orchestrates the full pipeline:
 *   1. Parse student schedule PDFs
 *   2. Build per-day campus presence maps
 *   3. Compute pairwise compatibility scores
 *   4. Rank potential tandem partners
 * 
 * Usage:
 *   node SchedulingSystem.js <pdf1> <pdf2> [--co-curricular1 HH:MM] [--co-curricular2 HH:MM]
 * 
 *   Or from code:
 *     const { compareStudents, compareMultiple } = require("./SchedulingSystem");
 */

const { parsePDF } = require("./pdfParser");
const { buildSchedule, printSchedule } = require("./scheduleBuilder");
const { computeCompatibility, rankPartners, printCompatibility } = require("./compatibilityAlgorithm");
const { minutesToTime } = require("./bellSchedule");

// ── Core API Functions ──────────────────────────────────────────────────────

/**
 * Compare two students' schedules and compute compatibility.
 * 
 * @param {string} pdfPathA - path to student A's schedule PDF
 * @param {string} pdfPathB - path to student B's schedule PDF
 * @param {Object} [optionsA] - options for student A (e.g. { coCurricularEndTime: "17:30" })
 * @param {Object} [optionsB] - options for student B
 * @returns {Promise<Object>} compatibility result
 */
async function compareStudents(pdfPathA, pdfPathB, optionsA = {}, optionsB = {}) {
  const parsedA = await parsePDF(pdfPathA);
  const parsedB = await parsePDF(pdfPathB);

  const scheduleA = buildSchedule(parsedA, optionsA);
  const scheduleB = buildSchedule(parsedB, optionsB);

  const result = computeCompatibility(scheduleA, scheduleB);

  return {
    result,
    scheduleA,
    scheduleB,
  };
}

/**
 * Compare multiple students and rank all pairwise compatibility.
 * 
 * @param {Array<{ path: string, options?: Object }>} students - array of student PDF paths and options
 * @returns {Promise<Object>} all pairwise results, sorted by score
 */
async function compareMultiple(students) {
  // Parse and build all schedules
  const schedules = [];
  for (const student of students) {
    const parsed = await parsePDF(student.path);
    const schedule = buildSchedule(parsed, student.options || {});
    schedules.push(schedule);
  }

  // Compute all pairwise comparisons
  const results = [];
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const result = computeCompatibility(schedules[i], schedules[j]);
      results.push(result);
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.finalScore - a.finalScore);

  return { schedules, results };
}

// ── CLI Interface ───────────────────────────────────────────────────────────

/**
 * Parse command-line arguments.
 * 
 * Usage:
 *   node SchedulingSystem.js <pdf1> <pdf2> [--co-curricular1 HH:MM] [--co-curricular2 HH:MM] [--verbose]
 */
function parseCLIArgs() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: node SchedulingSystem.js <pdf1> <pdf2> [options]");
    console.log("");
    console.log("Options:");
    console.log("  --co-curricular1 HH:MM   Co-curricular end time for student 1");
    console.log("  --co-curricular2 HH:MM   Co-curricular end time for student 2");
    console.log("  --verbose                 Show detailed per-day breakdown");
    console.log("  --schedules               Show full schedule for each student");
    console.log("");
    console.log("Example:");
    console.log("  node SchedulingSystem.js nathan.pdf daniel.pdf --co-curricular1 17:30 --verbose");
    process.exit(1);
  }

  const pdfPaths = [args[0], args[1]];
  const options = [{}, {}];
  let verbose = false;
  let showSchedules = false;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--co-curricular1" && args[i + 1]) {
      options[0].coCurricularEndTime = args[++i];
    } else if (args[i] === "--co-curricular2" && args[i + 1]) {
      options[1].coCurricularEndTime = args[++i];
    } else if (args[i] === "--verbose") {
      verbose = true;
    } else if (args[i] === "--schedules") {
      showSchedules = true;
    }
  }

  return { pdfPaths, options, verbose, showSchedules };
}

/**
 * Run the CLI.
 */
async function main() {
  const { pdfPaths, options, verbose, showSchedules } = parseCLIArgs();

  console.log("iTandem Scheduling Compatibility System");
  console.log("─".repeat(40));
  console.log(`Parsing: ${pdfPaths[0]}`);
  console.log(`Parsing: ${pdfPaths[1]}`);
  console.log();

  try {
    const { result, scheduleA, scheduleB } = await compareStudents(
      pdfPaths[0],
      pdfPaths[1],
      options[0],
      options[1]
    );

    if (showSchedules) {
      printSchedule(scheduleA);
      printSchedule(scheduleB);
    }

    if (verbose) {
      printCompatibility(result);
    } else {
      // Summary output
      console.log(`Student A: ${result.studentA} (Grade ${scheduleA.grade})`);
      console.log(`Student B: ${result.studentB} (Grade ${scheduleB.grade})`);
      console.log();

      if (!result.compatible) {
        console.log(`INCOMPATIBLE: ${result.reason}`);
        console.log(`Score: 0/100`);
      } else {
        console.log(`Compatibility Score: ${result.finalScore}/100`);
        console.log();
        console.log("Per-Day Breakdown:");
        for (let day = 1; day <= 6; day++) {
          const d = result.dayScores[day];
          console.log(`  Day ${day}: ${d.total.toFixed(1)}/90`);
        }
        console.log(`  Average: ${result.dayAverage}/90`);
        console.log(`  Grade Level: +${result.gradeScore.score}/10`);
        console.log(`  ─────────────────`);
        console.log(`  Total: ${result.finalScore}/100`);
      }
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// ── Run CLI if invoked directly ─────────────────────────────────────────────

if (require.main === module) {
  main();
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  compareStudents,
  compareMultiple,
};
