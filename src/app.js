import { APP_NAME, ROUTES } from "./data/constants.js";
import { createCognitusId } from "./utils/cognitusIds.js";
import { setPageTitle } from "./utils/dom.js";
import { startAccountStore, subscribeAccountStore, getAccountStore } from "./state/accountStore.js";
import { renderLoginPage, renderRegisterPage } from "./pages/authPages.js";
import { renderDashboardPage } from "./pages/dashboardPage.js";

const pageRoot = document.querySelector("#page-root");
const topnav = document.querySelector(".topnav");

const pages = {
  "/": renderHome,
  "/about": renderAbout,
  "/login": () => renderLoginPage(pageRoot),
  "/register": () => renderRegisterPage(pageRoot),
  "/dashboard": () => renderDashboardPage(pageRoot),
  "/setup": renderSetupPlaceholder,
  "/password-reset": renderPasswordResetPlaceholder
};

function getRoute() {
  const hash = window.location.hash.replace("#", "");
  return hash || "/";
}

function navigate() {
  const route = getRoute();
  const render = pages[route] || renderNotFound;
  render();
  renderNavigation();
  pageRoot?.focus();
}

function renderNavigation() {
  const account = getAccountStore();
  const loggedIn = Boolean(account.record);

  topnav.innerHTML = loggedIn
    ? `
      <a href="#/">Home</a>
      <a href="#/about">About</a>
      <a href="#/dashboard">Dashboard</a>
      <span class="nav-user">${account.record.displayName}</span>
    `
    : `
      <a href="#/">Home</a>
      <a href="#/about">About</a>
      <a href="#/login">Login</a>
      <a class="button button-dark" href="#/register">Create Account</a>
    `;
}

function renderHome() {
  setPageTitle("Home");
  pageRoot.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${APP_NAME}</p>
      <h1>The go-to screening portal for Roblox and Discord employers.</h1>
      <p>
        Search people and organizations, require a reason for every check, document hiring decisions,
        download professional reports, and keep a permanent Cognitus ID tied to every major record.
      </p>
      <div class="hero-actions">
        <a class="button button-dark" href="#/register">Create Account</a>
        <a class="button button-light" href="#/login">Login</a>
      </div>
    </section>

    <section class="grid" style="margin-top: 1rem;">
      <article class="card">
        <h2>People Checks</h2>
        <p>Search by Roblox username, Discord username, or Discord ID after logging in and selecting a required check reason.</p>
      </article>
      <article class="card">
        <h2>Organization Checks</h2>
        <p>Review organizations, save potential partners, and document partnership or employer trust decisions.</p>
      </article>
      <article class="card">
        <h2>Permanent IDs</h2>
        <p>Every user, organization, report, check, appeal, and audit log receives a permanent Cognitus ID.</p>
      </article>
    </section>
  `;
}

function renderAbout() {
  setPageTitle("About");
  pageRoot.innerHTML = `
    <section class="hero">
      <p class="eyebrow">About Cognitus</p>
      <h1>Built for documented hiring decisions.</h1>
      <p>
        Cognitus Solutions is designed to help communities make better hiring and partnership decisions
        through identity history, organization records, conduct reports, appeals, and transparent audit logs.
      </p>
    </section>
    <section class="grid" style="margin-top: 1rem;">
      <article class="card">
        <h2>Identity</h2>
        <p>Profiles can connect Discord IDs, Discord usernames, Roblox usernames, and known aliases.</p>
      </article>
      <article class="card">
        <h2>Review</h2>
        <p>Reports do not become trusted records automatically. They move through review, appeal, and correction workflows.</p>
      </article>
      <article class="card">
        <h2>Accountability</h2>
        <p>Checks, downloads, edits, reviews, and administrative decisions are logged for owner oversight.</p>
      </article>
    </section>
  `;
}

function renderPasswordResetPlaceholder() {
  setPageTitle("Password Reset");
  pageRoot.innerHTML = `
    <section class="form-card">
      <p class="eyebrow">Password Reset</p>
      <h1>Request account help</h1>
      <p class="muted">The password reset request workflow will be added with the account management features.</p>
      <div class="notice">Because Cognitus does not collect real emails, password resets are handled by admin-reviewed requests.</div>
      <div class="hero-actions"><a class="button button-dark" href="#/login">Back to Login</a></div>
    </section>
  `;
}

function renderSetupPlaceholder() {
  setPageTitle("Setup");
  const sampleId = createCognitusId("USR");
  pageRoot.innerHTML = `
    <section class="hero">
      <p class="eyebrow">Setup</p>
      <h1>Foundation ready.</h1>
      <p>This page confirms the utility modules are loading. Example generated Cognitus ID: <strong>${sampleId}</strong></p>
      <div class="notice">Firebase credentials and Firestore rules will be added later, not manually created collection-by-collection.</div>
    </section>
  `;
}

function renderNotFound() {
  setPageTitle("Not Found");
  pageRoot.innerHTML = `
    <section class="hero">
      <p class="eyebrow">404</p>
      <h1>Page not found.</h1>
      <p>The route <strong>${getRoute()}</strong> does not exist yet.</p>
      <div class="hero-actions"><a class="button button-dark" href="#/">Return Home</a></div>
    </section>
  `;
}

window.addEventListener("hashchange", navigate);
window.addEventListener("DOMContentLoaded", async () => {
  renderNavigation();
  navigate();
  await startAccountStore();
  subscribeAccountStore(() => {
    renderNavigation();
    if (["/login", "/register", "/dashboard"].includes(getRoute())) {
      navigate();
    }
  });
});

console.info(`${APP_NAME} loaded with ${ROUTES.length} planned routes.`);
