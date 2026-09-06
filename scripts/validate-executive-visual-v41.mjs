import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const executive = read("src/executiveControlV41.js");
const executiveCss = read("src/executiveControlV41.css");
const refine = read("src/professionalRefineV41.js");
const refineCss = read("src/professionalRefineV41.css");
const loader = read("src/promotionalAccessV26.js");

const checks = [
  [executive.includes('const ROUTE = "/executive"'), "Executive V41 owns /executive"],
  [executive.includes("data-executive-v41-page") && executive.includes("data-executive-v35-page"), "Executive V41 preserves the V35 ownership marker to prevent legacy overwrite"],
  [executive.includes("REQUEST_TIMEOUT_MS") && executive.includes("withTimeout"), "Executive V41 has bounded network waits"],
  [executive.includes("Retry Executive Control") && executive.includes("data-exec41-retry"), "Executive V41 exposes a recoverable retry state"],
  [executive.includes('userRecord.role !== "owner"') && executive.includes('userRecord.status !== "active"'), "Executive V41 requires an active Owner account"],
  [executive.includes('PORTAL_COLLECTION = "settings"') && executive.includes('PORTAL_DOC = "portal"'), "Executive V41 uses the existing settings/portal event state"],
  [executive.includes("FRENZY_ACTIVATED") && executive.includes("FRENZY_ENDED"), "Executive V41 preserves Frenzy audit events"],
  [executiveCss.includes(".exec41-workspace") && executiveCss.includes(".exec41-form"), "Executive V41 has dedicated workspace and form formatting"],
  [executiveCss.includes("#0f172a") && executiveCss.includes("#ffffff"), "Executive V41 defines strong light-surface contrast"],
  [refine.includes("professionalRefineV41.css?v=20260905-v41"), "Professional Refine V41 mounts its versioned stylesheet"],
  [refine.includes("requestAnimationFrame") && refine.includes("cognitus-refined-v41"), "Professional Refine V41 stays last in the visual cascade"],
  [refineCss.includes("--c41-text: #0f172a") && refineCss.includes("--c41-muted: #526173"), "V41 uses readable primary and secondary text tokens"],
  [refineCss.includes('input:not([type="checkbox"])') && refineCss.includes("min-height: 46px"), "V41 standardizes readable form controls"],
  [refineCss.includes(".signal35-panel") && refineCss.includes(".frenzy35-banner"), "V41 preserves deliberate dark Frenzy and Signal Zero surfaces"],
  [loader.includes('startExecutiveControlV41') && loader.includes('safeStartV38("executive-control-v41"'), "Promotional loader starts Executive V41"],
  [loader.includes('startProfessionalRefineV41') && loader.includes('safeStartV38("professional-refine-v41"'), "Promotional loader starts final visual V41 after V40"],
  [loader.indexOf('safeStartV38("executive-control-v41"') < loader.indexOf('safeStartV38("frenzy-v35"'), "Executive V41 claims the route before Frenzy V35 initializes"],
  [loader.indexOf('safeStartV38("professional-contrast-v40"') < loader.indexOf('safeStartV38("professional-refine-v41"'), "V41 visual refinement starts after V40 contrast"],
  [loader.includes("result?.catch?."), "Optional async startup failures are caught instead of becoming unhandled rejections"]
];

let failed = 0;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Executive/Visual V41 validation failed: ${failed} check(s).`);
  process.exit(1);
}

console.log("Executive/Visual V41 validation passed.");
