import { startPromotionalAccessV26 } from "./promo/promotionalCoreV26.js";
import { renderFeaturePage } from "./promo/promotionalFeaturesV26.js";
import { renderAccessHub, renderPromoAdmin } from "./promo/promotionalAdminV26.js";
import { startPromotionalNavigationV27 } from "./promo/promotionalNavigationV27.js";
import { startPromotionalEnhancementsV28 } from "./promo/promotionalEnhancementsV28.js";

startPromotionalAccessV26({
  renderFeature: renderFeaturePage,
  renderAccessHub,
  renderAdmin: renderPromoAdmin
});
startPromotionalNavigationV27();
startPromotionalEnhancementsV28();
