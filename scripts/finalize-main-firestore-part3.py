from pathlib import Path
import re

RULES = Path('firestore.rules')
REPORT = Path('docs/FIRESTORE_PART3_OPERATIONS_SECURITY_AUDIT.md')

rules = RULES.read_text(encoding='utf-8')

PART2_MARKER = '// FIRESTORE_PART2_STAFF_COMPANY_COMPLETE'
PART3_MARKER = '// FIRESTORE_PART3_OPERATIONS_SECURITY_COMPLETE'


def fail(message):
    raise RuntimeError(f'Firestore Part 3 finalization failed: {message}')


def block_bounds(text, header):
    start = text.find(header)
    if start < 0:
        fail(f'could not find {header}')
    end = text.find('\n    match /', start + len(header))
    if end < 0:
        fail(f'could not bound {header}')
    return start, end


def get_block(header):
    start, end = block_bounds(rules, header)
    return start, end, rules[start:end]


def put_block(start, end, block):
    global rules
    rules = rules[:start] + block + rules[end:]


if PART2_MARKER not in rules:
    fail('Part 2 completion marker is missing; run the Part 2 finalizer first')

if PART3_MARKER not in rules:
    # ------------------------------------------------------------------
    # PRODUCT / COMMAND BRIDGE: least privilege.
    # Appeals may read reports required for review, but they must not inherit
    # full report-review update authority. Claims may link a matching profile,
    # but do not inherit broad profile-risk editing authority.
    # ------------------------------------------------------------------
    start, end, block = get_block('    match /reports/{reportId} {')
    broad_report_update = "allow update: if (isReviewer() || staffPermission('reports.review') || staffPermission('appeals.review'))"
    if broad_report_update in block:
        block = block.replace(
            broad_report_update,
            "allow update: if (isReviewer() || staffPermission('reports.review'))",
            1,
        )

    appeal_rule = '''

      // Staff appeal authority is deliberately narrower than report-review
      // authority. It can only move an already reviewed report into the
      // disputed/private-review state used after an accepted appeal.
      allow update: if staffPermission('appeals.review')
        && resource.data.status in ['approved', 'published']
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'visibility', 'appealStatus', 'reviewedByUid', 'reviewedAt', 'updatedAt'
        ])
        && request.resource.data.status == 'disputed'
        && request.resource.data.visibility == 'private_review'
        && request.resource.data.appealStatus == 'accepted'
        && request.resource.data.reviewedByUid == request.auth.uid
        && request.resource.data.reviewedAt == request.time
        && request.resource.data.updatedAt == request.time;
'''
    if 'Staff appeal authority is deliberately narrower' not in block:
        marker = '\n      allow delete: if isOwner()'
        if marker not in block:
            fail('could not locate reports delete rule for appeal insertion')
        block = block.replace(marker, appeal_rule + marker, 1)
    put_block(start, end, block)

    start, end, block = get_block('    match /profiles/{profileId} {')
    broad_profile_update = "allow update: if (isReviewer() || staffPermission('reports.review') || staffPermission('claims.review') || staffPermission('verification.review'))"
    if broad_profile_update in block:
        block = block.replace(broad_profile_update, 'allow update: if isReviewer()', 1)

    claim_rule = '''

      // Standard Staff / Command claim approval: link only to an active user
      // whose immutable Cognitus Discord ID is already present on the profile.
      // Claim reviewers do not receive risk, standing, alias, or report-edit authority.
      allow update: if staffPermission('claims.review')
        && resource.data.claimedByUid == null
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'claimedByUid', 'identityStatus', 'updatedAt'
        ])
        && request.resource.data.claimedByUid is string
        && request.resource.data.identityStatus == 'claimed_unverified'
        && exists(userPath(request.resource.data.claimedByUid))
        && get(userPath(request.resource.data.claimedByUid)).data.status == 'active'
        && get(userPath(request.resource.data.claimedByUid)).data.discordId in resource.data.discordIds
        && request.resource.data.updatedAt == request.time;
'''
    if 'Standard Staff / Command claim approval' not in block:
        marker = "\n      allow update: if (isReviewer() || staffPermission('claims.review') || staffPermission('verification.review'))"
        if marker not in block:
            fail('could not locate external-profile link rule for claim insertion')
        block = block.replace(marker, claim_rule + marker, 1)
    put_block(start, end, block)

    # ------------------------------------------------------------------
    # OPERATIONS DATA INTEGRITY.
    # Evidence and corrective actions must point at real Command records.
    # QA records retain immutable subject/reviewer identity after creation.
    # ------------------------------------------------------------------
    start, end, block = get_block('    match /commandEvidence/{evidenceId} {')
    evidence_anchor = '''        && commandG3ValidEvidence(request.resource.data, evidenceId)
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.createdAt == request.time'''
    evidence_hardened = '''        && commandG3ValidEvidence(request.resource.data, evidenceId)
        && request.resource.data.createdByUid == request.auth.uid
        && exists(/databases/$(database)/documents/commandCases/$(request.resource.data.caseId))
        && request.resource.data.createdAt == request.time'''
    if evidence_anchor in block:
        block = block.replace(evidence_anchor, evidence_hardened, 1)
    elif 'documents/commandCases/$(request.resource.data.caseId)' not in block:
        fail('could not harden evidence-to-case integrity')
    put_block(start, end, block)

    start, end, block = get_block('    match /commandQaReviews/{reviewId} {')
    qa_anchor = '''        && request.resource.data.id == resource.data.id
        && request.resource.data.cognitusId == resource.data.cognitusId
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt'''
    qa_hardened = '''        && request.resource.data.id == resource.data.id
        && request.resource.data.cognitusId == resource.data.cognitusId
        && request.resource.data.subjectType == resource.data.subjectType
        && request.resource.data.subjectId == resource.data.subjectId
        && request.resource.data.departmentId == resource.data.departmentId
        && request.resource.data.employeeUid == resource.data.employeeUid
        && request.resource.data.reviewerUid == resource.data.reviewerUid
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt'''
    if qa_anchor in block:
        block = block.replace(qa_anchor, qa_hardened, 1)
    elif 'request.resource.data.reviewerUid == resource.data.reviewerUid' not in block:
        fail('could not harden QA immutable review identity')
    put_block(start, end, block)

    start, end, block = get_block('    match /commandCorrectiveActions/{actionId} {')
    corrective_anchor = '''        && commandG3ValidCorrectiveAction(request.resource.data, actionId)
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.createdAt == request.time'''
    corrective_hardened = '''        && commandG3ValidCorrectiveAction(request.resource.data, actionId)
        && request.resource.data.createdByUid == request.auth.uid
        && exists(/databases/$(database)/documents/commandQaReviews/$(request.resource.data.qaReviewId))
        && request.resource.data.createdAt == request.time'''
    if corrective_anchor in block:
        block = block.replace(corrective_anchor, corrective_hardened, 1)
    elif 'documents/commandQaReviews/$(request.resource.data.qaReviewId)' not in block:
        fail('could not harden corrective-action QA linkage')
    put_block(start, end, block)

    # ------------------------------------------------------------------
    # PUBLIC RELATIONS APPROVALS.
    # PR managers may draft/submit and later publish approved content, but may
    # not jump directly from unapproved work to published. A non-Owner approver
    # also cannot approve their own authored item.
    # ------------------------------------------------------------------
    start, end, block = get_block('    match /commandPrItems/{itemId} {')
    old_pr_manage = '''      allow update: if (isOwner() || staffPermission('pr.manage'))
        && commandG3ValidPrItem(request.resource.data, itemId)
        && request.resource.data.id == resource.data.id
        && request.resource.data.cognitusId == resource.data.cognitusId
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.status in ['draft', 'pending_approval', 'published', 'closed']
        && request.resource.data.approvedByUid == resource.data.approvedByUid
        && request.resource.data.approvedAt == resource.data.approvedAt
        && request.resource.data.updatedAt == request.time
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'type', 'title', 'status', 'body', 'url', 'ownerUid', 'updatedAt'
        ]);
'''
    new_pr_manage = '''      // Pre-approval work may be edited or submitted, never published directly.
      allow update: if (isOwner() || staffPermission('pr.manage'))
        && commandG3ValidPrItem(request.resource.data, itemId)
        && request.resource.data.id == resource.data.id
        && request.resource.data.cognitusId == resource.data.cognitusId
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && resource.data.status in ['draft', 'pending_approval']
        && request.resource.data.status in ['draft', 'pending_approval']
        && request.resource.data.approvedByUid == resource.data.approvedByUid
        && request.resource.data.approvedAt == resource.data.approvedAt
        && request.resource.data.updatedAt == request.time
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'type', 'title', 'status', 'body', 'url', 'ownerUid', 'updatedAt'
        ]);

      // Once approved, PR management may publish or close while preserving
      // the independent approval identity and timestamp.
      allow update: if (isOwner() || staffPermission('pr.manage'))
        && commandG3ValidPrItem(request.resource.data, itemId)
        && request.resource.data.id == resource.data.id
        && request.resource.data.cognitusId == resource.data.cognitusId
        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && resource.data.status in ['approved', 'published']
        && request.resource.data.status in ['published', 'closed']
        && request.resource.data.approvedByUid == resource.data.approvedByUid
        && request.resource.data.approvedAt == resource.data.approvedAt
        && resource.data.approvedByUid != null
        && resource.data.approvedAt != null
        && request.resource.data.updatedAt == request.time
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'type', 'title', 'status', 'body', 'url', 'ownerUid', 'updatedAt'
        ]);
'''
    if old_pr_manage in block:
        block = block.replace(old_pr_manage, new_pr_manage, 1)
    elif 'Pre-approval work may be edited or submitted' not in block:
        fail('could not split PR pre/post-approval transitions')

    old_pr_approve = "      allow update: if (isOwner() || staffPermission('pr.approve'))\n        && commandG3ValidPrItem(request.resource.data, itemId)"
    new_pr_approve = "      allow update: if (isOwner() || (staffPermission('pr.approve') && resource.data.createdByUid != request.auth.uid))\n        && resource.data.status == 'pending_approval'\n        && commandG3ValidPrItem(request.resource.data, itemId)"
    if old_pr_approve in block:
        block = block.replace(old_pr_approve, new_pr_approve, 1)
    elif "resource.data.status == 'pending_approval'" not in block:
        fail('could not harden PR approval decision')
    put_block(start, end, block)

    # ------------------------------------------------------------------
    # EXECUTIVE APPROVALS.
    # Decisions are one-way from pending, and system managers cannot decide
    # their own request. Owner retains emergency override authority.
    # ------------------------------------------------------------------
    start, end, block = get_block('    match /commandExecutiveApprovals/{approvalId} {')
    exec_anchor = "      allow update: if (isOwner() || staffPermission('system.manage'))\n        && commandG3ValidExecutiveApproval(request.resource.data, approvalId)"
    exec_hardened = "      allow update: if (isOwner() || (staffPermission('system.manage') && resource.data.requestedByUid != request.auth.uid))\n        && resource.data.status == 'pending'\n        && commandG3ValidExecutiveApproval(request.resource.data, approvalId)"
    if exec_anchor in block:
        block = block.replace(exec_anchor, exec_hardened, 1)
    elif "resource.data.status == 'pending'" not in block:
        fail('could not harden executive approval decisions')
    put_block(start, end, block)

    marker = '    // COMMAND_GENERATION_3_END'
    if marker not in rules:
        fail('missing Generation 3 completion anchor')
    rules = rules.replace(marker, f'    {PART3_MARKER}\n\n{marker}', 1)

