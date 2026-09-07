from pathlib import Path

p = Path('firestore.rules')
s = p.read_text(encoding='utf-8')

# The Part 2 finalizer was authored against the same Command request rule but
# expected the closing parenthesis at four spaces. The current generated rules
# use eight spaces. Normalize only that one block so the semantic hardening
# script can apply deterministically.
needle = """          || commandG2CanManageDepartment(resource.data.departmentId)
        );

      allow create: if activeStaff()
"""
replacement = """          || commandG2CanManageDepartment(resource.data.departmentId)
    );

      allow create: if activeStaff()
"""

if '// FIRESTORE_PART2_STAFF_COMPANY_COMPLETE' not in s:
    count = s.count(needle)
    if count != 1:
        raise RuntimeError(f'Expected one Command request read anchor, found {count}')
    s = s.replace(needle, replacement, 1)
    p.write_text(s, encoding='utf-8')

print('Part 2 current-rules normalization complete.')
