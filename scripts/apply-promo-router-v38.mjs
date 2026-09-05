import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value);
const requireText = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`V38 materializer: missing ${label}`);
};

// 1) Make the production router explicitly hand promotional routes to the promotional application.
let app = read("src/app.js");
const routeAnchor = 'function route() { return location.hash.replace(/^#/, "").split("?")[0] || "/"; }\n';
requireText(app, routeAnchor, "route helper anchor");
if (!app.includes("PROMOTIONAL_ROUTES_V38")) {
  const routeHandoff = `${routeAnchor}const PROMOTIONAL_ROUTES_V38 = new Set([\n  "/intelligence",\n  "/relationships",\n  "/deep-history",\n  "/advanced-search",\n  "/compare",\n  "/network",\n  "/watchlist",\n  "/investigations",\n  "/intelligence-reports",\n  "/change-comparison",\n  "/labs",\n  "/enhanced-profile",\n  "/collections",\n  "/analytics",\n  "/early-access",\n  "/risk-matrix",\n  "/overlap-scanner",\n  "/signal-zero",\n  "/promotional-access",\n  "/admin/promotions",\n  "/executive"\n]);\nlet promotionalRouteImportV38 = null;\nfunction isPromotionalRouteV38(value) { return PROMOTIONAL_ROUTES_V38.has(value); }\nasync function handoffPromotionalRouteV38(current) {\n  if (!isPromotionalRouteV38(current)) return false;\n  const hasPromoSurface = Boolean(root?.querySelector(\n    ".promo26-access-hero, .promo26-admin-hero, .promo26-feature-hero, .promo26-locked-page, [data-promo-v26-page]"\n  ));\n  if (!hasPromoSurface && route() === current) {\n    root.innerHTML = '<section class="hero" data-promo-v38-handoff><p class="eyebrow">Cognitus Feature Access</p><h1>Loading secure feature access…</h1><p>Preparing the promotional and intelligence workspace for this account.</p></section>';\n  }\n  document.dispatchEvent(new CustomEvent("cognitus:promo-route-requested", { detail: { route: current, source: "app-v38-before-import" } }));\n  if (!promotionalRouteImportV38) {\n    promotionalRouteImportV38 = import("./promotionalAccessV26.js?v=20260905-v38-router-handoff").catch((error) => {\n      promotionalRouteImportV38 = null;\n      throw error;\n    });\n  }\n  await promotionalRouteImportV38;\n  if (route() === current) {\n    document.dispatchEvent(new CustomEvent("cognitus:promo-route-requested", { detail: { route: current, source: "app-v38-after-import" } }));\n  }\n  return true;\n}\n`;
  app = app.replace(routeAnchor, routeHandoff);
}

const currentAnchor = '    const current = route();\n    if (current === "/") return homePage();';
requireText(app, currentAnchor, "main router current-route anchor");
if (!app.includes("await handoffPromotionalRouteV38(current)")) {
  app = app.replace(
    currentAnchor,
    '    const current = route();\n    if (isPromotionalRouteV38(current)) {\n      await handoffPromotionalRouteV38(current);\n      return;\n    }\n    if (current === "/") return homePage();'
  );
}
write("src/app.js", app);

// 2) Make the promotional bootstrap critical-router-first and recover from the poisoned V37 guard.
let promo = read("src/promotionalAccessV26.js");
promo = promo.replace(
  'import { startPromotionalAccessV26 } from "./promo/promotionalCoreV26.js";',
  'import { scheduleSync, startPromotionalAccessV26 } from "./promo/promotionalCoreV26.js";'
);
const bootstrapMarker = 'const BOOTSTRAP_KEY = "__COGNITUS_PROMOTIONAL_V37_STARTED__";';
requireText(promo, bootstrapMarker, "V37 bootstrap marker");
const bootstrapIndex = promo.indexOf(bootstrapMarker);
promo = promo.slice(0, bootstrapIndex) + `const LEGACY_BOOTSTRAP_KEY = "__COGNITUS_PROMOTIONAL_V37_STARTED__";\nconst BOOTSTRAP_KEY = "__COGNITUS_PROMOTIONAL_V38_STARTED__";\nconst ROUTE_BRIDGE_KEY = "__COGNITUS_PROMOTIONAL_ROUTE_BRIDGE_V38__";\n\nfunction safeStartV38(label, starter) {\n  try {\n    starter();\n  } catch (error) {\n    console.error(\`Promotional V38 optional layer failed: \${label}\`, error);\n  }\n}\n\nif (!window[BOOTSTRAP_KEY]) {\n  // Register route definitions first, but never let a presentation layer prevent the core router from starting.\n  safeStartV38("contrast-v33", startPromotionalContrastV33);\n  safeStartV38("registry-v33", startPromotionalRegistryV33);\n  safeStartV38("registry-v35", startPromotionalRegistryV35);\n\n  const criticalRouter = startPromotionalAccessV26({\n    renderFeature: renderFeaturePageV35,\n    renderAccessHub,\n    renderAdmin: renderPromoAdmin\n  });\n  window[BOOTSTRAP_KEY] = true;\n  window[LEGACY_BOOTSTRAP_KEY] = true;\n  criticalRouter?.catch?.((error) => {\n    console.error("Promotional V38 critical router failed", error);\n    window[BOOTSTRAP_KEY] = false;\n  });\n\n  // Everything below is enhancement-only. A failure here must not take route ownership away from Promotions.\n  safeStartV38("professional-core-v35", startProfessionalCoreV35);\n  safeStartV38("professional-finish-v35", startProfessionalFinishV35);\n  safeStartV38("legal-policies-v34", startLegalPoliciesV34);\n  safeStartV38("frenzy-v35", startFrenzyV35);\n  safeStartV38("navigation-v27", startPromotionalNavigationV27);\n  safeStartV38("enhancements-v28", startPromotionalEnhancementsV28);\n  safeStartV38("mobile-v29", startPromotionalMobileV29);\n  safeStartV38("workspaces-v30", startPromotionalWorkspacesV30);\n  safeStartV38("investigations-v32", startPromotionalInvestigationsV32);\n\n  document.dispatchEvent(new CustomEvent("cognitus:promotional-v37-ready"));\n  document.dispatchEvent(new CustomEvent("cognitus:promotional-v38-ready"));\n}\n\nif (!window[ROUTE_BRIDGE_KEY]) {\n  window[ROUTE_BRIDGE_KEY] = true;\n  document.addEventListener("cognitus:promo-route-requested", () => scheduleSync(false));\n}\n`;
write("src/promotionalAccessV26.js", promo);

// 3) Load Promotions independently from index.html and force the new app router URL.
let index = read("index.html");
const appScriptPattern = /<script type="module" src="\.\/src\/app\.js\?v=[^"]+"><\/script>/;
if (!appScriptPattern.test(index)) throw new Error("V38 materializer: app script tag not found");
index = index.replace(appScriptPattern, '<script type="module" src="./src/app.js?v=20260905-v38-promo-router"></script>');
const directPromoScript = '  <script type="module" src="./src/promotionalAccessV26.js?v=20260905-v38-router-handoff"></script>\n';
if (!index.includes("promotionalAccessV26.js?v=20260905-v38-router-handoff")) {
  const appLine = '  <script type="module" src="./src/app.js?v=20260905-v38-promo-router"></script>\n';
  requireText(index, appLine, "updated app script line");
  index = index.replace(appLine, appLine + directPromoScript);
}
write("index.html", index);

console.log("Applied Promotional Router V38 production handoff.");
