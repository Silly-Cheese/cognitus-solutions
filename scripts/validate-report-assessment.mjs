import fs from "node:fs";

const report = fs.readFileSync("src/reportAssessmentV7.js", "utf8");
const css = fs.readFileSync("src/reportAssessmentV7.css", "utf8");
const navigation = fs.readFileSync("src/navigationEnhancements.js", "utf8");

const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
};

assert(navigation.includes('import "./reportAssessmentV7.js"'), "report assessment module is loaded in production");
assert(navigation.includes("reportAssessmentV7.css"), "report assessment stylesheet is loaded in production");
assert(report.includes('current !== "/reports/quick"') && report.includes('current !== "/reports/full"'), "assessment visualization targets quick and full reports");
assert(report.includes('readDoc("checkLogs", checkId)') && report.includes('readDoc("profiles", check.targetProfileId)'), "assessment derives from the checked subject profile");
assert(report.includes("professionalStanding") && report.includes("riskLevel"), "standing and risk fields drive the assessment visualization");
assert(report.includes('headline: "Assessment incomplete"'), "unreviewed standing or risk produces an explicit incomplete state");
assert(report.includes('tone: "positive"') && report.includes('tone: "caution"') && report.includes('tone: "elevated"') && report.includes('tone: "critical"'), "visual severity tiers are explicitly mapped");
assert(report.includes("visual aid, not a standalone employment decision"), "report explains that color is decision support rather than an automatic verdict");
assert(css.includes("v7-assessment-band") && css.includes("v7-assessment-chip"), "assessment band and individual standing/risk chips are styled");
assert(css.includes("--v7-green") && css.includes("--v7-amber") && css.includes("--v7-orange") && css.includes("--v7-red") && css.includes("--v7-neutral"), "all assessment color families are present");
assert(css.includes("@media print") && css.includes("print-color-adjust"), "assessment colors are retained in printed/PDF reports");
assert(css.includes("@media (max-width: 760px)"), "assessment visualization has a mobile layout");
assert(!report.includes("MutationObserver"), "report assessment remains observer-free");
assert(!report.includes("Fire.orderBy("), "report assessment introduces no ordered compound query");
assert(!report.includes("Fire.where("), "report assessment uses direct document reads rather than compound queries");

if (process.exitCode) {
  console.error("\nReport assessment visualization validation failed.");
  process.exit(process.exitCode);
}

console.log("\nReport assessment visualization validation passed.");
