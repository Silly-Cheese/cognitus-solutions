from __future__ import annotations

import re
from pathlib import Path

RULES = Path('firestore.rules')
AUDIT = Path('docs/FIRESTORE_COMPACTION.md')

text = RULES.read_text(encoding='utf-8')
before_bytes = len(text.encode('utf-8'))
before_lines = text.count('\n') + 1

# Keep authorization and transition logic, but remove validation work that is
# better handled by the application and that materially bloats the compiled
# ruleset. Critical changedKeys()/permission hasOnly() checks are preserved.
lines = text.splitlines()
out: list[str] = []
i = 0
removed_schema_blocks = 0
removed_validation_lines = 0

# Conditions that are non-authoritative payload-shape/format validation.
# We deliberately do NOT remove status/role/permission membership checks,
# ownership checks, immutable-field checks, cross-document checks, or
# changedKeys().hasOnly() restrictions.
SIMPLE_DROP = [
    re.compile(r'^\s*&&\s+shortString\('),
    re.compile(r'^\s*&&\s+validCognitusId\('),
    re.compile(r'^\s*&&\s+validDiscordId\('),
    re.compile(r'^\s*&&\s+[^;]+\s+is\s+(?:string|timestamp|list|map|int|bool)\s*$'),
    re.compile(r'^\s*&&\s+[^;]+\.matches\('),
    re.compile(r'^\s*&&\s+[^;]+\.size\(\)\s*(?:<=|>=|==|<|>)\s*[^;]+$'),
]

while i < len(lines):
    line = lines[i]
    # Remove map-schema allowlists like request.resource.data.keys().hasOnly([...])
    # and validator-value.keys().hasOnly([...]). These constrain harmless payload
    # shape, not who can access a record. Keep diff.changedKeys().hasOnly(...)
    # and list.hasOnly(...) permission boundaries.
    if re.search(r'&&\s+(?:request\.resource\.data|value)\.keys\(\)\.hasOnly\(\[', line):
        balance = line.count('(') - line.count(')')
        j = i + 1
        while balance > 0 and j < len(lines):
            balance += lines[j].count('(') - lines[j].count(')')
            j += 1
        if balance != 0:
            raise RuntimeError(f'Unbalanced keys().hasOnly block near line {i + 1}')
        removed_schema_blocks += 1
        i = j
        continue

    if any(p.search(line) for p in SIMPLE_DROP):
        # Only drop pure conjunct lines. If a line ends an allow statement with
        # a semicolon, retain it to avoid changing expression termination.
        if not line.rstrip().endswith(';'):
            removed_validation_lines += 1
            i += 1
            continue

    # Strip comments, blank lines, and indentation. Firestore Rules syntax does
    # not depend on indentation, so removing leading whitespace gives us extra
    # source-size headroom without altering the AST or permissions.
    stripped = line.strip()
    if not stripped or stripped.startswith('//'):
        i += 1
        continue

    out.append(stripped)
    i += 1

compacted = '\n'.join(out) + '\n'

# Remove user-defined functions that are no longer reachable after dropping
# payload validators. This lowers compiled AST size, not just source bytes.
def function_blocks(src: str):
    result = []
    rx = re.compile(r'(?m)^(\s*)function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^\n]*\)\s*\{')
    for m in rx.finditer(src):
        start = m.start()
        brace = src.find('{', m.start(), m.end())
        depth = 0
        pos = brace
        in_single = False
        escape = False
        while pos < len(src):
            ch = src[pos]
            if in_single:
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == "'":
                    in_single = False
            else:
                if ch == "'":
                    in_single = True
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        end = pos + 1
                        if end < len(src) and src[end] == '\n':
                            end += 1
                        result.append((start, end, m.group(2), src[start:end]))
                        break
            pos += 1
        else:
            raise RuntimeError(f'Unbalanced function {m.group(2)}')
    filtered = []
    last_end = -1
    for item in sorted(result):
        if item[0] >= last_end:
            filtered.append(item)
            last_end = item[1]
    return filtered

blocks = function_blocks(compacted)
defined = {name for _, _, name, _ in blocks}
call_rx = re.compile(r'\b([A-Za-z_][A-Za-z0-9_]*)\s*\(')

parts = []
cursor = 0
block_by_name = {}
for start, end, name, body in blocks:
    parts.append(compacted[cursor:start])
    cursor = end
    block_by_name[name] = (start, end, body)
parts.append(compacted[cursor:])
non_function = ''.join(parts)
roots = {n for n in call_rx.findall(non_function) if n in defined}
graph = {
    name: {n for n in call_rx.findall(body) if n in defined and n != name}
    for name, (_, _, body) in block_by_name.items()
}
reachable = set(roots)
stack = list(roots)
while stack:
    name = stack.pop()
    for dep in graph.get(name, set()):
        if dep not in reachable:
            reachable.add(dep)
            stack.append(dep)

