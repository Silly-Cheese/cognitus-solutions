import "./controlsV4.js";
import "./assessmentV4.js";
import "./profileV5.js";

const nav = document.querySelector(".topnav");
const root = document.querySelector("#page-root");
const topbar = document.querySelector(".topbar");
let timers = [];

function mountV4Styles() {
  document.querySelector("#cognitus-ux-v3")?.remove();
  if (document.querySelector("#cognitus-ux-v4")) return;
  const link = document.createElement("link");
  link.id = "cognitus-ux-v4";
  link.rel = "stylesheet";
  link.href = "./src/uxV4.css?v=20260812-mobile-1";
  document.head.appendChild(link);
}

function isAuthenticatedNav() {
  return Boolean(nav?.querySelector('a[href="#/dashboard"]'));
}

function cleanupV3Artifacts() {
  document.querySelectorAll(".workspace-nav-shell, .ux-command-backdrop, .ux-toast-region").forEach((node) => node.remove());
  nav?.classList.remove("ux-nav-source");
}

function closeMobileMenu() {
  if (!nav) return;
  nav.classList.remove("v4-mobile-open");
  const button = document.querySelector("#v4-mobile-nav-toggle");
  button?.setAttribute("aria-expanded", "false");
  if (button) button.querySelector("span:last-child").textContent = "Menu";
}

function ensureMobileMenu() {
  if (!nav || !topbar) return;
  nav.id = "cognitus-primary-nav";
  let button = document.querySelector("#v4-mobile-nav-toggle");
  if (!button) {
    button = document.createElement("button");
    button.id = "v4-mobile-nav-toggle";
    button.className = "v4-mobile-nav-toggle";
    button.type = "button";
    button.setAttribute("aria-controls", nav.id);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation menu");
    button.innerHTML = '<span class="v4-mobile-nav-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span>';
    button.addEventListener("click", () => {
      const open = !nav.classList.contains("v4-mobile-open");
      nav.classList.toggle("v4-mobile-open", open);
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      button.querySelector("span:last-child").textContent = open ? "Close" : "Menu";
    });
    const brand = topbar.querySelector(".brand");
    if (brand) brand.insertAdjacentElement("afterend", button);
    else topbar.prepend(button);
  }
  document.body.classList.add("v4-mobile-nav-ready");
}

function ensureProfileTab() {
  if (!nav || !isAuthenticatedNav()) return;
  let link = nav.querySelector("[data-profile-tab]");
  if (!link) {
    link = document.createElement("a");
    link.href = "#/profile";
    link.dataset.profileTab = "true";
    link.textContent = "Profile";
    link.title = "Open your Cognitus profile";
    link.setAttribute("aria-label", "Open your Cognitus profile");
  }
  const dashboard = nav.querySelector('a[href="#/dashboard"]');
  if (dashboard && link.previousElementSibling !== dashboard) dashboard.insertAdjacentElement("afterend", link);
}

function ensureOrganizationRequestTab() {
  if (!nav || !isAuthenticatedNav()) return;
  let link = nav.querySelector("[data-org-request-tab]");
  if (!link) {
    link = document.createElement("a");
    link.href = "#/organizations?request=1";
    link.dataset.orgRequestTab = "true";
    link.textContent = "New Organization";
    link.title = "Create or request an organization record";
    link.setAttribute("aria-label", "Create or request an organization record");
  }
  const organizations = nav.querySelector('a[href="#/organizations"]');
  if (organizations && link.previousElementSibling !== organizations) organizations.insertAdjacentElement("afterend", link);
}

function orderAuthenticatedNav() {
  if (!nav || !isAuthenticatedNav()) return;
  const hrefOrder = [
    "#/dashboard",
    "#/profile",
    "#/search",
    "#/history",
    "#/organizations",
    "#/organizations?request=1",
    "#/reports/submit",
    "#/claims",
    "#/appeals",
    "#/review",
    "#/admin",
    "#/settings"
  ];
  for (const href of hrefOrder) {
    const node = href === "#/profile"
      ? nav.querySelector("[data-profile-tab]")
      : href.includes("?request=1")
        ? nav.querySelector("[data-org-request-tab]")
        : nav.querySelector(`a[href="${href}"]`);
    if (node) nav.appendChild(node);
  }
  const logout = nav.querySelector("#logout-button");
  if (logout) {
    logout.textContent = "Logout";
    logout.title = "Sign out of Cognitus";
    nav.appendChild(logout);
  }
  const user = nav.querySelector(".nav-user");
  if (user) nav.appendChild(user);
}

function markActiveRoute() {
  if (!nav) return;
  const hash = location.hash || "#/";
  const base = hash.split("?")[0];
  nav.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#/")) return;
    const active = href.includes("?request=1")
      ? hash.startsWith("#/organizations?request=1")
      : href.split("?")[0] === base;
    link.classList.toggle("v4-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function openOrganizationRequestForm() {
  const hash = location.hash;
  if (!hash.startsWith("#/organizations?request=1")) return;
  const panel = root?.querySelector("#org-create");
  const toggle = root?.querySelector("#new-org-toggle");
  if (!panel || !toggle) return;
  if (panel.hidden) toggle.click();
  const name = panel.querySelector('input[name="name"]');
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  name?.focus({ preventScroll: true });
}

function sync() {
  cleanupV3Artifacts();
  ensureMobileMenu();
  if (isAuthenticatedNav()) {
    ensureProfileTab();
    ensureOrganizationRequestTab();
    orderAuthenticatedNav();
  } else {
    nav?.querySelector("[data-profile-tab]")?.remove();
    nav?.querySelector("[data-org-request-tab]")?.remove();
  }
  markActiveRoute();
  openOrganizationRequestForm();
}

function scheduleSync() {
  timers.forEach((timer) => clearTimeout(timer));
  timers = [0, 120, 420, 1000].map((delay) => setTimeout(sync, delay));
}

mountV4Styles();
cleanupV3Artifacts();
ensureMobileMenu();
nav?.addEventListener("click", (event) => {
  if (event.target.closest("a, #logout-button")) closeMobileMenu();
});
window.addEventListener("hashchange", () => {
  closeMobileMenu();
  scheduleSync();
});
window.addEventListener("DOMContentLoaded", scheduleSync);
window.addEventListener("pageshow", scheduleSync);
window.addEventListener("resize", () => {
  if (window.innerWidth > 760) closeMobileMenu();
}, { passive: true });
scheduleSync();
