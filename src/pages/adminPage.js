import { getAccountStore } from "../state/accountStore.js";
import { isAdminOrOwner, isOwner } from "../security/permissions.js";

export function renderAdminPage(root) {
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
    <section class="hero">
      <p class="eyebrow">Administration</p>
      <h1>Admin control center.</h1>
      <p>Admin tools will be expanded in Part 10. This route is now role-protected and ready for future modules.</p>
    </section>
    <section class="grid" style="margin-top: 1rem;">
      <article class="card"><h2>Manage Users</h2><p>Role changes, restrictions, and account review will be added later.</p></article>
      <article class="card"><h2>Manage Organizations</h2><p>Organization verification and review tools will be added later.</p></article>
      <article class="card"><h2>Review Records</h2><p>Report, appeal, and claim queues will be connected in later parts.</p></article>
    </section>
  `;
}

export function renderOwnerPage(root) {
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
    <section class="hero">
      <p class="eyebrow">Owner</p>
      <h1>Owner command center.</h1>
      <p>Owner-only tools will be built in Part 10. This route is now protected for the permanent Cognitus owner role.</p>
    </section>
    <section class="grid" style="margin-top: 1rem;">
      <article class="card"><h2>Portal Settings</h2><p>Platform settings and standards will live here.</p></article>
      <article class="card"><h2>Audit Logs</h2><p>Owner review of major actions will live here.</p></article>
      <article class="card"><h2>Staff Access</h2><p>Owner management of administrators and reviewers will live here.</p></article>
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
