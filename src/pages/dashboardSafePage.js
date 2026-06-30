import { getAccountStore, signOutCurrentUser } from "../state/accountStore.js";
import { isAdminOrOwner, isOwner, isReviewerOrHigher } from "../security/permissions.js";

function card(label, value, help) {
  return `<article class="stat-card"><span>${label}</span><strong>${value}</strong><small>${help}</small></article>`;
}

function empty(title, text, href, label) {
  return `<div class="empty-state"><h3>${title}</h3><p>${text}</p><a class="button button-light" href="${href}">${label}</a></div>`;
}

export async function renderDashboardSafePage(root) {
  const account = getAccountStore();

  if (account.loading) {
    root.innerHTML = `<section class="hero"><p class="eyebrow">Loading</p><h1>Checking your account...</h1><p>Please wait.</p></section>`;
    return;
  }

  const user = account.record;
  if (!user) {
    root.innerHTML = `<section class="hero"><p class="eyebrow">Login Required</p><h1>You need an account.</h1><div class="hero-actions"><a class="button button-dark" href="#/login">Login</a><a class="button button-light" href="#/register">Create Account</a></div></section>`;
    return;
  }

  root.innerHTML = `
    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h1>Welcome, ${user.displayName}.</h1>
        <p>Use the portal tools below. This dashboard is stabilized and does not run summary queries.</p>
      </div>
      <div class="account-card">
        <span>Cognitus ID</span>
        <strong>${user.cognitusId || "Pending"}</strong>
        <small>${user.role || "user"}</small>
      </div>
    </section>

    <section class="quick-actions">
      <a class="button button-dark" href="#/search">Run a Check</a>
      <a class="button button-light" href="#/history">Check History</a>
      <a class="button button-light" href="#/claims">Claim Profile</a>
      <a class="button button-light" href="#/reports/submit">Submit Report</a>
      <a class="button button-light" href="#/appeals">Appeals</a>
      ${isReviewerOrHigher(user) ? `<a class="button button-light" href="#/review">Review Queue</a>` : ""}
      ${isAdminOrOwner(user) ? `<a class="button button-light" href="#/admin">Management Console</a>` : ""}
      ${isOwner(user) ? `<a class="button button-light" href="#/owner">Owner Console</a>` : ""}
      <button id="logout-button" class="button button-light" type="button">Logout</button>
    </section>

    <section class="stats-grid">
      ${card("Account", user.status || "active", "Current status")}
      ${card("Role", user.role || "user", "Access level")}
      ${card("Discord", user.discordId || "Not listed", "Login identity")}
      ${card("Organization", user.organizationId || "None", "Linked organization")}
    </section>

    <section class="dashboard-grid">
      <article class="panel"><div class="panel-header"><div><p class="eyebrow">Activity</p><h2>Checks</h2></div></div>${empty("Open check history", "View logged checks from the dedicated history page.", "#/history", "Open History")}</article>
      <article class="panel"><div class="panel-header"><div><p class="eyebrow">Hiring</p><h2>Candidates</h2></div></div>${empty("Candidate tools", "Saved candidate tools are available from their own page.", "#/candidates", "Open Candidates")}</article>
      <article class="panel"><div class="panel-header"><div><p class="eyebrow">Organizations</p><h2>Saved Organizations</h2></div></div>${empty("Organization tools", "Saved organization tools are available from their own page.", "#/organizations/saved", "Open Organizations")}</article>
      <article class="panel"><div class="panel-header"><div><p class="eyebrow">Updates</p><h2>Notifications</h2></div></div>${empty("Notifications", "Account updates are available from their own page.", "#/notifications", "Open Notifications")}</article>
    </section>
  `;

  root.querySelector("#logout-button")?.addEventListener("click", async () => {
    await signOutCurrentUser();
    window.location.hash = "#/login";
  });
}
