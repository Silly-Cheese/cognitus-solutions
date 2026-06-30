export const APP_NAME = "Cognitus Solutions";

export const COGNITUS_ID_PREFIXES = Object.freeze({
  user: "USR",
  organization: "ORG",
  profile: "PRF",
  report: "RPT",
  check: "CHK",
  appeal: "APL",
  claim: "CLM",
  passwordReset: "PWD",
  notification: "NTF",
  audit: "AUD",
  invite: "INV",
  employment: "EMP",
  certification: "CRT"
});

export const USER_ROLES = Object.freeze({
  user: "user",
  verifiedEmployerMember: "verified_employer_member",
  orgAdmin: "org_admin",
  reviewer: "reviewer",
  admin: "admin",
  owner: "owner"
});

export const CHECK_REASONS = Object.freeze([
  "Hiring Review",
  "Promotion Review",
  "Partnership Review",
  "Internal Investigation",
  "Safety Concern",
  "Appeal/Correction Review",
  "Other"
]);

export const SEARCH_TYPES = Object.freeze([
  "Person",
  "Organization"
]);

export const PERSON_SEARCH_FIELDS = Object.freeze([
  "Roblox Username",
  "Discord Username",
  "Discord ID"
]);

export const ORGANIZATION_SEARCH_FIELDS = Object.freeze([
  "Organization Name"
]);

export const REPORT_STATUSES = Object.freeze({
  submitted: "submitted",
  pendingReview: "pending_review",
  underReview: "under_review",
  needsMoreInfo: "needs_more_info",
  approved: "approved",
  denied: "denied",
  published: "published",
  archived: "archived",
  disputed: "disputed"
});

export const SEVERITY_LEVELS = Object.freeze([
  "Informational",
  "Low",
  "Moderate",
  "High",
  "Critical"
]);

export const ACCOUNT_STATUSES = Object.freeze([
  "active",
  "pending_verification",
  "suspended",
  "restricted",
  "banned",
  "password_reset_required"
]);

export const ROUTES = Object.freeze([
  "/",
  "/about",
  "/login",
  "/register",
  "/dashboard",
  "/setup"
]);
