import fs from "node:fs";

const index = fs.readFileSync("index.html", "utf8");
const state = fs.readFileSync("src/navigationStateV23.js", "utf8");
const css = fs.readFileSync("src/navigationV23.css", "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(`Navigation V23 validation failed: ${message}`);
}

assert(index.includes("navigationEnhancements.js?v=stability-v4-v23-20260817"), "index does not bust the old navigation module cache");
assert(/navigationStateV23\.js\?v=20260817-v2[345]-/.test(index), "index does not load the V23/V24/V25 state module with a fresh URL");
assert(/navigationV20\.css\?v=20260817-v2[345]-/.test(state), "state controller does not force a fresh navigation entry stylesheet");
assert(/navigationV22\.css\?v=20260817-v2[345]-/.test(state), "state controller does not directly refresh the V22 isolation layer");
assert(/navigationV23\.css\?v=20260817-v2[345]-/.test(state), "V23 hardening stylesheet is not cache-busted");
assert(state.includes('classList.toggle("is-open", safeOpen)'), "toggle visual state is not tied to the authoritative open state");
assert(state.includes('classList.toggle("nav20-mobile-open", safeOpen)'), "drawer compatibility class is not synchronized from one state function");
assert(state.includes('classList.toggle("nav20-drawer-open", safeOpen)'), "body scroll/open compatibility state is not synchronized");
assert(state.includes('window.addEventListener("pageshow"'), "page restore does not reset stale navigation state");
assert(state.includes('window.addEventListener("hashchange"'), "route changes do not reset stale navigation state");
assert(state.includes('document.addEventListener("visibilitychange"'), "tab restore does not reset stale navigation state");
assert(state.includes("protectBrandContrast"), "brand contrast recovery is missing");
assert(css.includes(".brand strong"), "V23 brand text protection is missing");
assert(css.includes("color:#111!important"), "brand/navigation dark contrast is not explicitly protected");
assert(css.includes(".brand .brand-mark"), "brand mark contrast protection is missing");
assert(css.includes("color:#fff!important"), "white brand mark/account contrast is missing");
assert(css.includes(".nav20-mobile-toggle.is-open"), "V23 compatibility hamburger/X styling is missing");
assert(css.includes(".topnav:not") === false, "V23 should not add another competing legacy state selector");
assert(!state.includes("MutationObserver"), "V23 must remain MutationObserver-free");
assert(!state.includes("setInterval("), "V23 must not introduce persistent polling");
assert(!state.includes("orderBy("), "V23 must not introduce ordered Firestore queries");
assert(!fs.existsSync("firestore.indexes.json"), "manual/composite Firestore index file must not exist");

console.log("Navigation V23 cache/state regression checks passed.");
