import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const index = read("index.html");
const app = read("src/app.js");
const promo = read("src/promotionalAccessV26.js");

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`PASS: ${label}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}`);
  }
}

check("index loads fresh V38 base router", index.includes('src/app.js?v=20260905-v38-promo-router'));
check("index independently loads a versioned promo bootstrap", /src\/promotionalAccessV26\.js\?v=20260905-v(?:38-router-handoff|40-contrast|41-executive-visual)/.test(index));
check("base router declares V38 promotional routes", app.includes("PROMOTIONAL_ROUTES_V38") && app.includes('"/promotional-access"') && app.includes('"/admin/promotions"') && app.includes('"/executive"') && app.includes('"/signal-zero"'));
check("base router recognizes promo routes before ordinary route dispatch", app.indexOf("if (isPromotionalRouteV38(current))") > -1 && app.indexOf("if (isPromotionalRouteV38(current))") < app.indexOf('if (current === "/")'));
check("base router hands promo routes to fresh bootstrap", app.includes('import("./promotionalAccessV26.js?v=20260905-v38-router-handoff")'));
check("route handoff emits explicit promo route request", app.includes('cognitus:promo-route-requested'));
check("promo bootstrap uses fresh V38 guard", promo.includes('__COGNITUS_PROMOTIONAL_V38_STARTED__'));
check("promo bootstrap retains legacy V37 compatibility guard", promo.includes('__COGNITUS_PROMOTIONAL_V37_STARTED__'));
check("promo bootstrap imports scheduleSync bridge", promo.includes('import { scheduleSync, startPromotionalAccessV26 }'));
check("critical promo router starts before optional professional layers", promo.indexOf("const criticalRouter = startPromotionalAccessV26") > -1 && promo.indexOf("const criticalRouter = startPromotionalAccessV26") < promo.indexOf('safeStartV38("professional-core-v35"'));
check("optional layer failures are isolated", promo.includes("function safeStartV38") && promo.includes("Promotional V38 optional layer failed"));
check(
  "promo route bridge resyncs core router",
  promo.includes('document.addEventListener("cognitus:promo-route-requested"') && promo.includes("scheduleSync(false)")
);
check("Executive route is isolated from shared promo module evaluation", !promo.includes('import { startExecutiveControlV41 }') && promo.includes('import("./executiveControlV42.js?v=20260905-v42-promo-isolation")'));
check("unknown routes still retain normal 404", app.includes('hero("404", "Page not found."'));
check("promo handoff executes before generic 404", app.indexOf("if (isPromotionalRouteV38(current))") < app.indexOf('hero("404", "Page not found."'));

if (failures) {
  console.error(`\nPromo Router V38 validation failed: ${failures} check(s).`);
  process.exit(1);
}
console.log("\nPromo Router V38 validation passed.");
