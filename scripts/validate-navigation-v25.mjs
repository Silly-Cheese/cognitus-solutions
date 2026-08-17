import fs from "node:fs";

const state = fs.readFileSync("src/navigationStateV23.js", "utf8");
const css = fs.readFileSync("src/navigationV25.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Navigation V25 validation failed: ${message}`);
}

assert(index.includes("navigationStateV23.js?v=20260817-v25-hard-state"), "index does not load the hard-state controller with a fresh cache key");
assert(state.includes('document.body.dataset.nav25Open = safeOpen ? "true" : "false"'), "V25 does not own an explicit authoritative body state");
assert(state.includes('return document.body.dataset.nav25Open === "true"'), "toggle state is not read from the authoritative V25 state");
assert(state.includes('setMobileOpen(!isAuthoritativelyOpen())'), "tap does not toggle the authoritative V25 state directly");
assert(state.includes('hardStateLink.href = "./src/navigationV25.css?v=20260817-v25-hard-state"'), "V25 stylesheet is not directly cache-busted");
assert(css.includes('body.nav20-authenticated .topnav > .nav20-shell{display:none!important'), "closed drawer is not hard-hidden with display:none");
assert(css.includes('body.nav20-authenticated[data-nav25-open="true"] .topnav > .nav20-shell'), "drawer does not have one explicit V25 open selector");
assert(css.includes('.topnav > :not(.nav20-shell) *{display:none!important'), "legacy nested nav descendants can still paint on mobile");
assert(css.includes('.nav20-mobile-toggle[aria-expanded="true"]'), "hamburger/X visuals are not bound to aria-expanded");
assert(!css.includes('.topnav.nav20-mobile-open>.nav20-shell'), "V25 must not allow legacy nav classes to independently open the drawer");
assert(!state.includes("MutationObserver"), "navigation must remain MutationObserver-free");
assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");

console.log("Navigation V25 hard mobile-state checks passed.");
