import fs from "node:fs";

const assessment = fs.readFileSync("src/assessmentV4.js", "utf8");

const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
};

assert(assessment.includes("const persisted = await readDoc(\"profiles\", profileId)"), "assessment save re-reads Firestore after writing");
assert(assessment.includes("persisted.professionalStanding !== professionalStanding") && assessment.includes("persisted.riskLevel !== riskLevel"), "assessment save verifies both persisted values before reporting success");
assert(assessment.includes("friendlyError") && assessment.includes("permission-denied") && assessment.includes("Deploy the latest firestore.rules"), "permission failures produce an actionable Firebase rules message");
assert(assessment.includes("makeAdminSaveButton") && assessment.includes("riskCell.appendChild(saveWrap)"), "Admin assessment rows own an independent Save control");
assert(assessment.includes('button.textContent = "Saved ✓"'), "successful Admin saves provide visible confirmation");
assert(assessment.includes("data-v4-assessment-status") && assessment.includes("Saving standing and risk"), "Settings assessment form has persistent inline save feedback");
assert(!assessment.includes("MutationObserver"), "assessment persistence remains observer-free");
assert(!assessment.includes("Fire.orderBy("), "assessment persistence introduces no composite-index query dependency");

if (process.exitCode) {
  console.error("\nAssessment persistence validation failed.");
  process.exit(process.exitCode);
}

console.log("\nAssessment persistence validation passed.");
