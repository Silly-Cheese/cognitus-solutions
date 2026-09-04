# Promotional Access V26

Promotional Access is Cognitus Solutions' entitlement layer for limited, temporary, permanent, beta, and campaign-based website features.

## Security model

Promotional Access unlocks product features. It does **not** grant staff roles, reviewer authority, administrator authority, organization permissions, or broader access to protected Cognitus records.

The locked-page blur is visual only. When a user lacks an entitlement, the protected feature renderer is not called, so the feature does not fetch protected subject data. Existing Firestore rules continue to decide which reports, employment records, organizations, and profiles an account can read.

Admins and Owners receive preview access to the promotional product surfaces, but their underlying data access still follows the existing role and record rules.

## User experience

Users can open `#/promotional-access` to redeem a code and view active access. Locked feature routes remain visible. Opening one displays a blurred synthetic preview and a lock modal containing the required message:

> You do not currently have permission to view this!

Users can redeem a promotional code directly from the modal. After a successful redemption, the entitlement cache refreshes and the feature can open immediately.

## Administrative controls

Admins and Owners can open `#/admin/promotions` to:

- create or bulk-generate promotional codes;
- set campaign start and redemption end times;
- limit total redemptions;
- limit redemptions per Cognitus account;
- choose permanent, duration-based, or fixed-end access;
- decide whether campaign expiration only stops new redemptions or also ends existing access;
- restrict a campaign to selected account roles or one organization;
- select any combination of Promotional Access features;
- pause, activate, or revoke a code;
- view redemption records;
- revoke existing access granted by a code;
- issue direct promotional grants without a code.

Owners can delete an unused promotional code.

## Promotional feature catalog

1. Cognitus Intelligence Center — `#/intelligence`
2. Relationship Mapping — `#/relationships`
3. Deep History — `#/deep-history`
4. Advanced Search — `#/advanced-search`
5. Cognitus Comparison — `#/compare`
6. Network Explorer — `#/network`
7. Watchlist — `#/watchlist`
8. Saved Investigations — `#/investigations`
9. Intelligence Reports — `#/intelligence-reports`
10. Account Change Comparison — `#/change-comparison`
11. Cognitus Labs — `#/labs`
12. Enhanced Profile Cards — `#/enhanced-profile`
13. Search Collections — `#/collections`
14. Search Analytics — `#/analytics`
15. Priority / Early Access — `#/early-access`

## Firestore collections

`promotionalCodes/{CODE}` stores campaign configuration and aggregate redemption count.

`promoRedemptions/{CODE}__{uid}` stores a user's redemption state and active feature IDs. Redemption occurs in a Firestore transaction with the campaign counter so total-use limits cannot be overrun by ordinary concurrent claims.

`promoAccessGrants/{grantId}` stores Admin/Owner-issued direct access.

`promoUserData/{recordId}` stores private promotional workspaces such as watchlists, investigations, reports, snapshots, profile-card preferences, collections, and promotional search activity.

Every user-facing query introduced by V26 is a single-field query or an unfiltered read followed by client-side filtering. V26 does not require composite indexes.

## Rule deployment

The existing Foundation V19 builder remains the source pipeline. `scripts/build-promotional-rules-v26.mjs` patches the generated `firestore.v19.rules` after the V19 build.

Run:

```bat
deploy-rules-v19.cmd
```

That command now executes both builders before deploying `firebase.v19.json`.

CI also runs the V26 regression validator and compiles the combined rules in the Firestore emulator.
