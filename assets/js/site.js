(() => {
  const departmentContent = {
    administration: {
      pill: 'Administration Application',
      heading: 'Apply for Administration',
      intro:
        'Administration applicants should demonstrate professionalism, organization, confidentiality, and the ability to support structured internal operations.',
      title: 'Administration Focus',
      description:
        'Administration supports documentation, records, organization, oversight, and dependable back-office work that keeps the wider operation structured and reliable.',
      questions: [
        {
          id: 'adminOrganization',
          label: 'How would you keep important records or internal documents organized?',
          placeholder: 'Explain the methods, habits, or systems you would use to stay organized.',
        },
        {
          id: 'adminConfidentiality',
          label: 'Why is confidentiality important in administrative work?',
          placeholder: 'Describe how you would handle private information professionally and responsibly.',
        },
      ],
    },
    'customer-support': {
      pill: 'Customer Support Application',
      heading: 'Apply for Customer Support',
      intro:
        'Customer Support applicants should show professionalism, patience, issue-handling ability, and strong service-focused communication.',
      title: 'Customer Support Focus',
      description:
        'Customer Support is centered on helping users, resolving concerns, maintaining calm professionalism, and representing the company through reliable service.',
      questions: [
        {
          id: 'supportDifficultUsers',
          label: 'How would you respond to a frustrated or difficult user while staying professional?',
          placeholder: 'Describe how you would calm the situation and still address the issue effectively.',
        },
        {
          id: 'supportResolution',
          label: 'What does good issue resolution look like to you?',
          placeholder: 'Explain how you would define a successful support interaction from start to finish.',
        },
      ],
    },
    'public-relations': {
      pill: 'Public Relations Application',
      heading: 'Apply for Public Relations',
      intro:
        'Public Relations applicants should communicate clearly, represent the platform well, and understand how to handle public-facing interactions professionally.',
      title: 'Public Relations Focus',
      description:
        'Public Relations handles announcements, representation, communication, outreach, and other external-facing responsibilities connected to public image and professionalism.',
      questions: [
        {
          id: 'prRepresentation',
          label: 'How would you professionally represent Cognitus Solutions in a public setting?',
          placeholder: 'Describe your approach to public communication, tone, and image management.',
        },
        {
          id: 'prAnnouncements',
          label: 'What makes a strong announcement or public message effective?',
          placeholder: 'Explain how you would write or deliver a polished and professional public update.',
        },
      ],
    },
  };

  const normalizeDepartment = (value) => {
    const raw = String(value || '').trim().toLowerCase();

    if (raw === 'customer support' || raw === 'customer_support' || raw === 'customersupport') {
      return 'customer-support';
    }

    if (raw === 'public relations' || raw === 'public_relations' || raw === 'publicrelations') {
      return 'public-relations';
    }

    return departmentContent[raw] ? raw : 'administration';
  };

  const createQuestionField = (question) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-field full-width';

    const label = document.createElement('label');
    label.setAttribute('for', question.id);
    label.textContent = question.label;

    const textarea = document.createElement('textarea');
    textarea.id = question.id;
    textarea.name = question.id;
    textarea.placeholder = question.placeholder;
    textarea.required = true;

    wrapper.append(label, textarea);
    return wrapper;
  };

  const setupApplyPage = () => {
    const form = document.getElementById('applicationForm');
    if (!form) return;

    const departmentSelect = document.getElementById('department');
    const questionContainer = document.getElementById('departmentQuestions');
    const heading = document.getElementById('applicationHeading');
    const intro = document.getElementById('applicationIntro');
    const pill = document.getElementById('departmentPill');
    const departmentTitle = document.getElementById('departmentTitle');
    const departmentDescription = document.getElementById('departmentDescription');
    const statusBanner = document.getElementById('applicationStatusBanner');

    const urlDepartment = new URLSearchParams(window.location.search).get('department');
    departmentSelect.value = normalizeDepartment(urlDepartment || departmentSelect.value);

    const applyDepartmentState = () => {
      const key = normalizeDepartment(departmentSelect.value);
      const content = departmentContent[key];

      pill.textContent = content.pill;
      heading.textContent = content.heading;
      intro.textContent = content.intro;
      departmentTitle.textContent = content.title;
      departmentDescription.textContent = content.description;

      questionContainer.innerHTML = '';
      content.questions.forEach((question) => {
        questionContainer.appendChild(createQuestionField(question));
      });

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('department', key);
      window.history.replaceState({}, '', nextUrl);
    };

    applyDepartmentState();
    departmentSelect.addEventListener('change', applyDepartmentState);

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload.department = normalizeDepartment(payload.department);
      payload.status = 'submitted';
      payload.notificationPosted = false;
      payload.submittedAt = new Date().toISOString();

      const savedApplications = JSON.parse(localStorage.getItem('cognitus-applications') || '[]');
      savedApplications.push(payload);
      localStorage.setItem('cognitus-applications', JSON.stringify(savedApplications));

      statusBanner.style.display = 'block';
      statusBanner.innerHTML = `
        <strong>Application captured.</strong><br />
        Your application has been prepared in a structured format and saved locally in this browser for now. In the Firestore-connected build, this same payload will be written directly into the database with automatic defaults such as <code>status</code>, <code>submittedAt</code>, and <code>notificationPosted</code>.
      `;

      form.reset();
      departmentSelect.value = payload.department;
      applyDepartmentState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const setupPortalLogin = () => {
    const form = document.getElementById('portalLoginForm');
    const statusBox = document.getElementById('portalStatusBox');
    if (!form || !statusBox) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const verifiedUserId = String(formData.get('verifiedUserId') || '').trim();
      const portalPasscode = String(formData.get('portalPasscode') || '').trim();

      if (!verifiedUserId || !portalPasscode) {
        statusBox.className = 'status-box error visible';
        statusBox.innerHTML = `
          <h3>Incomplete sign-in</h3>
          <p>Please enter both your verified User ID and your portal passcode.</p>
        `;
        return;
      }

      const session = {
        verifiedUserId,
        signedInAt: new Date().toISOString(),
        portalRole: 'public',
      };

      localStorage.setItem('cognitus-portal-session', JSON.stringify(session));

      statusBox.className = 'status-box success visible';
      statusBox.innerHTML = `
        <h3>Portal sign-in prepared</h3>
        <p>Your local portal session has been created in this browser. In the Firestore-backed build, this same action will validate the verified user, create any missing session documents, and redirect the user into the protected portal experience.</p>
      `;
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    setupApplyPage();
    setupPortalLogin();
  });
})();
