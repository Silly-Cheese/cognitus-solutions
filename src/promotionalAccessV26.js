import { scheduleSync, startPromotionalAccessV26 } from "./promo/promotionalCoreV26.js";
import { renderFeaturePageV35 } from "./promo/promotionalFeaturesV35.js";
import { renderAccessHub, renderPromoAdmin } from "./promo/promotionalAdminV26.js";
import { startPromotionalNavigationV27 } from "./promo/promotionalNavigationV27.js";
import { startPromotionalEnhancementsV28 } from "./promo/promotionalEnhancementsV28.js";
import { startPromotionalMobileV29 } from "./promo/promotionalMobileV29.js";
import { startPromotionalWorkspacesV30 } from "./promo/promotionalWorkspacesV30.js";
import { startPromotionalInvestigationsV32 } from "./promo/promotionalInvestigationV32.js";
import { startPromotionalRegistryV33 } from "./promo/promotionalRegistryV33.js";
import { startPromotionalContrastV33 } from "./promo/promotionalContrastV33.js";
import { startPromotionalRegistryV35 } from "./promo/promotionalRegistryV35.js";
import { startLegalPoliciesV34 } from "./legalPoliciesV34.js";
import { startProfessionalCoreV35 } from "./professionalCoreV35.js";
import { startProfessionalFinishV35 } from "./professionalFinishV35.js";
import { startProfessionalContrastV40 } from "./professionalContrastV40.js";
import { startProfessionalRefineV41 } from "./professionalRefineV41.js";
import { startFrenzyV35 } from "./frenzyV35.js";
import "./frenzySignalOverrideV35.js";

const LEGACY_BOOTSTRAP_KEY = "__COGNITUS_PROMOTIONAL_V37_STARTED__";
const BOOTSTRAP_KEY = "__COGNITUS_PROMOTIONAL_V38_STARTED__";
const ROUTE_BRIDGE_KEY = "__COGNITUS_PROMOTIONAL_ROUTE_BRIDGE_V38__";
const EXECUTIVE_ROUTE = "/executive";
let executiveLayerPromiseV42 = null;

function currentRouteV42() {
  return location.hash.replace(/^#/, "").split("?")[0] || "/";
}

function safeStartV38(label, starter) {
  try {
    const result = starter();
    result?.catch?.((error) => console.error(`Promotional V38 optional layer failed: ${label}`, error));
  } catch (error) {
    console.error(`Promotional V38 optional layer failed: ${label}`, error);
  }
}

function startExecutiveLayerV42() {
  if (currentRouteV42() !== EXECUTIVE_ROUTE) return Promise.resolve(false);
  if (!executiveLayerPromiseV42) {
    executiveLayerPromiseV42 = import("./executiveControlV42.js?v=20260905-v42-promo-isolation")
      .then((module) => module.startExecutiveControlV42())
      .catch((error) => {
        executiveLayerPromiseV42 = null;
        console.error("Executive Control V42 isolated loader failed", error);
        return false;
      });
  }
  return executiveLayerPromiseV42;
}

if (!window[BOOTSTRAP_KEY]) {
  // Register route definitions first, but never let a presentation layer prevent the core router from starting.
  safeStartV38("contrast-v33", startPromotionalContrastV33);
  safeStartV38("registry-v33", startPromotionalRegistryV33);
  safeStartV38("registry-v35", startPromotionalRegistryV35);

  const criticalRouter = startPromotionalAccessV26({
    renderFeature: renderFeaturePageV35,
    renderAccessHub,
    renderAdmin: renderPromoAdmin
  });
  window[BOOTSTRAP_KEY] = true;
  window[LEGACY_BOOTSTRAP_KEY] = true;
  criticalRouter?.catch?.((error) => {
    console.error("Promotional V38 critical router failed", error);
    window[BOOTSTRAP_KEY] = false;
  });

  // Everything below is enhancement-only. A failure here must never take route ownership away from Promotions.
  safeStartV38("professional-core-v35", startProfessionalCoreV35);
  safeStartV38("professional-finish-v35", startProfessionalFinishV35);
  safeStartV38("legal-policies-v34", startLegalPoliciesV34);

  // Executive Control is deliberately lazy-loaded. A bug in the Owner-only page can no longer
  // abort module evaluation for Feature Access, Intelligence, Labs, Investigations, or other promo routes.
  safeStartV38("executive-control-v42", startExecutiveLayerV42);
  safeStartV38("frenzy-v35", startFrenzyV35);

  safeStartV38("navigation-v27", startPromotionalNavigationV27);
  safeStartV38("enhancements-v28", startPromotionalEnhancementsV28);
  safeStartV38("mobile-v29", startPromotionalMobileV29);
  safeStartV38("workspaces-v30", startPromotionalWorkspacesV30);
  safeStartV38("investigations-v32", startPromotionalInvestigationsV32);

  // V40 resolves old promo dark-surface assumptions. V41 remains the final spacing,
  // form, hierarchy, and readability authority for normal Cognitus surfaces.
  safeStartV38("professional-contrast-v40", startProfessionalContrastV40);
  safeStartV38("professional-refine-v41", startProfessionalRefineV41);

  window.addEventListener("hashchange", () => {
    if (currentRouteV42() === EXECUTIVE_ROUTE) safeStartV38("executive-control-v42", startExecutiveLayerV42);
  });

  document.dispatchEvent(new CustomEvent("cognitus:promotional-v37-ready"));
  document.dispatchEvent(new CustomEvent("cognitus:promotional-v38-ready"));
}

if (!window[ROUTE_BRIDGE_KEY]) {
  window[ROUTE_BRIDGE_KEY] = true;
  document.addEventListener("cognitus:promo-route-requested", () => {
    scheduleSync(false);
    if (currentRouteV42() === EXECUTIVE_ROUTE) safeStartV38("executive-control-v42", startExecutiveLayerV42);
  });
}
