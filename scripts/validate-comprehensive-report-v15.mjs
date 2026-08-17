import fs from "node:fs";
import { spawnSync } from "node:child_process";

const report = fs.readFileSync("src/comprehensiveReportV15.js", "utf8");
const css = fs.readFileSync("src/comprehensiveReportV15.css", "utf8");
const loader = fs.readFileSync("src/employerHubFixV12.js", "utf8");
const syntax = spawnSync(process.execPath, ["--check", "src/comprehensiveReportV15.js"], { encoding: "utf8" });

const checks = [
  [syntax.status === 0, "Comprehensive Report V15 JavaScript syntax is valid"],
  [loader.includes('import "./comprehensiveReportV15.js"'), "production enhancement graph loads Comprehensive Report V15"],
  [report.includes('route() !== "/reports/full"') && report.includes('route() !== "/reports/view"'), "V15 enhances both full screening dossiers and complete individual report records"],
  [report.includes('readWhere("employmentRecords", "profileId", "==", profileId)'), "person dossiers load employment history with a single equality query"],
  [report.includes('readWhere("screeningReportSummaries", "subjectProfileId", "==", profile.id)'), "person dossiers load reviewed screening indexes with a single equality query"],
  [report.includes('readWhere("reports", "subjectProfileId", "==", profile.id)') && report.includes("canReadProfileReportSet"), "subjects and reviewer roles load authorized report sets in one equality query"],
  [report.includes('readDoc("reports", summary.reportId || summary.id)') && report.includes("fullAccess"), "partial-access employer views still rely on Firestore-authorized direct report reads"],
  [report.includes("Professional Standing") && report.includes("Risk Level") && report.includes("Identity & Provenance"), "full dossiers include assessment and identity provenance"],
  [report.includes("Employment History") && report.includes("Eligible for Rehire") && report.includes("End Reason / Record Note"), "full dossiers include detailed verified employment history"],
  [report.includes("Reviewed Record Detail") && report.includes("Authorized Complete Narrative") && report.includes("Reviewer Decision Notes"), "authorized reviewed-record narratives and decision context are included"],
  [report.includes("Record Timeline") && report.includes("Employment Started") && report.includes("Reviewed Record"), "full dossiers include a consolidated chronology"],
  [report.includes("Intentionally Excluded") && report.includes("Private Talent List") && report.includes("private employer candidate notes"), "private employer talent data is explicitly excluded from the dossier"],
  [report.includes("Employment history is not available to this account") && report.includes("complete narrative is protected"), "access-limited sections fail closed with explicit explanations"],
  [report.includes("dossierCache") && report.includes("enhanceInFlight") && report.includes("runSingleFlight"), "comprehensive report loading is cached and single-flight"],
  [css.includes(".v15-overview-grid") && css.includes(".v15-employment-card") && css.includes(".v15-timeline") && css.includes("@media print"), "comprehensive dossier has dedicated responsive and print formatting"],
  [!report.includes("Fire.orderBy(") && !report.includes("orderBy("), "V15 introduces no ordered/composite Firestore query"],
  [!report.includes("MutationObserver"), "V15 remains observer-free"],
  [!fs.existsSync("firestore.indexes.json"), "repository still has no manual/composite Firestore index manifest"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (syntax.status !== 0 && syntax.stderr) console.error(syntax.stderr);
if (failed) process.exit(1);
console.log("\nComprehensive Report V15 validation passed.");
