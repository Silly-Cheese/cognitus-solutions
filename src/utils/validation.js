export function normalizeInput(value) {
  return String(value || "").trim();
}

export function normalizeDiscordId(value) {
  const clean = normalizeInput(value).replace(/\D/g, "");
  return /^\d{15,25}$/.test(clean) ? clean : "";
}

export function validateDiscordId(value) {
  return Boolean(normalizeDiscordId(value));
}

export function validatePassword(value) {
  const password = String(value || "");

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return "";
}

export function validateRequired(value, label) {
  return normalizeInput(value) ? "" : `${label} is required.`;
}

export function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function getFirebaseAuthErrorMessage(error) {
  const code = error?.code || "";

  const messages = {
    "auth/email-already-in-use": "An account already exists for that Discord ID.",
    "auth/invalid-email": "The Discord ID could not be converted into a valid internal login.",
    "auth/invalid-credential": "The Discord ID or password is incorrect.",
    "auth/missing-password": "Password is required.",
    "auth/weak-password": "Password must be at least 6 characters. Cognitus requires at least 8.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "permission-denied": "You do not have permission to complete this action."
  };

  return messages[code] || error?.message || "Something went wrong. Please try again.";
}
