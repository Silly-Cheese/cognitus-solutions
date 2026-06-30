import { APP_NAME } from "./data/constants.js";
import { setPageTitle } from "./utils/dom.js";
import { startAccountStore, subscribeAccountStore, getAccountStore } from "./state/accountStore.js";
import { isAdminOrOwner, isOwner, isReviewerOrHigher } from "./security/permissions.js";
import { renderHomePage, renderAboutPage, renderFeaturesPage, renderTermsPage, renderPrivacyPage } from "./pages/publicPages.js";
import { renderLoginPage, renderRegisterPage } from "./pages/authPages.js";
import { renderPasswordResetPage } from "./pages/passwordResetPage.js";
import { renderDashboardSafePage } from "./pages/dashboardSafePage.js";
import { renderOwnerBootstrapPage } from "./pages/ownerBootstrapPage.js";
import { renderAppPlaceholder } from "./pages/appPlaceholderPages.js";

const root = document.querySelector("#page-root");
const nav = document.querySelector(".topnav");

const titles = {
  "/": "Home",
  "/about": "About",
  "/features": "Features",
  "/terms": "Terms",
  "/privacy": "Privacy",
  "/login": "Login",
  "/register": "Create Account",
  "/password-reset": "Password Reset",
  "/dashboard": "Dashboard",
  "/owner-bootstrap": "Owner Bootstrap",
  "/search": "Run Check",
  "/claims": "Claims",
  "/appeals": "Appeals",
  "/reports/submit": "Submit Report",
  "/history": "History",
  "/admin": "Admin",
  "/owner": "Owner"
};

function route() {
  const hash = window.location.hash.replace("#", "");
  return hash.split("?")[0] || "/";
}

async function render() {
  const current = route();
  setPageTitle(titles[current] || "Cognitus");
  renderNav();
  renderFooter();

  try {
    if (current === "/") return renderHomePage(root);
    if (current === "/about") return renderAboutPage(root);
    if (current === "/features") return renderFeaturesPage(root);
    if (current === "/terms") return renderTermsPage(root);
    if (current === "/privacy") return renderPrivacyPage(root);
    if (current === "/login") return renderLoginPage(root);
    if (current === "/register") return renderRegisterPage(root);
    if (current === "/password-reset") return renderPasswordResetPage(root);
    if (current === "/dashboard") return renderDashboardSafePage(root);
    if (current === "/owner-bootstrap") return renderOwnerBootstrapPage(root);

    if (current === "/search") return renderAppPlaceholder(root, "search");
    if (current === "/claims") return renderAppPlaceholder(root, "claims");
    if (current === "/appeals") return renderAppPlaceholder(root, "appeals");
    if (current === "/reports/submit") return renderAppPlaceholder(root, "submitReport");
    if (current === "/history") return renderAppPlaceholder(root, "history");
    if (current === "/admin") return renderAppPlaceholder(root, "notifications");
    if (current === "/owner") return renderAppPlaceholder(root, "notifications");
    if (current === "/review") return renderAppPlaceholder(root, "notifications");
    if (current === "/candidates") return renderAppPlaceholder(root, "candidates");
    if (current === "/organizations/saved") return renderAppPlaceholder(root, "savedOrganizations");
    if (current === "/notifications") return renderAppPlaceholder(root, "notifications");

    root.innerHTML = `<section class="hero"><p class="eyebrow">404</p><h1>Page not found.</h1><div class="hero-actions"><a class="button button-dark" href="#/dashboard">Dashboard</a></div></section>`;
  } catch (error) {
    root.innerHTML = `<section class="hero"><p class="eyebrow">Error</p><h1>This page could not load.</h1><div class="notice">${error?.message || "Unknown error"}</div><div class="hero-actions"><a class="button button-dark" href="#/dashboard">Dashboard</a></div></section>`;
  }
}

function renderNav() {
  const user = getAccountStore().record;
  if (!user) {
    nav.innerHTML = `<a href="#/">Home</a><a href="#/features">Features</a><a href="#/about">About</a><a href="#/login">Login</a><a class="button button-dark" href="#/register">Create Account</a>`;
    return;
  }

  nav.innerHTML = `
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
  footer.innerHTML = `<span>${APP_NAME}</span><a href="#/terms">Terms</a><a href="#/privacy">Privacy</a><a href="#/about">About</a>`;
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", async () => {
  await render();
  await startAccountStore();
  subscribeAccountStore(render);
});

console.info("Cognitus safe router loaded.");
