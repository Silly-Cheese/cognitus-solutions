const root = document.querySelector("#page-root");
const START_KEY = "__COGNITUS_EXECUTIVE_V43_STARTED__";
const ROUTE = "/executive";
let loadingSnapshot = "";
let restoring = false;

const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";

function inspect() {
  if (!root || route() !== ROUTE) {
    loadingSnapshot = "";
    return;
  }

  const executivePage = root.querySelector("[data-executive-v43-page]");
  const activeLoading = executivePage?.querySelector?.(".exec43-loading-bar") || root.querySelector(".exec43-loading-bar");

  if (executivePage && activeLoading) {
    loadingSnapshot = root.innerHTML;
    return;
  }

  // Once the real workspace, restricted state, or retry state appears, V43 owns
  // its own recovery and event binding. The shield is only for in-flight startup.
  if (executivePage) {
    loadingSnapshot = "";
    return;
  }

  if (!window[START_KEY] || !loadingSnapshot || restoring) return;
  restoring = true;
  queueMicrotask(() => {
    try {
      if (route() === ROUTE && !root.querySelector("[data-executive-v43-page]") && loadingSnapshot) {
        root.innerHTML = loadingSnapshot;
      }
    } finally {
      restoring = false;
    }
  });
}

if (root && !window.__COGNITUS_EXECUTIVE_ROUTE_SHIELD_V43__) {
  window.__COGNITUS_EXECUTIVE_ROUTE_SHIELD_V43__ = true;
  new MutationObserver(inspect).observe(root, { childList: true, subtree: false });
  window.addEventListener("hashchange", inspect);
  window.addEventListener("pageshow", inspect);
  inspect();
}
