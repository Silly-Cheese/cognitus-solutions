const sourceNav = document.querySelector(".topnav");
const MOBILE_BREAKPOINT = 1180;
const ADMIN_ROLES = new Set(["admin", "owner"]);
const PROMO_ROUTES = new Set([
  "/intelligence",
  "/relationships",
  "/deep-history",
  "/advanced-search",
  "/compare",
  "/network",
  "/watchlist",
  "/investigations",
  "/intelligence-reports",
  "/change-comparison",
  "/labs",
  "/enhanced-profile",
  "/collections",
  "/analytics",
  "/early-access",
  "/risk-matrix",
  "/overlap-scanner",
  "/signal-zero",
  "/promotional-access",
  "/admin/promotions",
  "/executive"
]);

let frame = 0;
let observer = null;

const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const currentRoute = () => location.hash.replace(/^#/, "").split("?")[0] || "/";

function mountStyles() {
  let link = document.querySelector("#cognitus-promotions-visibility-v37");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-promotions-visibility-v37";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  const href = "./src/promotionsVisibilityV37.css?v=20260905-v37-visible";
  if (link.getAttribute("href") !== href) link.href = href;
}

function sourceAuthenticated() {
  return Boolean(
    sourceNav?.querySelector('a[href="#/dashboard"]')
    || document.querySelector("#cognitus-mobile-nav25 .nav25-account")
    || document.querySelector(".nav20-shell .nav20-account")
  );
}

function sourceRole() {
  const mobileRole = clean(document.querySelector("#cognitus-mobile-nav25 .nav25-account small")?.textContent);
  if (mobileRole) return mobileRole.toLowerCase().replaceAll(" ", "_");

  const shellRole = clean(document.querySelector(".nav20-shell .nav20-account-copy small")?.textContent);
  if (shellRole) return shellRole.toLowerCase().replaceAll(" ", "_");

  const text = clean(sourceNav?.querySelector(":scope > .nav-user")?.textContent);
  if (!text) return "user";
  const parts = text.split("·").map(clean).filter(Boolean);
  return clean(parts.at(-1) || "user").toLowerCase().replaceAll(" ", "_");
}

function itemsForRole(role) {
  const admin = ADMIN_ROLES.has(role);
  const owner = role === "owner";
  return [
    ["/intelligence", "Intelligence Center", "Structured subject review across authorized Cognitus records"],
    ["/investigations", "Investigations", "Saved case workspaces and authorized report history"],
    ["/analytics", "Activity Analytics", "Review search and check activity"],
    ["/promotional-access", "Feature Access", "Promotional entitlements, access codes, and restricted tools"],
    ["/labs", "Cognitus Labs", "Controlled experimental and early-access capabilities"],
    ...(admin ? [["/admin/promotions", "Feature Access Management", "Create codes, direct grants, limits, and revocations"]] : []),
    ...(owner ? [["/executive", "Executive Control", "Executive_Eagle event, Frenzy, and Owner controls"]] : [])
  ];
}

function intelligenceIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-4.9 12l-.1 4h3v4h4v-4h3l-.1-4A7 7 0 0 0 12 2Zm0 2a5 5 0 0 1 3.43 8.64l-.56.52.05 2.84H9.08l.05-2.84-.56-.52A5 5 0 0 1 12 4Zm-2 5h4v2h-4V9Z"/></svg>';
}

function ensureDesktopPrimary(shell) {
  const primary = shell?.querySelector(".nav20-primary");
  if (!primary) return;
  let link = primary.querySelector("[data-promo37-primary]");
  if (!link) {
    link = document.createElement("a");
    link.className = "nav20-primary-link promo37-primary";
    link.href = "./#/intelligence";
    link.dataset.promo37Primary = "true";
    link.title = "Intelligence";
    link.setAttribute("aria-label", "Intelligence");
    link.innerHTML = `${intelligenceIcon()}<span>Intelligence</span>`;
    const actions = primary.querySelector('.is-actions, [data-nav20-route="/actions"]');
    if (actions) primary.insertBefore(link, actions);
    else primary.appendChild(link);
  }
  const active = PROMO_ROUTES.has(currentRoute());
  link.classList.toggle("is-active", active);
  if (active) link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");
}

