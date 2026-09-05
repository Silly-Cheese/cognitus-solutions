import fs from "node:fs";

const path = "index.html";
let source = fs.readFileSync(path, "utf8");
const previous = './src/promotionalAccessV26.js?v=20260905-v38-router-handoff';
const next = './src/promotionalAccessV26.js?v=20260905-v40-contrast';

if (source.includes(next)) {
  console.log("V40 promotional bootstrap URL already present.");
  process.exit(0);
}
if (!source.includes(previous)) {
  throw new Error("Expected V38 promotional bootstrap URL not found in index.html.");
}
source = source.replace(previous, next);
fs.writeFileSync(path, source);
console.log("index.html promotional bootstrap cache key advanced to V40.");