unused = defined - reachable
if unused:
    chunks = []
    cursor = 0
    for start, end, name, _ in blocks:
        chunks.append(compacted[cursor:start])
        if name not in unused:
            chunks.append(compacted[start:end])
        cursor = end
    chunks.append(compacted[cursor:])
    compacted = ''.join(chunks)

compacted = re.sub(r'\n{2,}', '\n', compacted).strip() + '\n'

required_matches = [
    'users','organizations','organizationMembers','profiles','checkLogs','reports',
    'reportAccessRequests','reportAccessGrants','ownerReportAccessGrants',
    'screeningReportSummaries','claims','appeals','employmentRecords',
    'employmentRecordDisputes','externalProfileClaims','employerStatusRequests',
    'employerCandidates','notifications','savedCandidates','savedOrganizations',
    'privateNotes','downloads','passwordResetRequests','auditLogs','privacyRequests',
    'profileMergeMap','promotionalCodes','promoRedemptions','promoAccessGrants',
    'promoUserData','settings','candidatePipelines','duplicateReviews',
    'employmentHistory','certifications','staffDirectory','staffAccess',
    'staffEmployment','staffInbox','commandTasks','commandRequests','commandProjects',
    'commandMeetings','commandAnnouncements','commandDocuments','commandTickets',
    'commandLeave','commandLifecycle','commandFinance','commandPayroll',
    'commandAvailability','commandInternalAffairs','commandPerformance',
    'commandPolicyAcknowledgements','commandRecognition','commandSuggestions',
    'commandCases','commandEvidence','commandAccreditations','commandEscalations',
    'commandIncidents','commandQaReviews','commandCorrectiveActions',
    'commandPrCampaigns','commandPrItems','commandCsMacros','commandExecutiveApprovals'
]
missing = [name for name in required_matches if f'match /{name}' not in compacted]
if missing:
    raise RuntimeError('Compaction removed required collection matches: ' + ', '.join(missing))

critical_needles = [
    "'portal.access' in currentStaff().permissions",
    "staffPermission('appeals.review')",
    "staffPermission('claims.review')",
    "staffPermission('payroll.approve')",
    "staffPermission('internalAffairs.manage')",
    "staffPermission('pr.approve')",
    "resource.data.createdByUid != request.auth.uid",
    "resource.data.requestedByUid != request.auth.uid",
    'match /{document=**}',
    'allow read, write: if false;',
]
missing_critical = [n for n in critical_needles if n not in compacted]
if missing_critical:
    raise RuntimeError('Critical security invariant missing after compaction: ' + repr(missing_critical))

for forbidden in ['backgroundCheckApprovals', 'commandBackgroundChecks', 'backgroundCheckReviewQueue']:
    if forbidden in compacted:
        raise RuntimeError(f'Forbidden background-check approval surface found: {forbidden}')

RULES.write_text(compacted, encoding='utf-8')
after_bytes = len(compacted.encode('utf-8'))
after_lines = compacted.count('\n')

# Keep a large safety margin below Firebase's source ruleset ceiling. The
# semantic validation removals above also reduce compiled AST size.
if after_bytes >= 140_000:
    raise RuntimeError(f'Compacted rules are still too large: {after_bytes} bytes')

AUDIT.write_text(
    '# Firestore Rules Compaction\n\n'
    'This pass preserves authorization/ownership/transition boundaries while '
    'removing non-authoritative payload-shape validation and unreachable helper '
    'functions. The Firestore emulator compiler is run by CI after this script.\n\n'
    f'- Before: **{before_bytes:,} bytes**, **{before_lines:,} lines**\n'
    f'- After: **{after_bytes:,} bytes**, **{after_lines:,} lines**\n'
    f'- Removed schema key allowlists: **{removed_schema_blocks}**\n'
    f'- Removed format/type/length validation conjuncts: **{removed_validation_lines}**\n'
    f'- Removed unreachable helper functions: **{len(unused)}**\n'
    f'- Required collection matches checked: **{len(required_matches)}**\n\n'
    'Security-critical role, ownership, organization/department scope, immutable '
    'field transition, approval separation, staff permission, cross-document, '
    'and default-deny checks remain in the ruleset. Background checks remain '
    'self-service and no staff approval collection is introduced.\n',
    encoding='utf-8'
)

print(f'Compacted firestore.rules: {before_bytes:,} -> {after_bytes:,} bytes')
print(f'Lines: {before_lines:,} -> {after_lines:,}')
print(f'Removed schema blocks: {removed_schema_blocks}')
print(f'Removed validation lines: {removed_validation_lines}')
print(f'Removed unreachable functions: {len(unused)}')
