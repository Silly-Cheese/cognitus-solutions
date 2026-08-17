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
  [polishSyntax.status === 0, "Interface V14 JavaScript syntax is valid"],
  [nav.includes('import "./employerHubFixV12.js"'), "production navigation loads Employer Hub V12 reconciliation"],
  [hub.includes('import "./interfacePolishV13.js"'), "Employer Hub reconciliation loads the compatibility Interface module"],
  [hub.includes('readDoc("organizations", value)') && hub.includes('readWhere("organizations", "cognitusId", "==", value)'), "organization assignment resolves both Firestore IDs and Cognitus organization IDs"],
  [hub.includes('readDoc("employerStatusRequests", authUser.uid)') && hub.includes('request.status !== "approved"'), "approved Employer Status is available as an organization fallback"],
  [hub.includes('Fire.updateDoc(Fire.doc(db, "users", authUser.uid)') && hub.includes("organizationId: org.id"), "Owner/Admin stale organization references can be normalized to the real document ID"],
  [hub.includes("ownerChooser") && hub.includes("data-emp12-select-org"), "Owners without a usable assignment receive an organization chooser instead of a dead-end gate"],
  [hub.includes("enhanceOwnerSwitcher") && hub.includes("Switch Employer Hub organization"), "Owners can switch Employer Hub organizations from the active workspace"],
  [hub.includes('verificationStatus === "verified"'), "Owner workspace selection is limited to verified organizations"],
  [polish.includes("EMPLOYER_ROLES") && polish.includes("data-ui14-employer-hub") && polish.includes('link.href = "#/employer"'), "Interface V14 owns a stable Employer Hub destination independent of the V11 compatibility link"],
  [polish.includes("hideLegacyEmployerLinks") && polish.includes('link.hidden = true') && polishCss.includes('.topnav>[data-emp11-nav]{display:none!important}'), "legacy Employer Hub injection is neutralized instead of racing the visible navigation link"],
  [polish.includes('nav.insertBefore(link, search)') && polish.includes("2600"), "stable Employer Hub is restored after bounded navigation synchronization"],
  [polish.includes('event.target?.id === "search-form"') && polish.includes("setInterval") && polish.includes("20000"), "Run Check waits for asynchronous results with a bounded search-only watcher"],
  [polish.includes("ui14-results-summary") && polish.includes("ui14-assessment-grid") && polish.includes("Continue the screening review"), "Run Check results are rebuilt into the V14 screening format"],
  [polish.includes('services.Fire.getDoc') && polish.includes('linkedUserId || profile.claimedByUid') && polish.includes("claimLink.remove()"), "claimed profiles remove the Claim Profile action using the authoritative profile record"],
  [polish.includes('claimLink.hidden = true') && polish.includes('claimLink.hidden = false'), "claim action stays hidden while claim status is being resolved to avoid a misleading flash"],
  [polishCss.includes(".ui14-results-summary") && polishCss.includes(".ui14-result-card") && polishCss.includes(".ui14-metric"), "Run Check has a dedicated responsive V14 results presentation"],
  [polishCss.includes(".cognitus-employer-v14") && polishCss.includes(".emp11-workspace-hero") && polishCss.includes(".emp11-tabs"), "Employer Hub retains dedicated V14 workspace formatting"],
  [!hub.includes("orderBy(") && !polish.includes("orderBy("), "V12/V14 introduce no ordered/composite query"],
  [!hub.includes("MutationObserver") && !polish.includes("MutationObserver"), "Employer Hub and Interface V14 remain observer-free"],
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
console.log("\nEmployer Hub V12 + Interface V14 validation passed.");
