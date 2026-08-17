const nav = document.querySelector(".topnav");
const topbar = document.querySelector(".topbar");
const MOBILE_BREAKPOINT = 1180;

function ensureFreshNavigationStyles() {
  const baseLink = document.querySelector("#cognitus-navigation-v20");
  if (baseLink) baseLink.href = "./src/navigationV20.css?v=20260817-v23-cache";

  let isolationLink = document.querySelector("#cognitus-navigation-v22-direct");
  if (!isolationLink) {
    isolationLink = document.createElement("link");
    isolationLink.id = "cognitus-navigation-v22-direct";
    isolationLink.rel = "stylesheet";
    document.head.appendChild(isolationLink);
  }
  isolationLink.href = "./src/navigationV22.css?v=20260817-v23-direct";

  let stateLink = document.querySelector("#cognitus-navigation-v23");
  if (!stateLink) {
    stateLink = document.createElement("link");
    stateLink.id = "cognitus-navigation-v23";
    stateLink.rel = "stylesheet";
    document.head.appendChild(stateLink);
  }
  stateLink.href = "./src/navigationV23.css?v=20260817-v23-state";
}

function button() {
  return topbar?.querySelector("[data-nav20-mobile-toggle]") || null;
}

function shell() {
  return nav?.querySelector(":scope > .nav20-shell") || null;
}

function setMobileOpen(open) {
  const safeOpen = Boolean(open && nav && shell() && window.innerWidth <= MOBILE_BREAKPOINT);
  nav?.classList.toggle("nav20-mobile-open", safeOpen);
  document.body.classList.toggle("nav20-drawer-open", safeOpen);

  const control = button();
  if (control) {
    control.classList.toggle("is-open", safeOpen);
    control.setAttribute("aria-expanded", String(safeOpen));
    control.setAttribute("aria-label", safeOpen ? "Close navigation menu" : "Open navigation menu");
    const text = control.querySelector("span:last-child");
    if (text) text.textContent = safeOpen ? "Close" : "Menu";
  }
}

function protectBrandContrast() {
  const brand = topbar?.querySelector(".brand");
  if (!brand) return;
  brand.style.setProperty("color", "#111", "important");
  brand.querySelector("strong")?.style.setProperty("color", "#111", "important");
  brand.querySelector("small")?.style.setProperty("color", "#686863", "important");
  brand.querySelector(".brand-mark")?.style.setProperty("color", "#fff", "important");
}

function normalizeState({ close = false } = {}) {
  ensureFreshNavigationStyles();
  protectBrandContrast();

  if (close || window.innerWidth > MOBILE_BREAKPOINT || !shell() || !button()) {
    setMobileOpen(false);
    return;
  }

  const intendedOpen = nav?.classList.contains("nav20-mobile-open") === true;
  if (!intendedOpen) {
    setMobileOpen(false);
    return;
  }

  requestAnimationFrame(() => {
    const currentShell = shell();
    if (!currentShell) {
      setMobileOpen(false);
      return;
    }
    const style = getComputedStyle(currentShell);
    const rendered = style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.opacity || "1") > 0;
    setMobileOpen(rendered);
  });
}

ensureFreshNavigationStyles();
protectBrandContrast();
setMobileOpen(false);

// V20 owns the actual toggle action. V23 normalizes the resulting state after it runs.
document.addEventListener("click", (event) => {
  if (event.target.closest?.("[data-nav20-mobile-toggle]")) {
    queueMicrotask(() => normalizeState());
    return;
  }
  if (event.target.closest?.(".nav20-shell a, .brand")) setMobileOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMobileOpen(false);
});

window.addEventListener("hashchange", () => normalizeState({ close: true }));
window.addEventListener("pageshow", () => normalizeState({ close: true }));
window.addEventListener("resize", () => {
  if (window.innerWidth > MOBILE_BREAKPOINT) setMobileOpen(false);
  else normalizeState();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) normalizeState({ close: true });
});

// Late passes cover authenticated navigation being rebuilt after Firebase resolves.
[0, 180, 650, 1600].forEach((delay) => setTimeout(() => normalizeState({ close: true }), delay));
