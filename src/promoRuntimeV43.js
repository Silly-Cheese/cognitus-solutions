import * as C from "./promo/promotionalCoreV26.js";
import { renderFeaturePageV35 } from "./promo/promotionalFeaturesV35.js";
import { renderSignalZeroV44 } from "./signalZeroV44.js?v=20260906-v44";
import { renderAccessHub, renderPromoAdmin } from "./promo/promotionalAdminV26.js";

const START_KEY = "__COGNITUS_PROMO_RUNTIME_V43_STARTED__";
const EXECUTIVE_ROUTE = "/executive";
const SIGNAL_ZERO_ROUTE = "/signal-zero";
const REQUEST_TIMEOUT_MS = 10000;

let observer = null;
let generation = 0;
let retryTimer = null;
let busy = false;
let executivePromise = null;

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

function startExecutiveIsolated() {
  if (route() !== EXECUTIVE_ROUTE) return Promise.resolve(false);
  if (!executivePromise) {
    executivePromise = import("./executiveControlV43.js?v=20260906-v44-executive")
      .then(async (module) => {
        const started = module.startExecutiveControlV43();
        try {
          const maintenance = await import("./executiveMaintenanceV44.js?v=20260906-v44");
          maintenance.startExecutiveMaintenanceV44();
        } catch (error) {
          console.error("Executive Maintenance V44 isolated loader failed", error);
        }
        return started;
      })
      .catch((error) => {
        console.error("Executive Control V43 isolated loader failed", error);
        executivePromise = null;
        if (route() === EXECUTIVE_ROUTE && C.root) {
          C.root.innerHTML = failureMarkup("Executive Control could not start. Retry the Owner workspace.", true);
          bindRetry();
        }
        return false;
      });
  }
  return executivePromise;
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
    "[data-signal44-page]",
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

function failureMarkup(message, executive = false) {
  return `<section class="hero hero-wide" data-promo-v43-error ${executive ? "data-executive-v43-page data-executive-v35-page" : "data-promo-v26-page"}>
    <p class="eyebrow">${executive ? "Executive Control" : "Feature Access"}</p>
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
  C.root?.querySelector("[data-promo-v43-retry]")?.addEventListener("click", () => {
    if (route() === EXECUTIVE_ROUTE) executivePromise = null;
    claimRoute(true);
  });
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

    if (feature.id === "signal_zero") {
      await withTimeout(renderSignalZeroV44(feature), "Signal Zero took too long to establish its secure environment.");
    } else {
      await withTimeout(renderFeaturePageV35(feature), `${feature.name} took too long to load.`);
    }
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
    startExecutiveIsolated();
    return;
  }

  if (!force && busy) return;
  const missingSignalV44 = expectedRoute === SIGNAL_ZERO_ROUTE && !C.root?.querySelector("[data-signal44-page]");
  if (!force && !missingSignalV44 && hasRealPromoSurface() && !C.root?.querySelector("[data-promo-v38-handoff], [data-promo-v43-loading]")) return;
  renderPromoRoute(expectedRoute, force || missingSignalV44);
}

function installObserver() {
  if (!C.root || observer) return;
  observer = new MutationObserver(() => {
    const current = route();
    if (!isManagedRoute(current)) return;
    if (current === EXECUTIVE_ROUTE) {
      if (!C.root.querySelector("[data-executive-v43-page]") && !C.root.querySelector(".exec43-loading-bar")) {
        queueMicrotask(() => startExecutiveIsolated());
      }
      return;
    }
    const missingSignalV44 = current === SIGNAL_ZERO_ROUTE && !C.root.querySelector("[data-signal44-page]");
    if (missingSignalV44 || C.root.querySelector("[data-promo-v38-handoff]") || (!hasRealPromoSurface() && !busy)) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => claimRoute(missingSignalV44), 0);
    }
  });
  observer.observe(C.root, { childList: true, subtree: false });
}

export function startPromoRuntimeV43() {
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
