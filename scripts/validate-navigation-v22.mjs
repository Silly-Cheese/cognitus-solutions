import fs from "node:fs";

const entry = fs.readFileSync("src/navigationV20.css", "utf8");
const base = fs.readFileSync("src/navigationV20Base.css", "utf8");
const isolation = fs.readFileSync("src/navigationV22.css", "utf8");
const shell = fs.readFileSync("src/navigationShellV20.js", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Navigation V22 validation failed: ${message}`);
}

assert(entry.includes("navigationV20Base.css"), "V20 base stylesheet is not loaded");
assert(entry.includes("navigationV22.css"), "V22 isolation stylesheet is not loaded last");
assert(base.includes("@media(max-width:1180px)"), "responsive V21 base was not preserved");
assert(isolation.includes("#v4-mobile-nav-toggle"), "legacy V4 mobile toggle is not suppressed");
assert(isolation.includes(".topnav>#logout-button"), "legacy Logout control is not explicitly suppressed");
assert(isolation.includes(".topnav>.nav-user"), "legacy account card is not explicitly suppressed");
assert(isolation.includes(".topnav>.nav20-shell{display:flex!important}"), "visible shell is not protected from legacy topnav child rules");
assert(isolation.includes("grid-template-columns:none!important"), "legacy mobile grid layout is not neutralized");
assert(isolation.includes("background:#fafaf9!important"), "mobile header background is not explicitly owned by V22");
assert(isolation.includes(".brand strong{color:#111!important}"), "mobile brand contrast is not explicitly protected");
assert(isolation.includes(".topnav .nav20-shell a"), "visible link styles are not isolated from legacy broad selectors");
assert(isolation.includes("color:#111!important"), "mobile navigation contrast protection is missing");
assert(isolation.includes("position:fixed!important"), "mobile application drawer is not fixed to the viewport");
assert(isolation.includes("overflow-y:auto!important"), "mobile drawer does not scroll independently");
assert(shell.includes("MOBILE_BREAKPOINT = 1180"), "mobile breakpoint behavior changed unexpectedly");
assert(!shell.includes("MutationObserver"), "navigation must remain MutationObserver-free");
assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");

console.log("Navigation V22 mobile isolation checks passed.");
