import fs from "node:fs";

const nav = fs.readFileSync("src/promo/promotionalNavigationV27.js", "utf8");
const entry = fs.readFileSync("src/promotionalAccessV26.js", "utf8");

function must(source, text, label) {
  if (!source.includes(text)) throw new Error(`Promo Navigation V27 validation failed: missing ${label}`);
}

must(entry, 'startPromotionalNavigationV27', 'navigation bootstrap');
must(nav, '/admin/promotions', 'admin promotions route');
must(nav, '/promotional-access', 'promotional access route');
must(nav, 'Promotion Management', 'admin promotion management link');
must(nav, 'Promo Access', 'user promotional access primary link');
must(nav, 'runBoundedSync', 'bounded shell rebuild recovery');
must(nav, 'data-promo27-ops-group', 'operations directory group');
must(nav, 'Intelligence Center', 'intelligence discovery link');
must(nav, 'Cognitus Labs', 'labs discovery link');
if (nav.includes('MutationObserver')) throw new Error('Promo Navigation V27 validation failed: navigation must remain observer-free');

console.log("Promo Navigation V27 regression checks passed.");
