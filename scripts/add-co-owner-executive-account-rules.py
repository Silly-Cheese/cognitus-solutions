from pathlib import Path

RULES = Path("firestore.rules")
text = RULES.read_text(encoding="utf-8")


def replace_once(src: str, old: str, new: str, label: str) -> str:
    if old not in src:
        if new in src:
            return src
        raise RuntimeError(f"Missing expected rule pattern for {label}")
    return src.replace(old, new, 1)


# Main users collection: executives can inspect every account from Command.
text = replace_once(
    text,
    "|| staffPermission('staff.private.read')\n|| staffPermission('hr.records.read')\n);",
    "|| staffPermission('staff.private.read')\n|| staffPermission('hr.records.read')\n|| executiveAccountReader()\n);",
    "executive all-account read",
)

# Staff rank + explicit permission vocabulary.
text = replace_once(
    text,
    "'owner', 'chief-officer', 'director', 'manager', 'supervisor',\n'senior-staff', 'staff', 'trainee', 'restricted'",
    "'owner', 'co-owner', 'chief-officer', 'director', 'manager', 'supervisor',\n'senior-staff', 'staff', 'trainee', 'restricted'",
    "co-owner valid rank",
)
text = replace_once(
    text,
    "return rank == 'owner' ? 100\n: rank == 'chief-officer' ? 90",
    "return rank == 'owner' ? 100\n: rank == 'co-owner' ? 100\n: rank == 'chief-officer' ? 90",
    "co-owner access level",
)
text = replace_once(
    text,
    "'escalations.manage', 'incidents.manage', 'audit.read', 'system.manage'",
    "'escalations.manage', 'incidents.manage', 'accounts.read.all', 'audit.read', 'system.manage'",
    "executive account permission vocabulary",
)

# All Staff/Command rules after the staff boundary treat Co-Owner exactly as Owner.
# Main Cognitus product-level owner powers above this boundary are intentionally not
# widened; this is the Staff Administration / Command Co-Owner role requested.
staff_boundary = text.find("function staffAccessPath(uid) {")
if staff_boundary < 0:
    raise RuntimeError("Staff rules boundary not found")
head = text[:staff_boundary]
tail = text[staff_boundary:]
tail = tail.replace("isOwner()", "commandOwner()")
text = head + tail

active_staff_block = """function activeStaff() {
return hasStaffAccess()
&& currentStaff().status in ['active', 'training', 'on_leave']
&& 'portal.access' in currentStaff().permissions;
}
function staffPermission(permission) {
"""
owner_helpers = """function activeStaff() {
return hasStaffAccess()
&& currentStaff().status in ['active', 'training', 'on_leave']
&& 'portal.access' in currentStaff().permissions;
}
function commandOwner() {
return isOwner()
|| (activeStaff() && currentStaff().rank == 'co-owner');
}
function executiveAccountReader() {
return commandOwner()
|| (activeStaff() && currentStaff().rank == 'chief-officer')
|| staffPermission('accounts.read.all');
}
function staffPermission(permission) {
"""
text = replace_once(text, active_staff_block, owner_helpers, "Command owner helpers")

# Co-Owner records are Executive Office records and must carry the full current
# Command permission set. This makes the stored authority match the Owner bundle.
valid_access_tail = """&& validStaffPermissions(value.permissions)
&& 'portal.access' in value.permissions
&& value.updatedAt is timestamp;
}
"""
full_permissions = """&& validStaffPermissions(value.permissions)
&& 'portal.access' in value.permissions
&& (
value.rank != 'co-owner'
|| (
value.departmentId == 'executive-office'
&& value.accessLevel == 100
&& value.permissions.hasAll([
'portal.access', 'directory.read', 'profile.read', 'accounts.read.all',
'department.read', 'department.manage', 'staff.provision', 'staff.manage',
'staff.private.read', 'permissions.manage', 'tickets.read', 'tickets.manage',
'tickets.all.read', 'cs.manage', 'pr.manage', 'pr.approve', 'finance.read',
'finance.manage', 'payroll.read', 'payroll.manage', 'payroll.approve',
'hr.records.read', 'hr.records.manage', 'internalAffairs.read',
'internalAffairs.manage', 'qa.read', 'qa.manage', 'qa.audit', 'reports.review',
'claims.review', 'appeals.review', 'verification.review', 'organizations.review',
'cases.read', 'cases.manage', 'evidence.read', 'evidence.manage',
'accreditation.manage', 'escalations.manage', 'incidents.manage', 'audit.read',
'system.manage'
])
)
)
&& value.updatedAt is timestamp;
}
"""
text = replace_once(text, valid_access_tail, full_permissions, "Co-Owner full stored authority")

# Structural/security invariants.
required = [
    "'co-owner'",
    "'accounts.read.all'",
    "function commandOwner()",
    "function executiveAccountReader()",
    "currentStaff().rank == 'co-owner'",
    "currentStaff().rank == 'chief-officer'",
    "value.rank != 'co-owner'",
    "match /users/{uid}",
    "match /staffAccess/{uid}",
    "match /{document=**}",
    "allow read, write: if false;",
]
missing = [needle for needle in required if needle not in text]
if missing:
    raise RuntimeError("Missing required Co-Owner/executive rules: " + repr(missing))

for forbidden in ["backgroundCheckApprovals", "commandBackgroundChecks", "backgroundCheckReviewQueue"]:
    if forbidden in text:
        raise RuntimeError(f"Forbidden background-check approval surface found: {forbidden}")

# Simple delimiter validation before handing the file to the Firebase compiler.
def validate_delimiters(src: str) -> None:
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    line = 1
    i = 0
    in_string = False
    escape = False
    while i < len(src):
        ch = src[i]
        if ch == '\n':
            line += 1
        if in_string:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == "'":
                in_string = False
            i += 1
            continue
        if ch == "'":
            in_string = True
            i += 1
            continue
        if ch == '/' and i + 1 < len(src) and src[i + 1] == '/':
            end = src.find('\n', i + 2)
            if end == -1:
                break
            i = end
            continue
        if ch in '([{':
            stack.append((ch, line))
        elif ch in ')]}':
            if not stack or stack[-1][0] != pairs[ch]:
                raise RuntimeError(f"Unexpected {ch!r} at line {line}")
            stack.pop()
        i += 1
    if in_string:
        raise RuntimeError("Unterminated string")
    if stack:
        raise RuntimeError(f"Unclosed delimiter {stack[-1]}")

validate_delimiters(text)
if len(text.encode("utf-8")) >= 190_000:
    raise RuntimeError("Rules unexpectedly grew past the 190 KB safety target")

RULES.write_text(text, encoding="utf-8")
print(f"Co-Owner/executive account rules prepared: {len(text.encode('utf-8')):,} bytes")
