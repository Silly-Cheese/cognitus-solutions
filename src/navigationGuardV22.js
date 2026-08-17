const nav = document.querySelector(".topnav");
const topbar = document.querySelector(".topbar");
let timers = [];

function mountStyles() {
  if (document.querySelector("#cognitus-navigation-v22")) return;
  const link = document.createElement("link");
  link.id = "cognitus-navigation-v22";
  link.rel = "stylesheet";
  link.href = "./src/navigationV22.css?v=20260816-1";
  document.head.appendChild(link);
}

function authenticatedSource() {
  if (!nav) return false;
  return [...nav.children].some((node) => node.matches?.('a[href="#/dashboard"]'));
}

function syncCompatibilityState() {
  if (!nav) return;
  const authenticated = document.body.classList.contains("nav20-authenticated") || authenticatedSource();
  if (!authenticated) {
    document.body.classList.remove("nav20-drawer-open");
    nav.classList.remove("v4-mobile-open");
    return;
  }

  // V4/V12 remain loaded for compatibility, but their mobile-open state must
  // never coexist with the V20/V22 visible shell.
  nav.classList.remove("v4-mobile-open");
  const oldToggle = document.querySelector("#v4-mobile-nav-toggle");
  oldToggle?.setAttribute("aria-expanded", "false");

  document.body.classList.toggle("nav20-drawer-open", nav.classList.contains("nav20-mobile-open"));
}

function scheduleSync() {
  timers.forEach(clearTimeout);
  timers = [0, 80, 320, 1100].map((delay) => setTimeout(syncCompatibilityState, delay));
}

mountStyles();
scheduleSync();

topbar?.addEventListener("click", () => setTimeout(syncCompatibilityState, 0));
document.addEventListener("click", () => setTimeout(syncCompatibilityState, 0));
window.addEventListener("hashchange", scheduleSync);
window.addEventListener("pageshow", scheduleSync);
window.addEventListener("resize", () => setTimeout(syncCompatibilityState, 0));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) scheduleSync();
});
