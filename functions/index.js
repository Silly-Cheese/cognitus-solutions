"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const crypto = require("node:crypto");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const { Timestamp, FieldValue } = admin.firestore;
const options = { region: "us-central1", maxInstances: 10, memory: "256MiB" };
const REF = "referenceRequests";
const MAX_DAYS = 21;

function fail(message, code = "invalid-argument") { throw new HttpsError(code, message); }
function field(input, name, max = 140, required = false) {
  const value = typeof input === "string" ? input.trim() : "";
  if ((required && !value) || value.length > max) fail(`Invalid ${name}.`);
  return value;
}
function identifier(value, name) {
  const id = field(value, name, 128, true);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) fail(`Invalid ${name}.`);
  return id;
}
function dateValue(value) {
  if (value == null || value === "") return null;
  const text = field(value, "date", 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || new Date(text + "T00:00:00Z").toISOString().slice(0, 10) !== text) fail("Invalid date.");
  return text;
}
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
async function active(uid) {
  if (!uid) fail("Sign in to continue.", "unauthenticated");
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.data().status !== "active") fail("Your account cannot perform this action.", "permission-denied");
  return snap.data();
}
async function employer(uid, orgId) {
  const account = await active(uid);
  const [organization, membership] = await Promise.all([
    db.doc(`organizations/${orgId}`).get(),
    db.doc(`organizationMembers/${orgId}__${uid}`).get()
  ]);
  if (!organization.exists || organization.data().verificationStatus !== "verified") fail("Organization must be verified.", "failed-precondition");
  const member = membership.data();
  const explicitMembership = member && member.memberStatus === "active" && member.userUid === uid
    && member.organizationId === orgId && (member.permissions?.addEmploymentRecords === true || member.permissions?.manageTalent === true);
  const legacyOrgAdmin = account.role === "org_admin" && account.organizationId === orgId;
  if (!explicitMembership && !legacyOrgAdmin) {
    fail("You are not an authorized reference representative for this organization.", "permission-denied");
  }
  return { account, organization: organization.data() };
}
function requireAuth(request) { if (!request.auth?.uid) fail("Sign in to continue.", "unauthenticated"); return request.auth.uid; }
function publicRequest(id, data, employerView = false) {
  return {
    id, organizationId: data.organizationId, organizationName: data.organizationName,
    requesterUid: employerView ? undefined : data.requesterUid,
    requesterDisplayName: data.requesterDisplayName,
    requestedPosition: data.requestedPosition,
    startedOn: data.startedOn || null, endedOn: data.endedOn || null,
    status: data.status, createdAt: data.createdAt?.toMillis?.() || null,
    expiresAt: data.expiresAt?.toMillis?.() || null,
    respondedAt: data.respondedAt?.toMillis?.() || null,
    response: employerView ? undefined : data.response || null
  };
}
function audit(transaction, event, requestId, uid) {
  transaction.set(db.collection("referenceAuditEvents").doc(), {
    event, requestId, actorUid: uid, createdAt: FieldValue.serverTimestamp()
  });
}
function notice(transaction, uid, requestId, type) {
  transaction.set(db.collection("referenceNotifications").doc(uid).collection("items").doc(), {
    requestId, type, read: false, createdAt: FieldValue.serverTimestamp()
  });
}

