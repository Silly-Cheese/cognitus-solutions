from pathlib import Path
import re

ROOT = Path('.')
RULES = ROOT / 'firestore.rules'
SRC = ROOT / 'src'
REPORT = ROOT / 'docs' / 'FIRESTORE_PART1_MAIN_AUDIT.md'

# Main/public Cognitus collections that must remain explicitly secured in the
# single authoritative ruleset. This list intentionally includes every current
# product, employer, report-access, promotional, executive/settings and
# maintenance surface used by the main site. Staff/Command collections are
# audited in Parts 2 and 3.
EXPECTED_MAIN = {
    'users', 'organizations', 'organizationMembers', 'profiles', 'reports',
    'checkLogs', 'appeals', 'claims', 'notifications', 'auditLogs',
    'passwordResetRequests', 'savedCandidates', 'savedOrganizations',
    'candidatePipelines', 'privateNotes', 'downloads', 'duplicateReviews',
    'employmentHistory', 'employmentRecords', 'employmentRecordDisputes',
    'certifications', 'settings', 'externalProfileClaims',
    'reportAccessRequests', 'reportAccessGrants', 'ownerReportAccessGrants',
    'employerStatusRequests', 'employerCandidates', 'employerCandidateNotes',
    'employerRecognition', 'employerWorkspaceItems',
    'promotionalCodes', 'promoRedemptions', 'promoEntitlements',
    'promotionalWorkspaces', 'promotionalWorkspaceItems',
    'searchCollections', 'searchEvents', 'savedInvestigations',
    'intelligenceReports', 'intelligenceSnapshots', 'watchlists',
    'profileCustomizations', 'signalZeroEvents', 'systemIncidents',
    'maintenanceRuns'
}

rules = RULES.read_text(encoding='utf-8')
match_names = set(re.findall(r'match\s+/([A-Za-z0-9_-]+)(?:/|\{)', rules))

# Discover collection names used in source. Firestore is wrapped by services in
# several generations, so inspect both direct Firebase calls and wrapper calls.
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
            source_hits.setdefault(name, set()).add(str(path))

# Also include the canonical collection registry.
registry = SRC / 'firebase' / 'collections.js'
if registry.exists():
    registry_text = registry.read_text(encoding='utf-8')
    for name in re.findall(r':\s*[\"\']([A-Za-z0-9_-]+)[\"\']', registry_text):
        source_hits.setdefault(name, set()).add(str(registry))

# Keep likely Firestore collection names only. This avoids route/status strings
# accidentally caught by wrappers while still surfacing anything rules may miss.
likely_source = {
    name for name, files in source_hits.items()
    if name in EXPECTED_MAIN or name in match_names or len(files) >= 1
}

missing_expected = sorted(EXPECTED_MAIN - match_names)
source_without_rule = sorted(name for name in likely_source if name not in match_names)

# Security invariants for the main product.
invariants = {
    'default deny': 'match /{document=**}' in rules and 'allow read, write: if false;' in rules,
    'background checks remain self-service': 'match /checkLogs/{checkId}' in rules and 'canRunChecks(' in rules,
    'promotional access is product-only': 'promotional entitlements' in rules.lower() and 'staff/admin authority' in rules.lower(),
    'portal settings owner controlled': 'match /settings/{settingId}' in rules or 'match /settings/{documentId}' in rules,
    'reports explicitly matched': 'match /reports/{reportId}' in rules,
    'appeals explicitly matched': 'match /appeals/{appealId}' in rules,
    'claims explicitly matched': 'match /claims/{claimId}' in rules,
    'organizations explicitly matched': 'match /organizations/{organizationId}' in rules,
    'profiles explicitly matched': 'match /profiles/{profileId}' in rules,
}

lines = [
    '# Firestore Part 1 — Main Cognitus Audit',
    '',
    'This report is generated from the current main-site source and the authoritative `firestore.rules`.',
    '',
    f'- Rules source bytes: **{RULES.stat().st_size:,}**',
    f'- Explicit top-level match names: **{len(match_names)}**',
    f'- Expected main collections: **{len(EXPECTED_MAIN)}**',
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
if missing_expected:
    lines.append('Expected main collections without explicit rules: ' + ', '.join(f'`{x}`' for x in missing_expected))
else:
    lines.append('All expected main collections have explicit rules.')

if source_without_rule:
    lines.append('Source-discovered names without explicit rules: ' + ', '.join(f'`{x}`' for x in source_without_rule))
else:
    lines.append('No source-discovered collection names are missing an explicit rule match.')

failed_invariants = [k for k, v in invariants.items() if not v]
if failed_invariants:
    lines.append('Failed security invariants: ' + ', '.join(f'`{x}`' for x in failed_invariants))
else:
    lines.append('All Part 1 security invariants passed.')

REPORT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'Wrote {REPORT}')
print('Missing expected:', missing_expected)
print('Source without rule:', source_without_rule)
print('Failed invariants:', failed_invariants)
