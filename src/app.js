import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

const root = document.querySelector("#page-root");
const nav = document.querySelector(".topnav");
const BUILD = "secure-v2-no-composite-indexes-2026-08-12";

let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let userRecord = null;
let profileRecord = null;
let authReady = false;

const CHECK_REASONS = Object.freeze([
  "Hiring Review",
  "Promotion Review",
  "Partnership Review",
  "Internal Investigation",
  "Safety Concern",
  "Appeal/Correction Review",
  "Other"
]);
const REPORT_CATEGORIES = Object.freeze([
  "Misconduct",
  "Abuse of Power",
  "Fraud/Scamming",
  "Harassment",
  "Impersonation",
  "Leaking Information",
  "Unprofessional Conduct",
  "False Report",
  "Organization Concern",
  "Positive Recognition",
  "Employment Verification",
  "Other"
]);
const SEVERITIES = Object.freeze(["Informational", "Low", "Moderate", "High", "Critical"]);
const ROLES = Object.freeze(["user", "verified_employer_member", "org_admin", "reviewer", "admin", "owner"]);
const STATUSES = Object.freeze(["active", "pending_verification", "suspended", "restricted", "banned", "password_reset_required"]);

function clean(value) { return String(value ?? "").trim(); }
function lower(value) { return clean(value).toLowerCase(); }
function normalizeDiscordId(value) {
  const id = clean(value).replace(/\D/g, "");
  return /^\d{15,25}$/.test(id) ? id : "";
}
function authEmail(discordId) { return `${normalizeDiscordId(discordId)}@cognitus.local`; }
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function safe(value) { return escapeHtml(value); }
function route() { return location.hash.replace(/^#/, "").split("?")[0] || "/"; }
function params() { return new URLSearchParams(location.hash.split("?")[1] || ""); }
function setTitle(title) { document.title = `${title} · Cognitus Solutions`; }
function nowYear() { return new Date().getFullYear(); }
function createCognitusId(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(7);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
  return `${prefix}-${String(nowYear()).slice(-2)}-${random}`;
}
function timestampMs(value) {
  try {
    const date = value?.toDate?.() || (value ? new Date(value) : null);
    return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  } catch { return 0; }
}
function formatTimestamp(value) {
  const ms = timestampMs(value);
  return ms ? new Date(ms).toLocaleString() : "—";
}
function newestFirst(items, limit = Infinity) {
  return [...items].sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)).slice(0, limit);
}
function alphabetic(items, field) {
  return [...items].sort((a, b) => clean(a?.[field]).localeCompare(clean(b?.[field]), undefined, { sensitivity: "base" }));
}
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
function setBusy(button, busy, busyText, normalText) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? busyText : normalText;
}
function showNotice(element, message, tone = "neutral") {
  if (!element) return;
  element.hidden = false;
  element.className = `notice notice-${tone}`;
  element.textContent = message;
}
function buttonLink(href, label, primary = false) {
  return `<a class="button ${primary ? "button-dark" : "button-light"}" href="${safe(href)}">${safe(label)}</a>`;
}
function hero(eyebrow, title, body, actions = "") {
  root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">${safe(eyebrow)}</p><h1>${safe(title)}</h1><p>${safe(body)}</p><div class="hero-actions">${actions}</div></section>`;
}
function loginRequired() {
  if (authUser && userRecord) return false;
  hero("Login Required", "Sign in to continue.", "Cognitus protects operational records behind authenticated access.", buttonLink("#/login", "Login", true) + buttonLink("#/register", "Create Account"));
  return true;
}
function activeUser() { return userRecord?.status === "active"; }
function roleAtLeast(role) {
  const levels = { user: 10, verified_employer_member: 20, org_admin: 30, reviewer: 50, admin: 80, owner: 100 };
  return activeUser() && (levels[userRecord?.role] || 0) >= (levels[role] || 999);
}
function reviewer() { return roleAtLeast("reviewer"); }
function admin() { return roleAtLeast("admin"); }
function owner() { return activeUser() && userRecord?.role === "owner"; }
function ensureActive() {
  if (!loginRequired() && !activeUser()) {
    hero("Account Restricted", "This account cannot perform operational actions.", `Current status: ${userRecord?.status || "unknown"}. Contact a Cognitus administrator for assistance.`, buttonLink("#/dashboard", "Dashboard", true));
    return false;
  }
  return Boolean(userRecord && activeUser());
}

