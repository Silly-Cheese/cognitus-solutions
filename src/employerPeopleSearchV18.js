import "./foundationCoreV19.js";
import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

let db = null;
let Fire = null;
let ready = false;

const clean = (value) => String(value ?? "").trim();
const lower = (value) => clean(value).toLowerCase();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function humanize(value) {
  return clean(value || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tone(value) {
  const normalized = lower(value);
  if (["good_standing", "low", "verified", "claimed", "account_linked"].includes(normalized)) return "success";
  if (["critical", "restricted", "high"].includes(normalized)) return "danger";
  if (["watch", "moderate", "concern", "pending", "unreviewed"].includes(normalized)) return "warning";
  return "neutral";
}

function badge(value, forcedTone = null) {
  return `<span class="emp11-badge is-${escapeHtml(forcedTone || tone(value))}">${escapeHtml(humanize(value))}</span>`;
}

function identityLine(profile) {
  const discord = (Array.isArray(profile.discordUsernames) ? profile.discordUsernames : [profile.discordUsername]).map(clean).filter(Boolean).join(", ");
  const roblox = (Array.isArray(profile.robloxUsernames) ? profile.robloxUsernames : [profile.robloxUsername]).map(clean).filter(Boolean).join(", ");
  return [discord && `Discord: ${discord}`, roblox && `Roblox: ${roblox}`].filter(Boolean).join(" · ") || "No usernames listed";
}

async function readWhere(field, op, value) {
  if (!ready || value === "" || value == null) return [];
  try {
    const snapshot = await Fire.getDocs(Fire.query(Fire.collection(db, "profiles"), Fire.where(field, op, value)));
    return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.warn(`Employer People Search V18 query failed for ${field}`, error);
    return [];
  }
}

function uniqueProfiles(groups) {
  const byId = new Map();
  for (const profile of groups.flat()) {
    if (profile?.id) byId.set(profile.id, profile);
  }
  return [...byId.values()].sort((a, b) => clean(a.displayName).localeCompare(clean(b.displayName), undefined, { sensitivity: "base" }));
}

async function compatibleProfileSearch(field, rawValue) {
  const value = clean(rawValue);
  if (!value) return [];
  const normalized = lower(value);
  const tasks = [];

  if (field === "discordUsername") {
    tasks.push(
      readWhere("discordUsernamesNormalized", "array-contains", normalized),
      readWhere("discordUsernames", "array-contains", value),
      readWhere("discordUsernames", "array-contains", normalized),
      readWhere("discordUsername", "==", value),
      readWhere("discordUsernameNormalized", "==", normalized)
    );
  } else if (field === "discordId") {
    const discordId = value.replace(/\D/g, "");
    tasks.push(
      readWhere("discordIds", "array-contains", discordId),
      readWhere("discordId", "==", discordId)
    );
  } else if (field === "robloxUsername") {
    tasks.push(
      readWhere("robloxUsernamesNormalized", "array-contains", normalized),
      readWhere("robloxUsernames", "array-contains", value),
      readWhere("robloxUsernames", "array-contains", normalized),
      readWhere("robloxUsername", "==", value),
      readWhere("robloxUsernameNormalized", "==", normalized)
    );
  } else if (field === "displayName") {
    tasks.push(
      readWhere("displayName", "==", value),
      readWhere("displayNameNormalized", "==", normalized)
    );
  } else {
    tasks.push(readWhere("cognitusId", "==", value.toUpperCase()));
  }

  return uniqueProfiles(await Promise.all(tasks));
}

function profileCard(profile) {
  const merged = Boolean(profile.mergedIntoProfileId || lower(profile.identityStatus) === "merged");
  const canonicalId = profile.mergedIntoProfileId || profile.id;
  const linked = Boolean(profile.linkedUserId || profile.claimedByUid || lower(profile.identityStatus) === "claimed");
  const identityLabel = merged ? "Merged Record" : linked ? "Account Linked" : (profile.recordOrigin === "employer_created" ? "Employer Supplied" : (profile.identityStatus || "Unclaimed"));
  return `<article class="emp11-person-card" data-emp18-result="${escapeHtml(profile.id)}">
    <div class="emp11-person-head">
      <div><span>${escapeHtml(profile.cognitusId || profile.id)}</span><h3>${escapeHtml(profile.displayName || "Unnamed Person")}</h3></div>
      ${badge(identityLabel, linked ? "success" : "neutral")}
    </div>
    <p>${escapeHtml(identityLine(profile))}</p>
    <div class="emp11-chip-row">${badge(profile.professionalStanding || "unreviewed")}${badge(profile.riskLevel || "unreviewed")}</div>
    <div class="emp11-actions"><a class="button button-dark" href="#/employer/candidate?profile=${encodeURIComponent(canonicalId)}">Open Candidate File</a><a class="button button-light" href="#/people/master?profile=${encodeURIComponent(canonicalId)}">Master Record</a></div>
  </article>`;
}

function renderResults(target, profiles, field, value) {
  if (!profiles.length) {
    target.innerHTML = `<div class="empty-state"><h3>No matching person found.</h3><p>Cognitus checked both current and compatible profile identity fields for <strong>${escapeHtml(value)}</strong>. If this person truly has never existed in Cognitus, use Create a Person Record.</p></div>`;
    return;
  }
  target.innerHTML = `<div class="emp18-search-summary"><strong>${profiles.length} existing Cognitus profile${profiles.length === 1 ? "" : "s"} found</strong><span>Matched by ${escapeHtml(humanize(field))}</span></div><div class="emp11-person-grid">${profiles.map(profileCard).join("")}</div>`;
}

async function handleEmployerPeopleSearch(event) {
  const form = event.target?.closest?.("[data-emp11-search-form]");
  if (!form || !location.hash.startsWith("#/employer")) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const data = Object.fromEntries(new FormData(form).entries());
  const target = document.querySelector("[data-emp11-search-results]");
  const button = form.querySelector('button[type="submit"]');
  if (!target) return;

  const field = clean(data.field || "cognitusId");
  const value = clean(data.query);
  if (!value) return;

  if (button) {
    button.disabled = true;
    button.textContent = "Searching…";
  }
  target.innerHTML = `<div class="empty-state"><p>Searching all compatible Cognitus identity fields…</p></div>`;

  try {
    const profiles = await compatibleProfileSearch(field, value);
    renderResults(target, profiles, field, value);
  } catch (error) {
    target.innerHTML = `<div class="empty-state"><h3>Search could not be completed.</h3><p>${escapeHtml(error?.message || "Please try again.")}</p></div>`;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Search People";
    }
  }
}

function mountStyles() {
  if (document.querySelector("#cognitus-employer-people-search-v18")) return;
  const style = document.createElement("style");
  style.id = "cognitus-employer-people-search-v18";
  style.textContent = `.emp18-search-summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 1rem;padding:.85rem 1rem;border:1px solid #dcdde3;border-radius:14px;background:#f8f9fc}.emp18-search-summary strong{font-size:.92rem}.emp18-search-summary span{color:#6b7280;font-size:.8rem;font-weight:800}@media(max-width:720px){.emp18-search-summary{align-items:flex-start;flex-direction:column;gap:.25rem}}`;
  document.head.appendChild(style);
}

async function initialize() {
  mountStyles();
  const services = await initializeFirebaseServices();
  if (!services.ready) return;
  db = services.db;
  Fire = await import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`);
  ready = true;
  document.addEventListener("submit", handleEmployerPeopleSearch, true);
}

initialize().catch((error) => console.warn("Employer People Search V18 failed to initialize", error));
