import fs from "node:fs";

const source = fs.readFileSync("src/frenzyV35.js", "utf8");
const cleanDeclaration = 'const clean = (value) => String(value ?? "").trim();';
const stateInitialization = 'let frenzyState = normalizeFrenzy(null);';

const cleanIndex = source.indexOf(cleanDeclaration);
const stateIndex = source.indexOf(stateInitialization);

if (cleanIndex < 0) throw new Error("Frenzy V39 validation failed: clean declaration is missing.");
if (stateIndex < 0) throw new Error("Frenzy V39 validation failed: initial Frenzy state normalization is missing.");
if (cleanIndex > stateIndex) {
  throw new Error("Frenzy V39 validation failed: clean is accessed by normalizeFrenzy before clean is initialized.");
}
if (!source.includes("function normalizeFrenzy(raw)")) {
  throw new Error("Frenzy V39 validation failed: normalizeFrenzy is missing.");
}

console.log("Frenzy V39 startup ordering validation passed.");
