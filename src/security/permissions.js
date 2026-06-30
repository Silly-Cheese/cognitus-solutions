import { USER_ROLES } from "../data/constants.js";

export const ROLE_LEVELS = Object.freeze({
  [USER_ROLES.user]: 10,
  [USER_ROLES.verifiedEmployerMember]: 20,
  [USER_ROLES.orgAdmin]: 30,
  [USER_ROLES.reviewer]: 50,
  [USER_ROLES.admin]: 80,
  [USER_ROLES.owner]: 100
});

export const PERMISSIONS = Object.freeze({
  runChecks: "runChecks",
  downloadReports: "downloadReports",
  submitReports: "submitReports",
  claimProfiles: "claimProfiles",
  submitAppeals: "submitAppeals",
  manageOrgCandidates: "manageOrgCandidates",
  manageOrgMembers: "manageOrgMembers",
  reviewReports: "reviewReports",
  reviewClaims: "reviewClaims",
  reviewAppeals: "reviewAppeals",
  manageUsers: "manageUsers",
  manageOrganizations: "manageOrganizations",
  manageRecords: "manageRecords",
  viewAuditLogs: "viewAuditLogs",
  ownerControl: "ownerControl"
});

const ROLE_PERMISSIONS = Object.freeze({
  [USER_ROLES.user]: [
    PERMISSIONS.runChecks,
    PERMISSIONS.downloadReports,
    PERMISSIONS.submitReports,
    PERMISSIONS.claimProfiles,
    PERMISSIONS.submitAppeals
  ],
  [USER_ROLES.verifiedEmployerMember]: [
    PERMISSIONS.runChecks,
    PERMISSIONS.downloadReports,
    PERMISSIONS.submitReports,
    PERMISSIONS.claimProfiles,
    PERMISSIONS.submitAppeals,
    PERMISSIONS.manageOrgCandidates
  ],
  [USER_ROLES.orgAdmin]: [
    PERMISSIONS.runChecks,
    PERMISSIONS.downloadReports,
    PERMISSIONS.submitReports,
    PERMISSIONS.claimProfiles,
    PERMISSIONS.submitAppeals,
    PERMISSIONS.manageOrgCandidates,
    PERMISSIONS.manageOrgMembers
  ],
  [USER_ROLES.reviewer]: [
    PERMISSIONS.runChecks,
    PERMISSIONS.downloadReports,
    PERMISSIONS.submitReports,
    PERMISSIONS.claimProfiles,
    PERMISSIONS.submitAppeals,
    PERMISSIONS.reviewReports,
    PERMISSIONS.reviewClaims,
    PERMISSIONS.reviewAppeals
  ],
  [USER_ROLES.admin]: [
    PERMISSIONS.runChecks,
    PERMISSIONS.downloadReports,
    PERMISSIONS.submitReports,
    PERMISSIONS.claimProfiles,
    PERMISSIONS.submitAppeals,
    PERMISSIONS.manageOrgCandidates,
    PERMISSIONS.manageOrgMembers,
    PERMISSIONS.reviewReports,
    PERMISSIONS.reviewClaims,
    PERMISSIONS.reviewAppeals,
    PERMISSIONS.manageUsers,
    PERMISSIONS.manageOrganizations,
    PERMISSIONS.manageRecords,
    PERMISSIONS.viewAuditLogs
  ],
  [USER_ROLES.owner]: Object.values(PERMISSIONS)
});

export function getRoleLevel(role) {
  return ROLE_LEVELS[role] || 0;
}

export function hasMinimumRole(userRecord, minimumRole) {
  return getRoleLevel(userRecord?.role) >= getRoleLevel(minimumRole);
}

export function hasPermission(userRecord, permission) {
  const permissions = ROLE_PERMISSIONS[userRecord?.role] || [];
  return permissions.includes(permission);
}

export function isOwner(userRecord) {
  return userRecord?.role === USER_ROLES.owner;
}

export function isAdminOrOwner(userRecord) {
  return hasMinimumRole(userRecord, USER_ROLES.admin);
}

export function isReviewerOrHigher(userRecord) {
  return hasMinimumRole(userRecord, USER_ROLES.reviewer);
}