async function loadFirebase() {
  if (Auth && Fire) return;
  const services = await initializeFirebaseServices();
  if (!services.ready) throw new Error("Firebase is not configured.");
  auth = services.auth;
  db = services.db;
  [Auth, Fire] = await Promise.all([
    import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
  ]);
}
async function readDoc(collectionName, id) {
  if (!id) return null;
  const snapshot = await Fire.getDoc(Fire.doc(db, collectionName, id));
  return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
}
async function readQuery(collectionName, constraints = []) {
  const snapshot = await Fire.getDocs(Fire.query(Fire.collection(db, collectionName), ...constraints));
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function refreshAccount() {
  userRecord = authUser ? await readDoc("users", authUser.uid) : null;
  profileRecord = authUser ? await readDoc("profiles", authUser.uid) : null;
  if (authUser && userRecord && !profileRecord) await createOwnProfileIfMissing();
  if (authUser && userRecord) await backfillSafeProfileSearchFields();
}
async function createOwnProfileIfMissing() {
  const now = Fire.serverTimestamp();
  const profile = {
    id: authUser.uid,
    cognitusId: createCognitusId("PRF"),
    linkedUserId: authUser.uid,
    type: "person",
    displayName: userRecord.displayName || userRecord.discordUsername || "User",
    robloxUsernames: [],
    robloxUsernamesNormalized: [],
    discordUsernames: [userRecord.discordUsername].filter(Boolean),
    discordUsernamesNormalized: [lower(userRecord.discordUsername)].filter(Boolean),
    discordIds: [userRecord.discordId].filter(Boolean),
    knownAliases: [],
    claimedByUid: authUser.uid,
    identityStatus: "self_declared",
    identityConfidence: 0,
    professionalStanding: "unreviewed",
    riskLevel: "unreviewed",
    reportCount: 0,
    appealCount: 0,
    createdAt: now,
    updatedAt: now
  };
  await Fire.setDoc(Fire.doc(db, "profiles", authUser.uid), profile);
  profileRecord = { ...profile, id: authUser.uid };
}
async function backfillSafeProfileSearchFields() {
  if (!profileRecord || !authUser) return;
  const robloxNormalized = (profileRecord.robloxUsernames || []).map(lower).filter(Boolean);
  if (!Array.isArray(profileRecord.robloxUsernamesNormalized)) {
    await Fire.updateDoc(Fire.doc(db, "profiles", authUser.uid), {
      robloxUsernamesNormalized: robloxNormalized,
      updatedAt: Fire.serverTimestamp()
    });
    profileRecord = { ...profileRecord, robloxUsernamesNormalized: robloxNormalized };
  }
}
async function writeActivity(action, targetType, targetId, summary, metadata = {}) {
  if (!authUser || !userRecord || !activeUser()) return;
  const ref = Fire.doc(Fire.collection(db, "auditLogs"));
  try {
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createCognitusId("AUD"),
      actorUid: authUser.uid,
      actorCognitusId: userRecord.cognitusId,
      actorRole: userRecord.role,
      action,
      targetType,
      targetId: targetId || null,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.warn("Activity logging failed", error);
  }
}

function renderNav() {
  if (!authUser || !userRecord) {
    nav.innerHTML = `<a href="#/">Home</a><a href="#/features">Features</a><a href="#/about">About</a><a href="#/login">Login</a><a class="button button-dark" href="#/register">Create Account</a>`;
    return;
  }
  nav.innerHTML = `
    <a href="#/dashboard">Dashboard</a>
    <a href="#/search">Run Check</a>
    <a href="#/history">History</a>
    <a href="#/reports/submit">Submit Report</a>
    <a href="#/claims">Claims</a>
    <a href="#/appeals">Appeals</a>
    <a href="#/organizations">Organizations</a>
    ${reviewer() ? `<a href="#/review">Review</a>` : ""}
    ${admin() ? `<a href="#/admin">Admin</a>` : ""}
    <a href="#/settings">Settings</a>
    <button id="logout-button" class="button button-light" type="button">Logout</button>
    <span class="nav-user">${safe(userRecord.displayName || "User")} · ${safe(userRecord.role || "user")}</span>`;
  document.querySelector("#logout-button")?.addEventListener("click", async () => {
    await Auth.signOut(auth);
    location.hash = "#/login";
  });
}
function renderFooter() {
  let footer = document.querySelector(".site-footer");
  if (!footer) {
    footer = document.createElement("footer");
    footer.className = "site-footer";
    document.querySelector("#app")?.appendChild(footer);
  }
  footer.innerHTML = `<span>© ${nowYear()} Cognitus Solutions</span><a href="#/terms">Terms</a><a href="#/privacy">Privacy</a><a href="#/about">About</a><span class="build">${safe(BUILD)}</span>`;
}

function homePage() {
  setTitle("Home");
  root.innerHTML = `
    <section class="hero hero-home">
      <div><p class="eyebrow">Employment intelligence, rebuilt</p><h1>Better records. Better decisions.</h1><p>Cognitus gives Roblox and Discord communities a structured place to run accountable checks, review submitted information, document decisions, and manage corrections.</p><div class="hero-actions">${userRecord ? buttonLink("#/dashboard", "Open Dashboard", true) + buttonLink("#/search", "Run a Check") : buttonLink("#/register", "Create Account", true) + buttonLink("#/login", "Login")}</div></div>
      <aside class="trust-card"><span class="trust-icon">CS</span><h2>Designed for accountability</h2><p>Every operational check requires a reason. Reviewed records are separated from self-declared identity information, and privileged actions are enforced by Firestore rules—not only by the interface.</p></aside>
    </section>
    <section class="feature-grid">
      <article class="feature-card"><span>01</span><h3>Logged Screening</h3><p>Run person and organization checks with a documented purpose and permanent check reference.</p></article>
      <article class="feature-card"><span>02</span><h3>Reviewed Records</h3><p>Submitted reports stay private until authorized reviewers make a decision and choose their screening visibility.</p></article>
      <article class="feature-card"><span>03</span><h3>Corrections</h3><p>Claims and appeals are tied to real Cognitus records and reviewed through controlled workflows.</p></article>
    </section>`;
}
function featuresPage() {
  setTitle("Features");
  const cards = [
    ["Search & Checks", "Search Discord IDs, self-declared usernames, Roblox usernames, and organizations. Checks require a reason."],
    ["Screening Reports", "Generate quick or full views from a logged check and reviewed records that are permitted for screening."],
    ["Review Queue", "Reviewers can approve or deny reports, claims, and appeals without rewriting original submissions."],
    ["Administration", "Admins manage user status, non-owner roles, organization verification, and organization membership."],
    ["Owner Controls", "Only Owners may grant or remove the Owner role. There is no public client-side owner bootstrap."],
    ["Simple Firestore", "The production portal uses automatic Firestore indexing only. No manually maintained composite indexes are required."]
  ];
  root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">Platform</p><h1>One operational portal.</h1><p>Account access, logged checks, searchable profiles, organization records, screening reports, claims, appeals, reviewer queues, administration, and account settings are handled by one production application.</p></section><section class="feature-grid">${cards.map(([t,p],i)=>`<article class="feature-card"><span>${String(i+1).padStart(2,"0")}</span><h3>${safe(t)}</h3><p>${safe(p)}</p></article>`).join("")}</section>`;
}
function aboutPage() {
  setTitle("About");
  hero("About Cognitus", "Employment intelligence with context.", "Cognitus Solutions is built for Roblox and Discord communities that need better records and more accountable staffing decisions. A Cognitus result should be one factor in a decision—not a substitute for independent review.");
}
function termsPage() {
  setTitle("Terms");
  root.innerHTML = `<section class="legal-card"><p class="eyebrow">Terms</p><h1>Responsible use is required.</h1><p>Use Cognitus only for legitimate staffing, safety, partnership, internal review, appeal, or correction purposes. Do not use the platform for harassment, stalking, doxxing, retaliation, discrimination, or knowingly false reporting.</p><p>Self-declared identity fields are not proof of Discord or Roblox ownership. Reviewed records may still contain errors and must be evaluated in context.</p><p>Submitting false, malicious, or deceptive information may result in account restriction or removal.</p></section>`;
}
function privacyPage() {
  setTitle("Privacy");
  root.innerHTML = `<section class="legal-card"><p class="eyebrow">Privacy</p><h1>Collect less. Protect more.</h1><p>Cognitus uses a Discord ID to create an internal Firebase Authentication login address. It does not require a real email address. Records may include self-declared usernames, check history, submitted reports, appeals, claims, organization membership, and administrative activity.</p><p>Access to non-public records is controlled by authentication, account status, role, organization membership, record ownership, and Firestore Security Rules.</p></section>`;
}

function loginPage() {
  setTitle("Login");
  if (userRecord) return hero("Already signed in", `Welcome back, ${userRecord.displayName || "User"}.`, "Your Cognitus session is active.", buttonLink("#/dashboard", "Dashboard", true));
  root.innerHTML = `<section class="form-card auth-card"><p class="eyebrow">Login</p><h1>Welcome back.</h1><p>Use the Discord ID attached to your Cognitus account and your password.</p><div id="auth-message" class="notice" hidden></div><form id="login-form" class="form-stack"><label>Discord ID<input name="discordId" inputmode="numeric" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><label class="checkbox-line"><input name="remember" type="checkbox" checked> Remember this device</label><button class="button button-dark" type="submit">Login</button><a href="#/account-recovery">Can't access your account?</a></form></section>`;
  const form = root.querySelector("#login-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formObject(form);
    const id = normalizeDiscordId(data.discordId);
    const message = root.querySelector("#auth-message");
    const button = form.querySelector("button[type=submit]");
    if (!id) return showNotice(message, "Enter a valid Discord ID.", "error");
    try {
      setBusy(button, true, "Signing in…", "Login");
      await Auth.setPersistence(auth, data.remember ? Auth.browserLocalPersistence : Auth.browserSessionPersistence);
      await Auth.signInWithEmailAndPassword(auth, authEmail(id), data.password);
      location.hash = "#/dashboard";
    } catch (error) {
      const friendly = ["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(error?.code)
        ? "The Discord ID or password is incorrect."
        : error?.code === "auth/network-request-failed" ? "Network error. Check your connection and try again." : "Login could not be completed.";
      showNotice(message, friendly, "error");
    } finally { setBusy(button, false, "Signing in…", "Login"); }
  });
}
function registerPage() {
  setTitle("Create Account");
  if (userRecord) return hero("Account active", "You're already registered.", "Open your dashboard to continue.", buttonLink("#/dashboard", "Dashboard", true));
  root.innerHTML = `<section class="form-card auth-card"><p class="eyebrow">Create Account</p><h1>Start with a self-declared identity.</h1><p>Cognitus does not independently verify Discord ownership during registration. Your identity remains marked self-declared until reviewed through an approved verification process.</p><div id="auth-message" class="notice" hidden></div><form id="register-form" class="form-stack"><label>Discord Username<input name="discordUsername" maxlength="64" autocomplete="nickname" required></label><label>Discord ID<input name="discordId" inputmode="numeric" autocomplete="username" required></label><label>Password<input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><label>Confirm Password<input name="confirmPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><label class="checkbox-line"><input name="terms" type="checkbox" required> I agree to the Cognitus Terms and responsible-use rules.</label><button class="button button-dark" type="submit">Create Account</button></form></section>`;
  const form = root.querySelector("#register-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formObject(form);
    const discordId = normalizeDiscordId(data.discordId);
    const username = clean(data.discordUsername).slice(0,64);
    const message = root.querySelector("#auth-message");
    const button = form.querySelector("button[type=submit]");
    if (!discordId) return showNotice(message, "Enter a valid Discord ID.", "error");
    if (clean(data.password).length < 8) return showNotice(message, "Password must be at least 8 characters.", "error");
    if (data.password !== data.confirmPassword) return showNotice(message, "Passwords do not match.", "error");
    let credential = null;
    try {
      setBusy(button, true, "Creating account…", "Create Account");
      await Auth.setPersistence(auth, Auth.browserLocalPersistence);
      credential = await Auth.createUserWithEmailAndPassword(auth, authEmail(discordId), data.password);
      authUser = credential.user;
      await Auth.updateProfile(credential.user, { displayName: username });
      const now = Fire.serverTimestamp();
      const user = {
        uid: credential.user.uid,
        cognitusId: createCognitusId("USR"),
        profileId: credential.user.uid,
        displayName: username,
        discordUsername: username,
        discordId,
        role: "user",
        status: "active",
        accountType: "individual",
        organizationId: null,
        syntheticEmail: authEmail(discordId),
        realEmailCollected: false,
        identityVerified: false,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now
      };
      const profile = {
        id: credential.user.uid,
        cognitusId: createCognitusId("PRF"),
        linkedUserId: credential.user.uid,
        type: "person",
        displayName: username,
        robloxUsernames: [],
        robloxUsernamesNormalized: [],
        discordUsernames: [username],
        discordUsernamesNormalized: [lower(username)],
        discordIds: [discordId],
        knownAliases: [],
        claimedByUid: credential.user.uid,
        identityStatus: "self_declared",
        identityConfidence: 0,
        professionalStanding: "unreviewed",
        riskLevel: "unreviewed",
        reportCount: 0,
        appealCount: 0,
        createdAt: now,
        updatedAt: now
      };
      const batch = Fire.writeBatch(db);
      batch.set(Fire.doc(db, "users", credential.user.uid), user);
      batch.set(Fire.doc(db, "profiles", credential.user.uid), profile);
      await batch.commit();
      location.hash = "#/dashboard";
    } catch (error) {
      if (credential?.user && !userRecord) {
        try { await Auth.deleteUser(credential.user); } catch { /* best effort cleanup */ }
      }
      showNotice(message, error?.code === "auth/email-already-in-use" ? "An account already exists for that Discord ID." : "Account creation could not be completed.", "error");
    } finally { setBusy(button, false, "Creating account…", "Create Account"); }
  });
}
function accountRecoveryPage() {
  setTitle("Account Recovery");
  root.innerHTML = `<section class="legal-card"><p class="eyebrow">Account Recovery</p><h1>No fake reset promises.</h1><p>Cognitus intentionally does not collect real email addresses. In a static Firebase-only deployment, the browser cannot securely perform an administrative password reset for another account.</p><p>If you are still signed in on another device, open <strong>Settings</strong> there and change your password. If you are fully locked out, contact a Cognitus Owner so the account can be handled through Firebase administration.</p>${buttonLink("#/login", "Back to Login", true)}</section>`;
}

