from pathlib import Path

path = Path('firestore.rules')
text = path.read_text()

marker = "// EXECUTIVE_REGISTRY_MANAGEMENT_V2"
if marker not in text:
    user_anchor = "allow update: if role() == 'admin'\n"
    user_rule = """// EXECUTIVE_REGISTRY_MANAGEMENT_V2\nallow update: if commandOwner()\n&& resource.data.role != 'owner'\n&& request.resource.data.role != 'owner'\n&& request.resource.data.diff(resource.data).changedKeys().hasOnly([\n'displayName', 'discordUsername', 'role', 'status', 'organizationId',\n'identityVerified', 'updatedAt'\n])\n&& validUserRole(request.resource.data.role)\n&& validUserStatus(request.resource.data.status)\n&& shortString(request.resource.data.displayName, 120)\n&& shortString(request.resource.data.discordUsername, 100)\n&& request.resource.data.identityVerified is bool\n&& request.resource.data.uid == resource.data.uid\n&& request.resource.data.cognitusId == resource.data.cognitusId\n&& request.resource.data.profileId == resource.data.profileId\n&& request.resource.data.discordId == resource.data.discordId\n&& request.resource.data.syntheticEmail == resource.data.syntheticEmail\n&& request.resource.data.accountType == resource.data.accountType\n&& request.resource.data.realEmailCollected == resource.data.realEmailCollected\n&& request.resource.data.updatedAt == request.time;\n"""
    if user_anchor not in text:
        raise SystemExit('user update anchor not found')
    text = text.replace(user_anchor, user_rule + user_anchor, 1)

    old_delete = "allow delete: if (signedIn() && request.auth.uid == uid)\n|| (isOwner() && resource.data.role != 'owner');"
    new_delete = "allow delete: if (signedIn() && request.auth.uid == uid)\n|| (commandOwner()\n&& resource.data.role != 'owner'\n&& uid != request.auth.uid\n&& !exists(staffAccessPath(uid)));"
    if old_delete not in text:
        raise SystemExit('user delete anchor not found')
    text = text.replace(old_delete, new_delete, 1)

    profile_anchor = "allow update: if isReviewer()\n&& request.resource.data.diff(resource.data).changedKeys().hasOnly([\n'claimedByUid', 'identityStatus', 'identityConfidence', 'professionalStanding',"
    profile_rule = """allow update: if commandOwner()\n&& (\nresource.data.linkedUserId == null\n|| (exists(userPath(resource.data.linkedUserId))\n&& get(userPath(resource.data.linkedUserId)).data.role != 'owner')\n)\n&& request.resource.data.diff(resource.data).changedKeys().hasOnly([\n'displayName', 'identityStatus', 'identityConfidence', 'professionalStanding',\n'riskLevel', 'lastReviewedAt', 'updatedAt'\n])\n&& shortString(request.resource.data.displayName, 120)\n&& request.resource.data.identityStatus in [\n'self_declared', 'claimed_unverified', 'claimed', 'employer_supplied',\n'verified', 'unverified', 'disputed'\n]\n&& request.resource.data.identityConfidence >= 0\n&& request.resource.data.identityConfidence <= 100\n&& request.resource.data.professionalStanding in [\n'unreviewed', 'good_standing', 'watch', 'concern', 'restricted', 'disqualified'\n]\n&& request.resource.data.riskLevel in [\n'unreviewed', 'low', 'moderate', 'high', 'critical'\n]\n&& request.resource.data.cognitusId == resource.data.cognitusId\n&& request.resource.data.linkedUserId == resource.data.linkedUserId\n&& request.resource.data.discordIds == resource.data.discordIds\n&& request.resource.data.updatedAt == request.time;\n"""
    if profile_anchor not in text:
        raise SystemExit('profile update anchor not found')
    text = text.replace(profile_anchor, profile_rule + profile_anchor, 1)

    org_delete = "allow delete: if isOwner();\n}\nmatch /checkLogs/{checkId}"
    if org_delete not in text:
        raise SystemExit('organization delete anchor not found')
    text = text.replace(org_delete, "allow delete: if commandOwner();\n}\nmatch /checkLogs/{checkId}", 1)

path.write_text(text)
print('Executive Registry management rules applied')
