import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

let auth = null;
let db = null;
let Auth = null;
let Fire = null;
let authUser = null;
let currentUserDoc = null;
let currentProfileDoc = null;
let enhancementTimers = [];

const root = () => document.querySelector("#page-root");
const route = () => location.hash.replace(/^#/, "").split("?")[0] || "/";
const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function createCognitusId(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(7);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
  return `${prefix}-${String(new Date().getFullYear()).slice(-2)}-${random}`;
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

function isOwner() {
  return currentUserDoc?.status === "active" && currentUserDoc?.role === "owner";
}

let toastRegion = null;
function toast(message, tone = "neutral") {
  if (!toastRegion) {
    toastRegion = document.createElement("div");
    toastRegion.className = "v4-toast-region";
    toastRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRegion);
  }
  const node = document.createElement("div");
  node.className = `v4-toast${tone === "error" ? " is-error" : tone === "success" ? " is-success" : ""}`;
  node.textContent = message;
  toastRegion.appendChild(node);
  window.setTimeout(() => node.remove(), 4200);
}

let modal = null;
function ensureModal() {
  if (modal) return;
  modal = document.createElement("div");
  modal.className = "v4-modal-backdrop";
  modal.hidden = true;
  modal.innerHTML = `
    <section class="v4-modal" role="dialog" aria-modal="true" aria-labelledby="v4-modal-title">
      <h2 id="v4-modal-title"></h2>
      <p id="v4-modal-message"></p>
      <div class="v4-modal-actions">
        <button class="button button-light" data-v4-cancel type="button">Cancel</button>
        <button class="button v4-danger-button" data-v4-confirm type="button">Confirm</button>
      </div>
    </section>`;
  document.body.appendChild(modal);
}
function confirmAction(title, message, confirmLabel = "Confirm") {
  ensureModal();
  modal.querySelector("#v4-modal-title").textContent = title;
  modal.querySelector("#v4-modal-message").textContent = message;
  const confirm = modal.querySelector("[data-v4-confirm]");
  const cancel = modal.querySelector("[data-v4-cancel]");
  confirm.textContent = confirmLabel;
  modal.hidden = false;
  confirm.focus();
  return new Promise((resolve) => {
    const finish = (value) => {
      modal.hidden = true;
      confirm.removeEventListener("click", yes);
      cancel.removeEventListener("click", no);
      document.removeEventListener("keydown", keydown);
      resolve(value);
    };
    const yes = () => finish(true);
    const no = () => finish(false);
    const keydown = (event) => { if (event.key === "Escape") finish(false); };
    confirm.addEventListener("click", yes);
    cancel.addEventListener("click", no);
    document.addEventListener("keydown", keydown);
  });
}

async function readDoc(collectionName, id) {
  if (!id) return null;
  const snap = await Fire.getDoc(Fire.doc(db, collectionName, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}
async function readWhere(collectionName, field, op, value) {
  const snap = await Fire.getDocs(Fire.query(Fire.collection(db, collectionName), Fire.where(field, op, value)));
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function readAll(collectionName) {
  const snap = await Fire.getDocs(Fire.collection(db, collectionName));
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}
async function refreshSelf() {
  if (!authUser) {
    currentUserDoc = null;
    currentProfileDoc = null;
    return;
  }
  [currentUserDoc, currentProfileDoc] = await Promise.all([
    readDoc("users", authUser.uid),
    readDoc("profiles", authUser.uid)
  ]);
}

async function writeAudit(action, targetType, targetId, summary, metadata = {}) {
  if (!authUser || !currentUserDoc?.cognitusId || currentUserDoc.status !== "active") return;
  try {
    const ref = Fire.doc(Fire.collection(db, "auditLogs"));
    await Fire.setDoc(ref, {
      id: ref.id,
      cognitusId: createCognitusId("AUD"),
      actorUid: authUser.uid,
      actorCognitusId: currentUserDoc.cognitusId,
      actorRole: currentUserDoc.role,
      action,
      targetType,
      targetId: targetId || null,
      summary: clean(summary).slice(0, 500),
      metadata,
      createdAt: Fire.serverTimestamp()
    });
  } catch (error) {
    console.warn("V4 audit write failed", error);
  }
}

async function verifyUser(uid) {
  if (!isOwner()) throw new Error("Owner access is required to verify identities.");
  const target = await readDoc("users", uid);
  const profile = await readDoc("profiles", uid);
  if (!target || !profile) throw new Error("The user or profile record could not be found.");
  const batch = Fire.writeBatch(db);
  batch.update(Fire.doc(db, "users", uid), {
    identityVerified: true,
    updatedAt: Fire.serverTimestamp()
  });
  batch.update(Fire.doc(db, "profiles", uid), {
    claimedByUid: uid,
    identityStatus: "verified",
    identityConfidence: 100,
    lastReviewedAt: Fire.serverTimestamp(),
    updatedAt: Fire.serverTimestamp()
  });
  await writeAudit("IDENTITY_VERIFIED", "user", uid, `Verified identity for ${target.displayName || target.cognitusId || uid}.`);
  await batch.commit();
  if (uid === authUser.uid) await refreshSelf();
}

async function deleteReport(reportId) {
  const report = await readDoc("reports", reportId);
  if (!report) return;
  const allowed = isOwner() || (report.submittedByUid === authUser?.uid && report.status === "pending_review");
  if (!allowed) throw new Error("You do not have permission to delete this report.");
  await writeAudit("REPORT_DELETED", "report", reportId, `Deleted report ${report.cognitusId || reportId}.`, {
    previousStatus: report.status || "unknown"
  });
  await Fire.deleteDoc(Fire.doc(db, "reports", reportId));
}

async function commitOps(ops) {
  const chunks = [];
  for (let i = 0; i < ops.length; i += 350) chunks.push(ops.slice(i, i + 350));
  for (const chunk of chunks) {
    const batch = Fire.writeBatch(db);
    for (const op of chunk) {
      if (op.type === "delete") batch.delete(op.ref);
      else if (op.type === "update") batch.update(op.ref, op.data);
    }
    await batch.commit();
  }
}

async function deleteOrganization(orgId) {
  if (!isOwner()) throw new Error("Owner access is required to delete organizations.");
  const org = await readDoc("organizations", orgId);
  if (!org) return;
  const [members, reports] = await Promise.all([
    readWhere("users", "organizationId", "==", orgId),
    readWhere("reports", "subjectOrganizationId", "==", orgId)
  ]);
  await writeAudit("ORGANIZATION_DELETED", "organization", orgId, `Deleted organization ${org.name || org.cognitusId || orgId}.`, {
    detachedMembers: members.length,
    deletedReports: reports.length
  });
  const ops = [];
  for (const member of members) {
    ops.push({
      type: "update",
      ref: Fire.doc(db, "users", member.id),
      data: { organizationId: null, updatedAt: Fire.serverTimestamp() }
    });
  }
  for (const report of reports) ops.push({ type: "delete", ref: Fire.doc(db, "reports", report.id) });
  ops.push({ type: "delete", ref: Fire.doc(db, "organizations", orgId) });
  await commitOps(ops);
  if (members.some((member) => member.id === authUser.uid)) await refreshSelf();
}

async function deletePortalAccount(uid) {
  if (!isOwner()) throw new Error("Owner access is required to remove another portal account.");
  if (uid === authUser.uid) throw new Error("Use Settings → Delete My Account to delete your own account.");
  const target = await readDoc("users", uid);
  if (!target) return;
  if (target.role === "owner") throw new Error("Owner accounts cannot be removed from the Admin table. Transfer or remove Owner access first.");
  await writeAudit("PORTAL_ACCOUNT_DELETED", "user", uid, `Removed portal account data for ${target.displayName || target.cognitusId || uid}.`, {
    firebaseAuthDeletionRequired: true
  });
  const batch = Fire.writeBatch(db);
  batch.delete(Fire.doc(db, "profiles", uid));
  batch.delete(Fire.doc(db, "users", uid));
  await batch.commit();
}

function reportRow(report, allowDelete) {
  const subject = report.subjectProfileId || report.subjectOrganizationId || "No subject";
  return `<article class="record-row" data-v4-report-row="${escapeHtml(report.id)}">
    <div>
      <strong>${escapeHtml(report.summary || report.category || report.cognitusId || report.id)}</strong>
      <span>${escapeHtml(report.category || "Report")} · ${escapeHtml(report.severity || "Informational")} · ${escapeHtml(report.status || "unknown")}</span>
      <small>${escapeHtml(subject)} · ${escapeHtml(formatTimestamp(report.createdAt))}</small>
    </div>
    ${allowDelete ? `<div class="mini-actions"><button class="button v4-danger-button" type="button" data-v4-delete-report="${escapeHtml(report.id)}">Delete</button></div>` : ""}
  </article>`;
}

async function mountMyReports() {
  if (route() !== "/reports/submit" || !authUser) return;
  const page = root();
  if (!page || page.querySelector("[data-v4-my-reports]")) return;
  const panel = document.createElement("section");
  panel.className = "panel v4-reports-panel";
  panel.dataset.v4MyReports = "true";
  panel.innerHTML = `<div class="panel-header"><div><p class="eyebrow">Manage</p><h2>My submitted reports</h2></div></div><div data-v4-my-reports-list class="empty-state">Loading your reports…</div>`;
  page.appendChild(panel);
  try {
    const reports = (await readWhere("reports", "submittedByUid", "==", authUser.uid))
      .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt));
    const list = panel.querySelector("[data-v4-my-reports-list]");
    list.className = "record-list";
    list.innerHTML = reports.length
      ? reports.map((report) => reportRow(report, isOwner() || report.status === "pending_review")).join("")
      : `<div class="empty-state">You have not submitted any reports.</div>`;
    panel.querySelectorAll("[data-v4-delete-report]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.dataset.v4DeleteReport;
      if (!await confirmAction("Delete report?", "This permanently removes the Firestore report record. This action cannot be undone.", "Delete report")) return;
      button.disabled = true;
      try {
        await deleteReport(id);
        panel.querySelector(`[data-v4-report-row="${CSS.escape(id)}"]`)?.remove();
        toast("Report deleted.", "success");
      } catch (error) {
        toast(error?.message || "Report deletion failed.", "error");
        button.disabled = false;
      }
    }));
  } catch (error) {
    panel.querySelector("[data-v4-my-reports-list]").textContent = error?.message || "Reports could not be loaded.";
  }
}

