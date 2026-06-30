import { APP_NAME, ROUTES } from "./data/constants.js";
import { createCognitusId } from "./utils/cognitusIds.js";
import { setPageTitle } from "./utils/dom.js";
import { startAccountStore, subscribeAccountStore, getAccountStore } from "./state/accountStore.js";
import { isAdminOrOwner, isOwner, isReviewerOrHigher } from "./security/permissions.js";
import { renderHomePage, renderAboutPage, renderFeaturesPage, renderTermsPage, renderPrivacyPage } from "./pages/publicPages.js";
import { renderLoginPage, renderRegisterPage } from "./pages/authPages.js";
import { renderPasswordResetPage } from "./pages/passwordResetPage.js";
import { renderDashboardPage } from "./pages/dashboardPage.js";
import { renderSearchPage } from "./pages/searchPage.js";
import { renderClaimsPage } from "./pages/claimsPage.js";
import { renderReportSubmitPage } from "./pages/reportSubmitPage.js";
import { renderReportPage } from "./pages/reportPage.js";
import { renderAppealsPage } from "./pages/appealsPage.js";
import { renderHistoryPage } from "./pages/historyPage.js";
import { renderReviewQueuePage } from "./pages/reviewQueuePage.js";
import { renderAdminPage, renderOwnerPage } from "./pages/adminPage.js";
import { renderUserManagementPage } from "./pages/userManagementPage.js";
import { renderOrganizationManagementPage } from "./pages/organizationManagementPage.js";
import { renderActivityLogPage } from "./pages/activityLogPage.js";
import { renderOwnerSettingsPage } from "./pages/ownerSettingsPage.js";
import { renderOwnerBootstrapPage } from "./pages/ownerBootstrapPage.js";
import { renderAppPlaceholder } from "./pages/appPlaceholderPages.js";

const APP_BUILD = "direct-router-2026-06-30-02";
const pageRoot = document.querySelector("#page-root");
const topnav = document.querySelector(".topnav");

const protectedRoutes = new Set([
  "/login", "/register", "/dashboard", "/admin", "/admin/users", "/admin/organizations", "/admin/audit",
  "/review", "/owner", "/owner/settings", "/owner-bootstrap", "/search", "/claims", "/reports/submit",
  "/reports/quick", "/reports/full", "/appeals", "/history", "/candidates", "/organizations/saved", "/notifications"
]);

const pageTitles = {
  "/": "Home", "/about": "About", "/features": "Features", "/terms": "Terms", "/privacy": "Privacy",
  "/login": "Login", "/register": "Create Account", "/dashboard": "Dashboard", "/search": "Run Check",
  "/claims": "Claim Profile", "/reports/submit": "Submit Report", "/reports/quick": "Quick Report", "/reports/full": "Full Report",
  "/appeals": "Appeals", "/history": "Check History", "/candidates": "Saved Candidates", "/organizations/saved": "Saved Organizations",
  "/notifications": "Notifications", "/review": "Review Queue", "/admin": "Administration", "/admin/users": "User Management",
  "/admin/organizations": "Organization Management", "/admin/audit": "Activity Logs", "/owner": "Owner", "/owner/settings": "Portal Settings",
  "/owner-bootstrap": "Owner Bootstrap", "/setup": "Setup", "/password-reset": "Password Reset"
};

const routes = {
  "/": () => renderHomePage(pageRoot),
  "/about": () => renderAboutPage(pageRoot),
  "/features": () => renderFeaturesPage(pageRoot),
  "/terms": () => renderTermsPage(pageRoot),
  "/privacy": () => renderPrivacyPage(pageRoot),
  "/login": () => renderLoginPage(pageRoot),
  "/register": () => renderRegisterPage(pageRoot),
  "/password-reset": () => renderPasswordResetPage(pageRoot),
  "/dashboard": () => renderDashboardPage(pageRoot),
  "/search": () => renderSearchPage(pageRoot),
  "/claims": () => renderClaimsPage(pageRoot),
  "/reports/submit": () => renderReportSubmitPage(pageRoot),
  "/reports/quick": () => renderReportPage(pageRoot, "quick"),
  "/reports/full": () => renderReportPage(pageRoot, "full"),
  "/appeals": () => renderAppealsPage(pageRoot),
  "/history": () => renderHistoryPage(pageRoot),
  "/review": () => renderReviewQueuePage(pageRoot),
  "/admin": () => renderAdminPage(pageRoot),
  "/admin/users": () => renderUserManagementPage(pageRoot),
  "/admin/organizations": () => renderOrganizationManagementPage(pageRoot),
  "/admin/audit": () => renderActivityLogPage(pageRoot),
  "/owner": () => renderOwnerPage(pageRoot),
  "/owner/settings": () => renderOwnerSettingsPage(pageRoot),
  "/owner-bootstrap": () => renderOwnerBootstrapPage(pageRoot),
  "/candidates": () => renderAppPlaceholder(pageRoot, "candidates"),
  "/organizations/saved": () => renderAppPlaceholder(pageRoot, "savedOrganizations"),
  "/notifications": () => renderAppPlaceholder(pageRoot, "notifications"),
  "/setup": () => renderSetupPlaceholder()
};

