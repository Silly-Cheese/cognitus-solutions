const DISCORD_INVITE_URL = "https://discord.gg/VYZShtXfKp";
const LINK_CLASS = "cognitus-discord-nav";

const discordIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M19.7 5.3A18.1 18.1 0 0 0 15.2 4l-.6 1.2a16 16 0 0 0-5.2 0L8.8 4a18.2 18.2 0 0 0-4.5 1.3C1.5 9.4.7 13.4 1.1 17.4a18.5 18.5 0 0 0 5.5 2.8L8 18.4a11.7 11.7 0 0 1-2.1-1l.5-.4a13 13 0 0 0 11.2 0l.5.4a12 12 0 0 1-2.1 1l1.4 1.8a18.4 18.4 0 0 0 5.5-2.8c.5-4.6-.8-8.5-3.2-12.1ZM8.6 15.2c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm6.8 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/>
  </svg>`;

function createLink(className, withText = false) {
  const link = document.createElement("a");
  link.className = `${LINK_CLASS} ${className}`;
  link.href = DISCORD_INVITE_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = "Join the Cognitus Discord";
  link.setAttribute("aria-label", "Join the Cognitus Discord (opens in a new tab)");
  link.innerHTML = `${discordIcon}${withText ? "<span>Join the Server!</span>" : ""}`;
  return link;
}

function mountStyles() {
  if (document.querySelector("#cognitus-discord-navigation-v46")) return;
  const style = document.createElement("style");
  style.id = "cognitus-discord-navigation-v46";
  style.textContent = `
    .${LINK_CLASS} { color: inherit; text-decoration: none; }
    .${LINK_CLASS} svg { width: 20px; height: 20px; display: block; fill: currentColor; }
    .topnav > .${LINK_CLASS}.discord-nav-public {
      display: inline-flex; align-items: center; gap: .5rem; width: auto; height: 42px; padding: 0 .8rem;
      border: 1px solid #d5dbe4; border-radius: 12px; background: #fff; color: #5865f2;
    }
    .topnav > .${LINK_CLASS}.discord-nav-public span { white-space: nowrap; font-size: .8rem; font-weight: 850; }
    .topnav > .${LINK_CLASS}.discord-nav-public:hover { background: #eef0ff; border-color: #aeb5fa; color: #4752c4; }
    .nav20-shell .${LINK_CLASS}.discord-nav-desktop { width: auto; padding: 0 .65rem; gap: .45rem; color: #5865f2 !important; }
    .nav20-shell .${LINK_CLASS}.discord-nav-desktop span { white-space: nowrap; font-size: .72rem; font-weight: 850; }
    .nav20-shell .${LINK_CLASS}.discord-nav-desktop:hover { background: #eef0ff !important; color: #4752c4 !important; }
    .nav25-utilities .${LINK_CLASS}.discord-nav-mobile {
      display: flex; align-items: center; gap: .65rem; color: #4752c4 !important;
    }
    .nav25-utilities .${LINK_CLASS}.discord-nav-mobile svg { width: 18px; height: 18px; }
    @media (max-width: 1180px) {
      body.nav25-ready .topnav > .${LINK_CLASS}.discord-nav-public { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function syncPublicNavigation() {
  const nav = document.querySelector(".topnav");
  if (!nav) return;
  if (nav.querySelector(":scope > .nav20-shell")) {
    nav.querySelector(`:scope > .${LINK_CLASS}.discord-nav-public`)?.remove();
    return;
  }
  if (nav.querySelector(`:scope > .${LINK_CLASS}.discord-nav-public`)) return;
  const link = createLink("discord-nav-public", true);
  const register = nav.querySelector(':scope > a[href="#/register"]');
  if (register) nav.insertBefore(link, register);
  else nav.appendChild(link);
}

function syncDesktopNavigation() {
  const shell = document.querySelector(".nav20-shell");
  if (!shell || shell.querySelector(`.${LINK_CLASS}.discord-nav-desktop`)) return;
  const link = createLink("nav20-icon-button discord-nav-desktop", true);
  const settings = shell.querySelector("[data-nav20-settings]");
  if (settings) shell.insertBefore(link, settings);
  else shell.appendChild(link);
}

function syncMobileNavigation() {
  const utilities = document.querySelector("#cognitus-mobile-nav25 .nav25-utilities");
  if (!utilities || utilities.querySelector(`.${LINK_CLASS}.discord-nav-mobile`)) return;
  utilities.prepend(createLink("nav25-utility discord-nav-mobile", true));
}

let queued = false;
function sync() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    mountStyles();
    syncPublicNavigation();
    syncDesktopNavigation();
    syncMobileNavigation();
  });
}

const observer = new MutationObserver(sync);
observer.observe(document.documentElement, { childList: true, subtree: true });

sync();
window.addEventListener("hashchange", sync);
window.addEventListener("pageshow", sync);
document.addEventListener("DOMContentLoaded", sync);
document.addEventListener("cognitus:promo-rendered", sync);
