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

function isolateLegacyMobileNav() {
  if (!document.body.classList.contains("nav20-authenticated")) return;
  nav?.classList.remove("v4-mobile-open");
  const legacyToggle = document.querySelector("#v4-mobile-nav-toggle");
  if (legacyToggle) {
    legacyToggle.setAttribute("aria-expanded", "false");
    legacyToggle.hidden = true;
    legacyToggle.style.setProperty("display", "none", "important");
  }
  document.querySelectorAll(".workspace-nav-shell, .ux-command-backdrop").forEach((node) => node.remove());
}

function syncDrawerState() {
  const open = Boolean(nav?.classList.contains("nav20-mobile-open"));
  document.body.classList.toggle("nav20-drawer-open", open);
  if (!open) isolateLegacyMobileNav();
}

function sync() {
  mountStyles();
  isolateLegacyMobileNav();
  syncDrawerState();
}

function schedule() {
  timers.forEach(clearTimeout);
  timers = [0, 120, 420, 1100, 2200].map((delay) => setTimeout(sync, delay));
}

mountStyles();
schedule();
window.addEventListener("hashchange", schedule);
window.addEventListener("pageshow", schedule);
window.addEventListener("resize", () => {
  if (window.innerWidth > 1180) document.body.classList.remove("nav20-drawer-open");
  schedule();
});
document.addEventListener("click", () => setTimeout(syncDrawerState, 0));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setTimeout(syncDrawerState, 0);
});
