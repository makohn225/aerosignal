"use strict";
/* p68: four improvements.
   1. A pre departure checklist at the end of the flight brief. Seven go or no go items; ticking
      them records that the pilot reviewed everything, with the time. Saved with the flight.
   2. Maps on phones: the mishap list is a sheet with a drag handle. Slide it up to read, down to
      see the chart; it snaps to three heights.
   3. The bottom line card on the brief gets a one line weather summary for departure and arrival,
      with the flight category worked out from the loaded reports.
   4. The Logbook page explains how to export from ForeFlight, Garmin Pilot, MyFlightbook and LogTen. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #goPanel .gl{list-style:none;margin:8px 0 0;padding:0}
    #goPanel .gl li{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #goPanel .gl li:first-child{border-top:0}
    #goPanel .gl input{width:20px;height:20px;margin:1px 0 0;flex:none;accent-color:#3DE0FF}
    #goPanel .gl label{font:400 14.5px/1.4 var(--body,inherit);text-transform:none;letter-spacing:normal;color:var(--ink,#EAF2FF);cursor:pointer;margin:0}
    #goPanel .gl .hint{display:block;font-size:12.5px;text-transform:none;letter-spacing:normal;color:var(--ink2,#9fb0c8)}
    #goPanel .gl .auto{display:inline-block;margin-left:6px;font:700 10px var(--mono,monospace);color:#46e39b;border:1px solid rgba(70,227,155,.5);border-radius:999px;padding:0 6px}
    #goPanel .gbar{height:6px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:8px}
    #goPanel .gbar i{display:block;height:100%;background:#3DE0FF;transition:width .25s}
    #goPanel .gst{font-size:13.5px;margin-top:8px;color:var(--ink2,#9fb0c8)}
    #goPanel.ready .gbar i{background:#46e39b}
    #goPanel.ready .gst{color:#46e39b;font-weight:700}
    #bfBluf .bf-wx{margin:8px 0 2px;font-size:13.5px;line-height:1.45;color:var(--ink,#EAF2FF)}
    #bfBluf .bf-wx b{font:700 11px var(--mono,monospace);padding:1px 6px;border-radius:999px;border:1px solid currentColor;margin:0 2px}
    #bfBluf .bf-wx .VFR{color:#46e39b}#bfBluf .bf-wx .MVFR{color:#5aa9ff}#bfBluf .bf-wx .IFR{color:#ff4d6a}#bfBluf .bf-wx .LIFR{color:#e05cff}
    #bfBluf .bf-wx .mut{color:var(--ink2,#9fb0c8)}
    .sheetgrip{display:none}
    @media (max-width:860px){
      .mapwrap.split:not(.collapsed) .sheetgrip{display:flex;flex:none;position:sticky;top:0;z-index:5;justify-content:center;align-items:center;height:22px;margin:0 0 -4px;cursor:grab;touch-action:none;background:rgba(6,12,24,.96)}
      .sheetgrip i{width:44px;height:5px;border-radius:5px;background:rgba(255,255,255,.35)}
      .mapwrap.split.sheet-drag{transition:none!important}
      .mapwrap.split .hzpanel .mtabs{top:22px}
    }
    #lbHow{margin-top:12px}
    #lbHow summary{cursor:pointer;font-size:14px;color:#3DE0FF}
    #lbHow .tabsx{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 8px}
    #lbHow .tabsx button{appearance:none;font:inherit;font-size:13px;padding:5px 11px;border-radius:999px;border:1px solid var(--line2,rgba(255,255,255,.18));background:transparent;color:var(--ink,#EAF2FF);cursor:pointer}
    #lbHow .tabsx button.on{border-color:#3DE0FF;color:#3DE0FF;background:rgba(61,224,255,.08)}
    #lbHow ol{margin:4px 0 6px 18px;padding:0;font-size:14px;line-height:1.55}
    #lbHow .nt{font-size:12.5px;color:var(--ink2,#9fb0c8);margin:4px 0 0}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const on = (re) => re.test(location.hash || "");
  const flight = () => { try { const f = currentFlight(); return f && (f.points || []).length ? f : null; } catch { return null; } };

  /* 1. Pre departure checklist */
  const ITEMS = [
    ["wx", "Weather and forecasts reviewed", "Get a standard briefing from Flight Service (1800wxbrief.com) or your usual provider."],
    ["notam", "NOTAMs and TFRs checked", "Departure, destination, alternates and the route."],
    ["frat", "Risk assessment done and signed", "Score the flight and write down how you will reduce the risk."],
    ["cur", "Pilot current and fit to fly", "Flight review, medical, passenger and instrument currency. IMSAFE."],
    ["acft", "Aircraft airworthy, weight and balance done", "Inspections current, squawks cleared, takeoff and landing performance checked."],
    ["fuel", "Fuel planned with a reserve, alternate picked", "Know where you will go if the destination goes down."],
    ["pax", "Passengers briefed", "Belts, doors, sterile cockpit, what to do in an emergency."],
  ];
  function signed(f) { try { return (S.frats || []).some((r) => r.flightId === f.id); } catch { return false; } }
  function goPanel(page, f) {
    if (f.missionId) return;
    let sec = page.querySelector("#goPanel");
    if (sec) return;
    sec = document.createElement("section");
    sec.className = "panel"; sec.id = "goPanel";
    const g = (f.go = f.go || {});
    const draw = () => {
      if (signed(f) && g.frat === undefined) g.frat = true;
      const n = ITEMS.filter(([k]) => g[k]).length, all = n === ITEMS.length;
      sec.classList.toggle("ready", all);
      sec.innerHTML = `<h2>Before you go</h2>
        <p class="small muted" style="margin:0">Your go or no go check. Tick each item once you have done it.</p>
        <ul class="gl">${ITEMS.map(([k, t, hint]) => `<li><input type="checkbox" id="go_${k}" data-k="${k}" ${g[k] ? "checked" : ""}><label for="go_${k}">${h(t)}${k === "frat" && signed(f) ? '<span class="auto">SIGNED</span>' : ""}<span class="hint">${h(hint)}</span></label></li>`).join("")}</ul>
        <div class="gbar"><i style="width:${Math.round((n / ITEMS.length) * 100)}%"></i></div>
        <div class="gst">${all ? `Ready to go. Reviewed ${g.at ? new Date(g.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "just now"}.` : `${n} of ${ITEMS.length} done.`}</div>`;
      sec.querySelectorAll("input[data-k]").forEach((i) => (i.onchange = () => {
        g[i.dataset.k] = i.checked;
        g.at = ITEMS.every(([k]) => g[k]) ? Date.now() : null;
        f.updated = Date.now();
        try { save(); } catch {}
        draw();
      }));
    };
    draw();
    const anchor = page.querySelector(":scope > #dbPanel") || page.querySelector(":scope > #bbody");
    if (anchor) anchor.after(sec); else page.appendChild(sec);
  }

  // A Checklist chip in the section row at the top of the brief
  function chip(page) {
    const j = page.querySelector("#bfJump");
    if (j && document.getElementById("goPanel") && !j.querySelector('[data-s="#goPanel"]')) {
      const a = document.createElement("a");
      a.href = "#"; a.dataset.s = "#goPanel"; a.textContent = "Checklist";
      a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("goPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
      j.insertBefore(a, j.firstChild ? j.children[1] || null : null);
    }
  }

  /* 3. Weather line in the bottom line card */
  function cat(w) {
    if (!w) return "";
    if (w.cat) return w.cat;
    const c = w.ceiling == null ? 99999 : w.ceiling, v = w.vis == null ? 99 : w.vis;
    if (c < 500 || v < 1) return "LIFR";
    if (c < 1000 || v < 3) return "IFR";
    if (c <= 3000 || v <= 5) return "MVFR";
    return "VFR";
  }
  function wxLine(f) {
    let p = null;
    try { p = profile(f); } catch {}
    if (!p || !p.wx || !p.wx.has) {
      const t = new Date(`${f.date}T${f.time || "12:00"}:00`), hrs = (t - Date.now()) / 36e5;
      return hrs >= 30 ? `<span class="mut">Weather loads here within 30 hours of departure.</span>` : `<span class="mut">No weather loaded yet. It loads automatically on this page; check your connection if it does not appear.</span>`;
    }
    const part = (name, w, id, src) => {
      if (!w) return `${h(name)} ${h(id)}: <span class="mut">no report</span>`;
      const k = cat(w), wind = w.wind != null ? `, wind ${w.wind}${w.gust ? "G" + w.gust : ""} kt` : "";
      return `${h(w.station || id)} <b class="${k}">${k}</b>${h(wind)}${src ? ` <span class="mut">(${src})</span>` : ""}`;
    };
    const dep = part("Departure", p.wx.dM, p.dep && p.dep.ident, "now");
    let arrW = p.wx.aM;
    if (p.wx.aT && (p.wx.aT.groups || []).length) {
      // The forecast group in effect when the flight arrives
      let at = p.arrLocal ? new Date(p.arrLocal) : null;
      if (!at || isNaN(at)) { const d = new Date(`${f.date}T${f.time || "12:00"}:00`); at = new Date(+d + (p.ete || 1) * 36e5); }
      const gs = p.wx.aT.groups.filter((g) => g.type !== "TEMPO" && g.type !== "PROB" && new Date(g.from) <= at);
      arrW = Object.assign({ station: p.wx.aT.station }, gs.length ? gs[gs.length - 1] : p.wx.aT.groups[0]);
    } else if (p.wx.aT) arrW = p.wx.aT;
    const arr = part("Arrival", arrW, p.dst && p.dst.ident, p.wx.aT && arrW !== p.wx.aM ? "forecast at arrival" : "now");
    return `Weather: ${dep}  ·  ${arr}`;
  }
  function wx(page, f) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    const html = wxLine(f);
    let el = card.querySelector(".bf-wx");
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-wx"; const k = card.querySelector(".k"); if (k) k.after(el); else card.prepend(el); }
    el.dataset.v = html; el.innerHTML = html;
  }

  /* 2. Map sheet with a drag handle on phones */
  const SNAP = [24, 54, 84];
  let sheetPct = null;
  function setSheet(wrap, pct, done) {
    wrap.style.setProperty("grid-template-rows", `minmax(0,1fr) ${pct}%`, "important");
    if (done) { try { if (typeof leafletMap !== "undefined" && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 60); } catch {} }
  }
  function sheet() {
    const wrap = document.getElementById("mwrap"), panel = document.getElementById("mctl");
    if (!wrap || !panel || panel.querySelector(".sheetgrip")) { if (wrap && sheetPct != null && matchMedia("(max-width:860px)").matches) setSheet(wrap, sheetPct, false); return; }
    const g = document.createElement("div");
    g.className = "sheetgrip"; g.setAttribute("role", "button"); g.setAttribute("aria-label", "Drag to resize the mishap list, or tap to change its size"); g.tabIndex = 0;
    g.innerHTML = "<i></i>";
    panel.prepend(g);
    if (sheetPct != null && matchMedia("(max-width:860px)").matches) setSheet(wrap, sheetPct, true);
    let y0 = 0, moved = false, startPct = 54, drag = false;
    const now = () => { const r = wrap.getBoundingClientRect(), p = panel.getBoundingClientRect(); return (p.height / r.height) * 100; };
    g.addEventListener("pointerdown", (e) => { y0 = e.clientY; moved = false; drag = true; startPct = now(); wrap.classList.add("sheet-drag"); try { g.setPointerCapture(e.pointerId); } catch {} });
    g.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const r = wrap.getBoundingClientRect(), d = ((y0 - e.clientY) / r.height) * 100;
      if (Math.abs(e.clientY - y0) > 4) moved = true;
      setSheet(wrap, Math.max(16, Math.min(90, startPct + d)), false);
    });
    const end = (e) => {
      if (!drag) return;
      drag = false;
      try { g.releasePointerCapture(e.pointerId); } catch {}
      wrap.classList.remove("sheet-drag");
      const cur = now();
      let to;
      if (!moved) { const i = SNAP.findIndex((s) => Math.abs(s - cur) < 8); to = SNAP[(i < 0 ? 1 : i + 1) % SNAP.length]; }
      else to = SNAP.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a));
      sheetPct = to; setSheet(wrap, to, true);
    };
    g.addEventListener("pointerup", end);
    g.addEventListener("pointercancel", end);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const i = SNAP.indexOf(sheetPct == null ? 54 : sheetPct); sheetPct = SNAP[(i + 1) % SNAP.length]; setSheet(wrap, sheetPct, true); } });
  }

  /* 4. Logbook export help */
  const HOW = {
    ForeFlight: { steps: ["Sign in to ForeFlight on the Web at plan.foreflight.com.", "Open Logbook.", "Pick the Export tab at the top of the page.", "Click Export to download the CSV file.", "Drop that file on the box above."] },
    "Garmin Pilot": { steps: ["Sign in at fly.garmin.com.", "Open the Logbook tab, then Setup.", "Choose Export to Spreadsheet to download a CSV file.", "Drop that file on the box above."], note: "If some columns do not come across, send feedback with the column names and we will add them." },
    MyFlightbook: { steps: ["Sign in at myflightbook.com.", "Open the Logbook menu and choose Download.", "Pick the CSV format.", "Drop that file on the box above."] },
    LogTen: { steps: ["On a Mac, open LogTen and go to the Reports menu.", "Choose Exporters, then Export Flights (Tab).", "Save the file, for example as logbook.txt.", "Drop that file on the box above."] },
    "Any spreadsheet": { steps: ["Save the sheet as a CSV file.", "Use a header row with names like Date, Aircraft, From, To, Total, Night, Actual Instrument, Landings and Remarks.", "Drop that file on the box above."] },
  };
  function lbHelp() {
    const drop = document.getElementById("drop");
    if (!drop || document.getElementById("lbHow")) return;
    const d = document.createElement("details");
    d.id = "lbHow";
    const names = Object.keys(HOW);
    d.innerHTML = `<summary>How to export your logbook from ForeFlight, Garmin Pilot, MyFlightbook or LogTen</summary>
      <div class="tabsx">${names.map((n, i) => `<button type="button" data-n="${h(n)}" class="${i ? "" : "on"}">${h(n)}</button>`).join("")}</div><div class="body"></div>`;
    const paint = (n) => {
      d.querySelectorAll(".tabsx button").forEach((b) => b.classList.toggle("on", b.dataset.n === n));
      const x = HOW[n];
      d.querySelector(".body").innerHTML = `<ol>${x.steps.map((s) => `<li>${h(s)}</li>`).join("")}</ol>${x.note ? `<p class="nt">${h(x.note)}</p>` : ""}<p class="nt">Your logbook stays in this browser. It is never uploaded.</p>`;
    };
    d.querySelectorAll(".tabsx button").forEach((b) => (b.onclick = () => paint(b.dataset.n)));
    paint(names[0]);
    drop.after(d);
  }

  let t = 0, busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      if (on(/^#\/brief(\/|$|\?)/)) {
        const page = document.querySelector("#view .page"), f = flight();
        if (page && f && page.querySelector(":scope > h1")) { goPanel(page, f); chip(page); wx(page, f); }
      }
      if (on(/^#\/maps/)) sheet();
      if (on(/^#\/logbook/)) lbHelp();
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 140); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