function appendAdminActionHeader(table) {
  const head = table?.querySelector("thead tr");
  if (!head || head.querySelector("[data-v4-actions-head]")) return;
  const th = document.createElement("th");
  th.dataset.v4ActionsHead = "true";
  th.textContent = "Actions";
  head.appendChild(th);
}

async function augmentAdminUsers(panel) {
  const table = panel?.querySelector("table");
  if (!table || table.dataset.v4Augmented) return;
  table.dataset.v4Augmented = "true";
  appendAdminActionHeader(table);
  const users = await readAll("users");
  const byId = new Map(users.map((user) => [user.id, user]));
  table.querySelectorAll("tbody tr").forEach((row) => {
    const roleSelect = row.querySelector("[data-user-role]");
    if (!roleSelect) return;
    const uid = roleSelect.dataset.userRole;
    const user = byId.get(uid);
    const td = document.createElement("td");
    td.className = "v4-admin-action-cell";
    const actions = document.createElement("div");
    actions.className = "v4-action-row";
    if (user && !user.identityVerified) {
      const verify = document.createElement("button");
      verify.type = "button";
      verify.className = "button button-light";
      verify.textContent = "Verify";
      verify.addEventListener("click", async () => {
        verify.disabled = true;
        try {
          await verifyUser(uid);
          verify.remove();
          toast(`${user.displayName || "User"} verified.`, "success");
        } catch (error) {
          toast(error?.message || "Verification failed.", "error");
          verify.disabled = false;
        }
      });
      actions.appendChild(verify);
    }
    if (user && uid !== authUser.uid && user.role !== "owner") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button v4-danger-button";
      remove.textContent = "Delete portal account";
      remove.addEventListener("click", async () => {
        if (!await confirmAction("Delete portal account?", `This removes ${user.displayName || "this user"}'s Cognitus user/profile records and immediately removes portal access. Their Firebase Authentication credential must still be removed in Firebase Console for a total Auth purge.`, "Delete portal data")) return;
        remove.disabled = true;
        try {
          await deletePortalAccount(uid);
          row.remove();
          toast("Portal account data deleted.", "success");
        } catch (error) {
          toast(error?.message || "Account deletion failed.", "error");
          remove.disabled = false;
        }
      });
      actions.appendChild(remove);
    }
    if (!actions.children.length) td.innerHTML = `<span class="v4-badge ${user?.identityVerified ? "is-verified" : ""}">${user?.identityVerified ? "Verified" : "Protected"}</span>`;
    else td.appendChild(actions);
    row.appendChild(td);
  });
}

