import fs from "node:fs";

const state = fs.readFileSync("src/navigationStateV23.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Navigation V24 validation failed: ${message}`);
}

assert(index.includes("navigationStateV23.js?v=20260817-v24-toggle"), "V24 state module cache key is not loaded from index.html");
assert(state.includes('document.addEventListener("click", (event) => {'), "mobile toggle click handler is missing");
assert(state.includes("}, true);"), "mobile toggle is not owned in capture phase");
assert(state.includes("event.preventDefault()"), "mobile toggle does not prevent the legacy default path");
assert(state.includes("event.stopPropagation()"), "mobile toggle does not stop legacy propagation");
assert(state.includes("event.stopImmediatePropagation()"), "mobile toggle does not block competing handlers on the capture path");
assert(state.includes('const open = !nav?.classList.contains("nav20-mobile-open")'), "V24 does not directly toggle authoritative drawer state");
assert(state.includes('nav?.classList.remove("v4-mobile-open")'), "legacy V4 mobile-open state is not cleared");
assert(state.includes("userInteracted = true"), "V24 does not remember real user interaction");
assert(state.includes('if (!userInteracted && nav?.classList.contains("nav20-mobile-open")) closeMobile()'), "late recovery passes are not guarded against closing a user-opened drawer");
assert(!state.includes("queueMicrotask(() => normalizeState())"), "fragile V23 post-toggle normalization is still present");
assert(!state.includes("MutationObserver"), "navigation must remain MutationObserver-free");
assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");

console.log("Navigation V24 mobile toggle checks passed.");
