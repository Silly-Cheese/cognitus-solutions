import { COLLECTIONS } from "../firebase/collections.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeInput } from "../utils/validation.js";
import { createDocument, getDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export const CLAIM_STATUSES = Object.freeze({
  submitted: "submitted",
  pendingReview: "pending_review",
  approved: "approved",
  denied: "denied",
  cancelled: "cancelled"
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

export async function submitProfileClaim({ actor, profileId, statement = "" }) {
  if (!actor?.uid) throw new Error("A logged-in user is required to claim profiles.");
  if (!profileId) throw new Error("Profile ID is required.");

  const claim = {
    cognitusId: createIdForEntity("claim"),
    profileId,
    submittedByUid: actor.uid,
    submittedByCognitusId: actor.cognitusId || null,
    submittedDiscordId: actor.discordId || null,
    statement: normalizeInput(statement),
    verificationMethod: "discord_id_match",
    status: CLAIM_STATUSES.pendingReview,
    reviewedByUid: null,
    decisionNotes: "",
    closedAt: null
  };

  const id = await createDocument(COLLECTIONS.claims, claim);
  await writeAuditLog({
    actorUid: actor.uid,
    actorCognitusId: actor.cognitusId || null,
    actorRole: actor.role || null,
    action: AUDIT_ACTIONS.claimSubmitted,
    targetType: "claim",
    targetId: id,
    targetCognitusId: claim.cognitusId,
    summary: "Submitted a profile claim."
  });
  return id;
}

export async function getClaim(claimId) {
  return getDocument(COLLECTIONS.claims, claimId);
}

export async function updateClaimStatus(claimId, data, actor = null) {
  await updateDocument(COLLECTIONS.claims, claimId, data);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.recordUpdated,
    targetType: "claim",
    targetId: claimId,
    summary: "Updated profile claim status.",
    newValue: data
  });
  return claimId;
}

export async function listClaimsByUser(uid, limitCount = 25) {
  const { firestore } = await getFirestoreModules();
  const items = await queryDocuments(COLLECTIONS.claims, [
    firestore.where("submittedByUid", "==", uid),
    firestore.limit(100)
  ]);
  return newestFirst(items, limitCount);
}

export async function listPendingClaims(limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  const items = await queryDocuments(COLLECTIONS.claims, [
    firestore.where("status", "==", CLAIM_STATUSES.pendingReview),
    firestore.limit(100)
  ]);
  return newestFirst(items, limitCount);
}
