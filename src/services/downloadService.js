import { COLLECTIONS } from "../firebase/collections.js";
import { createDocument, updateDocument } from "./firestoreCore.js";
import { createIdForEntity } from "../utils/cognitusIds.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

export async function logReportDownload({ actor, checkId = null, reportId = null, format = "pdf", reportType = "quick" }) {
  if (!actor?.uid) throw new Error("A logged-in user is required.");

  const download = {
    cognitusId: createIdForEntity("report"),
    downloadedByUid: actor.uid,
    downloadedByCognitusId: actor.cognitusId || null,
    organizationId: actor.organizationId || null,
    checkId,
    reportId,
    format,
    reportType
  };

  const id = await createDocument(COLLECTIONS.downloads, download);

  if (checkId) {
    await updateDocument(COLLECTIONS.checkLogs, checkId, { downloadedReport: true });
  }

  await writeAuditLog({
    actorUid: actor.uid,
    actorCognitusId: actor.cognitusId || null,
    actorRole: actor.role || null,
    action: AUDIT_ACTIONS.reportDownloaded,
    targetType: "download",
    targetId: id,
    targetCognitusId: download.cognitusId,
    summary: `Downloaded ${reportType} report as ${format}.`,
    metadata: { checkId, reportId }
  });

  return id;
}
