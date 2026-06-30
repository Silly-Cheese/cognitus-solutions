// Owner bootstrap configuration.
// Replace the Discord ID below before launch.
// The app will only bootstrap the owner role when the signed-in user's Discord ID matches this value.

export const OWNER_BOOTSTRAP = Object.freeze({
  ownerDiscordId: "PASTE_OWNER_DISCORD_ID_HERE",
  ownerDisplayName: "Christopher Shelley",
  ownerRobloxUsername: "Executive_Eagle",
  lockAfterFirstBootstrap: true
});

export function isOwnerBootstrapConfigured() {
  return Boolean(
    OWNER_BOOTSTRAP.ownerDiscordId &&
      !OWNER_BOOTSTRAP.ownerDiscordId.startsWith("PASTE_") &&
      /^\d{15,25}$/.test(OWNER_BOOTSTRAP.ownerDiscordId)
  );
}
