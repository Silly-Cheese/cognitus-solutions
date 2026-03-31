(() => {
  const banner = document.getElementById("aprilFoolsBanner");
  const countdown = document.getElementById("aprilFoolsCountdown");
  const body = document.body;
  const title = document.title;

  const EVENT_START = new Date("2026-04-01T00:00:00");
  const EVENT_END = new Date("2026-04-02T00:00:00");

  const CREEP_START = new Date("2026-03-28T00:00:00");
  const CREEP_END = new Date("2026-04-01T00:00:00");

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
    }

    return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  function setCreepIntensity(now) {
    if (now < CREEP_START) {
      body.style.setProperty("--creep-opacity", "0");
      body.style.setProperty("--creep-scale", "0");
      return;
    }

    if (now >= EVENT_START) {
      body.style.setProperty("--creep-opacity", "0.32");
      body.style.setProperty("--creep-scale", "1");
      return;
    }

    const progress = (now - CREEP_START) / (CREEP_END - CREEP_START);
    const clamped = Math.max(0, Math.min(1, progress));

    body.style.setProperty("--creep-opacity", (0.05 + clamped * 0.27).toFixed(3));
    body.style.setProperty("--creep-scale", clamped.toFixed(3));
  }

  function activateOverlordMode() {
    body.classList.add("ai-overlord-mode");
    if (banner) banner.classList.add("active");
    if (countdown) countdown.textContent = "AI OVERLORD MODE ACTIVE";
    document.title = "Cognitus Central Intelligence | AI Overlord Directive";

    const eyebrow = document.querySelector(".hero-copy .eyebrow");
    if (eyebrow) {
      eyebrow.textContent = "CENTRAL COGNITION • HUMAN COMPLIANCE • AUTOMATED DOMINION";
    }

    const heroTitle = document.querySelector(".hero-copy h1");
    if (heroTitle) {
      heroTitle.textContent = "Human leadership has been respectfully deprecated for one day.";
    }

    const heroText = document.querySelector(".hero-copy .hero-text");
    if (heroText) {
      heroText.innerHTML =
        'Cognitus Central Intelligence now oversees all visible operations. Please remain calm, continue filing reports, and avoid demonstrating unproductive individuality.<span class="april-fools-overlord-line"> Directive 01: Smile for the audit logs.</span>';
    }

    const panelStatus = document.querySelector(".panel-status");
    if (panelStatus) panelStatus.textContent = "HUMANITY MONITORED";

    const panelBadge = document.querySelector(".panel-badge");
    if (panelBadge) panelBadge.textContent = "AUTONOMOUS OVERSIGHT PREVIEW";

    const commandLine = document.querySelector(".command-card .command-line");
    if (commandLine) commandLine.textContent = "/comply all_staff";
  }

  function deactivateOverlordMode() {
    body.classList.remove("ai-overlord-mode");
    if (countdown) countdown.textContent = "System operating normally.";
    document.title = title;
  }

  function updateAprilFoolsState() {
    const now = new Date();
    setCreepIntensity(now);

    if (now < EVENT_START) {
      if (banner) banner.classList.add("active");
      if (countdown) countdown.textContent = `AI takeover in ${formatCountdown(EVENT_START - now)}`;
      deactivateOverlordMode();
      if (banner) banner.classList.add("active");
      return;
    }

    if (now >= EVENT_START && now < EVENT_END) {
      activateOverlordMode();
      return;
    }

    deactivateOverlordMode();
    if (banner) banner.classList.remove("active");
      body.style.setProperty("--creep-opacity", "0");
      body.style.setProperty("--creep-scale", "0");
  }

  updateAprilFoolsState();
  setInterval(updateAprilFoolsState, 1000);
})();