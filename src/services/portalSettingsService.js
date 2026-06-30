import { COLLECTIONS } from "../firebase/collections.js";
import { getDocument, setDocument } from "./firestoreCore.js";
import { writeAuditLog } from "./auditService.js";

export async function getPortalSettings() {
  return getDocument(COLLECTIONS.settings, "portal");
}

export async function savePortalSettings(settings, actor) {
  await setDocument(COLLECTIONS.settings, "portal", settings, true);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: "PORTAL_SETTINGS_UPDATED",
    targetType: "settings",
    targetId: "portal",
    summary: "Updated portal settings.",
    newValue: settings
  });
  return "portal";
}