async function augmentAdminOrganizations(panel) {
  const table = panel?.querySelector("table");
  if (!table || table.dataset.v4Augmented) return;
  table.dataset.v4Augmented = "true";
  appendAdminActionHeader(table);
  table.querySelectorAll("tbody tr").forEach((row) => {
    const verification = row.querySelector("[data-org-verification]");
    if (!verification) return;
    const orgId = verification.dataset.orgVerification;
    const td = document.createElement("td");
    td.className = "v4-admin-action-cell";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button v4-danger-button";
    button.textContent = "Delete organization";
    button.addEventListener("click", async () => {
      if (!await confirmAction("Delete organization?", "This permanently deletes the organization, detaches its members, and deletes reports whose subject is this organization. Check history remains as historical evidence.", "Delete organization")) return;
      button.disabled = true;
      try {
        await deleteOrganization(orgId);
        row.remove();
        toast("Organization deleted.", "success");
      } catch (error) {
        toast(error?.message || "Organization deletion failed.", "error");
        button.disabled = false;
      }
    });
    td.appendChild(button);
    row.appendChild(td);
  });
}

async function loadAdminReports(panel) {
  if (panel.dataset.v4Loaded) return;
  panel.dataset.v4Loaded = "true";
  panel.innerHTML = `<div class="panel-header"><div><p class="eyebrow">Reports</p><h2>Report management</h2></div></div><p class="v4-admin-note">Owner controls: reports can be permanently removed here. This is a destructive action and is recorded in the activity log before deletion.</p><div data-v4-admin-report-list class="empty-state">Loading reports…</div>`;
  try {
    const reports = (await readAll("reports")).sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt)).slice(0, 200);
    const list = panel.querySelector("[data-v4-admin-report-list]");
    list.className = "record-list";
    list.innerHTML = reports.length ? reports.map((report) => reportRow(report, true)).join("") : `<div class="empty-state">No reports found.</div>`;
    panel.querySelectorAll("[data-v4-delete-report]").forEach((button) => button.addEventListener("click", async () => {
      const id = button.dataset.v4DeleteReport;
      if (!await confirmAction("Delete report?", "This permanently removes the report record. This action cannot be undone.", "Delete report")) return;
      button.disabled = true;
      try {
        await deleteReport(id);
        panel.querySelector(`[data-v4-report-row="${CSS.escape(id)}"]`)?.remove();
        toast("Report deleted.", "success");
      } catch (error) {
        toast(error?.message || "Report deletion failed.", "error");
        button.disabled = false;
      }
    }));
  } catch (error) {
    panel.querySelector("[data-v4-admin-report-list]").textContent = error?.message || "Reports could not be loaded.";
  }
}

