import fs from "node:fs";

// V36 feature catalog currently contains 18 entitlement identifiers, including Signal Zero.

const path="firestore.v19.rules";
if(!fs.existsSync(path))throw new Error("Promotional Access V26 requires firestore.v19.rules. Run build-firestore-v19.mjs first.");
let rules=fs.readFileSync(path,"utf8");
function fail(message){throw new Error(`Promotional Access V26 rules build failed: ${message}`);}
function replaceOnce(needle,replacement,label){const index=rules.indexOf(needle);if(index<0)fail(`missing ${label}`);if(rules.indexOf(needle,index+needle.length)>=0)fail(`ambiguous ${label}`);rules=rules.slice(0,index)+replacement+rules.slice(index+needle.length);}
if(rules.includes("Promotional Access V26 helpers")){console.log("Promotional Access V26 rules already present.");process.exit(0);}

const helpers=`    // Promotional Access V26 helpers.
    function promotionalCodePath(code) {
      return /databases/$(database)/documents/promotionalCodes/$(code);
    }

    function promoRedemptionPath(code, uid) {
      return /databases/$(database)/documents/promoRedemptions/$(code + '__' + uid);
    }

    function promoCampaignOpen(code) {
      return activeAccount()
        && exists(promotionalCodePath(code))
        && get(promotionalCodePath(code)).data.status == 'active'
        && (get(promotionalCodePath(code)).data.startsAt == null || get(promotionalCodePath(code)).data.startsAt <= request.time)
        && (get(promotionalCodePath(code)).data.redeemUntil == null || get(promotionalCodePath(code)).data.redeemUntil >= request.time)
        && (get(promotionalCodePath(code)).data.maxTotalRedemptions == 0
          || get(promotionalCodePath(code)).data.redeemedCount < get(promotionalCodePath(code)).data.maxTotalRedemptions);
    }

    function promoEligible(code) {
      return promoCampaignOpen(code)
        && role() in get(promotionalCodePath(code)).data.eligibleRoles
        && (get(promotionalCodePath(code)).data.eligibleOrganizationId == null
          || currentUser().organizationId == get(promotionalCodePath(code)).data.eligibleOrganizationId);
    }

    function validPromoExpiry(code, expiry) {
      return (
          get(promotionalCodePath(code)).data.accessMode == 'permanent'
          && expiry == null
        ) || (
          get(promotionalCodePath(code)).data.accessMode == 'fixed_end'
          && expiry == get(promotionalCodePath(code)).data.accessEndsAt
          && expiry > request.time
        ) || (
          get(promotionalCodePath(code)).data.accessMode == 'duration'
          && expiry is timestamp
          && expiry > request.time
          && expiry <= request.time + duration.value(get(promotionalCodePath(code)).data.accessDurationSeconds + 600, 's')
        );
    }

`;
replaceOnce("    function validDiscordId(value) {",helpers+"    function validDiscordId(value) {","helper insertion point");

