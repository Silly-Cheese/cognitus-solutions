(() => {
  const Data = window.CognitusData;

  if (!Data) {
    console.error('CognitusData is not available. Make sure firestore-helpers.js is loaded first.');
    return;
  }

  const normalize = (value) => String(value || '').trim();

  const buildRecordCard = (record) => {
    const notesCount = Array.isArray(record.notes) ? record.notes.length : record.notesCount || 0;

    return `
      <article class="result-card">
        <h3>${record.displayName || record.username || 'Unnamed Record'}</h3>
        <p>This record is available in the Cognitus data layer and can be opened for detailed review.</p>
        <div class="result-meta">
          <div class="result-meta-item">
            <span class="mini-label">Discord User ID</span>
            <strong>${record.discordUserId || 'Not set'}</strong>
          </div>
          <div class="result-meta-item">
            <span class="mini-label">Username</span>
            <strong>${record.username || 'Not set'}</strong>
          </div>
          <div class="result-meta-item">
            <span class="mini-label">Status</span>
            <strong>${record.status || 'Active'}</strong>
          </div>
          <div class="result-meta-item">
            <span class="mini-label">Notes</span>
            <strong>${notesCount}</strong>
          </div>
        </div>
        <div class="result-actions">
          <a class="button button-primary" href="record-view.html?userId=${encodeURIComponent(record.discordUserId || '')}">Open Record</a>
        </div>
      </article>
    `;
  };

  const renderRecordsWorkspace = () => {
    const searchForm = document.getElementById('recordSearchForm');
    const createForm = document.getElementById('recordCreateForm');
    const resultsContainer = document.getElementById('recordResultsContainer');
    const stateCard = document.getElementById('recordsStateCard');

    if (!searchForm || !createForm || !resultsContainer || !stateCard) return;

    const renderResults = (records, message = '') => {
      if (!records.length) {
        resultsContainer.innerHTML = `
          <article class="result-card">
            <h3>No matching records found</h3>
            <p>${message || 'Try a different search query or create a new record using the creation form.'}</p>
          </article>
        `;
        return;
      }

      resultsContainer.innerHTML = records.map((record) => buildRecordCard(record)).join('');
    };

    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(searchForm);
      const query = normalize(formData.get('recordSearchQuery'));

      if (!query) {
        renderResults([], 'Enter a user ID, username, or display name to search the record system.');
        return;
      }

      const exactById = Data.getRecordByUserId(query);
      const exactByUsername = Data.getRecordByUsername(query);
      const searchResults = Data.searchRecords(query);
      const uniqueRecords = [];
      const seen = new Set();

      [exactById, exactByUsername, ...searchResults].filter(Boolean).forEach((record) => {
        const key = record.discordUserId || record.username;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRecords.push(record);
        }
      });

      stateCard.className = 'state-card success visible';
      stateCard.innerHTML = `
        <h3>Search complete</h3>
        <p>The records workspace searched the shared Cognitus data layer and loaded the best available matching records.</p>
      `;

      renderResults(uniqueRecords);
    });

    createForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(createForm);
      const userId = normalize(formData.get('createRecordUserId'));
      const username = normalize(formData.get('createRecordUsername'));
      const displayName = normalize(formData.get('createRecordDisplayName')) || username;

      const record = Data.ensureRecord({
        userId,
        username,
        displayName
      });

      stateCard.className = 'state-card success visible';
      stateCard.innerHTML = `
        <h3>Record ready</h3>
        <p>The requested record has been created or confirmed in the self-healing data layer and is now available for full review.</p>
      `;

      createForm.reset();
      renderResults([record]);
    });

    const recentRecords = Data.getAllRecords();
    if (recentRecords.length) {
      renderResults(recentRecords.slice(0, 6));
    }
  };

  const renderRecordView = () => {
    const params = new URLSearchParams(window.location.search);
    const queryUserId = normalize(params.get('userId'));
    const queryUsername = normalize(params.get('username'));

    const recordTitle = document.getElementById('recordViewTitle');
    const recordDescription = document.getElementById('recordViewDescription');
    const identityPill = document.getElementById('recordIdentityPill');
    const stateCard = document.getElementById('recordViewStateCard');
    const noteForm = document.getElementById('recordNoteForm');
    const notesContainer = document.getElementById('recordNotesContainer');
    const historyContainer = document.getElementById('recordHistoryContainer');

    if (!recordTitle || !recordDescription || !stateCard || !noteForm || !notesContainer || !historyContainer) {
      return;
    }

    const userIdField = document.getElementById('recordDetailUserId');
    const usernameField = document.getElementById('recordDetailUsername');
    const displayNameField = document.getElementById('recordDetailDisplayName');
    const statusField = document.getElementById('recordDetailStatus');
    const riskField = document.getElementById('recordDetailRisk');
    const notesCountField = document.getElementById('recordDetailNotesCount');

    let currentRecord = null;

    const renderNotes = (record) => {
      const notes = Array.isArray(record.notes) ? record.notes : [];

      if (!notes.length) {
        notesContainer.innerHTML = `
          <article class="note-card">
            <h3>No notes yet</h3>
            <p>This record does not currently contain any notes.</p>
          </article>
        `;
        return;
      }

      notesContainer.innerHTML = notes.slice(0, 8).map((note) => {
        const createdAt = note.createdAt ? new Date(note.createdAt) : null;
        const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
          ? createdAt.toLocaleString()
          : 'Unknown date';

        return `
          <article class="note-card">
            <span class="note-meta">${note.author || 'Staff'} • ${createdLabel}</span>
            <h3>Staff Note</h3>
            <p>${note.content || 'No note content available.'}</p>
          </article>
        `;
      }).join('');
    };

    const renderHistory = (record) => {
      const history = Array.isArray(record.history) ? record.history : [];

      if (!history.length) {
        historyContainer.innerHTML = `
          <article class="history-card">
            <h3>No history yet</h3>
            <p>This record does not currently contain any history entries.</p>
          </article>
        `;
        return;
      }

      historyContainer.innerHTML = history.slice(0, 10).map((entry) => {
        const createdAt = entry.createdAt ? new Date(entry.createdAt) : null;
        const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
          ? createdAt.toLocaleString()
          : 'Unknown date';

        return `
          <article class="history-card">
            <span class="history-meta">${entry.action || 'ACTION'} • ${createdLabel}</span>
            <h3>${entry.action || 'Record Event'}</h3>
            <p>${entry.details || 'No details available for this history entry.'}</p>
          </article>
        `;
      }).join('');
    };

    const renderRecord = (record) => {
      currentRecord = record;
      identityPill.textContent = record.username || 'Record';
      recordTitle.textContent = record.displayName || record.username || 'Record Loaded';
      recordDescription.textContent = 'This record has been loaded from the Cognitus data layer and is ready for notes, review, and future record updates.';

      userIdField.textContent = record.discordUserId || 'Not set';
      usernameField.textContent = record.username || 'Not set';
      displayNameField.textContent = record.displayName || record.username || 'Not set';
      statusField.textContent = record.status || 'Active';
      riskField.textContent = record.riskLevel || 'Low';
      notesCountField.textContent = String(Array.isArray(record.notes) ? record.notes.length : record.notesCount || 0);

      stateCard.className = 'state-card success visible';
      stateCard.innerHTML = `
        <h3>Record loaded</h3>
        <p>The detailed record page is now displaying a full record object from the shared data layer. If the record had been missing, the system would have created it automatically.</p>
      `;

      renderNotes(record);
      renderHistory(record);
    };

    let record = null;

    if (queryUserId) {
      record = Data.getRecordByUserId(queryUserId) || Data.ensureRecord({ userId: queryUserId, username: queryUserId });
    } else if (queryUsername) {
      record = Data.getRecordByUsername(queryUsername) || Data.ensureRecord({ username: queryUsername, userId: queryUsername });
    }

    if (!record) {
      stateCard.className = 'state-card info visible';
      stateCard.innerHTML = `
        <h3>No record target supplied</h3>
        <p>Open this page using a user ID or username parameter from the records workspace so the correct record can be loaded.</p>
      `;
    } else {
      renderRecord(record);
    }

    noteForm.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!currentRecord) return;

      const noteField = document.getElementById('recordNoteContent');
      const noteValue = normalize(noteField.value);

      if (!noteValue) return;

      const updatedRecord = Data.addNote(currentRecord.discordUserId, noteValue, 'Staff Dashboard');
      noteField.value = '';
      renderRecord(updatedRecord);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderRecordsWorkspace();
    renderRecordView();
  });
})();
