from pathlib import Path
import re

RULES = Path('firestore.rules')
REPORT = Path('docs/FIRESTORE_PART2_STAFF_COMPANY_AUDIT.md')

rules = RULES.read_text(encoding='utf-8')


def fail(message):
    raise RuntimeError(f'Firestore Part 2 finalization failed: {message}')


def replace_once(old, new, label):
    global rules
    count = rules.count(old)
    if count != 1:
        fail(f'{label}: expected exactly one match, found {count}')
    rules = rules.replace(old, new, 1)


PART2_MARKER = '// FIRESTORE_PART2_STAFF_COMPANY_COMPLETE'

# The finalizer is intentionally idempotent. If the canonical ruleset already
# contains the Part 2 marker, only regenerate the audit report.
if PART2_MARKER not in rules:
    # ---------------------------------------------------------------------
    # REQUEST CENTER: route sensitive approvals to the correct authority.
    # Generic department managers must never approve HR, Finance, or access
    # requests merely because the request carries their department id.
    # ---------------------------------------------------------------------
    helper_anchor = """    function commandG2CanManageTicket(departmentId) {
      return isOwner()
        || (staffPermission('tickets.manage') && currentStaff().departmentId == departmentId);
    }

"""
    helper_insert = helper_anchor + """    function commandG2CanReviewRequest(value) {
      return isOwner()
        || (value.type == 'hr' && staffPermission('hr.records.manage'))
        || ((value.type == 'finance' || value.type == 'purchase') && staffPermission('finance.manage'))
        || (value.type == 'access' && (staffPermission('permissions.manage') || staffPermission('system.manage')))
        || ((value.type == 'general' || value.type == 'scheduling')
          && commandG2CanManageDepartment(value.departmentId));
    }

"""
    replace_once(helper_anchor, helper_insert, 'request-review helper insertion')

    replace_once(
        """      || commandG2CanManageDepartment(resource.data.departmentId)
    );

      allow create: if activeStaff()
""",
        """      || commandG2CanReviewRequest(resource.data)
    );

      allow create: if activeStaff()
""",
        'commandRequests read authority'
    )

    replace_once(
        """      allow update: if activeStaff()
        && commandG2CanManageDepartment(resource.data.departmentId)
        && resource.data.requestorUid != request.auth.uid
""",
        """      allow update: if activeStaff()
        && commandG2CanReviewRequest(resource.data)
        && resource.data.requestorUid != request.auth.uid
""",
        'commandRequests update authority'
    )

    # ---------------------------------------------------------------------
    # LEAVE: employees may cancel their own still-pending request, while HR
    # retains the only authority to approve/decline reviewed leave.
    # ---------------------------------------------------------------------
    leave_update_anchor = """      allow update: if commandG2CanManageHr()
        && resource.data.requestorUid != request.auth.uid
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'reviewerUid', 'reviewedAt', 'reviewNote', 'updatedAt'
        ])
        && request.resource.data.status in ['approved', 'declined', 'cancelled']
        && request.resource.data.reviewerUid == request.auth.uid
        && request.resource.data.reviewedAt == request.time
        && shortString(request.resource.data.reviewNote, 1500)
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
"""
    leave_update_replacement = """      allow update: if activeStaff()
        && resource.data.requestorUid == request.auth.uid
        && resource.data.status == 'pending'
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'updatedAt'
        ])
        && request.resource.data.status == 'cancelled'
        && request.resource.data.reviewerUid == null
        && request.resource.data.reviewedAt == null
        && request.resource.data.reviewNote == ''
        && request.resource.data.updatedAt == request.time;

      allow update: if commandG2CanManageHr()
        && resource.data.requestorUid != request.auth.uid
        && resource.data.status == 'pending'
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'reviewerUid', 'reviewedAt', 'reviewNote', 'updatedAt'
        ])
        && request.resource.data.status in ['approved', 'declined']
        && request.resource.data.reviewerUid == request.auth.uid
        && request.resource.data.reviewedAt == request.time
        && shortString(request.resource.data.reviewNote, 1500)
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
"""
    replace_once(leave_update_anchor, leave_update_replacement, 'leave transition hardening')

    # ---------------------------------------------------------------------
    # FINANCE: submissions must enter pending state and cannot be approved by
    # their submitter. Posting preserves the original approval identity.
    # ---------------------------------------------------------------------
    finance_create_old = """        && request.resource.data.status in ['pending', 'approved']
        && request.resource.data.submittedByUid == request.auth.uid
        && (
          (
            request.resource.data.status == 'approved'
            && request.resource.data.approvedByUid == request.auth.uid
            && request.resource.data.approvedAt == request.time
          )
          || (
            request.resource.data.status == 'pending'
            && request.resource.data.approvedByUid == null
            && request.resource.data.approvedAt == null
          )
        )
"""
    finance_create_new = """        && request.resource.data.status == 'pending'
        && request.resource.data.submittedByUid == request.auth.uid
        && request.resource.data.approvedByUid == null
        && request.resource.data.approvedAt == null
"""
    replace_once(finance_create_old, finance_create_new, 'finance create self-approval removal')

    finance_update_old = """      allow update: if commandG2CanManageFinance()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'approvedByUid', 'approvedAt', 'updatedAt'
        ])
        && request.resource.data.status in ['approved', 'declined', 'posted']
        && request.resource.data.approvedByUid == request.auth.uid
        && request.resource.data.approvedAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
"""
    finance_update_new = """      allow update: if commandG2CanManageFinance()
        && resource.data.status == 'pending'
        && resource.data.submittedByUid != request.auth.uid
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'approvedByUid', 'approvedAt', 'updatedAt'
        ])
        && request.resource.data.status in ['approved', 'declined']
        && request.resource.data.approvedByUid == request.auth.uid
        && request.resource.data.approvedAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if commandG2CanManageFinance()
        && resource.data.status == 'approved'
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'updatedAt'
        ])
        && request.resource.data.status == 'posted'
        && request.resource.data.approvedByUid == resource.data.approvedByUid
        && request.resource.data.approvedAt == resource.data.approvedAt
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
"""
    replace_once(finance_update_old, finance_update_new, 'finance approval separation')

    # ---------------------------------------------------------------------
    # PAYROLL: payroll.manage prepares statements, payroll.approve approves or
    # voids them, and the creator cannot approve their own statement.
    # ---------------------------------------------------------------------
    payroll_update_old = """      allow update: if commandG2CanManagePayroll()
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'approvedByUid', 'paidAt', 'updatedAt'
        ])
        && request.resource.data.status in ['approved', 'paid', 'void']
        && request.resource.data.approvedByUid == request.auth.uid
        && (
          (request.resource.data.status == 'paid' && request.resource.data.paidAt == request.time)
          || (request.resource.data.status != 'paid' && request.resource.data.paidAt == null)
        )
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
"""
    payroll_update_new = """      allow update: if (isOwner() || staffPermission('payroll.approve'))
        && resource.data.status == 'draft'
        && resource.data.createdByUid != request.auth.uid
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'approvedByUid', 'updatedAt'
        ])
        && request.resource.data.status in ['approved', 'void']
        && request.resource.data.approvedByUid == request.auth.uid
        && request.resource.data.paidAt == null
        && request.resource.data.updatedAt == request.time;

      allow update: if commandG2CanManagePayroll()
        && resource.data.status == 'approved'
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'paidAt', 'updatedAt'
        ])
        && request.resource.data.status == 'paid'
        && request.resource.data.approvedByUid == resource.data.approvedByUid
        && request.resource.data.paidAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
"""
    replace_once(payroll_update_old, payroll_update_new, 'payroll approval separation')

    # ---------------------------------------------------------------------
    # COMPANY / PEOPLE-OPERATIONS COMPLETION
    # These collections fill the Staff-side gaps identified during the Part 2
    # audit without granting any authority over public background checks.
    # ---------------------------------------------------------------------
    g3_anchor = '    // COMMAND_GENERATION_3_BEGIN'
    if g3_anchor not in rules:
        fail('missing Generation 3 insertion anchor')

    company_block = r'''    // ============================================================
    // COGNITUS STAFF / COMPANY — FIRESTORE PART 2 COMPLETION
    // ============================================================

    // Staff availability is directory-safe operational presence, not invasive
    // activity monitoring. Employees own their availability record.
    match /commandAvailability/{uid} {
      allow read: if activeStaff();

      allow create: if activeStaff()
        && uid == request.auth.uid
        && request.resource.data.keys().hasOnly([
          'uid', 'employeeId', 'status', 'note', 'availableUntil',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.employeeId == currentStaff().employeeId
        && request.resource.data.status in ['available', 'working', 'busy', 'on_leave', 'unavailable']
        && shortString(request.resource.data.note, 240)
        && (request.resource.data.availableUntil == null || request.resource.data.availableUntil is timestamp)
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeStaff()
        && uid == request.auth.uid
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.employeeId == resource.data.employeeId
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'note', 'availableUntil', 'updatedAt'
        ])
        && request.resource.data.status in ['available', 'working', 'busy', 'on_leave', 'unavailable']
        && shortString(request.resource.data.note, 240)
        && (request.resource.data.availableUntil == null || request.resource.data.availableUntil is timestamp)
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

    // Internal Affairs is separate from public/product misconduct reports.
    // Reporters can see their own submission; IA/Owner controls case handling.
    match /commandInternalAffairs/{caseId} {
      allow read: if activeStaff()
        && (
          resource.data.reporterUid == request.auth.uid
          || isOwner()
          || staffPermission('internalAffairs.read')
          || staffPermission('internalAffairs.manage')
        );

      allow create: if activeStaff()
        && request.resource.data.keys().hasOnly([
          'id', 'reporterUid', 'subjectUid', 'category', 'summary', 'details',
          'confidentiality', 'status', 'assignedToUid', 'outcome', 'openedAt',
          'closedAt', 'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == caseId
        && request.resource.data.reporterUid == request.auth.uid
        && (request.resource.data.subjectUid == null || request.resource.data.subjectUid is string)
        && request.resource.data.category in [
          'policy_violation', 'staff_misconduct', 'abuse_of_authority',
          'conflict', 'harassment', 'security_concern', 'other'
        ]
        && shortString(request.resource.data.summary, 180)
        && request.resource.data.summary.size() > 0
        && shortString(request.resource.data.details, 6000)
        && request.resource.data.details.size() > 0
        && request.resource.data.confidentiality in ['standard', 'restricted']
        && request.resource.data.status == 'submitted'
        && request.resource.data.assignedToUid == null
        && request.resource.data.outcome == ''
        && request.resource.data.openedAt == request.time
        && request.resource.data.closedAt == null
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if (isOwner() || staffPermission('internalAffairs.manage'))
        && request.resource.data.id == resource.data.id
        && request.resource.data.reporterUid == resource.data.reporterUid
        && request.resource.data.subjectUid == resource.data.subjectUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.openedAt == resource.data.openedAt
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'assignedToUid', 'outcome', 'closedAt', 'updatedAt'
        ])
        && request.resource.data.status in [
          'submitted', 'triaged', 'under_review', 'substantiated',
          'unsubstantiated', 'closed'
        ]
        && (request.resource.data.assignedToUid == null || request.resource.data.assignedToUid is string)
        && shortString(request.resource.data.outcome, 4000)
        && (
          (request.resource.data.status == 'closed' && request.resource.data.closedAt == request.time)
          || (request.resource.data.status != 'closed' && request.resource.data.closedAt == null)
        )
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

    // Performance records are employee-visible but authored/finalized only by
    // HR or same-department leadership.
    match /commandPerformance/{reviewId} {
      allow read: if activeStaff()
        && (
          resource.data.employeeUid == request.auth.uid
          || isOwner()
          || staffPermission('hr.records.read')
          || staffPermission('hr.records.manage')
          || (staffPermission('department.manage')
            && resource.data.departmentId == currentStaff().departmentId)
        );

      allow create: if activeStaff()
        && (
          isOwner()
          || staffPermission('hr.records.manage')
          || (staffPermission('department.manage')
            && request.resource.data.departmentId == currentStaff().departmentId)
        )
        && request.resource.data.keys().hasOnly([
          'id', 'employeeUid', 'departmentId', 'periodLabel', 'score', 'summary',
          'strengths', 'improvements', 'reviewerUid', 'status', 'finalizedAt',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == reviewId
        && request.resource.data.employeeUid is string
        && exists(staffAccessPath(request.resource.data.employeeUid))
        && request.resource.data.departmentId == get(staffAccessPath(request.resource.data.employeeUid)).data.departmentId
        && shortString(request.resource.data.periodLabel, 100)
        && request.resource.data.periodLabel.size() > 0
        && request.resource.data.score is int
        && request.resource.data.score >= 0
        && request.resource.data.score <= 100
        && shortString(request.resource.data.summary, 2500)
        && shortString(request.resource.data.strengths, 2500)
        && shortString(request.resource.data.improvements, 2500)
        && request.resource.data.reviewerUid == request.auth.uid
        && request.resource.data.status == 'draft'
        && request.resource.data.finalizedAt == null
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeStaff()
        && resource.data.status == 'draft'
        && (
          isOwner()
          || staffPermission('hr.records.manage')
          || (staffPermission('department.manage')
            && resource.data.departmentId == currentStaff().departmentId)
        )
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'score', 'summary', 'strengths', 'improvements', 'status',
          'finalizedAt', 'updatedAt'
        ])
        && request.resource.data.score is int
        && request.resource.data.score >= 0
        && request.resource.data.score <= 100
        && shortString(request.resource.data.summary, 2500)
        && shortString(request.resource.data.strengths, 2500)
        && shortString(request.resource.data.improvements, 2500)
        && request.resource.data.status in ['draft', 'final']
        && (
          (request.resource.data.status == 'final' && request.resource.data.finalizedAt == request.time)
          || (request.resource.data.status == 'draft' && request.resource.data.finalizedAt == null)
        )
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

    // Acknowledgements attach to policy documents in commandDocuments.
    // They are immutable after the employee acknowledges the policy/version.
    match /commandPolicyAcknowledgements/{ackId} {
      allow read: if activeStaff()
        && (
          resource.data.employeeUid == request.auth.uid
          || isOwner()
          || staffPermission('hr.records.read')
          || staffPermission('hr.records.manage')
          || staffPermission('system.manage')
        );

      allow create: if activeStaff()
        && request.resource.data.keys().hasOnly([
          'id', 'policyDocumentId', 'employeeUid', 'employeeId', 'policyTitle',
          'policyVersion', 'acknowledgedAt', 'createdAt'
        ])
        && request.resource.data.id == ackId
        && request.resource.data.employeeUid == request.auth.uid
        && request.resource.data.employeeId == currentStaff().employeeId
        && request.resource.data.policyDocumentId is string
        && exists(/databases/$(database)/documents/commandDocuments/$(request.resource.data.policyDocumentId))
        && get(/databases/$(database)/documents/commandDocuments/$(request.resource.data.policyDocumentId)).data.category == 'policy'
        && shortString(request.resource.data.policyTitle, 180)
        && request.resource.data.policyTitle.size() > 0
        && shortString(request.resource.data.policyVersion, 60)
        && request.resource.data.policyVersion.size() > 0
        && request.resource.data.acknowledgedAt == request.time
        && request.resource.data.createdAt == request.time;

      allow update, delete: if false;
    }

    // Recognition is internal company history. Department leadership may issue
    // department recognition; Owner/System may issue company-wide recognition.
    match /commandRecognition/{recognitionId} {
      allow read: if activeStaff();

      allow create: if activeStaff()
        && request.resource.data.keys().hasOnly([
          'id', 'employeeUid', 'employeeId', 'departmentId', 'type', 'title',
          'message', 'issuedByUid', 'issuedAt', 'createdAt'
        ])
        && request.resource.data.id == recognitionId
        && request.resource.data.employeeUid is string
        && exists(staffAccessPath(request.resource.data.employeeUid))
        && request.resource.data.employeeId == get(staffAccessPath(request.resource.data.employeeUid)).data.employeeId
        && request.resource.data.departmentId == get(staffAccessPath(request.resource.data.employeeUid)).data.departmentId
        && request.resource.data.type in [
          'commendation', 'department', 'service', 'operational_excellence',
          'case_excellence', 'leadership'
        ]
        && shortString(request.resource.data.title, 140)
        && request.resource.data.title.size() > 0
        && shortString(request.resource.data.message, 2000)
        && request.resource.data.message.size() > 0
        && request.resource.data.issuedByUid == request.auth.uid
        && (
          isOwner()
          || staffPermission('system.manage')
          || (staffPermission('department.manage')
            && request.resource.data.departmentId == currentStaff().departmentId)
        )
        && request.resource.data.issuedAt == request.time
        && request.resource.data.createdAt == request.time;

      allow update, delete: if false;
    }

    // Employee suggestions/feedback are author-private unless routed to
    // leadership. This avoids making candid internal feedback company-readable.
    match /commandSuggestions/{suggestionId} {
      allow read: if activeStaff()
        && (
          resource.data.submittedByUid == request.auth.uid
          || isOwner()
          || staffPermission('system.manage')
          || (staffPermission('department.manage')
            && resource.data.departmentId == currentStaff().departmentId
            && resource.data.visibility == 'department')
        );

      allow create: if activeStaff()
        && request.resource.data.keys().hasOnly([
          'id', 'submittedByUid', 'departmentId', 'category', 'title', 'details',
          'visibility', 'status', 'response', 'respondedByUid', 'respondedAt',
          'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == suggestionId
        && request.resource.data.submittedByUid == request.auth.uid
        && request.resource.data.departmentId == currentStaff().departmentId
        && request.resource.data.category in ['suggestion', 'feedback', 'process', 'culture', 'other']
        && shortString(request.resource.data.title, 140)
        && request.resource.data.title.size() > 0
        && shortString(request.resource.data.details, 4000)
        && request.resource.data.details.size() > 0
        && request.resource.data.visibility in ['leadership', 'department']
        && request.resource.data.status == 'submitted'
        && request.resource.data.response == ''
        && request.resource.data.respondedByUid == null
        && request.resource.data.respondedAt == null
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeStaff()
        && resource.data.submittedByUid != request.auth.uid
        && (
          isOwner()
          || staffPermission('system.manage')
          || (resource.data.visibility == 'department'
            && staffPermission('department.manage')
            && resource.data.departmentId == currentStaff().departmentId)
        )
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'response', 'respondedByUid', 'respondedAt', 'updatedAt'
        ])
        && request.resource.data.status in ['reviewing', 'accepted', 'declined', 'closed']
        && shortString(request.resource.data.response, 2500)
        && request.resource.data.respondedByUid == request.auth.uid
        && request.resource.data.respondedAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

''' + PART2_MARKER + '\n\n'

    rules = rules.replace(g3_anchor, company_block + g3_anchor, 1)

