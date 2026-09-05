import fs from "node:fs";

const entry = fs.readFileSync("src/promotionalAccessV26.js", "utf8");
const mobile = fs.readFileSync("src/promo/promotionalMobileV29.js", "utf8");
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
forbid(mobile, 'data-promo29-mobile-primary', 'legacy dedicated Promo Access primary tile remains');
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
