import { COLLECTIONS } from "../firebase/collections.js";
import { ACCOUNT_STATUSES, USER_ROLES } from "../data/constants.js";
import { updateDocument } from "./firestoreCore.js";
import { writeAuditLog } from "./auditService.js";

export async function changeUserRole(uid, role, actor) {
  if (!Object.values(USER_ROLES).includes(role)) throw new Error("Invalid role.");
  await updateDocument(COLLECTIONS.users, uid, { role });
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: "USER_ROLE_CHANGED",
    targetType: "user",
    targetId: uid,
    summary: `Changed user role to ${role}.`,
    newValue: { role }
  });
  return uid;
}

export async function changeUserStatus(uid, status, actor) {
  if (!ACCOUNT_STATUSES.includes(status)) throw new Error("Invalid status.");
  await updateDocument(COLLECTIONS.users, uid, { status });
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: "USER_STATUS_CHANGED",
    targetType: "user",
    targetId: uid,
    summary: `Changed user status to ${status}.`,
    newValue: { status }
  });
  return uid;
}

export async function changeOrganizationVerification(organizationId, verificationStatus, actor) {
  await updateDocument(COLLECTIONS.organizations, organizationId, { verificationStatus });
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: "ORGANIZATION_VERIFICATION_CHANGED",
    targetType: "organization",
    targetId: organizationId,
    summary: `Changed organization verification to ${verificationStatus}.`,
    newValue: { verificationStatus }
  });
  return organizationId;
}

export async function changeOrganizationTrust(organizationId, trustLevel, actor) {
  await updateDocument(COLLECTIONS.organizations, organizationId, { trustLevel });
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: "ORGANIZATION_TRUST_CHANGED",
    targetType: "organization",
    targetId: organizationId,
    summary: `Changed organization trust level to ${trustLevel}.`,
    newValue: { trustLevel }
  });
  return organizationId;
}
