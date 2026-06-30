import { getAccountStore } from "../state/accountStore.js";
import { isAdminOrOwner, isOwner } from "../security/permissions.js";
import { getAdminOverviewData } from "../services/adminOverviewService.js";
import { statCard } from "../components/dashboardCards.js";
import { adminTable, pill, smallDate } from "../components/adminComponents.js";

export async function renderAdminPage(root) {
  const account = getAccountStore();

  if (!account.record) {
    root.innerHTML = getAccessCard("Login Required", "You must log in before accessing administration tools.", "#/login", "Login");
    return;
  }

  if (!isAdminOrOwner(account.record)) {
    root.innerHTML = getAccessCard("Access Denied", "This area requires Admin or Owner permissions.", "#/dashboard", "Back to Dashboard");
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Administration</p>
      <h1>Admin control center.</h1>
      <p>Manage review queues, users, organizations, password reset requests, audit logs, and operational activity.</p>
      <div class="hero-actions">
        <a class="button button-dark" href="#/review">Review Queue</a>
        <a class="button button-light" href="#/admin/users">Users</a>
        <a class="button button-light" href="#/admin/organizations">Organizations</a>
        <a class="button button-light" href="#/admin/audit">Audit Logs</a>
      </div>
    </section>
    <section id="admin-dashboard" class="loading-block" style="margin-top: 1rem;">Loading admin dashboard...</section>
  `;

  try {
    const data = await getAdminOverviewData();
    root.querySelector("#admin-dashboard").outerHTML = renderAdminDashboard(data);
  } catch (error) {
    root.querySelector("#admin-dashboard").innerHTML = `<div class="notice">${error?.message || "Could not load admin dashboard."}</div>`;
  }
}

export async function renderOwnerPage(root) {
  const account = getAccountStore();

  if (!account.record) {
    root.innerHTML = getAccessCard("Login Required", "You must log in before accessing owner controls.", "#/login", "Login");
    return;
  }

  if (!isOwner(account.record)) {
    root.innerHTML = getAccessCard("Access Denied", "This area requires the Owner role.", "#/dashboard", "Back to Dashboard");
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Owner</p>
      <h1>Owner command center.</h1>
      <p>Platform-level controls for staff access, audit oversight, portal settings, review queues, and emergency operations.</p>
      <div class="hero-actions">
        <a class="button button-dark" href="#/review">Review Queue</a>
        <a class="button button-light" href="#/owner/settings">Portal Settings</a>
        <a class="button button-light" href="#/admin/users">Staff Access</a>
        <a class="button button-light" href="#/admin/audit">Audit Logs</a>
      </div>
    </section>
    <section class="grid" style="margin-top: 1rem;">
      <article class="card"><h2>Staff Access</h2><p>Promote reviewers/admins or demote staff from the user management page.</p><a class="button button-light" href="#/admin/users">Manage Users</a></article>
      <article class="card"><h2>Portal Settings</h2><p>Control maintenance messaging, feature toggles, search limits, and registration status.</p><a class="button button-light" href="#/owner/settings">Open Settings</a></article>
      <article class="card"><h2>Audit Oversight</h2><p>Review platform activity and administrative actions.</p><a class="button button-light" href="#/admin/audit">View Logs</a></article>
      <article class="card"><h2>Review Operations</h2><p>View pending reports, claims, and appeals.</p><a class="button button-light" href="#/review">Open Queue</a></article>
    </section>
  `;
}

function renderAdminDashboard(data) {
  const { recentUsers, recentOrganizations, recentReports, recentChecks, recentAuditLogs } = data;

  return `
    <section>
      <div class="stats-grid">
        ${statCard("Recent Users", recentUsers.length, "Latest accounts shown")}
        ${statCard("Recent Orgs", recentOrganizations.length, "Latest organizations shown")}
        ${statCard("Recent Reports", recentReports.length, "Latest report submissions")}
        ${statCard("Recent Checks", recentChecks.length, "Latest logged checks")}
      </div>
      <div class="dashboard-grid" style="margin-top: 1rem;">
        ${adminTable("Recent Users", recentUsers, [
          { label: "Name", render: (item) => item.displayName || "Unnamed" },
          { label: "Role", render: (item) => pill(item.role || "user") },
          { label: "Status", render: (item) => pill(item.status || "active") },
          { label: "Created", render: (item) => smallDate(item.createdAt) }
        ], "No users found.")}
        ${adminTable("Recent Organizations", recentOrganizations, [
          { label: "Name", render: (item) => item.name || "Unnamed" },
          { label: "Verification", render: (item) => pill(item.verificationStatus || "pending") },
          { label: "Trust", render: (item) => pill(item.trustLevel || "unreviewed") },
          { label: "Created", render: (item) => smallDate(item.createdAt) }
        ], "No organizations found.")}
        ${adminTable("Recent Reports", recentReports, [
          { label: "Summary", render: (item) => item.summary || "Report" },
          { label: "Status", render: (item) => pill(item.status || "pending") },
          { label: "Severity", render: (item) => pill(item.severity || "Info") },
          { label: "Created", render: (item) => smallDate(item.createdAt) }
        ], "No reports found.")}
        ${adminTable("Recent Audit Logs", recentAuditLogs, [
          { label: "Action", render: (item) => item.action || "Action" },
          { label: "Target", render: (item) => item.targetType || "Target" },
          { label: "Summary", render: (item) => item.summary || "No summary" },
          { label: "Time", render: (item) => smallDate(item.createdAt) }
        ], "No audit logs found.")}
      </div>
    </section>
  `;
}

function getAccessCard(eyebrow, message, href, cta) {
  return `
    <section class="hero">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${message}</h1>
      <div class="hero-actions"><a class="button button-dark" href="${href}">${cta}</a></div>
    </section>
  `;
}
