import { COLLECTIONS } from "../firebase/collections.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeInput, normalizeDiscordId } from "../utils/validation.js";
import { createDocument, getDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export async function createPersonProfile({
  actor = null,
  displayName,
  robloxUsername = "",
  discordUsername = "",
  discordId = "",
  knownAliases = []
}) {
  const cleanDiscordId = normalizeDiscordId(discordId);
  const profile = {
    cognitusId: createIdForEntity("profile"),
    type: "person",
    displayName: normalizeInput(displayName) || normalizeInput(robloxUsername) || normalizeInput(discordUsername),
    robloxUsernames: normalizeInput(robloxUsername) ? [normalizeInput(robloxUsername)] : [],
    discordUsernames: normalizeInput(discordUsername) ? [normalizeInput(discordUsername)] : [],
    discordIds: cleanDiscordId ? [cleanDiscordId] : [],
    knownAliases: knownAliases.map(normalizeInput).filter(Boolean),
    claimedByUid: null,
    identityStatus: "unverified",
    identityConfidence: 0,
    professionalStanding: "unreviewed",
    riskLevel: "unreviewed",
    reportCount: 0,
    appealCount: 0,
    lastReviewedAt: null
  };

  const id = await createDocument(COLLECTIONS.profiles, profile);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.profileCreated,
    targetType: "profile",
    targetId: id,
    targetCognitusId: profile.cognitusId,
    summary: `Created person profile ${profile.displayName}.`
  });
  return id;
}

export async function getProfile(profileId) {
  return getDocument(COLLECTIONS.profiles, profileId);
}

export async function updateProfile(profileId, data, actor = null) {
  await updateDocument(COLLECTIONS.profiles, profileId, data);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.recordUpdated,
    targetType: "profile",
    targetId: profileId,
    summary: "Updated profile record.",
    newValue: data
  });
  return profileId;
}

export async function searchProfiles({ field, value, limitCount = 20 }) {
  const cleanValue = normalizeInput(value);
  if (!cleanValue) return [];

  const { firestore } = await getFirestoreModules();
  const fieldMap = {
    "Roblox Username": "robloxUsernames",
    "Discord Username": "discordUsernames",
    "Discord ID": "discordIds"
  };

  const firestoreField = fieldMap[field];
  if (!firestoreField) return [];

  return queryDocuments(COLLECTIONS.profiles, [
    firestore.where(firestoreField, "array-contains", field === "Discord ID" ? normalizeDiscordId(cleanValue) : cleanValue),
    firestore.limit(limitCount)
  ]);
}