exports.createReferenceRequest = onCall(options, async (request) => {
  const uid = requireAuth(request);
  const user = await active(uid);
  const organizationId = identifier(request.data?.organizationId, "organization");
  const requestedPosition = field(request.data?.requestedPosition, "position", 120, true);
  const startedOn = dateValue(request.data?.startedOn);
  const endedOn = dateValue(request.data?.endedOn);
  if (startedOn && endedOn && startedOn > endedOn) fail("End date cannot precede start date.");
  if (request.data?.consent !== true) fail("You must consent to requesting a reference.");
  const [orgSnap, memberSnapshot] = await Promise.all([
    db.doc(`organizations/${organizationId}`).get(),
    db.collection("organizationMembers").where("organizationId", "==", organizationId).limit(40).get()
  ]);
  if (!orgSnap.exists || orgSnap.data().verificationStatus !== "verified") fail("Select a verified organization.", "failed-precondition");
  const employerRecipients = memberSnapshot.docs.map(doc => doc.data())
    .filter(member => member.memberStatus === "active" && member.userUid !== uid
      && (member.permissions?.addEmploymentRecords === true || member.permissions?.manageTalent === true))
    .map(member => member.userUid);
  const requesterDisplayName = field(user.displayName || user.discordUsername || "Cognitus member", "display name", 80, true);
  const reqDoc = db.collection(REF).doc();
  const lock = db.doc(`referenceRequestLocks/${hash(uid + "|" + organizationId)}`);
  const guard = db.doc(`referenceRequestRateLimits/${uid}`);
  const now = Timestamp.now();
  await db.runTransaction(async tx => {
    const [lockSnap, guardSnap] = await Promise.all([tx.get(lock), tx.get(guard)]);
    const last = guardSnap.data()?.lastRequestedAt?.toMillis?.() || 0;
    const dailyCount = guardSnap.data()?.day === new Date().toISOString().slice(0,10) ? (guardSnap.data().dailyCount || 0) : 0;
    if (Date.now() - last < 60000 || dailyCount >= 10) fail("Reference request limit reached. Try again later.", "resource-exhausted");
    if (lockSnap.exists && lockSnap.data().status === "pending" && (lockSnap.data().expiresAt?.toMillis?.() || 0) > now.toMillis()) fail("A request to this employer is already pending.", "already-exists");
    const expiresAt = Timestamp.fromMillis(now.toMillis() + MAX_DAYS * 86400000);
    tx.create(reqDoc, {
      requesterUid: uid, requesterDisplayName, organizationId,
      organizationName: String(orgSnap.data().name || "Organization").slice(0, 120),
      requestedPosition, startedOn, endedOn, status: "pending",
      consentRecordedAt: now, createdAt: now, expiresAt, respondedAt: null,
      responderUid: null, response: null, updatedAt: now
    });
    tx.set(lock, { requestId: reqDoc.id, status: "pending", expiresAt, updatedAt: now });
    tx.set(guard, { lastRequestedAt: now, day: new Date().toISOString().slice(0, 10), dailyCount: dailyCount + 1 });
    audit(tx, "REFERENCE_REQUESTED", reqDoc.id, uid);
    notice(tx, uid, reqDoc.id, "requested");
    for (const recipient of [...new Set(employerRecipients)].slice(0, 30)) notice(tx, recipient, reqDoc.id, "employer_request");
  });
  return { id: reqDoc.id, status: "pending" };
});

exports.listReferenceRequests = onCall(options, async (request) => {
  const uid = requireAuth(request);
  await active(uid);
  const mode = request.data?.mode === "employer" ? "employer" : "mine";
  let snap;
  if (mode === "employer") {
    const orgId = identifier(request.data?.organizationId, "organization");
    await employer(uid, orgId);
    snap = await db.collection(REF).where("organizationId", "==", orgId).limit(100).get();
  } else {
    snap = await db.collection(REF).where("requesterUid", "==", uid).limit(100).get();
  }
  return { items: snap.docs.map(doc => publicRequest(doc.id, doc.data(), mode === "employer"))
    .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)) };
});

exports.respondToReferenceRequest = onCall(options, async (request) => {
  const uid = requireAuth(request);
  const id = identifier(request.data?.requestId, "request");
  const ref = db.doc(`${REF}/${id}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) fail("Reference request not found.", "not-found");
  const current = snapshot.data();
  await employer(uid, current.organizationId);
  if (uid === current.requesterUid) fail("You cannot provide your own reference.", "permission-denied");
  const decision = request.data?.decision;
  if (!["complete", "decline"].includes(decision)) fail("Invalid decision.");
  const position = field(request.data?.position, "position", 120, decision === "complete");
  const comments = field(request.data?.comments, "comments", 1000);
  const verifiedEmployment = decision === "complete" ? request.data?.verifiedEmployment : null;
  if (decision === "complete" && typeof verifiedEmployment !== "boolean") fail("Confirm whether the employment record can be verified.");
  const response = decision === "complete" ? { verifiedEmployment, position, comments, responderOrganizationId: current.organizationId } : null;
  const now = Timestamp.now();
  await db.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (!fresh.exists || fresh.data().status !== "pending" || fresh.data().expiresAt.toMillis() < now.toMillis()) fail("This request is no longer open.", "failed-precondition");
    tx.update(ref, { status: decision === "complete" ? "completed" : "declined", response, respondedAt: now, responderUid: uid, updatedAt: now });
    audit(tx, decision === "complete" ? "REFERENCE_COMPLETED" : "REFERENCE_DECLINED", id, uid);
    notice(tx, fresh.data().requesterUid, id, decision === "complete" ? "completed" : "declined");
    tx.set(db.doc(`referenceRequestLocks/${hash(fresh.data().requesterUid + "|" + current.organizationId)}`), {
      requestId: id, status: decision === "complete" ? "completed" : "declined", updatedAt: now
    });
  });
  return { ok: true };
});

exports.withdrawReferenceRequest = onCall(options, async (request) => {
  const uid = requireAuth(request);
  await active(uid);
  const id = identifier(request.data?.requestId, "request");
  const ref = db.doc(`${REF}/${id}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().requesterUid !== uid) fail("Request not found.", "not-found");
    if (snap.data().status !== "pending") fail("Only pending requests can be withdrawn.", "failed-precondition");
    tx.update(ref, { status: "withdrawn", updatedAt: Timestamp.now() });
    tx.set(db.doc(`referenceRequestLocks/${hash(uid + "|" + snap.data().organizationId)}`), {
      requestId: id, status: "withdrawn", updatedAt: Timestamp.now()
    });
    audit(tx, "REFERENCE_WITHDRAWN", id, uid);
  });
  return { ok: true };
});

