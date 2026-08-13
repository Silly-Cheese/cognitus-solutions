import "./controlsV4.js";
import "./assessmentV4.js";
import "./profileV5.js";
import "./reportAssessmentV7.js";
import "./reportAccessV8.js";
import "./ownerReportGrantsV9.js";
import "./employerStatusV10.js";

const nav = document.querySelector(".topnav");
const root = document.querySelector("#page-root");
const topbar = document.querySelector(".topbar");
let timers = [];

const SECONDARY_NAV = [
  { href: "#/history", label: "History", note: "Your previous logged checks" },
  { href: "#/employer-status", label: "Employer Status", note: "Apply for organization-linked employer access" },
  { href: "#/reports/submit", label: "Submit Report", note: "Add information for review" },
  { href: "#/claims", label: "Claims", note: "Identity and record claims" },
  { href: "#/appeals", label: "Appeals", note: "Challenge a report or request correction" }
];
const STAFF_NAV = [
  { href: "#/review", label: "Review", note: "Review pending reports, claims, and appeals" },
  { href: "#/admin", label: "Administration", note: "Manage accounts, organizations, and records" }
];

function mountV4Styles() {
  document.querySelector("#cognitus-ux-v3")?.remove();
  if (!document.querySelector("#cognitus-ux-v4")) {
    const link = document.createElement("link");
    link.id = "cognitus-ux-v4";
    link.rel = "stylesheet";
    link.href = "./src/uxV4.css?v=20260812-mobile-1";
    document.head.appendChild(link);
  }
  if (!document.querySelector("#cognitus-nav-v6")) {
    const link = document.createElement("link");
    link.id = "cognitus-nav-v6";
    link.rel = "stylesheet";
    link.href = "./src/navigationV6.css?v=20260812-1";
    document.head.appendChild(link);
  }
  if (!document.querySelector("#cognitus-report-assessment-v7")) {
    const link = document.createElement("link");
    link.id = "cognitus-report-assessment-v7";
    link.rel = "stylesheet";
    link.href = "./src/reportAssessmentV7.css?v=20260812-1";
    document.head.appendChild(link);
  }
}

function isAuthenticatedNav() {
  return Boolean(nav?.querySelector('a[href="#/dashboard"]'));
}

function cleanupV3Artifacts() {
  document.querySelectorAll(".workspace-nav-shell, .ux-command-backdrop, .ux-toast-region").forEach((node) => node.remove());
  nav?.classList.remove("ux-nav-source");
}

function closeMoreMenu() {
  const more = nav?.querySelector(".nav6-more");
  const button = more?.querySelector("[data-nav6-more-button]");
  more?.classList.remove("is-open");
  button?.setAttribute("aria-expanded", "false");
}

