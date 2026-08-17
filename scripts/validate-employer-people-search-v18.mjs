import fs from "node:fs";
import { spawnSync } from "node:child_process";

const search = fs.readFileSync("src/employerPeopleSearchV18.js", "utf8");
const nav = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const syntax = spawnSync(process.execPath, ["--check", "src/employerPeopleSearchV18.js"], { encoding: "utf8" });

const checks = [
  [syntax.status === 0, "Employer People Search V18 JavaScript syntax is valid"],
  [nav.includes('import "./employerPeopleSearchV18.js"'), "production navigation loads Employer People Search V18"],
  [search.includes('discordUsernamesNormalized", "array-contains"') && search.includes('discordUsernames", "array-contains", value'), "Discord username search supports both normalized and existing raw profile arrays"],
  [search.includes('discordUsername", "==", value') && search.includes('discordUsernameNormalized", "==", normalized'), "Discord username search supports compatible singular legacy fields"],
  [search.includes('robloxUsernamesNormalized", "array-contains"') && search.includes('robloxUsernames", "array-contains", value'), "Roblox username search supports normalized and raw profile fields"],
  [search.includes('discordIds", "array-contains"') && search.includes('cognitusId", "=="'), "Discord ID and Cognitus ID searches remain direct single-field lookups"],
  [search.includes("uniqueProfiles") && search.includes("new Map"), "compatible identity matches are deduplicated by profile ID"],
  [search.includes('document.addEventListener("submit", handleEmployerPeopleSearch, true)'), "V18 safely intercepts the Employer Hub People form without MutationObservers"],
  [search.includes("Open Candidate File") && search.includes("data-emp18-result"), "existing profiles return usable Candidate File results"],
  [search.includes("current and compatible profile identity fields"), "no-result state explains that compatibility fields were checked before suggesting a new Person Record"],
  [!search.includes("readAll(") && !search.includes("getDocs(Fire.collection"), "People search avoids full profile collection scans"],
  [!search.includes("Fire.orderBy(") && !search.includes("orderBy("), "V18 introduces no ordered/composite query"],
  [!search.includes("MutationObserver"), "V18 remains observer-free"],
  [!fs.existsSync("firestore.indexes.json"), "repository still contains no manual/composite Firestore index manifest"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (syntax.status !== 0 && syntax.stderr) console.error(syntax.stderr);
if (failed) process.exit(1);
console.log("\nEmployer People Search V18 validation passed.");