function ensureDesktopOperations(shell, role) {
  const grid = shell?.querySelector(".nav20-ops-grid");
  if (!grid) return;
  const admin = ADMIN_ROLES.has(role);
  const owner = role === "owner";
  const signature = `${role}|${admin}|${owner}`;

  let group = grid.querySelector("[data-promo27-ops-group], [data-promo37-ops-group]");
  if (group && group.dataset.promo27Role !== signature) {
    group.remove();
    group = null;
  }
  if (!group) {
    group = document.createElement("section");
    group.className = "nav20-ops-group promo27-ops-group promo37-ops-group";
    group.dataset.promo27OpsGroup = "true";
    group.dataset.promo37OpsGroup = "true";
    group.dataset.promo27Role = signature;
    grid.appendChild(group);
  }

  if (group.dataset.promo37Signature !== signature) {
    group.dataset.promo37Signature = signature;
    group.innerHTML = `
      <div class="nav20-ops-heading"><span>Intelligence</span><strong>Analysis & access</strong></div>
      <div class="nav20-ops-links">
        ${itemsForRole(role).map(([path, label, note]) => `<a href="./#${escapeHtml(path)}" data-promo27-operation data-promo27-route="${escapeHtml(path)}" data-promo37-route="${escapeHtml(path)}"><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></a>`).join("")}
      </div>`;
  }

  const current = currentRoute();
  group.querySelectorAll("[data-promo37-route]").forEach((link) => {
    const active = link.dataset.promo37Route === current;
    link.classList.toggle("is-current", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const button = shell.querySelector("[data-nav20-operations]");
  button?.classList.toggle("is-active", PROMO_ROUTES.has(current));
}

function ensureLegacyDesktopFallback(role) {
  if (window.innerWidth <= MOBILE_BREAKPOINT || document.querySelector(".nav20-shell")) {
    sourceNav?.querySelector("[data-promo37-fallback]")?.remove();
    return;
  }
  if (!sourceNav || !sourceAuthenticated()) return;
  let link = sourceNav.querySelector("[data-promo37-fallback]");
  if (!link) {
    link = document.createElement("a");
    link.href = "#/promotional-access";
    link.dataset.promo37Fallback = "true";
    link.className = "promo37-fallback-link";
    link.textContent = "Feature Access";
    link.title = "Open Cognitus Feature Access";
    const settings = sourceNav.querySelector('a[href="#/settings"]');
    if (settings) sourceNav.insertBefore(link, settings);
    else sourceNav.appendChild(link);
  }
  link.classList.toggle("v4-active", PROMO_ROUTES.has(currentRoute()));
  link.dataset.role = role;
}

function mobileGroupMarkup(role) {
  return `<section class="nav25-group nav29-promo-group promo37-mobile-group" data-promo29-mobile-group data-promo37-mobile-group data-promo29-role="${escapeHtml(role)}">
    <p>Intelligence</p>
    <div class="nav25-group-links">
      ${itemsForRole(role).map(([path, label, note]) => `<a href="#${escapeHtml(path)}" data-promo29-route="${escapeHtml(path)}" data-promo37-route="${escapeHtml(path)}"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></a>`).join("")}
    </div>
  </section>`;
}

function ensureMobilePrimary(drawer) {
  const primary = drawer?.querySelector(".nav25-primary");
  if (!primary) return;
  let link = primary.querySelector("[data-promo37-mobile-primary]");
  if (!link) {
    link = document.createElement("a");
    link.className = "nav25-primary-link promo37-mobile-primary";
    link.href = "#/intelligence";
    link.dataset.promo37MobilePrimary = "true";
    link.innerHTML = '<span class="nav25-primary-icon" aria-hidden="true">◎</span><span><strong>Intelligence</strong><small>Analysis, investigations, and feature access</small></span>';
    const actions = primary.querySelector('a[href="#/actions"]');
    if (actions) primary.insertBefore(link, actions);
    else primary.appendChild(link);
  }
  const active = PROMO_ROUTES.has(currentRoute());
  link.classList.toggle("is-active", active);
  if (active) link.setAttribute("aria-current", "page");
  else link.removeAttribute("aria-current");
}

function ensureMobile(role) {
  const drawer = document.querySelector("#cognitus-mobile-nav25");
  if (!drawer) return;
  ensureMobilePrimary(drawer);

  const directory = drawer.querySelector(".nav25-directory");
  if (!directory) return;
  let group = directory.querySelector("[data-promo29-mobile-group], [data-promo37-mobile-group]");
  if (!group || group.dataset.promo29Role !== role) {
    group?.remove();
    directory.insertAdjacentHTML("beforeend", mobileGroupMarkup(role));
    group = directory.querySelector("[data-promo37-mobile-group]");
  }

  const current = currentRoute();
  group?.querySelectorAll("[data-promo37-route], [data-promo29-route]").forEach((link) => {
    const path = link.dataset.promo37Route || link.dataset.promo29Route || "";
    const active = path === current;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function sync() {
  mountStyles();
  if (!sourceAuthenticated()) return;
  const role = sourceRole();
  const shell = document.querySelector(".nav20-shell");
  ensureDesktopPrimary(shell);
  ensureDesktopOperations(shell, role);
  ensureLegacyDesktopFallback(role);
  ensureMobile(role);
  document.body.classList.add("promo37-visibility-ready");
}

function scheduleSync() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    sync();
  });
}

mountStyles();
scheduleSync();
[80, 240, 600, 1200, 2400, 5000].forEach((delay) => setTimeout(scheduleSync, delay));

window.addEventListener("hashchange", scheduleSync);
window.addEventListener("pageshow", scheduleSync);
window.addEventListener("resize", scheduleSync, { passive: true });
document.addEventListener("cognitus:promotional-v37-ready", scheduleSync);
document.addEventListener("cognitus:promo-rendered", scheduleSync);

document.addEventListener("click", (event) => {
  if (event.target.closest?.("[data-promo37-route], [data-promo37-primary], [data-promo37-mobile-primary], [data-promo37-fallback]")) {
    setTimeout(scheduleSync, 0);
  }
}, true);

observer = new MutationObserver(() => scheduleSync());
observer.observe(document.body, { childList: true, subtree: true });
