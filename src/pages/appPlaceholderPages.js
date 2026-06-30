import { getAccountStore } from "../state/accountStore.js";

const placeholderMap = {
  search: {
    eyebrow: "Checks",
    title: "Run a Check",
    message: "The full person and organization search system will be built in Part 7. Every check will require a reason before running."
  },
  claims: {
    eyebrow: "Profiles",
    title: "Claim Profile",
    message: "Profile claim workflows will be completed in Part 9 using Discord ID verification."
  },
  submitReport: {
    eyebrow: "Reports",
    title: "Submit Report",
    message: "Report submission and review workflows will be completed in Part 9."
  },
  appeals: {
    eyebrow: "Appeals",
    title: "Appeals & Corrections",
    message: "Appeals and correction requests will be completed in Part 9."
  },
  history: {
    eyebrow: "Activity",
    title: "Check History",
    message: "Full check history will be connected after the search/check system is built in Part 7."
  },
  candidates: {
    eyebrow: "Hiring",
    title: "Saved Candidates",
    message: "Saved candidate management will expand with the candidate tracker features."
  },
  savedOrganizations: {
    eyebrow: "Organizations",
    title: "Saved Organizations",
    message: "Saved organization tools will expand with organization search and review features."
  },
  notifications: {
    eyebrow: "Updates",
    title: "Notifications",
    message: "Notification management will expand as review workflows are connected."
  }
};

export function renderAppPlaceholder(root, key) {
  const account = getAccountStore();
  const page = placeholderMap[key] || placeholderMap.search;

  if (!account.record) {
    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Login Required</p>
        <h1>You need an account to access this page.</h1>
        <div class="hero-actions"><a class="button button-dark" href="#/login">Login</a></div>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">${page.eyebrow}</p>
      <h1>${page.title}</h1>
      <p>${page.message}</p>
      <div class="hero-actions">
        <a class="button button-dark" href="#/dashboard">Back to Dashboard</a>
      </div>
    </section>
  `;
}
