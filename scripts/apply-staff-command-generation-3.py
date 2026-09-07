from pathlib import Path
from urllib.request import urlopen

RULES_PATH = Path("firestore.rules")
APP_PATH = Path("src/app.js")
FRAGMENT_URL = "https://raw.githubusercontent.com/Silly-Cheese/staff-cognitus/57e9809bd9f21f653c3b813c9c4c77bd5dbda6df/firestore.command.g3.rules.fragment"
BEGIN = "// COMMAND_GENERATION_3_BEGIN"
END = "// COMMAND_GENERATION_3_END"
DEFAULT_DENY = "    // ============================================================\n    // FINAL DEFAULT-DENY BOUNDARY"
COMMAND_URL = "https://silly-cheese.github.io/staff-cognitus/"


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"Could not find {label}")
    return text.replace(old, new, 1)


def replace_in_match(text, match_header, old, new, label, occurrence=1):
    start = -1
    search_from = 0
    for _ in range(occurrence):
        start = text.find(match_header, search_from)
        if start < 0:
            raise RuntimeError(f"Could not find match block for {label}")
        search_from = start + len(match_header)
    next_match = text.find("\n    match /", start + len(match_header))
    end = next_match if next_match >= 0 else len(text)
    block = text[start:end]
    if new in block:
        return text
    if old not in block:
        raise RuntimeError(f"Could not find rule inside {label}")
    block = block.replace(old, new, 1)
    return text[:start] + block + text[end:]


rules = RULES_PATH.read_text(encoding="utf-8")

# Generation 3 operational collections.
if BEGIN not in rules:
    with urlopen(FRAGMENT_URL, timeout=30) as response:
        fragment = response.read().decode("utf-8")
    start = fragment.index(BEGIN)
    end = fragment.index(END, start) + len(END)
    block = fragment[start:end].strip()
    block = "\n".join(("    " + line) if line else "" for line in block.splitlines())
    if DEFAULT_DENY not in rules:
        raise RuntimeError("Could not locate final default-deny boundary")
    rules = rules.replace(DEFAULT_DENY, f"{block}\n\n{DEFAULT_DENY}", 1)

# Staff provisioning lookup in the shared users collection.
rules = replace_in_match(
    rules,
    "    match /users/{uid} {",
    "      allow read: if signedIn() && (request.auth.uid == uid || isReviewer());",
    "      allow read: if signedIn() && (\n        request.auth.uid == uid\n        || isReviewer()\n        || staffPermission('staff.provision')\n        || staffPermission('staff.private.read')\n        || staffPermission('hr.records.read')\n      );",
    "users staff lookup"
)

# Main product report review authority moves to explicit Command permissions.
rules = replace_in_match(
    rules,
    "    match /reports/{reportId} {",
    "      allow read: if isReviewer()",
    "      allow read: if (isReviewer() || staffPermission('reports.review') || staffPermission('appeals.review'))",
    "reports read"
)
rules = replace_in_match(
    rules,
    "    match /reports/{reportId} {",
    "      allow update: if isReviewer()",
    "      allow update: if (isReviewer() || staffPermission('reports.review') || staffPermission('appeals.review'))",
    "reports update"
)

rules = replace_in_match(
    rules,
    "    match /screeningReportSummaries/{summaryId} {",
    "      allow create, update: if isReviewer()",
    "      allow create, update: if (isReviewer() || staffPermission('reports.review'))",
    "screening summaries write"
)
rules = replace_in_match(
    rules,
    "    match /screeningReportSummaries/{summaryId} {",
    "      allow delete: if isReviewer();",
    "      allow delete: if isReviewer() || staffPermission('reports.review');",
    "screening summaries delete"
)

