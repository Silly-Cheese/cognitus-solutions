const MOBILE_BREAKPOINT = 1180;
const topbar = document.querySelector(".topbar");
const sourceNav = document.querySelector(".topnav");
let open = false;
let timers = [];

function sourceShell() {
  return sourceNav?.querySelector(":scope > .nav20-shell") || null;
}

function authenticated() {
  return document.body.classList.contains("nav20-authenticated") && Boolean(sourceShell());
}

function ensureStyles() {
  let link = document.querySelector("#cognitus-navigation-v25");
  if (!link) {
    link = document.createElement("link");
    link.id = "cognitus-navigation-v25";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "./src/navigationMobileV25.css?v=20260817-v25-standalone";
}

function ensureToggle() {
  if (!topbar) return null;
  let button = topbar.querySelector("[data-nav25-toggle]");
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.className = "nav25-toggle";
    button.dataset.nav25Toggle = "true";
    button.setAttribute("aria-controls", "cognitus-mobile-v25-panel");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation menu");
    button.innerHTML = '<span class="nav25-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="nav25-toggle-label">Menu</span>';
    const brand = topbar.querySelector(".brand");
    if (brand) brand.insertAdjacentElement("afterend", button);
    else topbar.prepend(button);
  }
  return button;
}

function ensurePanel() {
  let panel = document.querySelector("#cognitus-mobile-v25-panel");
  if (!panel) {
    panel = document.createElement("aside");
    panel.id = "cognitus-mobile-v25-panel";
    panel.className = "nav25-panel";
    panel.setAttribute("aria-label", "Cognitus navigation");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = '<div class="nav25-shell" data-nav25-shell></div>';
    document.body.appendChild(panel);
  }
  return panel;
}

function setOpen(next) {
  const safeOpen = Boolean(next && authenticated() && window.innerWidth <= MOBILE_BREAKPOINT);
  open = safeOpen;
  document.body.classList.toggle("nav25-open", safeOpen);
  document.body.classList.toggle("nav25-scroll-lock", safeOpen);
  sourceNav?.classList.remove("v4-mobile-open", "nav20-mobile-open");
  document.body.classList.remove("nav20-drawer-open");

  const button = topbar?.querySelector("[data-nav25-toggle]");
  if (button) {
    button.classList.toggle("is-open", safeOpen);
    button.setAttribute("aria-expanded", String(safeOpen));
    button.setAttribute("aria-label", safeOpen ? "Close navigation menu" : "Open navigation menu");
    const label = button.querySelector(".nav25-toggle-label");
    if (label) label.textContent = safeOpen ? "Close" : "Menu";
  }

  const panel = document.querySelector("#cognitus-mobile-v25-panel");
  panel?.setAttribute("aria-hidden", String(!safeOpen));
  if (!safeOpen) {
    panel?.querySelectorAll(".nav20-operations.is-open").forEach((node) => node.classList.remove("is-open"));
    panel?.querySelectorAll("[data-nav20-operations]").forEach((node) => node.setAttribute("aria-expanded", "false"));
  }
}

function copyShell() {
  const source = sourceShell();
  const target = document.querySelector("[data-nav25-shell]");
  if (!source || !target) return false;
  const signature = source.dataset.signature || source.textContent || "shell";
  if (target.dataset.signature === signature) return true;
  target.dataset.signature = signature;
  target.replaceChildren(...[...source.children].map((node) => node.cloneNode(true)));
  return true;
}

function protectBrand() {
  const brand = topbar?.querySelector(".brand");
  if (!brand) return;
  brand.style.setProperty("color", "#111", "important");
  brand.querySelector("strong")?.style.setProperty("color", "#111", "important");
  brand.querySelector("small")?.style.setProperty("color", "#686863", "important");
  brand.querySelector(".brand-mark")?.style.setProperty("color", "#fff", "important");
}

function sync() {
  ensureStyles();
  protectBrand();
  const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
  const ready = authenticated();
  document.body.classList.toggle("nav25-mobile-active", Boolean(mobile && ready));

  if (!mobile || !ready) {
    setOpen(false);
    return;
  }

  ensureToggle();
  ensurePanel();
  copyShell();

  // Old mobile controls are compatibility-only. Keep their state closed forever.
  sourceNav?.classList.remove("v4-mobile-open", "nav20-mobile-open");
  document.body.classList.remove("nav20-drawer-open");
  const oldButton = topbar?.querySelector("[data-nav20-mobile-toggle]");
  if (oldButton) {
    oldButton.classList.remove("is-open");
    oldButton.setAttribute("aria-expanded", "false");
    oldButton.setAttribute("aria-hidden", "true");
    oldButton.tabIndex = -1;
  }

  setOpen(open);
}

function scheduleSync() {
  timers.forEach(clearTimeout);
  timers = [0, 120, 420, 1000, 2200].map((delay) => setTimeout(sync, delay));
}

ensureStyles();
scheduleSync();

document.addEventListener("click", (event) => {
  const toggle = event.target.closest?.("[data-nav25-toggle]");
  if (toggle) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(!open);
    return;
  }

  const panel = event.target.closest?.("#cognitus-mobile-v25-panel");
  if (!panel) return;

  const operations = event.target.closest?.("[data-nav20-operations]");
  if (operations) {
    event.preventDefault();
    const wrapper = operations.closest(".nav20-operations");
    const next = !wrapper?.classList.contains("is-open");
    panel.querySelectorAll(".nav20-operations.is-open").forEach((node) => node.classList.remove("is-open"));
    panel.querySelectorAll("[data-nav20-operations]").forEach((node) => node.setAttribute("aria-expanded", "false"));
    wrapper?.classList.toggle("is-open", next);
    operations.setAttribute("aria-expanded", String(next));
    return;
  }

  if (event.target.closest?.("[data-nav20-logout]")) {
    event.preventDefault();
    setOpen(false);
    sourceNav?.querySelector(":scope > #logout-button")?.click();
    return;
  }

  if (event.target.closest?.("a")) setOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setOpen(false);
});

window.addEventListener("hashchange", () => {
  setOpen(false);
  scheduleSync();
});
window.addEventListener("pageshow", () => {
  setOpen(false);
  scheduleSync();
});
window.addEventListener("resize", () => {
  if (window.innerWidth > MOBILE_BREAKPOINT) setOpen(false);
  scheduleSync();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    setOpen(false);
    scheduleSync();
  }
});
