# Firestore Part 1 — Main Cognitus Audit

This report is generated from the current main-site source and the authoritative `firestore.rules`.

- Rules source bytes: **174,692**
- Explicit top-level match names: **54**
- Expected main collections: **46**

## Required main collection coverage

- ✅ `appeals`
- ✅ `auditLogs`
- ❌ `candidatePipelines`
- ❌ `certifications`
- ✅ `checkLogs`
- ✅ `claims`
- ✅ `downloads`
- ❌ `duplicateReviews`
- ❌ `employerCandidateNotes`
- ✅ `employerCandidates`
- ❌ `employerRecognition`
- ✅ `employerStatusRequests`
- ❌ `employerWorkspaceItems`
- ❌ `employmentHistory`
- ✅ `employmentRecordDisputes`
- ✅ `employmentRecords`
- ✅ `externalProfileClaims`
- ❌ `intelligenceReports`
- ❌ `intelligenceSnapshots`
- ❌ `maintenanceRuns`
- ❌ `notifications`
- ✅ `organizationMembers`
- ✅ `organizations`
- ✅ `ownerReportAccessGrants`
- ✅ `passwordResetRequests`
- ❌ `privateNotes`
- ❌ `profileCustomizations`
- ✅ `profiles`
- ❌ `promoEntitlements`
- ✅ `promoRedemptions`
- ✅ `promotionalCodes`
- ❌ `promotionalWorkspaceItems`
- ❌ `promotionalWorkspaces`
- ✅ `reportAccessGrants`
- ✅ `reportAccessRequests`
- ✅ `reports`
- ❌ `savedCandidates`
- ❌ `savedInvestigations`
- ❌ `savedOrganizations`
- ❌ `searchCollections`
- ❌ `searchEvents`
- ✅ `settings`
- ❌ `signalZeroEvents`
- ❌ `systemIncidents`
- ✅ `users`
- ❌ `watchlists`

## Source-discovered collection candidates

- ✅ `appeals` — src/app.js, src/appV1.js, src/firebase/collections.js, src/foundationCoreV19.js
- ✅ `auditLogs` — src/app.js, src/assessmentV4.js, src/controlsV4.js, src/employerStatusV10.js
- ⚠️ `bootstrap` — src/firebase/collections.js
- ⚠️ `candidatePipelines` — src/firebase/collections.js
- ⚠️ `certifications` — src/firebase/collections.js
- ✅ `checkLogs` — src/app.js, src/appV1.js, src/comprehensiveReportV15.js, src/firebase/collections.js
- ✅ `claims` — src/app.js, src/appV1.js, src/firebase/collections.js, src/foundationCoreV19.js
- ✅ `downloads` — src/app.js, src/firebase/collections.js
- ⚠️ `duplicateReviews` — src/firebase/collections.js
- ✅ `employerCandidates` — src/employerWorkspaceV11.js, src/foundationCoreV19.js
- ✅ `employerStatusRequests` — src/employerHubFixV12.js, src/employerStatusV10.js
- ⚠️ `employmentHistory` — src/firebase/collections.js
- ✅ `employmentRecordDisputes` — src/employerWorkspaceV11.js, src/foundationCoreV19.js
- ✅ `employmentRecords` — src/employerWorkspaceV11.js, src/foundationCoreV19.js
- ✅ `externalProfileClaims` — src/employerWorkspaceV11.js
- ⚠️ `notifications` — src/firebase/collections.js
- ✅ `organizationMembers` — src/foundationCoreV19.js
- ✅ `organizations` — src/app.js, src/appV1.js, src/controlsV4.js, src/employerHubFixV12.js
- ✅ `ownerReportAccessGrants` — src/ownerReportGrantsV9.js
- ✅ `passwordResetRequests` — src/firebase/collections.js
- ⚠️ `portal` — src/firebase/collections.js, src/services/portalSettingsService.js
- ✅ `privacyRequests` — src/foundationCoreV19.js
- ⚠️ `privateNotes` — src/firebase/collections.js
- ✅ `profileMergeMap` — src/foundationCoreV19.js
- ✅ `profiles` — src/app.js, src/appV1.js, src/assessmentV4.js, src/comprehensiveReportV15.js
- ✅ `promoAccessGrants` — src/promo/promotionalAdminV26.js
- ✅ `promoRedemptions` — src/promo/promotionalAdminV26.js, src/promo/promotionalCoreV26.js, src/promo/promotionalEnhancementsV28.js
- ✅ `promoUserData` — src/promo/promotionalCoreV26.js
- ✅ `promotionalCodes` — src/promo/promotionalAdminV26.js, src/promo/promotionalCoreV26.js, src/promo/promotionalEnhancementsV28.js, src/promo/promotionalRegistryV33.js
- ✅ `reportAccessGrants` — src/foundationCoreV19.js, src/reportAccessV8.js
- ✅ `reportAccessRequests` — src/employerWorkspaceV11.js, src/foundationCoreV19.js, src/reportAccessV8.js
- ✅ `reports` — src/app.js, src/appV1.js, src/comprehensiveReportV15.js, src/controlsV4.js
- ⚠️ `savedCandidates` — src/firebase/collections.js
- ⚠️ `savedOrganizations` — src/firebase/collections.js
- ✅ `screeningReportSummaries` — src/employerWorkspaceV11.js, src/foundationCoreV19.js, src/reportAccessV8.js
- ✅ `settings` — src/appV1.js, src/executiveMaintenanceV44.js, src/firebase/collections.js, src/foundationCoreV19.js
- ✅ `staffAccess` — src/app.js, src/staffCommandLinkG1.js
- ✅ `users` — src/app.js, src/appV1.js, src/assessmentV4.js, src/comprehensiveReportV15.js

## Security invariants

- ✅ default deny
- ✅ background checks remain self-service
- ✅ promotional access is product-only
- ❌ portal settings owner controlled
- ✅ reports explicitly matched
- ✅ appeals explicitly matched
- ✅ claims explicitly matched
- ✅ organizations explicitly matched
- ✅ profiles explicitly matched

## Findings

Expected main collections without explicit rules: `candidatePipelines`, `certifications`, `duplicateReviews`, `employerCandidateNotes`, `employerRecognition`, `employerWorkspaceItems`, `employmentHistory`, `intelligenceReports`, `intelligenceSnapshots`, `maintenanceRuns`, `notifications`, `privateNotes`, `profileCustomizations`, `promoEntitlements`, `promotionalWorkspaceItems`, `promotionalWorkspaces`, `savedCandidates`, `savedInvestigations`, `savedOrganizations`, `searchCollections`, `searchEvents`, `signalZeroEvents`, `systemIncidents`, `watchlists`
Source-discovered names without explicit rules: `bootstrap`, `candidatePipelines`, `certifications`, `duplicateReviews`, `employmentHistory`, `notifications`, `portal`, `privateNotes`, `savedCandidates`, `savedOrganizations`
Failed security invariants: `portal settings owner controlled`