async function mountAdminControls() {
  if (route() !== "/admin" || !isOwner()) return;
  const page = root();
  const tabs = page?.querySelector(".admin-tabs");
  const usersPanel = page?.querySelector("#admin-users");
  const orgPanel = page?.querySelector("#admin-orgs");
  const activityPanel = page?.querySelector("#admin-activity");
  if (!tabs || !usersPanel || !orgPanel || !activityPanel || tabs.dataset.v4Mounted) return;
  tabs.dataset.v4Mounted = "true";

  await Promise.all([augmentAdminUsers(usersPanel), augmentAdminOrganizations(orgPanel)]);

  const reportsButton = document.createElement("button");
  reportsButton.type = "button";
  reportsButton.className = "button button-light";
  reportsButton.textContent = "Reports";
  reportsButton.dataset.v4ReportsTab = "true";
  tabs.appendChild(reportsButton);

  const reportsPanel = document.createElement("section");
  reportsPanel.id = "admin-reports-v4";
  reportsPanel.className = "panel v4-reports-panel";
  reportsPanel.hidden = true;
  activityPanel.insertAdjacentElement("afterend", reportsPanel);

  const baseButtons = [...tabs.querySelectorAll("[data-tab]")];
  baseButtons.forEach((button) => button.addEventListener("click", () => { reportsPanel.hidden = true; }));
  reportsButton.addEventListener("click", async () => {
    usersPanel.hidden = true;
    orgPanel.hidden = true;
    activityPanel.hidden = true;
    reportsPanel.hidden = false;
    tabs.querySelectorAll("button").forEach((button) => button.className = `button ${button === reportsButton ? "button-dark" : "button-light"}`);
    await loadAdminReports(reportsPanel);
  });
}

