import { COLLECTIONS } from "../firebase/collections.js";
import { REPORT_STATUSES, SEVERITY_LEVELS } from "../data/constants.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { normalizeInput } from "../utils/validation.js";
import { createDocument, getDocument, queryDocuments, updateDocument, getFirestoreModules } from "./firestoreCore.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export const REPORT_CATEGORIES = Object.freeze([
  "Misconduct",
  "Abuse of Power",
  "Fraud/Scamming",
  "Harassment",
  "Impersonation",
  "Leaking Information",
  "Unprofessional Conduct",
  "False Report",
  "Organization Concern",
  "Positive Recognition",
  "Employment Verification",
  "Other"
]);

export async function submitReport({
  actor,
  subjectProfileId = null,
  subjectOrganizationId = null,
  category,
  severity = "Informational",
  summary,
  details = "",
  visibility = "private_review"
}) {
  if (!actor?.uid) throw new Error("A logged-in user is required to submit reports.");
  if (!subjectProfileId && !subjectOrganizationId) throw new Error("A report subject is required.");
  if (!REPORT_CATEGORIES.includes(category)) throw new Error("A valid report category is required.");
  if (!SEVERITY_LEVELS.includes(severity)) throw new Error("A valid severity is required.");
  if (!normalizeInput(summary)) throw new Error("Report summary is required.");

  const report = {
    cognitusId: createIdForEntity("report"),
    subjectProfileId,
    subjectOrganizationId,
    submittedByUid: actor.uid,
    submittedByCognitusId: actor.cognitusId || null,
    submittedByOrganizationId: actor.organizationId || null,
    category,
    severity,
    summary: normalizeInput(summary),
    details: normalizeInput(details),
    status: REPORT_STATUSES.pendingReview,
    visibility,
    reviewedByUid: null,
    reviewedAt: null,
    publishedAt: null,
    appealStatus: "none"
  };

  const id = await createDocument(COLLECTIONS.reports, report);
  await writeAuditLog({
    actorUid: actor.uid,
    actorCognitusId: actor.cognitusId || null,
    actorRole: actor.role || null,
    action: AUDIT_ACTIONS.reportSubmitted,
    targetType: "report",
    targetId: id,
    targetCognitusId: report.cognitusId,
    summary: `Submitted ${category} report.`,
    metadata: { severity, visibility }
  });
  return id;
}

export async function getReport(reportId) {
  return getDocument(COLLECTIONS.reports, reportId);
}

export async function updateReportStatus(reportId, { status, reviewedBy = null, decisionNotes = "" }, actor = null) {
  const update = {
    status,
    decisionNotes: normalizeInput(decisionNotes)
  };

  if (reviewedBy?.uid) {
    update.reviewedByUid = reviewedBy.uid;
    update.reviewedAt = new Date().toISOString();
  }

  await updateDocument(COLLECTIONS.reports, reportId, update);
  await writeAuditLog({
    actorUid: actor?.uid || null,
    actorCognitusId: actor?.cognitusId || null,
    actorRole: actor?.role || null,
    action: AUDIT_ACTIONS.recordUpdated,
    targetType: "report",
    targetId: reportId,
    summary: `Updated report status to ${status}.`,
    newValue: update
  });
  return reportId;
}

export async function listReportsForProfile(profileId, limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  return queryDocuments(COLLECTIONS.reports, [
    firestore.where("subjectProfileId", "==", profileId),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}

export async function listPendingReports(limitCount = 50) {
  const { firestore } = await getFirestoreModules();
  return queryDocuments(COLLECTIONS.reports, [
    firestore.where("status", "==", REPORT_STATUSES.pendingReview),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(limitCount)
  ]);
}