async function dashboardPage() {
  setTitle("Dashboard");
  if (loginRequired()) return;
  const myChecks = newestFirst(await readQuery("checkLogs", [Fire.where("checkedByUid", "==", authUser.uid)]).catch(() => []), 8);
  root.innerHTML = `<section class="dashboard-hero"><div><p class="eyebrow">Dashboard</p><h1>Welcome, ${safe(userRecord.displayName || "User")}.</h1><p>Your Cognitus identity is currently <strong>${safe(profileRecord?.identityStatus || "self_declared")}</strong>. Self-declared identity is not independent verification.</p><div class="hero-actions">${buttonLink("#/search", "Run a Check", true)}${buttonLink("#/reports/submit", "Submit Report")}${buttonLink("#/organizations", "Organizations")}</div></div><aside class="account-card"><span>Cognitus ID</span><strong>${safe(userRecord.cognitusId || "—")}</strong><small>${safe(userRecord.role)} · ${safe(userRecord.status)}</small><small>Discord ID: ${safe(userRecord.discordId)}</small></aside></section><section class="stats-grid"><article class="stat-card"><span>Account</span><strong>${safe(userRecord.status)}</strong><small>Operational status</small></article><article class="stat-card"><span>Role</span><strong>${safe(userRecord.role)}</strong><small>Permission level</small></article><article class="stat-card"><span>Identity</span><strong>${safe(profileRecord?.identityStatus || "self_declared")}</strong><small>${Number(profileRecord?.identityConfidence || 0)}% confidence</small></article></section><section class="panel"><div class="panel-header"><div><p class="eyebrow">Recent</p><h2>Your latest checks</h2></div>${buttonLink("#/history", "View History")}</div>${myChecks.length ? `<div class="record-list">${myChecks.map((check)=>`<article class="record-row"><div><strong>${safe(check.searchQuery)}</strong><span>${safe(check.reason)} · ${safe(check.searchType)}</span><small>${safe(formatTimestamp(check.createdAt))}</small></div><div class="mini-actions">${buttonLink(`#/reports/quick?checkId=${encodeURIComponent(check.id)}`, "Quick")}${buttonLink(`#/reports/full?checkId=${encodeURIComponent(check.id)}`, "Full")}</div></article>`).join("")}</div>` : `<div class="empty-state"><h3>No checks yet</h3><p>Your logged checks will appear here.</p></div>`}</section>`;
}

async function searchPeople(field, value) {
  const valueClean = clean(value);
  if (!valueClean) return [];
  if (field === "Discord ID") {
    const discordId = normalizeDiscordId(valueClean);
    return discordId ? readQuery("profiles", [Fire.where("discordIds", "array-contains", discordId), Fire.limit(20)]) : [];
  }
  const normalizedField = field === "Discord Username" ? "discordUsernamesNormalized" : "robloxUsernamesNormalized";
  const rawField = field === "Discord Username" ? "discordUsernames" : "robloxUsernames";
  let results = await readQuery("profiles", [Fire.where(normalizedField, "array-contains", lower(valueClean)), Fire.limit(20)]).catch(() => []);
  if (!results.length) results = await readQuery("profiles", [Fire.where(rawField, "array-contains", valueClean), Fire.limit(20)]).catch(() => []);
  return results;
}
async function searchOrganizations(value) {
  const valueClean = lower(value);
  if (!valueClean) return [];
  return readQuery("organizations", [
    Fire.where("searchableName", ">=", valueClean),
    Fire.where("searchableName", "<=", `${valueClean}\uf8ff`),
    Fire.limit(20)
  ]);
}
async function searchPage() {
  setTitle("Run Check");
  if (!ensureActive()) return;
  root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">Run Check</p><h1>Search with a documented purpose.</h1><p>Every completed search creates a permanent check log. If several records match, Cognitus records the result set instead of silently choosing the first person.</p></section><section class="search-layout"><form id="search-form" class="panel form-stack"><div class="form-row"><label>Search Type<select name="searchType" id="search-type"><option>Person</option><option>Organization</option></select></label><label>Search By<select name="searchField" id="search-field"><option>Discord Username</option><option>Discord ID</option><option>Roblox Username</option></select></label></div><label>Search Query<input name="searchQuery" maxlength="100" required></label><label>Reason<select name="reason" required><option value="">Select a reason</option>${CHECK_REASONS.map((reason)=>`<option value="${safe(reason)}">${safe(reason)}</option>`).join("")}</select></label><label>Additional Notes<textarea name="additionalNotes" maxlength="1000" rows="4"></textarea></label><button class="button button-dark" type="submit">Run Logged Check</button><div id="search-message" class="notice" hidden></div></form><aside class="panel"><p class="eyebrow">Standards</p><h2>Use results carefully.</h2><p>Self-declared usernames and IDs are not independent identity verification. Reviewed conduct records are shown only when their visibility permits screening access.</p></aside></section><section class="panel"><div class="panel-header"><div><p class="eyebrow">Results</p><h2>Search results</h2></div><span id="check-reference"></span></div><div id="search-results" class="empty-state"><h3>No check run yet</h3><p>Complete the form to search and create a logged check.</p></div></section>`;
  const type = root.querySelector("#search-type");
  const field = root.querySelector("#search-field");
  type.addEventListener("change", () => {
    field.innerHTML = type.value === "Organization" ? `<option>Organization Name</option>` : `<option>Discord Username</option><option>Discord ID</option><option>Roblox Username</option>`;
  });
  const form = root.querySelector("#search-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formObject(form);
    const button = form.querySelector("button[type=submit]");
    const message = root.querySelector("#search-message");
    const resultsRoot = root.querySelector("#search-results");
    const queryValue = clean(data.searchQuery).slice(0,100);
    if (!CHECK_REASONS.includes(data.reason)) return showNotice(message, "Select a valid reason.", "error");
    try {
      setBusy(button, true, "Running check…", "Run Logged Check");
      resultsRoot.textContent = "Searching…";
      const results = data.searchType === "Organization" ? await searchOrganizations(queryValue) : await searchPeople(data.searchField, queryValue);
      const resultIds = results.map((item)=>item.id).slice(0,20);
      const targetProfileId = data.searchType === "Person" && results.length === 1 ? results[0].id : null;
      const targetOrganizationId = data.searchType === "Organization" && results.length === 1 ? results[0].id : null;
      const ref = Fire.doc(Fire.collection(db, "checkLogs"));
      const check = {
        id: ref.id,
        cognitusId: createCognitusId("CHK"),
        checkedByUid: authUser.uid,
        checkedByCognitusId: userRecord.cognitusId,
        organizationId: userRecord.organizationId || null,
        searchType: data.searchType,
        searchField: data.searchField,
        searchQuery: queryValue,
        reason: data.reason,
        additionalNotes: clean(data.additionalNotes).slice(0,1000),
        targetProfileId,
        targetOrganizationId,
        resultIds,
        resultCount: results.length,
        resultSummary: results.length === 1 ? "1 exact Cognitus record matched." : `${results.length} Cognitus records matched.`,
        downloadedReport: false,
        createdAt: Fire.serverTimestamp(),
        updatedAt: Fire.serverTimestamp()
      };
      await Fire.setDoc(ref, check);
      await writeActivity("CHECK_CREATED", "check", ref.id, `Ran ${data.searchType} check.`, { reason: data.reason, searchField: data.searchField });
      root.querySelector("#check-reference").textContent = `Check ${check.cognitusId}`;
      resultsRoot.className = "";
      resultsRoot.innerHTML = results.length
        ? `<div class="result-grid">${results.map((item)=>data.searchType === "Organization" ? organizationResultCard(item) : personResultCard(item)).join("")}</div><div class="hero-actions">${buttonLink(`#/reports/quick?checkId=${encodeURIComponent(ref.id)}`, "Quick Report")}${buttonLink(`#/reports/full?checkId=${encodeURIComponent(ref.id)}`, "Full Report", true)}</div>`
        : `<div class="empty-state"><h3>No matching Cognitus record</h3><p>The no-match check was logged and can still be used as a documented result.</p><div class="hero-actions">${buttonLink(`#/reports/quick?checkId=${encodeURIComponent(ref.id)}`, "Quick Report")}</div></div>`;
    } catch (error) {
      resultsRoot.innerHTML = `<div class="notice notice-error">${safe(error?.message || "Search could not be completed.")}</div>`;
    } finally { setBusy(button, false, "Running check…", "Run Logged Check"); }
  });
}
function personResultCard(item) {
  return `<article class="result-card"><p class="eyebrow">Person</p><h3>${safe(item.displayName || "Unnamed Profile")}</h3><p>${safe(item.professionalStanding || "unreviewed")}</p><div class="record-meta"><span>${safe(item.cognitusId || item.id)}</span><span>${safe(item.identityStatus || "self_declared")}</span><span>Risk: ${safe(item.riskLevel || "unreviewed")}</span></div><div class="alias-list">${(item.robloxUsernames || []).slice(0,5).map((name)=>`<span>Roblox: ${safe(name)}</span>`).join("")}${(item.discordUsernames || []).slice(0,5).map((name)=>`<span>Discord: ${safe(name)}</span>`).join("")}</div><div class="hero-actions">${buttonLink(`#/reports/submit?targetType=person&target=${encodeURIComponent(item.id)}`, "Submit Report")}${buttonLink(`#/claims?profileId=${encodeURIComponent(item.id)}`, "Claim Profile")}</div></article>`;
}
function organizationResultCard(item) {
  return `<article class="result-card"><p class="eyebrow">Organization</p><h3>${safe(item.name || "Unnamed Organization")}</h3><p>${safe(item.organizationType || "Community")}</p><div class="record-meta"><span>${safe(item.cognitusId || item.id)}</span><span>${safe(item.verificationStatus || "pending_verification")}</span><span>${safe(item.trustLevel || "unreviewed")}</span></div><div class="hero-actions">${buttonLink(`#/reports/submit?targetType=organization&target=${encodeURIComponent(item.id)}`, "Submit Report")}</div></article>`;
}

async function historyPage() {
  setTitle("History");
  if (loginRequired()) return;
  const checks = newestFirst(await readQuery("checkLogs", [Fire.where("checkedByUid", "==", authUser.uid)]));
  root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">History</p><h1>Your logged checks.</h1><p>Newest checks are shown first. Sorting happens in the browser so this page does not require a composite Firestore index.</p></section><section class="panel">${checks.length ? `<div class="record-list">${checks.map((check)=>`<article class="record-row"><div><strong>${safe(check.searchQuery)}</strong><span>${safe(check.reason)} · ${safe(check.searchType)} · ${Number(check.resultCount || 0)} result(s)</span><small>${safe(formatTimestamp(check.createdAt))}</small></div><div class="mini-actions">${buttonLink(`#/reports/quick?checkId=${encodeURIComponent(check.id)}`, "Quick")}${buttonLink(`#/reports/full?checkId=${encodeURIComponent(check.id)}`, "Full")}</div></article>`).join("")}</div>` : `<div class="empty-state"><h3>No checks yet</h3><p>Run your first logged check to begin a history.</p></div>`}</section>`;
}
async function getScreeningReportsForProfile(profileId) {
  if (!profileId) return [];
  const rows = await readQuery("reports", [
    Fire.where("subjectProfileId", "==", profileId),
    Fire.where("status", "==", "approved"),
    Fire.where("visibility", "==", "screening")
  ]).catch(() => []);
  return newestFirst(rows, 50);
}
async function getScreeningReportsForOrganization(organizationId) {
  if (!organizationId) return [];
  const rows = await readQuery("reports", [
    Fire.where("subjectOrganizationId", "==", organizationId),
    Fire.where("status", "==", "approved"),
    Fire.where("visibility", "==", "screening")
  ]).catch(() => []);
  return newestFirst(rows, 50);
}
async function reportPage(mode) {
  setTitle(mode === "full" ? "Full Report" : "Quick Report");
  if (loginRequired()) return;
  const checkId = params().get("checkId");
  const check = checkId ? await readDoc("checkLogs", checkId) : null;
  if (!check) return hero("Report", "Check not found.", "The selected check does not exist or you do not have permission to read it.", buttonLink("#/history", "History", true));
  let subject = null;
  let subjectType = check.searchType;
  let reports = [];
  if (check.targetProfileId) {
    subject = await readDoc("profiles", check.targetProfileId);
    subjectType = "Person";
    reports = await getScreeningReportsForProfile(check.targetProfileId);
  } else if (check.targetOrganizationId) {
    subject = await readDoc("organizations", check.targetOrganizationId);
    subjectType = "Organization";
    reports = await getScreeningReportsForOrganization(check.targetOrganizationId);
  }
  const riskOrder = { Informational: 0, Low: 1, Moderate: 2, High: 3, Critical: 4 };
  const highest = reports.reduce((best, report) => (riskOrder[report.severity] || 0) > (riskOrder[best] || 0) ? report.severity : best, "Informational");
  const recommendation = !subject
    ? (Number(check.resultCount || 0) > 1 ? "Ambiguous Match — Refine Search" : "No Record Found")
    : (["High","Critical"].includes(highest) ? "Additional Investigation Recommended" : highest === "Moderate" ? "Review Before Decision" : "Standard Review");
  root.innerHTML = `<section class="report-toolbar no-print">${buttonLink("#/history", "Back to History")}<button id="print-report" class="button button-dark" type="button">Print / Save PDF</button></section><article class="report-document"><header class="report-header"><div><p class="eyebrow">Cognitus Solutions</p><h1>${mode === "full" ? "Comprehensive" : "Quick"} Screening Report</h1><p>Generated from logged check ${safe(check.cognitusId || check.id)}.</p></div><div class="report-id-card"><span>Recommendation</span><strong>${safe(recommendation)}</strong><small>Highest reviewed severity: ${safe(highest)}</small></div></header><section class="report-section"><h2>Check Metadata</h2><dl class="report-dl"><dt>Requested by</dt><dd>${safe(userRecord.displayName)}</dd><dt>Reason</dt><dd>${safe(check.reason)}</dd><dt>Query</dt><dd>${safe(check.searchQuery)}</dd><dt>Type</dt><dd>${safe(check.searchType)}</dd><dt>Results</dt><dd>${Number(check.resultCount || 0)}</dd><dt>Created</dt><dd>${safe(formatTimestamp(check.createdAt))}</dd></dl></section><section class="report-section"><h2>Subject</h2>${subject ? renderReportSubject(subjectType, subject) : `<div class="notice">${Number(check.resultCount || 0) > 1 ? "Multiple records matched. Cognitus intentionally did not attach this check to an arbitrary first result." : "No matching Cognitus subject was attached to this check."}</div>`}</section><section class="report-section"><h2>Reviewed Screening Records</h2>${reports.length ? `<div class="report-records">${reports.slice(0, mode === "full" ? 50 : 5).map((report)=>`<article><strong>${safe(report.category)}</strong><span>${safe(report.severity)} · ${safe(report.status)}</span><p>${safe(report.summary)}</p></article>`).join("")}</div>` : `<div class="notice">No reviewed records currently visible for screening.</div>`}</section>${mode === "full" ? `<section class="report-section"><h2>Additional Check Notes</h2><p>${safe(check.additionalNotes || "No additional notes were provided.")}</p></section>` : ""}<section class="report-section disclaimer"><h2>Important</h2><p>Cognitus records are one decision-support input. Self-declared identity is not proof of platform ownership, and screening results should be independently evaluated in context.</p></section></article>`;
  root.querySelector("#print-report")?.addEventListener("click", async () => {
    const downloadRef = Fire.doc(Fire.collection(db, "downloads"));
    try {
      const batch = Fire.writeBatch(db);
      batch.set(downloadRef, { id: downloadRef.id, cognitusId: createCognitusId("DWL"), downloadedByUid: authUser.uid, checkId: check.id, reportType: mode, format: "print_pdf", createdAt: Fire.serverTimestamp() });
      batch.update(Fire.doc(db, "checkLogs", check.id), { downloadedReport: true, updatedAt: Fire.serverTimestamp() });
      await batch.commit();
      await writeActivity("REPORT_DOWNLOADED", "check", check.id, `Printed ${mode} report.`);
    } catch (error) { console.warn("Download logging failed", error); }
    window.print();
  });
}
function renderReportSubject(type, subject) {
  if (type === "Organization") return `<dl class="report-dl"><dt>Name</dt><dd>${safe(subject.name || "Unnamed")}</dd><dt>Cognitus ID</dt><dd>${safe(subject.cognitusId || subject.id)}</dd><dt>Verification</dt><dd>${safe(subject.verificationStatus || "pending_verification")}</dd><dt>Trust</dt><dd>${safe(subject.trustLevel || "unreviewed")}</dd></dl>`;
  return `<dl class="report-dl"><dt>Name</dt><dd>${safe(subject.displayName || "Unnamed")}</dd><dt>Cognitus ID</dt><dd>${safe(subject.cognitusId || subject.id)}</dd><dt>Identity</dt><dd>${safe(subject.identityStatus || "self_declared")}</dd><dt>Standing</dt><dd>${safe(subject.professionalStanding || "unreviewed")}</dd><dt>Risk</dt><dd>${safe(subject.riskLevel || "unreviewed")}</dd><dt>Roblox</dt><dd>${safe((subject.robloxUsernames || []).join(", ") || "None listed")}</dd><dt>Discord</dt><dd>${safe((subject.discordUsernames || []).join(", ") || "None listed")}</dd></dl>`;
}

async function submitReportPage() {
  setTitle("Submit Report");
  if (!ensureActive()) return;
  const target = params().get("target") || "";
  const targetType = params().get("targetType") === "organization" ? "organization" : "person";
  root.innerHTML = `<section class="form-card wide-form"><p class="eyebrow">Submit Report</p><h1>Submit information for review.</h1><p>Original submissions are immutable after filing. Reviewers may change review status and screening visibility, but not rewrite what you submitted.</p><div id="report-message" class="notice" hidden></div><form id="report-form" class="form-stack"><div class="form-row"><label>Subject Type<select name="targetType"><option value="person" ${targetType === "person" ? "selected" : ""}>Person</option><option value="organization" ${targetType === "organization" ? "selected" : ""}>Organization</option></select></label><label>Subject Document ID<input name="target" value="${safe(target)}" maxlength="128" required></label></div><label>Category<select name="category" required><option value="">Select category</option>${REPORT_CATEGORIES.map((item)=>`<option>${safe(item)}</option>`).join("")}</select></label><label>Severity<select name="severity" required>${SEVERITIES.map((item)=>`<option>${safe(item)}</option>`).join("")}</select></label><label>Summary<input name="summary" maxlength="240" required></label><label>Details<textarea name="details" maxlength="5000" rows="7" required></textarea></label><button class="button button-dark" type="submit">Submit for Review</button></form></section>`;
  const form = root.querySelector("#report-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = formObject(form);
    const message = root.querySelector("#report-message");
    const button = form.querySelector("button[type=submit]");
    if (!REPORT_CATEGORIES.includes(data.category) || !SEVERITIES.includes(data.severity)) return showNotice(message, "Choose a valid category and severity.", "error");
    const targetId = clean(data.target);
    const subject = await readDoc(data.targetType === "organization" ? "organizations" : "profiles", targetId).catch(() => null);
    if (!subject) return showNotice(message, "The selected subject record could not be found.", "error");
    try {
      setBusy(button, true, "Submitting…", "Submit for Review");
      const ref = Fire.doc(Fire.collection(db, "reports"));
      await Fire.setDoc(ref, {
        id: ref.id,
        cognitusId: createCognitusId("RPT"),
        subjectProfileId: data.targetType === "person" ? targetId : null,
        subjectOrganizationId: data.targetType === "organization" ? targetId : null,
        submittedByUid: authUser.uid,
        submittedByCognitusId: userRecord.cognitusId,
        submittedByOrganizationId: userRecord.organizationId || null,
        category: data.category,
        severity: data.severity,
        summary: clean(data.summary).slice(0,240),
        details: clean(data.details).slice(0,5000),
        status: "pending_review",
        visibility: "private_review",
        reviewedByUid: null,
        reviewedAt: null,
        decisionNotes: "",
        publishedAt: null,
        appealStatus: "none",
        createdAt: Fire.serverTimestamp(),
        updatedAt: Fire.serverTimestamp()
      });
      await writeActivity("REPORT_SUBMITTED", "report", ref.id, `Submitted ${data.category} report.`);
      form.reset();
      showNotice(message, `Report submitted. Reference: ${ref.id}`, "success");
    } catch (error) { showNotice(message, error?.message || "Report could not be submitted.", "error"); }
    finally { setBusy(button, false, "Submitting…", "Submit for Review"); }
  });
}

