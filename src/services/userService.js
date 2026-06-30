import { COLLECTIONS } from "../firebase/collections.js";
import { getDocument, updateDocument, queryDocuments, getFirestoreModules } from "./firestoreCore.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export async function getUser(uid) {
  return getDocument(COLLECTIONS.users, uid);
}

export async function updateUser(uid, data, actor = null) {
  await updateDocument(COLLECTIONS.users, uid, data);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.recordUpdated,
    targetType: "user",
    targetId: uid,
    summary: "Updated user record.",
    newValue: data
  });
  return uid;
}

export async function findUserByDiscordId(discordId) {
  const { firestore } = await getFirestoreModules();
  const results = await queryDocuments(COLLECTIONS.users, [
    firestore.where("discordId", "==", String(discordId || "")),
    firestore.limit(1)
  ]);
  return results[0] || null;
}

export async function listUsersByRole(role, limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  return queryDocuments(COLLECTIONS.users, [
    firestore.where("role", "==", role),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}
