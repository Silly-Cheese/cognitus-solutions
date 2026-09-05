import { startPromotionalAccessV26 } from "./promo/promotionalCoreV26.js";
import { renderFeaturePageV33 } from "./promo/promotionalFeaturesV33.js";
import { renderAccessHub, renderPromoAdmin } from "./promo/promotionalAdminV26.js";
import { startPromotionalNavigationV27 } from "./promo/promotionalNavigationV27.js";
import { startPromotionalEnhancementsV28 } from "./promo/promotionalEnhancementsV28.js";
import { startPromotionalMobileV29 } from "./promo/promotionalMobileV29.js";
import { startPromotionalWorkspacesV30 } from "./promo/promotionalWorkspacesV30.js";
import { startPromotionalInvestigationsV32 } from "./promo/promotionalInvestigationV32.js";
import { startPromotionalRegistryV33 } from "./promo/promotionalRegistryV33.js";
import { startPromotionalContrastV33 } from "./promo/promotionalContrastV33.js";

startPromotionalContrastV33();
startPromotionalRegistryV33();
startPromotionalAccessV26({
  renderFeature: renderFeaturePageV33,
  renderAccessHub,
  renderAdmin: renderPromoAdmin
});
startPromotionalNavigationV27();
startPromotionalEnhancementsV28();
startPromotionalMobileV29();
startPromotionalWorkspacesV30();
startPromotionalInvestigationsV32();