async function mountOrganizationCardDeletes() {
  if (route() !== "/organizations" || !isOwner()) return;
  const page = root();
  if (!page) return;
  page.querySelectorAll(".result-card").forEach((card) => {
    if (card.dataset.v4DeleteMounted) return;
    const submitLink = card.querySelector('a[href*="#/reports/submit?targetType=organization"]');
    if (!submitLink) return;
    const query = submitLink.getAttribute("href")?.split("?")[1] || "";
    const orgId = new URLSearchParams(query).get("target");
    if (!orgId) return;
    card.dataset.v4DeleteMounted = "true";
    const actions = card.querySelector(".hero-actions") || card;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button v4-danger-button";
    button.textContent = "Delete";
    button.addEventListener("click", async () => {
      if (!await confirmAction("Delete organization?", "This permanently deletes the organization, detaches members, and removes reports about the organization.", "Delete organization")) return;
      button.disabled = true;
      try {
        await deleteOrganization(orgId);
        card.remove();
        toast("Organization deleted.", "success");
      } catch (error) {
        toast(error?.message || "Organization deletion failed.", "error");
        button.disabled = false;
      }
    });
    actions.appendChild(button);
  });
}

async function mountSettingsControls() {
  if (route() !== "/settings" || !authUser || !currentUserDoc) return;
  const page = root();
  if (!page || page.querySelector("[data-v4-settings-controls]")) return;
  const container = document.createElement("section");
  container.dataset.v4SettingsControls = "true";
  container.className = "dashboard-grid";

  const verified = Boolean(currentUserDoc.identityVerified && currentProfileDoc?.identityStatus === "verified");
  const identityCard = document.createElement("section");
  identityCard.className = "form-card";
  identityCard.innerHTML = `
    <p class="eyebrow">Identity</p>
    <h2>Verification</h2>
    <p>Your Cognitus identity status controls whether your profile is treated as self-declared or verified.</p>
    <div class="v4-action-row">
      <span class="v4-badge ${verified ? "is-verified" : "is-pending"}">${verified ? "Verified" : escapeHtml(currentProfileDoc?.identityStatus || "self_declared")}</span>
      ${isOwner() && !verified ? `<button class="button v4-primary-button" type="button" data-v4-verify-self>Verify my identity</button>` : ""}
    </div>
    ${!isOwner() && !verified ? `<p><small>Verification is performed by an authorized Cognitus reviewer or Owner. Users cannot simply mark themselves verified.</small></p>` : ""}`;

  identityCard.querySelector("[data-v4-verify-self]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!await confirmAction("Verify your identity?", "As the Cognitus Owner, this will mark your portal identity verified with 100% confidence. This is an administrative verification action and will be logged.", "Verify me")) return;
    button.disabled = true;
    try {
      await verifyUser(authUser.uid);
      identityCard.querySelector(".v4-badge").textContent = "Verified";
      identityCard.querySelector(".v4-badge").className = "v4-badge is-verified";
      button.remove();
      toast("Your identity is now verified.", "success");
    } catch (error) {
      toast(error?.message || "Verification failed.", "error");
      button.disabled = false;
    }
  });

  const danger = document.createElement("section");
  danger.className = "form-card v4-danger-zone";
  danger.innerHTML = `
    <p class="eyebrow">Danger Zone</p>
    <h2>Delete my account</h2>
    <p>This permanently removes your Cognitus user/profile records and then deletes your Firebase Authentication login. You must enter your current password and type <strong>DELETE</strong>.</p>
    <form data-v4-delete-self class="form-stack">
      <label>Current Password<input name="password" type="password" autocomplete="current-password" required></label>
      <label>Type DELETE<input name="confirmation" autocomplete="off" required></label>
      <button class="button v4-danger-button" type="submit">Delete My Account</button>
    </form>`;

  danger.querySelector("[data-v4-delete-self]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector("button[type=submit]");
    if (clean(data.confirmation).toUpperCase() !== "DELETE") return toast("Type DELETE exactly to continue.", "error");
    if (currentUserDoc.role === "owner") {
      try {
        const owners = await readWhere("users", "role", "==", "owner");
        if (owners.length <= 1) return toast("You cannot delete the last Owner account. Assign another Owner first.", "error");
      } catch (error) {
        return toast(error?.message || "Could not verify Owner count.", "error");
      }
    }
    if (!await confirmAction("Permanently delete your account?", "This cannot be undone. Your Cognitus profile and login will be removed.", "Delete my account")) return;
    button.disabled = true;
    try {
      const credential = Auth.EmailAuthProvider.credential(auth.currentUser.email, data.password);
      await Auth.reauthenticateWithCredential(auth.currentUser, credential);
      await writeAudit("SELF_ACCOUNT_DELETED", "user", authUser.uid, "User deleted their Cognitus account.");
      const batch = Fire.writeBatch(db);
      batch.delete(Fire.doc(db, "profiles", authUser.uid));
      batch.delete(Fire.doc(db, "users", authUser.uid));
      await batch.commit();
      await Auth.deleteUser(auth.currentUser);
      location.hash = "#/";
    } catch (error) {
      toast(error?.code === "auth/invalid-credential" ? "Current password is incorrect." : (error?.message || "Account deletion failed."), "error");
      button.disabled = false;
    }
  });

  container.append(identityCard, danger);
  page.appendChild(container);
}

