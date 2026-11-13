"use strict";
/* p251: see the weather for yourself (November 12, 2026). Two public FAA and NWS tools a pilot should look at
   before a VFR flight, especially over high ground, now sit in the brief (#wcPanel, after #rtPanel) and on
   airport pages:
   1. FAA weather cameras (weathercams.faa.gov): live camera images at airports, mountain passes and coasts,
      refreshed about every 10 minutes. The FAA is adding cameras and camera plus weather sites through 2031.
      The FAA site needs its own sign in for data, so Vigilyn links to it rather than showing the images.
   2. The Aviation Weather Center's Graphical Forecasts for Aviation, with a note on its low altitude mode
      (the helicopter toggle under the altitude slider), which is put first for helicopters.
   The panel says plainly that both are links to outside sites. Both are also in the airport page's list of
   publications (p139, small noted edit). */
(function () {
  const CAMS = "https://weathercams.faa.gov/map", GFA = "https://aviationweather.gov/gfa/";
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #wcPanel .wc-r{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:6px}
    #wcPanel a.wc-c{display:block;border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:10px 12px;text-decoration:none;color:inherit}
    #wcPanel a.wc-c:hover{border-color:currentColor}
    #wcPanel a.wc-c b{display:block;margin-bottom:3px}
    #wcPanel a.wc-c span{font-size:13.5px;opacity:.88;line-height:1.45}`;
  document.head.appendChild(css);
  const HELO = /^(UH|AH|CH|MH|HH|SH|TH|OH|VH)-?\d|^(R22|R44|R66|EC\d|H1\d\d|AS3|B06|B407|B429|S76|S92|A109|A119|AW1)/i;
  function isHelo(f) {
    let a = null; try { a = (allAircraft() || {})[f.tail] || null; } catch (e) {}
    const t = String((a && (a.typeCode || a.model)) || f.tail || "");
    return HELO.test(t.replace(/\s+/g, ""));
  }
  function cards(helo) {
    const cam = `<a class="wc-c" href="${CAMS}" target="_blank" rel="noopener"><b>FAA weather cameras</b><span>Live images at airports, mountain passes and coasts along your route, updated about every 10 minutes. Look before you commit to a VFR flight over high ground.</span></a>`;
    const gfa = `<a class="wc-c" href="${GFA}" target="_blank" rel="noopener"><b>Graphical forecasts${helo ? ", low altitude" : ""}</b><span>Ceilings, visibility, clouds and icing from the Aviation Weather Center. ${helo ? "For low level flights turn on low altitude mode with the helicopter toggle under the altitude slider." : "Low altitude mode (the helicopter toggle under the altitude slider) shows the levels you will fly at low level."}</span></a>`;
    return helo ? gfa + cam : cam + gfa;
  }
  const H2 = "<h2>See the weather yourself</h2>";
  let busy = false, t = 0;
  function apply() {
    if (busy) return; busy = true;
    try {
      const hash = location.hash || "", page = document.querySelector("#view .page"); if (!page) return;
      if (/^#\/brief(\/|$|\?)/.test(hash)) {
        let f = null; try { f = currentFlight(); } catch (e) {}
        if (!f || !page.querySelector("#bfBluf")) return;
        let sec = page.querySelector(":scope > #wcPanel");
        const helo = isHelo(f), key = `${f.id}|${f.tail}|${helo}`;
        if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "wcPanel"; }
        const anchor = page.querySelector(":scope > #rtPanel") || page.querySelector(":scope > #fsPanel") || page.querySelector(":scope > #kiPanel");
        if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
        if (sec.dataset.k !== key) { sec.dataset.k = key; sec.innerHTML = `${H2}<div class="wc-r">${cards(helo)}</div><p class="small muted" style="margin:8px 0 0">Both open public FAA and NWS sites in a new tab. Camera coverage is growing but still has gaps.</p>`; }
      }
    } catch (e) { console.error(e); } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 500); };
  new MutationObserver((l) => { if (busy || l.every((m) => m.target.closest && m.target.closest("#wcPanel"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick); kick();
  window.AeroWeatherEyes = { isHelo };
})();
