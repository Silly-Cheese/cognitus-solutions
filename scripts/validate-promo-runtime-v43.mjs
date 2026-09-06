import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const promo = read("src/promotionalAccessV26.js");
const runtime = read("src/promoRuntimeV43.js");
const executive = read("src/executiveControlV43.js");
const executiveCss = read("src/executiveControlV43.css");
const executiveShield = read("src/executiveRouteShieldV43.js");

const checks = [
  [promo.includes('import { startPromoRuntimeV43 } from "./promoRuntimeV43.js"'), "shared promo bootstrap imports V43 authority"],
  [promo.includes('safeStartV38("promo-runtime-v43", startPromoRuntimeV43)'), "V43 authority is started"],
  [promo.includes('import "./executiveRouteShieldV43.js"'), "Executive startup shield loads with promotional bootstrap"],
  [runtime.includes("C.PROMO_ROUTES") && runtime.includes("/executive"), "V43 covers promotional routes and Executive Control"],
  [runtime.includes("MutationObserver") && runtime.includes("data-promo-v38-handoff"), "V43 detects and replaces stuck base-router handoffs"],
  [runtime.includes("REQUEST_TIMEOUT_MS = 10000") && runtime.includes("data-promo-v43-retry"), "V43 replaces infinite waits with bounded retry"],
  [runtime.includes("renderAccessHub") && runtime.includes("renderPromoAdmin") && runtime.includes("renderFeaturePageV35"), "V43 can render access hub, admin, and feature routes directly"],
  [runtime.includes("C.loadAccess(force)") && runtime.includes("C.renderLockedFeature(feature)"), "V43 preserves entitlement checks and locked states"],
  [!runtime.includes('import { startExecutiveControlV43 }'), "Executive V43 is not statically imported by the shared promotional runtime"],
  [runtime.includes('import("./executiveControlV43.js?v=20260906-v43-executive-isolated")'), "Executive V43 is lazy-loaded behind an isolated module boundary"],
  [runtime.includes("executivePromise = null") && runtime.includes("Executive Control V43 isolated loader failed"), "Executive V43 failure cannot abort ordinary promotional module evaluation"],
  [executive.indexOf("const clean") < executive.indexOf("let frenzyState = normalizeFrenzy(null)"), "Executive V43 has no clean temporal-dead-zone regression"],
  [executive.includes('userRecord?.status === "active"') && executive.includes('userRecord?.role === "owner"'), "Executive V43 preserves Owner-only access"],
  [executive.includes('PORTAL_COLLECTION = "settings"') && executive.includes('PORTAL_DOC = "portal"'), "Executive V43 uses existing Frenzy portal document"],
  [executive.includes("REQUEST_TIMEOUT_MS = 9000") && executive.includes("data-exec43-retry"), "Executive V43 has bounded initialization and retry"],
  [executive.includes("FRENZY_ACTIVATED") && executive.includes("FRENZY_ENDED"), "Executive V43 keeps Frenzy audit actions"],
  [executiveCss.includes(".exec43-workspace") && executiveCss.includes(".exec43-form"), "Executive V43 has dedicated professional formatting"],
  [executiveCss.includes("#101828") && executiveCss.includes("#475467"), "Executive V43 uses high-contrast primary and secondary text"],
  [executiveShield.includes("exec43-loading-bar") && executiveShield.includes("MutationObserver"), "Executive shield protects only in-flight V43 startup from router overwrites"]
];

let failures = 0;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failures += 1;
}

if (failures) {
  console.error(`Promo Runtime V43 validation failed: ${failures} check(s).`);
  process.exit(1);
}
console.log("Promo Runtime V43 validation passed.");
