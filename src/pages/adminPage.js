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
      <p>Administrative operations are being connected in stages. Review workflows are now active.</p>
      <div class="hero-actions"><a class="button button-dark" href="#/review">Open Review Queue</a></div>
    </section>
    <section class="grid" style="margin-top: 1rem;">
      <article class="card"><h2>Review Records</h2><p>Review pending reports, profile claims, and appeals.</p><a class="button button-light" href="#/review">Open Queue</a></article>
      <article class="card"><h2>Manage Users</h2><p>Role changes, restrictions, and account review will be expanded in Part 10.</p></article>
      <article class="card"><h2>Manage Organizations</h2><p>Organization verification and review tools will be expanded in Part 10.</p></article>
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
      <p>Owner-only tools will be built in Part 10. Review workflows are now connected.</p>
      <div class="hero-actions"><a class="button button-dark" href="#/review">Open Review Queue</a></div>
    </section>
    <section class="grid" style="margin-top: 1rem;">
      <article class="card"><h2>Review Queue</h2><p>Owner access to pending reports, claims, and appeals.</p><a class="button button-light" href="#/review">Open Queue</a></article>
      <article class="card"><h2>Audit Logs</h2><p>Owner review of major actions will live here in Part 10.</p></article>
      <article class="card"><h2>Staff Access</h2><p>Owner management of administrators and reviewers will live here in Part 10.</p></article>
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
