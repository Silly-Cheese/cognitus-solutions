import fs from "node:fs";

const css = fs.readFileSync("src/navigationV20.css", "utf8");
const shell = fs.readFileSync("src/navigationShellV20.js", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Navigation V22 mobile isolation validation failed: ${message}`);
}

assert(css.includes("body.nav20-authenticated.v4-mobile-nav-ready .topnav"), "V22 does not override legacy V4 mobile topnav display");
assert(css.includes("body.nav20-authenticated #v4-mobile-nav-toggle"), "legacy V4 mobile toggle is not explicitly hidden");
assert(css.includes("body.nav20-authenticated .topnav > #logout-button"), "legacy Logout node is not explicitly isolated");
assert(css.includes("body.nav20-authenticated .topnav > .nav-user"), "legacy account pill is not explicitly isolated");
assert(css.includes(".nav20-shell .nav20-primary-link"), "V22 does not scope visible link colors to the V20 shell");
assert(css.includes("color:#171717!important"), "mobile V20 links do not explicitly override legacy white text");
assert(css.includes(".nav20-mobile-open .nav20-shell"), "mobile drawer open state is missing");
assert(shell.includes("#v4-mobile-nav-toggle"), "shell does not actively disable the legacy V4 toggle");
assert(shell.includes("v4-mobile-open"), "shell does not clear legacy mobile-open state");
assert(!shell.includes("MutationObserver"), "V22 must remain MutationObserver-free");
assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");

console.log("Navigation V22 mobile isolation checks passed.");