async function claimsPage() {
  setTitle("Claims");
  if (!ensureActive()) return;
  const profileId = params().get("profileId") || "";
  const mine = newestFirst(await readQuery("claims", [Fire.where("submittedByUid", "==", authUser.uid)]).catch(() => []), 25);
  root.innerHTML = `<section class="workflow-layout"><section class="form-card"><p class="eyebrow">Profile Claim</p><h1>Claim a matching profile.</h1><p>Claims are accepted only when the target profile contains the immutable Discord ID attached to your account.</p><div id="claim-message" class="notice" hidden></div><form id="claim-form" class="form-stack"><label>Profile Document ID<input name="profileId" value="${safe(profileId)}" required></label><label>Statement<textarea name="statement" maxlength="1500" rows="5"></textarea></label><button class="button button-dark" type="submit">Submit Claim</button></form></section><section class="panel"><p class="eyebrow">Your Claims</p><h2>Recent submissions</h2>${mine.length ? `<div class="record-list">${mine.map((item)=>`<article class="record-row"><div><strong>${safe(item.cognitusId || item.id)}</strong><span>${safe(item.profileId)}</span><small>${safe(item.status)} · ${safe(formatTimestamp(item.createdAt))}</small></div></article>`).join("")}</div>` : `<div class="empty-state"><p>No claims submitted.</p></div>`}</section></section>`;
  root.querySelector("#claim-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formObject(form);
    const targetProfile = await readDoc("profiles", clean(data.profileId)).catch(() => null);
    const message = root.querySelector("#claim-message");
    if (!targetProfile) return showNotice(message, "Profile not found.", "error");
    if (!(targetProfile.discordIds || []).includes(userRecord.discordId)) return showNotice(message, "This profile does not contain the Discord ID attached to your account.", "error");
    const ref = Fire.doc(Fire.collection(db, "claims"));
    try {
      await Fire.setDoc(ref, {
        id: ref.id,
        cognitusId: createCognitusId("CLM"),
        profileId: targetProfile.id,
        submittedByUid: authUser.uid,
        submittedByCognitusId: userRecord.cognitusId,
        submittedDiscordId: userRecord.discordId,
        statement: clean(data.statement).slice(0,1500),
        verificationMethod: "immutable_discord_id_match",
        status: "pending_review",
        reviewedByUid: null,
        decisionNotes: "",
        closedAt: null,
        createdAt: Fire.serverTimestamp(),
        updatedAt: Fire.serverTimestamp()
      });
      await writeActivity("CLAIM_SUBMITTED", "claim", ref.id, "Submitted profile claim.");
      showNotice(message, `Claim submitted. Reference: ${ref.id}`, "success");
      form.reset();
    } catch (error) { showNotice(message, error?.message || "Claim could not be submitted.", "error"); }
  });
}

