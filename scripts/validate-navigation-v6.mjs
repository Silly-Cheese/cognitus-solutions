import fs from "node:fs";

const navigation = fs.readFileSync("src/navigationEnhancements.js", "utf8");
const css = fs.readFileSync("src/navigationV6.css", "utf8");

const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
};

assert(navigation.includes("navigationV6.css"), "Navigation V6 stylesheet is loaded");
assert(navigation.includes("SECONDARY_NAV") && navigation.includes("STAFF_NAV"), "navigation separates primary, workflow, and staff destinations");
assert(navigation.includes("data-nav6-more-button") && navigation.includes('aria-haspopup="true"'), "More menu has an explicit accessible trigger");
assert(navigation.includes("closeMoreMenu") && navigation.includes('event.key === "Escape"'), "More menu supports click-away and Escape dismissal");
assert(navigation.includes('logout.textContent = "Logout"'), "Logout remains a direct visible control");
assert(navigation.includes('href = "#/profile"') && navigation.includes('href = "#/organizations?request=1"'), "Profile and New Organization remain first-class navigation actions");
assert(!navigation.includes("MutationObserver"), "Navigation V6 remains observer-free");
assert(css.includes(".nav6-more") && css.includes(".nav6-menu"), "desktop More menu styling is present");
assert(css.includes("#logout-button") && css.includes("--nav6-danger"), "Logout has a distinct visible treatment");
assert(css.includes("@media (max-width: 760px)") && css.includes("grid-template-columns: 1fr"), "mobile navigation is intentionally single-column and touch-friendly");
assert(css.includes(".nav-user::before"), "signed-in identity receives a compact account-status treatment");

if (process.exitCode) {
  console.error("\nNavigation V6 validation failed.");
  process.exit(process.exitCode);
}
console.log("\nNavigation V6 validation passed.");
