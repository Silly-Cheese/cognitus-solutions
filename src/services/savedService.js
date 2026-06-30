import { COLLECTIONS } from "../firebase/collections.js";
import { createDocument, queryDocuments, getFirestoreModules } from "./firestoreCore.js";

export async function saveCandidate({ actor, profileId, label = "Candidate", status = "Saved" }) {
  if (!actor?.uid) throw new Error("A logged-in user is required.");
  if (!profileId) throw new Error("Profile ID is required.");

  return createDocument(COLLECTIONS.savedCandidates, {
    userId: actor.uid,
    organizationId: actor.organizationId || null,
    profileId,
    label,
    status,
    notesCount: 0
  });
}

export async function saveOrganization({ actor, organizationId, label = "Saved Organization" }) {
  if (!actor?.uid) throw new Error("A logged-in user is required.");
  if (!organizationId) throw new Error("Organization ID is required.");

  return createDocument(COLLECTIONS.savedOrganizations, {
    userId: actor.uid,
    organizationId: actor.organizationId || null,
    savedOrganizationId: organizationId,
    label
  });
}

export async function listSavedCandidates(actor, limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  return queryDocuments(COLLECTIONS.savedCandidates, [
    firestore.where("userId", "==", actor.uid),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}

export async function listSavedOrganizations(actor, limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  return queryDocuments(COLLECTIONS.savedOrganizations, [
    firestore.where("userId", "==", actor.uid),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}
