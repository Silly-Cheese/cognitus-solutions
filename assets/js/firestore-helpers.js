(() => {
  const RUNTIME = window.COGNITUS_RUNTIME || {};
  const FIREBASE_CONFIG = window.COGNITUS_FIREBASE_CONFIG || {};

  const STORAGE_KEYS = {
    records: 'cognitus-records',
    applications: 'cognitus-applications',
    staff: 'cognitus-staff',
    settings: 'cognitus-settings'
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const nowIso = () => new Date().toISOString();

  const readJson = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  };

  const normalizeUserId = (value) => String(value || '').trim();
  const normalizeUsername = (value) => String(value || '').trim();
  const normalizeUsernameLower = (value) => normalizeUsername(value).toLowerCase();

  const defaultSeeds = {
    staff: clone(RUNTIME.defaultStaffSeed || {}),
    record: clone(RUNTIME.defaultRecordSeed || {}),
    settings: clone(RUNTIME.defaultSettingsSeed || {})
  };

  const createBaseRecord = (input = {}) => {
    const userId = normalizeUserId(input.discordUserId || input.userId);
    const username = normalizeUsername(input.username || input.fullNameOrUsername || 'Unknown User');
    const createdAt = nowIso();

    return {
      discordUserId: userId,
      username,
      usernameLower: normalizeUsernameLower(username),
      displayName: normalizeUsername(input.displayName || username),
      notes: [],
      history: [
        {
          action: 'RECORD_CREATED',
          details: 'Record was created automatically by the Cognitus self-healing data layer.',
          createdAt
        }
      ],
      ...clone(defaultSeeds.record),
      createdAt,
      updatedAt: createdAt
    };
  };

  const createBaseStaff = (input = {}) => {
    const userId = normalizeUserId(input.discordUserId || input.userId);
    const username = normalizeUsername(input.username || 'Unknown Staff');
    const createdAt = nowIso();

    return {
      discordUserId: userId,
      username,
      usernameLower: normalizeUsernameLower(username),
      ...clone(defaultSeeds.staff),
      createdAt,
      updatedAt: createdAt
    };
  };

  const createBaseSettings = () => ({
    ...clone(defaultSeeds.settings),
    createdAt: nowIso(),
    updatedAt: nowIso()
  });

  const localStore = {
    records: () => readJson(STORAGE_KEYS.records, {}),
    staff: () => readJson(STORAGE_KEYS.staff, {}),
    applications: () => readJson(STORAGE_KEYS.applications, []),
    settings: () => readJson(STORAGE_KEYS.settings, null)
  };

  const saveStore = {
    records: (value) => writeJson(STORAGE_KEYS.records, value),
    staff: (value) => writeJson(STORAGE_KEYS.staff, value),
    applications: (value) => writeJson(STORAGE_KEYS.applications, value),
    settings: (value) => writeJson(STORAGE_KEYS.settings, value)
  };

  const DataLayer = {
    isFirebaseConfigured() {
      return Boolean(
        RUNTIME.useFirebase &&
        FIREBASE_CONFIG &&
        FIREBASE_CONFIG.apiKey &&
        FIREBASE_CONFIG.projectId &&
        FIREBASE_CONFIG.appId
      );
    },

    log(...args) {
      if (RUNTIME.enableVerboseLogging) {
        console.log('[Cognitus DataLayer]', ...args);
      }
    },

    ensureSettings() {
      const current = localStore.settings();
      if (current) return current;

      const created = createBaseSettings();
      saveStore.settings(created);
      this.log('Created missing settings object.');
      return created;
    },

    ensureStaff(userId, username = 'Unknown Staff') {
      const id = normalizeUserId(userId);
      if (!id) throw new Error('A valid staff user ID is required.');

      const staff = localStore.staff();
      if (!staff[id]) {
        staff[id] = createBaseStaff({ userId: id, username });
        saveStore.staff(staff);
        this.log(`Created missing staff document for ${id}.`);
      }

      return staff[id];
    },

    getStaffById(userId) {
      const staff = localStore.staff();
      return staff[normalizeUserId(userId)] || null;
    },

    getAllStaff() {
      return Object.values(localStore.staff());
    },

    ensureRecord(input = {}) {
      const userId = normalizeUserId(input.discordUserId || input.userId);
      const username = normalizeUsername(input.username || input.fullNameOrUsername);

      if (!userId && !username) {
        throw new Error('A record requires a user ID or username.');
      }

      const records = localStore.records();
      const existingEntry = Object.values(records).find((record) => {
        const sameId = userId && normalizeUserId(record.discordUserId) === userId;
        const sameUsername = username && normalizeUsernameLower(record.username) === normalizeUsernameLower(username);
        return sameId || sameUsername;
      });

      if (existingEntry) {
        return existingEntry;
      }

      const storageId = userId || `record-${Date.now()}`;
      records[storageId] = createBaseRecord({
        discordUserId: userId || storageId,
        username: username || storageId,
        displayName: input.displayName || username || storageId
      });

      saveStore.records(records);
      this.log(`Created missing record for ${storageId}.`);
      return records[storageId];
    },

    getRecordByUserId(userId) {
      const id = normalizeUserId(userId);
      if (!id) return null;

      const records = localStore.records();
      return Object.values(records).find((record) => normalizeUserId(record.discordUserId) === id) || null;
    },

    getRecordByUsername(username) {
      const target = normalizeUsernameLower(username);
      if (!target) return null;

      const records = localStore.records();
      return Object.values(records).find((record) => normalizeUsernameLower(record.username) === target) || null;
    },

    searchRecords(query) {
      const target = normalizeUsernameLower(query);
      if (!target) return [];

      return Object.values(localStore.records()).filter((record) => {
        return (
          normalizeUserId(record.discordUserId).includes(target) ||
          normalizeUsernameLower(record.username).includes(target) ||
          normalizeUsernameLower(record.displayName).includes(target)
        );
      });
    },

    getAllRecords() {
      return Object.values(localStore.records()).sort((left, right) => {
        return new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime();
      });
    },

    addNote(userId, noteContent, actor = 'Staff Dashboard') {
      const record = this.ensureRecord({ userId, username: userId });
      const records = localStore.records();
      const storageId = normalizeUserId(record.discordUserId);
      const timestamp = nowIso();

      const note = {
        content: String(noteContent || '').trim(),
        author: actor,
        createdAt: timestamp
      };

      if (!note.content) {
        throw new Error('Note content is required.');
      }

      const targetRecord = records[storageId] || record;
      targetRecord.notes = Array.isArray(targetRecord.notes) ? targetRecord.notes : [];
      targetRecord.history = Array.isArray(targetRecord.history) ? targetRecord.history : [];

      targetRecord.notes.unshift(note);
      targetRecord.notesCount = targetRecord.notes.length;
      targetRecord.history.unshift({
        action: 'NOTE_ADDED',
        details: note.content,
        actor,
        createdAt: timestamp
      });
      targetRecord.updatedAt = timestamp;

      records[storageId] = targetRecord;
      saveStore.records(records);
      this.log(`Added note to record ${storageId}.`);
      return targetRecord;
    },

    updateRecord(userId, updates = {}) {
      const record = this.ensureRecord({ userId, username: updates.username || userId });
      const records = localStore.records();
      const storageId = normalizeUserId(record.discordUserId);
      const timestamp = nowIso();

      const merged = {
        ...record,
        ...updates,
        usernameLower: normalizeUsernameLower(updates.username || record.username),
        updatedAt: timestamp
      };

      merged.history = Array.isArray(record.history) ? [...record.history] : [];
      merged.history.unshift({
        action: 'RECORD_UPDATED',
        details: 'Record details were updated through the staff dashboard.',
        createdAt: timestamp
      });

      records[storageId] = merged;
      saveStore.records(records);
      this.log(`Updated record ${storageId}.`);
      return merged;
    },

    getApplications() {
      return localStore.applications();
    },

    seedDemoData() {
      this.ensureSettings();
      this.ensureStaff('EXECUTIVE_EAGLE', 'Executive_Eagle');
      this.ensureRecord({ userId: '1486480583604441128', username: 'Executive_Eagle', displayName: 'Executive Eagle' });
      this.ensureRecord({ userId: '112233445566778899', username: 'CognitusApplicant', displayName: 'Cognitus Applicant' });
      this.addNote('1486480583604441128', 'Initial administrative note created during dashboard setup.', 'System');
      this.log('Seeded demo data for Cognitus dashboard.');
    }
  };

  DataLayer.ensureSettings();
  window.CognitusData = DataLayer;
})();
