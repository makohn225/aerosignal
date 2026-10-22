"use strict";
/* p96: a more distinct Glass cockpit theme (p87): square corners, thin white borders, a monospace
   display font for headings and numbers, magenta section titles and no glow, closer to a glass
   panel display. Only applies while that theme is chosen. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    html.th-glass{--disp:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;--r:6px;--r-sm:4px}
    html.th-glass .panel,html.th-glass .card,html.th-glass section.panel{border-radius:6px!important;border-color:rgba(255,255,255,.22)!important;background:#05070a!important;box-shadow:none!important}
    html.th-glass .panel h2,html.th-glass section.panel>h2{color:#ff40ff!important;text-shadow:none!important}
    html.th-glass h1{font-family:var(--disp);letter-spacing:.5px}
    html.th-glass .btn{border-radius:4px!important;box-shadow:none!important}
    html.th-glass .tabs a{border-radius:4px!important}
    html.th-glass #bfBluf{border-color:#21d4fd!important}
  `;
  document.head.appendChild(css);
})();