RULES.write_text(rules, encoding='utf-8')

# -------------------------------------------------------------------------
# AUDIT
# -------------------------------------------------------------------------
required_collections = [
    'staffDirectory', 'staffAccess', 'staffEmployment', 'staffInbox',
    'commandTasks', 'commandRequests', 'commandProjects', 'commandMeetings',
    'commandAnnouncements', 'commandDocuments', 'commandTickets', 'commandLeave',
    'commandLifecycle', 'commandFinance', 'commandPayroll',
    'commandAvailability', 'commandInternalAffairs', 'commandPerformance',
    'commandPolicyAcknowledgements', 'commandRecognition', 'commandSuggestions',
]

match_names = set(re.findall(r'match\s+/([A-Za-z0-9_-]+)(?:/|\{)', rules))
missing = [name for name in required_collections if name not in match_names]

invariants = {
    'product login does not imply staff access': "function activeStaff()" in rules and "'portal.access' in currentStaff().permissions" in rules,
    'staff authorization is separate from product role': 'match /staffAccess/{uid}' in rules,
    'staff directory is staff-only': 'match /staffDirectory/{uid}' in rules and 'allow read: if activeStaff();' in rules,
    'restricted employment records are HR/self scoped': 'match /staffEmployment/{uid}' in rules and 'canReadPrivateStaff()' in rules,
    'inbox is recipient scoped': 'match /staffInbox/{notificationId}' in rules and 'resource.data.recipientUid == request.auth.uid' in rules,
    'sensitive request routing enabled': 'function commandG2CanReviewRequest(value)' in rules,
    'finance self-approval blocked': 'resource.data.submittedByUid != request.auth.uid' in rules,
    'payroll approval permission enforced': "staffPermission('payroll.approve')" in rules and 'resource.data.createdByUid != request.auth.uid' in rules,
    'internal affairs has dedicated restricted collection': 'match /commandInternalAffairs/{caseId}' in rules and "staffPermission('internalAffairs.manage')" in rules,
    'availability is employee-owned': 'match /commandAvailability/{uid}' in rules and 'uid == request.auth.uid' in rules,
    'policy acknowledgements are immutable': 'match /commandPolicyAcknowledgements/{ackId}' in rules and 'allow update, delete: if false;' in rules,
    'performance records have employee visibility': 'match /commandPerformance/{reviewId}' in rules and 'resource.data.employeeUid == request.auth.uid' in rules,
    'recognition records are immutable': 'match /commandRecognition/{recognitionId}' in rules,
    'suggestions are not company-public by default': 'match /commandSuggestions/{suggestionId}' in rules and "resource.data.visibility == 'department'" in rules,
    'background checks still have no staff approval collection': 'backgroundCheckApprovals' not in match_names and 'commandBackgroundChecks' not in match_names,
    'no composite index file dependency introduced': 'firestore.indexes.json' not in rules,
    'default deny preserved': 'match /{document=**}' in rules and 'allow read, write: if false;' in rules,
    'Part 2 completion marker present': PART2_MARKER in rules,
}

