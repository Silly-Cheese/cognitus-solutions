import { COLLECTIONS } from "../firebase/collections.js";
import { CHECK_REASONS } from "../data/constants.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeInput } from "../utils/validation.js";
import { createDocument, getDocument, queryDocuments, getFirestoreModules } from "./firestoreCore.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export async function createCheckLog({
  actor,
  searchType,
  searchField,
  searchQuery,
  reason,
  additionalNotes = "",
  targetProfileId = null,
  targetOrganizationId = null,
  resultSummary = ""
}) {
  if (!actor?.uid) throw new Error("A logged-in user is required to run checks.");
  if (!CHECK_REASONS.includes(reason)) throw new Error("A valid check reason is required.");
  if (!normalizeInput(searchQuery)) throw new Error("Search query is required.");

  const check = {
    cognitusId: createIdForEntity("check"),
    checkedByUid: actor.uid,
    checkedByCognitusId: actor.cognitusId || null,
    checkedByDiscordId: actor.discordId || null,
    organizationId: actor.organizationId || null,
    searchType,
    searchField,
    searchQuery: normalizeInput(searchQuery),
    reason,
    additionalNotes: normalizeInput(additionalNotes),
    targetProfileId,
    targetOrganizationId,
    resultSummary,
    downloadedReport: false
  };

  const id = await createDocument(COLLECTIONS.checkLogs, check);
  await writeAuditLog({
    actorUid: actor.uid,
    actorCognitusId: actor.cognitusId || null,
    actorRole: actor.role || null,
    action: AUDIT_ACTIONS.checkCreated,
    targetType: "check",
    targetId: id,
    targetCognitusId: check.cognitusId,
    summary: `Ran ${searchType} check for ${check.searchQuery}.`,
    metadata: { reason, searchField }
  });
  return id;
}

export async function getCheckLog(checkId) {
  return getDocument(COLLECTIONS.checkLogs, checkId);
}

export async function listChecksByUser(uid, limitCount = 25) {
  const { firestore } = await getFirestoreModules();
  return queryDocuments(COLLECTIONS.checkLogs, [
    firestore.where("checkedByUid", "==", uid),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}

export async function listChecksByOrganization(organizationId, limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  return queryDocuments(COLLECTIONS.checkLogs, [
    firestore.where("organizationId", "==", organizationId),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}
