const nav = document.querySelector(".topnav");
const topbar = document.querySelector(".topbar");
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
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Zm-7.5 8.5c.45-4.1 3.14-6.5 7.5-6.5s7.05 2.4 7.5 6.5h-15Z"/></svg>',
  employer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6a2 2 0 0 1 2 2v1h2.5A2.5 2.5 0 0 1 22 9.5v8A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5v-8A2.5 2.5 0 0 1 4.5 7H7V6a2 2 0 0 1 2-2Zm0 3h6V6H9v1Zm-5 5.15V17.5c0 .28.22.5.5.5h15a.5.5 0 0 0 .5-.5v-5.35A17.7 17.7 0 0 1 13 14v1h-2v-1a17.7 17.7 0 0 1-7-1.85Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 1 0 4.67 13.37L20.8 22 22 20.8l-5.63-5.63A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"/></svg>',
  reports: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2Zm8 2H6v16h12V8h-4V4Zm-5 8h6v2H9v-2Zm0 4h6v2H9v-2Z"/></svg>',
  actions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6-2-2.6V9a5 5 0 0 0-4-4.9V3a1 1 0 1 0-2 0v1.1A5 5 0 0 0 7 9v4.4L5 16v2h14v-2Z"/></svg>',
  operations: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.1 13.4 1.45 1.1-2 3.46-1.75-.72a7.8 7.8 0 0 1-1.7.98L15.86 20h-4l-.24-1.78a7.8 7.8 0 0 1-1.7-.98l-1.75.72-2-3.46 1.45-1.1a8.5 8.5 0 0 1 0-1.96l-1.45-1.1 2-3.46 1.75.72a7.8 7.8 0 0 1 1.7-.98L11.86 4h4l.24 1.78a7.8 7.8 0 0 1 1.7.98l1.75-.72 2 3.46-1.45 1.1a8.5 8.5 0 0 1 0 1.96ZM13.86 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h9a2 2 0 0 1 2 2v3h-2V5H4v14h9v-3h2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2Zm14.6 5.6L22 12l-3.4 3.4-1.4-1.4 1-1H9v-2h9.2l-1-1 1.4-1.4Z"/></svg>'
};

function mountStyles() {
  if (document.querySelector("#cognitus-navigation-v20")) return;
  const link = document.createElement("link");
  link.id = "cognitus-navigation-v20";
  link.rel = "stylesheet";
  link.href = "./src/navigationV20.css?v=20260816-1";
  document.head.appendChild(link);
}

function sourceAuthenticated() {
  if (!nav) return false;
  return [...nav.children].some((node) => node.matches?.('a[href="#/dashboard"]'));
}

function sourceIdentity() {
  const source = nav?.querySelector(":scope > .nav-user");
  const text = clean(source?.textContent);
  if (!text) return { name: "Cognitus User", role: "user" };
  const pieces = text.split("·").map(clean).filter(Boolean);
  const role = clean(pieces.at(-1) || "user").toLowerCase();
  const name = pieces.length > 1 ? pieces.slice(0, -1).join(" · ") : pieces[0];
  return { name: name || "Cognitus User", role };
}

function sourceActionCount() {
  return clean(nav?.querySelector(":scope > [data-f19-actions] .f19-action-count")?.textContent);
}

function initials(name) {
  const words = clean(name).split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : (words[0] || "C").slice(0, 2)).toUpperCase();
}

function primaryLink(href, label, iconName, extraClass = "") {
  return `<a class="nav20-primary-link ${extraClass}" href="${href}" data-nav20-route="${href}">${ICONS[iconName]}<span>${escapeHtml(label)}</span></a>`;
}