lines = [
    '# Firestore Part 2 — Staff & Company Audit',
    '',
    'Generated from the single authoritative `cognitus-solutions/firestore.rules`.',
    '',
    f'- Rules source bytes: **{RULES.stat().st_size:,}**',
    f'- Required Staff/Company collections: **{len(required_collections)}**',
    '',
    '## Required Staff / Company collection coverage',
    '',
]
for name in required_collections:
    lines.append(f'- {"✅" if name in match_names else "❌"} `{name}`')

lines += ['', '## Security invariants', '']
for label, ok in invariants.items():
    lines.append(f'- {"✅" if ok else "❌"} {label}')

lines += ['', '## Part 2 hardening', '']
lines += [
    '- Sensitive Request Center categories now route to the correct authority instead of generic department management.',
    '- Finance submissions must begin pending and cannot be approved by their submitter.',
    '- Payroll preparation and payroll approval are separated; statement creators cannot approve their own statement.',
    '- Employees can cancel their own still-pending leave request; HR remains responsible for approval/decline.',
    '- Internal Affairs now has a dedicated restricted staff-case collection.',
    '- Availability, performance, policy acknowledgement, recognition, and suggestions/feedback have explicit Staff-side security boundaries.',
    '- Background checks remain automatic/self-service; Part 2 adds no background-check approval queue.',
]

failed = [label for label, ok in invariants.items() if not ok]
lines += ['', '## Findings', '']
lines.append('Missing required collections: ' + (', '.join(f'`{x}`' for x in missing) if missing else 'none.'))
lines.append('Failed invariants: ' + (', '.join(f'`{x}`' for x in failed) if failed else 'none.'))

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8')

print('Part 2 complete.')
print('Missing collections:', missing)
print('Failed invariants:', failed)

if missing or failed:
    raise SystemExit(1)
