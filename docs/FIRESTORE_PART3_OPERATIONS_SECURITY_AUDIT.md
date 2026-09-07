# Firestore Part 3 — Operations & Final Security Audit

This is the final audit for the single authoritative `cognitus-solutions/firestore.rules`.

- Rules source bytes: **205,391**
- Operational collections checked: **11**
- Part 2 company-completion collections rechecked: **6**

## Operational collection coverage

- ✅ `commandCases`
- ✅ `commandEvidence`
- ✅ `commandAccreditations`
- ✅ `commandEscalations`
- ✅ `commandIncidents`
- ✅ `commandQaReviews`
- ✅ `commandCorrectiveActions`
- ✅ `commandPrCampaigns`
- ✅ `commandPrItems`
- ✅ `commandCsMacros`
- ✅ `commandExecutiveApprovals`

## Part 2 company completion recheck

- ✅ `commandAvailability`
- ✅ `commandInternalAffairs`
- ✅ `commandPerformance`
- ✅ `commandPolicyAcknowledgements`
- ✅ `commandRecognition`
- ✅ `commandSuggestions`

## Final security invariants

- ✅ Part 1 main-product completion preserved
- ✅ Part 2 staff/company completion preserved
- ✅ Part 3 operations/security completion present
- ✅ staff authority remains separate from product role
- ✅ appeals do not inherit full report-update authority
- ✅ appeals retain only the accepted-dispute transition
- ✅ claims do not inherit broad profile-risk editing
- ✅ claim approval requires immutable Discord identity match
- ✅ evidence must reference a real Command case
- ✅ QA review subject and reviewer identity are immutable
- ✅ corrective action must reference a real QA review
- ✅ PR cannot publish directly before approval
- ✅ PR approval starts from pending approval
- ✅ non-owner PR approver cannot approve own authored item
- ✅ executive decision starts from pending
- ✅ system manager cannot decide own executive request
- ✅ background checks remain self-service with no approval queue
- ✅ default deny preserved
- ✅ no composite-index configuration file
- ✅ rules source remains under repository safety ceiling

## Part 3 hardening

- Appeals no longer inherit general report-update authority.
- Claims no longer inherit broad profile risk/standing editing authority.
- Evidence and QA corrective actions require valid parent Command records.
- QA subject and reviewer identity cannot be rewritten after creation.
- PR content cannot bypass approval by moving directly from draft/pending to published.
- Non-Owner PR approvers cannot approve their own authored item.
- Executive decisions are one-way from pending; non-Owner system managers cannot self-approve.
- Background checks remain automatic/self-service and receive no staff approval queue.

## Findings

Missing operational collections: none.
Missing Part 2 company collections: none.
Failed invariants: none.

## Deployment note

This audit validates the repository ruleset. Publishing to Firebase remains a separate deployment action; GitHub Pages does not deploy Firestore rules.
