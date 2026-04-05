(() => {
  const Data = window.CognitusData;

  if (!Data) {
    console.error('CognitusData is not available. Make sure firestore-helpers.js is loaded first.');
    return;
  }

  const normalize = (value) => String(value || '').trim();
  const normalizeLower = (value) => normalize(value).toLowerCase();

  const statusClass = (status) => {
    const normalized = normalizeLower(status).replace(/\s+/g, '_');
    if (normalized === 'approved') return 'approved';
    if (normalized === 'denied') return 'denied';
    return normalized || 'submitted';
  };

  const prettyStatus = (status) => {
    const normalized = statusClass(status);
    const map = {
      submitted: 'Submitted',
      pending: 'Pending',
      under_review: 'Under Review',
      approved: 'Approved',
      denied: 'Denied'
    };
    return map[normalized] || 'Submitted';
  };

  const prettyDepartment = (department) => {
    const normalized = normalizeLower(department).replace(/\s+/g, '-');
    const map = {
      administration: 'Administration',
      'customer-support': 'Customer Support',
      'public-relations': 'Public Relations'
    };
    return map[normalized] || (department || 'Unknown Department');
  };

  const getStoredApplications = () => {
    const applications = Data.getApplications();
    return Array.isArray(applications) ? [...applications] : [];
  };

  const writeStoredApplications = (applications) => {
    localStorage.setItem('cognitus-applications', JSON.stringify(applications));
  };

  const ensureApplicationIds = (applications) => {
    let updated = false;

    const nextApplications = applications.map((application, index) => {
      if (application.applicationId) return application;
      updated = true;
      return {
        ...application,
        applicationId: `APP-${String(index + 1).padStart(4, '0')}`
      };
    });

    if (updated) {
      writeStoredApplications(nextApplications);
    }

    return nextApplications;
  };

  const findApplicationById = (applicationId) => {
    const applications = ensureApplicationIds(getStoredApplications());
    return applications.find((application) => application.applicationId === applicationId) || null;
  };

  const buildApplicationCard = (application) => {
    const department = prettyDepartment(application.department);
    const status = prettyStatus(application.status);
    const statusChipClass = statusClass(application.status);

    return `
      <article class="application-card">
        <div class="application-topline">
          <span class="department-chip">${department}</span>
          <span class="status-chip ${statusChipClass}">${status}</span>
        </div>
        <h3>${application.fullNameOrUsername || application.username || 'Unnamed Applicant'}</h3>
        <p>${application.motivation || 'No motivation was provided for this application.'}</p>
        <div class="application-meta">
          <div class="application-meta-item">
            <span class="mini-label">Application ID</span>
            <strong>${application.applicationId || 'Not assigned'}</strong>
          </div>
          <div class="application-meta-item">
            <span class="mini-label">Discord Username</span>
            <strong>${application.discordUsername || 'Not provided'}</strong>
          </div>
          <div class="application-meta-item">
            <span class="mini-label">Timezone</span>
            <strong>${application.timezone || 'Not provided'}</strong>
          </div>
          <div class="application-meta-item">
            <span class="mini-label">Submitted</span>
            <strong>${application.submittedAt ? new Date(application.submittedAt).toLocaleString() : 'Not available'}</strong>
          </div>
        </div>
        <div class="application-actions">
          <a class="button button-primary" href="application-view.html?id=${encodeURIComponent(application.applicationId || '')}">Open Application</a>
        </div>
      </article>
    `;
  };

  const filterApplications = ({ query, department, status }) => {
    const applications = ensureApplicationIds(getStoredApplications());
    const normalizedQuery = normalizeLower(query);
    const normalizedDepartment = normalizeLower(department);
    const normalizedStatus = statusClass(status);

    return applications.filter((application) => {
      const matchesQuery = !normalizedQuery || [
        application.fullNameOrUsername,
        application.username,
        application.discordUsername,
        application.applicationId,
        application.department
      ].some((value) => normalizeLower(value).includes(normalizedQuery));

      const matchesDepartment = normalizedDepartment === 'all' || normalizeLower(application.department) === normalizedDepartment;
      const matchesStatus = normalizedStatus === 'all' || statusClass(application.status) === normalizedStatus;

      return matchesQuery && matchesDepartment && matchesStatus;
    }).reverse();
  };

  const renderApplicationsWorkspace = () => {
    const form = document.getElementById('applicationFilterForm');
    const resultsContainer = document.getElementById('applicationResultsContainer');
    const stateCard = document.getElementById('applicationsStateCard');

    if (!form || !resultsContainer || !stateCard) return;

    const renderResults = (applications, emptyMessage = '') => {
      if (!applications.length) {
        resultsContainer.innerHTML = `
          <article class="application-card">
            <h3>No matching applications</h3>
            <p>${emptyMessage || 'No applications matched the selected filters.'}</p>
          </article>
        `;
        return;
      }

      resultsContainer.innerHTML = applications.map((application) => buildApplicationCard(application)).join('');
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      const applications = filterApplications({
        query: formData.get('applicationSearchQuery'),
        department: formData.get('applicationDepartmentFilter'),
        status: formData.get('applicationStatusFilter')
      });

      stateCard.className = 'state-card success visible';
      stateCard.innerHTML = `
        <h3>Filters applied</h3>
        <p>The applications workspace filtered the current Cognitus application store and loaded the best matching internal review list.</p>
      `;

      renderResults(applications, 'Try widening the department or status filter, or clearing the search query.');
    });

    renderResults(ensureApplicationIds(getStoredApplications()).reverse(), 'Applications submitted through the public form will appear here once they exist in the shared store.');
  };

  const renderDepartmentAnswers = (answers) => {
    if (!answers || typeof answers !== 'object' || !Object.keys(answers).length) {
      return '<p>No department-specific answers were found for this application.</p>';
    }

    return Object.entries(answers).map(([key, value]) => {
      const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
      return `
        <div class="answer-card" style="padding:0.9rem 1rem; margin-top:0.8rem;">
          <h3 style="margin-bottom:0.35rem;">${title}</h3>
          <p>${value || 'No response provided.'}</p>
        </div>
      `;
    }).join('');
  };

  const renderApplicationView = () => {
    const params = new URLSearchParams(window.location.search);
    const applicationId = normalize(params.get('id'));

    const title = document.getElementById('applicationViewTitle');
    const description = document.getElementById('applicationViewDescription');
    const statusChip = document.getElementById('applicationViewStatusChip');
    const stateCard = document.getElementById('applicationViewStateCard');
    const reviewForm = document.getElementById('applicationReviewForm');
    const latestReviewText = document.getElementById('applicationLatestReviewText');

    if (!title || !description || !statusChip || !stateCard || !reviewForm || !latestReviewText) return;

    const detailDepartment = document.getElementById('applicationDetailDepartment');
    const detailDiscord = document.getElementById('applicationDetailDiscord');
    const detailTimezone = document.getElementById('applicationDetailTimezone');
    const detailEmail = document.getElementById('applicationDetailEmail');
    const detailExperience = document.getElementById('applicationDetailExperience');
    const detailSkills = document.getElementById('applicationDetailSkills');
    const detailMotivation = document.getElementById('applicationDetailMotivation');
    const detailAvailability = document.getElementById('applicationDetailAvailability');
    const detailScenario = document.getElementById('applicationDetailScenario');
    const detailAnswers = document.getElementById('applicationDetailAnswers');
    const decisionField = document.getElementById('applicationDecision');
    const notesField = document.getElementById('applicationReviewNotes');

    if (!applicationId) {
      stateCard.className = 'state-card info visible';
      stateCard.innerHTML = `
        <h3>No application selected</h3>
        <p>Open this page through the applications workspace so a specific application can be loaded for review.</p>
      `;
      return;
    }

    const applications = ensureApplicationIds(getStoredApplications());
    const application = applications.find((entry) => entry.applicationId === applicationId);

    if (!application) {
      stateCard.className = 'state-card info visible';
      stateCard.innerHTML = `
        <h3>Application not found</h3>
        <p>No application with that identifier exists in the current Cognitus application store.</p>
      `;
      return;
    }

    const applyToPage = (current) => {
      const normalizedStatus = statusClass(current.status);
      title.textContent = current.fullNameOrUsername || current.username || 'Application Loaded';
      description.textContent = 'This application has been loaded from the Cognitus data layer and is ready for structured internal review.';
      statusChip.textContent = prettyStatus(current.status);
      statusChip.className = `status-chip ${normalizedStatus}`;

      detailDepartment.textContent = prettyDepartment(current.department);
      detailDiscord.textContent = current.discordUsername || 'Not provided';
      detailTimezone.textContent = current.timezone || 'Not provided';
      detailEmail.textContent = current.email || 'Not provided';
      detailExperience.textContent = current.experience || 'No experience response provided.';
      detailSkills.textContent = current.skills || 'No skills response provided.';
      detailMotivation.textContent = current.motivation || 'No motivation response provided.';
      detailAvailability.textContent = current.availability || 'No availability response provided.';
      detailScenario.textContent = current.scenarioResponse || current.scenario || 'No scenario response provided.';
      detailAnswers.innerHTML = renderDepartmentAnswers(current.answers);

      latestReviewText.textContent = current.reviewNotes
        ? `${prettyStatus(current.status)} — ${current.reviewNotes}`
        : 'No internal review has been saved for this application yet.';

      decisionField.value = normalizedStatus === 'submitted' || normalizedStatus === 'pending' ? 'under_review' : normalizedStatus;
      notesField.value = current.reviewNotes || '';

      stateCard.className = 'state-card success visible';
      stateCard.innerHTML = `
        <h3>Application loaded</h3>
        <p>The detailed application view is displaying a complete application object from the Cognitus data layer and is ready to save internal review decisions.</p>
      `;
    };

    applyToPage(application);

    reviewForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const updatedApplications = ensureApplicationIds(getStoredApplications());
      const targetIndex = updatedApplications.findIndex((entry) => entry.applicationId === applicationId);
      if (targetIndex === -1) return;

      const selectedDecision = decisionField.value;
      const reviewNotes = normalize(notesField.value);
      const reviewedAt = new Date().toISOString();

      updatedApplications[targetIndex] = {
        ...updatedApplications[targetIndex],
        status: selectedDecision,
        decision: selectedDecision,
        reviewNotes,
        reviewedAt,
        reviewedBy: 'Staff Dashboard'
      };

      writeStoredApplications(updatedApplications);
      applyToPage(updatedApplications[targetIndex]);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderApplicationsWorkspace();
    renderApplicationView();
  });
})();
