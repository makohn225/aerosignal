"use strict";
/* p94: log the flight from its track. Once a track log is on the flight (p78), "Add to logbook" builds
   a logbook entry: date, departure and destination from the plan, route, total time from the track's
   first and last times, night time from the sun's position along the track (civil twilight, sun more
   than 6 degrees below the horizon), a full stop landing (night when the landing was at night), and
   cross country time when the destination is more than 50 nm from the departure. The pilot checks and
   edits the numbers before saving; it then appears in Logbook and its finder. */
(function () {
  const R = Math.PI / 180;
  const r1 = (n) => Math.round(n * 10) / 10;
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Solar elevation in degrees (NOAA approximation)
  function sunEl(ms, lat, lon) {
    const d = ms / 864e5 + 2440587.5 - 2451545.0;
    const g = (357.529 + 0.98560028 * d) * R, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * R;
    const e = (23.439 - 0.00000036 * d) * R;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
    const ha = ((gmst * 15 + lon) * R) - ra;
    return Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(ha)) / R;
  }
  function build(f) {
    const tr = f.track; if (!tr || !(tr.pts || []).length) return null;
    const pts = tr.pts, t0 = pts[0][3], t1 = pts[pts.length - 1][3];
    let total = null, night = 0;
    if (t0 && t1 && t1 > t0) {
      total = (t1 - t0) / 36e5;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (!a[3] || !b[3]) continue;
        const mid = (a[3] + b[3]) / 2;
        if (sunEl(mid, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) < -6) night += (b[3] - a[3]) / 36e5;
      }
    } else { try { total = (profile(f).ete || 0) / 60 || null; } catch {} }
    const ap = (f.points || []).filter((p) => p.kind === "airport");
    const from = (ap[0] || f.points[0] || {}).ident || "", to = (ap[ap.length - 1] || f.points[f.points.length - 1] || {}).ident || "";
    const a = ap[0], b = ap[ap.length - 1];
    const dist = a && b ? 60 * Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * R)) : 0;
    const end = pts[pts.length - 1];
    const ldgNight = end[3] ? sunEl(end[3], end[0], end[1]) < -6 : false;
    const date = t0 ? (() => { const d = new Date(t0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })() : f.date;
    const route = (f.points || []).slice(1, -1).map((p) => p.ident).filter(Boolean).join(" ");
    const T = total != null ? r1(total) : 0;
    return { date, tail: f.tail || "", from, to, route, total: T, pic: T, night: r1(Math.min(night, total || 0)), xc: dist > 50 ? T : 0, act: 0, sim: 0, dayLdg: ldgNight ? 0 : 1, nightLdg: ldgNight ? 1 : 0, allLdg: 1, appr: 0, holds: 0, dualGiven: 0, dualRcvd: 0, review: false, ipc: false, simulated: 0, remarks: `From AeroSignal track ${tr.name || ""}`.trim(), dist };
  }
  function dialog(f, e) {
    const d = document.createElement("div");
    d.id = "lfDlg";
    const F = [["date", "Date", "date"], ["tail", "Aircraft", "text"], ["from", "From", "text"], ["to", "To", "text"], ["route", "Route", "text"], ["total", "Total", "num"], ["pic", "PIC", "num"], ["xc", "Cross country", "num"], ["night", "Night", "num"], ["act", "Actual instrument", "num"], ["sim", "Simulated instrument", "num"], ["dayLdg", "Day landings full stop", "int"], ["nightLdg", "Night landings full stop", "int"], ["appr", "Approaches", "int"], ["dualRcvd", "Dual received", "num"]];
    d.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="Add to logbook"><h2 style="margin-top:0">Add this flight to your logbook</h2>
      <p class="small muted" style="margin-top:0">Worked out from the track log${e.dist ? `, ${Math.round(e.dist)} nm between airports` : ""}. Check every number before saving: night time uses civil twilight, and PIC, instrument and approach time need your input.</p>
      <div class="grid">${F.map(([k, l, t]) => `<label>${l}<input data-k="${k}" type="${t === "date" ? "date" : t === "text" ? "text" : "number"}" ${t === "num" ? 'step="0.1" min="0"' : t === "int" ? 'step="1" min="0"' : ""} value="${h(e[k] ?? "")}"></label>`).join("")}</div>
      <label style="margin-top:8px">Remarks<textarea data-k="remarks">${h(e.remarks)}</textarea></label>
      <div class="row" style="gap:8px;margin-top:12px"><button type="button" class="btn sm" data-a="add">Add to logbook</button><button type="button" class="btn sec sm" data-a="c">Cancel</button></div></div>`;
    document.body.appendChild(d);
    d.onclick = (ev) => { if (ev.target === d) d.remove(); };
    d.querySelector("[data-a=c]").onclick = () => d.remove();
    d.querySelector("[data-a=add]").onclick = () => {
      const n = { ...e }; delete n.dist;
      for (const [k, , t] of F) { const v = d.querySelector(`[data-k="${k}"]`).value; n[k] = t === "num" ? r1(+v || 0) : t === "int" ? Math.max(0, Math.round(+v || 0)) : k === "tail" ? v.toUpperCase().trim() : v.trim(); }
      n.allLdg = (n.dayLdg || 0) + (n.nightLdg || 0);
      n.remarks = d.querySelector('[data-k="remarks"]').value;
      S.logbook = S.logbook || { aircraft: {}, flights: [], importedAt: null, source: null };
      S.logbook.flights = S.logbook.flights || [];
      S.logbook.flights.push(n);
      if (!S.logbook.importedAt) { S.logbook.importedAt = Date.now(); S.logbook.source = "AeroSignal"; }
      if (n.tail && S.logbook.aircraft && !S.logbook.aircraft[n.tail]) { try { const a = allAircraft()[n.tail] || {}; S.logbook.aircraft[n.tail] = { typeCode: a.typeCode || "", model: a.model || "" }; } catch {} }
      f.track.logged = Date.now(); f.updated = Date.now();
      save(); d.remove(); toast("Added to your logbook"); kick();
    };
  }
  let t = 0, busy = false;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const sec = document.getElementById("trkPanel");
    let f = null; try { f = currentFlight(); } catch {}
    if (!sec || !f || !f.track) return;
    const row = sec.querySelector('.tk-drop [data-x="rm"]');
    if (!row) return;
    busy = true;
    try {
      let b = sec.querySelector(".tk-log");
      const label = f.track.logged ? "In your logbook" : "Add to logbook";
      if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "btn sm tk-log"; row.before(b); b.onclick = () => { const cur = currentFlight(); if (cur.track.logged && !confirm("This track is already in your logbook. Add it again?")) return; const e = build(cur); if (e) dialog(cur, e); }; }
      if (b.textContent !== label) b.textContent = label;
      b.classList.toggle("sec", !!f.track.logged);
    } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 260); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroLogTrack = { build, sunEl };
})();
