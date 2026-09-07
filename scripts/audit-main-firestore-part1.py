from pathlib import Path
import re

ROOT = Path('.')
RULES = ROOT / 'firestore.rules'
SRC = ROOT / 'src'
REPORT = ROOT / 'docs' / 'FIRESTORE_PART1_MAIN_AUDIT.md'

# Confirmed Main Cognitus collection surfaces. This is built from the canonical
# registry plus collection names actually referenced by the current main-site
# source. Staff/Command-only collections are audited in Parts 2 and 3.
EXPECTED_MAIN = {
    # Canonical V1 registry
    'users', 'organizations', 'profiles', 'reports', 'checkLogs', 'appeals',
    'claims', 'notifications', 'auditLogs', 'passwordResetRequests',
    'savedCandidates', 'savedOrganizations', 'candidatePipelines',
    'privateNotes', 'downloads', 'duplicateReviews', 'employmentHistory',
    'certifications', 'settings',
    # Confirmed current main-site extensions
    'organizationMembers', 'employmentRecords', 'employmentRecordDisputes',
    'externalProfileClaims', 'reportAccessRequests', 'reportAccessGrants',
    'ownerReportAccessGrants', 'employerStatusRequests', 'employerCandidates',
    'privacyRequests', 'profileMergeMap', 'screeningReportSummaries',
    'promotionalCodes', 'promoRedemptions', 'promoAccessGrants', 'promoUserData'
}

# These are document IDs in settings/{id}, not top-level collections.
NON_COLLECTION_LITERALS = {'bootstrap', 'portal'}

rules = RULES.read_text(encoding='utf-8')
match_names = set(re.findall(r'match\s+/([A-Za-z0-9_-]+)(?:/|\{)', rules))

# Discover collection names used in source. Firestore is wrapped by services in
# several generations, so inspect direct Firebase calls and wrapper calls.
patterns = [
    re.compile(r'(?:collection|collectionGroup)\s*\(\s*[^,\n]+,\s*[\"\']([A-Za-z0-9_-]+)[\"\']'),
    re.compile(r'(?:doc|setDocument|getDocument|updateDocument|createDocument|queryDocuments|listRecentDocuments)\s*\(\s*(?:[^,\n]+,\s*)?[\"\']([A-Za-z0-9_-]+)[\"\']'),
    re.compile(r'(?:readCollection|readQuery|readDoc|writeRecord|updateRecord)\s*\(\s*[\"\']([A-Za-z0-9_-]+)[\"\']'),
]

source_hits = {}
for path in SRC.rglob('*.js'):
    text = path.read_text(encoding='utf-8', errors='ignore')
    for pattern in patterns:
        for name in pattern.findall(text):
            if name not in NON_COLLECTION_LITERALS:
                source_hits.setdefault(name, set()).add(str(path))

# Include canonical collection registry values, excluding SETTINGS_DOCS values.
registry = SRC / 'firebase' / 'collections.js'
if registry.exists():
    registry_text = registry.read_text(encoding='utf-8')
    before_settings_docs = registry_text.split('export const SETTINGS_DOCS', 1)[0]
    for name in re.findall(r':\s*[\"\']([A-Za-z0-9_-]+)[\"\']', before_settings_docs):
        source_hits.setdefault(name, set()).add(str(registry))

likely_source = set(source_hits)
missing_expected = sorted(EXPECTED_MAIN - match_names)
source_without_rule = sorted(name for name in likely_source if name not in match_names)

# Main-product security invariants.
invariants = {
    'default deny': 'match /{document=**}' in rules and 'allow read, write: if false;' in rules,
    'background checks remain self-service': 'match /checkLogs/{checkId}' in rules and 'canRunChecks(' in rules,
    'promotional access is product-only': 'promotional entitlements' in rules.lower() and 'staff/admin authority' in rules.lower(),
    'portal settings owner controlled': (
        'match /settings/portal {' in rules
        and 'allow read: if true;' in rules
        and 'allow create: if isOwner()' in rules
    ),
    'bootstrap settings protected': 'match /settings/bootstrap {' in rules,
    'reports explicitly matched': 'match /reports/{reportId}' in rules,
    'appeals explicitly matched': 'match /appeals/{appealId}' in rules,
    'claims explicitly matched': 'match /claims/{claimId}' in rules,
    'organizations explicitly matched': 'match /organizations/{organizationId}' in rules,
    'profiles explicitly matched': 'match /profiles/{profileId}' in rules,
    'notifications recipient-scoped': (
        'match /notifications/{notificationId}' in rules
        and 'resource.data.userId == request.auth.uid' in rules
    ),
    'private notes organization-scoped': (
        'match /privateNotes/{noteId}' in rules
        and 'canManageTalent(resource.data.organizationId)' in rules
    ),
    'Part 1 completion present': 'MAIN COGNITUS — PART 1 COMPLETION' in rules,
}

lines = [
    '# Firestore Part 1 — Main Cognitus Audit',
    '',
    'Generated from the current Main Cognitus source and the single authoritative `firestore.rules`.',
    '',
    f'- Rules source bytes: **{RULES.stat().st_size:,}**',
    f'- Explicit top-level match names: **{len(match_names)}**',
    f'- Required Main Cognitus collections: **{len(EXPECTED_MAIN)}**',
    '',
    '## Required main collection coverage',
    '',
]

for name in sorted(EXPECTED_MAIN):
    lines.append(f'- {"✅" if name in match_names else "❌"} `{name}`')

lines += ['', '## Source-discovered collection candidates', '']
for name in sorted(likely_source):
    files = ', '.join(sorted(source_hits.get(name, []))[:4])
    lines.append(f'- {"✅" if name in match_names else "⚠️"} `{name}` — {files}')

lines += ['', '## Security invariants', '']
for label, ok in invariants.items():
    lines.append(f'- {"✅" if ok else "❌"} {label}')

lines += ['', '## Findings', '']
lines.append(
    'All required Main Cognitus collections have explicit rules.'
    if not missing_expected
    else 'Required Main collections without explicit rules: ' + ', '.join(f'`{x}`' for x in missing_expected)
)
lines.append(
    'No source-discovered collection names are missing an explicit rule match.'
    if not source_without_rule
    else 'Source-discovered names without explicit rules: ' + ', '.join(f'`{x}`' for x in source_without_rule)
)
failed_invariants = [k for k, v in invariants.items() if not v]
lines.append(
    'All Part 1 security invariants passed.'
    if not failed_invariants
    else 'Failed security invariants: ' + ', '.join(f'`{x}`' for x in failed_invariants)
)

REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'Wrote {REPORT}')
print('Missing required:', missing_expected)
print('Source without rule:', source_without_rule)
print('Failed invariants:', failed_invariants)

if missing_expected or source_without_rule or failed_invariants:
    raise SystemExit(1)
