import * as C from "./promotionalCoreV26.js";

const MOBILE_BREAKPOINT = 1180;
let frame = 0;
let drawerObserver = null;
let observedDrawer = null;
let fallbackTimers = [];

const escapeHtml = (value) => C.safe(value);

function mountStyles() {
  let link = document.querySelector("#cognitus-promotional-mobile-v29");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-promotional-mobile-v29";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/promotionalMobileV29.css?v=20260904-v29";
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
  const route = C.currentRoute();
  if (path === "/promotional-access") return route === "/promotional-access";
  if (path === "/admin/promotions") return route === "/admin/promotions";
  if (path === "/intelligence") return route === "/intelligence";
  if (path === "/labs") return route === "/labs";
  return route === path;
}

function primaryPromoMarkup() {
  const active = routeActive("/promotional-access") || C.PROMO_ROUTES.has(C.currentRoute());
  return `<a class="nav25-primary-link nav29-promo-primary${active ? " is-active" : ""}" href="#/promotional-access" data-promo29-mobile-primary${active ? ' aria-current="page"' : ""}>
    <span class="nav25-primary-icon nav29-promo-icon" aria-hidden="true">✦</span>
    <span><strong>Promo Access</strong><small>Codes, entitlements & restricted tools</small></span>
  </a>`;
}

function promotionalGroupMarkup(role) {
  const admin = ["admin", "owner"].includes(role);
  const items = [
    ["/promotional-access", "Access Hub", "Redeem codes and browse all promotional features"],
    ["/intelligence", "Intelligence Center", "Open the flagship intelligence workspace"],
    ["/labs", "Cognitus Labs", "Experimental and early-access tools"],
    ...(admin ? [["/admin/promotions", "Promotion Management", "Create codes and directly assign access"]] : [])
  ];
  return `<section class="nav25-group nav29-promo-group" data-promo29-mobile-group data-promo29-role="${escapeHtml(role)}">
    <p>Promotional Access</p>
    <div class="nav25-group-links">
      ${items.map(([path, label, note]) => `<a href="#${escapeHtml(path)}" data-promo29-route="${escapeHtml(path)}" class="${routeActive(path) ? "is-active" : ""}"${routeActive(path) ? ' aria-current="page"' : ""}><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></a>`).join("")}
    </div>
  </section>`;
}

function updatePrimary(primary) {
  const existing = primary?.querySelector("[data-promo29-mobile-primary]");
  if (!existing) return;
  const active = C.PROMO_ROUTES.has(C.currentRoute());
  existing.classList.toggle("is-active", active);
  if (active) existing.setAttribute("aria-current", "page");
  else existing.removeAttribute("aria-current");
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

  const primary = drawer.querySelector(".nav25-primary");
  if (primary && !primary.querySelector("[data-promo29-mobile-primary]")) primary.insertAdjacentHTML("beforeend", primaryPromoMarkup());
  updatePrimary(primary);

  const directory = drawer.querySelector(".nav25-directory");
  if (directory) {
    const role = currentRole();
    let group = directory.querySelector("[data-promo29-mobile-group]");
    if (!group || group.dataset.promo29Role !== role) {
      group?.remove();
      directory.insertAdjacentHTML("beforeend", promotionalGroupMarkup(role));
      group = directory.querySelector("[data-promo29-mobile-group]");
    }
    updateGroup(group);
  }
}

function markMobilePromoPage() {
  document.body.classList.toggle("promo29-mobile-route", window.innerWidth <= MOBILE_BREAKPOINT && C.PROMO_ROUTES.has(C.currentRoute()));
}

function sync() {
  mountStyles();
  markMobilePromoPage();
  ensureMobileNavigation();
}

function scheduleSync() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => { frame = 0; sync(); });
}

function scheduleFallbacks() {
  fallbackTimers.forEach(clearTimeout);
  fallbackTimers = [180, 850].map((delay) => setTimeout(scheduleSync, delay));
}

export function startPromotionalMobileV29() {
  mountStyles();
  scheduleSync();
  scheduleFallbacks();
  document.addEventListener(C.PROMO_RENDER_EVENT, scheduleSync);
  window.addEventListener("hashchange", () => { scheduleSync(); scheduleFallbacks(); });
  window.addEventListener("pageshow", () => { scheduleSync(); scheduleFallbacks(); });
  window.addEventListener("resize", scheduleSync, { passive: true });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-nav25-toggle]")) setTimeout(scheduleSync, 40);
  }, true);
}
