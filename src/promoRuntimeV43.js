import * as C from "./promo/promotionalCoreV26.js";
import { renderFeaturePageV35 } from "./promo/promotionalFeaturesV35.js";
import { renderAccessHub, renderPromoAdmin } from "./promo/promotionalAdminV26.js";
import { startExecutiveControlV43 } from "./executiveControlV43.js";

const START_KEY = "__COGNITUS_PROMO_RUNTIME_V43_STARTED__";
const EXECUTIVE_ROUTE = "/executive";
const REQUEST_TIMEOUT_MS = 10000;

let observer = null;
let generation = 0;
let retryTimer = null;
let busy = false;

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const isPromoRoute = (value) => C.PROMO_ROUTES.has(value);
const isManagedRoute = (value) => value === EXECUTIVE_ROUTE || isPromoRoute(value);

function withTimeout(promise, message, timeoutMs = REQUEST_TIMEOUT_MS) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timer));
}

function hasRealPromoSurface() {
  if (!C.root) return false;
  return Boolean(C.root.querySelector([
    "[data-promo-v26-page]",
    ".promo26-access-hero",
    ".promo26-admin-hero",
    ".promo26-feature-hero",
    ".promo26-locked-page",
    ".promo30-tool-stage",
    ".promo32-archive",
    ".promo33-metric",
    "[data-executive-v43-page]"
  ].join(",")));
}

function loadingMarkup(expectedRoute) {
  const title = expectedRoute === "/promotional-access" ? "Feature Access" : "Cognitus Intelligence";
  return `<section class="hero hero-wide" data-promo-v43-loading data-promo-v26-page>
    <p class="eyebrow">${C.safe(title)}</p>
    <h1>Loading secure workspace.</h1>
    <p>Cognitus is verifying your account and the feature permissions required for this page.</p>
  </section>`;
}

function failureMarkup(message) {
  return `<section class="hero hero-wide" data-promo-v43-error data-promo-v26-page>
    <p class="eyebrow">Feature Access</p>
    <h1>This workspace did not finish loading.</h1>
    <div class="notice notice-error">${C.safe(message || "The secure feature-access request timed out.")}</div>
    <div class="hero-actions"><button class="button button-dark" type="button" data-promo-v43-retry>Retry</button><a class="button button-light" href="#/dashboard">Dashboard</a></div>
  </section>`;
}

function loginMarkup() {
  return `<section class="hero hero-wide" data-promo-v26-page>
    <p class="eyebrow">Login Required</p><h1>Sign in to continue.</h1>
    <p>Feature Access is attached to your Cognitus account.</p>
    <div class="hero-actions"><a class="button button-dark" href="#/login">Login</a><a class="button button-light" href="#/register">Create Account</a></div>
  </section>`;
}

function bindRetry() {
  C.root?.querySelector("[data-promo-v43-retry]")?.addEventListener("click", () => claimRoute(true));
}

function announce(expectedRoute) {
  document.dispatchEvent(new CustomEvent(C.PROMO_RENDER_EVENT, { detail: { route: expectedRoute, source: "promo-runtime-v43" } }));
}

async function renderPromoRoute(expectedRoute, force = false) {
  if (!C.root || !isPromoRoute(expectedRoute) || route() !== expectedRoute) return false;
  const myGeneration = ++generation;
  busy = true;

  if (force || !hasRealPromoSurface() || C.root.querySelector("[data-promo-v38-handoff]")) {
    C.root.innerHTML = loadingMarkup(expectedRoute);
  }

  try {
    await withTimeout(C.refreshSession(force), "Account verification timed out. Retry the workspace.");
    if (myGeneration !== generation || route() !== expectedRoute) return false;

    if (!C.authUser || !C.userRecord) {
      C.root.innerHTML = loginMarkup();
      announce(expectedRoute);
      return true;
    }

    if (expectedRoute === "/promotional-access") {
      await withTimeout(renderAccessHub(), "Feature Access took too long to load.");
      if (myGeneration === generation && route() === expectedRoute) announce(expectedRoute);
      return true;
    }

    if (expectedRoute === "/admin/promotions") {
      await withTimeout(renderPromoAdmin(), "Feature Access Management took too long to load.");
      if (myGeneration === generation && route() === expectedRoute) announce(expectedRoute);
      return true;
    }

    const feature = C.FEATURE_BY_ROUTE.get(expectedRoute);
    if (!feature) throw new Error("This promotional feature is not registered correctly.");

    const access = await withTimeout(C.loadAccess(force), "Feature permissions took too long to verify.");
    if (myGeneration !== generation || route() !== expectedRoute) return false;

    if (!access.features.has(feature.id)) {
      C.renderLockedFeature(feature);
      announce(expectedRoute);
      return true;
    }

    await withTimeout(renderFeaturePageV35(feature), `${feature.name} took too long to load.`);
    if (myGeneration === generation && route() === expectedRoute) announce(expectedRoute);
    return true;
  } catch (error) {
    if (myGeneration === generation && route() === expectedRoute) {
      C.root.innerHTML = failureMarkup(error?.message || "The secure promotional workspace could not load.");
      bindRetry();
      announce(expectedRoute);
    }
    return false;
  } finally {
    if (myGeneration === generation) busy = false;
  }
}

function claimRoute(force = false) {
  clearTimeout(retryTimer);
  retryTimer = null;
  const expectedRoute = route();
  if (!isManagedRoute(expectedRoute)) return;

  if (expectedRoute === EXECUTIVE_ROUTE) {
    startExecutiveControlV43();
    return;
  }

  if (!force && busy) return;
  if (!force && hasRealPromoSurface() && !C.root?.querySelector("[data-promo-v38-handoff], [data-promo-v43-loading]")) return;
  renderPromoRoute(expectedRoute, force);
}

function installObserver() {
  if (!C.root || observer) return;
  observer = new MutationObserver(() => {
    const current = route();
    if (!isManagedRoute(current)) return;
    if (current === EXECUTIVE_ROUTE) {
      if (!C.root.querySelector("[data-executive-v43-page]")) queueMicrotask(() => startExecutiveControlV43());
      return;
    }
    if (C.root.querySelector("[data-promo-v38-handoff]") || (!hasRealPromoSurface() && !busy)) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => claimRoute(false), 0);
    }
  });
  observer.observe(C.root, { childList: true, subtree: false });
}

export function startPromoRuntimeV43() {
  startExecutiveControlV43();
  installObserver();
  if (!window[START_KEY]) {
    window[START_KEY] = true;
    window.addEventListener("hashchange", () => claimRoute(true));
    window.addEventListener("pageshow", () => claimRoute(false));
    document.addEventListener("DOMContentLoaded", () => claimRoute(false));
    document.addEventListener("cognitus:promo-route-requested", () => claimRoute(false));
  }
  claimRoute(false);
  return true;
}