# Claims and appeals.
rules = replace_in_match(
    rules,
    "    match /claims/{claimId} {",
    "      allow read: if isReviewer()",
    "      allow read: if (isReviewer() || staffPermission('claims.review'))",
    "claims read"
)
rules = replace_in_match(
    rules,
    "    match /claims/{claimId} {",
    "      allow update: if isReviewer()",
    "      allow update: if (isReviewer() || staffPermission('claims.review'))",
    "claims update"
)
rules = replace_in_match(
    rules,
    "    match /appeals/{appealId} {",
    "      allow read: if isReviewer()",
    "      allow read: if (isReviewer() || staffPermission('appeals.review'))",
    "appeals read"
)
rules = replace_in_match(
    rules,
    "    match /appeals/{appealId} {",
    "      allow update: if isReviewer()",
    "      allow update: if (isReviewer() || staffPermission('appeals.review'))",
    "appeals update"
)

# Employer-created profile claims and profile linking.
rules = replace_in_match(
    rules,
    "    match /externalProfileClaims/{claimId} {",
    "      allow read: if isReviewer()",
    "      allow read: if (isReviewer() || staffPermission('claims.review') || staffPermission('verification.review'))",
    "external profile claims read"
)
rules = replace_in_match(
    rules,
    "    match /externalProfileClaims/{claimId} {",
    "      allow update: if isReviewer()",
    "      allow update: if (isReviewer() || staffPermission('claims.review') || staffPermission('verification.review'))",
    "external profile claims update"
)

# The first profile match contains the normal review/claim transitions.
rules = replace_in_match(
    rules,
    "    match /profiles/{profileId} {",
    "      allow update: if isReviewer()",
    "      allow update: if (isReviewer() || staffPermission('reports.review') || staffPermission('claims.review') || staffPermission('verification.review'))",
    "profiles review update"
)
rules = replace_in_match(
    rules,
    "    match /profiles/{profileId} {",
    "      allow update: if isReviewer()",
    "      allow update: if (isReviewer() || staffPermission('claims.review') || staffPermission('verification.review'))",
    "profiles claim-link update"
)

# Employment disputes are correction/appeal work.
rules = replace_in_match(
    rules,
    "    match /employmentRecords/{recordId} {",
    "      allow update: if isReviewer()",
    "      allow update: if (isReviewer() || staffPermission('appeals.review'))",
    "employment record dispute update"
)
rules = replace_in_match(
    rules,
    "    match /employmentRecordDisputes/{disputeId} {",
    "      allow read: if isReviewer()",
    "      allow read: if (isReviewer() || staffPermission('appeals.review'))",
    "employment disputes read"
)
rules = replace_in_match(
    rules,
    "    match /employmentRecordDisputes/{disputeId} {",
    "      allow update: if isReviewer()",
    "      allow update: if (isReviewer() || staffPermission('appeals.review'))",
    "employment disputes update"
)

# Organization and employer-status review.
rules = replace_in_match(
    rules,
    "    match /organizations/{organizationId} {",
    "      allow update: if isAdmin()",
    "      allow update: if (isAdmin() || staffPermission('organizations.review'))",
    "organization review update"
)
rules = replace_in_match(
    rules,
    "    match /employerStatusRequests/{requestId} {",
    "      allow read: if isAdmin() || (signedIn() && requestId == request.auth.uid);",
    "      allow read: if isAdmin() || staffPermission('verification.review') || staffPermission('organizations.review') || (signedIn() && requestId == request.auth.uid);",
    "employer requests read"
)
rules = replace_in_match(
    rules,
    "    match /employerStatusRequests/{requestId} {",
    "      allow update: if isAdmin()",
    "      allow update: if (isAdmin() || staffPermission('verification.review') || staffPermission('organizations.review'))",
    "employer requests update"
)

# Executive audit access.
rules = replace_in_match(
    rules,
    "    match /auditLogs/{auditId} {",
    "      allow read: if isAdmin()",
    "      allow read: if isAdmin() || staffPermission('audit.read')",
    "audit read"
)

