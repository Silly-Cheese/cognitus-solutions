const id = "cognitus-signal-zero-contrast-v35";
let link = document.querySelector(`#${id}`);
if (!link) {
  link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  document.head.appendChild(link);
}
link.href = "./src/frenzySignalOverrideV35.css?v=20260905-v35";
