import { getAccountStore, signOutCurrentUser } from "../state/accountStore.js";
import { isAdminOrOwner, isOwner, isReviewerOrHigher } from "../security/permissions.js";

export function renderDashboardPage(root) {
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

  root.innerHTML = `
    <section class="hero">
      <p class="eyebrow">Dashboard</p>
      <h1>Welcome, ${account.record.displayName}.</h1>
      <p>Your Cognitus account is active. Search, reports, claims, appeals, and organization tools will be added in upcoming parts.</p>
      <div class="notice">
        <strong>Cognitus ID:</strong> ${account.record.cognitusId || "Pending"}<br />
        <strong>Role:</strong> ${account.record.role || "user"}<br />
        <strong>Discord ID:</strong> ${account.record.discordId || "Not listed"}
      </div>
      <div class="hero-actions">
        ${isReviewerOrHigher(account.record) ? `<a class="button button-dark" href="#/admin">Review/Admin Tools</a>` : ""}
        ${isAdminOrOwner(account.record) ? `<a class="button button-light" href="#/admin">Management Console</a>` : ""}
        ${isOwner(account.record) ? `<a class="button button-light" href="#/owner">Owner Console</a>` : ""}
        <button id="logout-button" class="button button-light" type="button">Logout</button>
      </div>
    </section>

    <section class="grid" style="margin-top: 1rem;">
      <article class="card">
        <h2>Run Check</h2>
        <p>Coming in Part 7. Every check will require a reason before running.</p>
      </article>
      <article class="card">
        <h2>Saved Candidates</h2>
        <p>Coming in a later part. Employers will be able to track hiring decisions.</p>
      </article>
      <article class="card">
        <h2>Profile Claims</h2>
        <p>Coming in Part 9. Users will be able to claim profiles using Discord ID verification.</p>
      </article>
    </section>
  `;

  root.querySelector("#logout-button")?.addEventListener("click", async () => {
    await signOutCurrentUser();
    window.location.hash = "#/login";
  });
}
