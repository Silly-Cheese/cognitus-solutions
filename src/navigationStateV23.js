const nav = document.querySelector(".topnav");
const topbar = document.querySelector(".topbar");
const MOBILE_BREAKPOINT = 1180;
let userInteracted = false;

function ensureFreshNavigationStyles() {
  const baseLink = document.querySelector("#cognitus-navigation-v20");
  if (baseLink) baseLink.href = "./src/navigationV20.css?v=20260817-v25-hard-state";

  let isolationLink = document.querySelector("#cognitus-navigation-v22-direct");
  if (!isolationLink) {
    isolationLink = document.createElement("link");
    isolationLink.id = "cognitus-navigation-v22-direct";
    isolationLink.rel = "stylesheet";
    document.head.appendChild(isolationLink);
  }
  isolationLink.href = "./src/navigationV22.css?v=20260817-v25-hard-state";

  let stateLink = document.querySelector("#cognitus-navigation-v23");
  if (!stateLink) {
    stateLink = document.createElement("link");
    stateLink.id = "cognitus-navigation-v23";
    stateLink.rel = "stylesheet";
    document.head.appendChild(stateLink);
  }
  stateLink.href = "./src/navigationV23.css?v=20260817-v25-hard-state";

  let hardStateLink = document.querySelector("#cognitus-navigation-v25");
  if (!hardStateLink) {
    hardStateLink = document.createElement("link");
    hardStateLink.id = "cognitus-navigation-v25";
    hardStateLink.rel = "stylesheet";
    document.head.appendChild(hardStateLink);
  }
  hardStateLink.href = "./src/navigationV25.css?v=20260817-v25-hard-state";
}

function button() {
  return topbar?.querySelector("[data-nav20-mobile-toggle]") || null;
}

function shell() {
  return nav?.querySelector(":scope > .nav20-shell") || null;
}

function isAuthoritativelyOpen() {
  return document.body.dataset.nav25Open === "true";
}

function setMobileOpen(open) {
  const safeOpen = Boolean(open && nav && shell() && button() && window.innerWidth <= MOBILE_BREAKPOINT);

  // V25 owns the only state used for rendering. Older classes remain synchronized
  // solely for backwards compatibility and cannot independently open the drawer.
  document.body.dataset.nav25Open = safeOpen ? "true" : "false";
  nav?.classList.remove("v4-mobile-open");
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

function refreshPassiveState() {
  ensureFreshNavigationStyles();
  protectBrandContrast();
  if (window.innerWidth > MOBILE_BREAKPOINT || !shell() || !button()) setMobileOpen(false);
}

function closeMobile() {
  setMobileOpen(false);
}

ensureFreshNavigationStyles();
protectBrandContrast();
setMobileOpen(false);

// V25 owns the mobile toggle at capture phase. The next state comes from the
// authoritative body data attribute, never from a legacy class left behind by V4/V20.
document.addEventListener("click", (event) => {
  const control = event.target.closest?.("[data-nav20-mobile-toggle]");
  if (!control) return;

  userInteracted = true;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (window.innerWidth > MOBILE_BREAKPOINT || !shell()) {
    closeMobile();
    return;
  }

  setMobileOpen(!isAuthoritativelyOpen());
}, true);

// Any real navigation action closes the mobile drawer before the route changes.
document.addEventListener("click", (event) => {
  if (event.target.closest?.(".nav20-shell a, .brand")) closeMobile();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobile();
});

window.addEventListener("hashchange", closeMobile);
window.addEventListener("pageshow", () => {
  userInteracted = false;
  closeMobile();
  refreshPassiveState();
});
window.addEventListener("resize", () => {
  if (window.innerWidth > MOBILE_BREAKPOINT) closeMobile();
  else refreshPassiveState();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    userInteracted = false;
    closeMobile();
    refreshPassiveState();
  }
});

// Late passes cover authenticated navigation appearing after Firebase resolves.
// They may clear inherited stale state before user interaction, never a user-opened drawer.
[0, 180, 650, 1600].forEach((delay) => setTimeout(() => {
  refreshPassiveState();
  if (!userInteracted && isAuthoritativelyOpen()) closeMobile();
}, delay));
