# Firestore Rules Compaction

This pass preserves authorization/ownership/transition boundaries while removing non-authoritative payload-shape validation and unreachable helper functions. The Firestore emulator compiler is run by CI after this script.

- Before: **205,391 bytes**, **4,205 lines**
- After: **133,643 bytes**, **2,882 lines**
- Removed schema key allowlists: **66**
- Removed format/type/length validation conjuncts: **420**
- Removed unreachable helper functions: **2**
- Required collection matches checked: **67**

Security-critical role, ownership, organization/department scope, immutable field transition, approval separation, staff permission, cross-document, and default-deny checks remain in the ruleset. Background checks remain self-service and no staff approval collection is introduced.