exports.createReferenceShare = onCall(options, async (request) => {
  const uid = requireAuth(request);
  await active(uid);
  const id = identifier(request.data?.requestId, "request");
  const snap = await db.doc(`${REF}/${id}`).get();
  if (!snap.exists || snap.data().requesterUid !== uid || snap.data().status !== "completed") fail("Only completed references may be shared.", "failed-precondition");
  const token = crypto.randomBytes(32).toString("base64url");
  const shareId = crypto.randomBytes(12).toString("hex");
  const expiresAt = Timestamp.fromMillis(Date.now() + 7 * 86400000);
  const batch = db.batch();
  batch.create(db.doc(`referenceShares/${shareId}`), {
    referenceRequestId: id, ownerUid: uid, tokenHash: hash(token),
    includeComments: request.data?.includeComments === true, createdAt: Timestamp.now(),
    expiresAt, revokedAt: null
  });
  audit(batch, "REFERENCE_SHARE_CREATED", id, uid);
  await batch.commit();
  return { shareId, token, expiresAt: expiresAt.toMillis() };
});

exports.listReferenceShares = onCall(options, async (request) => {
  const uid = requireAuth(request);
  await active(uid);
  const snap = await db.collection("referenceShares").where("ownerUid", "==", uid).limit(100).get();
  return { items: snap.docs.map(doc => ({
    id: doc.id, referenceRequestId: doc.data().referenceRequestId,
    createdAt: doc.data().createdAt?.toMillis?.() || null,
    expiresAt: doc.data().expiresAt?.toMillis?.() || null,
    revokedAt: doc.data().revokedAt?.toMillis?.() || null
  })).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)) };
});

exports.revokeReferenceShare = onCall(options, async (request) => {
  const uid = requireAuth(request);
  await active(uid);
  const shareId = identifier(request.data?.shareId, "share");
  const doc = db.doc(`referenceShares/${shareId}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(doc);
    if (!snap.exists || snap.data().ownerUid !== uid) fail("Share not found.", "not-found");
    tx.update(doc, { revokedAt: Timestamp.now() });
    audit(tx, "REFERENCE_SHARE_REVOKED", snap.data().referenceRequestId, uid);
  });
  return { ok: true };
});

exports.viewSharedReference = onCall(options, async (request) => {
  const shareId = identifier(request.data?.shareId, "share");
  const token = field(request.data?.token, "token", 90, true);
  const doc = await db.doc(`referenceShares/${shareId}`).get();
  if (!doc.exists) fail("This share is unavailable.", "not-found");
  const data = doc.data();
  const supplied = Buffer.from(hash(token), "hex");
  const expected = Buffer.from(data.tokenHash, "hex");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)
      || data.revokedAt || data.expiresAt.toMillis() < Date.now()) fail("This share is unavailable.", "not-found");
  const ref = await db.doc(`${REF}/${data.referenceRequestId}`).get();
  if (!ref.exists || ref.data().status !== "completed" || ref.data().requesterUid !== data.ownerUid) fail("This share is unavailable.", "not-found");
  const record = ref.data();
  return { reference: {
    requesterDisplayName: record.requesterDisplayName,
    organizationName: record.organizationName,
    requestedPosition: record.requestedPosition,
    confirmedPosition: record.response?.position || "",
    verifiedEmployment: record.response?.verifiedEmployment === true,
    comments: data.includeComments ? record.response?.comments || "" : undefined,
    respondedAt: record.respondedAt?.toMillis?.() || null,
    expiresAt: data.expiresAt?.toMillis?.() || null
  }};
});

exports.expireReferenceRequests = onSchedule({ schedule: "every day 03:00", timeZone: "Etc/UTC", region: "us-central1", maxInstances: 1 }, async () => {
  const now = Timestamp.now();
  const snap = await db.collection(REF).where("status", "==", "pending").limit(500).get();
  for (const item of snap.docs) {
    if (item.data().expiresAt.toMillis() > now.toMillis()) continue;
    await db.runTransaction(async tx => {
      const fresh = await tx.get(item.ref);
      if (!fresh.exists || fresh.data().status !== "pending" || fresh.data().expiresAt.toMillis() > now.toMillis()) return;
      tx.update(item.ref, { status: "expired", updatedAt: now });
      const owner = fresh.data().requesterUid;
      tx.set(db.doc(`referenceRequestLocks/${hash(owner + "|" + fresh.data().organizationId)}`), {
        requestId: item.id, status: "expired", updatedAt: now
      });
      audit(tx, "REFERENCE_EXPIRED", item.id, "system");
      notice(tx, owner, item.id, "expired");
    });
  }
});
