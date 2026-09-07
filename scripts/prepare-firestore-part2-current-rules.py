from pathlib import Path

rules_path = Path('firestore.rules')
finalizer_path = Path('scripts/finalize-firestore-part2-staff-company.py')

rules = rules_path.read_text(encoding='utf-8')

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

if '// FIRESTORE_PART2_STAFF_COMPANY_COMPLETE' not in rules:
    count = rules.count(needle)
    if count != 1:
        raise RuntimeError(f'Expected one Command request read anchor, found {count}')
    rules = rules.replace(needle, replacement, 1)
    rules_path.write_text(rules, encoding='utf-8')

# Generation 1 named the private-employment read helper canReadPrivateStaffG1().
# Part 2's audit originally checked the pre-generation helper name, causing a
# false failure even though staffEmployment is correctly self/HR scoped.
finalizer = finalizer_path.read_text(encoding='utf-8')
old_audit = "'restricted employment records are HR/self scoped': 'match /staffEmployment/{uid}' in rules and 'canReadPrivateStaff()' in rules,"
new_audit = "'restricted employment records are HR/self scoped': 'match /staffEmployment/{uid}' in rules and 'canReadPrivateStaffG1()' in rules,"
if old_audit in finalizer:
    finalizer = finalizer.replace(old_audit, new_audit, 1)
elif new_audit not in finalizer:
    raise RuntimeError('Could not locate Part 2 private-employment audit invariant')
finalizer_path.write_text(finalizer, encoding='utf-8')

print('Part 2 current-rules compatibility normalization complete.')
