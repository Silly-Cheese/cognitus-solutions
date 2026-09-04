import fs from "node:fs";

const core=fs.readFileSync("src/promo/promotionalCoreV26.js","utf8");
const enhancements=fs.readFileSync("src/promo/promotionalEnhancementsV28.js","utf8");
const mobile=fs.readFileSync("src/promo/promotionalMobileV29.js","utf8");
const workspaces=fs.readFileSync("src/promo/promotionalWorkspacesV30.js","utf8");
const navigation=fs.readFileSync("src/promo/promotionalNavigationV27.js","utf8");

function requireText(source,text,label){if(!source.includes(text))throw new Error(`Promotional Stability V31 validation failed: missing ${label}`);}
function forbid(source,text,label){if(source.includes(text))throw new Error(`Promotional Stability V31 validation failed: ${label}`);}

requireText(core,'export const PROMO_RENDER_EVENT = "cognitus:promo-rendered"','render-complete event');
requireText(core,"renderGeneration","stale-render generation guard");
requireText(core,"expectedRoute","route-stability guard");
requireText(core,"announceRendered","post-render event dispatch");
forbid(core,"syncTimers=[0,100,280,650,1200,1900]","legacy six-pass full-page rerender loop remains");

requireText(enhancements,"requestAnimationFrame","coalesced enhancement rendering");
requireText(enhancements,"C.PROMO_RENDER_EVENT","enhancements listen for completed promo render");
forbid(enhancements,"[0, 80, 220, 520, 950, 1600, 2400]","legacy seven-pass enhancement polling remains");

requireText(workspaces,"new MutationObserver","scoped async-result observer");
requireText(workspaces,"C.PROMO_RENDER_EVENT","workspace layer listens for completed promo render");
requireText(workspaces,"requestAnimationFrame","workspace decoration is frame-coalesced");
forbid(workspaces,"[0, 80, 180, 360, 700, 1200, 1900]","legacy seven-pass workspace polling remains");
forbid(workspaces,'document.addEventListener("submit"','global submit-driven redecorating remains');
forbid(workspaces,'document.addEventListener("click"','global click-driven redecorating remains');

requireText(mobile,"observeDrawer","mobile drawer reconstruction observer");
requireText(mobile,"requestAnimationFrame","mobile sync is frame-coalesced");
forbid(mobile,"[0, 120, 360, 760, 1400, 2200]","legacy six-pass mobile polling remains");

requireText(navigation,"new MutationObserver","desktop promotional navigation observer");
requireText(navigation,"requestAnimationFrame","desktop promo navigation is frame-coalesced");
forbid(navigation,"runBoundedSync","legacy bounded navigation polling remains");

console.log("Promotional Access V31 stability checks passed.");