function closeMobileMenu() {
  if (!nav) return;
  closeMoreMenu();
  nav.classList.remove("v4-mobile-open");
  const button = document.querySelector("#v4-mobile-nav-toggle");
  button?.setAttribute("aria-expanded", "false");
  button?.setAttribute("aria-label", "Open navigation menu");
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
      if (!open) closeMoreMenu();
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

function ensureReportsTab() {
  if (!nav || !isAuthenticatedNav()) return;
  let link = nav.querySelector("[data-reports-tab]");
  if (!link) {
    link = document.createElement("a");
    link.href = "#/reports";
    link.dataset.reportsTab = "true";
    link.textContent = "Reports";
    link.title = "Open reports and access controls";
    link.setAttribute("aria-label", "Open reports and access controls");
  }
  const profile = nav.querySelector("[data-profile-tab]");
  if (profile && link.previousElementSibling !== profile) profile.insertAdjacentElement("afterend", link);
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

function ensureEmployerStatusTab() {
  if (!nav || !isAuthenticatedNav()) return;
  let link = nav.querySelector("[data-employer-status-tab]");
  if (!link) {
    link = document.createElement("a");
    link.href = "#/employer-status";
    link.dataset.employerStatusTab = "true";
    link.textContent = "Employer Status";
    link.title = "Request or review employer status";
    link.setAttribute("aria-label", "Request or review employer status");
  }
  const settings = nav.querySelector('a[href="#/settings"]');
  if (settings) nav.insertBefore(link, settings);
  else nav.appendChild(link);
}

function decorateMenuLink(link, label, note) {
  if (!link) return null;
  link.innerHTML = `<span class="nav6-menu-label">${label}</span><span class="nav6-menu-note">${note}</span>`;
  return link;
}

function ensureMoreMenu() {
  if (!nav || !isAuthenticatedNav()) return;
  let more = nav.querySelector(".nav6-more");
  if (!more) {
    more = document.createElement("div");
    more.className = "nav6-more";
    more.innerHTML = `
      <button type="button" data-nav6-more-button aria-expanded="false" aria-haspopup="true">
        <span>More</span><span class="nav6-chevron" aria-hidden="true"></span>
      </button>
      <div class="nav6-menu" data-nav6-menu></div>`;
    const button = more.querySelector("[data-nav6-more-button]");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !more.classList.contains("is-open");
      more.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
    });
  }

  const menu = more.querySelector("[data-nav6-menu]");
  const pool = new Map();
  nav.querySelectorAll('a[href^="#/"]').forEach((link) => pool.set(link.getAttribute("href"), link));
  menu.replaceChildren();

  for (const item of SECONDARY_NAV) {
    const link = decorateMenuLink(pool.get(item.href), item.label, item.note);
    if (link) menu.appendChild(link);
  }

  const staffLinks = STAFF_NAV.map((item) => ({
    ...item,
    link: decorateMenuLink(pool.get(item.href), item.label, item.note)
  })).filter((item) => item.link);
  if (staffLinks.length) {
    const section = document.createElement("div");
    section.className = "nav6-menu-section";
    section.textContent = "Staff tools";
    menu.appendChild(section);
    for (const item of staffLinks) menu.appendChild(item.link);
  }

  const settings = nav.querySelector('a[href="#/settings"]');
  const logout = nav.querySelector("#logout-button");
  const divider = nav.querySelector(".nav6-divider") || document.createElement("span");
  divider.className = "nav6-divider";
  divider.setAttribute("aria-hidden", "true");

  if (settings) nav.insertBefore(more, settings);
  else if (logout) nav.insertBefore(more, logout);
  else nav.appendChild(more);

  if (settings && divider.nextElementSibling !== settings) nav.insertBefore(divider, settings);
  else if (!settings && logout && divider.nextElementSibling !== logout) nav.insertBefore(divider, logout);
}

function orderAuthenticatedNav() {
  if (!nav || !isAuthenticatedNav()) return;
  const primaryOrder = [
    "#/dashboard",
    "#/profile",
    "#/reports",
    "#/search",
    "#/organizations",
    "#/organizations?request=1"
  ];
  const more = nav.querySelector(".nav6-more");
  const anchor = more || nav.querySelector('a[href="#/settings"]') || null;
  for (const href of primaryOrder) {
    const node = href === "#/profile"
      ? nav.querySelector("[data-profile-tab]")
      : href === "#/reports"
        ? nav.querySelector("[data-reports-tab]")
        : href.includes("?request=1")
          ? nav.querySelector("[data-org-request-tab]")
          : nav.querySelector(`a[href="${href}"]`);
    if (node) nav.insertBefore(node, anchor);
  }

  const settings = nav.querySelector('a[href="#/settings"]');
  if (settings) nav.appendChild(settings);

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
  let secondaryActive = false;

  nav.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#/")) return;
    const active = href.includes("?request=1")
      ? hash.startsWith("#/organizations?request=1")
      : href === "#/reports"
        ? ["#/reports", "#/reports/view"].includes(base)
        : href.split("?")[0] === base;
    link.classList.toggle("v4-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    if (active && link.closest(".nav6-menu")) secondaryActive = true;
  });

  nav.querySelector("[data-nav6-more-button]")?.classList.toggle("v4-active", secondaryActive);
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

function removeAuthenticatedEnhancements() {
  nav?.querySelector("[data-profile-tab]")?.remove();
  nav?.querySelector("[data-reports-tab]")?.remove();
  nav?.querySelector("[data-org-request-tab]")?.remove();
  nav?.querySelector("[data-employer-status-tab]")?.remove();
  nav?.querySelector(".nav6-more")?.remove();
  nav?.querySelector(".nav6-divider")?.remove();
}

function sync() {
  cleanupV3Artifacts();
  ensureMobileMenu();
  if (isAuthenticatedNav()) {
    ensureProfileTab();
    ensureReportsTab();
    ensureOrganizationRequestTab();
    ensureEmployerStatusTab();
    ensureMoreMenu();
    orderAuthenticatedNav();
  } else {
    removeAuthenticatedEnhancements();
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
document.addEventListener("click", (event) => {
  const more = nav?.querySelector(".nav6-more");
  if (more && !more.contains(event.target)) closeMoreMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMoreMenu();
    if (window.innerWidth <= 760) closeMobileMenu();
  }
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
