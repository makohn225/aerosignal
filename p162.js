"use strict";
/* p162: printing fixes (October 28, 2026).
   1. The civil kneeboard card (p118) adds a print rule that hides everything on the page except the
      card. It applied on every page, so printing a mission brief, the military kneeboard or any other
      page came out blank. It now applies only when the card is on the page.
   2. The light themes (Day, Sunlight, Sectional, Gold) work by inverting the whole page on screen.
      Printing inverted the paper too; prints now always use the print styles, black on white.
   3. Floating buttons (Ask, Feedback), the tour bars, the Start here card and the mode tiles stay off
      the paper. */
(function () {
  const css = document.createElement("style");
  css.textContent = `@media print{
    body:not(:has(.kc)) *{visibility:visible!important}
    html.day{filter:none!important}
    #askFab,#askPanel,#fbFab,#tourBar,#tutBar,#tutRing,#toast,#asWelcome,#modeHub,#lpFull{display:none!important}
  }`;
  document.head.appendChild(css);
})();
