import * as C from "./promotionalCoreV26.js";
import { getFrenzyState, waitForFrenzyState } from "../frenzyV35.js";

export const SIGNAL_ZERO = Object.freeze({
  id: "signal_zero",
  route: "/signal-zero",
  name: "Signal Zero",
  short: "Signal Zero",
  badge: "FRENZY EXCLUSIVE",
  description: "Event-limited cross-record analysis available only while Frenzy Mode is active and this account holds the Signal Zero entitlement."
});

let frame = 0;

function register() {
  C.FEATURE_BY_ID.set(SIGNAL_ZERO.id, SIGNAL_ZERO);
  C.FEATURE_BY_ROUTE.set(SIGNAL_ZERO.route, SIGNAL_ZERO);
  C.PROMO_ROUTES.add(SIGNAL_ZERO.route);
}

function featureCard(unlocked, frenzy) {
  const live = Boolean(unlocked && frenzy.effectiveActive && frenzy.signalZeroEnabled);
  const status = !unlocked ? "Locked" : live ? "Frenzy Active" : "Dormant";
  const action = !unlocked ? "View Locked Feature" : live ? "Open Signal Zero" : "View Dormant Feature";
  return `<article class="promo26-feature-card is-${unlocked ? "unlocked" : "locked"}" data-promo35-feature-card="signal_zero">
    <div class="promo26-feature-top"><span class="promo26-mini-badge">FRENZY EXCLUSIVE</span><span class="promo26-status is-${live ? "unlocked" : "locked"}">${C.safe(status)}</span></div>
    <h3>Signal Zero</h3>
    <p>${C.safe(SIGNAL_ZERO.description)}</p>
    <div class="hero-actions">${C.buttonLink(SIGNAL_ZERO.route, action, live)}</div>
  </article>`;
}

async function enhanceAccessHub() {
  if (C.currentRoute() !== "/promotional-access" || !C.root) return;
  const grid = C.root.querySelector(".promo26-feature-grid");
  if (!grid) return;
  await waitForFrenzyState().catch(() => null);
  const access = await C.loadAccess();
  const frenzy = getFrenzyState();
  const existing = grid.querySelector('[data-promo35-feature-card="signal_zero"]');
  const markup = featureCard(access.features.has(SIGNAL_ZERO.id), frenzy);
  if (existing) existing.outerHTML = markup;
  else grid.insertAdjacentHTML("beforeend", markup);

  C.root.querySelectorAll(".promo26-section-heading span").forEach((span) => {
    if (/\/\s*\d+\s+unlocked/i.test(span.textContent || "")) {
      span.textContent = `${access.features.size} / 18 unlocked`;
    }
  });
}

async function injectAdminFeature() {
  if (C.currentRoute() !== "/admin/promotions" || !C.root) return;
  const forms = C.root.querySelectorAll("[data-promo-form],[data-grant-form]");
  for (const form of forms) {
    const grid = form.querySelector('input[name="featureIds"]')?.closest(".promo26-check-grid");
    if (!grid || grid.querySelector('input[value="signal_zero"]')) continue;
    let selected = [];
    const editId = C.clean(form.querySelector('[name="editId"]')?.value);
    if (editId) {
      const promo = await C.readDoc("promotionalCodes", editId).catch(() => null);
      selected = promo?.featureIds || [];
    }
    grid.insertAdjacentHTML("beforeend", `<label class="promo26-check-card promo35-signal-zero-option"><input type="checkbox" name="featureIds" value="signal_zero" ${selected.includes("signal_zero") ? "checked" : ""}><span><strong>Signal Zero</strong><small>Frenzy-exclusive entitlement. The feature remains dormant until Executive_Eagle activates Frenzy Mode.</small></span></label>`);
  }
}

function enhanceLabs() {
  if (C.currentRoute() !== "/labs" || !C.root) return;
  const grid = C.root.querySelector(".promo26-record-grid");
  if (!grid || grid.querySelector('[data-promo35-lab="signal_zero"]')) return;
  const frenzy = getFrenzyState();
  grid.insertAdjacentHTML("beforeend", `<article class="promo26-record-card" data-promo35-lab="signal_zero"><div class="promo26-record-head"><h3>Signal Zero</h3><span class="promo26-mini-badge">FRENZY EXCLUSIVE</span></div><p>Cross-record event analysis. Requires a Signal Zero entitlement and an active Frenzy window.</p><div class="hero-actions">${C.buttonLink("/signal-zero", frenzy.effectiveActive ? "Open" : "View Dormant")}</div></article>`);
}

async function decorate() {
  await enhanceAccessHub().catch(() => null);
  await injectAdminFeature().catch(() => null);
  enhanceLabs();
}

function scheduleDecorate() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    decorate();
  });
}

export function startPromotionalRegistryV35() {
  register();
  document.addEventListener(C.PROMO_RENDER_EVENT, scheduleDecorate);
  document.addEventListener("cognitus:frenzy-state", scheduleDecorate);
  window.addEventListener("hashchange", scheduleDecorate);
  window.addEventListener("pageshow", scheduleDecorate);
  scheduleDecorate();
}
