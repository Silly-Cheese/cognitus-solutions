from pathlib import Path

# One-time Generation 3 least-privilege hardening. Kept idempotent so the
# workflow can be re-run safely while the shared ruleset is being finalized.
RULES_PATH = Path("firestore.rules")
rules = RULES_PATH.read_text(encoding="utf-8")


def block_bounds(text, header):
    start = text.find(header)
    if start < 0:
        raise RuntimeError(f"Could not find {header}")
    end = text.find("\n    match /", start + len(header))
    if end < 0:
        raise RuntimeError(f"Could not bound {header}")
    return start, end


# Appeals reviewers should not inherit full report-review authority. They may
# only perform the exact linked-report state transition used by an accepted
# appeal: reviewed report -> disputed/private review.
report_header = "    match /reports/{reportId} {"
start, end = block_bounds(rules, report_header)
block = rules[start:end]
block = block.replace(
    "allow update: if (isReviewer() || staffPermission('reports.review') || staffPermission('appeals.review'))",
    "allow update: if (isReviewer() || staffPermission('reports.review'))",
    1
)
appeal_rule = '''

      // Staff appeal authority is deliberately narrower than report-review
      // authority. It can only move an already reviewed report into the
      // disputed/private-review state used after an accepted appeal.
      allow update: if staffPermission('appeals.review')
        && resource.data.status in ['approved', 'published']
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status', 'visibility', 'appealStatus', 'reviewedByUid', 'reviewedAt', 'updatedAt'
        ])
        && request.resource.data.status == 'disputed'
        && request.resource.data.visibility == 'private_review'
        && request.resource.data.appealStatus == 'accepted'
        && request.resource.data.reviewedByUid == request.auth.uid
        && request.resource.data.reviewedAt == request.time
        && request.resource.data.updatedAt == request.time;
'''
if "Staff appeal authority is deliberately narrower" not in block:
    marker = "\n      allow delete: if isOwner()"
    if marker not in block:
        raise RuntimeError("Could not locate reports delete rule")
    block = block.replace(marker, appeal_rule + marker, 1)
rules = rules[:start] + block + rules[end:]

# Claims reviewers should not inherit general identity/risk editing. The normal
# claim flow only needs to attach an unclaimed profile to an active Cognitus
# user whose immutable Discord ID already exists on that profile.
profile_header = "    match /profiles/{profileId} {"
start, end = block_bounds(rules, profile_header)
block = rules[start:end]
block = block.replace(
    "allow update: if (isReviewer() || staffPermission('reports.review') || staffPermission('claims.review') || staffPermission('verification.review'))",
    "allow update: if isReviewer()",
    1
)
claim_rule = '''

      // Standard Staff / Command claim approval: link only to an active user
      // whose immutable Cognitus Discord ID is already present on the profile.
      // This does not grant claim reviewers risk/standing/alias edit authority.
      allow update: if staffPermission('claims.review')
        && resource.data.claimedByUid == null
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'claimedByUid', 'identityStatus', 'updatedAt'
        ])
        && request.resource.data.claimedByUid is string
        && request.resource.data.identityStatus == 'claimed_unverified'
        && exists(userPath(request.resource.data.claimedByUid))
        && get(userPath(request.resource.data.claimedByUid)).data.status == 'active'
        && get(userPath(request.resource.data.claimedByUid)).data.discordId in resource.data.discordIds
        && request.resource.data.updatedAt == request.time;
'''
if "Standard Staff / Command claim approval" not in block:
    marker = "\n      allow update: if (isReviewer() || staffPermission('claims.review') || staffPermission('verification.review'))"
    if marker not in block:
        raise RuntimeError("Could not locate external-profile claim link rule")
    block = block.replace(marker, claim_rule + marker, 1)
rules = rules[:start] + block + rules[end:]

RULES_PATH.write_text(rules, encoding="utf-8")

checks = {
    "appeal permission removed from full report review": "staffPermission('reports.review') || staffPermission('appeals.review')" not in rules,
    "appeal permission has limited disputed transition": "Staff appeal authority is deliberately narrower" in rules,
    "staff claim permissions removed from broad profile review": "staffPermission('reports.review') || staffPermission('claims.review') || staffPermission('verification.review')" not in rules,
    "staff claim link requires immutable Discord match": "get(userPath(request.resource.data.claimedByUid)).data.discordId in resource.data.discordIds" in rules,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise RuntimeError("Product authority hardening failed: " + "; ".join(failed))

print("Narrowed Generation 3 product-side staff authority.")
