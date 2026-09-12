// Cognitus external portal bridges — Generation 1
// Keeps the public Careers / Talent Gateway visible from the main site and
// adds Staff Command for authenticated Cognitus employees.

import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const CAREERS_URL = "https://careers.cognitus-solutions.org/";
const COMMAND_URL = "https://silly-cheese.github.io/staff-cognitus/";
const ACTIVE_STAFF_STATUSES = new Set(["active", "training", "on_leave"]);

let eligible = false;
let started = false;

function syncTalentGatewayLink() {
  const nav = document.querySelector(".topnav");
  if (!nav) return;

  let link = nav.querySelector("[data-cognitus-careers-link]");
  if (!link) {
    link = document.createElement("a");
    link.href = CAREERS_URL;
    link.dataset.cognitusCareersLink = "g1";
    link.textContent = "Careers";
    link.setAttribute("aria-label", "Open Cognitus Talent Gateway");
  }

  const loginLink = Array.from(nav.querySelectorAll("a")).find((item) => item.getAttribute("href") === "#/login");
  const settingsLink = Array.from(nav.querySelectorAll("a")).find((item) => item.getAttribute("href") === "#/settings");
  const createAccountLink = Array.from(nav.querySelectorAll("a")).find((item) => item.getAttribute("href") === "#/register");
  const anchor = settingsLink || loginLink || createAccountLink;

  if (anchor && link.nextElementSibling !== anchor) nav.insertBefore(link, anchor);
  else if (!anchor && !link.isConnected) nav.appendChild(link);
}

function syncCommandLink() {
  syncTalentGatewayLink();

  const nav = document.querySelector(".topnav");
  if (!nav) return;
  const existing = nav.querySelector("[data-cognitus-command-link]");
  if (!eligible) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const link = document.createElement("a");
  link.href = COMMAND_URL;
  link.target = "_blank";
  link.rel = "noopener";
  link.dataset.cognitusCommandLink = "g1";
  link.textContent = "Staff Command";
  link.setAttribute("aria-label", "Open Cognitus Staff / Command");

  const settingsLink = Array.from(nav.querySelectorAll("a")).find((item) => item.getAttribute("href") === "#/settings");
  if (settingsLink) nav.insertBefore(link, settingsLink);
  else nav.appendChild(link);
}

async function resolveStaffEligibility(user, db, Fire) {
  if (!user) return false;
  try {
    const snapshot = await Fire.getDoc(Fire.doc(db, "staffAccess", user.uid));
    if (!snapshot.exists()) return false;
    const access = snapshot.data();
    return ACTIVE_STAFF_STATUSES.has(access.status)
      && Array.isArray(access.permissions)
      && access.permissions.includes("portal.access");
  } catch (error) {
    if (error?.code !== "permission-denied") console.warn("Staff Command link check failed", error);
    return false;
  }
}

async function start() {
  if (started) return;
  started = true;

  // Careers is public and should be available even if Firebase is unavailable.
  syncTalentGatewayLink();
  const nav = document.querySelector(".topnav");
  if (nav) {
    const observer = new MutationObserver(() => syncCommandLink());
    observer.observe(nav, { childList: true });
  }

  try {
    const services = await initializeFirebaseServices();
    if (!services.ready) return;
    const [Auth, Fire] = await Promise.all([
      import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
      import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
    ]);

    Auth.onAuthStateChanged(services.auth, async (user) => {
      eligible = await resolveStaffEligibility(user, services.db, Fire);
      syncCommandLink();
    });
  } catch (error) {
    console.warn("Cognitus external portal bridge did not initialize", error);
  }
}

start();