async function enhanceCurrentPage() {
  if (!authUser || !currentUserDoc) return;
  try {
    await Promise.all([
      mountSettingsControls(),
      mountAdminControls(),
      mountMyReports(),
      mountOrganizationCardDeletes()
    ]);
  } catch (error) {
    console.warn("Cognitus V4 page enhancement failed", error);
  }
}

function scheduleEnhancement() {
  enhancementTimers.forEach((timer) => clearTimeout(timer));
  enhancementTimers = [0, 100, 300, 700, 1300].map((delay) => setTimeout(enhanceCurrentPage, delay));
}

async function initialize() {
  const services = await initializeFirebaseServices();
  if (!services.ready) return;
  auth = services.auth;
  db = services.db;
  [Auth, Fire] = await Promise.all([
    import(`${FIREBASE_CDN_BASE}/firebase-auth.js`),
    import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`)
  ]);
  ensureModal();
  Auth.onAuthStateChanged(auth, async (user) => {
    authUser = user;
    await refreshSelf();
    scheduleEnhancement();
  });
  window.addEventListener("hashchange", scheduleEnhancement);
  window.addEventListener("DOMContentLoaded", scheduleEnhancement);
  scheduleEnhancement();
}

initialize().catch((error) => console.warn("Cognitus V4 controls failed to initialize", error));
