import { getCheckLog } from "./checkService.js";
import { getProfile } from "./profileService.js";
import { getOrganization } from "./organizationService.js";
import { listReportsForProfile } from "./reportService.js";
import { logReportDownload } from "./downloadService.js";
import { createIdForEntity } from "../utils/cognitusIds.js";

export async function buildReportFromCheck(checkId, actor, reportType = "quick") {
  if (!checkId) throw new Error("Check ID is required.");
  if (!actor?.uid) throw new Error("A logged-in user is required.");

  const check = await getCheckLog(checkId);
  if (!check) throw new Error("Check log not found.");

  let subject = null;
  let subjectType = check.searchType;
  let subjectReports = [];

  if (check.targetProfileId) {
    subject = await getProfile(check.targetProfileId);
    subjectType = "Person";
    subjectReports = await listReportsForProfile(check.targetProfileId, reportType === "full" ? 50 : 5);
  }

  if (check.targetOrganizationId) {
    subject = await getOrganization(check.targetOrganizationId);
    subjectType = "Organization";
  }

  return {
    reportReference: createIdForEntity("report"),
    generatedAt: new Date().toISOString(),
    reportType,
    requestedBy: {
      uid: actor.uid,
      cognitusId: actor.cognitusId || "Not assigned",
      displayName: actor.displayName || "Unknown user",
      discordId: actor.discordId || "Not listed",
      role: actor.role || "user",
      organizationId: actor.organizationId || null
    },
    check,
    subjectType,
    subject,
    subjectReports,
    disclaimer: "Cognitus records are based on reviewed platform-submitted information and should be used as one factor in a hiring, safety, promotion, partnership, appeal, or correction decision."
  };
}

export async function logReportPrintDownload({ actor, checkId, reportType }) {
  return logReportDownload({
    actor,
    checkId,
    reportId: null,
    format: "print_pdf",
    reportType
  });
}

export function getOverallRecommendation(reportData) {
  const reports = reportData.subjectReports || [];
  const highSeverity = reports.some((report) => ["High", "Critical"].includes(report.severity));
  const moderateSeverity = reports.some((report) => report.severity === "Moderate");

  if (!reportData.subject) return "No Record Found";
  if (highSeverity) return "Additional Investigation Recommended";
  if (moderateSeverity) return "Recommended with Review";
  return "Recommended with Standard Review";
}

export function getOverallRisk(reportData) {
  const reports = reportData.subjectReports || [];
  if (!reportData.subject) return "Unknown";
  if (reports.some((report) => report.severity === "Critical")) return "Critical";
  if (reports.some((report) => report.severity === "High")) return "High";
  if (reports.some((report) => report.severity === "Moderate")) return "Moderate";
  if (reports.some((report) => report.severity === "Low")) return "Low";
  return reportData.subject.riskLevel || "Low / Unreviewed";
}
