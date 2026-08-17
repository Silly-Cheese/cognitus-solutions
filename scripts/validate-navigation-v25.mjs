import fs from "node:fs";

const index = fs.readFileSync("index.html", "utf8");
const js = fs.readFileSync("src/navigationMobileV25.js", "utf8");
const css = fs.readFileSync("src/navigationMobileV25.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Navigation V25 validation failed: ${message}`);
}

assert(index.includes("navigationMobileV25.js?v=20260817-v25-dedicated-mobile-shell"), "fresh V25 entry module is not loaded from index.html");
assert(js.includes('document.body.appendChild(drawer)'), "mobile drawer is not physically separated from the legacy .topnav DOM");
assert(js.includes('drawer.hidden = true'), "drawer does not default to a hard hidden state");
assert(js.includes('drawer.hidden = !safeOpen'), "drawer visibility is not controlled by one authoritative state function");
assert(js.includes('data.nav25Toggle'), "dedicated mobile toggle is missing");
assert(js.includes('sourceNav?.classList.remove("v4-mobile-open", "nav20-mobile-open")'), "legacy mobile-open states are not cleared");
assert(js.includes('document.body.classList.remove("nav20-drawer-open")'), "legacy body scroll-lock state is not cleared");
assert(css.includes('body.nav25-ready .topbar>.topnav{display:none!important}'), "legacy .topnav is not completely removed from mobile layout");
assert(css.includes('body.nav25-ready #v4-mobile-nav-toggle'), "legacy V4 toggle is not hidden");
assert(css.includes('[data-nav20-mobile-toggle]{display:none!important}'), "legacy V20 toggle is not hidden");
assert(css.includes('.nav25-drawer[hidden]{display:none!important}'), "closed V25 drawer is not guaranteed out of layout/hit-testing");
assert(css.includes('position:fixed!important'), "V25 drawer is not viewport-contained");
assert(css.includes('overflow-y:auto!important'), "V25 drawer does not scroll independently");
assert(!js.includes("MutationObserver"), "V25 must remain MutationObserver-free");
assert(!js.includes("orderBy("), "V25 must not introduce Firestore orderBy dependencies");
assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");

console.log("Navigation V25 dedicated mobile shell checks passed.");
