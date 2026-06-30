import { getAccountStore, signOutCurrentUser } from "../state/accountStore.js";
import { isAdminOrOwner, isOwner, isReviewerOrHigher } from "../security/permissions.js";
import { listChecksByUser } from "../services/checkService.js";
import { listSavedCandidates, listSavedOrganizations } from "../services/savedService.js";
import { listNotificationsForUser } from "../services/notificationService.js";
import {
  statCard,
  recordList,
  checkLogItem,
  savedCandidateItem,
  savedOrganizationItem,
  notificationItem
} from "../components/dashboardCards.js";

export async function renderDashboardPage(root) {
  const account = getAccountStore();

  if (account.loading) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Loading</p>
        <h1>Checking your account...</h1>
        <p>Please wait while Cognitus loads your account state.</p>
      </section>
    `;
    return;
  }

  if (!account.record) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Login Required</p>
        <h1>You need an account to access the portal.</h1>
        <p>Checks, reports, profile claims, and organization tools require a logged-in Cognitus account.</p>
        <div class="hero-actions">
          <a class="button button-dark" href="#/login">Login</a>
          <a class="button button-light" href="#/register">Create Account</a>
        </div>
      </section>
    `;
    return;
  }

  root.innerHTML = getDashboardShell(account.record);
  attachDashboardActions(root);
  await hydrateDashboardData(root, account.record);
}

function getDashboardShell(user) {
  return `
    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h1>Welcome, ${user.displayName}.</h1>
        <p>Run checks, monitor your activity, save candidates, review notifications, and manage your Cognitus account.</p>
      </div>
      <div class="account-card">
        <span>Cognitus ID</span>
        <strong>${user.cognitusId || "Pending"}</strong>
        <small>${user.role || "user"} · ${user.discordId || "No Discord ID"}</small>
      </div>
    </section>

    <section class="quick-actions">
      <a class="button button-dark" href="#/search">Run a Check</a>
      <a class="button button-light" href="#/claims">Claim Profile</a>
      <a class="button button-light" href="#/reports/submit">Submit Report</a>
      <a class="button button-light" href="#/appeals">Appeals</a>
      ${isReviewerOrHigher(user) ? `<a class="button button-light" href="#/admin">Review/Admin Tools</a>` : ""}
      ${isAdminOrOwner(user) ? `<a class="button button-light" href="#/admin">Management Console</a>` : ""}
      ${isOwner(user) ? `<a class="button button-light" href="#/owner">Owner Console</a>` : ""}
      <button id="logout-button" class="button button-light" type="button">Logout</button>
    </section>

    <section id="dashboard-stats" class="stats-grid">
      ${statCard("Recent Checks", "—", "Checks you have run")}
      ${statCard("Saved Candidates", "—", "Profiles saved for review")}
      ${statCard("Saved Organizations", "—", "Organizations saved for review")}
      ${statCard("Notifications", "—", "Account updates")}
    </section>

    <section class="dashboard-grid">
      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Activity</p>
            <h2>Recent Checks</h2>
          </div>
          <a href="#/history">View All</a>
        </div>
        <div id="recent-checks" class="loading-block">Loading recent checks...</div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Hiring</p>
            <h2>Saved Candidates</h2>
          </div>
          <a href="#/candidates">Open</a>
        </div>
        <div id="saved-candidates" class="loading-block">Loading saved candidates...</div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Organizations</p>
            <h2>Saved Organizations</h2>
          </div>
          <a href="#/organizations/saved">Open</a>
        </div>
        <div id="saved-organizations" class="loading-block">Loading saved organizations...</div>
      </article>

      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Updates</p>
            <h2>Notifications</h2>
          </div>
          <a href="#/notifications">Open</a>
        </div>
        <div id="notifications" class="loading-block">Loading notifications...</div>
      </article>
    </section>
  `;
}

async function hydrateDashboardData(root, user) {
  try {
    const [checks, candidates, organizations, notifications] = await Promise.all([
      listChecksByUser(user.uid, 5),
      listSavedCandidates(user, 5),
      listSavedOrganizations(user, 5),
      listNotificationsForUser(user.uid, 5)
    ]);

    root.querySelector("#dashboard-stats").innerHTML = `
      ${statCard("Recent Checks", checks.length, "Latest checks shown")}
      ${statCard("Saved Candidates", candidates.length, "Ready for hiring review")}
      ${statCard("Saved Organizations", organizations.length, "Partnership/employer review")}
      ${statCard("Notifications", notifications.filter((item) => !item.read).length, "Unread updates")}
    `;

    root.querySelector("#recent-checks").innerHTML = recordList(
      checks,
      checkLogItem,
      "No checks yet",
      "When you run a person or organization check, it will appear here."
    );

    root.querySelector("#saved-candidates").innerHTML = recordList(
      candidates,
      savedCandidateItem,
      "No saved candidates",
      "Saved candidate profiles will appear here."
    );

    root.querySelector("#saved-organizations").innerHTML = recordList(
      organizations,
      savedOrganizationItem,
      "No saved organizations",
      "Saved organization records will appear here."
    );

    root.querySelector("#notifications").innerHTML = recordList(
      notifications,
      notificationItem,
      "No notifications",
      "Important account updates will appear here."
    );
  } catch (error) {
    const message = error?.message || "Dashboard data could not be loaded.";
    root.querySelectorAll(".loading-block").forEach((block) => {
      block.innerHTML = `<div class="notice">${message}</div>`;
    });
  }
}

function attachDashboardActions(root) {
  root.querySelector("#logout-button")?.addEventListener("click", async () => {
    await signOutCurrentUser();
    window.location.hash = "#/login";
  });
}