async function appealsPage() {
  setTitle("Appeals");
  if (!ensureActive()) return;
  const mine = newestFirst(await readQuery("appeals", [Fire.where("submittedByUid", "==", authUser.uid)]).catch(() => []), 25);
  root.innerHTML = `<section class="workflow-layout"><section class="form-card"><p class="eyebrow">Appeal / Correction</p><h1>Challenge a report tied to you.</h1><div id="appeal-message" class="notice" hidden></div><form id="appeal-form" class="form-stack"><label>Profile Document ID<input name="profileId" required></label><label>Report Document ID<input name="reportId" required></label><label>Reason<input name="reason" maxlength="200" required></label><label>Statement<textarea name="statement" maxlength="4000" rows="7" required></textarea></label><button class="button button-dark" type="submit">Submit Appeal</button></form></section><section class="panel"><p class="eyebrow">Your Appeals</p><h2>Recent submissions</h2>${mine.length ? `<div class="record-list">${mine.map((item)=>`<article class="record-row"><div><strong>${safe(item.reason)}</strong><span>${safe(item.reportId)}</span><small>${safe(item.status)} · ${safe(formatTimestamp(item.createdAt))}</small></div></article>`).join("")}</div>` : `<div class="empty-state"><p>No appeals submitted.</p></div>`}</section></section>`;
  root.querySelector("#appeal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formObject(form);
    const [profile, report] = await Promise.all([
      readDoc("profiles", clean(data.profileId)).catch(()=>null),
      readDoc("reports", clean(data.reportId)).catch(()=>null)
    ]);
    const message = root.querySelector("#appeal-message");
    if (!profile || !report || report.subjectProfileId !== profile.id) return showNotice(message, "The profile and report are not a valid related record pair.", "error");
    if (profile.linkedUserId !== authUser.uid && !(profile.discordIds || []).includes(userRecord.discordId)) return showNotice(message, "You are not eligible to appeal this profile's report.", "error");
    const ref = Fire.doc(Fire.collection(db, "appeals"));
    try {
      await Fire.setDoc(ref, {
        id: ref.id,
        cognitusId: createCognitusId("APL"),
        profileId: profile.id,
        reportId: report.id,
        submittedByUid: authUser.uid,
        submittedByCognitusId: userRecord.cognitusId,
        reason: clean(data.reason).slice(0,200),
        statement: clean(data.statement).slice(0,4000),
        status: "pending_review",
        reviewedByUid: null,
        decision: null,
        decisionNotes: "",
        closedAt: null,
        createdAt: Fire.serverTimestamp(),
        updatedAt: Fire.serverTimestamp()
      });
      await writeActivity("APPEAL_SUBMITTED", "appeal", ref.id, "Submitted appeal.");
      showNotice(message, `Appeal submitted. Reference: ${ref.id}`, "success");
      form.reset();
    } catch (error) { showNotice(message, error?.message || "Appeal could not be submitted.", "error"); }
  });
}

