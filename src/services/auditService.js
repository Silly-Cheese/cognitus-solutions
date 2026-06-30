import { COLLECTIONS } from "../firebase/collections.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { createDocument } from "./firestoreCore.js";

export const AUDIT_ACTIONS = Object.freeze({
  accountCreated: "ACCOUNT_CREATED",
  userLoggedIn: "USER_LOGGED_IN",
  userLoggedOut: "USER_LOGGED_OUT",
  ownerBootstrapped: "OWNER_BOOTSTRAPPED",
  checkCreated: "CHECK_CREATED",
  reportSubmitted: "REPORT_SUBMITTED",
  appealSubmitted: "APPEAL_SUBMITTED",
  claimSubmitted: "CLAIM_SUBMITTED",
  organizationCreated: "ORGANIZATION_CREATED",
  profileCreated: "PROFILE_CREATED",
  recordUpdated: "RECORD_UPDATED",
  reportDownloaded: "REPORT_DOWNLOADED",
  passwordResetRequested: "PASSWORD_RESET_REQUESTED"
});

export async function writeAuditLog({
  actorUid = null,
  actorCognitusId = null,
  actorRole = null,
  action,
  targetType,
  targetId = null,
  targetCognitusId = null,
  summary = "",
  oldValue = null,
  newValue = null,
  metadata = {}
}) {
  if (!action) throw new Error("Audit action is required.");
  if (!targetType) throw new Error("Audit target type is required.");

  return createDocument(COLLECTIONS.auditLogs, {
    cognitusId: createIdForEntity("audit"),
    actorUid,
    actorCognitusId,
    actorRole,
    action,
    targetType,
    targetId,
    targetCognitusId,
    summary,
    oldValue,
    newValue,
    metadata
  });
}
