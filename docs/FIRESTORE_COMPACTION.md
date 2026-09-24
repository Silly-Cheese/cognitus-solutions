# Firestore Rules Compaction

This pass preserves authorization/ownership/transition boundaries while removing non-authoritative payload-shape validation and unreachable helper functions. The Firestore emulator compiler is run by CI after this script.

- Before: **146,962 bytes**, **3,174 lines**
- After: **144,543 bytes**, **3,126 lines**
- Removed schema key allowlists: **3**
- Removed format/type/length validation conjuncts: **28**
- Removed unreachable helper functions: **0**
- Required collection matches checked: **69**

Security-critical role, ownership, organization/department scope, immutable field transition, approval separation, staff permission, cross-document, and default-deny checks remain in the ruleset. Background checks remain self-service and no staff approval collection is introduced.