RULES_PATH.write_text(rules, encoding="utf-8")

app = APP_PATH.read_text(encoding="utf-8")
app = replace_once(
    app,
    "let profileRecord = null;\nlet authReady = false;",
    "let profileRecord = null;\nlet staffAccessRecord = null;\nlet authReady = false;",
    "staff access state"
)
app = replace_once(
    app,
    "async function refreshAccount() {\n  userRecord = authUser ? await readDoc(\"users\", authUser.uid) : null;\n  profileRecord = authUser ? await readDoc(\"profiles\", authUser.uid) : null;",
    "async function refreshAccount() {\n  userRecord = authUser ? await readDoc(\"users\", authUser.uid) : null;\n  profileRecord = authUser ? await readDoc(\"profiles\", authUser.uid) : null;\n  staffAccessRecord = authUser ? await readDoc(\"staffAccess\", authUser.uid).catch(() => null) : null;",
    "staff access refresh"
)
app = replace_once(
    app,
    "function owner() { return activeUser() && userRecord?.role === \"owner\"; }",
    "function owner() { return activeUser() && userRecord?.role === \"owner\"; }\nfunction commandStaff() { return Boolean(activeUser() && staffAccessRecord && [\"active\", \"training\", \"on_leave\"].includes(staffAccessRecord.status) && Array.isArray(staffAccessRecord.permissions) && staffAccessRecord.permissions.includes(\"portal.access\")); }",
    "command staff helper"
)
app = replace_once(
    app,
    "    ${reviewer() ? `<a href=\"#/review\">Review</a>` : \"\"}\n    ${admin() ? `<a href=\"#/admin\">Admin</a>` : \"\"}",
    f"    ${{commandStaff() ? `<a href=\"{COMMAND_URL}\" target=\"_blank\" rel=\"noopener\">Staff Command</a>` : \"\"}}",
    "main navigation staff migration"
)
app = replace_once(
    app,
    "[\"Review Queue\", \"Reviewers can approve or deny reports, claims, and appeals without rewriting original submissions.\"],\n    [\"Administration\", \"Admins manage user status, non-owner roles, organization verification, and organization membership.\"],",
    "[\"Command Operations\", \"Human review, appeals, claims, investigations, quality, and exceptional operational work are handled in Cognitus Staff / Command.\"],\n    [\"Separate Internal Administration\", \"Employee, department, finance, payroll, quality, and executive administration are kept out of the customer-facing product.\"],",
    "features migration copy"
)

migration_function = f'''function commandMigrationPage(area) {{\n  setTitle(`${{area}} · Staff Command`);\n  root.innerHTML = `<section class="hero hero-wide"><p class="eyebrow">Internal operations moved</p><h1>${{safe(area)}} now lives in Cognitus Staff / Command.</h1><p>The main Cognitus site is the customer and product portal. Internal review and administration are handled in the separate staff system using the same Cognitus identity and Firestore database.</p><div class="hero-actions"><a class="button button-dark" href="{COMMAND_URL}" target="_blank" rel="noopener">Open Staff Command</a>${{buttonLink("#/dashboard", "Return to Dashboard")}}</div></section>`;\n}}\n\n'''
if "function commandMigrationPage(area)" not in app:
    marker = "async function settingsPage() {"
    if marker not in app:
        raise RuntimeError("Could not locate settings page for migration helper")
    app = app.replace(marker, migration_function + marker, 1)

app = replace_once(
    app,
    '    if (current === "/review") return reviewPage();',
    '    if (current === "/review") return commandMigrationPage("Review Queue");',
    "review route migration"
)
app = replace_once(
    app,
    '    if (current === "/admin") return adminPage();',
    '    if (current === "/admin") return commandMigrationPage("Administration");',
    "admin route migration"
)

APP_PATH.write_text(app, encoding="utf-8")
print("Integrated Cognitus Staff / Command Generation 3 and migrated internal main-site routes.")
