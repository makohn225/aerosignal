"use strict";
/* p139: pilot feedback, October 28, 2026.
   Plates: the full size plate viewer no longer zooms or drags the map behind it (it sat inside the
   full screen map, so the mouse wheel reached the map instead of scrolling the plate). An approach
   opened full size gets an On map button, and the Plates panel says which charts carry the FAA
   georeference (approaches do; airport diagrams, departures and arrivals open full size only).
   Corridors: Hide route corridors in the map Tools menu and in the Plates panel hides the ESA and
   training route corridor outlines so a plate or the chart underneath reads cleanly (S.corrHide).
   Airports: each airport page lists its FAA charts (open full size, or put an approach on the map),
   its current NOTAMs in plain words with the FAA text, radio frequencies, and links to the public
   FAA publications (Chart Supplement, terminal procedures, AIM, NOTAM search, TFRs, weather, 14 CFR).
   Home: the AeroSignal logo goes back to the start: the Plan page with the Start here card
   (tutorial and demo), even after that card was hidden.
   Narration: device voices say FAA as three letters (F A A) instead of a word. Recorded lines are left as recorded. */
(function () {
  const h = (s) => (typeof esc === "function" ? esc(s) : String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])));
  const css = document.createElement("style");
  css.textContent = `
    .pl-view .pl-onmap{border-color:#3DE0FF!important;color:#3DE0FF!important}
    .pl-panel .pl-geo{font-size:12px;color:#9fb6c9;margin:6px 0 2px;line-height:1.4}
    .pl-panel .pl-corr{display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0 8px;cursor:pointer}
    .pl-panel .pl-corr input{width:18px;height:18px;min-height:0}
    .ap139 .ap-sec{font-size:11px;letter-spacing:.08em;color:var(--ink2,#9fb0c8);margin:12px 0 4px;text-transform:uppercase}
    .ap139 .ap-row{display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    .ap139 .ap-row span{flex:1;min-width:0;overflow-wrap:anywhere}
    .ap139 .ap-row button{flex:none;min-height:36px;padding:0 12px}
    .ap139 ul.nt{list-style:none;margin:0;padding:0}
    .ap139 ul.nt li{padding:9px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    .ap139 ul.nt li:first-child{border-top:0}
    .ap139 .tg{display:inline-block;font:700 10.5px var(--mono,monospace);letter-spacing:.5px;padding:1px 7px;border-radius:999px;border:1px solid currentColor;margin-right:6px;vertical-align:1px}
    .ap139 .r1 .tg{color:#ff4d6a}.ap139 .r2 .tg{color:#ffb648}.ap139 .r3 .tg{color:var(--ink2,#9fb0c8)}
    .ap139 .pl{font-size:14.5px;line-height:1.45}
    .ap139 .wh{display:block;font-size:12px;color:var(--ink2,#9fb0c8);margin-top:2px}
    .ap139 pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;margin:4px 0 0}
    .ap139 .warn{color:#ff4d6a;font-weight:700;font-size:13px;margin:10px 0 0}
    .ap139 table{border-collapse:collapse}
    .ap139 td{padding:4px 14px 4px 0;font-size:14px}
    .ap139 td.f{font-family:var(--mono,monospace);font-weight:700}
    .ap139 ul.pubs{margin:4px 0 0;padding-left:18px;line-height:1.7}
    body.as-home.tut-retired #asWelcome{display:block!important}
    @media (max-width:430px){.pl-view .pl-vbar{gap:5px;padding-left:8px;padding-right:8px}.pl-view .pl-vbar button{padding:0 8px;min-width:38px}}
  `;
  document.head.appendChild(css);

  /* 1. Plate viewer: keep the mouse wheel, drags and taps inside it */
  const isMapPage = () => /^#\/(maps|missions\/[^/]+\/brief)/.test(location.hash || "") && typeof leafletMap !== "undefined" && !!leafletMap;
  function fixViewer(v) {
    if (!v || v._p139) return;
    v._p139 = true;
    try { if (typeof L !== "undefined") { L.DomEvent.disableScrollPropagation(v); L.DomEvent.disableClickPropagation(v); } } catch {}
    for (const t of ["wheel", "mousewheel", "pointerdown", "pointerup", "pointermove", "mousedown", "mouseup", "mousemove", "touchstart", "touchmove", "touchend", "dblclick", "contextmenu"]) v.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
    // An approach opened full size can go straight onto the map
    try {
      const b = v.querySelector(".pl-vbar b"), bar = v.querySelector(".pl-vbar"), close = v.querySelector(".pl-vx");
      if (!b || !bar || !close || !window.AeroPlates || !isMapPage()) return;
      const txt = b.textContent.trim(), sp = txt.indexOf(" "), apt = txt.slice(0, sp), name = txt.slice(sp + 1);
      AeroPlates.getList(apt).then((d) => {
        const ch = (d.charts || []).find((c) => c.name === name && c.code === "IAP");
        if (!ch || !v.isConnected) return;
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "pl-onmap"; btn.textContent = "On map";
        btn.title = "Lay this approach over the map with the FAA georeference";
        btn.onclick = async () => {
          btn.disabled = true; btn.textContent = "Placing";
          try { const pl = await AeroPlates.overlay(leafletMap, ch); pl.apt = d.apt; close.click(); toast(`${d.apt} ${ch.name} on the map`); }
          catch (e) { btn.disabled = false; btn.textContent = "On map"; toast(e.message || "Could not place the plate"); }
        };
        bar.insertBefore(btn, close);
      }).catch(() => {});
    } catch {}
  }

  /* 2. Route corridors: hide or show the ESA and training route corridor outlines */
  const isCorr = (l) => {
    if (typeof L === "undefined" || !(l instanceof L.Path) || !l.options || l.options.interactive !== false) return false;
    const o = l.options;
    if (o.dashArray === "6 6" && o.color === "#3DE0FF" && (l instanceof L.Polygon || l instanceof L.Circle)) return true; // ESA corridor (p6)
    if (l instanceof L.Polygon && o.weight === 0.8 && o.fillOpacity === 0.1) return true; // training route corridors (p6)
    return false;
  };
  const hidden = () => !!(typeof S !== "undefined" && S.corrHide);
  function styleCorr(l, hide) {
    if (hide) { if (!l._p139st) l._p139st = { opacity: l.options.opacity, fillOpacity: l.options.fillOpacity }; l.setStyle({ opacity: 0, fillOpacity: 0 }); }
    else if (l._p139st) { l.setStyle(l._p139st); l._p139st = null; }
  }
  function applyCorr(map) { try { map.eachLayer((l) => { if (isCorr(l)) styleCorr(l, hidden()); }); } catch {} }
  function setCorr(map, hide) {
    S.corrHide = !!hide; try { save(); } catch {}
    applyCorr(map);
    document.querySelectorAll(".pl-corr input").forEach((i) => (i.checked = !!hide));
  }
  if (typeof L !== "undefined") {
    L.Map.addInitHook(function () {
      this.on("layeradd", (e) => { if (hidden() && isCorr(e.layer)) styleCorr(e.layer, true); });
    });
  }
  const prev = window.AeroMapTools;
  window.AeroMapTools = {
    items: (map) => [...(prev ? prev.items(map) : []), ["corr", hidden() ? "Show route corridors" : "Hide route corridors", hidden() ? "Corridors are hidden" : "ESA and training route outlines"]],
    run: (t, map) => {
      if (t === "corr") { setCorr(map, !hidden()); toast(hidden() ? "Route corridors hidden. Tools brings them back." : "Route corridors shown"); return; }
      if (prev) prev.run(t, map);
    },
  };

  /* Plates panel: georeference note and the corridor switch */
  function fixPanel(pn) {
    if (!pn || typeof leafletMap === "undefined" || !leafletMap) return;
    const list = pn.querySelector(".pl-list");
    if (list && !pn.querySelector(".pl-geo")) {
      const n = document.createElement("p");
      n.className = "pl-geo";
      n.textContent = "Approaches carry the FAA georeference: tap On map to lay one over the chart. Airport diagrams, departures and arrivals have none, so they open full size.";
      list.before(n);
    }
    if (!pn.querySelector(".pl-corr")) {
      const lab = document.createElement("label");
      lab.className = "pl-corr";
      lab.innerHTML = `<input type="checkbox"${hidden() ? " checked" : ""}> Hide route corridors`;
      const apts = pn.querySelector(".pl-apts");
      if (apts) apts.before(lab); else pn.appendChild(lab);
      lab.querySelector("input").onchange = (e) => setCorr(leafletMap, e.target.checked);
    }
  }

  /* 3. Airport page: charts, NOTAMs, frequencies and publications */
  const PUBS = [
    ["Chart Supplement (search by airport)", "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/search/"],
    ["Terminal procedures publication", "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/"],
    ["Aeronautical Information Manual", "https://www.faa.gov/air_traffic/publications/atpubs/aim/index.htm"],
    ["NOTAM Search", "https://notams.aim.faa.gov/notamSearch/"],
    ["Temporary flight restrictions", "https://tfr.faa.gov/"],
    ["Aviation Weather Center", "https://aviationweather.gov/"],
    ["14 CFR (Federal Aviation Regulations)", "https://www.ecfr.gov/current/title-14"],
  ];
  const GROUPS = [["IAP", "Approaches"], ["APD", "Airport diagram"], ["DP", "Departures"], ["STAR", "Arrivals"], ["MIN", "Minimums"], ["HOT", "Hot spots"], ["LAH", "Land and hold short"]];
  const FLABEL = { TWR: "Tower", GND: "Ground", CTAF: "CTAF", UNIC: "UNICOM", UNICOM: "UNICOM", ATIS: "ATIS", AWOS: "AWOS", ASOS: "ASOS", APP: "Approach", DEP: "Departure", CLD: "Clearance", CD: "Clearance", "A/D": "Approach and departure", FSS: "Flight service", RDO: "Radio", MULT: "Multicom" };
  const ntT = (s) => { const m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d)(\d\d)/.exec(s || ""); return m ? Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]) : null; };
  const ntFmt = (ms) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const KW = { RWY: "Runway", TWY: "Taxiway", APRON: "Apron", AD: "Airport", OBST: "Obstacle", NAV: "Navaid", COM: "Radio", SVC: "Services", AIRSPACE: "Airspace", IAP: "Approach", SID: "Departure", STAR: "Arrival", ODP: "Departure" };

  async function charts(sec, id) {
    const box = sec.querySelector(".ap-body");
    if (!window.AeroPlates) { box.innerHTML = `<p class="small muted">Charts are not available right now.</p>`; return; }
    let d;
    try { d = await AeroPlates.getList(id); } catch (e) { box.innerHTML = `<p class="small muted">Could not reach the FAA charts right now.</p>`; return; }
    if (!sec.isConnected) return;
    if (!d.charts || !d.charts.length) { box.innerHTML = `<p class="small muted">No FAA terminal charts for ${h(id)} in cycle ${h(d.cycle || "")}. Military only fields publish theirs in DoD FLIP, which is not included.</p>`; return; }
    box.innerHTML = `<p class="small muted" style="margin:0">FAA cycle ${h(d.cycle)}, effective ${h(d.effective)}. Approaches can go on the map, lined up with the FAA georeference.</p>` +
      GROUPS.map(([c, nm]) => { const a = d.charts.filter((x) => x.code === c); return a.length ? `<div class="ap-sec">${nm}</div>` + a.map((x) => `<div class="ap-row"><span>${h(x.name)}</span>${c === "IAP" ? `<button type="button" class="btn sm sec" data-ov="${h(x.pdf)}">On map</button>` : ""}<button type="button" class="btn sm sec" data-v="${h(x.pdf)}">Open</button></div>`).join("") : ""; }).join("") +
      `<p class="warn">FAA charts shown for planning only. Confirm you have the current chart and check NOTAMs before flight.</p>`;
    const find = (pdf) => d.charts.find((x) => x.pdf === pdf);
    box.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => AeroPlates.view(find(b.dataset.v), d.apt)));
    box.querySelectorAll("[data-ov]").forEach((b) => (b.onclick = () => { pending = { apt: d.apt, chart: find(b.dataset.ov), at: Date.now() }; S.plateApt = d.apt; try { save(); } catch {} location.hash = "#/maps"; }));
  }
  async function notams(sec, id) {
    const box = sec.querySelector(".ap-body");
    let data;
    try { data = await fnGet("notams?ids=" + encodeURIComponent(id)); } catch { box.innerHTML = `<p class="small muted">Could not load NOTAMs right now. <a href="https://notams.aim.faa.gov/notamSearch/" target="_blank" rel="noopener">Open FAA NOTAM Search</a></p>`; return; }
    if (!sec.isConnected) return;
    const N = window.AeroNotams || {}, now = Date.now();
    const rows = ((data && data.notams && data.notams[id]) || []).map((n) => ({ ...n, s: ntT(n.start), e: /PERM/.test(n.end || "") ? Infinity : ntT(n.end), r: N.rank ? N.rank(n, true) : 3 }))
      .filter((n) => !(n.e != null && n.e < now)).sort((a, b) => a.r - b.r);
    const item = (n) => `<li class="r${n.r}"><span class="tg">${h(KW[String(n.kw || "").toUpperCase()] || n.kw || "NOTAM")}</span><span class="pl">${h(N.plain ? N.plain(n.text) : n.text)}</span><span class="wh">${n.s && n.s > now ? `From ${h(ntFmt(n.s))}. ` : ""}${n.e === Infinity ? "Permanent" : n.e ? `Until ${h(ntFmt(n.e))}` : ""}${n.num ? ` · NOTAM ${h(n.num)}` : ""}</span><details><summary>FAA text</summary><pre>${h(n.text)}</pre></details></li>`;
    const first = rows.filter((n) => n.r === 1), rest = rows.filter((n) => n.r > 1);
    box.innerHTML = (rows.length ? `<p class="small muted" style="margin:0 0 6px">${rows.length} NOTAMs in effect now or later for ${h(id)}.${first.length ? ` <b style="color:#ff4d6a">${first.length} to read first.</b>` : ""}</p>` : `<p class="small muted" style="margin:0">No current NOTAMs for ${h(id)}.</p>`) +
      (first.length ? `<ul class="nt">${first.map(item).join("")}</ul>` : "") +
      (rest.length ? `<details${first.length ? "" : " open"}><summary>${rest.length} more</summary><ul class="nt">${rest.map(item).join("")}</ul></details>` : "") +
      `<p class="warn">The plain words are a reading aid only. The FAA NOTAM text governs. Always get a full briefing from Flight Service before you fly.</p>`;
  }
  async function freqs(sec, id) {
    const box = sec.querySelector(".ap-body");
    let rows = null;
    try { const d = await fnGet(`freq?ids=${encodeURIComponent(id)}`); rows = (d && d.rows && d.rows[id]) || []; } catch {}
    if (!sec.isConnected) return;
    if (rows == null) { box.innerHTML = `<p class="small muted">Frequencies could not load. Check the Chart Supplement.</p>`; return; }
    if (!rows.length) { box.innerHTML = `<p class="small muted">No frequencies on file. Check the Chart Supplement.</p>`; return; }
    const r = rows.filter((x, i, a) => a.findIndex((y) => y.type === x.type && y.mhz === x.mhz) === i).slice(0, 14);
    box.innerHTML = `<table>${r.map((x) => `<tr><td>${h(FLABEL[String(x.type).toUpperCase()] || (x.desc && x.desc.length < 30 ? x.desc : x.type))}</td><td class="f">${h(Number(x.mhz).toFixed(3).replace(/0$/, ""))}</td></tr>`).join("")}</table><p class="small muted" style="margin:6px 0 0">Source: OurAirports community data. Confirm in the Chart Supplement.</p>`;
  }
  function airportPage() {
    const m = (location.hash || "").match(/^#\/airports\/([^/?#]+)/);
    if (!m) return;
    const id = decodeURIComponent(m[1]).toUpperCase();
    const rw = document.getElementById("arw");
    const anchor = rw && rw.closest("section");
    if (!anchor || document.getElementById("apCharts")) return;
    const mk = (idn, title, body) => { const s = document.createElement("section"); s.className = "panel ap139"; s.id = idn; s.innerHTML = `<h2>${title}</h2><div class="ap-body">${body}</div>`; return s; };
    const sC = mk("apCharts", "Charts and procedures", `<p class="small muted">Loading FAA charts</p>`);
    const sN = mk("apNotams", "NOTAMs", `<p class="small muted">Loading NOTAMs</p>`);
    const sF = mk("apFreq", "Frequencies", `<p class="small muted">Loading frequencies</p>`);
    const sP = mk("apPubs", "Chart Supplement and publications", `<p class="small muted" style="margin:0">Official FAA sources. In the Chart Supplement search, enter ${h(id)}.</p><ul class="pubs">${PUBS.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${h(t)}</a></li>`).join("")}</ul>`);
    anchor.after(sC, sN, sF, sP);
    charts(sC, id); notams(sN, id); freqs(sF, id);
  }

  /* An approach chosen on the airport page goes onto the map once it is ready */
  let pending = null;
  function placePending() {
    if (!pending || !/^#\/maps/.test(location.hash || "")) return;
    if (Date.now() - pending.at > 30000) { pending = null; return; }
    if (typeof leafletMap === "undefined" || !leafletMap || !leafletMap._loaded || !window.AeroPlates) { setTimeout(placePending, 500); return; }
    const p = pending; pending = null;
    setTimeout(() => {
      AeroPlates.overlay(leafletMap, p.chart).then((pl) => { pl.apt = p.apt; toast(`${p.apt} ${p.chart.name} on the map`); }).catch((e) => toast(e.message || "Could not place the plate"));
    }, 1200);
  }

  /* 4. The logo goes home: the Plan page with the Start here card */
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest(".topbar .brand");
    if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    S.welcomeDismissed = false; try { save(); } catch {}
    document.body.classList.add("as-home");
    if (!/^#\/plan\/?$/.test(location.hash || "")) location.hash = "#/plan";
    else { try { go(); } catch {} setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 30); }
    setTimeout(() => window.scrollTo(0, 0), 60);
  }, true);
  window.addEventListener("hashchange", () => { if (!/^#\/plan\/?$/.test(location.hash || "")) document.body.classList.remove("as-home"); });
  function brandTitle() { const b = document.querySelector(".topbar .brand"); if (b && !b.title) { b.title = "Home"; b.setAttribute("aria-label", "AeroSignal home"); } }

  /* 5. Device voices: FAA as three letters */
  try {
    const Native = window.SpeechSynthesisUtterance;
    if (Native && !Native._p139) {
      const fix = (t) => String(t).replace(/\bFAA(?=\b|['\u2019]s\b)/g, "F A A");
      const recorded = (t) => { try { return !!(window.AeroNarration && AeroNarration.status() !== false && AeroNarration.lookup(t)); } catch { return false; } };
      class Utt extends Native {
        constructor(...a) { if (a.length && typeof a[0] === "string" && /\bFAA/.test(a[0]) && !recorded(a[0])) a[0] = fix(a[0]); super(...a); }
      }
      Utt._p139 = true;
      window.SpeechSynthesisUtterance = Utt;
      window.AeroSay = { fix };
    }
  } catch (e) { console.error(e); }

  /* Watchers */
  let busy = false, tm = 0;
  function apply() {
    if (busy) return; busy = true;
    try {
      document.querySelectorAll(".pl-view").forEach(fixViewer);
      document.querySelectorAll(".pl-panel").forEach(fixPanel);
      airportPage();
      brandTitle();
    } catch (e) { console.error(e); } finally { busy = false; }
  }
  new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(apply, 60); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(placePending, 300));
  setTimeout(apply, 300);
})();
