import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const executive = read("src/executiveControlV41.js");
const executiveV43 = read("src/executiveControlV43.js");
const executiveV43Css = read("src/executiveControlV43.css");
const runtimeV43 = read("src/promoRuntimeV43.js");
const executiveCss = read("src/executiveControlV41.css");
const refine = read("src/professionalRefineV41.js");
const refineCss = read("src/professionalRefineV41.css");
const loader = read("src/promotionalAccessV26.js");

const checks = [
  [executive.includes('const ROUTE = "/executive"'), "Executive V41 remains available as historical full workspace"],
  [executiveCss.includes(".exec41-workspace") && executiveCss.includes(".exec41-form"), "Executive V41 styling remains intact"],
  [refine.includes("professionalRefineV41.css?v=20260905-v41"), "Professional Refine V41 mounts its versioned stylesheet"],
  [refineCss.includes("--c41-text: #0f172a") && refineCss.includes("--c41-muted: #526173"), "V41 uses readable primary and secondary text tokens"],
  [refineCss.includes('input:not([type="checkbox"])') && refineCss.includes("min-height: 46px"), "V41 standardizes readable form controls"],
  [refineCss.includes(".signal35-panel") && refineCss.includes(".frenzy35-banner"), "V41 preserves deliberate dark Frenzy and Signal Zero surfaces"],

  [executiveV43.includes('const ROUTE = "/executive"'), "Executive V43 owns /executive"],
  [executiveV43.indexOf("const clean") < executiveV43.indexOf("let frenzyState = normalizeFrenzy(null)"), "Executive V43 initializes clean before normalized Frenzy state"],
  [executiveV43.includes("REQUEST_TIMEOUT_MS = 9000") && executiveV43.includes("withTimeout"), "Executive V43 has bounded secure-session waits"],
  [executiveV43.includes("data-exec43-retry") && executiveV43.includes("Retry Executive Control"), "Executive V43 exposes retry instead of infinite loading"],
  [executiveV43.includes('userRecord?.status === "active"') && executiveV43.includes('userRecord?.role === "owner"'), "Executive V43 requires an active Owner account"],
  [executiveV43.includes('PORTAL_COLLECTION = "settings"') && executiveV43.includes('PORTAL_DOC = "portal"'), "Executive V43 uses settings/portal Frenzy state"],
  [executiveV43.includes("FRENZY_ACTIVATED") && executiveV43.includes("FRENZY_ENDED"), "Executive V43 preserves Frenzy audit actions"],
  [executiveV43.includes("MutationObserver") && executiveV43.includes("data-executive-v43-page"), "Executive V43 reclaims the route if the base router overwrites it"],
  [executiveV43Css.includes(".exec43-workspace") && executiveV43Css.includes(".exec43-form"), "Executive V43 has dedicated professional workspace formatting"],
  [executiveV43Css.includes("#101828") && (executiveV43Css.includes("#ffffff") || executiveV43Css.includes("#fff")), "Executive V43 defines strong light-surface contrast"],

  [runtimeV43.includes("REQUEST_TIMEOUT_MS = 10000") && runtimeV43.includes("withTimeout"), "Promo Runtime V43 bounds promotional route waits"],
  [runtimeV43.includes("data-promo-v43-retry") && runtimeV43.includes("claimRoute(true)"), "Promo Runtime V43 exposes route retry"],
  [runtimeV43.includes("[data-promo-v38-handoff]") && runtimeV43.includes("MutationObserver"), "Promo Runtime V43 recovers base-router handoff overwrites"],
  [runtimeV43.includes("startExecutiveControlV43"), "Promo Runtime V43 delegates Executive Control to isolated V43"],

  [loader.includes('import { startPromoRuntimeV43 } from "./promoRuntimeV43.js'), "Promotional bootstrap imports V43 runtime"],
  [loader.includes('safeStartV38("promo-runtime-v43", startPromoRuntimeV43)'), "Promotional bootstrap starts V43 runtime"],
  [loader.indexOf('safeStartV38("promo-runtime-v43", startPromoRuntimeV43)') > loader.indexOf("if (!window[BOOTSTRAP_KEY])"), "V43 runtime startup is not dependent on legacy bootstrap ownership"],
  [loader.indexOf('safeStartV38("professional-contrast-v40"') < loader.indexOf('safeStartV38("professional-refine-v41"'), "V41 visual refinement still starts after V40 contrast"],
  [loader.includes("result?.catch?."), "Optional async startup failures remain isolated"]
];

let failed = 0;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`Executive/Visual V41+V43 validation failed: ${failed} check(s).`);
  process.exit(1);
}

console.log("Executive/Visual V41+V43 validation passed.");
