import "./uxV3.js";

const nav = document.querySelector(".topnav");
const root = document.querySelector("#page-root");
let syncing = false;

function isAuthenticatedNav() {
  return Boolean(nav?.querySelector('a[href="#/dashboard"]'));
}

function ensureOrganizationRequestTab() {
  if (!nav || !isAuthenticatedNav() || nav.querySelector("[data-org-request-tab]")) return;

  const link = document.createElement("a");
  link.href = "#/organizations?request=1";
  link.dataset.orgRequestTab = "true";
  link.textContent = "Org Request";
  link.title = "Create or request an organization record";
  link.setAttribute("aria-label", "Create or request an organization record");

  const organizationsLink = nav.querySelector('a[href="#/organizations"]');
  if (organizationsLink) {
    organizationsLink.insertAdjacentElement("afterend", link);
  } else {
    const reviewLink = nav.querySelector('a[href="#/review"]');
    if (reviewLink) reviewLink.insertAdjacentElement("beforebegin", link);
    else nav.appendChild(link);
  }
}

function openOrganizationRequestForm() {
  const hash = window.location.hash;
  if (!hash.startsWith("#/organizations") || !new URLSearchParams(hash.split("?")[1] || "").has("request")) return;

  requestAnimationFrame(() => {
    const panel = document.querySelector("#org-create");
    const toggle = document.querySelector("#new-org-toggle");

    if (panel?.hidden && toggle) toggle.click();

    requestAnimationFrame(() => {
      const form = document.querySelector("#org-form");
      if (!form) return;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      form.querySelector("input[name='name']")?.focus({ preventScroll: true });
    });
  });
}

function syncEnhancements() {
  if (syncing) return;
  syncing = true;
  try {
    ensureOrganizationRequestTab();
    openOrganizationRequestForm();
  } finally {
    syncing = false;
  }
}

const observer = new MutationObserver(syncEnhancements);
if (nav) observer.observe(nav, { childList: true });
if (root) observer.observe(root, { childList: true, subtree: true });

window.addEventListener("hashchange", syncEnhancements);
window.addEventListener("DOMContentLoaded", syncEnhancements);
syncEnhancements();
