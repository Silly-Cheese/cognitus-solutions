import { APP_NAME, ROUTES } from "./data/constants.js";
import { createCognitusId } from "./utils/cognitusIds.js";
import { setPageTitle } from "./utils/dom.js";
import { startAccountStore, subscribeAccountStore, getAccountStore } from "./state/accountStore.js";
import { isAdminOrOwner, isOwner, isReviewerOrHigher } from "./security/permissions.js";

const APP_BUILD = "stabilized-2026-06-30-01";
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

function loadPage(path) {
  return import(`${path}?v=${APP_BUILD}`);
}

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
    await renderRoute(route);
  } catch (error) {
    console.error("Cognitus route failed:", route, error);
    renderRouteError(route, error);
  }

  pageRoot?.focus();
}

async function renderRoute(route) {
  if (["/", "/about", "/features", "/terms", "/privacy"].includes(route)) {
    const mod = await loadPage("./pages/publicPages.js");
    if (route === "/") return mod.renderHomePage(pageRoot);
    if (route === "/about") return mod.renderAboutPage(pageRoot);
    if (route === "/features") return mod.renderFeaturesPage(pageRoot);
    if (route === "/terms") return mod.renderTermsPage(pageRoot);
    return mod.renderPrivacyPage(pageRoot);
  }

  if (["/login", "/register"].includes(route)) {
    const mod = await loadPage("./pages/authPages.js");
    return route === "/login" ? mod.renderLoginPage(pageRoot) : mod.renderRegisterPage(pageRoot);
  }

  if (route === "/password-reset") return (await loadPage("./pages/passwordResetPage.js")).renderPasswordResetPage(pageRoot);
  if (route === "/dashboard") return (await loadPage("./pages/dashboardPage.js")).renderDashboardPage(pageRoot);
  if (route === "/search") return (await loadPage("./pages/searchPage.js")).renderSearchPage(pageRoot);
  if (route === "/claims") return (await loadPage("./pages/claimsPage.js")).renderClaimsPage(pageRoot);
  if (route === "/reports/submit") return (await loadPage("./pages/reportSubmitPage.js")).renderReportSubmitPage(pageRoot);
  if (route === "/reports/quick") return (await loadPage("./pages/reportPage.js")).renderReportPage(pageRoot, "quick");
  if (route === "/reports/full") return (await loadPage("./pages/reportPage.js")).renderReportPage(pageRoot, "full");
  if (route === "/appeals") return (await loadPage("./pages/appealsPage.js")).renderAppealsPage(pageRoot);
  if (route === "/history") return (await loadPage("./pages/historyPage.js")).renderHistoryPage(pageRoot);
  if (route === "/review") return (await loadPage("./pages/reviewQueuePage.js")).renderReviewQueuePage(pageRoot);
  if (route === "/admin") return (await loadPage("./pages/adminPage.js")).renderAdminPage(pageRoot);
  if (route === "/admin/users") return (await loadPage("./pages/userManagementPage.js")).renderUserManagementPage(pageRoot);
  if (route === "/admin/organizations") return (await loadPage("./pages/organizationManagementPage.js")).renderOrganizationManagementPage(pageRoot);
  if (route === "/admin/audit") return (await loadPage("./pages/activityLogPage.js")).renderActivityLogPage(pageRoot);
  if (route === "/owner") return (await loadPage("./pages/adminPage.js")).renderOwnerPage(pageRoot);
  if (route === "/owner/settings") return (await loadPage("./pages/ownerSettingsPage.js")).renderOwnerSettingsPage(pageRoot);
  if (route === "/owner-bootstrap") return (await loadPage("./pages/ownerBootstrapPage.js")).renderOwnerBootstrapPage(pageRoot);

  if (["/candidates", "/organizations/saved", "/notifications"].includes(route)) {
    const key = route === "/candidates" ? "candidates" : route === "/organizations/saved" ? "savedOrganizations" : "notifications";
    return (await loadPage("./pages/appPlaceholderPages.js")).renderAppPlaceholder(pageRoot, key);
  }

  if (route === "/setup") return renderSetupPlaceholder();
  return renderNotFound();
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
