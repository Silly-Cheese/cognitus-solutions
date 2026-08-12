const UX_BUILD = "20260812";

function mountStyles() {
  if (document.querySelector("#cognitus-ux-v3")) return;
  const link = document.createElement("link");
  link.id = "cognitus-ux-v3";
  link.rel = "stylesheet";
  link.href = `./src/uxV3.css?v=${UX_BUILD}`;
  document.head.appendChild(link);
}

function sourceNav() { return document.querySelector(".topnav"); }
function pageRoot() { return document.querySelector("#page-root"); }
function isAuthenticated() { return Boolean(sourceNav()?.querySelector('a[href="#/dashboard"]')); }
function linkExists(href) { return Boolean(sourceNav()?.querySelector(`a[href="${href}"]`)); }
function sourceText(selector, fallback = "") { return sourceNav()?.querySelector(selector)?.textContent?.trim() || fallback; }

function closePopovers(except = null) {
  document.querySelectorAll(".workspace-popover").forEach((popover) => {
    if (popover !== except) popover.hidden = true;
  });
  document.querySelectorAll("[data-popover-button]").forEach((button) => {
    if (button.nextElementSibling !== except) button.setAttribute("aria-expanded", "false");
  });
}

function popoverMenu(label, items) {
  const wrap = document.createElement("div");
  wrap.className = "workspace-nav-menu";
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.popoverButton = "true";
  button.setAttribute("aria-expanded", "false");
  button.textContent = `${label} ▾`;
  const popover = document.createElement("div");
  popover.className = "workspace-popover";
  popover.hidden = true;
  for (const item of items) {
    if (!item?.href || !linkExists(item.href)) continue;
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.label;
    popover.appendChild(a);
  }
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = popover.hidden;
    closePopovers(popover);
    popover.hidden = !opening;
    button.setAttribute("aria-expanded", opening ? "true" : "false");
  });
  wrap.append(button, popover);
  return popover.children.length ? wrap : null;
}

function workspaceLink(href, label, primary = false) {
  if (!linkExists(href)) return null;
  const a = document.createElement("a");
  a.href = href;
  a.className = `workspace-nav-link${primary ? " ux-primary-action" : ""}`;
  a.textContent = label;
  return a;
}

function buildWorkspaceNav() {
  const header = document.querySelector(".topbar");
  const nav = sourceNav();
  if (!header || !nav) return;

  if (!isAuthenticated()) {
    nav.classList.remove("ux-nav-source");
    document.querySelector(".workspace-nav-shell")?.remove();
    return;
  }

  nav.classList.add("ux-nav-source");
  document.querySelector(".workspace-nav-shell")?.remove();

  const shell = document.createElement("div");
  shell.className = "workspace-nav-shell";
  shell.setAttribute("aria-label", "Cognitus workspace navigation");

  const main = document.createElement("nav");
  main.className = "workspace-nav-main";
  main.setAttribute("aria-label", "Workspace");

  [
    workspaceLink("#/dashboard", "Dashboard"),
    workspaceLink("#/search", "Run Check"),
    workspaceLink("#/history", "History"),
    workspaceLink("#/organizations", "Organizations"),
    workspaceLink("#/organizations?request=1", "New Organization", true)
  ].filter(Boolean).forEach((node) => main.appendChild(node));

  const workflows = popoverMenu("Workflows", [
    { href: "#/reports/submit", label: "Submit Report" },
    { href: "#/claims", label: "Profile Claims" },
    { href: "#/appeals", label: "Appeals & Corrections" }
  ]);
  if (workflows) main.appendChild(workflows);

  const staff = popoverMenu("Staff", [
    { href: "#/review", label: "Review Queue" },
    { href: "#/admin", label: "Administration" }
  ]);
  if (staff) main.appendChild(staff);

  const settings = workspaceLink("#/settings", "Settings");
  if (settings) main.appendChild(settings);

  const spacer = document.createElement("span");
  spacer.className = "workspace-nav-spacer";

  const shortcut = document.createElement("button");
  shortcut.type = "button";
  shortcut.className = "workspace-shortcut";
  shortcut.innerHTML = `Quick nav <kbd>${navigator.platform?.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}+K</kbd>`;
  shortcut.addEventListener("click", openCommandPalette);

  const userWrap = document.createElement("div");
  userWrap.className = "workspace-user";
  const userButton = document.createElement("button");
  userButton.type = "button";
  userButton.className = "workspace-user-button";
  userButton.dataset.popoverButton = "true";
  userButton.setAttribute("aria-expanded", "false");
  const chip = sourceText(".nav-user", "Account");
  const [displayName = "Account", role = ""] = chip.split("·").map((part) => part.trim());
  userButton.innerHTML = `<strong>${escapeMarkup(displayName)}</strong>${role ? `<small>${escapeMarkup(role)}</small>` : ""}`;
  const userPopover = document.createElement("div");
  userPopover.className = "workspace-popover";
  userPopover.hidden = true;
  const accountLink = document.createElement("a");
  accountLink.href = "#/settings";
  accountLink.textContent = "Account settings";
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "Log out";
  logout.addEventListener("click", () => document.querySelector("#logout-button")?.click());
  userPopover.append(accountLink, logout);
  userButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = userPopover.hidden;
    closePopovers(userPopover);
    userPopover.hidden = !opening;
    userButton.setAttribute("aria-expanded", opening ? "true" : "false");
  });
  userWrap.append(userButton, userPopover);

  shell.append(main, spacer, shortcut, userWrap);
  header.insertAdjacentElement("afterend", shell);
  markActiveRoute();
}

