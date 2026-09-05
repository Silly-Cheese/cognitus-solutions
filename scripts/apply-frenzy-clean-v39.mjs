import fs from "node:fs";

const path = "src/frenzyV35.js";
let source = fs.readFileSync(path, "utf8");

const cleanDeclaration = 'const clean = (value) => String(value ?? "").trim();\n';
const stateInitialization = 'let frenzyState = normalizeFrenzy(null);\n';

if (!source.includes(cleanDeclaration)) {
  throw new Error("V39 repair failed: clean declaration not found.");
}
if (!source.includes(stateInitialization)) {
  throw new Error("V39 repair failed: frenzy state initialization not found.");
}

source = source.replace(cleanDeclaration, "");
source = source.replace(stateInitialization, `${cleanDeclaration}${stateInitialization}`);

const cleanIndex = source.indexOf(cleanDeclaration);
const stateIndex = source.indexOf(stateInitialization);
if (cleanIndex < 0 || stateIndex < 0 || cleanIndex > stateIndex) {
  throw new Error("V39 repair failed: clean must initialize before normalizeFrenzy is called.");
}

fs.writeFileSync(path, source);
console.log("Frenzy V39 startup ordering repaired.");
