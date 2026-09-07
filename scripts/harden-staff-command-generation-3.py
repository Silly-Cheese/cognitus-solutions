from pathlib import Path

RULES_PATH = Path("firestore.rules")
rules = RULES_PATH.read_text(encoding="utf-8")

# ---------------------------------------------------------------------------
# Employer-status approval must atomically update the approved user's product
# role/organization. This authority is deliberately narrow and tied to the
# matching pending employerStatusRequests/{uid} record transitioning to approved
# in the same batch by the same Command reviewer.
# ---------------------------------------------------------------------------
user_match = "    match /users/{uid} {"
start = rules.find(user_match)
if start < 0:
    raise RuntimeError("Could not locate users rule block")
end = rules.find("\n    match /", start + len(user_match))
if end < 0:
    raise RuntimeError("Could not bound users rule block")
block = rules[start:end]

staff_transition = '''

      // Staff / Command employer-status approval. This is not general user
      // administration authority; it only permits the exact user transition
      // required by an approved employerStatusRequests/{uid} batch.
      allow update: if (staffPermission('verification.review') || staffPermission('organizations.review'))
        && resource.data.status == 'active'
        && resource.data.role == 'user'
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'role', 'organizationId', 'updatedAt'
        ])
        && request.resource.data.role == 'verified_employer_member'
        && request.resource.data.organizationId != null
        && request.resource.data.updatedAt == request.time
        && exists(/databases/$(database)/documents/employerStatusRequests/$(uid))
        && get(/databases/$(database)/documents/employerStatusRequests/$(uid)).data.applicantUid == uid
        && get(/databases/$(database)/documents/employerStatusRequests/$(uid)).data.status == 'pending'
        && existsAfter(/databases/$(database)/documents/employerStatusRequests/$(uid))
        && getAfter(/databases/$(database)/documents/employerStatusRequests/$(uid)).data.applicantUid == uid
        && getAfter(/databases/$(database)/documents/employerStatusRequests/$(uid)).data.organizationId == request.resource.data.organizationId
        && getAfter(/databases/$(database)/documents/employerStatusRequests/$(uid)).data.status == 'approved'
        && getAfter(/databases/$(database)/documents/employerStatusRequests/$(uid)).data.reviewedByUid == request.auth.uid;
'''

if "Staff / Command employer-status approval" not in block:
    marker = "\n      allow delete: if (signedIn() && request.auth.uid == uid)"
    if marker not in block:
        raise RuntimeError("Could not locate users delete rule insertion point")
    block = block.replace(marker, staff_transition + marker, 1)
    rules = rules[:start] + block + rules[end:]

# ---------------------------------------------------------------------------
# PR approval hardening. pr.manage may author/submit/publish work, while only
# pr.approve/Owner may create an approval or rejection decision.
# ---------------------------------------------------------------------------
old_create_tail = '''        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.approvedByUid == null
        && request.resource.data.approvedAt == null
        && request.resource.data.createdAt == request.time'''
new_create_tail = '''        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.status in ['draft', 'pending_approval']
        && request.resource.data.approvedByUid == null
        && request.resource.data.approvedAt == null
        && request.resource.data.createdAt == request.time'''
if old_create_tail in rules:
    rules = rules.replace(old_create_tail, new_create_tail, 1)
elif "request.resource.data.status in ['draft', 'pending_approval']" not in rules:
    raise RuntimeError("Could not harden PR create status in authoritative rules")

old_manage_update = '''        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt == request.time
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'type', 'title', 'status', 'body', 'url', 'ownerUid', 'updatedAt'
        ]);'''
new_manage_update = '''        && request.resource.data.createdByUid == resource.data.createdByUid
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.status in ['draft', 'pending_approval', 'published', 'closed']
        && request.resource.data.approvedByUid == resource.data.approvedByUid
        && request.resource.data.approvedAt == resource.data.approvedAt
        && request.resource.data.updatedAt == request.time
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'type', 'title', 'status', 'body', 'url', 'ownerUid', 'updatedAt'
        ]);'''
if old_manage_update in rules:
    rules = rules.replace(old_manage_update, new_manage_update, 1)
elif "request.resource.data.status in ['draft', 'pending_approval', 'published', 'closed']" not in rules:
    raise RuntimeError("Could not harden PR manager status in authoritative rules")

RULES_PATH.write_text(rules, encoding="utf-8")

checks = {
    "employer transition is request-bound": "Staff / Command employer-status approval" in rules,
    "approval requires same-batch approved request": "getAfter(/databases/$(database)/documents/employerStatusRequests/$(uid)).data.status == 'approved'" in rules,
    "PR create is non-approved only": "request.resource.data.status in ['draft', 'pending_approval']" in rules,
    "PR manager cannot self-approve": "request.resource.data.status in ['draft', 'pending_approval', 'published', 'closed']" in rules,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise RuntimeError("Generation 3 hardening failed: " + "; ".join(failed))

print("Hardened authoritative Generation 3 Firestore rules.")
