const sourceNav = document.querySelector(".topnav");
const topbar = document.querySelector(".topbar");
const MOBILE_BREAKPOINT = 1180;
const EMPLOYER_ROLES = new Set(["verified_employer_member", "org_admin", "reviewer", "admin", "owner"]);
const ADMIN_ROLES = new Set(["admin", "owner"]);
let timers = [];

const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const currentRoute = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const currentRouteKey = () => location.hash.replace(/^#/, "") || "/";

function mountStyles() {
  let link = document.querySelector("#cognitus-navigation-v25");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-navigation-v25";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/navigationMobileV25.css?v=20260817-v25-dedicated-mobile-shell";
}

function sourceAuthenticated() {
  return Boolean(sourceNav?.querySelector('a[href="#/dashboard"]'));
}

function sourceIdentity() {
  const text = clean(sourceNav?.querySelector(":scope > .nav-user")?.textContent);
  if (!text) return { name: "Cognitus User", role: "user" };
  const parts = text.split("·").map(clean).filter(Boolean);
  return {
    name: parts.length > 1 ? parts.slice(0, -1).join(" · ") : (parts[0] || "Cognitus User"),
    role: clean(parts.at(-1) || "user").toLowerCase()
  };
}

function sourceActionCount() {
  return clean(sourceNav?.querySelector(":scope > [data-f19-actions] .f19-action-count")?.textContent);
}

function initials(name) {
  const words = clean(name).split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : (words[0] || "C").slice(0, 2)).toUpperCase();
}

function operationsForRole(role) {
  const employer = EMPLOYER_ROLES.has(role);
  const admin = ADMIN_ROLES.has(role);
  const owner = role === "owner";
  const groups = [
    {
      label: "My work",
      items: [
        ["/history", "History", "Previous logged checks"],
        ["/reports/submit", "Submit Report", "Add information for Cognitus review"],
        ["/claims", "Claims", "Identity and record claims"],
        ["/appeals", "Appeals", "Challenge or correct reviewed information"],
        ["/privacy-center", "Data & Privacy", "Your Cognitus data and privacy requests"]
      ]
    },
    {
      label: "Organizations",
      items: [
        ["/organizations", "Organizations", "Browse and manage organization records"],
        ["/organizations?request=1", "New Organization", "Create or request an organization"],
        ["/employer-status", "Employer Status", "Request or review employer access"],
        ...(employer ? [["/employer/members", "Organization Members", "Members and granular permissions"]] : [])
      ]
    }
  ];
  if (["reviewer", "admin", "owner"].includes(role)) {
    groups.push({
      label: "Cognitus staff",
      items: [
        ["/review", "Review Queue", "Reports, claims and appeals requiring review"],
        ...(admin ? [["/admin", "Administration", "Accounts, organizations and platform records"], ["/audit", "Audit Center", "Search operational activity"]] : []),
        ...(owner ? [["/people-integrity", "People Integrity", "Duplicate detection and canonical merges"], ["/system-health", "System Health", "Diagnose and repair data integrity"]] : [])
      ]
    });
  }
  return groups;
}

function primaryItems(role, count) {
  return [
    ["/dashboard", "Dashboard", "Workspace overview", "home"],
    ["/profile", "Profile", "Your Cognitus identity", "person"],
    ...(EMPLOYER_ROLES.has(role) ? [["/employer", "Employer Hub", "Talent and employment workspace", "briefcase"]] : []),
    ["/search", "Run Check", "Search and screen records", "search"],
    ["/reports", "Reports", "Full reports and access", "document"],
    ["/actions", "Action Center", count ? `${count} item${count === "1" ? "" : "s"} need attention` : "Pending workflow decisions", "bell"]
  ];
}

const ICONS = {
  home: "▦",
  person: "●",
  briefcase: "▣",
  search: "⌕",
  document: "▤",
  bell: "◆"
};

function routeActive(path) {
  const route = currentRoute();
  const key = currentRouteKey();
  if (path === "/employer") return route.startsWith("/employer") && route !== "/employer-status" && route !== "/employer/members";
  if (path === "/reports") return ["/reports", "/reports/view", "/reports/quick", "/reports/full"].includes(route);
  if (path.includes("?")) return key === path;
  return route === path;
}

function drawerMarkup(name, role, count) {
  const primary = primaryItems(role, count).map(([path, label, note, icon]) => `
    <a class="nav25-primary-link${routeActive(path) ? " is-active" : ""}${path === "/employer" ? " is-employer" : ""}" href="#${escapeHtml(path)}"${routeActive(path) ? ' aria-current="page"' : ""}>
      <span class="nav25-primary-icon" aria-hidden="true">${ICONS[icon]}</span>
      <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></span>
      ${path === "/actions" && count ? `<b class="nav25-count">${escapeHtml(count)}</b>` : ""}
    </a>`).join("");

  const operations = operationsForRole(role).map((group) => `
    <section class="nav25-group">
      <p>${escapeHtml(group.label)}</p>
      <div class="nav25-group-links">
        ${group.items.map(([path, label, note]) => `<a href="#${escapeHtml(path)}" class="${routeActive(path) ? "is-active" : ""}"${routeActive(path) ? ' aria-current="page"' : ""}><strong>${escapeHtml(label)}</strong><small>${escapeHtml(note)}</small></a>`).join("")}
      </div>
    </section>`).join("");

  return `
    <div class="nav25-account">
      <span class="nav25-avatar">${escapeHtml(initials(name))}</span>
      <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(role.replaceAll("_", " "))}</small></span>
    </div>
    <div class="nav25-primary">${primary}</div>
    <div class="nav25-directory">
      <div class="nav25-directory-title"><span>Operations</span><strong>Workspace directory</strong></div>
      ${operations}
    </div>
    <div class="nav25-utilities">
      <a href="#/settings" class="nav25-utility${routeActive("/settings") ? " is-active" : ""}">Settings</a>
      <button type="button" class="nav25-utility is-logout" data-nav25-logout>Logout</button>
    </div>`;
}

