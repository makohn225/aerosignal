"use strict";
/* p100: on the Flights page, the Departure and arrival procedures panel and the Preferred IFR routes
   panel start folded for VFR flights that use no SID or STAR, and for routes that do not start and end
   at airports. They open as usual with their Show switch, and stay open for IFR flights. */
(function () {
  let t = 0, busy = false;
  const done = new Set();
  function apply() {
    if (busy || !/^#\/flights(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || !window.AeroPanels) return;
    busy = true;
    try {
      const pts = f.points || [];
      const apts = pts.length >= 2 && pts[0].kind === "airport" && pts[pts.length - 1].kind === "airport";
      const proc = /(^|\s)[A-Z]{3,5}\d[A-Z]?(\.[A-Z0-9]{2,5})?(\s|$)/.test(String(f.route || "").toUpperCase()) && pts.some((p) => p.proc);
      const fold = f.rules !== "IFR" && !proc || !apts;
      for (const id of ["procPanel", "prPanel"]) {
        const s = page.querySelector("#" + id);
        if (!s) continue;
        const key = `${f.id}|${id}|${f.rules}|${apts}|${proc}`;
        if (done.has(key)) continue;
        if (!s.querySelector(":scope > h2")) continue;
        done.add(key);
        if (fold && !s.classList.contains("pnl-min")) AeroPanels.setMin(s, true, false);
        if (!fold && s.classList.contains("pnl-min") && f.rules === "IFR") AeroPanels.setMin(s, false, false);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 400); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { done.clear(); kick(); });
  kick();
})();
