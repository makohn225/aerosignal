"use strict";
/* p133: privacy page wording for the phone and tablet apps (native/), approved by the owner on
   October 22, 2026. Adds one paragraph after the flight alerts paragraph (p122), or after the account
   sync paragraph if that is missing. The Last updated date is already October 22, 2026 (p122).
   Nothing else in the policy changes. */
(function () {
  const TEXT = "In the phone and tablet apps, your location is used on the device to show your aircraft and record your track, and the local network is used only to receive data from a portable ADS-B receiver. Neither is sent to AeroSignal, except a recorded track synced with your flight when you turn on account sync.";
  function apply() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const view = document.getElementById("view");
    if (!view || view.querySelector("#pvNative")) return;
    const anchor = view.querySelector("#pvAlerts") || view.querySelector("#pvSync");
    if (!anchor) return;
    const p = document.createElement("p"); p.id = "pvNative"; p.textContent = TEXT;
    anchor.after(p);
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 200); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
