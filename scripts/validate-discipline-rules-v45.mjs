import fs from "node:fs";

const rules = fs.readFileSync("firestore.rules", "utf8");
const requireText = (text, label) => {
  if (!rules.includes(text)) throw new Error(`Discipline rules validation failed: missing ${label}`);
};

requireText("function validDisciplineWriteupCreate(writeupId, value)", "strict write-up schema");
requireText("function validDisciplineAppealCreate(appealId, value)", "strict appeal schema");
requireText("value.appealDeadline <= request.time + duration.value(30, 'd')", "appeal deadline ceiling");
requireText("request.resource.data.decisionNotes.size() >= 10", "decision explanation requirement");
requireText("request.resource.data.diff(resource.data).changedKeys().hasOnly([", "field-level mutation restriction");
requireText("function canTerminateStaff(uid)", "Owner-only staff termination authorization");
requireText("getAfter(staffDirectoryPath(uid)).data.status == 'former'", "preserved former-staff directory record");
requireText("getAfter(staffEmploymentPath(uid)).data.employmentStatus == 'former'", "preserved former-staff employment record");
requireText("match /{document=**}", "default-deny boundary");

console.log("Discipline and staff inbox rules validation passed.");
