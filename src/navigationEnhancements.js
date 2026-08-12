import "./controlsV4.js";

const nav = document.querySelector(".topnav");
const root = document.querySelector("#page-root");
let timers = [];

function mountV4Styles() {
  document.querySelector("#cognitus-ux-v3")?.remove();
  if (document.querySelector("#cognitus-ux-v4")) return;
  const link = document.createElement("link");
  link.id = "cognitus-ux-v4";
  link.rel = "stylesheet";
  link.href = "./src/uxV4.css?v=20260812-2";
  document.head.appendChild(link);
}

function isAuthenticatedNav() {
  return Boolean(nav?.querySelector('a[href="#/dashboard"]'));
}

function cleanupV3Artifacts() {
  document.querySelectorAll(".workspace-nav-shell, .ux-command-backdrop, .ux-toast-region").forEach((node) => node.remove());
  nav?.classList.remove("ux-nav-source");
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
    const node = href.includes("?request=1")
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
  if (isAuthenticatedNav()) {
    ensureOrganizationRequestTab();
    orderAuthenticatedNav();
  } else {
    nav?.querySelector("[data-org-request-tab]")?.remove();
  }
  markActiveRoute();
  openOrganizationRequestForm();
}

function scheduleSync() {
  timers.forEach((timer) => clearTimeout(timer));
  timers = [0, 80, 220, 500, 1000, 1800].map((delay) => setTimeout(sync, delay));
}

mountV4Styles();
cleanupV3Artifacts();
window.addEventListener("hashchange", scheduleSync);
window.addEventListener("DOMContentLoaded", scheduleSync);
window.addEventListener("pageshow", scheduleSync);
scheduleSync();
