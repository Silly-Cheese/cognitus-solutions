import fs from 'node:fs';

const entry = fs.readFileSync('src/promotionalAccessV26.js', 'utf8');
const js = fs.readFileSync('src/legalPoliciesV34.js', 'utf8');
const css = fs.readFileSync('src/legalPoliciesV34.css', 'utf8');

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Legal Policies V34 validation failed: missing ${label}`);
}

requireText(entry, 'startLegalPoliciesV34', 'production startup wiring');
requireText(js, 'September 5, 2026', 'effective date');
requireText(js, 'Terms of Service', 'Terms of Service');
requireText(js, 'Privacy Policy', 'Privacy Policy');
requireText(js, 'not a consumer reporting agency', 'FCRA/consumer-report limitation');
requireText(js, 'Promotional codes, direct grants, beta access', 'promotional-access terms');
requireText(js, 'Investigations, risk indicators, analytics', 'advanced-feature terms');
requireText(js, 'Information we collect', 'privacy collection disclosure');
requireText(js, 'Sale of personal information, targeted advertising', 'sale/advertising disclosure');
requireText(js, 'Children and minors', 'minor privacy section');
requireText(js, 'U.S. state privacy notices', 'US privacy rights section');
requireText(js, 'EEA, United Kingdom', 'international privacy rights section');
requireText(js, 'MutationObserver', 'route-restoration guard');
requireText(css, '.legal34-layout', 'desktop legal layout');
requireText(css, '@media (max-width: 620px)', 'mobile legal layout');
requireText(css, '@media print', 'print legal layout');

console.log('Legal Policies V34 checks passed.');