const promoRules=`
    // Promotional Access V26: codes, entitlements, redemptions, and private feature workspaces.
    match /promotionalCodes/{code} {
      allow get: if activeAccount();
      allow list: if isAdmin();

      allow create: if isAdmin()
        && request.resource.data.keys().hasOnly([
          'id', 'code', 'campaignName', 'description', 'status', 'startsAt', 'redeemUntil',
          'maxTotalRedemptions', 'maxPerAccount', 'redeemedCount', 'accessMode',
          'accessDurationSeconds', 'accessEndsAt', 'campaignExpiryBehavior', 'featureIds',
          'eligibleRoles', 'eligibleOrganizationId', 'distribution', 'createdByUid',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == code
        && request.resource.data.code == code
        && code.matches('^[A-Z0-9_-]{4,40}$')
        && shortString(request.resource.data.campaignName, 100)
        && request.resource.data.campaignName.size() > 0
        && shortString(request.resource.data.description, 1000)
        && request.resource.data.status in ['active', 'paused', 'revoked']
        && (request.resource.data.startsAt == null || request.resource.data.startsAt is timestamp)
        && (request.resource.data.redeemUntil == null || request.resource.data.redeemUntil is timestamp)
        && request.resource.data.maxTotalRedemptions is int
        && request.resource.data.maxTotalRedemptions >= 0
        && request.resource.data.maxTotalRedemptions <= 100000
        && request.resource.data.maxPerAccount is int
        && request.resource.data.maxPerAccount >= 1
        && request.resource.data.maxPerAccount <= 100
        && request.resource.data.redeemedCount == 0
        && request.resource.data.accessMode in ['permanent', 'duration', 'fixed_end']
        && request.resource.data.accessDurationSeconds is int
        && request.resource.data.accessDurationSeconds >= 3600
        && request.resource.data.accessDurationSeconds <= 157680000
        && (request.resource.data.accessEndsAt == null || request.resource.data.accessEndsAt is timestamp)
        && request.resource.data.campaignExpiryBehavior in ['preserve_access', 'revoke_on_campaign_end']
        && request.resource.data.featureIds is list
        && request.resource.data.featureIds.size() >= 1
        && request.resource.data.featureIds.size() <= 18
        && request.resource.data.eligibleRoles is list
        && request.resource.data.eligibleRoles.size() >= 1
        && request.resource.data.eligibleRoles.size() <= 6
        && (request.resource.data.eligibleOrganizationId == null || shortString(request.resource.data.eligibleOrganizationId, 128))
        && request.resource.data.distribution in ['secret', 'campaign']
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if isAdmin()
        && request.resource.data.id == resource.data.id
        && request.resource.data.code == resource.data.code
        && request.resource.data.redeemedCount == resource.data.redeemedCount
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.status in ['active', 'paused', 'revoked']
        && shortString(request.resource.data.campaignName, 100)
        && shortString(request.resource.data.description, 1000)
        && request.resource.data.maxTotalRedemptions is int
        && request.resource.data.maxTotalRedemptions >= 0
        && request.resource.data.maxTotalRedemptions <= 100000
        && request.resource.data.maxPerAccount is int
        && request.resource.data.maxPerAccount >= 1
        && request.resource.data.maxPerAccount <= 100
        && request.resource.data.accessMode in ['permanent', 'duration', 'fixed_end']
        && request.resource.data.accessDurationSeconds is int
        && request.resource.data.accessDurationSeconds >= 3600
        && request.resource.data.accessDurationSeconds <= 157680000
        && (request.resource.data.startsAt == null || request.resource.data.startsAt is timestamp)
        && (request.resource.data.redeemUntil == null || request.resource.data.redeemUntil is timestamp)
        && (request.resource.data.accessEndsAt == null || request.resource.data.accessEndsAt is timestamp)
        && request.resource.data.campaignExpiryBehavior in ['preserve_access', 'revoke_on_campaign_end']
        && request.resource.data.featureIds is list
        && request.resource.data.featureIds.size() >= 1
        && request.resource.data.featureIds.size() <= 18
        && request.resource.data.eligibleRoles is list
        && request.resource.data.eligibleRoles.size() >= 1
        && request.resource.data.eligibleRoles.size() <= 6
        && (request.resource.data.eligibleOrganizationId == null || shortString(request.resource.data.eligibleOrganizationId, 128))
        && request.resource.data.distribution in ['secret', 'campaign']
        && request.resource.data.updatedAt == request.time;

      allow update: if promoEligible(code)
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['redeemedCount', 'updatedAt'])
        && request.resource.data.redeemedCount == resource.data.redeemedCount + 1
        && (resource.data.maxTotalRedemptions == 0 || request.resource.data.redeemedCount <= resource.data.maxTotalRedemptions)
        && request.resource.data.updatedAt == request.time
        && existsAfter(promoRedemptionPath(code, request.auth.uid))
        && getAfter(promoRedemptionPath(code, request.auth.uid)).data.promoId == code
        && getAfter(promoRedemptionPath(code, request.auth.uid)).data.uid == request.auth.uid
        && getAfter(promoRedemptionPath(code, request.auth.uid)).data.lastRedeemedAt == request.time;

      allow delete: if isOwner() && resource.data.redeemedCount == 0;
    }

    match /promoRedemptions/{redemptionId} {
      allow read: if isAdmin() || (activeAccount() && resource.data.uid == request.auth.uid);

      allow create: if activeAccount()
        && request.resource.data.keys().hasOnly([
          'id', 'promoId', 'code', 'uid', 'userCognitusId', 'redemptionCount', 'featureIds',
          'status', 'source', 'grantedAt', 'expiresAt', 'campaignEndsAt',
          'campaignExpiryBehavior', 'lastRedeemedAt', 'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == redemptionId
        && redemptionId == request.resource.data.promoId + '__' + request.auth.uid
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.code == request.resource.data.promoId
        && promoEligible(request.resource.data.promoId)
        && request.resource.data.userCognitusId == currentUser().cognitusId
        && request.resource.data.redemptionCount == 1
        && request.resource.data.redemptionCount <= get(promotionalCodePath(request.resource.data.promoId)).data.maxPerAccount
        && request.resource.data.featureIds == get(promotionalCodePath(request.resource.data.promoId)).data.featureIds
        && request.resource.data.status == 'active'
        && request.resource.data.source == 'promotional_code'
        && validPromoExpiry(request.resource.data.promoId, request.resource.data.expiresAt)
        && request.resource.data.campaignEndsAt == get(promotionalCodePath(request.resource.data.promoId)).data.redeemUntil
        && request.resource.data.campaignExpiryBehavior == get(promotionalCodePath(request.resource.data.promoId)).data.campaignExpiryBehavior
        && request.resource.data.grantedAt == request.time
        && request.resource.data.lastRedeemedAt == request.time
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && getAfter(promotionalCodePath(request.resource.data.promoId)).data.redeemedCount == get(promotionalCodePath(request.resource.data.promoId)).data.redeemedCount + 1;

      allow update: if activeAccount()
        && resource.data.uid == request.auth.uid
        && promoEligible(resource.data.promoId)
        && request.resource.data.id == resource.data.id
        && request.resource.data.promoId == resource.data.promoId
        && request.resource.data.code == resource.data.code
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.userCognitusId == resource.data.userCognitusId
        && request.resource.data.source == resource.data.source
        && request.resource.data.grantedAt == resource.data.grantedAt
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.redemptionCount == resource.data.redemptionCount + 1
        && request.resource.data.redemptionCount <= get(promotionalCodePath(resource.data.promoId)).data.maxPerAccount
        && request.resource.data.featureIds == get(promotionalCodePath(resource.data.promoId)).data.featureIds
        && request.resource.data.status == 'active'
        && validPromoExpiry(resource.data.promoId, request.resource.data.expiresAt)
        && request.resource.data.campaignEndsAt == get(promotionalCodePath(resource.data.promoId)).data.redeemUntil
        && request.resource.data.campaignExpiryBehavior == get(promotionalCodePath(resource.data.promoId)).data.campaignExpiryBehavior
        && request.resource.data.lastRedeemedAt == request.time
        && request.resource.data.updatedAt == request.time
        && getAfter(promotionalCodePath(resource.data.promoId)).data.redeemedCount == get(promotionalCodePath(resource.data.promoId)).data.redeemedCount + 1;

      allow update: if isAdmin()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['status', 'updatedAt'])
        && request.resource.data.status in ['active', 'revoked']
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

    match /promoAccessGrants/{grantId} {
      allow read: if isAdmin() || (activeAccount() && resource.data.uid == request.auth.uid);

      allow create: if isAdmin()
        && request.resource.data.keys().hasOnly([
          'id', 'uid', 'userCognitusId', 'featureIds', 'status', 'source', 'label', 'note',
          'expiresAt', 'grantedByUid', 'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == grantId
        && exists(userPath(request.resource.data.uid))
        && get(userPath(request.resource.data.uid)).data.status == 'active'
        && request.resource.data.userCognitusId == get(userPath(request.resource.data.uid)).data.cognitusId
        && request.resource.data.featureIds is list
        && request.resource.data.featureIds.size() >= 1
        && request.resource.data.featureIds.size() <= 18
        && request.resource.data.status == 'active'
        && request.resource.data.source == 'manual_grant'
        && shortString(request.resource.data.label, 80)
        && shortString(request.resource.data.note, 500)
        && (request.resource.data.expiresAt == null || request.resource.data.expiresAt is timestamp)
        && request.resource.data.grantedByUid == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if isAdmin()
        && request.resource.data.id == resource.data.id
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.userCognitusId == resource.data.userCognitusId
        && request.resource.data.source == resource.data.source
        && request.resource.data.grantedByUid == resource.data.grantedByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.featureIds is list
        && request.resource.data.featureIds.size() >= 1
        && request.resource.data.featureIds.size() <= 18
        && request.resource.data.status in ['active', 'revoked']
        && shortString(request.resource.data.label, 80)
        && shortString(request.resource.data.note, 500)
        && (request.resource.data.expiresAt == null || request.resource.data.expiresAt is timestamp)
        && request.resource.data.updatedAt == request.time;

      allow delete: if isOwner();
    }

    match /promoUserData/{recordId} {
      allow read: if isAdmin() || (activeAccount() && resource.data.ownerUid == request.auth.uid);

      allow create: if activeAccount()
        && request.resource.data.keys().hasOnly([
          'id', 'ownerUid', 'type', 'title', 'subjectId', 'organizationId', 'payload',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == recordId
        && request.resource.data.ownerUid == request.auth.uid
        && request.resource.data.type in [
          'watchlist', 'investigation', 'intelligence_report', 'snapshot',
          'profile_customization', 'collection', 'search_event'
        ]
        && shortString(request.resource.data.title, 120)
        && (request.resource.data.subjectId == null || shortString(request.resource.data.subjectId, 128))
        && (request.resource.data.organizationId == null || shortString(request.resource.data.organizationId, 128))
        && request.resource.data.payload is map
        && request.resource.data.payload.keys().size() <= 30
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeAccount()
        && resource.data.ownerUid == request.auth.uid
        && request.resource.data.id == resource.data.id
        && request.resource.data.ownerUid == resource.data.ownerUid
        && request.resource.data.type == resource.data.type
        && request.resource.data.createdAt == resource.data.createdAt
        && shortString(request.resource.data.title, 120)
        && (request.resource.data.subjectId == null || shortString(request.resource.data.subjectId, 128))
        && (request.resource.data.organizationId == null || shortString(request.resource.data.organizationId, 128))
        && request.resource.data.payload is map
        && request.resource.data.payload.keys().size() <= 30
        && request.resource.data.updatedAt == request.time;

      allow delete: if isAdmin() || (activeAccount() && resource.data.ownerUid == request.auth.uid);
    }

`;
const catchAll="    match /{document=**} {\n      allow read, write: if false;\n    }";
replaceOnce(catchAll,promoRules+catchAll,"catch-all insertion point");
fs.writeFileSync(path,rules);
console.log("Promotional Access V26 rules appended to firestore.v19.rules");
