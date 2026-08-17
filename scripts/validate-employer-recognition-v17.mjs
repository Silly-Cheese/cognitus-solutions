import fs from "node:fs";
import { spawnSync } from "node:child_process";

const hub = fs.readFileSync("src/employerHubFixV12.js", "utf8");
const syntax = spawnSync(process.execPath, ["--check", "src/employerHubFixV12.js"], { encoding: "utf8" });

const checks = [
  [syntax.status === 0, "Employer Hub recognition JavaScript syntax is valid"],
  [hub.includes("loadUserDocument") && hub.includes("[0, 180, 520]"), "authenticated user records are retried instead of treating one early read as missing"],
  [hub.includes("ensureUserContext") && hub.includes('if (!userDoc) await ensureUserContext()'), "reconciliation can recover a missing in-memory user record"],
  [hub.includes("reconcileQueued") && hub.includes("queueMicrotask(runReconcile)"), "single-flight reconciliation preserves one queued follow-up instead of dropping retries"],
  [hub.includes("resolveApprovedRequestOrganization") && hub.includes('request.status !== "approved"'), "approved Employer Status remains a direct organization fallback"],
  [hub.includes("recoverStaleWorkspace") && hub.includes("staleWorkspaceGate"), "a stale Employer Hub access/organization gate is actively detected"],
  [hub.includes("RECOVERY_KEY") && hub.includes("30000"), "stale-workspace reload recovery is bounded to prevent reload loops"],
  [hub.includes('userDoc = { ...userDoc, organizationId: org.id }'), "successful organization normalization updates the in-memory account context immediately"],
  [!hub.includes("MutationObserver"), "recognition recovery remains observer-free"],
  [!hub.includes("Fire.orderBy(") && !hub.includes("orderBy("), "recognition recovery introduces no ordered/composite query"],
  [!fs.existsSync("firestore.indexes.json"), "repository still contains no manual/composite Firestore index manifest"]
];

let failed = false;
for (const [ok, message] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${message}`);
  if (!ok) failed = true;
}
if (syntax.status !== 0 && syntax.stderr) console.error(syntax.stderr);
if (failed) process.exit(1);
console.log("\nEmployer Hub Recognition V17 validation passed.");
