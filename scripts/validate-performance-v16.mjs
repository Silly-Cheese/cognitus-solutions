import fs from "node:fs";
import { spawnSync } from "node:child_process";

const read = (path) => fs.readFileSync(path, "utf8");
const profile = read("src/profileV5.js");
const assessment = read("src/assessmentV4.js");
const workspace = read("src/employerWorkspaceV11.js");
const hub = read("src/employerHubFixV12.js");
const dossier = read("src/comprehensiveReportV15.js");

const files = [
  "src/profileV5.js",
  "src/assessmentV4.js",
  "src/employerWorkspaceV11.js",
  "src/employerHubFixV12.js",
  "src/comprehensiveReportV15.js"
];
const syntax = files.map((path) => [path, spawnSync(process.execPath, ["--check", path], { encoding: "utf8" })]);

const checks = [
  [syntax.every(([, result]) => result.status === 0), "performance-critical JavaScript files have valid syntax"],
  [profile.includes("enhanceInFlight") && profile.includes("runEnhance") && profile.includes('data-v5-profile-page'), "Profile V5 uses a rendered-page marker and single-flight enhancement"],
  [profile.includes("[0, 260, 900]") && !profile.includes("[0, 120, 360, 800, 1400]"), "Profile V5 uses a reduced bounded fallback schedule"],
  [assessment.includes('table.dataset.v4AssessmentMounted === "true"') && assessment.includes("adminProfilesPromise") && assessment.includes("enhanceInFlight"), "assessment controls avoid repeated full-profile reads and overlapping mounts"],
  [assessment.indexOf('table.dataset.v4AssessmentMounted === "true"') < assessment.indexOf('readAll("profiles")'), "Admin assessment checks its mounted state before loading every profile"],
  [assessment.includes("[0, 260, 900]"), "assessment retries are reduced to three bounded passes"],
  [workspace.includes("enhanceInFlight") && workspace.includes("runEnhance") && workspace.includes("organizationCache"), "Employer Workspace serializes rendering and caches organization context"],
  [workspace.includes("Date.now() - organizationCacheAt < 12000") && workspace.includes("[0, 280, 1000]"), "Employer Workspace has a short-lived organization cache and reduced fallback schedule"],
  [hub.includes("reconcileInFlight") && hub.includes("runReconcile") && hub.includes("contextCache"), "Employer Hub reconciliation is single-flight and context-cached"],
  [hub.includes("loadOrganizations") && hub.includes("organizationsCacheAt < 15000") && hub.includes("[100, 480, 1300]"), "Owner organization lists are cached and reconciliation uses three bounded passes"],
  [dossier.includes("dossierCache") && dossier.includes("enhanceInFlight") && dossier.includes("runSingleFlight"), "Comprehensive Report V15 caches dossier data and prevents overlapping enhancement"],
  [dossier.includes('readWhere("reports", "subjectProfileId", "==", profile.id)') && dossier.includes("canReadProfileReportSet"), "authorized subject/reviewer dossiers avoid N+1 full-report reads"],
  [dossier.includes("[80, 420, 1200]"), "Comprehensive Report V15 uses a reduced bounded schedule"],
  [files.every((path) => !read(path).includes("MutationObserver")), "performance pass remains MutationObserver-free"],
  [files.every((path) => !read(path).includes("Fire.orderBy(") && !read(path).includes("orderBy(")), "performance pass introduces no ordered/composite Firestore queries"],
  [!fs.existsSync("firestore.indexes.json"), "repository still contains no manual/composite Firestore index manifest"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
for (const [path, result] of syntax) {
  if (result.status !== 0 && result.stderr) console.error(`${path}:\n${result.stderr}`);
}
if (failed) process.exit(1);
console.log("\nCognitus Performance V16 validation passed.");
