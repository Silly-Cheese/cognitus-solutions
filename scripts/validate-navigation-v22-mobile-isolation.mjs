import fs from "node:fs";

const css = fs.readFileSync("src/navigationV22.css", "utf8");
const isolation = fs.readFileSync("src/navigationIsolationV22.js", "utf8");
const entry = fs.readFileSync("src/employerPeopleSearchV18.js", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Navigation V22 mobile isolation validation failed: ${message}`);
}

assert(entry.includes('import "./navigationIsolationV22.js";'), "production module chain does not load V22 isolation");
assert(css.includes("body.nav20-authenticated.v4-mobile-nav-ready .topnav"), "V22 does not override legacy V4 mobile topnav display");
assert(css.includes("body.nav20-authenticated #v4-mobile-nav-toggle"), "legacy V4 mobile toggle is not explicitly hidden");
assert(css.includes("body.nav20-authenticated .topnav > #logout-button"), "legacy Logout node is not explicitly isolated");
assert(css.includes("body.nav20-authenticated .topnav > .nav-user"), "legacy account pill is not explicitly isolated");
assert(css.includes(".nav20-shell .nav20-primary-link"), "V22 does not scope visible link colors to the V20 shell");
assert(css.includes("color:#171717!important"), "mobile V20 links do not explicitly override legacy white text");
assert(css.includes("body.nav20-authenticated.nav20-drawer-open"), "V22 does not lock page scroll behind the mobile drawer");
assert(isolation.includes('nav?.classList.remove("v4-mobile-open")'), "V22 does not actively clear the legacy mobile-open state");
assert(isolation.includes('document.querySelector("#v4-mobile-nav-toggle")'), "V22 does not actively disable the legacy mobile toggle");
assert(isolation.includes("workspace-nav-shell"), "V22 does not remove obsolete legacy nav shells");
assert(isolation.includes("[0, 120, 420, 1100, 2200]"), "V22 recovery schedule must remain bounded");
assert(!isolation.includes("MutationObserver"), "V22 must remain MutationObserver-free");
assert(!isolation.includes("setInterval("), "V22 must not use persistent polling");
assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");

console.log("Navigation V22 mobile isolation checks passed.");
