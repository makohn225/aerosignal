"use strict";
/* p166: tablet touch targets (November 2, 2026). On touch screens (an iPad on the kneeboard, landscape
   or portrait) the brief's view switches (Essentials, More), the section chips, Share bottom line and
   the Plan page example buttons were 27 to 31 pixels tall. They are now at least 40, the size a gloved
   or bumpy cockpit finger can hit. Mouse and trackpad layouts do not change. */
(function () {
  const css = document.createElement("style");
  css.textContent = `@media (pointer:coarse){
    #view .br-tg,#view .bj-tg,#view .shr-chip,#view .qex button,#bfBluf button,#bfBluf .btn{min-height:40px}
    #view .br-tg,#view .bj-tg,#view .shr-chip{display:inline-flex;align-items:center}
  }`;
  document.head.appendChild(css);
})();
