import { COLLECTIONS } from "../firebase/collections.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeInput } from "../utils/validation.js";
import { createDocument, getDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export const APPEAL_STATUSES = Object.freeze({
  submitted: "submitted",
  pendingReview: "pending_review",
  underReview: "under_review",
  accepted: "accepted",
  denied: "denied",
  partiallyAccepted: "partially_accepted",
  closed: "closed"
});

function newestFirst(items, limitCount) {
  return items
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, limitCount);
}

export async function submitAppeal({ actor, profileId, reportId, reason, statement }) {
  if (!actor?.uid) throw new Error("A logged-in user is required to submit appeals.");
  if (!profileId) throw new Error("Profile ID is required.");
  if (!reportId) throw new Error("Report ID is required.");
  if (!normalizeInput(reason)) throw new Error("Appeal reason is required.");
  if (!normalizeInput(statement)) throw new Error("Appeal statement is required.");

  const appeal = {
    cognitusId: createIdForEntity("appeal"),
    profileId,
    reportId,
    submittedByUid: actor.uid,
    submittedByCognitusId: actor.cognitusId || null,
    reason: normalizeInput(reason),
    statement: normalizeInput(statement),
    status: APPEAL_STATUSES.pendingReview,
    reviewedByUid: null,
    decision: null,
    decisionNotes: "",
    closedAt: null
  };

  const id = await createDocument(COLLECTIONS.appeals, appeal);
  await writeAuditLog({
    actorUid: actor.uid,
    actorCognitusId: actor.cognitusId || null,
    actorRole: actor.role || null,
    action: AUDIT_ACTIONS.appealSubmitted,
    targetType: "appeal",
    targetId: id,
    targetCognitusId: appeal.cognitusId,
    summary: "Submitted an appeal."
  });
  return id;
}

export async function getAppeal(appealId) {
  return getDocument(COLLECTIONS.appeals, appealId);
}

export async function updateAppealStatus(appealId, data, actor = null) {
  await updateDocument(COLLECTIONS.appeals, appealId, data);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.recordUpdated,
    targetType: "appeal",
    targetId: appealId,
    summary: "Updated appeal status.",
    newValue: data
  });
  return appealId;
}

export async function listAppealsByUser(uid, limitCount = 25) {
  const { firestore } = await getFirestoreModules();
  const items = await queryDocuments(COLLECTIONS.appeals, [
    firestore.where("submittedByUid", "==", uid),
    firestore.limit(100)
  ]);
  return newestFirst(items, limitCount);
}

export async function listPendingAppeals(limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  const items = await queryDocuments(COLLECTIONS.appeals, [
    firestore.where("status", "==", APPEAL_STATUSES.pendingReview),
    firestore.limit(100)
  ]);
  return newestFirst(items, limitCount);
}