function markActiveRoute() {
  const hash = location.hash || "#/";
  document.querySelectorAll(".workspace-nav-link").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const base = href.split("?")[0];
    const active = href.includes("?request=1") ? hash.includes("#/organizations?request=1") : hash.split("?")[0] === base;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
}

function escapeMarkup(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastRegion = null;
function showToast(message, tone = "neutral") {
  if (!toastRegion) {
    toastRegion = document.createElement("div");
    toastRegion.className = "ux-toast-region";
    toastRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRegion);
  }
  const toast = document.createElement("div");
  toast.className = `ux-toast${tone === "error" ? " is-error" : ""}`;
  toast.textContent = String(message || "Done");
  toastRegion.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function installToastAlerts() {
  if (window.__cognitusAlertUpgraded) return;
  window.__cognitusAlertUpgraded = true;
  window.alert = (message) => showToast(message, /fail|error|denied|incorrect|unable/i.test(String(message)) ? "error" : "neutral");
}

let commandBackdrop = null;
function commandItems() {
  const items = [
    ["#/dashboard", "Dashboard", "Overview and recent activity"],
    ["#/search", "Run Check", "Search a person or organization"],
    ["#/history", "History", "Your logged checks"],
    ["#/organizations", "Organizations", "Organization directory"],
    ["#/organizations?request=1", "New Organization", "Request an organization record"],
    ["#/reports/submit", "Submit Report", "Send a record for review"],
    ["#/claims", "Claims", "Claim a matching profile"],
    ["#/appeals", "Appeals", "Challenge or correct a report"],
    ["#/review", "Review Queue", "Reviewer workflows"],
    ["#/admin", "Administration", "Users and organization controls"],
    ["#/settings", "Settings", "Profile and security"]
  ];
  return items.filter(([href]) => linkExists(href));
}

function ensureCommandPalette() {
  if (commandBackdrop) return;
  commandBackdrop = document.createElement("div");
  commandBackdrop.className = "ux-command-backdrop";
  commandBackdrop.hidden = true;
  commandBackdrop.innerHTML = `<div class="ux-command" role="dialog" aria-modal="true" aria-label="Quick navigation"><input type="search" placeholder="Go to a page…" aria-label="Search Cognitus pages"><div class="ux-command-results"></div><div class="ux-command-footer">Enter to open · Esc to close</div></div>`;
  document.body.appendChild(commandBackdrop);
  commandBackdrop.addEventListener("click", (event) => { if (event.target === commandBackdrop) closeCommandPalette(); });
  const input = commandBackdrop.querySelector("input");
  input.addEventListener("input", renderCommandResults);
  input.addEventListener("keydown", (event) => {
    const buttons = [...commandBackdrop.querySelectorAll(".ux-command-item")];
    let index = buttons.findIndex((button) => button.classList.contains("is-selected"));
    if (event.key === "ArrowDown") { event.preventDefault(); index = Math.min(buttons.length - 1, index + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); index = Math.max(0, index - 1); }
    else if (event.key === "Enter" && buttons.length) { event.preventDefault(); (buttons[index >= 0 ? index : 0]).click(); return; }
    else if (event.key === "Escape") { closeCommandPalette(); return; }
    else return;
    buttons.forEach((button, i) => button.classList.toggle("is-selected", i === index));
  });
}

function renderCommandResults() {
  ensureCommandPalette();
  const input = commandBackdrop.querySelector("input");
  const results = commandBackdrop.querySelector(".ux-command-results");
  const query = input.value.trim().toLowerCase();
  const items = commandItems().filter(([, label, description]) => `${label} ${description}`.toLowerCase().includes(query));
  results.innerHTML = "";
  for (const [href, label, description] of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ux-command-item";
    button.innerHTML = `<span>${escapeMarkup(label)}</span><small>${escapeMarkup(description)}</small>`;
    button.addEventListener("click", () => { location.hash = href; closeCommandPalette(); });
    results.appendChild(button);
  }
  results.firstElementChild?.classList.add("is-selected");
}

function openCommandPalette() {
  if (!isAuthenticated()) return;
  ensureCommandPalette();
  commandBackdrop.hidden = false;
  const input = commandBackdrop.querySelector("input");
  input.value = "";
  renderCommandResults();
  requestAnimationFrame(() => input.focus());
}
function closeCommandPalette() { if (commandBackdrop) commandBackdrop.hidden = true; }

function decorateStatuses() {
  const selectors = [".record-meta span", ".record-row small", ".stat-card strong", ".account-card small"];
  const success = /^(active|approved|verified|good|accepted|published)$/i;
  const warning = /^(pending|pending_review|pending_verification|under_review|watch|moderate|restricted|self_declared|unreviewed)$/i;
  const danger = /^(banned|suspended|denied|critical|high_risk|concern|disputed)$/i;
  document.querySelectorAll(selectors.join(",")).forEach((node) => {
    const value = node.textContent?.trim() || "";
    if (!value || value.length > 32 || value.includes("·")) return;
    node.classList.remove("ux-status", "ux-status-success", "ux-status-warning", "ux-status-danger", "ux-status-neutral");
    if (success.test(value)) node.classList.add("ux-status", "ux-status-success");
    else if (warning.test(value)) node.classList.add("ux-status", "ux-status-warning");
    else if (danger.test(value)) node.classList.add("ux-status", "ux-status-danger");
  });
}

function improveEmptyStates() {
  const hash = location.hash.split("?")[0];
  document.querySelectorAll(".empty-state").forEach((state) => {
    if (state.querySelector(".ux-empty-action")) return;
    let href = null, label = null;
    if (hash === "#/history" || hash === "#/dashboard") { href = "#/search"; label = "Run a check"; }
    else if (hash === "#/organizations") { href = "#/organizations?request=1"; label = "Request an organization"; }
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.className = "button button-light ux-empty-action";
    a.textContent = label;
    a.style.marginTop = ".75rem";
    a.style.width = "max-content";
    state.appendChild(a);
  });
}

function decoratePage() {
  const root = pageRoot();
  if (!root) return;
  root.classList.remove("ux-page-enter");
  void root.offsetWidth;
  root.classList.add("ux-page-enter");
  const loading = root.querySelector(".hero .eyebrow")?.textContent?.trim().toLowerCase() === "loading";
  root.querySelector(".hero")?.classList.toggle("ux-loading-card", loading);
  decorateStatuses();
  improveEmptyStates();
  markActiveRoute();
}

let scheduled = false;
function syncUX() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    buildWorkspaceNav();
    decoratePage();
  });
}

mountStyles();
installToastAlerts();
ensureCommandPalette();

document.addEventListener("click", () => closePopovers());
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (commandBackdrop?.hidden === false) closeCommandPalette(); else openCommandPalette();
  }
  if (event.key === "Escape") closePopovers();
});
window.addEventListener("hashchange", () => { closePopovers(); closeCommandPalette(); window.scrollTo({ top: 0, behavior: "smooth" }); syncUX(); });
window.addEventListener("DOMContentLoaded", syncUX);

const observer = new MutationObserver(syncUX);
if (sourceNav()) observer.observe(sourceNav(), { childList: true, subtree: true });
if (pageRoot()) observer.observe(pageRoot(), { childList: true, subtree: true });
syncUX();
