import { APP_NAME } from "../data/constants.js";

export function renderHomePage(root) {
  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">${APP_NAME}</p>
      <h1>The employment intelligence portal for Roblox and Discord organizations.</h1>
      <p>
        Cognitus helps employers, hiring teams, and community leaders run documented checks, review organizations,
        download professional reports, and make better decisions with permanent Cognitus IDs.
      </p>
      <div class="hero-actions">
        <a class="button button-dark" href="#/register">Create Account</a>
        <a class="button button-light" href="#/features">View Features</a>
      </div>
    </section>

    <section class="grid feature-grid">
      <article class="card">
        <p class="eyebrow">Required Reasons</p>
        <h2>Every check is logged.</h2>
        <p>Users must select a legitimate reason before running a person or organization check.</p>
      </article>
      <article class="card">
        <p class="eyebrow">Identity</p>
        <h2>Search people, not just usernames.</h2>
        <p>Cognitus profiles can connect Roblox usernames, Discord usernames, Discord IDs, and known aliases.</p>
      </article>
      <article class="card">
        <p class="eyebrow">Organizations</p>
        <h2>Review groups too.</h2>
        <p>Employers can search organizations for verification status, trust level, notes, and partnership concerns.</p>
      </article>
    </section>
  `;
}

export function renderAboutPage(root) {
  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">About Cognitus</p>
      <h1>Built to make hiring decisions more professional.</h1>
      <p>
        Cognitus Solutions is designed for Roblox and Discord-based organizations that need a centralized,
        accountable way to review candidates, organizations, reports, appeals, and identity history.
      </p>
    </section>

    <section class="content-panel">
      <h2>What Cognitus is</h2>
      <p>
        Cognitus is an employment intelligence platform. It is not a rumor board, drama archive, or anonymous blacklist.
        Its purpose is to help organizations document legitimate screening, hiring, promotion, safety, and partnership reviews.
      </p>

      <h2>What Cognitus tracks</h2>
      <p>
        The platform is built around people profiles, organization profiles, verified reports, appeals, profile claims,
        saved candidates, private organization notes, downloaded reports, notifications, and audit logs.
      </p>

      <h2>How Cognitus stays organized</h2>
      <p>
        Every major record receives a permanent Cognitus ID. This helps support, auditing, report downloads, and future
        review processes remain stable even if a Roblox username or Discord username changes.
      </p>
    </section>
  `;
}

export function renderFeaturesPage(root) {
  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Platform Features</p>
      <h1>Designed to feel like a real employer screening system.</h1>
      <p>
        Cognitus V1 is being built as a full portal from the beginning, with account access, monitored checks,
        organization tools, reports, claims, appeals, and administrative review workflows.
      </p>
    </section>

    <section class="grid feature-grid">
      ${featureCard("Account-Based Checks", "Visitors cannot run checks anonymously. A logged-in account is required.")}
      ${featureCard("Required Check Reasons", "Every person or organization check requires a selected reason and optional notes.")}
      ${featureCard("People Search", "Search by Roblox username, Discord username, or Discord ID.")}
      ${featureCard("Organization Search", "Search organizations by name and review verification and trust information.")}
      ${featureCard("Downloadable Reports", "Employers can download quick or full reports for candidate files.")}
      ${featureCard("Profile Claims", "Users can claim profiles using their Discord ID as the identity anchor.")}
      ${featureCard("Appeals & Corrections", "Records can be disputed, corrected, marked disputed, or reviewed.")}
      ${featureCard("Candidate Tracker", "Organizations can save candidates and track hiring statuses.")}
      ${featureCard("Private Notes", "Organization notes remain private to that organization.")}
      ${featureCard("Audit Logs", "Major actions are logged for accountability and owner oversight.")}
      ${featureCard("Password Reset Requests", "No real email collection is needed; resets use an admin-reviewed request flow.")}
      ${featureCard("Cognitus IDs", "Every major entity receives a permanent human-readable Cognitus ID.")}
    </section>
  `;
}

export function renderTermsPage(root) {
  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Terms of Use</p>
      <h1>Use Cognitus responsibly.</h1>
      <p>
        Cognitus is intended for legitimate employment, safety, partnership, promotion, appeal, and correction review purposes.
      </p>
    </section>

    <section class="content-panel legal-copy">
      <h2>1. Account Responsibility</h2>
      <p>Users are responsible for activity performed through their Cognitus account. Checks may be logged and reviewed.</p>

      <h2>2. Proper Use</h2>
      <p>Users may not use Cognitus for harassment, stalking, doxxing, retaliation, public shaming, or personal drama.</p>

      <h2>3. Check Reasons</h2>
      <p>Every background or organization check must include a legitimate reason. False or abusive reasons may result in restrictions.</p>

      <h2>4. Reports</h2>
      <p>Submitted reports should be truthful, relevant, and based on information the submitter believes is accurate.</p>

      <h2>5. Appeals and Corrections</h2>
      <p>Individuals may request correction, appeal disputed records, or claim profiles through available portal workflows.</p>

      <h2>6. No Guarantee</h2>
      <p>Cognitus records should be used as one factor in a decision. Employers remain responsible for their final hiring decisions.</p>
    </section>
  `;
}

export function renderPrivacyPage(root) {
  root.innerHTML = `
    <section class="hero hero-wide">
      <p class="eyebrow">Privacy Policy</p>
      <h1>Clear rules for what Cognitus stores.</h1>
      <p>
        Cognitus is designed to avoid collecting real email addresses while still keeping account, check, and report activity accountable.
      </p>
    </section>

    <section class="content-panel legal-copy">
      <h2>Information Cognitus may store</h2>
      <p>Discord ID, Discord username, Roblox username, account role, organization membership, search history, submitted reports, appeals, claims, downloads, private notes, and audit logs.</p>

      <h2>No real email collection</h2>
      <p>Cognitus uses a synthetic internal Firebase login based on Discord ID. Users are not asked for a real email address.</p>

      <h2>Search monitoring</h2>
      <p>Checks are logged with the user, search type, search query, reason, optional notes, and time of the check.</p>

      <h2>Organization-private data</h2>
      <p>Private notes and candidate tracking data are intended to be visible only to authorized members of that organization.</p>

      <h2>Administrative review</h2>
      <p>Owner, admin, and reviewer accounts may access records necessary to review reports, claims, appeals, password reset requests, and abuse concerns.</p>
    </section>
  `;
}

function featureCard(title, text) {
  return `
    <article class="card">
      <h2>${title}</h2>
      <p>${text}</p>
    </article>
  `;
}
