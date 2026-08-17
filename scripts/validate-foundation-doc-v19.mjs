import fs from "node:fs";
const doc = fs.readFileSync("FOUNDATION_V19.md", "utf8");
if (!doc.includes("deploy-rules-v19.cmd")) throw new Error("Foundation V19 deploy command is undocumented");
if (!doc.includes("Do not deploy Firestore indexes")) throw new Error("Foundation V19 no-index deployment warning is missing");
console.log("Foundation V19 deployment documentation checks passed.");
