import { startPromotionalAccessV26 } from "./promo/promotionalCoreV26.js";
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
import { startFrenzyV35 } from "./frenzyV35.js";
import "./frenzySignalOverrideV35.js";

startProfessionalCoreV35();
startLegalPoliciesV34();
startFrenzyV35();
startPromotionalContrastV33();
startPromotionalRegistryV33();
startPromotionalRegistryV35();
startPromotionalAccessV26({
  renderFeature: renderFeaturePageV35,
  renderAccessHub,
  renderAdmin: renderPromoAdmin
});
startPromotionalNavigationV27();
startPromotionalEnhancementsV28();
startPromotionalMobileV29();
startPromotionalWorkspacesV30();
startPromotionalInvestigationsV32();
