(() => {
  const APPLICATION_STORAGE_KEY = 'cognitus-applications';
  const SESSION_STORAGE_KEY = 'cognitus-portal-session';
  const PORTAL_RECORDS_KEY = 'cognitus-portal-records';

  const normalizeStatus = (value) => {
    const raw = String(value || 'submitted').trim().toLowerCase().replace(/\s+/g, '_');

    if (raw === 'pending') return 'pending';
    if (raw === 'under review') return 'under_review';
    if (raw === 'under_review') return 'under_review';
    if (raw === 'approved') return 'approved';
    if (raw === 'denied') return 'denied';
    return 'submitted';
  };

  const prettyStatus = (value) => {
    const normalized = normalizeStatus(value);
    const labels = {
      submitted: 'Submitted',
      pending: 'Pending',
      under_review: 'Under Review',
      approved: 'Approved',
      denied: 'Denied',
    };

    return labels[normalized] || 'Submitted';
  };

  const readJson = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const readApplications = () => readJson(APPLICATION_STORAGE_KEY, []);
  const writeApplications = (applications) => writeJson(APPLICATION_STORAGE_KEY, applications);
  const readSession = () => readJson(SESSION_STORAGE_KEY, null);
  const writeSession = (session) => writeJson(SESSION_STORAGE_KEY, session);
  const readPortalRecords = () => readJson(PORTAL_RECORDS_KEY, {});
  const writePortalRecords = (records) => writeJson(PORTAL_RECORDS_KEY, records);

  const ensurePortalRecord = (verifiedUserId) => {
    const records = readPortalRecords();

    if (!records[verifiedUserId]) {
      records[verifiedUserId] = {
        verifiedUserId,
        visibleStatus: 'Portal Ready',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      writePortalRecords(records);
    }

    return records[verifiedUserId];
  };

  const findLatestApplicationByDiscordUsername = (discordUsername) => {
    const normalizedTarget = String(discordUsername || '').trim().toLowerCase();
    const applications = readApplications();

    const matches = applications.filter((application) => {
      const candidate = String(application.discordUsername || '').trim().toLowerCase();
      return candidate === normalizedTarget;
    });

    if (!matches.length) return null;

    matches.sort((a, b) => {
      const left = new Date(a.submittedAt || 0).getTime();
      const right = new Date(b.submittedAt || 0).getTime();
      return right - left;
    });

    return matches[0];
  };

  const buildStatusMarkup = (application) => {
    const status = normalizeStatus(application.status);
    const submittedAt = application.submittedAt ? new Date(application.submittedAt) : null;
    const submittedLabel = submittedAt && !Number.isNaN(submittedAt.getTime())
      ? submittedAt.toLocaleString()
      : 'Not available';

    return `
      <div class="status-badge status-${status}">${prettyStatus(status)}</div>
      <h3>${application.fullNameOrUsername || application.username || 'Applicant Record'}</h3>
      <p>The latest matching application has been located and rendered through the public status system.</p>
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Department</span>
          <strong>${application.department || 'Not provided'}</strong>
        </div>
        <div class="meta-item">
          <span class="meta-label">Discord Username</span>
          <strong>${application.discordUsername || 'Not provided'}</strong>
        </div>
        <div class="meta-item">
          <span class="meta-label">Submitted</span>
          <strong>${submittedLabel}</strong>
        </div>
        <div class="meta-item">
          <span class="meta-label">Stored Status</span>
          <strong>${prettyStatus(status)}</strong>
        </div>
      </div>
    `;
  };

  const setupApplicationStatusPage = () => {
    const form = document.getElementById('applicationStatusForm');
    const resultCard = document.getElementById('applicationStatusResult');
    const summaryCard = document.getElementById('statusSummaryCard');
    if (!form || !resultCard || !summaryCard) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const discordUsername = String(formData.get('statusDiscordUsername') || '').trim();
      const application = findLatestApplicationByDiscordUsername(discordUsername);

      if (!application) {
        resultCard.className = 'result-card visible';
        resultCard.innerHTML = `
          <h3>No application found</h3>
          <p>No locally stored application matched that Discord username. In the Firestore-backed build, this page will search the live applications collection instead of browser storage.</p>
        `;
        return;
      }

      summaryCard.innerHTML = `
        <h3>Application located</h3>
        <p>The most recent matching application has been loaded below.</p>
      `;

      resultCard.className = 'result-card visible';
      resultCard.innerHTML = buildStatusMarkup(application);
    });
  };

  const setupPortalHomePage = () => {
    const profileTitle = document.getElementById('portalWelcomeTitle');
    const profileText = document.getElementById('portalWelcomeText');
    const stateCard = document.getElementById('portalStateCard');
    const clearButton = document.getElementById('clearPortalSessionButton');
    const userIdField = document.getElementById('portalRecordUserId');
    const roleField = document.getElementById('portalRecordRole');
    const signedInField = document.getElementById('portalRecordSignedIn');
    const statusField = document.getElementById('portalRecordStatus');

    if (!profileTitle || !profileText || !stateCard || !clearButton) return;

    const applyState = () => {
      const session = readSession();

      if (!session || !session.verifiedUserId) {
        profileTitle.textContent = 'No active session detected';
        profileText.textContent = 'Sign in through the public portal login page to create a session and load your user-specific dashboard state.';
        userIdField.textContent = 'Not available';
        roleField.textContent = 'Public';
        signedInField.textContent = 'Not available';
        statusField.textContent = 'Pending connection';
        stateCard.className = 'state-card info visible';
        stateCard.innerHTML = `
          <h3>Portal state ready</h3>
          <p>There is currently no saved local session. Once the Firestore-backed session system is connected, this page will validate the active user and create missing portal-access records automatically.</p>
        `;
        return;
      }

      const portalRecord = ensurePortalRecord(session.verifiedUserId);
      const signedInAt = session.signedInAt ? new Date(session.signedInAt) : null;

      profileTitle.textContent = `Welcome, ${session.verifiedUserId}`;
      profileText.textContent = 'Your local public portal session is active and the visible user record shape has been prepared automatically.';
      userIdField.textContent = session.verifiedUserId;
      roleField.textContent = session.portalRole || 'public';
      signedInField.textContent = signedInAt && !Number.isNaN(signedInAt.getTime())
        ? signedInAt.toLocaleString()
        : 'Not available';
      statusField.textContent = portalRecord.visibleStatus || 'Portal Ready';

      stateCard.className = 'state-card success visible';
      stateCard.innerHTML = `
        <h3>Session loaded</h3>
        <p>The portal session is active and any missing portal-facing record object has been created automatically. This mirrors the self-healing logic that will later be used against Firestore collections and documents.</p>
      `;
    };

    clearButton.addEventListener('click', () => {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      applyState();
    });

    applyState();
  };

  document.addEventListener('DOMContentLoaded', () => {
    setupApplicationStatusPage();
    setupPortalHomePage();
  });
})();
