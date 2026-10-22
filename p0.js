"use strict";
/* p0: faster settling. Most AeroSignal modules redraw their part of a page after a short pause
   (a 200 to 500 ms debounce). On the Brief page dozens of them react to each other, so those pauses
   added up to many seconds of panels appearing and moving one after another. This loads first and
   shortens timers in that range to 40 ms: each module still waits for the page to stop changing,
   but the chain settles in a fraction of the time. Longer timers (toasts, tutorial pacing) are untouched. */
(function () {
  // Only debounces are shortened: a timer set right after clearing the previous one (the "kick"
  // pattern). Retry loops that poll every few hundred ms keep their timing.
  const ST = window.setTimeout, CT = window.clearTimeout;
  let cleared = false, rdy = false;
  // Until the brief's bottom line card has drawn once, timers keep their normal length so the first
  // paint is not crowded out by dozens of quick follow up passes.
  const ready = () => rdy || (rdy = !!document.getElementById("bfBluf") || !/^#\/brief/.test(location.hash || ""));
  window.clearTimeout = function (id) { cleared = true; Promise.resolve().then(() => { cleared = false; }); return CT.call(window, id); };
  window.setTimeout = function (fn, ms, ...rest) {
    if (cleared && ready() && typeof fn === "function" && typeof ms === "number" && ms >= 100 && ms <= 500) ms = 40;
    cleared = false;
    return ST.call(window, fn, ms, ...rest);
  };
})();
/* Many modules end with "if the Brief (or Flights, Maps...) page is open, redraw it", so opening the app
   straight onto a page redrew it about fifty times while the script loaded. Redraw requests made while
   the app script is still loading are merged into one redraw right after it finishes. */
(function () {
  if (typeof go !== "function") return;
  const G = go;
  let boot = true, pending = false;
  window.go = function () {
    if (boot) { pending = true; return; }
    return G.apply(this, arguments);
  };
  setTimeout.call(window, () => { boot = false; if (pending) { pending = false; G(); } }, 0);
})();
