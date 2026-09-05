import fs from "node:fs";

const entry = fs.readFileSync("src/promotionalAccessV26.js", "utf8");
const mobile = fs.readFileSync("src/promo/promotionalMobileV29.js", "utf8");
const baseMobile = fs.readFileSync("src/navigationMobileV25.js", "utf8");
const css = fs.readFileSync("src/promotionalMobileV29.css", "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Promotional Mobile V29 validation failed: missing ${label}`);
}
function forbid(source, text, label) {
  if (source.includes(text)) throw new Error(`Promotional Mobile V29 validation failed: ${label}`);
}

requireText(entry, 'startPromotionalMobileV29', 'mobile startup import/call');
requireText(mobile, '<p>Intelligence</p>', 'consolidated mobile Intelligence directory');
requireText(mobile, 'Feature Access', 'mobile feature access entry');
requireText(mobile, 'Feature Access Management', 'mobile admin feature-access management entry');
requireText(mobile, 'Executive Control', 'mobile Owner executive control entry');
requireText(mobile, '/promotional-access', 'mobile access hub route');
requireText(mobile, '/intelligence', 'mobile intelligence route');
requireText(mobile, '/labs', 'mobile labs route');
requireText(mobile, 'MOBILE_BREAKPOINT = 1180', 'shared mobile breakpoint');
requireText(mobile, 'observeDrawer', 'targeted drawer reconstruction observer');
requireText(mobile, 'requestAnimationFrame', 'frame-coalesced mobile sync');
forbid(mobile, 'nav29-promo-primary', 'legacy dedicated Promo Access primary tile remains');

// V36 fallback: the dedicated mobile shell must contain the Intelligence
// directory natively so it cannot disappear because of module timing.
requireText(baseMobile, 'label: "Intelligence"', 'native mobile Intelligence group');
requireText(baseMobile, 'promo29: true', 'promo directory fallback marker');
requireText(baseMobile, 'data-promo29-mobile-group', 'mobile promo group compatibility marker');
requireText(baseMobile, '/promotional-access', 'native Feature Access route');
requireText(baseMobile, '/admin/promotions', 'native Feature Access Management route');
requireText(baseMobile, '/executive', 'native Owner Executive Control route');

requireText(css, '@media(max-width:1180px)', 'tablet/mobile responsive rules');
requireText(css, '@media(max-width:720px)', 'phone responsive rules');
requireText(css, '.promo26-lock-backdrop', 'mobile lock modal treatment');
requireText(css, '.promo26-admin-tabs', 'mobile admin tab treatment');
requireText(css, '.promo28-account-select', 'mobile direct assignment selector');
requireText(css, '.promo26-network-map', 'mobile relationship/network layout');
requireText(css, '.promo26-compare-table', 'mobile comparison layout');
requireText(css, 'font-size:16px!important', 'iOS-safe form input sizing');
requireText(css, '100dvh', 'dynamic mobile viewport handling');

console.log("Promotional Access V29 mobile regression checks passed.");