async function reviewPage() {
  setTitle("Review Queue");
  if (loginRequired()) return;
  if (!reviewer()) return hero("Access Denied", "Reviewer access required.", "Your active account does not have reviewer permissions.", buttonLink("#/dashboard", "Dashboard", true));
  const [reportRows, claimRows, appealRows] = await Promise.all([
    readQuery("reports", [Fire.where("status", "==", "pending_review")]),
    readQuery("claims", [Fire.where("status", "==", "pending_review")]),
    readQuery("appeals", [Fire.where("status", "==", "pending_review")])
  ]);
  const reports = newestFirst(reportRows, 50);
  const claims = newestFirst(claimRows, 50);
  const appeals = newestFirst(appealRows, 50);
  root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">Review Queue</p><h1>Decide without rewriting history.</h1><p>Original submissions remain unchanged. Review decisions are stored separately in the review fields.</p></section><section class="dashboard-grid">${reviewSection("Reports", reports, "report")}${reviewSection("Claims", claims, "claim")}${reviewSection("Appeals", appeals, "appeal")}</section>`;
  root.querySelectorAll("[data-review-action]").forEach((button) => button.addEventListener("click", async () => {
    const kind = button.dataset.kind;
    const id = button.dataset.id;
    const action = button.dataset.reviewAction;
    button.disabled = true;
    try {
      if (kind === "report") {
        await Fire.updateDoc(Fire.doc(db, "reports", id), {
          status: action === "approve" ? "approved" : "denied",
          visibility: action === "approve" ? "screening" : "private_review",
          reviewedByUid: authUser.uid,
          reviewedAt: Fire.serverTimestamp(),
          decisionNotes: action === "approve" ? "Approved for screening visibility." : "Denied by reviewer.",
          updatedAt: Fire.serverTimestamp()
        });
      } else if (kind === "claim") {
        const claim = await readDoc("claims", id);
        const batch = Fire.writeBatch(db);
        batch.update(Fire.doc(db, "claims", id), {
          status: action === "approve" ? "approved" : "denied",
          reviewedByUid: authUser.uid,
          decisionNotes: action === "approve" ? "Claim approved." : "Claim denied.",
          closedAt: Fire.serverTimestamp(),
          updatedAt: Fire.serverTimestamp()
        });
        if (action === "approve" && claim?.profileId && claim?.submittedByUid) {
          batch.update(Fire.doc(db, "profiles", claim.profileId), {
            claimedByUid: claim.submittedByUid,
            identityStatus: "claimed_unverified",
            updatedAt: Fire.serverTimestamp()
          });
        }
        await batch.commit();
      } else if (kind === "appeal") {
        const appeal = await readDoc("appeals", id);
        const batch = Fire.writeBatch(db);
        batch.update(Fire.doc(db, "appeals", id), {
          status: action === "approve" ? "accepted" : "denied",
          reviewedByUid: authUser.uid,
          decision: action === "approve" ? "accepted" : "denied",
          decisionNotes: action === "approve" ? "Appeal accepted; linked report moved to disputed/private review." : "Appeal denied.",
          closedAt: Fire.serverTimestamp(),
          updatedAt: Fire.serverTimestamp()
        });
        if (action === "approve" && appeal?.reportId) {
          batch.update(Fire.doc(db, "reports", appeal.reportId), {
            status: "disputed",
            visibility: "private_review",
            appealStatus: "accepted",
            reviewedByUid: authUser.uid,
            reviewedAt: Fire.serverTimestamp(),
            updatedAt: Fire.serverTimestamp()
          });
        }
        await batch.commit();
      }
      await writeActivity("REVIEW_DECISION", kind, id, `${kind} ${action}d.`);
      button.closest(".workflow-card")?.remove();
    } catch (error) {
      alert(error?.message || "Review action failed.");
      button.disabled = false;
    }
  }));
}
function reviewSection(title, items, kind) {
  return `<section class="panel"><div class="panel-header"><div><p class="eyebrow">Review</p><h2>${safe(title)}</h2></div><span>${items.length} pending</span></div>${items.length ? `<div class="workflow-list">${items.map((item)=>`<article class="workflow-card"><div><strong>${safe(item.summary || item.reason || item.cognitusId || item.id)}</strong><p>${safe(item.details || item.statement || item.profileId || "")}</p><small>${safe(formatTimestamp(item.createdAt))}</small></div><div class="mini-actions"><button class="button button-light" data-review-action="approve" data-kind="${safe(kind)}" data-id="${safe(item.id)}" type="button">Approve</button><button class="button button-light" data-review-action="deny" data-kind="${safe(kind)}" data-id="${safe(item.id)}" type="button">Deny</button></div></article>`).join("")}</div>` : `<div class="empty-state"><p>Nothing pending.</p></div>`}</section>`;
}

