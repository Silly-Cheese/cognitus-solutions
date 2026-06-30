import { APP_NAME, ROUTES } from "./data/constants.js";
import { createCognitusId } from "./utils/cognitusIds.js";
import { setPageTitle } from "./utils/dom.js";
import { startAccountStore, subscribeAccountStore, getAccountStore } from "./state/accountStore.js";
import { isAdminOrOwner, isOwner, isReviewerOrHigher } from "./security/permissions.js";

const pageRoot = document.querySelector("#page-root");
const topnav = document.querySelector(".topnav");

const protectedRoutes = new Set([
  "/login",
  "/register",
  "/dashboard",
  "/admin",
  "/admin/users",
  "/admin/organizations",
  "/admin/audit",
  "/review",
  "/owner",
  "/owner/settings",
  "/owner-bootstrap",
  "/search",
  "/claims",
  "/reports/submit",
  "/reports/quick",
  "/reports/full",
  "/appeals",
  "/history",
  "/candidates",
  "/organizations/saved",
  "/notifications"
]);

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
  "/admin/users": "User Management",
  "/admin/organizations": "Organization Management",
  "/admin/audit": "Activity Logs",
  "/owner": "Owner",
  "/owner/settings": "Portal Settings",
  "/owner-bootstrap": "Owner Bootstrap",
  "/setup": "Setup",
  "/password-reset": "Password Reset"
};

function getRoute() {
  const hash = window.location.hash.replace("#", "");
  const path = hash.split("?")[0];
  return path || "/";
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
  if (route === "/") {
    const mod = await import("./pages/publicPages.js");
    return mod.renderHomePage(pageRoot);
  }

  if (route === "/about") {
    const mod = await import("./pages/publicPages.js");
    return mod.renderAboutPage(pageRoot);
  }

  if (route === "/features") {
    const mod = await import("./pages/publicPages.js");
    return mod.renderFeaturesPage(pageRoot);
  }

  if (route === "/terms") {
    const mod = await import("./pages/publicPages.js");
    return mod.renderTermsPage(pageRoot);
  }

  if (route === "/privacy") {
    const mod = await import("./pages/publicPages.js");
    return mod.renderPrivacyPage(pageRoot);
  }

  if (route === "/login") {
    const mod = await import("./pages/authPages.js");
    return mod.renderLoginPage(pageRoot);
  }

  if (route === "/register") {
    const mod = await import("./pages/authPages.js");
    return mod.renderRegisterPage(pageRoot);
  }

  if (route === "/password-reset") {
    const mod = await import("./pages/passwordResetPage.js");
    return mod.renderPasswordResetPage(pageRoot);
  }

  if (route === "/dashboard") {
    const mod = await import("./pages/dashboardPage.js");
    return mod.renderDashboardPage(pageRoot);
  }

  if (route === "/search") {
    const mod = await import("./pages/searchPage.js");
    return mod.renderSearchPage(pageRoot);
  }

  if (route === "/claims") {
    const mod = await import("./pages/claimsPage.js");
    return mod.renderClaimsPage(pageRoot);
  }

  if (route === "/reports/submit") {
    const mod = await import("./pages/reportSubmitPage.js");
    return mod.renderReportSubmitPage(pageRoot);
  }

  if (route === "/reports/quick") {
    const mod = await import("./pages/reportPage.js");
    return mod.renderReportPage(pageRoot, "quick");
  }

  if (route === "/reports/full") {
    const mod = await import("./pages/reportPage.js");
    return mod.renderReportPage(pageRoot, "full");
  }

  if (route === "/appeals") {
    const mod = await import("./pages/appealsPage.js");
    return mod.renderAppealsPage(pageRoot);
  }

  if (route === "/history") {
    const mod = await import("./pages/historyPage.js");
    return mod.renderHistoryPage(pageRoot);
  }

  if (route === "/review") {
    const mod = await import("./pages/reviewQueuePage.js");
    return mod.renderReviewQueuePage(pageRoot);
  }

  if (route === "/admin") {
    const mod = await import("./pages/adminPage.js");
    return mod.renderAdminPage(pageRoot);
  }

  if (route === "/admin/users") {
    const mod = await import("./pages/userManagementPage.js");
    return mod.renderUserManagementPage(pageRoot);
  }

  if (route === "/admin/organizations") {
    const mod = await import("./pages/organizationManagementPage.js");
    return mod.renderOrganizationManagementPage(pageRoot);
  }

  if (route === "/admin/audit") {
    const mod = await import("./pages/activityLogPage.js");
    return mod.renderActivityLogPage(pageRoot);
  }

  if (route === "/owner") {
    const mod = await import("./pages/adminPage.js");
    return mod.renderOwnerPage(pageRoot);
  }

  if (route === "/owner/settings") {
    const mod = await import("./pages/ownerSettingsPage.js");
    return mod.renderOwnerSettingsPage(pageRoot);
  }

  if (route === "/owner-bootstrap") {
    const mod = await import("./pages/ownerBootstrapPage.js");
    return mod.renderOwnerBootstrapPage(pageRoot);
  }

  if (["/candidates", "/organizations/saved", "/notifications"].includes(route)) {
    const key = route === "/candidates" ? "candidates" : route === "/organizations/saved" ? "savedOrganizations" : "notifications";
    const mod = await import("./pages/appPlaceholderPages.js");
    return mod.renderAppPlaceholder(pageRoot, key);
  }

  if (route === "/setup") {
    return renderSetupPlaceholder();
  }

  return renderNotFound();
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
      <div class="notice">Firebase is configured. Use this page only for quick module checks.</div>
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

function renderRouteError(route, error) {
  pageRoot.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Route Error</p>
      <h1>This page could not load.</h1>
      <p><strong>Route:</strong> ${route}</p>
      <div class="notice">${error?.message || "Unknown error"}</div>
      <div class="hero-actions">
        <a class="button button-dark" href="#/">Home</a>
        <a class="button button-light" href="#/login">Login</a>
      </div>
    </section>
  `;
}

window.addEventListener("hashchange", navigate);
window.addEventListener("DOMContentLoaded", async () => {
  renderNavigation();
  await navigate();

  try {
    await startAccountStore();
    subscribeAccountStore(() => {
      renderNavigation();
      if (protectedRoutes.has(getRoute())) {
        navigate();
      }
    });
  } catch (error) {
    console.error("Cognitus account state failed:", error);
  }
});

console.info(`${APP_NAME} router loaded with ${ROUTES.length} planned routes.`);
