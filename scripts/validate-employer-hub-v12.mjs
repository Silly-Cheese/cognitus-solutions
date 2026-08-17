import fs from "node:fs";
import { spawnSync } from "node:child_process";

const hub = fs.readFileSync("src/employerHubFixV12.js", "utf8");
const css = fs.readFileSync("src/employerHubFixV12.css", "utf8");
const nav = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const syntax = spawnSync(process.execPath, ["--check", "src/employerHubFixV12.js"], { encoding: "utf8" });

const checks = [
  [syntax.status === 0, "Employer Hub V12 JavaScript syntax is valid"],
  [nav.includes('import "./employerHubFixV12.js"'), "production navigation loads Employer Hub V12 reconciliation"],
  [hub.includes('readDoc("organizations", value)') && hub.includes('readWhere("organizations", "cognitusId", "==", value)'), "organization assignment resolves both Firestore IDs and Cognitus organization IDs"],
  [hub.includes('readDoc("employerStatusRequests", authUser.uid)') && hub.includes('request.status !== "approved"'), "approved Employer Status is available as an organization fallback"],
  [hub.includes('Fire.updateDoc(Fire.doc(db, "users", authUser.uid)') && hub.includes("organizationId: org.id"), "Owner/Admin stale organization references can be normalized to the real document ID"],
  [hub.includes("ownerChooser") && hub.includes("data-emp12-select-org"), "Owners without a usable assignment receive an organization chooser instead of a dead-end gate"],
  [hub.includes("enhanceOwnerSwitcher") && hub.includes("Switch Employer Hub organization"), "Owners can switch Employer Hub organizations from the active workspace"],
  [hub.includes('verificationStatus === "verified"'), "Owner workspace selection is limited to verified organizations"],
  [!hub.includes("orderBy("), "Employer Hub repair introduces no ordered/composite query"],
  [!hub.includes("MutationObserver"), "Employer Hub repair remains observer-free"],
  [css.includes(".emp12-owner-switcher") && css.includes(".emp12-owner-chooser"), "repair, chooser, and Owner switcher have dedicated styling"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (syntax.status !== 0 && syntax.stderr) console.error(syntax.stderr);
if (failed) process.exit(1);
console.log("\nEmployer Hub V12 validation passed.");