RULES.write_text(rules, encoding='utf-8')

# ----------------------------------------------------------------------
# FINAL THREE-PART AUDIT
# ----------------------------------------------------------------------
required_operations = [
    'commandCases', 'commandEvidence', 'commandAccreditations',
    'commandEscalations', 'commandIncidents', 'commandQaReviews',
    'commandCorrectiveActions', 'commandPrCampaigns', 'commandPrItems',
    'commandCsMacros', 'commandExecutiveApprovals',
]
required_company = [
    'commandAvailability', 'commandInternalAffairs', 'commandPerformance',
    'commandPolicyAcknowledgements', 'commandRecognition', 'commandSuggestions',
]

match_names = set(re.findall(r'match\s+/([A-Za-z0-9_-]+)(?:/|\{)', rules))
missing_ops = [name for name in required_operations if name not in match_names]
missing_company = [name for name in required_company if name not in match_names]

checks = {
    'Part 1 main-product completion preserved': 'MAIN COGNITUS — PART 1 COMPLETION' in rules,
    'Part 2 staff/company completion preserved': PART2_MARKER in rules,
    'Part 3 operations/security completion present': PART3_MARKER in rules,
    'staff authority remains separate from product role': 'function staffPermission(permission)' in rules and 'function activeStaff()' in rules,
    'appeals do not inherit full report-update authority': "allow update: if (isReviewer() || staffPermission('reports.review') || staffPermission('appeals.review'))" not in rules,
    'appeals retain only the accepted-dispute transition': 'Staff appeal authority is deliberately narrower' in rules,
    'claims do not inherit broad profile-risk editing': "allow update: if (isReviewer() || staffPermission('reports.review') || staffPermission('claims.review') || staffPermission('verification.review'))" not in rules,
    'claim approval requires immutable Discord identity match': 'data.discordId in resource.data.discordIds' in rules,
    'evidence must reference a real Command case': 'documents/commandCases/$(request.resource.data.caseId)' in rules,
    'QA review subject and reviewer identity are immutable': 'request.resource.data.reviewerUid == resource.data.reviewerUid' in rules and 'request.resource.data.subjectId == resource.data.subjectId' in rules,
    'corrective action must reference a real QA review': 'documents/commandQaReviews/$(request.resource.data.qaReviewId)' in rules,
    'PR cannot publish directly before approval': "request.resource.data.status in ['draft', 'pending_approval', 'published', 'closed']" not in rules and 'Pre-approval work may be edited or submitted' in rules,
    'PR approval starts from pending approval': "resource.data.status == 'pending_approval'" in rules,
    'non-owner PR approver cannot approve own authored item': "staffPermission('pr.approve') && resource.data.createdByUid != request.auth.uid" in rules,
    'executive decision starts from pending': "resource.data.status == 'pending'" in rules,
    'system manager cannot decide own executive request': "staffPermission('system.manage') && resource.data.requestedByUid != request.auth.uid" in rules,
    'background checks remain self-service with no approval queue': 'backgroundCheckApprovals' not in match_names and 'commandBackgroundChecks' not in match_names,
    'default deny preserved': 'match /{document=**}' in rules and 'allow read, write: if false;' in rules,
    'no composite-index configuration file': not Path('firestore.indexes.json').exists(),
    'rules source remains under repository safety ceiling': RULES.stat().st_size < 220000,
}

