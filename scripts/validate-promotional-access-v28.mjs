import fs from "node:fs";

const enhancement = fs.readFileSync("src/promo/promotionalEnhancementsV28.js", "utf8");
const css = fs.readFileSync("src/promotionalAccessV28.css", "utf8");
const entry = fs.readFileSync("src/promotionalAccessV26.js", "utf8");

function must(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Promotional Access V28 validation failed: missing ${label}`);
}
function mustNot(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Promotional Access V28 validation failed: ${label}`);
}

must(entry, "startPromotionalEnhancementsV28", "V28 production bootstrap");
must(enhancement, 'readWhere("promoRedemptions", "uid", "==", C.authUser.uid', "authorized own-redemptions lookup");
mustNot(enhancement, "transaction.get(redemptionRef)", "redemption transaction still reads a possibly missing redemption document");
must(enhancement, 'select.name = "uid"', "direct-grant account dropdown");
must(enhancement, 'readCollection("users", 500)', "admin account directory loading");
must(enhancement, "promo28-account-preview", "selected-account preview");
must(enhancement, "decorateFeatureHero", "feature workspace enhancement");
must(enhancement, "decorateCatalog", "feature catalog enhancement");
must(css, ".promo28-card-icon", "feature icon styling");
must(css, ".promo28-account-select", "account picker styling");
must(css, ".promo26-network-map", "network workspace redesign");
must(css, "@media(max-width:720px)", "mobile promotional layout");

console.log("Promotional Access V28 regression checks passed.");
