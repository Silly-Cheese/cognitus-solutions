import { COLLECTIONS } from "../firebase/collections.js";
import { createDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";
import { normalizeInput } from "../utils/validation.js";

export async function createPrivateNote({ actor, profileId = null, organizationTargetId = null, note }) {
  if (!actor?.uid) throw new Error("A logged-in user is required.");
  if (!actor.organizationId) throw new Error("Organization membership is required for private notes.");
  if (!profileId && !organizationTargetId) throw new Error("A note target is required.");
  if (!normalizeInput(note)) throw new Error("Note text is required.");

  return createDocument(COLLECTIONS.privateNotes, {
    organizationId: actor.organizationId,
    createdByUid: actor.uid,
    profileId,
    organizationTargetId,
    note: normalizeInput(note),
    visibility: "organization_private",
    archived: false
  });
}

export async function listPrivateNotes({ actor, profileId = null, organizationTargetId = null, limitCount = 50 }) {
  if (!actor?.organizationId) return [];

  const { firestore } = await getFirestoreModules();
  const constraints = [firestore.where("organizationId", "==", actor.organizationId)];

  if (profileId) constraints.push(firestore.where("profileId", "==", profileId));
  if (organizationTargetId) constraints.push(firestore.where("organizationTargetId", "==", organizationTargetId));

  constraints.push(firestore.orderBy("createdAt", "desc"), firestore.limit(limitCount));
  return queryDocuments(COLLECTIONS.privateNotes, constraints);
}

export async function archivePrivateNote(noteId) {
  return updateDocument(COLLECTIONS.privateNotes, noteId, { archived: true });
}
