import fs from "node:fs";

const rules = fs.readFileSync("firestore.rules", "utf8");
const requireText = (text, label) => {
  if (!rules.includes(text)) throw new Error(`Discipline rules validation failed: missing ${label}`);
};

requireText("function validDisciplineWriteupCreate(writeupId, value)", "strict write-up schema");
requireText("function validDisciplineAppealCreate(appealId, value)", "strict appeal schema");
requireText("function validStaffInboxCreate(notificationId, value)", "strict inbox schema");
requireText("value.appealDeadline <= request.time + duration.value(30, 'd')", "appeal deadline ceiling");
requireText("request.resource.data.decisionNotes.size() >= 10", "decision explanation requirement");
requireText("existsAfter(staffDisciplineAppealPath(writeupId, resource.data.recipientUid))", "atomic write-up decision check");
requireText("existsAfter(staffDisciplinePath(resource.data.writeupId))", "atomic appeal decision check");
requireText("request.resource.data.diff(resource.data).changedKeys().hasOnly([", "field-level mutation restriction");
requireText("value.href.matches('^#/[A-Za-z0-9_/?=&.%+-]*$')", "internal-only inbox link restriction");
requireText("function canTerminateStaff(uid)", "Owner-only staff termination authorization");
requireText("getAfter(staffDirectoryPath(uid)).data.status == 'former'", "preserved former-staff directory record");
requireText("getAfter(staffEmploymentPath(uid)).data.employmentStatus == 'former'", "preserved former-staff employment record");
requireText("match /{document=**}", "default-deny boundary");

console.log("Discipline and staff inbox rules validation passed.");