function operationsForRole(role) {
  const employer = EMPLOYER_ROLES.has(role);
  const admin = ADMIN_ROLES.has(role);
  const owner = role === "owner";
  const groups = [
    {
      eyebrow: "My work",
      title: "Records & workflows",
      items: [
        ["#/history", "History", "Previous logged checks"],
        ["#/reports/submit", "Submit Report", "Add information for Cognitus review"],
        ["#/claims", "Claims", "Identity and record claims"],
        ["#/appeals", "Appeals", "Challenge or correct reviewed information"],
        ["#/privacy-center", "Data & Privacy", "Data snapshot, correction and deletion requests"]
      ]
    },
    {
      eyebrow: "Organizations",
      title: "Employer operations",
      items: [
        ["#/organizations", "Organizations", "Browse and manage organization records"],
        ["#/organizations?request=1", "New Organization", "Create or request an organization"],
        ["#/employer-status", "Employer Status", "Request or review employer access"],
        ...(employer ? [["#/employer/members", "Organization Members", "Members and granular permissions"]] : [])
      ]
    }
  ];
  if (["reviewer", "admin", "owner"].includes(role)) {
    groups.push({
      eyebrow: "Cognitus staff",
      title: "Review & administration",
      items: [
        ["#/review", "Review Queue", "Reports, claims and appeals requiring review"],
        ...(admin ? [["#/admin", "Administration", "Accounts, organizations and platform records"], ["#/audit", "Audit Center", "Search sensitive operational activity"]] : []),
        ...(owner ? [["#/people-integrity", "People Integrity", "Duplicate detection and canonical merges"], ["#/system-health", "System Health", "Diagnose and repair data integrity"]] : [])
      ]
    });
  }
  return groups;
}

function operationsMarkup(role) {
  return operationsForRole(role).map((group) => `
    <section class="nav20-ops-group">
      <div class="nav20-ops-heading"><span>${escapeHtml(group.eyebrow)}</span><strong>${escapeHtml(group.title)}</strong></div>
      <div class="nav20-ops-links">
        ${group.items.map(([href, label, note]) => `<a href="${href}" data-nav20-operation><span>${escapeHtml(label)}</span><small>${escapeHtml(note)}</small></a>`).join("")}
      </div>
    </section>`).join("");
}

function buildShell() {
  if (!nav || !sourceAuthenticated()) return;
  const { name, role } = sourceIdentity();
  const count = sourceActionCount();
  const employer = EMPLOYER_ROLES.has(role);
  const signature = `${name}|${role}|${count}|${employer}`;
  let shell = nav.querySelector(":scope > .nav20-shell");
  if (shell?.dataset.signature === signature) {
    updateActiveState(shell);
    return;
  }
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "nav20-shell";
    nav.appendChild(shell);
  }
  shell.dataset.signature = signature;
  shell.innerHTML = `
    <div class="nav20-primary" aria-label="Primary workspace navigation">
      ${primaryLink("#/dashboard", "Dashboard", "dashboard")}
      ${primaryLink("#/profile", "Profile", "profile")}
      ${employer ? primaryLink("#/employer", "Employer Hub", "employer", "is-employer") : ""}
      ${primaryLink("#/search", "Run Check", "search")}
      ${primaryLink("#/reports", "Reports", "reports")}
      <a class="nav20-primary-link is-actions" href="#/actions" data-nav20-route="#/actions">${ICONS.actions}<span>Action Center</span>${count ? `<b class="nav20-count">${escapeHtml(count)}</b>` : ""}</a>
    </div>
    <div class="nav20-operations">
      <button type="button" class="nav20-operations-button" data-nav20-operations aria-expanded="false" aria-haspopup="true">${ICONS.operations}<span>Operations</span><i aria-hidden="true"></i></button>
      <div class="nav20-operations-panel" data-nav20-operations-panel>
        <div class="nav20-ops-intro"><span>Workspace directory</span><strong>Everything else, organized.</strong><p>Records, organizations, privacy, review and administration live here without crowding your daily workspace.</p></div>
        <div class="nav20-ops-grid">${operationsMarkup(role)}</div>
      </div>
    </div>
    <span class="nav20-divider" aria-hidden="true"></span>
    <a class="nav20-icon-button" href="#/settings" data-nav20-settings title="Settings" aria-label="Settings">${ICONS.settings}</a>
    <button class="nav20-icon-button is-logout" type="button" data-nav20-logout title="Logout" aria-label="Logout">${ICONS.logout}</button>
    <div class="nav20-account" title="${escapeHtml(name)} · ${escapeHtml(role)}">
      <span class="nav20-avatar">${escapeHtml(initials(name))}</span>
      <span class="nav20-account-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(role.replaceAll("_", " "))}</small></span>
    </div>`;
  updateActiveState(shell);
}