failed = [label for label, ok in checks.items() if not ok]

lines = [
    '# Firestore Part 3 — Operations & Final Security Audit',
    '',
    'This is the final audit for the single authoritative `cognitus-solutions/firestore.rules`.',
    '',
    f'- Rules source bytes: **{RULES.stat().st_size:,}**',
    f'- Operational collections checked: **{len(required_operations)}**',
    f'- Part 2 company-completion collections rechecked: **{len(required_company)}**',
    '',
    '## Operational collection coverage',
    '',
]
for name in required_operations:
    lines.append(f'- {"✅" if name in match_names else "❌"} `{name}`')

lines += ['', '## Part 2 company completion recheck', '']
for name in required_company:
    lines.append(f'- {"✅" if name in match_names else "❌"} `{name}`')

lines += ['', '## Final security invariants', '']
for label, ok in checks.items():
    lines.append(f'- {"✅" if ok else "❌"} {label}')

lines += [
    '',
    '## Part 3 hardening',
    '',
    '- Appeals no longer inherit general report-update authority.',
    '- Claims no longer inherit broad profile risk/standing editing authority.',
    '- Evidence and QA corrective actions require valid parent Command records.',
    '- QA subject and reviewer identity cannot be rewritten after creation.',
    '- PR content cannot bypass approval by moving directly from draft/pending to published.',
    '- Non-Owner PR approvers cannot approve their own authored item.',
    '- Executive decisions are one-way from pending; non-Owner system managers cannot self-approve.',
    '- Background checks remain automatic/self-service and receive no staff approval queue.',
    '',
    '## Findings',
    '',
    'Missing operational collections: ' + (', '.join(f'`{x}`' for x in missing_ops) if missing_ops else 'none.'),
    'Missing Part 2 company collections: ' + (', '.join(f'`{x}`' for x in missing_company) if missing_company else 'none.'),
    'Failed invariants: ' + (', '.join(f'`{x}`' for x in failed) if failed else 'none.'),
    '',
    '## Deployment note',
    '',
    'This audit validates the repository ruleset. Publishing to Firebase remains a separate deployment action; GitHub Pages does not deploy Firestore rules.',
]

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8')

print('Part 3 complete.')
print('Missing operations:', missing_ops)
print('Missing Part 2 company collections:', missing_company)
print('Failed invariants:', failed)

if missing_ops or missing_company or failed:
    raise SystemExit(1)
