import fs from "node:fs";

const navigation = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const legacyCss = fs.readFileSync("src/navigationV6.css", "utf8");
const css = fs.readFileSync("src/navigationV12.css", "utf8");

const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
};

assert(navigation.includes("navigationV6.css") && navigation.includes("navigationV12.css"), "Navigation V12 layers its refined styling over the stable V6 base");
assert(navigation.includes("MENU_SECTIONS") && navigation.includes("STAFF_NAV"), "navigation separates organization, workflow, and staff destinations");
assert(navigation.includes("data-nav6-more-button") && navigation.includes('aria-haspopup="true"') && navigation.includes("<span>Tools</span>"), "Tools menu has an explicit accessible trigger");
assert(navigation.includes("closeMoreMenu") && navigation.includes('event.key === "Escape"'), "Tools menu supports click-away and Escape dismissal");
assert(navigation.includes('logout.textContent = "Logout"'), "Logout remains a direct visible control");
assert(navigation.includes('href = "#/profile"') && navigation.includes('href = "#/organizations?request=1"'), "Profile and New Organization remain available");
assert(navigation.includes("employerHubNode") && navigation.includes('nav.querySelector("[data-emp11-nav]")'), "Employer Hub is promoted into the primary workspace row when available");
assert(navigation.includes('nav.querySelector(\'a[href="#/search"]\')') && navigation.includes('nav.querySelector("[data-reports-tab]")'), "Run Check and Reports remain primary destinations");
assert(navigation.includes('label: "Organization"') && navigation.includes('href: "#/organizations"') && navigation.includes('href: "#/employer-status"'), "organization administration is grouped cleanly inside Tools");
assert(navigation.includes("1900") && !navigation.includes("MutationObserver"), "navigation uses bounded late synchronization without MutationObservers");
assert(legacyCss.includes(".nav6-more") && legacyCss.includes(".nav6-menu"), "stable V6 menu foundation remains present");
assert(css.includes("[data-emp11-nav]") && css.includes("--nav12-violet"), "Employer Hub receives a distinct visual treatment");
assert(css.includes(".topnav") && css.includes(".nav6-menu-section"), "V12 styling refines desktop navigation and grouped menu sections");
assert(css.includes("@media(max-width:760px)") && css.includes("background:#111827!important"), "V12 includes an intentional mobile navigation sheet");
assert(css.includes("#logout-button") && css.includes("nav-user"), "Logout and signed-in account treatments remain visible");

if (process.exitCode) {
  console.error("\nNavigation V12 validation failed.");
  process.exit(process.exitCode);
}
console.log("\nNavigation V12 validation passed.");
