import { COLLECTIONS } from "../firebase/collections.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeDiscordId, normalizeInput } from "../utils/validation.js";
import { createDocument, getDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export const PASSWORD_RESET_STATUSES = Object.freeze({
  submitted: "submitted",
  pendingReview: "pending_review",
  approved: "approved",
  denied: "denied",
  completed: "completed",
  expired: "expired"
});

export async function submitPasswordResetRequest({ discordId, discordUsername = "", reason = "" }) {
  const cleanDiscordId = normalizeDiscordId(discordId);
  if (!cleanDiscordId) throw new Error("A valid Discord ID is required.");

  const request = {
    cognitusId: createIdForEntity("passwordReset"),
    discordId: cleanDiscordId,
    discordUsername: normalizeInput(discordUsername),
    reason: normalizeInput(reason),
    status: PASSWORD_RESET_STATUSES.pendingReview,
    reviewedByUid: null,
    decisionNotes: "",
    completedAt: null
  };

  const id = await createDocument(COLLECTIONS.passwordResetRequests, request);
  await writeAuditLog({
    action: AUDIT_ACTIONS.passwordResetRequested,
    targetType: "passwordResetRequest",
    targetId: id,
    targetCognitusId: request.cognitusId,
    summary: `Password reset requested for Discord ID ${cleanDiscordId}.`
  });
  return id;
}

export async function getPasswordResetRequest(requestId) {
  return getDocument(COLLECTIONS.passwordResetRequests, requestId);
}

export async function updatePasswordResetRequest(requestId, data, actor = null) {
  await updateDocument(COLLECTIONS.passwordResetRequests, requestId, data);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.recordUpdated,
    targetType: "passwordResetRequest",
    targetId: requestId,
    summary: "Updated password reset request.",
    newValue: data
  });
  return requestId;
}

export async function listPendingPasswordResetRequests(limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  return queryDocuments(COLLECTIONS.passwordResetRequests, [
    firestore.where("status", "==", PASSWORD_RESET_STATUSES.pendingReview),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}
