import fs from "node:fs";

const indexPath = "index.html";
const navPath = "src/navigationEnhancements.js";
let index = fs.readFileSync(indexPath, "utf8");
let nav = fs.readFileSync(navPath, "utf8");

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Promotions Visibility V37: missing ${label}`);
  return source.replace(from, to);
}

index = replaceRequired(
  index,
  './src/navigationEnhancements.js?v=20260905-v35-live',
  './src/navigationEnhancements.js?v=20260905-v37-promotions-visible',
  "navigation enhancements cache key"
);
index = replaceRequired(
  index,
  './src/navigationMobileV25.js?v=20260817-v25-dedicated-mobile-shell',
  './src/navigationMobileV25.js?v=20260905-v37-promotions-visible',
  "mobile navigation cache key"
);

const visibilityTag = '  <script type="module" src="./src/promotionsVisibilityV37.js?v=20260905-v37-promotions-visible"></script>\n';
if (!index.includes("promotionsVisibilityV37.js")) {
  index = replaceRequired(
    index,
    '  <script type="module" src="./src/navigationStateV23.js?v=20260817-v24-toggle"></script>\n',
    visibilityTag + '  <script type="module" src="./src/navigationStateV23.js?v=20260817-v24-toggle"></script>\n',
    "navigation state script insertion point"
  );
}

nav = replaceRequired(
  nav,
  'import "./promotionalAccessV26.js?v=20260905-v35-live";',
  'import "./promotionalAccessV26.js?v=20260905-v37-promotions-visible";',
  "promotional bootstrap import cache key"
);

if (!index.includes("20260905-v37-promotions-visible") || !index.includes("promotionsVisibilityV37.js")) {
  throw new Error("Promotions Visibility V37: production index was not fully wired.");
}
if (!nav.includes('promotionalAccessV26.js?v=20260905-v37-promotions-visible')) {
  throw new Error("Promotions Visibility V37: navigation bootstrap is stale.");
}

fs.writeFileSync(indexPath, index);
fs.writeFileSync(navPath, nav);
console.log("Promotions Visibility V37 production wiring materialized.");
