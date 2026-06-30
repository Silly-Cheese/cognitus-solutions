import { APP_NAME, ROUTES } from "./data/constants.js";
import { createCognitusId } from "./utils/cognitusIds.js";
import { setPageTitle } from "./utils/dom.js";
import { startAccountStore, subscribeAccountStore, getAccountStore } from "./state/accountStore.js";
import { renderLoginPage, renderRegisterPage } from "./pages/authPages.js";
import { renderDashboardPage } from "./pages/dashboardPage.js";
import { renderOwnerBootstrapPage } from "./pages/ownerBootstrapPage.js";
import { renderAdminPage, renderOwnerPage } from "./pages/adminPage.js";
import { renderHomePage, renderAboutPage, renderFeaturesPage, renderTermsPage, renderPrivacyPage } from "./pages/publicPages.js";
import { renderPasswordResetPage } from "./pages/passwordResetPage.js";
import { renderAppPlaceholder } from "./pages/appPlaceholderPages.js";
import { renderSearchPage } from "./pages/searchPage.js";
import { renderHistoryPage } from "./pages/historyPage.js";
import { renderReportPage } from "./pages/reportPage.js";
import { renderReportSubmitPage } from "./pages/reportSubmitPage.js";
import { renderClaimsPage } from "./pages/claimsPage.js";
import { renderAppealsPage } from "./pages/appealsPage.js";
import { renderReviewQueuePage } from "./pages/reviewQueuePage.js";
import { isAdminOrOwner, isOwner, isReviewerOrHigher } from "./security/permissions.js";

const pageRoot = document.querySelector("#page-root");
const topnav = document.querySelector(".topnav");

const protectedRoutes = ["/login", "/register", "/dashboard", "/admin", "/review", "/owner", "/owner-bootstrap", "/search", "/claims", "/reports/submit", "/reports/quick", "/reports/full", "/appeals", "/history", "/candidates", "/organizations/saved", "/notifications"];

const pages = {
  "/": () => renderHomePage(pageRoot),
  "/about": () => renderAboutPage(pageRoot),
  "/features": () => renderFeaturesPage(pageRoot),
  "/terms": () => renderTermsPage(pageRoot),
  "/privacy": () => renderPrivacyPage(pageRoot),
  "/login": () => renderLoginPage(pageRoot),
  "/register": () => renderRegisterPage(pageRoot),
  "/dashboard": () => renderDashboardPage(pageRoot),
  "/search": () => renderSearchPage(pageRoot),
  "/claims": () => renderClaimsPage(pageRoot),
  "/reports/submit": () => renderReportSubmitPage(pageRoot),
  "/reports/quick": () => renderReportPage(pageRoot, "quick"),
  "/reports/full": () => renderReportPage(pageRoot, "full"),
  "/appeals": () => renderAppealsPage(pageRoot),
  "/history": () => renderHistoryPage(pageRoot),
  "/candidates": () => renderAppPlaceholder(pageRoot, "candidates"),
  "/organizations/saved": () => renderAppPlaceholder(pageRoot, "savedOrganizations"),
  "/notifications": () => renderAppPlaceholder(pageRoot, "notifications"),
  "/review": () => renderReviewQueuePage(pageRoot),
  "/admin": () => renderAdminPage(pageRoot),
  "/owner": () => renderOwnerPage(pageRoot),
  "/owner-bootstrap": () => renderOwnerBootstrapPage(pageRoot),
  "/setup": renderSetupPlaceholder,
  "/password-reset": () => renderPasswordResetPage(pageRoot)
};

const pageTitles = {
  "/": "Home",
  "/about": "About",
  "/features": "Features",
  "/terms": "Terms",
  "/privacy": "Privacy",
  "/login": "Login",
  "/register": "Create Account",
  "/dashboard": "Dashboard",
  "/search": "Run Check",
  "/claims": "Claim Profile",
  "/reports/submit": "Submit Report",
  "/reports/quick": "Quick Report",
  "/reports/full": "Full Report",
  "/appeals": "Appeals",
  "/history": "Check History",
  "/candidates": "Saved Candidates",
  "/organizations/saved": "Saved Organizations",
  "/notifications": "Notifications",
  "/review": "Review Queue",
  "/admin": "Administration",
  "/owner": "Owner",
  "/owner-bootstrap": "Owner Bootstrap",
  "/setup": "Setup",
  "/password-reset": "Password Reset"
};

function getRoute() {
  const hash = window.location.hash.replace("#", "");
  const path = hash.split("?")[0];
  return path || "/";
}

function navigate() {
  const route = getRoute();
  const render = pages[route] || renderNotFound;
  setPageTitle(pageTitles[route] || "Not Found");
  render();
  renderNavigation();
  renderFooter();
  pageRoot?.focus();
}

function renderNavigation() {
  const account = getAccountStore();
  const user = account.record;

  if (!user) {
    topnav.innerHTML = `
      <a href="#/">Home</a>
      <a href="#/features">Features</a>
      <a href="#/about">About</a>
      <a href="#/login">Login</a>
      <a class="button button-dark" href="#/register">Create Account</a>
    `;
    return;
  }

  topnav.innerHTML = `
    <a href="#/">Home</a>
    <a href="#/features">Features</a>
    <a href="#/dashboard">Dashboard</a>
    <a href="#/search">Run Check</a>
    <a href="#/claims">Claims</a>
    <a href="#/appeals">Appeals</a>
    ${isReviewerOrHigher(user) ? `<a href="#/review">Review</a>` : ""}
    ${isAdminOrOwner(user) ? `<a href="#/admin">Manage</a>` : ""}
    ${isOwner(user) ? `<a href="#/owner">Owner</a>` : ""}
    <a href="#/owner-bootstrap">Bootstrap</a>
    <span class="nav-user">${user.displayName} · ${user.role || "user"}</span>
  `;
}

function renderFooter() {
  let footer = document.querySelector(".site-footer");
  if (!footer) {
    footer = document.createElement("footer");
    footer.className = "site-footer";
    document.querySelector("#app")?.appendChild(footer);
  }

  footer.innerHTML = `
    <span>${APP_NAME}</span>
    <a href="#/terms">Terms</a>
    <a href="#/privacy">Privacy</a>
    <a href="#/about">About</a>
  `;
}

function renderSetupPlaceholder() {
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
    if (protectedRoutes.includes(getRoute())) {
      navigate();
    }
  });
});

console.info(`${APP_NAME} loaded with ${ROUTES.length} planned routes.`);
