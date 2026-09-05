import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const files = {
  index: read("index.html"),
  nav: read("src/navigationEnhancements.js"),
  mobile: read("src/navigationMobileV25.js"),
  promoEntry: read("src/promotionalAccessV26.js"),
  visibility: read("src/promotionsVisibilityV37.js"),
  css: read("src/promotionsVisibilityV37.css")
};

let failed = 0;
function check(name, condition) {
  if (condition) console.log(`PASS: ${name}`);
  else {
    failed += 1;
    console.error(`FAIL: ${name}`);
  }
}

check("index loads V37 visibility authority", files.index.includes('promotionsVisibilityV37.js?v=20260905-v37-promotions-visible'));
check("index cache-busts navigation enhancements for V37", files.index.includes('navigationEnhancements.js?v=20260905-v37-promotions-visible'));
check("index cache-busts mobile navigation for V37", files.index.includes('navigationMobileV25.js?v=20260905-v37-promotions-visible'));
check("navigation imports a freshly keyed promo bootstrap", files.nav.includes('promotionalAccessV26.js?v=20260905-v37-promotions-visible'));
check("promo bootstrap is globally idempotent", files.promoEntry.includes('__COGNITUS_PROMOTIONAL_V37_STARTED__'));
check("promo bootstrap emits the V37 readiness event", files.promoEntry.includes('cognitus:promotional-v37-ready'));
check("desktop gets a primary Intelligence entry", files.visibility.includes('data.promo37Primary') && files.visibility.includes('>Intelligence</span>'));
check("desktop gets an Intelligence operations group", files.visibility.includes('data.promo37OpsGroup') && files.visibility.includes('Analysis & access'));
check("desktop has a Feature Access fallback when the shell is unavailable", files.visibility.includes('ensureLegacyDesktopFallback') && files.visibility.includes('Open Cognitus Feature Access'));
check("mobile gets a primary Intelligence entry", files.visibility.includes('data.promo37MobilePrimary') && files.visibility.includes('Analysis, investigations, and feature access'));
check("mobile gets an Intelligence directory group", files.visibility.includes('data-promo37-mobile-group') && files.visibility.includes('mobileGroupMarkup'));
check("Feature Access is discoverable", files.visibility.includes('"/promotional-access", "Feature Access"'));
check("Feature Access Management is role-gated", files.visibility.includes('"/admin/promotions", "Feature Access Management"') && files.visibility.includes('ADMIN_ROLES.has(role)'));
check("Executive Control is Owner-gated", files.visibility.includes('"/executive", "Executive Control"') && files.visibility.includes('role === "owner"'));
check("visibility sync survives async navigation reconstruction", files.visibility.includes('MutationObserver') && files.visibility.includes('requestAnimationFrame'));
check("desktop operations rendering is idempotent", files.visibility.includes('promo37Signature') && files.visibility.includes('group.dataset.promo37Signature !== signature'));
check("native V25 drawer independently retains Intelligence", files.mobile.includes('label: "Intelligence"') && files.mobile.includes('"/promotional-access", "Feature Access"'));
check("native V25 drawer independently retains Owner Executive Control", files.mobile.includes('"/executive", "Executive Control"'));
check("V37 styling covers desktop and mobile visibility", files.css.includes('.promo37-primary') && files.css.includes('.promo37-mobile-primary') && files.css.includes('.promo37-mobile-group'));

if (failed) {
  console.error(`\nPromotions Visibility V37 validation failed: ${failed} check(s).`);
  process.exit(1);
}

console.log("\nPromotions Visibility V37 validation passed.");
