const nav = document.querySelector(".topnav");
const ADMIN_ROLES = new Set(["admin", "owner"]);
const PROMO_FEATURE_ROUTES = new Set([
  "/intelligence", "/relationships", "/deep-history", "/advanced-search", "/compare",
  "/network", "/watchlist", "/investigations", "/intelligence-reports", "/change-comparison",
  "/labs", "/enhanced-profile", "/collections", "/analytics", "/early-access"
]);
let timer = null;
let observer = null;

const clean = (value) => String(value ?? "").trim();
const currentRoute = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const routeHref = (path) => `./#${path}`;

const PROMO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-2.18A3 3 0 0 0 18 6a3 3 0 0 0-5.12-2.12L12 4.76l-.88-.88A3 3 0 1 0 6.18 7H4a2 2 0 0 0-2 2v3h9V9h2v3h9V9a2 2 0 0 0-2-2Zm-13.82 0A1 1 0 1 1 7.6 5.6L9 7H6.18ZM16.4 7H15l1.4-1.4A1 1 0 1 1 16.4 7ZM2 14h9v8H4a2 2 0 0 1-2-2v-6Zm11 0h9v6a2 2 0 0 1-2 2h-7v-8Z"/></svg>';

function sourceAuthenticated() {
  return Boolean(nav?.querySelector(':scope > a[href="#/dashboard"]'));
}

function sourceRole() {
  const text = clean(nav?.querySelector(":scope > .nav-user")?.textContent);
  if (!text) return "user";
  const pieces = text.split("·").map(clean).filter(Boolean);
  return clean(pieces.at(-1) || "user").toLowerCase();
}

function primaryMarkup(path, label, id) {
  return `<a class="nav20-primary-link promo27-primary" href="${routeHref(path)}" data-promo27-primary="${id}" title="${label}" aria-label="${label}">${PROMO_ICON}<span>${label}</span></a>`;
}

function operationLink(path, label, note) {
  return `<a href="${routeHref(path)}" data-promo27-operation data-promo27-route="${path}"><span>${label}</span><small>${note}</small></a>`;
}

function ensurePrimary(shell, role) {
  const primary = shell.querySelector(".nav20-primary");
  if (!primary) return;

  const admin = ADMIN_ROLES.has(role);
  const id = admin ? "admin" : "access";
  const path = admin ? "/admin/promotions" : "/promotional-access";
  const label = admin ? "Promotions" : "Promo Access";
  let link = primary.querySelector("[data-promo27-primary]");

  if (link && link.dataset.promo27Primary !== id) {
    link.remove();
    link = null;
  }
  if (link) return;

  const actions = primary.querySelector(".is-actions");
  if (actions) actions.insertAdjacentHTML("beforebegin", primaryMarkup(path, label, id));
  else primary.insertAdjacentHTML("beforeend", primaryMarkup(path, label, id));
}

function ensureOperations(shell, role) {
  const grid = shell.querySelector(".nav20-ops-grid");
  if (!grid) return;
  const admin = ADMIN_ROLES.has(role);
  const signature = admin ? "admin" : "user";
  let section = grid.querySelector("[data-promo27-ops-group]");

  if (section?.dataset.promo27Role === signature) return;
  section?.remove();

  section = document.createElement("section");
  section.className = "nav20-ops-group promo27-ops-group";
  section.dataset.promo27OpsGroup = "true";
  section.dataset.promo27Role = signature;
  section.innerHTML = `
    <div class="nav20-ops-heading"><span>Promotional Access</span><strong>Codes & restricted tools</strong></div>
    <div class="nav20-ops-links">
      ${operationLink("/promotional-access", "Access Hub", "Redeem codes, view entitlements, and browse every promotional feature")}
      ${operationLink("/intelligence", "Intelligence Center", "Open the restricted Cognitus intelligence workspace")}
      ${operationLink("/labs", "Cognitus Labs", "Preview experimental promotional capabilities")}
      ${admin ? operationLink("/admin/promotions", "Promotion Management", "Create codes, set limits, grant access, and review redemptions") : ""}
    </div>`;
  grid.appendChild(section);
}

function updateActiveState(shell) {
  const route = currentRoute();
  shell.querySelectorAll("[data-promo27-primary]").forEach((link) => {
    const id = link.dataset.promo27Primary;
    const active = id === "admin"
      ? route === "/admin/promotions"
      : route === "/promotional-access" || PROMO_FEATURE_ROUTES.has(route);
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  shell.querySelectorAll("[data-promo27-operation]").forEach((link) => {
    const active = link.dataset.promo27Route === route;
    link.classList.toggle("is-current", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (route === "/promotional-access" || route === "/admin/promotions" || PROMO_FEATURE_ROUTES.has(route)) {
    shell.querySelector("[data-nav20-operations]")?.classList.add("is-active");
  }
}

function sync() {
  if (!nav || !sourceAuthenticated()) return;
  const shell = nav.querySelector(":scope > .nav20-shell");
  if (!shell) return;
  const role = sourceRole();
  ensurePrimary(shell, role);
  ensureOperations(shell, role);
  updateActiveState(shell);
}

function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(sync, 0);
}

export function startPromotionalNavigationV27() {
  if (!nav) return;
  scheduleSync();
  [120, 420, 900, 1800, 3000].forEach((delay) => setTimeout(sync, delay));
  window.addEventListener("hashchange", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  window.addEventListener("focus", scheduleSync);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleSync(); });

  observer = new MutationObserver(() => scheduleSync());
  observer.observe(nav, { childList: true, subtree: true });
}
