from pathlib import Path

RULES_PATH = Path("firestore.rules")
rules = RULES_PATH.read_text(encoding="utf-8")

# Cognitus Command rules hardening — Part 1/3
# Scope: staff identity, staff authorization boundary, provisioning baseline,
# and owner bootstrap compatibility. Product workflow authority is handled in
# Part 2; operational/company/executive collections and final deny audit are
# handled in Part 3.

STAFF_PERMISSIONS = [
    "portal.access",
    "directory.read",
    "profile.read",
    "department.read",
    "department.manage",
    "staff.provision",
    "staff.manage",
    "staff.private.read",
    "permissions.manage",
    "tickets.read",
    "tickets.manage",
    "tickets.all.read",
    "cs.manage",
    "pr.manage",
    "pr.approve",
    "finance.read",
    "finance.manage",
    "payroll.read",
    "payroll.manage",
    "payroll.approve",
    "hr.records.read",
    "hr.records.manage",
    "internalAffairs.read",
    "internalAffairs.manage",
    "qa.read",
    "qa.manage",
    "qa.audit",
    "reports.review",
    "claims.review",
    "appeals.review",
    "verification.review",
    "organizations.review",
    "cases.read",
    "cases.manage",
    "evidence.read",
    "evidence.manage",
    "accreditation.manage",
    "escalations.manage",
    "incidents.manage",
    "audit.read",
    "system.manage",
]

if len(STAFF_PERMISSIONS) != 41:
    raise RuntimeError(f"Expected 41 Command permissions, found {len(STAFF_PERMISSIONS)}")


def function_block(text: str, name: str) -> tuple[int, int, str]:
    marker = f"    function {name}("
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f"Could not locate {name} helper")
    next_function = text.find("\n    function ", start + len(marker))
    next_match = text.find("\n    match /", start + len(marker))
    candidates = [p for p in (next_function, next_match) if p >= 0]
    end = min(candidates) if candidates else len(text)
    return start, end, text[start:end]


# The Command frontend's Owner bundle contains every explicit permission above.
# The merged rules previously capped the list at 40, making the 41-permission
# Owner bootstrap impossible even though every individual permission was valid.
start, end, block = function_block(rules, "validStaffPermissions")
if "value.size() <= 40" in block:
    block = block.replace(
        "value.size() <= 40",
        "value.size() <= 41",
        1,
    )
elif "value.size() <= 41" not in block:
    raise RuntimeError("Could not locate the staff-permission capacity guard")
rules = rules[:start] + block + rules[end:]

# Verify the authoritative rules contain the complete permission catalog.
_, _, permission_block = function_block(rules, "validStaffPermissions")
missing_permissions = [
    permission for permission in STAFF_PERMISSIONS
    if f"'{permission}'" not in permission_block
]
if missing_permissions:
    raise RuntimeError(
        "Authoritative rules are missing Command permissions: "
        + ", ".join(missing_permissions)
    )

# Identity and privilege must remain separate: a normal authenticated Cognitus
# account does not become staff unless the staffAccess record exists, is in an
# allowed portal status, and explicitly includes portal.access.
required_identity_fragments = [
    "function staffAccessPath(uid)",
    "function hasStaffAccess()",
    "exists(staffAccessPath(request.auth.uid))",
    "function activeStaff()",
    "currentStaff().status in ['active', 'training', 'on_leave']",
    "'portal.access' in currentStaff().permissions",
    "function staffPermission(permission)",
]
for fragment in required_identity_fragments:
    if fragment not in rules:
        raise RuntimeError(f"Missing Command identity boundary: {fragment}")

# Provisioning must operate on an already-existing active Cognitus account and
# must not let delegated provisioners mint an Owner or permissions they do not
# themselves possess.
required_provisioning_fragments = [
    "exists(userPath(uid))",
    "get(userPath(uid)).data.status == 'active'",
    "value.rank != 'owner'",
    "value.accessLevel < currentStaff().accessLevel",
    "value.permissions.hasOnly(currentStaff().permissions)",
    "!value.permissions.hasAny(['permissions.manage', 'system.manage'])",
]
for fragment in required_provisioning_fragments:
    if fragment not in rules:
        raise RuntimeError(f"Missing delegated-provisioning guard: {fragment}")

# The core staff collections must all be present in the shared, authoritative
# ruleset. This is also a guard against accidentally deploying only a fragment.
for collection in [
    "staffDirectory",
    "staffAccess",
    "staffEmployment",
    "staffInbox",
]:
    if f"match /{collection}/" not in rules:
        raise RuntimeError(f"Missing Command collection rules for {collection}")

# Command's staff provisioners require exact-user lookup only. This read grant
# is intentionally not a write grant over the public users collection.
if "|| staffPermission('staff.provision')" not in rules:
    raise RuntimeError("users/{uid} does not expose exact staff-provision lookup")

# The project keeps a single authoritative default-deny rule.
if "match /{document=**}" not in rules or "allow read, write: if false;" not in rules:
    raise RuntimeError("Authoritative Firestore rules are missing default deny")

RULES_PATH.write_text(rules, encoding="utf-8")

print("Cognitus Command Firestore hardening Part 1/3 complete.")
print("- staff identity boundary verified")
print("- delegated provisioning boundary verified")
print("- core staff collections verified")
print("- Owner permission capacity corrected to 41")
