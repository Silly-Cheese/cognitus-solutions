const root = document.querySelector("#page-root");
const EFFECTIVE_DATE = "September 5, 2026";
const VERSION = "V34";

function mountStyles() {
  if (document.querySelector("#cognitus-legal-v34")) return;
  const link = document.createElement("link");
  link.id = "cognitus-legal-v34";
  link.rel = "stylesheet";
  link.href = "./src/legalPoliciesV34.css?v=20260905-v34";
  document.head.appendChild(link);
}

function currentPolicy() {
  const route = location.hash.replace(/^#/, "").split("?")[0] || "/";
  if (route === "/terms") return "terms";
  if (route === "/privacy") return "privacy";
  return null;
}

function policyHeader(kind, title, subtitle) {
  return `
    <header class="legal34-hero">
      <div>
        <p class="legal34-kicker">Cognitus Solutions · Legal</p>
        <h1>${title}</h1>
        <p class="legal34-lead">${subtitle}</p>
      </div>
      <aside class="legal34-meta" aria-label="Policy information">
        <span><strong>Effective</strong>${EFFECTIVE_DATE}</span>
        <span><strong>Last updated</strong>${EFFECTIVE_DATE}</span>
        <span><strong>Version</strong>${VERSION}</span>
      </aside>
    </header>
    <nav class="legal34-switcher" aria-label="Legal documents">
      <a href="#/terms" class="${kind === "terms" ? "is-active" : ""}">Terms of Service</a>
      <a href="#/privacy" class="${kind === "privacy" ? "is-active" : ""}">Privacy Policy</a>
    </nav>`;
}

const TERMS = `
  <div class="legal34-layout">
    <aside class="legal34-toc" aria-label="Terms of Service sections">
      <strong>On this page</strong>
      <a href="#terms-1">1. Agreement and scope</a>
      <a href="#terms-2">2. Eligibility and authority</a>
      <a href="#terms-3">3. Accounts and security</a>
      <a href="#terms-4">4. What Cognitus is — and is not</a>
      <a href="#terms-5">5. Acceptable use</a>
      <a href="#terms-6">6. Prohibited use and data</a>
      <a href="#terms-7">7. Reports and user submissions</a>
      <a href="#terms-8">8. Profiles, identity, and third-party data</a>
      <a href="#terms-9">9. Review, visibility, claims, and appeals</a>
      <a href="#terms-10">10. Investigations and analytical features</a>
      <a href="#terms-11">11. Organizations and employer tools</a>
      <a href="#terms-12">12. Promotional access</a>
      <a href="#terms-13">13. Intellectual property</a>
      <a href="#terms-14">14. Third-party platforms and services</a>
      <a href="#terms-15">15. Moderation, suspension, and termination</a>
      <a href="#terms-16">16. Availability, changes, and beta features</a>
      <a href="#terms-17">17. Security and responsible disclosure</a>
      <a href="#terms-18">18. Disclaimers</a>
      <a href="#terms-19">19. Limitation of liability</a>
      <a href="#terms-20">20. Indemnification</a>
      <a href="#terms-21">21. Governing law and disputes</a>
      <a href="#terms-22">22. Changes to these Terms</a>
      <a href="#terms-23">23. General provisions</a>
      <a href="#terms-24">24. Contact</a>
    </aside>

    <article class="legal34-document">
      <section class="legal34-callout legal34-callout-important">
        <strong>Important platform limitation</strong>
        <p>Cognitus is an online community-record and employment-intelligence tool for Roblox, Discord, and similar online communities. It is not a consumer reporting agency, credit bureau, law-enforcement database, or professional background-check provider, and it is not intended to produce a “consumer report” under the U.S. Fair Credit Reporting Act or similar law. Do not use Cognitus for real-world credit, housing, insurance, lending, government-benefit, immigration, healthcare, or legally regulated employment decisions.</p>
      </section>

      <section id="terms-1">
        <h2>1. Agreement and scope</h2>
        <p>These Terms of Service (the “Terms”) govern access to and use of Cognitus Solutions, including the Cognitus website, account system, profiles, organizations, checks, reports, claims, appeals, employer tools, investigation tools, promotional-access features, analytics, experimental tools, and any related services, content, or functionality we make available (collectively, the “Service”). “Cognitus,” “we,” “us,” and “our” mean Cognitus Solutions and the people authorized to operate the Service.</p>
        <p>By creating an account, accessing an authenticated feature, submitting information, redeeming a promotional code, acting on behalf of an organization, or otherwise using the Service, you agree to these Terms and the Privacy Policy. If you do not agree, do not use the Service.</p>
      </section>

      <section id="terms-2">
        <h2>2. Eligibility and authority</h2>
        <p>The Service is not intended for children under 13. If you are under the age of legal majority where you live, you may use the Service only with permission from a parent or legal guardian when required by applicable law. You must also satisfy the minimum-age rules of any third-party platform connected to your activity, including Discord or Roblox.</p>
        <p>If you use Cognitus for an organization, group, employer, community, or other entity, you represent that you are authorized to act for that entity and to accept these Terms on its behalf. You may not falsely claim to represent an organization, person, or account.</p>
      </section>

      <section id="terms-3">
        <h2>3. Accounts, credentials, and account security</h2>
        <p>You must provide accurate account information and keep it reasonably current. Cognitus may use a Discord ID or other platform identifier to create an internal authentication identifier. An internal authentication identifier is not proof that Cognitus owns, controls, or is affiliated with Discord or the account identified by that number.</p>
        <p>You are responsible for maintaining the confidentiality of your credentials, for activity performed through your account, and for promptly reporting suspected unauthorized access. You may not share credentials in a way that bypasses role, organization, feature, or access restrictions. Cognitus may require password resets, re-authentication, verification, or other protective measures when account security is in doubt.</p>
      </section>

      <section id="terms-4">
        <h2>4. What Cognitus is — and is not</h2>
        <p>Cognitus organizes community-supplied records and provides tools intended to support human review. Information in Cognitus may be self-declared, organization-supplied, user-submitted, reviewer-assessed, disputed, incomplete, outdated, mistaken, or intentionally falsified by a third party. A Cognitus result is not a guarantee of identity, character, misconduct, innocence, trustworthiness, future behavior, or suitability for any role.</p>
        <p>Cognitus does not provide legal, financial, medical, employment-law, law-enforcement, or professional investigative advice. Users remain responsible for independently evaluating information, following their own rules and applicable law, and making their own decisions.</p>
      </section>

      <section id="terms-5">
        <h2>5. Acceptable use</h2>
        <p>You may use Cognitus only for legitimate online-community purposes, including staffing review, internal community safety, partnership review, role or promotion review, record management, claims, appeals, corrections, authorized investigations, and other good-faith operational purposes supported by the Service.</p>
        <p>You must use information proportionately, consider context, distinguish allegations from reviewed findings, respect access controls, and provide individuals a fair opportunity to correct or dispute records when the Service provides that process.</p>
      </section>

      <section id="terms-6">
        <h2>6. Prohibited use and prohibited data</h2>
        <p>You may not use Cognitus to harass, stalk, threaten, blackmail, intimidate, dox, retaliate against, defame, discriminate against, exploit, deceive, or unlawfully monitor another person; to coordinate targeted abuse; to evade platform enforcement; to impersonate another person; to interfere with the Service; to scrape or bulk-extract data without authorization; to bypass access controls; or to use the Service for any unlawful purpose.</p>
        <p>Do not submit passwords, authentication tokens, security answers, government identification numbers, Social Security numbers, bank or payment-card information, private authentication material, precise home addresses, private sexual information, medical records, or similarly sensitive information unless Cognitus expressly creates a lawful feature that requests that specific information. Do not submit sexual content involving minors, exploitative material, or information that you are not legally permitted to possess or disclose.</p>
        <p>Attempts to reverse engineer security controls, exploit vulnerabilities, automate abusive requests, flood the Service, manipulate reports, fabricate evidence, or use another account’s entitlements are prohibited.</p>
      </section>

      <section id="terms-7">
        <h2>7. Reports, evidence, and user submissions</h2>
        <p>You are responsible for information you submit. By submitting a report, note, claim, appeal, employment record, organization record, investigation record, or other content (“User Content”), you represent that you have a good-faith basis for the submission, that you are not knowingly providing materially false or misleading information, and that your submission does not violate another person’s rights or applicable law.</p>
        <p>You retain any ownership rights you may have in your User Content. You grant Cognitus a non-exclusive, worldwide, royalty-free license to host, copy, format, process, display to authorized users, review, moderate, preserve, and otherwise use User Content as reasonably necessary to operate, secure, improve, and enforce the Service, administer disputes, comply with law, and protect users.</p>
        <p>Cognitus may annotate, limit, reject, archive, restrict, remove, or preserve User Content when necessary for safety, integrity, legal compliance, record consistency, investigation of abuse, or enforcement of these Terms. Removal from ordinary display does not necessarily require immediate deletion from backups, audit records, dispute files, or records that must be retained for legitimate security or legal purposes.</p>
      </section>

      <section id="terms-8">
        <h2>8. Profiles, identity, aliases, and third-party data</h2>
        <p>Profiles may contain self-declared names, Discord usernames or IDs, Roblox usernames, aliases, employment or organization history, and other identifiers. Unless Cognitus explicitly marks an identity element as verified, those fields should not be treated as verified ownership or identity proof.</p>
        <p>Some records may be created by organizations or other users about a person who did not create the record. You may not deliberately associate data with the wrong individual. Where available, profile claims, corrections, privacy requests, report-access tools, and appeals must be used in good faith.</p>
      </section>

      <section id="terms-9">
        <h2>9. Review status, visibility, report access, claims, and appeals</h2>
        <p>Submitted reports may begin as private or pending-review records. Reviewer or administrative roles may determine status, visibility, screening availability, or publication state in accordance with Cognitus workflows. A report being visible does not mean Cognitus guarantees its truth. A report being denied, archived, disputed, or restricted does not necessarily mean the underlying event did or did not occur.</p>
        <p>Report subjects and authorized users may receive access through subject rights, explicit grants, screening-visible summaries, organization permissions, or other access mechanisms. Access may be changed or revoked when permitted by the Service. Claims, appeals, and correction requests do not guarantee a requested outcome, but Cognitus may preserve a record of the request and decision.</p>
      </section>

      <section id="terms-10">
        <h2>10. Investigations, risk indicators, analytics, and intelligence features</h2>
        <p>Cognitus may provide Investigation Report Archives, relationship maps, network views, historical timelines, comparisons, watchlists, intelligence reports, analytics, risk-signal matrices, organization-overlap tools, search analytics, collections, labs, and similar analysis features. These features organize or summarize records that the requesting account is authorized to access. They do not create a new legal right to private information.</p>
        <p>Scores, counts, labels, severity summaries, network connections, overlap indicators, risk signals, trends, or automated presentations are decision-support tools only. They are not determinations of guilt, innocence, credibility, protected status, employability, or character. You may not treat an automated metric as the sole basis for a consequential decision.</p>
      </section>

      <section id="terms-11">
        <h2>11. Organizations, employer tools, and authorized representatives</h2>
        <p>Organization and employer tools may include membership, permissions, candidate pipelines, employment records, status requests, report requests, notes, and screening functions. Organization administrators are responsible for granting only appropriate permissions and removing access when a member no longer needs it.</p>
        <p>Private organization or candidate notes must be used for legitimate community operations and may not be used to conceal unlawful discrimination, retaliation, harassment, or knowingly false allegations. Organizations are independently responsible for their own policies, notices, recordkeeping obligations, and legal compliance.</p>
      </section>

      <section id="terms-12">
        <h2>12. Promotional codes, direct grants, beta access, and feature entitlements</h2>
        <p>Promotional codes and direct feature grants are licenses to access designated features, not property, currency, or guaranteed permanent benefits. Unless Cognitus expressly states otherwise in writing, promotional access is personal to the authorized account, non-transferable, not redeemable for cash, and may be limited by redemption count, account eligibility, organization eligibility, start date, end date, duration, campaign status, feature list, or other conditions.</p>
        <p>Permanent promotional access means the entitlement is configured without an ordinary expiration date; it does not prevent Cognitus from suspending or terminating an account for abuse, security reasons, legal compliance, discontinuation of the Service, or violation of these Terms. Codes may not be sold, traded, guessed, brute-forced, duplicated, or distributed contrary to campaign instructions.</p>
      </section>

      <section id="terms-13">
        <h2>13. Intellectual property and license to use the Service</h2>
        <p>The Cognitus name, interface, software, designs, workflows, original documentation, logos, and other Service materials are owned by or licensed to Cognitus and are protected by applicable intellectual-property laws. Subject to these Terms, Cognitus grants you a limited, revocable, non-exclusive, non-transferable license to use the Service for its intended purpose.</p>
        <p>You may not copy, resell, sublicense, frame, mirror, commercially exploit, remove proprietary notices from, or create a competing service from substantial portions of Cognitus except where applicable law expressly permits it.</p>
      </section>

      <section id="terms-14">
        <h2>14. Third-party platforms, hosting, and services</h2>
        <p>Cognitus may rely on third-party infrastructure or services, including Firebase/Google services, GitHub Pages, web browsers, and platform identifiers associated with Discord or Roblox. Third-party services are governed by their own terms and policies. Cognitus is not responsible for third-party outages, policy changes, account actions, security events, or content outside Cognitus’s control.</p>
        <p>Discord, Roblox, Google, Firebase, GitHub, and other third-party names are the property of their respective owners. Unless expressly stated, Cognitus is not sponsored, endorsed, operated, or approved by those companies.</p>
      </section>

      <section id="terms-15">
        <h2>15. Moderation, restrictions, suspension, and termination</h2>
        <p>Cognitus may restrict features, require re-authentication, revoke entitlements, suspend an account, ban an account, limit organization permissions, preserve evidence, remove access to records, or terminate access when we reasonably believe it is necessary to protect users, investigate abuse, comply with law, address security risks, enforce these Terms, protect Service integrity, or respond to material misuse.</p>
        <p>You may stop using the Service at any time. Account deletion or closure may be subject to retention of audit logs, dispute history, moderation records, security records, content that another authorized user has a legitimate right to retain, and records required for legal or operational integrity.</p>
      </section>

      <section id="terms-16">
        <h2>16. Availability, modifications, and experimental features</h2>
        <p>The Service may change, be interrupted, or be discontinued. Cognitus may add, remove, redesign, limit, rename, or modify features, routes, permissions, records, promotional benefits, or supported integrations. We do not guarantee continuous availability, error-free operation, data preservation for a particular period, compatibility with every device, or continued availability of any beta, Labs, Early Access, or promotional feature.</p>
        <p>Experimental and Early Access features may be incomplete, unstable, inaccurate, or changed without notice. Use them with additional caution.</p>
      </section>

      <section id="terms-17">
        <h2>17. Security and responsible disclosure</h2>
        <p>You may not test, probe, or exploit Cognitus security in a way that risks data exposure, service disruption, unauthorized access, or harm to users. If you believe you have discovered a vulnerability, report it privately through an official Cognitus support or administrative channel and do not publicly disclose sensitive details before Cognitus has had a reasonable opportunity to investigate and mitigate the issue.</p>
      </section>

      <section id="terms-18">
        <h2>18. Disclaimers</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” COGNITUS DISCLAIMS WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, COMPLETENESS, AVAILABILITY, SECURITY, AND RELIABILITY, WHETHER EXPRESS, IMPLIED, OR STATUTORY.</p>
        <p>Cognitus does not warrant that any record, report, profile, risk indicator, employment entry, identity assertion, investigation result, organization record, or user submission is accurate or complete. You are responsible for independent verification before relying on information.</p>
      </section>

      <section id="terms-19">
        <h2>19. Limitation of liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, COGNITUS AND ITS OPERATORS, CONTRIBUTORS, REPRESENTATIVES, AND SERVICE PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES; LOST PROFITS, REPUTATION, OPPORTUNITIES, DATA, OR GOODWILL; OR DAMAGES ARISING FROM THIRD-PARTY CONTENT, USER SUBMISSIONS, ACCOUNT ACTIONS, RELIANCE ON REPORTS, SERVICE INTERRUPTION, OR UNAUTHORIZED ACCESS.</p>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE TOTAL AGGREGATE LIABILITY OF COGNITUS ARISING FROM THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID DIRECTLY TO COGNITUS FOR THE SERVICE DURING THE 12 MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM OR (B) US $100. Some jurisdictions do not allow certain limitations, so some of these limits may not apply to you.</p>
      </section>

      <section id="terms-20">
        <h2>20. Indemnification</h2>
        <p>To the extent permitted by law, if you use Cognitus on behalf of an organization or in a business, administrative, reviewer, or employer capacity, you agree to defend, indemnify, and hold harmless Cognitus and its operators from third-party claims, liabilities, damages, losses, and reasonable costs arising from your unlawful use of the Service, your User Content, your violation of these Terms, or your violation of another person’s rights. This provision does not require indemnification where prohibited by applicable law.</p>
      </section>

      <section id="terms-21">
        <h2>21. Governing law and disputes</h2>
        <p>Except where consumer-protection law requires otherwise, these Terms and disputes arising from them are governed by the laws of the State of Oklahoma, without regard to conflict-of-law principles. Before filing a formal claim, you and Cognitus agree to make a reasonable good-faith effort to resolve the issue informally through an official Cognitus support or administrative channel.</p>
        <p>If informal resolution is unsuccessful, disputes may be brought in a court of competent jurisdiction in Oklahoma, subject to any mandatory venue, consumer, or jurisdictional rights that applicable law gives you. These Terms do not waive rights that cannot legally be waived.</p>
      </section>

      <section id="terms-22">
        <h2>22. Changes to these Terms</h2>
        <p>Cognitus may update these Terms to reflect new features, legal requirements, security practices, business changes, or operational needs. Material changes may be communicated through the Service, an updated effective date, a notice, or another reasonable method. Continued use after updated Terms become effective constitutes acceptance to the extent permitted by law.</p>
      </section>

      <section id="terms-23">
        <h2>23. General provisions</h2>
        <p>If a provision of these Terms is held unenforceable, the remaining provisions remain in effect to the fullest extent permitted by law. Failure to enforce a provision is not a waiver. You may not assign your rights under these Terms without Cognitus’s consent, except where law provides otherwise. Cognitus may assign these Terms as part of a reorganization, transfer, merger, or change in Service ownership.</p>
        <p>These Terms, together with the Privacy Policy and any feature-specific rules expressly incorporated into them, form the agreement governing the Service. Headings are for convenience and do not limit meaning.</p>
      </section>

      <section id="terms-24">
        <h2>24. Contact</h2>
        <p>Questions about these Terms, account restrictions, legal requests, or platform use should be submitted through the official Cognitus support or administrative channel identified in the Service. Privacy-related requests may also be submitted through any privacy-request or correction workflow made available within Cognitus.</p>
      </section>
    </article>
  </div>`;

const PRIVACY = `
  <div class="legal34-layout">
    <aside class="legal34-toc" aria-label="Privacy Policy sections">
      <strong>On this page</strong>
      <a href="#privacy-1">1. Scope</a>
      <a href="#privacy-2">2. Information we collect</a>
      <a href="#privacy-3">3. Sources of information</a>
      <a href="#privacy-4">4. How we use information</a>
      <a href="#privacy-5">5. Profiles and third-party submissions</a>
      <a href="#privacy-6">6. Reports and investigations</a>
      <a href="#privacy-7">7. Promotional and feature-access data</a>
      <a href="#privacy-8">8. Cookies, local storage, and device data</a>
      <a href="#privacy-9">9. How information is disclosed</a>
      <a href="#privacy-10">10. Sale, advertising, and profiling</a>
      <a href="#privacy-11">11. Retention</a>
      <a href="#privacy-12">12. Security</a>
      <a href="#privacy-13">13. Your privacy rights</a>
      <a href="#privacy-14">14. U.S. state privacy notices</a>
      <a href="#privacy-15">15. EEA, UK, and similar rights</a>
      <a href="#privacy-16">16. Children and minors</a>
      <a href="#privacy-17">17. International processing</a>
      <a href="#privacy-18">18. Third-party services</a>
      <a href="#privacy-19">19. Changes</a>
      <a href="#privacy-20">20. Contact</a>
    </aside>

    <article class="legal34-document">
      <section class="legal34-callout">
        <strong>Privacy summary</strong>
        <p>Cognitus is designed around authenticated, role-based access. We collect account, profile, organization, report, investigation, employment/community record, access-control, audit, and feature-use information needed to operate the Service. We do not intend to sell personal information or use Cognitus data for targeted behavioral advertising.</p>
      </section>

      <section id="privacy-1">
        <h2>1. Scope of this Privacy Policy</h2>
        <p>This Privacy Policy explains how Cognitus Solutions (“Cognitus,” “we,” “us,” or “our”) collects, uses, stores, discloses, protects, and otherwise processes information when you use the Cognitus website, accounts, profiles, organizations, reports, checks, claims, appeals, employment/community records, investigations, promotional features, analytics, and related functionality (the “Service”).</p>
        <p>This Policy applies to information processed by Cognitus. Third-party platforms and infrastructure providers have their own privacy practices.</p>
      </section>

      <section id="privacy-2">
        <h2>2. Information we collect</h2>
        <p>Depending on how you use Cognitus, we may process the following categories of information:</p>
        <ul>
          <li><strong>Account information:</strong> internal user ID, Cognitus ID, display name, Discord username, Discord ID, account status, role, account type, organization affiliation, authentication metadata, identity-verification state, and login or security timestamps.</li>
          <li><strong>Profile information:</strong> display names, Discord usernames and IDs, Roblox usernames, aliases, profile IDs, claimed or linked account status, identity status, professional-standing labels, risk labels, report counts, appeal counts, and profile history.</li>
          <li><strong>Organization information:</strong> organization name, identifiers, organization type, country, verification status, trust level, membership, permissions, titles, and administrative records.</li>
          <li><strong>Screening and check information:</strong> search type, search field, search query, reason for a check, notes, target profile or organization, result references, result counts, report-download state, and timestamps.</li>
          <li><strong>Reports and screening summaries:</strong> subject identifiers, submitter identifiers, category, severity, summary, details, status, visibility, review information, publication information, appeal state, and decision notes.</li>
          <li><strong>Report-access information:</strong> access requests, reasons, approvals, denials, revocations, direct owner grants, subject grants, and authorized user IDs.</li>
          <li><strong>Employment/community records:</strong> organization, position, department, employment type, start/end dates, end reason, rehire eligibility, record status, source, visibility, disputes, and related review information.</li>
          <li><strong>Claims, appeals, and privacy requests:</strong> statements, reasons, verification method, requested action, review status, reviewer notes, decisions, and timestamps.</li>
          <li><strong>Candidate and organization workflow data:</strong> candidate profiles, pipeline state, private organizational notes, organization-member permissions, employer-status applications, and administrative decisions.</li>
          <li><strong>Promotional-access data:</strong> promotional code used, campaign ID, granted feature IDs, redemption count, access source, grant label, expiration, entitlement status, direct assignments, and campaign metadata.</li>
          <li><strong>Promotional workspace data:</strong> watchlists, investigations, intelligence reports, snapshots, profile customizations, collections, search events, analytics, and other user-created feature data.</li>
          <li><strong>Audit and security information:</strong> actor ID, role, action, target, activity summary, limited metadata, security events, account restrictions, and timestamps.</li>
          <li><strong>Technical information:</strong> information that browsers, hosting providers, authentication providers, or security systems may automatically process, such as IP address, user agent, device/browser characteristics, request logs, authentication state, cookies or local storage, and diagnostic information.</li>
        </ul>
      </section>

      <section id="privacy-3">
        <h2>3. Sources of information</h2>
        <p>We may receive information directly from you; from other Cognitus users; from organization administrators, employers, reviewers, or report submitters; from information intentionally entered from public or community-facing profiles; from records generated by your use of Cognitus; and from service providers that support authentication, hosting, security, or operation of the Service.</p>
        <p>Because Cognitus permits authorized users to create records about other community participants, not every record about you necessarily comes from you.</p>
      </section>

      <section id="privacy-4">
        <h2>4. How we use information</h2>
        <p>We may use information to:</p>
        <ul>
          <li>create, authenticate, secure, and administer accounts;</li>
          <li>operate profiles, organizations, checks, reports, claims, appeals, investigations, and employment/community record systems;</li>
          <li>provide screening-visible information to authorized users;</li>
          <li>maintain access controls, promotional entitlements, organization permissions, and direct grants;</li>
          <li>review submitted reports and resolve claims, appeals, disputes, and privacy requests;</li>
          <li>generate summaries, comparisons, relationship maps, analytics, risk-signal displays, timelines, reports, and other user-requested analysis;</li>
          <li>detect fraud, abuse, security incidents, unauthorized access, malicious reporting, and violations of the Terms;</li>
          <li>maintain audit trails and record integrity;</li>
          <li>troubleshoot, improve, test, and develop the Service;</li>
          <li>communicate operational, security, policy, or account information;</li>
          <li>comply with legal obligations and enforce our rights; and</li>
          <li>protect Cognitus, users, organizations, and the public from harm.</li>
        </ul>
      </section>

      <section id="privacy-5">
        <h2>5. Profiles, aliases, and information submitted by other people</h2>
        <p>Cognitus may contain profiles or records created by organizations or users other than the subject of the record. These records can include platform usernames, platform IDs, aliases, community employment history, and report references. We use access controls and review workflows to separate different record types, but we cannot guarantee that user-submitted information is accurate.</p>
        <p>Where the Service provides a profile claim, appeal, correction, privacy request, or dispute process, you may use those tools to challenge or clarify information associated with you.</p>
      </section>

      <section id="privacy-6">
        <h2>6. Reports, screening summaries, investigations, and visibility</h2>
        <p>Reports may contain allegations, supporting context, reviewer decisions, visibility settings, and dispute information. Access can vary based on account status, role, organization, report-subject relationship, direct access grants, screening visibility, or other authorization rules.</p>
        <p>Promotional or advanced investigation features do not automatically make private information public. They are intended to organize information that the requesting account is otherwise permitted to access. For ordinary promotional users, report-history tools may rely on screening-visible report summaries rather than sealed or private-review report content.</p>
      </section>

      <section id="privacy-7">
        <h2>7. Promotional codes, grants, and feature-access information</h2>
        <p>When a promotional code is redeemed or an administrator assigns feature access, we may store the code or campaign identifier, account ID, feature IDs, redemption count, access status, grant source, grant administrator, start or grant date, expiration, campaign end behavior, and related audit information. We use this information to determine what features an account can access, prevent abuse, enforce redemption limits, and administer campaigns.</p>
      </section>

      <section id="privacy-8">
        <h2>8. Cookies, local storage, authentication state, and device information</h2>
        <p>Cognitus and its infrastructure providers may use cookies, browser storage, authentication persistence, or similar technologies that are necessary to keep you signed in, remember security or interface preferences, maintain session state, prevent abuse, and operate the Service.</p>
        <p>As of the effective date of this Policy, Cognitus is not designed around third-party behavioral advertising. If advertising or materially different tracking practices are introduced, this Policy will be updated as required.</p>
      </section>

      <section id="privacy-9">
        <h2>9. How and when information may be disclosed</h2>
        <p>Information may be disclosed:</p>
        <ul>
          <li><strong>To authorized Cognitus users:</strong> according to profile, organization, role, report, screening, investigation, entitlement, and access-control rules.</li>
          <li><strong>To organization administrators or members:</strong> when the information is part of an authorized organization workflow.</li>
          <li><strong>To report subjects or approved recipients:</strong> when subject access, direct grants, screening visibility, or other Service rules permit access.</li>
          <li><strong>To service providers:</strong> when necessary for hosting, authentication, storage, security, maintenance, or other operational support.</li>
          <li><strong>For legal or safety reasons:</strong> when we reasonably believe disclosure is required by law, valid legal process, protection of rights, investigation of fraud or abuse, prevention of harm, or defense of legal claims.</li>
          <li><strong>During a business or organizational change:</strong> if the Service or its assets are transferred, reorganized, merged, or assigned, subject to applicable law and appropriate protection of information.</li>
          <li><strong>With your direction or consent:</strong> when you intentionally request or authorize disclosure.</li>
        </ul>
      </section>

      <section id="privacy-10">
        <h2>10. Sale of personal information, targeted advertising, and automated profiling</h2>
        <p>As of the effective date, Cognitus does not intend to sell personal information for money or share personal information for cross-context behavioral advertising. Cognitus is not designed to use personal information for targeted advertising.</p>
        <p>Cognitus may generate risk signals, analytics, counts, comparisons, or other automated presentations from authorized records. These tools are intended as decision support and not as solely automated decisions producing legal or similarly significant real-world effects. Users are instructed to conduct independent human review.</p>
        <p>If our practices materially change, we will update this Policy and provide legally required choices.</p>
      </section>

      <section id="privacy-11">
        <h2>11. Data retention</h2>
        <p>We retain information for as long as reasonably necessary for the purpose for which it was collected, to operate account and record-integrity systems, maintain audit and security history, administer organizations and entitlements, resolve disputes, enforce the Terms, comply with legal obligations, and protect users.</p>
        <p>Retention periods vary by record type. Some records may remain after an account is closed or a visible record is removed when continued retention is reasonably necessary for security logs, dispute records, moderation history, legal compliance, fraud prevention, backups, or preserving the integrity of records involving other users.</p>
      </section>

      <section id="privacy-12">
        <h2>12. Security</h2>
        <p>Cognitus uses technical and organizational safeguards intended to reduce unauthorized access, including authenticated access, account-status controls, role and organization permissions, record-level authorization, Firestore Security Rules, controlled administrative workflows, and audit logging. We may also use security measures provided by our infrastructure providers.</p>
        <p>No online system is perfectly secure. We cannot guarantee that data will never be lost, altered, accessed, or disclosed without authorization. Users are responsible for protecting their credentials and promptly reporting suspected compromise.</p>
      </section>

      <section id="privacy-13">
        <h2>13. Your privacy and record rights</h2>
        <p>Depending on your relationship with Cognitus and applicable law, you may have the right to request access, correction, deletion, a copy of your information, restriction of certain processing, an explanation of certain decisions, withdrawal of consent where processing is based on consent, or an appeal of a privacy-rights decision.</p>
        <p>Cognitus may provide in-product claims, appeals, employment-record disputes, report-access tools, or privacy-request workflows. We may need to verify your identity before fulfilling a request. We may deny or limit a request when permitted by law, including where disclosure would expose another person’s protected information, compromise security, conflict with legal obligations, or undermine legitimate fraud, moderation, or dispute records.</p>
      </section>

      <section id="privacy-14">
        <h2>14. U.S. state privacy notices</h2>
        <p>Residents of certain U.S. states may have additional rights regarding access, correction, deletion, portability, targeted advertising, sale or sharing, profiling, sensitive-data processing, or appeal of a denied request. The exact rights depend on applicable law and whether Cognitus is subject to that law.</p>
        <p>For transparency, the categories of personal information Cognitus may process are described in Section 2, the purposes are described in Section 4, and the categories of recipients are described in Section 9. As of the effective date, Cognitus does not intend to sell personal information or use it for targeted behavioral advertising. Cognitus does not intentionally use sensitive personal information to infer legally protected characteristics for advertising.</p>
        <p>Where applicable law recognizes an authorized agent, Cognitus may require proof of the agent’s authority and verification of the underlying user. We will not unlawfully discriminate against a person for exercising a privacy right.</p>
      </section>

      <section id="privacy-15">
        <h2>15. EEA, United Kingdom, and similar data-protection rights</h2>
        <p>If data-protection law in the European Economic Area, United Kingdom, or another jurisdiction applies to Cognitus’s processing of your information, processing may rely on one or more lawful bases such as performance of a contract, legitimate interests in operating and securing the Service, compliance with legal obligations, protection of rights and safety, or consent where consent is required.</p>
        <p>Where applicable, you may have rights of access, rectification, erasure, restriction, portability, objection, withdrawal of consent, and complaint to a supervisory authority. These rights are subject to legal exceptions and the circumstances of the processing.</p>
      </section>

      <section id="privacy-16">
        <h2>16. Children and minors</h2>
        <p>Cognitus is not intended for children under 13 and we do not knowingly seek to collect personal information directly from children under 13. If we learn that a child under 13 has created an account or provided information in violation of this Policy, we may restrict the account and take reasonable steps to delete or otherwise address the information as required by law.</p>
        <p>Users between 13 and the age of legal majority should use Cognitus only with parent or guardian permission when required by law. Users must not submit unnecessary sensitive information about minors.</p>
      </section>

      <section id="privacy-17">
        <h2>17. International processing and transfers</h2>
        <p>Cognitus and its service providers may process information in the United States or other locations where infrastructure or personnel operate. Those locations may have data-protection laws different from those where you live. Where applicable law requires transfer safeguards, Cognitus will use legally recognized mechanisms or other appropriate protections where reasonably available and required.</p>
      </section>

      <section id="privacy-18">
        <h2>18. Third-party services and external links</h2>
        <p>Cognitus may use or link to third-party services, including Firebase/Google infrastructure, GitHub Pages, Discord, Roblox, or external documents and websites. Cognitus does not control the independent privacy practices of those third parties. Information you provide directly to a third party is governed by that third party’s privacy policy.</p>
      </section>

      <section id="privacy-19">
        <h2>19. Changes to this Privacy Policy</h2>
        <p>We may update this Policy when our features, data practices, service providers, security controls, or legal obligations change. The “Last updated” date will identify the current version. When required by law, we will provide additional notice or obtain consent before applying a material change.</p>
      </section>

      <section id="privacy-20">
        <h2>20. Contact and privacy requests</h2>
        <p>Questions about this Policy or requests concerning your information should be submitted through the official Cognitus support or administrative channel identified in the Service. Where an in-product privacy-request, claim, appeal, report-access, or correction workflow is available and appropriate to your request, using that workflow helps Cognitus verify the request and route it to the correct record.</p>
      </section>
    </article>
  </div>`;

function renderPolicy(kind) {
  if (!root) return;
  mountStyles();
  const isTerms = kind === "terms";
  document.title = `${isTerms ? "Terms of Service" : "Privacy Policy"} · Cognitus Solutions`;
  root.classList.add("legal34-root");
  root.innerHTML = `
    <section class="legal34-shell" data-legal-v34-page="${kind}">
      ${policyHeader(
        kind,
        isTerms ? "Terms of Service" : "Privacy Policy",
        isTerms
          ? "The rules for using Cognitus, submitting records, accessing investigations, and participating in Cognitus organizations."
          : "A comprehensive explanation of what Cognitus processes, why it is used, who may access it, and the choices available to you."
      )}
      ${isTerms ? TERMS : PRIVACY}
      <footer class="legal34-endnote">
        <strong>Cognitus Solutions</strong>
        <span>${isTerms ? "Terms of Service" : "Privacy Policy"} · ${EFFECTIVE_DATE}</span>
      </footer>
    </section>`;

  requestAnimationFrame(() => {
    if (location.hash.includes("#terms-") || location.hash.includes("#privacy-")) return;
    root.scrollIntoView({ block: "start" });
  });
}

function syncPolicyRoute() {
  const policy = currentPolicy();
  if (!policy) {
    root?.classList.remove("legal34-root");
    return;
  }
  const existing = root?.querySelector(`[data-legal-v34-page="${policy}"]`);
  if (!existing) renderPolicy(policy);
}

let restoring = false;
const observer = root
  ? new MutationObserver(() => {
      const policy = currentPolicy();
      if (!policy || restoring) return;
      if (root.querySelector(`[data-legal-v34-page="${policy}"]`)) return;
      restoring = true;
      queueMicrotask(() => {
        renderPolicy(policy);
        restoring = false;
      });
    })
  : null;

export function startLegalPoliciesV34() {
  mountStyles();
  observer?.observe(root, { childList: true });
  window.addEventListener("hashchange", syncPolicyRoute);
  window.addEventListener("pageshow", syncPolicyRoute);
  document.addEventListener("DOMContentLoaded", syncPolicyRoute, { once: true });
  syncPolicyRoute();
}