function updateActiveState(shell = nav?.querySelector(":scope > .nav20-shell")) {
  if (!shell) return;
  const current = route();
  shell.querySelectorAll("[data-nav20-route]").forEach((link) => {
    const href = link.getAttribute("href")?.replace(/^#/, "").split("?")[0] || "";
    let active = href === current;
    if (href === "/employer") active = current.startsWith("/employer") && current !== "/employer-status" && current !== "/employer/members";
    if (href === "/reports") active = current === "/reports" || current === "/reports/view" || current === "/reports/quick" || current === "/reports/full";
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const opsRoutes = new Set(["/history", "/reports/submit", "/claims", "/appeals", "/privacy-center", "/organizations", "/employer-status", "/employer/members", "/review", "/admin", "/audit", "/people-integrity", "/system-health", "/people/master"]);
  shell.querySelector("[data-nav20-operations]")?.classList.toggle("is-active", opsRoutes.has(current));
  shell.querySelector("[data-nav20-settings]")?.classList.toggle("is-active", current === "/settings");
  shell.querySelectorAll("[data-nav20-operation]").forEach((link) => {
    const href = link.getAttribute("href")?.replace(/^#/, "").split("?")[0] || "";
    link.classList.toggle("is-current", href === current);
  });
}

function ensureMobileToggle() {
  if (!topbar || !sourceAuthenticated()) return;
  let button = topbar.querySelector("[data-nav20-mobile-toggle]");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "nav20-mobile-toggle";
    button.dataset.nav20MobileToggle = "true";
    button.setAttribute("aria-controls", "cognitus-primary-nav");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = '<span class="nav20-mobile-bars" aria-hidden="true"><i></i><i></i><i></i></span><span>Menu</span>';
    const brand = topbar.querySelector(".brand");
    if (brand) brand.insertAdjacentElement("afterend", button);
    else topbar.prepend(button);
  }
}

function closeOperations() {
  const shell = nav?.querySelector(":scope > .nav20-shell");
  const wrapper = shell?.querySelector(".nav20-operations");
  const button = shell?.querySelector("[data-nav20-operations]");
  wrapper?.classList.remove("is-open");
  button?.setAttribute("aria-expanded", "false");
}

function closeMobile() {
  nav?.classList.remove("nav20-mobile-open");
  const button = topbar?.querySelector("[data-nav20-mobile-toggle]");
  button?.setAttribute("aria-expanded", "false");
  if (button) button.querySelector("span:last-child").textContent = "Menu";
  closeOperations();
}

function sync() {
  mountStyles();
  if (!nav) return;
  if (!sourceAuthenticated()) {
    document.body.classList.remove("nav20-authenticated");
    nav.querySelector(":scope > .nav20-shell")?.remove();
    topbar?.querySelector("[data-nav20-mobile-toggle]")?.remove();
    return;
  }
  document.body.classList.add("nav20-authenticated");
  ensureMobileToggle();
  buildShell();
}

function scheduleSync() {
  timers.forEach(clearTimeout);
  timers = [0, 180, 620, 1500, 2600].map((delay) => setTimeout(sync, delay));
}

mountStyles();
scheduleSync();

nav?.addEventListener("click", (event) => {
  const operations = event.target.closest?.("[data-nav20-operations]");
  if (operations) {
    event.preventDefault();
    event.stopPropagation();
    const wrapper = operations.closest(".nav20-operations");
    const open = !wrapper.classList.contains("is-open");
    closeOperations();
    wrapper.classList.toggle("is-open", open);
    operations.setAttribute("aria-expanded", String(open));
    return;
  }
  if (event.target.closest?.("[data-nav20-logout]")) {
    event.preventDefault();
    nav.querySelector(":scope > #logout-button")?.click();
    return;
  }
  if (event.target.closest?.(".nav20-shell a")) {
    closeMobile();
  }
});

topbar?.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-nav20-mobile-toggle]");
  if (!button) return;
  const open = !nav?.classList.contains("nav20-mobile-open");
  nav?.classList.toggle("nav20-mobile-open", open);
  button.setAttribute("aria-expanded", String(open));
  button.querySelector("span:last-child").textContent = open ? "Close" : "Menu";
  if (!open) closeOperations();
});

document.addEventListener("click", (event) => {
  const wrapper = nav?.querySelector(".nav20-operations");
  if (wrapper && !wrapper.contains(event.target)) closeOperations();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobile();
});

window.addEventListener("hashchange", () => {
  closeMobile();
  scheduleSync();
});
window.addEventListener("pageshow", scheduleSync);
window.addEventListener("focus", () => setTimeout(sync, 0));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) setTimeout(sync, 0);
});
window.addEventListener("resize", () => {
  if (window.innerWidth > 980) closeMobile();
});
