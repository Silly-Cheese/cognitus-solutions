import fs from "node:fs";
import { spawnSync } from "node:child_process";

const hub = fs.readFileSync("src/employerHubFixV12.js", "utf8");
const css = fs.readFileSync("src/employerHubFixV12.css", "utf8");
const nav = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const polish = fs.readFileSync("src/interfacePolishV13.js", "utf8");
const polishCss = fs.readFileSync("src/interfacePolishV13.css", "utf8");
const hubSyntax = spawnSync(process.execPath, ["--check", "src/employerHubFixV12.js"], { encoding: "utf8" });
const polishSyntax = spawnSync(process.execPath, ["--check", "src/interfacePolishV13.js"], { encoding: "utf8" });

const checks = [
  [hubSyntax.status === 0, "Employer Hub V12 JavaScript syntax is valid"],
  [polishSyntax.status === 0, "Interface V13 JavaScript syntax is valid"],
  [nav.includes('import "./employerHubFixV12.js"'), "production navigation loads Employer Hub V12 reconciliation"],
  [hub.includes('import "./interfacePolishV13.js"'), "Employer Hub reconciliation loads Interface V13"],
  [hub.includes('readDoc("organizations", value)') && hub.includes('readWhere("organizations", "cognitusId", "==", value)'), "organization assignment resolves both Firestore IDs and Cognitus organization IDs"],
  [hub.includes('readDoc("employerStatusRequests", authUser.uid)') && hub.includes('request.status !== "approved"'), "approved Employer Status is available as an organization fallback"],
  [hub.includes('Fire.updateDoc(Fire.doc(db, "users", authUser.uid)') && hub.includes("organizationId: org.id"), "Owner/Admin stale organization references can be normalized to the real document ID"],
  [hub.includes("ownerChooser") && hub.includes("data-emp12-select-org"), "Owners without a usable assignment receive an organization chooser instead of a dead-end gate"],
  [hub.includes("enhanceOwnerSwitcher") && hub.includes("Switch Employer Hub organization"), "Owners can switch Employer Hub organizations from the active workspace"],
  [hub.includes('verificationStatus === "verified"'), "Owner workspace selection is limited to verified organizations"],
  [polish.includes("function ensureEmployerHubNav") && polish.includes('link.href = "#/employer"') && polish.includes("data-ui13-employer-hub"), "Interface V13 owns a stable Employer Hub navigation destination"],
  [polish.includes('nav.insertBefore(link, search)') && polish.includes("2200"), "Employer Hub is promoted before Run Check and repaired with bounded synchronization"],
  [polish.includes('event.target?.id === "search-form"') && polish.includes("decoratePersonResult"), "Run Check results are redecorated after logged searches complete"],
  [polish.includes("Professional standing") && polish.includes("Risk ·"), "Run Check person results expose explicit Standing and Risk visual labels"],
  [polishCss.includes(".ui13-search-layout") && polishCss.includes(".ui13-results-panel") && polishCss.includes(".ui13-assessment-chip"), "Run Check has dedicated responsive V13 formatting"],
  [polishCss.includes(".emp11-workspace-hero") && polishCss.includes(".emp11-overview-grid") && polishCss.includes(".emp11-tabs"), "Employer Hub has dedicated V13 workspace formatting"],
  [!hub.includes("orderBy(") && !polish.includes("orderBy("), "V12/V13 introduce no ordered/composite query"],
  [!hub.includes("MutationObserver") && !polish.includes("MutationObserver"), "Employer Hub and Interface V13 remain observer-free"],
  [css.includes(".emp12-owner-switcher") && css.includes(".emp12-owner-chooser"), "repair, chooser, and Owner switcher have dedicated styling"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (hubSyntax.status !== 0 && hubSyntax.stderr) console.error(hubSyntax.stderr);
if (polishSyntax.status !== 0 && polishSyntax.stderr) console.error(polishSyntax.stderr);
if (failed) process.exit(1);
console.log("\nEmployer Hub V12 + Interface V13 validation passed.");
