import { FIREBASE_CDN_BASE, initializeFirebaseServices } from "./firebase/firebaseApp.js";

let db = null;
let Fire = null;
let timers = [];

const STANDING = Object.freeze({
  unreviewed: { label: "Unreviewed", tone: "neutral", score: 0 },
  good: { label: "Good Standing", tone: "positive", score: 1 },
  watch: { label: "Watch", tone: "caution", score: 2 },
  concern: { label: "Concern", tone: "elevated", score: 3 },
  restricted: { label: "Restricted", tone: "critical", score: 4 }
});

const RISK = Object.freeze({
  unreviewed: { label: "Unreviewed", tone: "neutral", score: 0 },
  low: { label: "Low Risk", tone: "positive", score: 1 },
  moderate: { label: "Moderate Risk", tone: "caution", score: 2 },
  high: { label: "High Risk", tone: "elevated", score: 3 },
  critical: { label: "Critical Risk", tone: "critical", score: 4 }
});

function route() {
  return location.hash.replace(/^#/, "").split("?")[0] || "/";
}

function params() {
  return new URLSearchParams(location.hash.split("?")[1] || "");
}

function assessmentFor(profile) {
  const standing = STANDING[profile?.professionalStanding] || STANDING.unreviewed;
  const risk = RISK[profile?.riskLevel] || RISK.unreviewed;

  if (standing.score === 0 || risk.score === 0) {
    return {
      standing,
      risk,
      tone: "neutral",
      headline: "Assessment incomplete",
      summary: "Standing or risk has not yet been fully reviewed. Read the underlying records before making a decision."
    };
  }

  const score = Math.max(standing.score, risk.score);
  const state = score >= 4
    ? { tone: "critical", headline: "Heightened review required" }
    : score === 3
      ? { tone: "elevated", headline: "Elevated concern" }
      : score === 2
        ? { tone: "caution", headline: "Review with caution" }
        : { tone: "positive", headline: "Lower-concern assessment" };

  return {
    standing,
    risk,
    ...state,
    summary: "This color summary reflects the current Cognitus standing and risk fields. It is a visual aid, not a standalone employment decision."
  };
}

async function readDoc(collectionName, id) {
  if (!id) return null;
  const snap = await Fire.getDoc(Fire.doc(db, collectionName, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

function chip(kind, value) {
  return `
    <div class="v7-assessment-chip is-${value.tone}">
      <span class="v7-chip-label">${kind}</span>
      <strong>${value.label}</strong>
    </div>`;
}

function renderBand(report, profile, checkId) {
  if (!report || report.querySelector("[data-v7-assessment-band]")) return;
  const header = report.querySelector(".report-header");
  if (!header) return;

  const assessment = assessmentFor(profile);
  report.dataset.v7AssessmentTone = assessment.tone;

  const section = document.createElement("section");
  section.className = `v7-assessment-band is-${assessment.tone}`;
  section.dataset.v7AssessmentBand = "true";
  section.setAttribute("aria-label", "Current Cognitus standing and risk assessment");
  section.innerHTML = `
    <div class="v7-assessment-copy">
      <span class="v7-assessment-kicker">Current Assessment</span>
      <h2>${assessment.headline}</h2>
      <p>${assessment.summary}</p>
    </div>
    <div class="v7-assessment-values">
      ${chip("Standing", assessment.standing)}
      ${chip("Risk", assessment.risk)}
    </div>
    <div class="v7-assessment-legend" aria-label="Assessment color legend">
      <span><i class="is-positive"></i> Lower concern</span>
      <span><i class="is-caution"></i> Review</span>
      <span><i class="is-elevated"></i> Elevated</span>
      <span><i class="is-critical"></i> Heightened</span>
      <span><i class="is-neutral"></i> Unreviewed</span>
    </div>`;

  header.insertAdjacentElement("afterend", section);
  report.dataset.v7AssessmentCheck = checkId;
}

async function enhanceReport() {
  const current = route();
  if (current !== "/reports/quick" && current !== "/reports/full") return;

  const report = document.querySelector(".report-document");
  if (!report || report.querySelector("[data-v7-assessment-band]")) return;

  const checkId = params().get("checkId");
  if (!checkId) return;

  const check = await readDoc("checkLogs", checkId).catch(() => null);
  if (!check?.targetProfileId) return;

  const profile = await readDoc("profiles", check.targetProfileId).catch(() => null);
  if (!profile) return;

  renderBand(report, profile, checkId);
}

function schedule() {
  timers.forEach(clearTimeout);
  timers = [0, 120, 350, 750, 1400].map((delay) => setTimeout(() => {
    enhanceReport().catch((error) => console.warn("Report assessment visualization failed", error));
  }, delay));
}

async function initialize() {
  const services = await initializeFirebaseServices();
  if (!services.ready) return;
  db = services.db;
  Fire = await import(`${FIREBASE_CDN_BASE}/firebase-firestore.js`);

  window.addEventListener("hashchange", schedule);
  window.addEventListener("DOMContentLoaded", schedule);
  window.addEventListener("pageshow", schedule);
  schedule();
}

initialize().catch((error) => console.warn("Report Assessment V7 failed to initialize", error));
