import fs from "node:fs";

const shell = fs.readFileSync("src/navigationShellV20.js", "utf8");
const css = fs.readFileSync("src/navigationV20.css", "utf8");
const entry = fs.readFileSync("src/employerPeopleSearchV18.js", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Navigation V20 validation failed: ${message}`);
}

assert(entry.includes('import "./navigationShellV20.js";'), "production module chain does not load Navigation V20");
for (const destination of ["/dashboard", "/profile", "/employer", "/search", "/reports", "/actions"]) {
  assert(shell.includes(`"${destination}"`), `missing primary destination ${destination}`);
}
for (const destination of ["/history", "/reports/submit", "/claims", "/appeals", "/privacy-center", "/organizations", "/employer-status", "/employer/members", "/review", "/admin", "/audit", "/people-integrity", "/system-health"]) {
  assert(shell.includes(`"${destination}"`), `missing Operations destination ${destination}`);
}
assert(shell.includes("EMPLOYER_ROLES"), "Employer Hub visibility is not role-aware");
assert(shell.includes("ADMIN_ROLES"), "staff Operations are not role-aware");
assert(shell.includes("sourceActionCount"), "Action Center count is not integrated");
assert(shell.includes("data-nav20-logout"), "direct Logout control is missing");
assert(shell.includes("data-nav20-settings"), "direct Settings control is missing");
assert(shell.includes("data-nav20-mobile-toggle"), "mobile menu control is missing");
assert(shell.includes("aria-expanded"), "menu accessibility state is missing");
assert(shell.includes("routeHref"), "V20 links do not use the isolated route helper");
assert(shell.includes('`./#${path}`'), "V20 links are not isolated from the legacy #/ link mover");
assert(shell.includes('matches?.(\'a[href="#/dashboard"]\')'), "V20 must retain a source-only compatibility check for authentication");
assert(!shell.includes('primaryLink("#/'), "V20 primary links can be captured by legacy navigation");
assert(!shell.includes('href="#/actions" data-nav20-route'), "V20 Action Center link can be captured by legacy navigation");
assert(!shell.includes('href="#/settings" data-nav20-settings'), "V20 Settings link can be captured by legacy navigation");
assert(!shell.includes("MutationObserver"), "Navigation V20 must remain MutationObserver-free");
assert(!shell.includes("setInterval("), "Navigation V20 must not use persistent polling");
assert(shell.includes("[0, 180, 620, 1500, 2600]"), "Navigation V20 recovery schedule must stay bounded");
assert(css.includes(".nav20-shell"), "V20 shell styling is missing");
assert(css.includes(".nav20-operations-panel"), "Operations panel styling is missing");
assert(css.includes(".nav20-account"), "account identity treatment is missing");
assert(css.includes(".nav20-authenticated .topnav>:not(.nav20-shell)"), "legacy navigation nodes are not visually isolated");
assert(css.includes("@media(max-width:980px)"), "tablet/mobile navigation layout is missing");
assert(css.includes("@media(max-width:620px)"), "phone navigation layout is missing");
assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");

console.log("Navigation V20 regression checks passed.");
