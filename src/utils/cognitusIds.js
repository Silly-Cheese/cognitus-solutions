import { COGNITUS_ID_PREFIXES } from "../data/constants.js";

const RANDOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createCognitusId(prefix, date = new Date()) {
  if (!prefix || typeof prefix !== "string") {
    throw new Error("A Cognitus ID prefix is required.");
  }

  const cleanPrefix = prefix.trim().toUpperCase();
  const year = String(date.getFullYear()).slice(-2);
  const uniqueSegment = generateRandomSegment(6);

  return `${cleanPrefix}-${year}-${uniqueSegment}`;
}

export function createIdForEntity(entityType) {
  const prefix = COGNITUS_ID_PREFIXES[entityType];

  if (!prefix) {
    throw new Error(`Unknown Cognitus entity type: ${entityType}`);
  }

  return createCognitusId(prefix);
}

export function isLikelyCognitusId(value) {
  return /^[A-Z]{3}-\d{2}-[A-Z0-9]{6}$/.test(String(value || "").trim());
}

function generateRandomSegment(length) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);

  return Array.from(values, (value) => RANDOM_ALPHABET[value % RANDOM_ALPHABET.length]).join("");
}
