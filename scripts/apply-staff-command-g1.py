from pathlib import Path

RULES_MARKER = "// COGNITUS STAFF / COMMAND — GENERATION 1"
SCRIPT_MARKER = "staffCommandLinkG1.js"

COMMAND_RULES = r'''
    // ============================================================
    // COGNITUS STAFF / COMMAND — GENERATION 1
    //
    // Staff identity is intentionally separate from product roles. The
    // public portal and Command share one Firebase Auth UID and database,
    // while staffAccess/{uid} is the internal authorization boundary.
    // ============================================================

    function staffAccessPath(uid) {
      return /databases/$(database)/documents/staffAccess/$(uid);
    }

    function staffDirectoryPath(uid) {
      return /databases/$(database)/documents/staffDirectory/$(uid);
    }

    function staffEmploymentPath(uid) {
      return /databases/$(database)/documents/staffEmployment/$(uid);
    }

    function hasStaffAccess() {
      return signedIn() && exists(staffAccessPath(request.auth.uid));
    }

    function currentStaff() {
      return get(staffAccessPath(request.auth.uid)).data;
    }

    function activeStaff() {
      return hasStaffAccess()
        && currentStaff().status in ['active', 'training', 'on_leave']
        && currentStaff().permissions is list
        && 'portal.access' in currentStaff().permissions;
    }

    function staffPermission(permission) {
      return activeStaff() && permission in currentStaff().permissions;
    }

    function validStaffStatus(value) {
      return value in ['active', 'training', 'on_leave', 'suspended', 'former'];
    }

    function validStaffRank(value) {
      return value in [
        'owner', 'chief-officer', 'director', 'manager', 'supervisor',
        'senior-staff', 'staff', 'trainee', 'restricted'
      ];
    }

    function validStaffDepartment(value) {
      return value in [
        'executive-office', 'public-relations', 'customer-service',
        'finance', 'human-resources', 'quality-assurance'
      ];
    }

    function staffRankLevel(rank) {
      return rank == 'owner' ? 100
        : rank == 'chief-officer' ? 90
        : rank == 'director' ? 75
        : rank == 'manager' ? 60
        : rank == 'supervisor' ? 50
        : rank == 'senior-staff' ? 40
        : rank == 'staff' ? 30
        : rank == 'trainee' ? 20
        : 0;
    }

    function validStaffEmployeeId(value) {
      return value is string && value.matches('^COG-[0-9]{6}$');
    }

    function validStaffPermissions(value) {
      return value is list
        && value.size() >= 1
        && value.size() <= 40
        && value.hasOnly([
          'portal.access', 'directory.read', 'profile.read', 'department.read',
          'department.manage', 'staff.provision', 'staff.manage', 'staff.private.read',
          'permissions.manage', 'tickets.read', 'tickets.manage', 'tickets.all.read',
          'cs.manage', 'pr.manage', 'pr.approve', 'finance.read', 'finance.manage',
          'payroll.read', 'payroll.manage', 'payroll.approve', 'hr.records.read',
          'hr.records.manage', 'internalAffairs.read', 'internalAffairs.manage',
          'qa.read', 'qa.manage', 'qa.audit', 'reports.review', 'claims.review',
          'appeals.review', 'verification.review', 'organizations.review', 'cases.read',
          'cases.manage', 'evidence.read', 'evidence.manage', 'accreditation.manage',
          'escalations.manage', 'incidents.manage', 'audit.read', 'system.manage'
        ]);
    }

    function validStaffDirectoryDocument(uid, value) {
      return value is map
        && value.keys().hasOnly([
          'uid', 'employeeId', 'displayName', 'discordUsername', 'title',
          'departmentId', 'rank', 'status', 'joinedAt', 'createdAt', 'updatedAt'
        ])
        && value.uid == uid
        && validStaffEmployeeId(value.employeeId)
        && shortString(value.displayName, 64)
        && value.displayName.size() > 0
        && shortString(value.discordUsername, 64)
        && shortString(value.title, 100)
        && value.title.size() > 0
        && validStaffDepartment(value.departmentId)
        && validStaffRank(value.rank)
        && validStaffStatus(value.status)
        && value.joinedAt is timestamp
        && value.createdAt is timestamp
        && value.updatedAt is timestamp;
    }

    function validStaffAccessDocument(uid, value) {
      return value is map
        && value.keys().hasOnly([
          'uid', 'employeeId', 'departmentId', 'rank', 'accessLevel', 'status',
          'permissions', 'grantedByUid', 'createdAt', 'updatedAt'
        ])
        && value.uid == uid
        && validStaffEmployeeId(value.employeeId)
        && validStaffDepartment(value.departmentId)
        && validStaffRank(value.rank)
        && value.accessLevel == staffRankLevel(value.rank)
        && validStaffStatus(value.status)
        && validStaffPermissions(value.permissions)
        && 'portal.access' in value.permissions
        && value.grantedByUid is string
        && value.createdAt is timestamp
        && value.updatedAt is timestamp;
    }

    function validStaffEmploymentDocument(uid, value) {
      return value is map
        && value.keys().hasOnly([
          'uid', 'employeeId', 'employmentStatus', 'managerUid', 'hireDate',
          'positionHistory', 'notes', 'createdAt', 'updatedAt'
        ])
        && value.uid == uid
        && validStaffEmployeeId(value.employeeId)
        && validStaffStatus(value.employmentStatus)
        && (value.managerUid == null || value.managerUid is string)
        && value.hireDate is timestamp
        && value.positionHistory is list
        && value.positionHistory.size() >= 1
        && value.positionHistory.size() <= 100
        && shortString(value.notes, 5000)
        && value.createdAt is timestamp
        && value.updatedAt is timestamp;
    }

    function canProvisionStaffG1() {
      return isOwner() || staffPermission('staff.provision');
    }

    function canManageStaffDirectoryG1() {
      return isOwner() || staffPermission('staff.manage');
    }

    function canReadPrivateStaffG1() {
      return isOwner()
        || staffPermission('staff.private.read')
        || staffPermission('hr.records.read');
    }

    function safeDelegatedStaffProvisionG1(value) {
      return staffPermission('staff.provision')
        && value.rank != 'owner'
        && value.accessLevel < currentStaff().accessLevel
        && value.departmentId == currentStaff().departmentId
        && value.permissions.hasOnly(currentStaff().permissions)
        && !value.permissions.hasAny(['permissions.manage', 'system.manage']);
    }

    match /staffDirectory/{uid} {
      allow read: if activeStaff();

      allow create: if canProvisionStaffG1()
        && exists(userPath(uid))
        && get(userPath(uid)).data.status == 'active'
        && validStaffDirectoryDocument(uid, request.resource.data)
        && request.resource.data.displayName == get(userPath(uid)).data.displayName
        && request.resource.data.discordUsername == get(userPath(uid)).data.discordUsername
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && existsAfter(staffAccessPath(uid))
        && getAfter(staffAccessPath(uid)).data.employeeId == request.resource.data.employeeId
        && getAfter(staffAccessPath(uid)).data.departmentId == request.resource.data.departmentId
        && getAfter(staffAccessPath(uid)).data.rank == request.resource.data.rank
        && getAfter(staffAccessPath(uid)).data.status == request.resource.data.status
        && existsAfter(staffEmploymentPath(uid))
        && getAfter(staffEmploymentPath(uid)).data.employeeId == request.resource.data.employeeId;

      allow update: if canManageStaffDirectoryG1()
        && validStaffDirectoryDocument(uid, request.resource.data)
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.employeeId == resource.data.employeeId
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt == request.time
        && getAfter(staffAccessPath(uid)).data.departmentId == request.resource.data.departmentId
        && getAfter(staffAccessPath(uid)).data.rank == request.resource.data.rank
        && getAfter(staffAccessPath(uid)).data.status == request.resource.data.status;

      allow delete: if false;
    }

    match /staffAccess/{uid} {
      allow read: if (
          isOwner()
          || (
            activeStaff()
            && (
              uid == request.auth.uid
              || staffPermission('permissions.manage')
              || staffPermission('staff.private.read')
              || staffPermission('hr.records.read')
            )
          )
        );

      allow create: if canProvisionStaffG1()
        && exists(userPath(uid))
        && get(userPath(uid)).data.status == 'active'
        && validStaffAccessDocument(uid, request.resource.data)
        && request.resource.data.grantedByUid == request.auth.uid
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && existsAfter(staffDirectoryPath(uid))
        && getAfter(staffDirectoryPath(uid)).data.employeeId == request.resource.data.employeeId
        && getAfter(staffDirectoryPath(uid)).data.departmentId == request.resource.data.departmentId
        && getAfter(staffDirectoryPath(uid)).data.rank == request.resource.data.rank
        && getAfter(staffDirectoryPath(uid)).data.status == request.resource.data.status
        && (
          (
            isOwner()
            && (
              request.resource.data.rank != 'owner'
              || (
                get(userPath(uid)).data.role == 'owner'
                && request.resource.data.departmentId == 'executive-office'
                && request.resource.data.accessLevel == 100
                && 'permissions.manage' in request.resource.data.permissions
                && 'system.manage' in request.resource.data.permissions
              )
            )
          )
          || safeDelegatedStaffProvisionG1(request.resource.data)
        );

      allow update: if isOwner()
        && validStaffAccessDocument(uid, request.resource.data)
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.employeeId == resource.data.employeeId
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt == request.time
        && (
          uid != request.auth.uid
          || (
            request.resource.data.rank == 'owner'
            && request.resource.data.status == 'active'
            && 'portal.access' in request.resource.data.permissions
            && 'permissions.manage' in request.resource.data.permissions
            && 'system.manage' in request.resource.data.permissions
          )
        );

      allow delete: if false;
    }

    match /staffEmployment/{uid} {
      allow read: if activeStaff()
        && (uid == request.auth.uid || canReadPrivateStaffG1());

      allow create: if canProvisionStaffG1()
        && validStaffEmploymentDocument(uid, request.resource.data)
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time
        && existsAfter(staffDirectoryPath(uid))
        && existsAfter(staffAccessPath(uid))
        && request.resource.data.employeeId == getAfter(staffDirectoryPath(uid)).data.employeeId
        && request.resource.data.employeeId == getAfter(staffAccessPath(uid)).data.employeeId
        && request.resource.data.employmentStatus == getAfter(staffAccessPath(uid)).data.status;

      allow update: if (isOwner() || staffPermission('hr.records.manage'))
        && validStaffEmploymentDocument(uid, request.resource.data)
        && request.resource.data.uid == resource.data.uid
        && request.resource.data.employeeId == resource.data.employeeId
        && request.resource.data.createdAt == resource.data.createdAt
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }

    match /staffInbox/{notificationId} {
      allow read: if activeStaff()
        && resource.data.recipientUid == request.auth.uid;

      allow create: if activeStaff()
        && request.resource.data.keys().hasOnly([
          'id', 'recipientUid', 'senderUid', 'kind', 'title', 'message',
          'href', 'readAt', 'createdAt', 'updatedAt'
        ])
        && request.resource.data.id == notificationId
        && request.resource.data.senderUid == request.auth.uid
        && exists(staffAccessPath(request.resource.data.recipientUid))
        && shortString(request.resource.data.kind, 50)
        && shortString(request.resource.data.title, 120)
        && request.resource.data.title.size() > 0
        && shortString(request.resource.data.message, 1000)
        && (request.resource.data.href == null || shortString(request.resource.data.href, 300))
        && request.resource.data.readAt == null
        && request.resource.data.createdAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow update: if activeStaff()
        && resource.data.recipientUid == request.auth.uid
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['readAt', 'updatedAt'])
        && request.resource.data.readAt == request.time
        && request.resource.data.updatedAt == request.time;

      allow delete: if false;
    }
'''.strip("\n")


def patch_rules() -> bool:
    path = Path("firestore.rules")
    text = path.read_text(encoding="utf-8")
    if RULES_MARKER in text:
        return False
    needle = "    // ============================================================\n    // FINAL DEFAULT-DENY BOUNDARY"
    if needle not in text:
        raise SystemExit("Could not find Cognitus final default-deny boundary; refusing to patch rules.")
    text = text.replace(needle, COMMAND_RULES + "\n\n" + needle, 1)
    path.write_text(text, encoding="utf-8")
    return True


def patch_index() -> bool:
    path = Path("index.html")
    text = path.read_text(encoding="utf-8")
    if SCRIPT_MARKER in text:
        return False
    needle = "</body>"
    if needle not in text:
        raise SystemExit("Could not find </body> in index.html; refusing to patch main portal.")
    script = '  <script type="module" src="./src/staffCommandLinkG1.js?v=20260906-g1"></script>\n'
    text = text.replace(needle, script + needle, 1)
    path.write_text(text, encoding="utf-8")
    return True


if __name__ == "__main__":
    changed = [patch_rules(), patch_index()]
    print("Cognitus Staff / Command Generation 1 integration:", "updated" if any(changed) else "already applied")