function getRoute() {
  const hash = window.location.hash.replace("#", "");
  return hash.split("?")[0] || "/";
}

async function navigate() {
  const route = getRoute();
  setPageTitle(pageTitles[route] || "Not Found");
  renderNavigation();
  renderFooter();

  try {
    const renderer = routes[route] || renderNotFound;
    await renderer();
  } catch (error) {
    console.error("Cognitus route failed:", route, error);
    renderRouteError(route, error);
  }

  pageRoot?.focus();
}

function renderNavigation() {
  const user = getAccountStore().record;
  if (!user) {
    topnav.innerHTML = `<a href="#/">Home</a><a href="#/features">Features</a><a href="#/about">About</a><a href="#/login">Login</a><a class="button button-dark" href="#/register">Create Account</a>`;
    return;
  }

  topnav.innerHTML = `
    <a href="#/">Home</a><a href="#/features">Features</a><a href="#/dashboard">Dashboard</a><a href="#/search">Run Check</a>
    <a href="#/claims">Claims</a><a href="#/appeals">Appeals</a>${isReviewerOrHigher(user) ? `<a href="#/review">Review</a>` : ""}
    ${isAdminOrOwner(user) ? `<a href="#/admin">Manage</a>` : ""}${isOwner(user) ? `<a href="#/owner">Owner</a>` : ""}
    <a href="#/owner-bootstrap">Bootstrap</a><span class="nav-user">${user.displayName} · ${user.role || "user"}</span>`;
}

function renderFooter() {
  let footer = document.querySelector(".site-footer");
  if (!footer) {
    footer = document.createElement("footer");
    footer.className = "site-footer";
    document.querySelector("#app")?.appendChild(footer);
  }
  footer.innerHTML = `<span>${APP_NAME}</span><a href="#/terms">Terms</a><a href="#/privacy">Privacy</a><a href="#/about">About</a>`;
}

function renderSetupPlaceholder() {
  const sampleId = createCognitusId("USR");
  pageRoot.innerHTML = `<section class="hero"><p class="eyebrow">Setup</p><h1>Foundation ready.</h1><p>Example generated Cognitus ID: <strong>${sampleId}</strong></p><div class="notice">Build: ${APP_BUILD}</div></section>`;
}

function renderNotFound() {
  pageRoot.innerHTML = `<section class="hero"><p class="eyebrow">404</p><h1>Page not found.</h1><p>The route <strong>${getRoute()}</strong> does not exist yet.</p><div class="hero-actions"><a class="button button-dark" href="#/">Return Home</a></div></section>`;
}

function renderRouteError(route, error) {
  pageRoot.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">Route Error</p><h1>This page could not load.</h1><p><strong>Route:</strong> ${route}</p><div class="notice">${error?.message || "Unknown error"}</div><div class="hero-actions"><a class="button button-dark" href="#/">Home</a><a class="button button-light" href="#/login">Login</a></div></section>`;
}

window.addEventListener("hashchange", navigate);
window.addEventListener("DOMContentLoaded", async () => {
  renderNavigation();
  await navigate();
  try {
    await startAccountStore();
    subscribeAccountStore(() => {
      renderNavigation();
      if (protectedRoutes.has(getRoute())) navigate();
    });
  } catch (error) {
    console.error("Cognitus account state failed:", error);
  }
});

console.info(`${APP_NAME} router loaded with ${ROUTES.length} planned routes. Build ${APP_BUILD}`);