function ensureToggle() {
  if (!topbar) return null;
  let control = topbar.querySelector("[data-nav25-toggle]");
  if (!control) {
    control = document.createElement("button");
    control.type = "button";
    control.className = "nav25-toggle";
    control.dataset.nav25Toggle = "true";
    control.setAttribute("aria-controls", "cognitus-mobile-nav25");
    control.setAttribute("aria-expanded", "false");
    control.setAttribute("aria-label", "Open navigation menu");
    control.innerHTML = '<span class="nav25-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="nav25-toggle-label">Menu</span>';
    const brand = topbar.querySelector(".brand");
    if (brand) brand.insertAdjacentElement("afterend", control);
    else topbar.prepend(control);
  }
  return control;
}

function ensureDrawer() {
  let drawer = document.querySelector("#cognitus-mobile-nav25");
  if (!drawer) {
    drawer = document.createElement("aside");
    drawer.id = "cognitus-mobile-nav25";
    drawer.className = "nav25-drawer";
    drawer.hidden = true;
    drawer.setAttribute("aria-label", "Cognitus mobile navigation");
    document.body.appendChild(drawer);
  }
  return drawer;
}

function clearLegacyMobileState() {
  sourceNav?.classList.remove("v4-mobile-open", "nav20-mobile-open");
  document.body.classList.remove("nav20-drawer-open");
  const old = topbar?.querySelector("[data-nav20-mobile-toggle]");
  old?.classList.remove("is-open");
  old?.setAttribute("aria-expanded", "false");
}

function setOpen(open) {
  const drawer = document.querySelector("#cognitus-mobile-nav25");
  const control = topbar?.querySelector("[data-nav25-toggle]");
  const safeOpen = Boolean(open && drawer && control && window.innerWidth <= MOBILE_BREAKPOINT && sourceAuthenticated());
  clearLegacyMobileState();
  document.body.classList.toggle("nav25-open", safeOpen);
  if (drawer) drawer.hidden = !safeOpen;
  if (control) {
    control.classList.toggle("is-open", safeOpen);
    control.setAttribute("aria-expanded", String(safeOpen));
    control.setAttribute("aria-label", safeOpen ? "Close navigation menu" : "Open navigation menu");
    const label = control.querySelector(".nav25-toggle-label");
    if (label) label.textContent = safeOpen ? "Close" : "Menu";
  }
}

function syncHeaderHeight() {
  const height = Math.max(58, Math.round(topbar?.getBoundingClientRect().height || 64));
  document.documentElement.style.setProperty("--nav25-header-height", `${height}px`);
}

function sync() {
  mountStyles();
  if (!sourceAuthenticated()) {
    document.body.classList.remove("nav25-ready");
    setOpen(false);
    topbar?.querySelector("[data-nav25-toggle]")?.remove();
    document.querySelector("#cognitus-mobile-nav25")?.remove();
    return;
  }

  document.body.classList.add("nav25-ready");
  clearLegacyMobileState();
  const control = ensureToggle();
  const drawer = ensureDrawer();
  syncHeaderHeight();

  const { name, role } = sourceIdentity();
  const count = sourceActionCount();
  const signature = `${name}|${role}|${count}|${currentRouteKey()}`;
  if (drawer.dataset.signature !== signature) {
    drawer.dataset.signature = signature;
    drawer.innerHTML = drawerMarkup(name, role, count);
  }

  if (window.innerWidth > MOBILE_BREAKPOINT) setOpen(false);
  control.hidden = false;
}

function scheduleSync() {
  timers.forEach(clearTimeout);
  timers = [0, 140, 520, 1400].map((delay) => setTimeout(sync, delay));
}

mountStyles();
setOpen(false);
scheduleSync();

document.addEventListener("click", (event) => {
  const control = event.target.closest?.("[data-nav25-toggle]");
  if (control) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!document.body.classList.contains("nav25-open"));
    return;
  }

  if (event.target.closest?.("[data-nav25-logout]")) {
    event.preventDefault();
    setOpen(false);
    sourceNav?.querySelector(":scope > #logout-button")?.click();
    return;
  }

  if (event.target.closest?.("#cognitus-mobile-nav25 a, .brand")) setOpen(false);
}, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setOpen(false);
});

window.addEventListener("hashchange", () => {
  setOpen(false);
  scheduleSync();
});
window.addEventListener("pageshow", () => {
  setOpen(false);
  scheduleSync();
});
window.addEventListener("resize", () => {
  syncHeaderHeight();
  if (window.innerWidth > MOBILE_BREAKPOINT) setOpen(false);
  scheduleSync();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    setOpen(false);
    scheduleSync();
  }
});