async function organizationsPage() {
  setTitle("Organizations");
  if (loginRequired()) return;
  const orgs = alphabetic(await readQuery("organizations").catch(() => []), "name");
  root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">Organizations</p><h1>Organization directory.</h1><p>Organization verification and trust levels are controlled by Cognitus reviewers/admins, not by the organization itself.</p>${activeUser() ? `<div class="hero-actions"><button id="new-org-toggle" class="button button-dark" type="button">Request Organization Record</button></div>` : ""}</section><section id="org-create" class="form-card" hidden><p class="eyebrow">New Organization</p><h2>Request a record</h2><div id="org-message" class="notice" hidden></div><form id="org-form" class="form-stack"><label>Name<input name="name" maxlength="100" required></label><label>Organization Type<input name="organizationType" maxlength="100" value="Roblox/Discord Community"></label><label>Country / Region<input name="country" maxlength="100"></label><button class="button button-dark" type="submit">Create Pending Record</button></form></section><section class="panel"><div class="result-grid">${orgs.map(organizationResultCard).join("") || `<div class="empty-state"><p>No organizations yet.</p></div>`}</div></section>`;
  root.querySelector("#new-org-toggle")?.addEventListener("click", () => { root.querySelector("#org-create").hidden = false; });
  root.querySelector("#org-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = formObject(form);
    const name = clean(data.name).slice(0,100);
    const message = root.querySelector("#org-message");
    if (!name) return showNotice(message, "Organization name is required.", "error");
    const ref = Fire.doc(Fire.collection(db, "organizations"));
    try {
      await Fire.setDoc(ref, {
        id: ref.id,
        cognitusId: createCognitusId("ORG"),
        name,
        searchableName: lower(name),
        organizationType: clean(data.organizationType).slice(0,100),
        country: clean(data.country).slice(0,100),
        verificationStatus: "pending_verification",
        trustLevel: "unreviewed",
        memberCount: 0,
        publicNotes: "",
        createdByUid: authUser.uid,
        createdAt: Fire.serverTimestamp(),
        updatedAt: Fire.serverTimestamp()
      });
      await writeActivity("ORGANIZATION_CREATED", "organization", ref.id, `Created organization request ${name}.`);
      showNotice(message, `Organization record created for review: ${ref.id}`, "success");
      form.reset();
    } catch (error) { showNotice(message, error?.message || "Organization could not be created.", "error"); }
  });
}

