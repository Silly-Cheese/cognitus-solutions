import { COLLECTIONS } from "../firebase/collections.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeInput } from "../utils/validation.js";
import { createDocument, getDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export async function createOrganization({
  actor = null,
  name,
  organizationType = "Roblox/Discord Community",
  ownerDiscordUsername = "",
  ownerDiscordId = "",
  staffSize = "",
  country = ""
}) {
  const cleanName = normalizeInput(name);
  if (!cleanName) throw new Error("Organization name is required.");

  const organization = {
    cognitusId: createIdForEntity("organization"),
    name: cleanName,
    searchableName: cleanName.toLowerCase(),
    organizationType: normalizeInput(organizationType),
    ownerDiscordUsername: normalizeInput(ownerDiscordUsername),
    ownerDiscordId: normalizeInput(ownerDiscordId),
    staffSize: normalizeInput(staffSize),
    country: normalizeInput(country),
    verificationStatus: "pending_verification",
    trustLevel: "unreviewed",
    memberCount: 1,
    reportsSubmitted: 0,
    reportAccuracy: null,
    disputeHistoryCount: 0,
    publicNotes: "",
    createdByUid: actor?.uid || null
  };

  const id = await createDocument(COLLECTIONS.organizations, organization);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.organizationCreated,
    targetType: "organization",
    targetId: id,
    targetCognitusId: organization.cognitusId,
    summary: `Created organization ${cleanName}.`
  });
  return id;
}

export async function getOrganization(organizationId) {
  return getDocument(COLLECTIONS.organizations, organizationId);
}

export async function updateOrganization(organizationId, data, actor = null) {
  await updateDocument(COLLECTIONS.organizations, organizationId, data);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.recordUpdated,
    targetType: "organization",
    targetId: organizationId,
    summary: "Updated organization record.",
    newValue: data
  });
  return organizationId;
}

export async function searchOrganizations(name, limitCount = 20) {
  const cleanName = normalizeInput(name).toLowerCase();
  if (!cleanName) return [];

  const { firestore } = await getFirestoreModules();
  const end = `${cleanName}\uf8ff`;

  return queryDocuments(COLLECTIONS.organizations, [
    firestore.orderBy("searchableName"),
    firestore.startAt(cleanName),
    firestore.endAt(end),
    firestore.limit(limitCount)
  ]);
}
