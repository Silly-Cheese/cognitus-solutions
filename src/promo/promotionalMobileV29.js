import * as C from "./promotionalCoreV26.js";

const MOBILE_BREAKPOINT = 1180;
let frame = 0;
let drawerObserver = null;
let observedDrawer = null;

const escapeHtml = (value) => C.safe(value);

function mountStyles() {
  let link = document.querySelector("#cognitus-promotional-mobile-v29");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-promotional-mobile-v29";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/promotionalMobileV29.css?v=20260905-v35-professional";
}

function currentRole() {
  const drawerRole = C.clean(document.querySelector("#cognitus-mobile-nav25 .nav25-account small")?.textContent).toLowerCase().replaceAll(" ", "_");
  if (drawerRole) return drawerRole;
  const source = C.clean(document.querySelector(".topnav > .nav-user")?.textContent);
  if (!source) return C.userRecord?.role || "user";
  const parts = source.split("·").map(C.clean).filter(Boolean);
  return C.clean(parts.at(-1) || "user").toLowerCase().replaceAll(" ", "_");
}

function routeActive(path) {
  return C.currentRoute() === path;
}

function intelligenceGroupMarkup(role) {
  const admin = ["admin", "owner"].includes(role);
  const owner = role === "owner";
  const items = [
    ["/intelligence", "Intelligence Center", "Structured subject review across authorized records"],
    ["/investigations", "Investigations", "Saved case workspaces and report history"],
    ["/analytics", "Activity Analytics", "Search and check activity"],
    ["/promotional-access", "Feature Access", "Entitlements and restricted analysis tools"],
    ["/labs", "Cognitus Labs", "Experimental and early-access capabilities"],
    ...(admin ? [["/admin/promotions", "Feature Access Management", "Codes, grants, limits, and revocations"]] : []),
    ...(owner ? [["/executive", "Executive Control", "Executive_Eagle event and owner controls"]] : [])
  ];
  return `<section class="nav25-group nav29-promo-group" data-promo29-mobile-group data-promo29-role="${escapeHtml(role)}">
    <p>Intelligence</p>
    <div class="nav25-group-links">
      ${items.map(([path, label, note]) => `<a href="#${escapeHtml(path)}" data-promo29-route="${escapeHtml(path)}" class="${routeActive(path) ? "is-active" : ""}"${routeActive(path) ? ' aria-current="page"' : ""}><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></a>`).join("")}
    </div>
  </section>`;
}

function updateGroup(group) {
  group?.querySelectorAll("[data-promo29-route]").forEach((link) => {
    const active = routeActive(link.dataset.promo29Route || "");
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function observeDrawer(drawer) {
  if (observedDrawer === drawer) return;
  drawerObserver?.disconnect();
  observedDrawer = drawer;
  if (!drawer) return;
  drawerObserver = new MutationObserver(() => scheduleSync());
  drawerObserver.observe(drawer, { childList: true });
}

function ensureMobileNavigation() {
  if (window.innerWidth > MOBILE_BREAKPOINT) return;
  const drawer = document.querySelector("#cognitus-mobile-nav25");
  observeDrawer(drawer);
  if (!drawer) return;

  drawer.querySelectorAll("[data-promo29-mobile-primary]").forEach((node) => node.remove());
  const directory = drawer.querySelector(".nav25-directory");
  if (!directory) return;
  const role = currentRole();
  let group = directory.querySelector("[data-promo29-mobile-group]");
  if (!group || group.dataset.promo29Role !== role) {
    group?.remove();
    directory.insertAdjacentHTML("beforeend", intelligenceGroupMarkup(role));
    group = directory.querySelector("[data-promo29-mobile-group]");
  }
  updateGroup(group);
}

function markMobilePromoPage() {
  const current = C.currentRoute();
  document.body.classList.toggle("promo29-mobile-route", window.innerWidth <= MOBILE_BREAKPOINT && (C.PROMO_ROUTES.has(current) || current === "/executive"));
}

function sync() {
  mountStyles();
  markMobilePromoPage();
  ensureMobileNavigation();
}

function scheduleSync() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    sync();
  });
}

export function startPromotionalMobileV29() {
  mountStyles();
  scheduleSync();
  document.addEventListener(C.PROMO_RENDER_EVENT, scheduleSync);
  document.addEventListener("cognitus:frenzy-state", scheduleSync);
  window.addEventListener("hashchange", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  window.addEventListener("resize", scheduleSync, { passive: true });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-nav25-toggle]")) setTimeout(scheduleSync, 40);
  }, true);
}
