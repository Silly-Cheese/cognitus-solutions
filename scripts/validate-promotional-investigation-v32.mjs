import fs from "node:fs";

const entry = fs.readFileSync("src/promotionalAccessV26.js", "utf8");
const js = fs.readFileSync("src/promo/promotionalInvestigationV32.js", "utf8");
const css = fs.readFileSync("src/promotionalInvestigationV32.css", "utf8");

function must(source, text, label) {
  if (!source.includes(text)) throw new Error(`Promotional Investigations V32 validation failed: missing ${label}`);
}

must(entry, "startPromotionalInvestigationsV32", "V32 production bootstrap");
must(js, "isBaseRouter404", "promo-route 404 recovery detector");
must(js, "C.scheduleSync(false)", "promo-route renderer recovery");
must(js, 'INVESTIGATIONS_ROUTE = "/investigations"', "Investigations route enhancement");
must(js, 'readWhere("reports", "subjectProfileId"', "reviewer/admin full report archive query");
must(js, 'readWhere("screeningReportSummaries", "subjectProfileId"', "non-staff screening archive query");
must(js, "REVIEWER_ROLES", "role-scoped full archive");
must(js, "Promo access never bypasses report privacy controls", "privacy boundary message");
must(js, "data-promo32-report-search", "report archive subject search");
must(js, "Open Full Report", "authorized full report navigation");
must(css, ".promo32-archive", "archive workspace styling");
must(css, "@media(max-width:760px)", "mobile archive styling");

console.log("Promotional Investigations V32 regression checks passed.");
