import fs from "node:fs";

const css = fs.readFileSync("src/professionalContrastV40.css", "utf8");
const js = fs.readFileSync("src/professionalContrastV40.js", "utf8");
const bootstrap = fs.readFileSync("src/promotionalAccessV26.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");

const requiredCss = [
  "--c40-text: #101828",
  "--c40-muted: #475467",
  "--c40-on-dark-muted: #d0d5dd",
  "html.promo33-active body.cognitus-professional .promo26-access-hero",
  "body.cognitus-professional .dashboard-hero .account-card",
  "body.cognitus-professional .exec35-header",
  "body.cognitus-professional .signal35-panel label",
  "body.cognitus-professional .nav25-account small"
];
for (const token of requiredCss) {
  if (!css.includes(token)) throw new Error(`V40 contrast contract missing: ${token}`);
}

if (!js.includes('link.href = "./src/professionalContrastV40.css?v=20260905-v40"')) {
  throw new Error("V40 stylesheet is not cache-busted.");
}
if (!js.includes("document.head.appendChild(link)")) {
  throw new Error("V40 stylesheet must be re-appended last in the cascade.");
}
if (!bootstrap.includes('import { startProfessionalContrastV40 } from "./professionalContrastV40.js";')) {
  throw new Error("Promotional bootstrap does not import V40 contrast.");
}
if (!bootstrap.includes('safeStartV38("professional-contrast-v40", startProfessionalContrastV40);')) {
  throw new Error("Promotional bootstrap does not start V40 contrast.");
}
if (!index.includes('./src/promotionalAccessV26.js?v=20260905-v40-contrast')) {
  throw new Error("index.html does not force the V40 promotional bootstrap URL.");
}

function rgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
}
function channel(v) {
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const [r, g, b] = rgb(hex).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const pairs = [
  ["#101828", "#ffffff", "primary on white"],
  ["#344054", "#ffffff", "body on white"],
  ["#475467", "#ffffff", "muted on white"],
  ["#667085", "#ffffff", "placeholder on white"],
  ["#ffffff", "#172033", "primary on dark"],
  ["#d0d5dd", "#172033", "muted on dark"]
];
for (const [fg, bg, label] of pairs) {
  const ratio = contrast(fg, bg);
  if (ratio < 4.5) throw new Error(`${label} contrast ${ratio.toFixed(2)} is below 4.5:1`);
}

console.log("Professional Contrast V40 validation passed.");