async function adminPage() {
  setTitle("Administration");
  if (loginRequired()) return;
  if (!admin()) return hero("Access Denied", "Admin access required.", "Your active account does not have administrative permissions.", buttonLink("#/dashboard", "Dashboard", true));
  const [userRows, organizationRows, activityRows] = await Promise.all([
    readQuery("users"),
    readQuery("organizations"),
    readQuery("auditLogs").catch(() => [])
  ]);
  const users = newestFirst(userRows, 100);
  const organizations = newestFirst(organizationRows, 100);
  const activity = newestFirst(activityRows, 100);
  root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">Administration</p><h1>Control access and verification.</h1><p>Admins may manage non-owner accounts. Only Owners may grant or remove Owner access or modify an existing Owner account.</p></section><section class="admin-tabs"><button class="button button-dark" data-tab="users" type="button">Users</button><button class="button button-light" data-tab="orgs" type="button">Organizations</button><button class="button button-light" data-tab="activity" type="button">Activity</button></section><section id="admin-users" class="panel">${renderUsersTable(users)}</section><section id="admin-orgs" class="panel" hidden>${renderOrganizationsAdmin(organizations)}</section><section id="admin-activity" class="panel" hidden>${renderActivity(activity)}</section>`;
  root.querySelectorAll("[data-tab]").forEach((button)=>button.addEventListener("click",()=>{
    ["users","orgs","activity"].forEach((tab)=>{ root.querySelector(`#admin-${tab}`).hidden = tab !== button.dataset.tab; });
    root.querySelectorAll("[data-tab]").forEach((b)=>b.className=`button ${b === button ? "button-dark" : "button-light"}`);
  }));
  root.querySelectorAll("[data-user-role]").forEach((select)=>select.addEventListener("change", async () => {
    const uid = select.dataset.userRole;
    const target = users.find((user)=>user.id === uid);
    const newRole = select.value;
    if (target?.role === "owner" && !owner()) return alert("Only an Owner can modify another Owner account.");
    if (newRole === "owner" && !owner()) return alert("Only an Owner can grant Owner access.");
    try {
      await Fire.updateDoc(Fire.doc(db, "users", uid), { role: newRole, updatedAt: Fire.serverTimestamp() });
      await writeActivity("USER_ROLE_CHANGED", "user", uid, `Changed user role to ${newRole}.`);
    } catch (error) { alert(error?.message || "Role update failed."); }
  }));
  root.querySelectorAll("[data-user-status]").forEach((select)=>select.addEventListener("change", async () => {
    const uid = select.dataset.userStatus;
    const target = users.find((user)=>user.id === uid);
    if (target?.role === "owner" && !owner()) return alert("Only an Owner can modify an Owner account.");
    try {
      await Fire.updateDoc(Fire.doc(db, "users", uid), { status: select.value, updatedAt: Fire.serverTimestamp() });
      await writeActivity("USER_STATUS_CHANGED", "user", uid, `Changed user status to ${select.value}.`);
    } catch (error) { alert(error?.message || "Status update failed."); }
  }));
  root.querySelectorAll("[data-user-org]").forEach((input)=>input.addEventListener("change", async () => {
    const uid = input.dataset.userOrg;
    const target = users.find((user)=>user.id === uid);
    if (target?.role === "owner" && !owner()) return alert("Only an Owner can modify an Owner account.");
    try {
      await Fire.updateDoc(Fire.doc(db, "users", uid), { organizationId: clean(input.value) || null, updatedAt: Fire.serverTimestamp() });
      await writeActivity("USER_ORG_CHANGED", "user", uid, "Changed organization membership.");
    } catch (error) { alert(error?.message || "Organization assignment failed."); }
  }));
  root.querySelectorAll("[data-org-verification]").forEach((select)=>select.addEventListener("change", async () => {
    await Fire.updateDoc(Fire.doc(db, "organizations", select.dataset.orgVerification), { verificationStatus: select.value, updatedAt: Fire.serverTimestamp() });
    await writeActivity("ORG_VERIFICATION_CHANGED", "organization", select.dataset.orgVerification, `Organization verification: ${select.value}.`);
  }));
  root.querySelectorAll("[data-org-trust]").forEach((select)=>select.addEventListener("change", async () => {
    await Fire.updateDoc(Fire.doc(db, "organizations", select.dataset.orgTrust), { trustLevel: select.value, updatedAt: Fire.serverTimestamp() });
    await writeActivity("ORG_TRUST_CHANGED", "organization", select.dataset.orgTrust, `Organization trust: ${select.value}.`);
  }));
}
function renderUsersTable(users) {
  return `<div class="panel-header"><div><p class="eyebrow">Users</p><h2>Account management</h2></div><span>${users.length} shown</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Organization</th></tr></thead><tbody>${users.map((user)=>{const ownerLocked = (user.role === "owner" && !owner()) || (user.id === authUser?.uid && user.role === "owner"); const availableRoles = owner() ? ROLES : ROLES.filter((role)=>role !== "owner"); return `<tr><td><strong>${safe(user.displayName || "Unnamed")}</strong><br><small>${safe(user.cognitusId || user.id)}</small></td><td><select data-user-role="${safe(user.id)}" ${ownerLocked ? "disabled" : ""}>${availableRoles.map((role)=>`<option value="${role}" ${role === user.role ? "selected" : ""}>${safe(role)}</option>`).join("")}${ownerLocked ? `<option selected>owner</option>` : ""}</select></td><td><select data-user-status="${safe(user.id)}" ${ownerLocked ? "disabled" : ""}>${STATUSES.map((status)=>`<option value="${status}" ${status === user.status ? "selected" : ""}>${safe(status)}</option>`).join("")}</select></td><td><input data-user-org="${safe(user.id)}" value="${safe(user.organizationId || "")}" placeholder="Organization document ID" ${ownerLocked ? "disabled" : ""}></td></tr>`;}).join("")}</tbody></table></div>`;
}
function renderOrganizationsAdmin(orgs) {
  const verification = ["pending_verification","verified","unverified","suspended","restricted"];
  const trust = ["unreviewed","good","watch","concern","high_risk"];
  return `<div class="panel-header"><div><p class="eyebrow">Organizations</p><h2>Verification & trust</h2></div><span>${orgs.length} shown</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Organization</th><th>Verification</th><th>Trust</th></tr></thead><tbody>${orgs.map((org)=>`<tr><td><strong>${safe(org.name || "Unnamed")}</strong><br><small>${safe(org.cognitusId || org.id)}</small></td><td><select data-org-verification="${safe(org.id)}">${verification.map((value)=>`<option value="${value}" ${value === org.verificationStatus ? "selected" : ""}>${safe(value)}</option>`).join("")}</select></td><td><select data-org-trust="${safe(org.id)}">${trust.map((value)=>`<option value="${value}" ${value === org.trustLevel ? "selected" : ""}>${safe(value)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`;
}
function renderActivity(activity) {
  return `<div class="panel-header"><div><p class="eyebrow">Activity</p><h2>Recent client activity</h2></div><span>${activity.length} shown</span></div><div class="notice">These client-authenticated activity events provide operational traceability, but a fully tamper-evident audit trail requires a trusted server environment.</div><div class="record-list">${activity.map((item)=>`<article class="record-row"><div><strong>${safe(item.action || "ACTION")}</strong><span>${safe(item.summary || "")}</span><small>${safe(item.actorCognitusId || item.actorUid || "Unknown")} · ${safe(formatTimestamp(item.createdAt))}</small></div></article>`).join("")}</div>`;
}

async function settingsPage() {
  setTitle("Settings");
  if (loginRequired()) return;
  root.innerHTML = `<section class="dashboard-grid"><section class="form-card"><p class="eyebrow">Profile Settings</p><h2>Self-declared profile fields</h2><div id="profile-message" class="notice" hidden></div><form id="profile-form" class="form-stack"><label>Display Name<input name="displayName" maxlength="64" value="${safe(profileRecord?.displayName || userRecord.displayName || "")}"></label><label>Roblox Usernames<input name="robloxUsernames" maxlength="300" value="${safe((profileRecord?.robloxUsernames || []).join(", "))}" placeholder="Comma-separated"></label><button class="button button-dark" type="submit">Save Profile</button></form></section><section class="form-card"><p class="eyebrow">Security</p><h2>Change password</h2><div id="password-message" class="notice" hidden></div><form id="password-form" class="form-stack"><label>Current Password<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>New Password<input name="newPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><button class="button button-dark" type="submit">Change Password</button></form></section></section>`;
  root.querySelector("#profile-form").addEventListener("submit", async (event)=>{
    event.preventDefault();
    const data = formObject(event.currentTarget);
    const displayName = clean(data.displayName).slice(0,64);
    const roblox = clean(data.robloxUsernames).split(",").map((value)=>clean(value).slice(0,64)).filter(Boolean).slice(0,10);
    try {
      const batch = Fire.writeBatch(db);
      batch.update(Fire.doc(db, "users", authUser.uid), { displayName, updatedAt: Fire.serverTimestamp() });
      batch.update(Fire.doc(db, "profiles", authUser.uid), { displayName, robloxUsernames: roblox, robloxUsernamesNormalized: roblox.map(lower), updatedAt: Fire.serverTimestamp() });
      await batch.commit();
      await Auth.updateProfile(auth.currentUser, { displayName });
      showNotice(root.querySelector("#profile-message"), "Profile updated. Identity verification fields were not changed.", "success");
      await refreshAccount();
      renderNav();
    } catch (error) { showNotice(root.querySelector("#profile-message"), error?.message || "Profile update failed.", "error"); }
  });
  root.querySelector("#password-form").addEventListener("submit", async (event)=>{
    event.preventDefault();
    const data = formObject(event.currentTarget);
    const message = root.querySelector("#password-message");
    if (clean(data.newPassword).length < 8) return showNotice(message, "New password must be at least 8 characters.", "error");
    try {
      const credential = Auth.EmailAuthProvider.credential(auth.currentUser.email, data.currentPassword);
      await Auth.reauthenticateWithCredential(auth.currentUser, credential);
      await Auth.updatePassword(auth.currentUser, data.newPassword);
      showNotice(message, "Password changed successfully.", "success");
      event.currentTarget.reset();
    } catch (error) { showNotice(message, error?.code === "auth/invalid-credential" ? "Current password is incorrect." : (error?.message || "Password change failed."), "error"); }
  });
}

async function render() {
  try {
    await loadFirebase();
    if (authReady) await refreshAccount();
    renderNav();
    renderFooter();
    const current = route();
    if (current === "/") return homePage();
    if (current === "/features") return featuresPage();
    if (current === "/about") return aboutPage();
    if (current === "/terms") return termsPage();
    if (current === "/privacy") return privacyPage();
    if (current === "/login") return loginPage();
    if (current === "/register") return registerPage();
    if (current === "/account-recovery" || current === "/password-reset") return accountRecoveryPage();
    if (current === "/dashboard") return dashboardPage();
    if (current === "/search") return searchPage();
    if (current === "/history") return historyPage();
    if (current === "/reports/quick") return reportPage("quick");
    if (current === "/reports/full") return reportPage("full");
    if (current === "/reports/submit") return submitReportPage();
    if (current === "/claims") return claimsPage();
    if (current === "/appeals") return appealsPage();
    if (current === "/review") return reviewPage();
    if (current === "/organizations") return organizationsPage();
    if (current === "/admin") return adminPage();
    if (current === "/settings") return settingsPage();
    if (current === "/owner-bootstrap") return hero("Owner Security", "Client-side bootstrap has been retired.", "Owner provisioning must be performed through a trusted Firebase administrative environment. This route can no longer elevate an account.", buttonLink("#/dashboard", "Dashboard", true));
    hero("404", "Page not found.", "The requested Cognitus page does not exist.", buttonLink(userRecord ? "#/dashboard" : "#/", "Return", true));
  } catch (error) {
    console.error("Cognitus render error", error);
    root.innerHTML = `<section class="hero"><p class="eyebrow">Error</p><h1>This page could not load.</h1><div class="notice notice-error">${safe(error?.message || "Unknown application error")}</div><div class="hero-actions">${buttonLink("#/", "Home", true)}</div></section>`;
  }
  root?.focus();
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadFirebase();
    Auth.onAuthStateChanged(auth, async (user) => {
      authUser = user;
      authReady = true;
      await refreshAccount();
      await render();
    });
  } catch (error) {
    authReady = true;
    root.innerHTML = `<section class="hero"><p class="eyebrow">Startup Error</p><h1>Cognitus could not start.</h1><div class="notice notice-error">${safe(error?.message || "Firebase initialization failed.")}</div></section>`;
  }
});
