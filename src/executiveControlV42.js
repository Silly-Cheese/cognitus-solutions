const root = document.querySelector("#page-root");
const ROUTE = "/executive";
const START_KEY = "__COGNITUS_EXECUTIVE_V42_STARTED__";
const REQUEST_TIMEOUT_MS = 8000;

let timeoutId = null;
let observer = null;

const currentRoute = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const legacyExecutiveReady = () => Boolean(root?.querySelector("[data-executive-v35-page], [data-executive-v41-page]"));

function clearDeadline() {
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = null;
}

function loadingMarkup() {
  return `
    <section class="hero hero-wide" data-executive-v42-bridge>
      <p class="eyebrow">Executive Control</p>
      <h1>Opening Executive Control.</h1>
      <p>Verifying the active Owner session and preparing the live event controls.</p>
      <div class="notice">This check is bounded. If the secure control layer does not finish initializing, Cognitus will show a retry option instead of loading indefinitely.</div>
    </section>`;
}

function failureMarkup() {
  return `
    <section class="hero hero-wide" data-executive-v42-bridge>
      <p class="eyebrow">Executive Control</p>
      <h1>Executive Control did not finish initializing.</h1>
      <p>The shared Cognitus portal is still available. Retry only the Executive Control layer without reloading or breaking promotional pages.</p>
      <div class="hero-actions">
        <button class="button button-dark" type="button" data-exec42-retry>Retry Executive Control</button>
        <a class="button button-light" href="#/dashboard">Return to Dashboard</a>
      </div>
    </section>`;
}

function armDeadline() {
  clearDeadline();
  timeoutId = setTimeout(() => {
    if (currentRoute() !== ROUTE || legacyExecutiveReady()) return;
    root.innerHTML = failureMarkup();
    bindRetry();
  }, REQUEST_TIMEOUT_MS);
}

function requestLegacyRender() {
  document.dispatchEvent(new CustomEvent("cognitus:promo-route-requested", {
    detail: { route: ROUTE, source: "executive-v42-bridge" }
  }));
  // Frenzy V35 listens to pageshow once its secure initializer has attached.
  window.dispatchEvent(new Event("pageshow"));
}

function bindRetry() {
  root?.querySelector("[data-exec42-retry]")?.addEventListener("click", () => {
    if (currentRoute() !== ROUTE) return;
    root.innerHTML = loadingMarkup();
    armDeadline();
    requestLegacyRender();
  });
}

function claimRoute() {
  if (!root || currentRoute() !== ROUTE) {
    clearDeadline();
    return;
  }
  if (legacyExecutiveReady()) {
    clearDeadline();
    return;
  }
  if (!root.querySelector("[data-executive-v42-bridge]")) root.innerHTML = loadingMarkup();
  armDeadline();
  requestLegacyRender();
}

function observeRouteSurface() {
  observer?.disconnect();
  if (!root) return;
  observer = new MutationObserver(() => {
    if (currentRoute() !== ROUTE) return;
    if (legacyExecutiveReady()) clearDeadline();
  });
  observer.observe(root, { childList: true, subtree: true });
}

export function startExecutiveControlV42() {
  if (window[START_KEY]) {
    claimRoute();
    return true;
  }
  window[START_KEY] = true;
  observeRouteSurface();
  claimRoute();
  window.addEventListener("hashchange", claimRoute);
  document.addEventListener("DOMContentLoaded", claimRoute);
  return true;
}
