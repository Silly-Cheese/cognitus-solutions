import fs from "node:fs";

const nav = fs.readFileSync("src/promo/promotionalNavigationV27.js", "utf8");
const entry = fs.readFileSync("src/promotionalAccessV26.js", "utf8");

function must(source, text, label) {
  if (!source.includes(text)) throw new Error(`Promo Navigation V27 validation failed: missing ${label}`);
}
function mustNot(source, text, label) {
  if (source.includes(text)) throw new Error(`Promo Navigation V27 validation failed: ${label}`);
}

must(entry, 'startPromotionalNavigationV27', 'navigation bootstrap');
must(nav, '/admin/promotions', 'admin feature-access route');
must(nav, '/promotional-access', 'feature access route');
must(nav, 'Feature Access Management', 'admin feature-access management link');
must(nav, 'Feature Access', 'user feature-access link');
must(nav, 'data-promo27-ops-group', 'operations directory group');
must(nav, 'Analysis & research', 'professional Intelligence directory heading');
must(nav, 'Intelligence Center', 'intelligence discovery link');
must(nav, 'Cognitus Labs', 'labs discovery link');
must(nav, 'Executive Control', 'Owner executive control link');
must(nav, 'MutationObserver', 'shell reconstruction observer');
must(nav, 'requestAnimationFrame', 'frame-coalesced navigation updates');
mustNot(nav, 'class="nav20-primary-link promo27-primary', 'legacy top-level promotional primary navigation remains');
mustNot(nav, 'runBoundedSync', 'legacy bounded shell rebuild polling remains');
mustNot(nav, '[80, 180, 360, 700, 1200, 2200, 4000]', 'legacy retry schedule remains');

console.log("Promo Navigation V27 regression checks passed.");
