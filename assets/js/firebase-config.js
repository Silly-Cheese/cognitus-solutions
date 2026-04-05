window.COGNITUS_FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

window.COGNITUS_RUNTIME = {
  useFirebase: false,
  enableVerboseLogging: true,
  defaultStaffSeed: {
    roleName: 'Administrator',
    isActive: true,
    canViewRecords: true,
    canCreateRecord: true,
    canAddNote: true,
    canReviewApplications: true,
    canManageStaff: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  defaultRecordSeed: {
    status: 'Active',
    riskLevel: 'Low',
    flagsCount: 0,
    notesCount: 0,
    visibleToPublic: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  defaultSettingsSeed: {
    recordsEnabled: true,
    applicationsEnabled: true,
    publicPortalEnabled: true,
    staffDashboardEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};
