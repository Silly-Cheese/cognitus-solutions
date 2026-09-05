import * as C from "./promotionalCoreV26.js";

const nav = document.querySelector(".topnav");
const ADMIN_ROLES = new Set(["admin", "owner"]);
let frame = 0;
let navObserver = null;
let shellObserver = null;
let observedShell = null;

const clean = (value) => String(value ?? "").trim();
const currentRoute = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const routeHref = (path) => `./#${path}`;

function sourceAuthenticated() {
  return Boolean(nav?.querySelector(':scope > a[href="#/dashboard"]'));
}

function sourceRole() {
  const text = clean(nav?.querySelector(":scope > .nav-user")?.textContent);
  if (!text) return "user";
  const pieces = text.split("·").map(clean).filter(Boolean);
  return clean(pieces.at(-1) || "user").toLowerCase();
}

function operationLink(path, label, note) {
  return `<a href="${routeHref(path)}" data-promo27-operation data-promo27-route="${path}"><span>${C.safe(label)}</span><small>${C.safe(note)}</small></a>`;
}

function removeLegacyPrimary(shell) {
  shell.querySelectorAll("[data-promo27-primary]").forEach((node) => node.remove());
}

function ensureOperations(shell, role) {
  const grid = shell.querySelector(".nav20-ops-grid");
  if (!grid) return;
  const admin = ADMIN_ROLES.has(role);
  const owner = role === "owner";
  const signature = `${role}|${admin}|${owner}`;
  let section = grid.querySelector("[data-promo27-ops-group]");
  if (section?.dataset.promo27Role === signature) return;
  section?.remove();

  section = document.createElement("section");
  section.className = "nav20-ops-group promo27-ops-group";
  section.dataset.promo27OpsGroup = "true";
  section.dataset.promo27Role = signature;
  section.innerHTML = `
    <div class="nav20-ops-heading"><span>Intelligence</span><strong>Analysis & research</strong></div>
    <div class="nav20-ops-links">
      ${operationLink("/intelligence", "Intelligence Center", "Structured subject review across authorized Cognitus records")}
      ${operationLink("/investigations", "Investigations", "Saved case workspaces and authorized report history")}
      ${operationLink("/analytics", "Activity Analytics", "Review your search and check activity")}
      ${operationLink("/promotional-access", "Feature Access", "Entitlements, access codes, and restricted analysis tools")}
      ${operationLink("/labs", "Cognitus Labs", "Controlled experimental and early-access capabilities")}
      ${admin ? operationLink("/admin/promotions", "Feature Access Management", "Create access codes, direct grants, limits, and revocations") : ""}
      ${owner ? operationLink("/executive", "Executive Control", "Executive_Eagle event and owner control center") : ""}
    </div>`;
  grid.appendChild(section);
}

function updateActiveState(shell) {
  const current = currentRoute();
  shell.querySelectorAll("[data-promo27-operation]").forEach((link) => {
    const active = link.dataset.promo27Route === current;
    link.classList.toggle("is-current", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const operationsButton = shell.querySelector("[data-nav20-operations]");
  const intelligenceActive = C.PROMO_ROUTES.has(current) || current === "/executive";
  operationsButton?.classList.toggle("is-active", intelligenceActive);
}

function observeShell(shell) {
  if (observedShell === shell) return;
  shellObserver?.disconnect();
  observedShell = shell;
  if (!shell) return;
  shellObserver = new MutationObserver(() => scheduleSync());
  shellObserver.observe(shell, { childList: true });
}

function sync() {
  if (!nav || !sourceAuthenticated()) return;
  const shell = nav.querySelector(":scope > .nav20-shell");
  observeShell(shell);
  if (!shell) return;
  const role = sourceRole();
  removeLegacyPrimary(shell);
  ensureOperations(shell, role);
  updateActiveState(shell);
}

function scheduleSync() {
  if (frame) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    frame = 0;
    sync();
  });
}

export function startPromotionalNavigationV27() {
  if (!nav) return;
  navObserver = new MutationObserver(() => scheduleSync());
  navObserver.observe(nav, { childList: true });
  scheduleSync();
  window.addEventListener("hashchange", scheduleSync);
  window.addEventListener("pageshow", scheduleSync);
  document.addEventListener(C.PROMO_RENDER_EVENT, scheduleSync);
  document.addEventListener("cognitus:frenzy-state", scheduleSync);
}
