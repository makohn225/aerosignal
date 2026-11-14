"use strict";
/* p262: faster brief on a weak signal (November 14, 2026). While a pilot is on Plan or Maps with a route ready,
   the slowest reference lookups the brief needs (the accident matches for the flight, diversion airports and
   airspace) start quietly in the background after a short pause. p250 keeps those answers for 30 minutes, so
   opening the brief afterwards uses them instead of waiting on the network. Skipped when the phone asks to save
   data, on a 2G connection, for missions, and more than once per route in 25 minutes. Nothing is shown and
   nothing is saved; this only starts requests the brief would make anyway.
   Part of the same speed pass: the map library now comes from this site inside the app bundle (index.html,
   build.mjs, sw.js), and p54's recordings check waits until after start up. */
(function () {
  const done = new Map();
  const slow = () => { try { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""))); } catch (e) { return false; } };
  function sig(f) { return [f.id, f.route, f.date, f.time, f.tail, f.rules, (f.points || []).map((p) => p.ident).join(" ")].join("|"); }
  function warm() {
    if (!/^#\/(plan|maps|flights)(\/|$|\?)/.test(location.hash || "") || slow() || document.hidden) return;
    let f = null; try { f = currentFlight(); } catch (e) { return; }
    if (!f || f.missionId || (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon)).length < 2) return;
    const k = sig(f), at = done.get(k);
    if (at && Date.now() - at < 25 * 60000) return;
    done.set(k, Date.now());
    try { if (typeof buildBrief === "function" && typeof profile === "function") buildBrief(profile(f)).catch(() => {}); } catch (e) {}
    try { if (window.AeroDivert && AeroDivert.load) Promise.resolve(AeroDivert.load(f)).catch(() => {}); } catch (e) {}
    try { if (window.AeroAirspace && AeroAirspace.load) Promise.resolve(AeroAirspace.load(f)).catch(() => {}); } catch (e) {}
  }
  let t = 0;
  // One pending run at a time (pages that redraw often must not keep pushing it back)
  const kick = () => { if (t) return; t = setTimeout(() => { const go = () => { t = 0; warm(); }; window.requestIdleCallback ? requestIdleCallback(go, { timeout: 1000 }) : go(); }, 1200); };
  window.addEventListener("hashchange", kick);
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  setInterval(kick, 15000);
  kick();
  window.AeroBriefWarm = { warm, done };
})();
