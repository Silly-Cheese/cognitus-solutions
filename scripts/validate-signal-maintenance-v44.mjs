import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const signal = read("src/signalZeroV44.js");
const signalCss = read("src/signalZeroV44.css");
const runtime = read("src/promoRuntimeV43.js");
const promo = read("src/promotionalAccessV26.js");
const maintenance = read("src/maintenanceV44.js");
const maintenanceCss = read("src/maintenanceV44.css");
const executiveMaintenance = read("src/executiveMaintenanceV44.js");
const executiveMaintenanceCss = read("src/executiveMaintenanceV44.css");

const checks = [
  [signal.includes('const ROUTE = "/signal-zero"'), "Signal Zero V44 owns /signal-zero"],
  [signal.includes("core: 25") && signal.includes("correlation: 50") && signal.includes("board: 75") && signal.includes("brief: 90") && signal.includes("zeroState: 100"), "Signal Zero capability thresholds are 25/50/75/90/100"],
  [signal.includes("AUTHORIZING SIGNAL ZERO") && signal.includes("SIGNAL ZERO ONLINE"), "Signal Zero has the bounded initialization sequence"],
  [signal.includes("Zero Pulse") && signal.includes("Confidence Matrix") && signal.includes("Timeline Reconstruction"), "Signal Zero includes pulse, confidence, and timeline systems"],
  [signal.includes("Signal Board") && signal.includes("Zero Brief") && signal.includes("Source registry"), "Signal Zero includes board, brief, and provenance registry"],
  [signal.includes('SESSION_KIND = "signal_zero_session"') && signal.includes('C.createUserData("investigation"'), "Signal Zero persists sessions through the existing authorized investigation workspace type"],
  [signal.includes("read-only") || signal.includes("Read-only"), "Signal Zero supports dormant read-only session archives"],
  [signal.includes("does not issue guilt") && signal.includes("Decision support only"), "Signal Zero preserves human-decision guardrails"],
  [signalCss.includes("--sz-text:#f8fafc") && signalCss.includes("--sz-bg:#08111f"), "Signal Zero has a deliberate high-contrast dark environment"],
  [runtime.includes("renderSignalZeroV44") && runtime.includes('feature.id === "signal_zero"'), "V43 runtime routes Signal Zero to V44"],
  [runtime.includes("missingSignalV44") && runtime.includes("data-signal44-page"), "V44 reclaims stale legacy Signal Zero renders"],

  [maintenance.includes('PORTAL_COLLECTION = "settings"') && maintenance.includes('PORTAL_DOC = "portal"'), "Maintenance gate reads the shared portal state"],
  [maintenance.includes('record?.status === "active"') && maintenance.includes('record?.role === "owner"'), "Only an active Owner receives maintenance bypass"],
  [maintenance.includes('route() === "/login"'), "Login remains available as the Owner recovery route"],
  [maintenance.includes("cognitus-maintenance-overlay-v44") && maintenance.includes("Check Again"), "Maintenance mode provides a public full-screen gate with recovery refresh"],
  [maintenance.includes("scheduleExpiryCheck") && maintenance.includes("expiryTimer"), "Scheduled maintenance releases the client gate when its end time is reached"],
  [!maintenance.includes("activatedByUid") && !maintenance.includes("activatedByCognitusId"), "Public maintenance state does not expose Owner identifiers"],
  [maintenanceCss.includes("z-index:2147482000") && maintenanceCss.includes("#111827"), "Maintenance screen is visually authoritative and high contrast"],
  [promo.includes('import "./maintenanceV44.js?v=20260906-v44-site-gate"'), "Universal promotional bootstrap starts the maintenance gate"],

  [executiveMaintenance.includes('userRecord?.status === "active"') && executiveMaintenance.includes('userRecord?.role === "owner"'), "Executive maintenance controls are Owner-only"],
  [executiveMaintenance.includes("SITE_MAINTENANCE_STARTED") && executiveMaintenance.includes("SITE_EMERGENCY_LOCKED") && executiveMaintenance.includes("SITE_MAINTENANCE_ENDED"), "Maintenance and emergency actions are audited"],
  [executiveMaintenance.includes("Pause Website Access") && executiveMaintenance.includes("Emergency Pause Now") && executiveMaintenance.includes("Restore Website"), "Executive Control exposes maintenance, emergency, and restoration actions"],
  [executiveMaintenance.includes('Fire.setDoc(portalRef(), { maintenance: next }, { merge: true })'), "Maintenance uses a non-destructive settings/portal merge"],
  [!executiveMaintenance.includes("activatedByUid") && !executiveMaintenance.includes("activatedByCognitusId"), "Owner identity remains in audit data rather than public portal maintenance state"],
  [executiveMaintenanceCss.includes(".exec-maint44-form") && executiveMaintenanceCss.includes(".exec-maint44-emergency"), "Executive maintenance controls have dedicated professional formatting"],
  [runtime.includes("executiveMaintenanceV44.js?v=20260906-v44") && runtime.includes("Executive Maintenance V44 isolated loader failed"), "Maintenance controls are isolated from Executive Control startup"]
];

let failures = 0;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failures += 1;
}

if (failures) {
  console.error(`Signal Zero / Maintenance V44 validation failed: ${failures} check(s).`);
  process.exit(1);
}

console.log("Signal Zero / Maintenance V44 validation passed.");
