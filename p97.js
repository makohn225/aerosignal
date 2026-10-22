"use strict";
/* p97: the top bar Tutorial button and the "New to AeroSignal" welcome bar retire themselves once the pilot has started the tutorial or after a week
   of using the app on this device. The tutorial stays on the More page (and #/tutorial). Saved in
   S.firstSeen and S.tutStarted. */
(function () {
  const css = document.createElement("style");
  css.textContent = `body.tut-retired #asTutTop,body.tut-retired #asWelcome{display:none!important}`;
  document.head.appendChild(css);
  if (!S.firstSeen) { S.firstSeen = Date.now(); try { save(); } catch {} }
  const retired = () => !!S.tutStarted || Date.now() - (S.firstSeen || Date.now()) > 7 * 864e5;
  const apply = () => document.body.classList.toggle("tut-retired", retired());
  document.addEventListener("click", (e) => {
    if (e.target.closest && (e.target.closest("#tutPlay, [data-tutstart]") || (e.target.closest(".wcard") && /^#\/tutorial/.test(location.hash || "")))) {
      if (!S.tutStarted) { S.tutStarted = Date.now(); try { save(); } catch {} }
      setTimeout(apply, 1000);
    }
  }, true);
  window.addEventListener("hashchange", () => { if (/^#\/tutorial/.test(location.hash || "") && !S.tutStarted) { S.tutStarted = Date.now(); try { save(); } catch {} } apply(); });
  apply();
})();
