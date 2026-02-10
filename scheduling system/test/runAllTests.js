/**
 * runAllTests.js
 * 
 * Runs all unit and integration tests for the scheduling system.
 * 
 * Run: node test/runAllTests.js
 */

const { execSync } = require("child_process");
const path = require("path");

const testDir = __dirname;
const testFiles = [
  "testBellSchedule.js",
  "testPdfParser.js",
  "testScheduleBuilder.js",
  "testCompatibility.js",
  "testSchedules.js",   // integration test with real PDFs
];

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║   iTandem Scheduling System - Full Test Suite        ║");
console.log("╚══════════════════════════════════════════════════════╝\n");

let allPassed = true;

for (const file of testFiles) {
  const filePath = path.join(testDir, file);
  console.log(`\n${"▓".repeat(60)}`);
  console.log(`  Running: ${file}`);
  console.log(`${"▓".repeat(60)}\n`);

  try {
    const output = execSync(`node "${filePath}"`, {
      encoding: "utf-8",
      cwd: path.join(testDir, ".."),
      timeout: 30000,
    });
    console.log(output);
  } catch (err) {
    allPassed = false;
    console.log(err.stdout || "");
    console.error(`\n  *** ${file} FAILED ***\n`);
    if (err.stderr) console.error(err.stderr);
  }
}

console.log(`\n${"═".repeat(60)}`);
if (allPassed) {
  console.log("  ALL TEST SUITES PASSED");
} else {
  console.log("  SOME TEST SUITES FAILED");
}
console.log(`${"═".repeat(60)}`);

process.exit(allPassed ? 0 : 1);
