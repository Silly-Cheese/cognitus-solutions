# Firestore Model

Cognitus V1 is a client-side GitHub Pages app using Firebase Authentication and Cloud Firestore.

Collections are created naturally through application writes.

## Core Collections

```text
users
organizations
profiles
reports
checkLogs
appeals
claims
notifications
auditLogs
passwordResetRequests
savedCandidates
savedOrganizations
candidatePipelines
privateNotes
downloads
duplicateReviews
employmentHistory
certifications
settings
```

## Permanent Cognitus IDs

Every major record receives a human-readable Cognitus ID, such as:

```text
USR-26-8F3A91
ORG-26-4D71BC
PRF-26-11ZXA8
RPT-26-91E2F4
CHK-26-A3C8D7
APL-26-Z9N3B5
```

Firestore document IDs remain random Firebase IDs. Cognitus IDs are displayed in the UI, reports, audit logs, and support references.

## User Records

Collection:

```text
users/{uid}
```

Important fields:

```text
uid
cognitusId
displayName
discordUsername
discordId
accountType
role
status
organizationId
syntheticEmail
realEmailCollected
createdAt
updatedAt
lastLoginAt
```

## Profiles

Collection:

```text
profiles/{profileId}
```

Profiles represent people, not just usernames.

Important fields:

```text
cognitusId
type
displayName
robloxUsernames[]
discordUsernames[]
discordIds[]
knownAliases[]
claimedByUid
identityStatus
identityConfidence
professionalStanding
riskLevel
reportCount
appealCount
```

## Organizations

Collection:

```text
organizations/{organizationId}
```

Important fields:

```text
cognitusId
name
searchableName
organizationType
ownerDiscordUsername
ownerDiscordId
verificationStatus
trustLevel
memberCount
reportsSubmitted
reportAccuracy
disputeHistoryCount
publicNotes
```

## Check Logs

Every check requires a reason.

Collection:

```text
checkLogs/{checkId}
```

Important fields:

```text
cognitusId
checkedByUid
checkedByCognitusId
checkedByDiscordId
organizationId
searchType
searchField
searchQuery
reason
additionalNotes
targetProfileId
targetOrganizationId
resultSummary
downloadedReport
```

## Reports

Reports do not publish automatically.

Collection:

```text
reports/{reportId}
```

Important fields:

```text
cognitusId
subjectProfileId
subjectOrganizationId
submittedByUid
submittedByOrganizationId
category
severity
summary
details
status
visibility
reviewedByUid
reviewedAt
publishedAt
appealStatus
```

## Claims

Profile claims use Discord ID matching and reviewer approval.

Collection:

```text
claims/{claimId}
```

## Appeals

Appeals preserve history and update status rather than deleting records.

Collection:

```text
appeals/{appealId}
```

## Audit Logs

Important actions create audit logs.

Collection:

```text
auditLogs/{auditId}
```

Examples:

```text
ACCOUNT_CREATED
CHECK_CREATED
REPORT_SUBMITTED
CLAIM_SUBMITTED
APPEAL_SUBMITTED
REPORT_DOWNLOADED
RECORD_UPDATED
OWNER_BOOTSTRAPPED
```

## Security Reminder

Frontend services are not security. Firestore Security Rules must enforce who can read and write each collection.
