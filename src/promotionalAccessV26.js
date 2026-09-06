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
import { startPromoRuntimeV43 } from "./promoRuntimeV43.js";
import "./frenzySignalOverrideV35.js";

const LEGACY_BOOTSTRAP_KEY = "__COGNITUS_PROMOTIONAL_V37_STARTED__";
const BOOTSTRAP_KEY = "__COGNITUS_PROMOTIONAL_V38_STARTED__";
const ROUTE_BRIDGE_KEY = "__COGNITUS_PROMOTIONAL_ROUTE_BRIDGE_V38__";

function safeStartV38(label, starter) {
  try {
    const result = starter();
    result?.catch?.((error) => console.error(`Promotional optional layer failed: ${label}`, error));
  } catch (error) {
    console.error(`Promotional optional layer failed: ${label}`, error);
  }
}

if (!window[BOOTSTRAP_KEY]) {
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
    console.error("Promotional V26 compatibility router failed", error);
  });

  safeStartV38("professional-core-v35", startProfessionalCoreV35);
  safeStartV38("professional-finish-v35", startProfessionalFinishV35);
  safeStartV38("legal-policies-v34", startLegalPoliciesV34);
  safeStartV38("frenzy-v35", startFrenzyV35);
  safeStartV38("navigation-v27", startPromotionalNavigationV27);
  safeStartV38("enhancements-v28", startPromotionalEnhancementsV28);
  safeStartV38("mobile-v29", startPromotionalMobileV29);
  safeStartV38("workspaces-v30", startPromotionalWorkspacesV30);
  safeStartV38("investigations-v32", startPromotionalInvestigationsV32);
  safeStartV38("professional-contrast-v40", startProfessionalContrastV40);
  safeStartV38("professional-refine-v41", startProfessionalRefineV41);

  document.dispatchEvent(new CustomEvent("cognitus:promotional-v37-ready"));
  document.dispatchEvent(new CustomEvent("cognitus:promotional-v38-ready"));
}

// V43 starts outside the legacy bootstrap guard. The site has historically loaded
// this file under several cache-busted URLs, so any evaluated copy can recover the
// current promotional or Executive route while the V43 global key prevents duplicates.
safeStartV38("promo-runtime-v43", startPromoRuntimeV43);

if (!window[ROUTE_BRIDGE_KEY]) {
  window[ROUTE_BRIDGE_KEY] = true;
  document.addEventListener("cognitus:promo-route-requested", () => scheduleSync(false));
}
