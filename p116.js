"use strict";
/* p116: log the flight in one tap. Once a planned flight's arrival time has passed, the Plan page asks
   "Did you fly it?" (for flights in the last 7 days that are not logged yet). Log it opens the logbook
   entry already filled in from the plan: date, aircraft, departure, destination, route, total and PIC
   time from the planned time en route, cross country time when the airports are more than 50 nm
   apart, night time and a day or night landing from the sun along the planned times, Approaches and
   instrument time start at zero, so currency only counts what the pilot enters. With a track log on the flight (p78) it uses the track's real times instead.
   The pilot checks and edits every number before saving. "Didn't fly" stops asking for that flight. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #lgAsk{border-color:rgba(61,224,255,.45)}
    #lgAsk .lg-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.1))}
    #lgAsk .lg-row:first-of-type{border-top:0}
    #lgAsk .lg-r{flex:1 1 200px;min-width:0}
    #lgAsk .lg-r b{font-family:var(--mono,monospace);word-break:break-word}
    #lgDlg{position:fixed;inset:0;z-index:10003;background:rgba(3,8,18,.72);display:grid;place-items:center;padding:12px;overflow:auto}
    #lgDlg .box{width:min(640px,100%);background:var(--panel,#0a1424);border:1px solid var(--line2,rgba(255,255,255,.16));border-radius:16px;padding:16px;max-height:calc(100vh - 24px);overflow:auto}
    #lgDlg .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px 10px}
    #lgDlg label{display:block;font-size:12px;color:var(--ink2,#9db2ce)}
    #lgDlg input,#lgDlg textarea{width:100%;box-sizing:border-box;margin-top:3px}
    #lgDlg textarea{min-height:56px}
  `;
  document.head.appendChild(css);
  const Rad = Math.PI / 180, r1 = (n) => Math.round(n * 10) / 10;
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const depAt = (f) => { const d = new Date(`${f.date}T${String(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`); return isNaN(d) ? null : d; };
  function arrAt(f) { try { const p = profile(f); if (p.arrLocal && !isNaN(new Date(p.arrLocal))) return new Date(p.arrLocal); } catch {} const d = depAt(f); return d ? new Date(+d + 36e5) : null; }
  const loggable = (f) => f && !f.demo && !f.missionId && !f.logged && !f.noLog && !(f.track && f.track.logged) && (f.points || []).length >= 2;
  function due() {
    const now = Date.now();
    return (S.flights || []).filter((f) => { if (!loggable(f)) return false; const a = arrAt(f); return a && +a < now && now - +a < 7 * 864e5; }).sort((a, b) => arrAt(b) - arrAt(a));
  }
  const sunEl = (ms, lat, lon) => (window.AeroLogTrack ? AeroLogTrack.sunEl(ms, lat, lon) : 0);
  function fromPlan(f) {
    if (f.track && (f.track.pts || []).length && window.AeroLogTrack) { const e = AeroLogTrack.build(f); if (e) { e.remarks = "From AeroSignal track log"; return e; } }
    const pts = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    const ap = pts.filter((p) => p.kind === "airport");
    const a = ap[0] || pts[0], b = ap[ap.length - 1] || pts[pts.length - 1];
    const d0 = depAt(f), d1 = arrAt(f);
    const total = d0 && d1 ? Math.max(0.1, (d1 - d0) / 36e5) : 1;
    let night = 0;
    if (d0 && d1 && a && b) for (let i = 0; i < 20; i++) { const k = (i + 0.5) / 20; if (sunEl(+d0 + (d1 - d0) * k, a.lat + (b.lat - a.lat) * k, a.lon + (b.lon - a.lon) * k) < -6) night += total / 20; }
    const ldgNight = d1 && b ? sunEl(+d1, b.lat, b.lon) < -6 : false;
    const dist = a && b ? 60 * Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * Rad)) : 0;
    const T = r1(total);
    return { date: f.date, tail: f.tail || "", from: (a || {}).ident || "", to: (b || {}).ident || "", route: (f.points || []).slice(1, -1).map((p) => p.ident).filter(Boolean).join(" "), total: T, pic: T, night: r1(Math.min(night, T)), xc: dist > 50 ? T : 0, act: 0, sim: 0, dayLdg: ldgNight ? 0 : 1, nightLdg: ldgNight ? 1 : 0, allLdg: 1, appr: 0, holds: 0, dualGiven: 0, dualRcvd: 0, review: false, ipc: false, simulated: 0, remarks: "From the AeroSignal plan", dist };
  }
  const F = [["date", "Date", "date"], ["tail", "Aircraft", "text"], ["from", "From", "text"], ["to", "To", "text"], ["route", "Route", "text"], ["total", "Total", "num"], ["pic", "PIC", "num"], ["xc", "Cross country", "num"], ["night", "Night", "num"], ["act", "Actual instrument", "num"], ["sim", "Simulated instrument", "num"], ["dayLdg", "Day landings full stop", "int"], ["nightLdg", "Night landings full stop", "int"], ["appr", "Approaches", "int"], ["holds", "Holds", "int"], ["dualRcvd", "Dual received", "num"]];
  function open(f) {
    if (document.getElementById("lgDlg")) return;
    const e = fromPlan(f);
    const d = document.createElement("div"); d.id = "lgDlg";
    d.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="Log this flight"><h2 style="margin-top:0">Log this flight</h2>
      <p class="small muted" style="margin-top:0">Filled in from your ${f.track && f.track.pts ? "track log" : "plan"}${e.dist ? `, ${Math.round(e.dist)} nm between airports` : ""}. Change anything that went differently: times, landings, approaches and instrument time.</p>
      <div class="grid">${F.map(([k, l, t]) => `<label>${l}<input data-k="${k}" type="${t === "date" ? "date" : t === "text" ? "text" : "number"}" ${t === "num" ? 'step="0.1" min="0"' : t === "int" ? 'step="1" min="0"' : ""} value="${h(e[k] ?? "")}"></label>`).join("")}</div>
      <label style="margin-top:8px"><input type="checkbox" data-k="review" style="width:auto;margin-right:6px">Flight review</label>
      <label><input type="checkbox" data-k="ipc" style="width:auto;margin-right:6px">Instrument proficiency check</label>
      <label style="margin-top:8px">Remarks<textarea data-k="remarks">${h(e.remarks)}</textarea></label>
      <div class="row" style="gap:8px;margin-top:12px"><button type="button" class="btn sm" data-a="add">Save to logbook</button><button type="button" class="btn sec sm" data-a="c">Cancel</button></div></div>`;
    document.body.appendChild(d);
    d.onclick = (ev) => { if (ev.target === d) d.remove(); };
    d.querySelector("[data-a=c]").onclick = () => d.remove();
    d.querySelector("[data-a=add]").onclick = () => {
      const n = { ...e }; delete n.dist;
      for (const [k, , t] of F) { const v = d.querySelector(`[data-k="${k}"]`).value; n[k] = t === "num" ? r1(+v || 0) : t === "int" ? Math.max(0, Math.round(+v || 0)) : k === "tail" ? v.toUpperCase().trim() : v.trim(); }
      n.allLdg = (n.dayLdg || 0) + (n.nightLdg || 0);
      n.review = d.querySelector('[data-k="review"]').checked; n.ipc = d.querySelector('[data-k="ipc"]').checked;
      n.remarks = d.querySelector('[data-k="remarks"]').value;
      S.logbook = S.logbook || { aircraft: {}, flights: [], importedAt: null, source: null };
      S.logbook.flights = S.logbook.flights || [];
      S.logbook.flights.push(n);
      S.logbook.flights.sort((x, y) => String(x.date).localeCompare(String(y.date)));
      if (!S.logbook.importedAt) { S.logbook.importedAt = Date.now(); S.logbook.source = "AeroSignal"; }
      if (n.tail && S.logbook.aircraft && !S.logbook.aircraft[n.tail]) { try { const a = allAircraft()[n.tail] || {}; S.logbook.aircraft[n.tail] = { typeCode: a.typeCode || "", model: a.model || "" }; } catch {} }
      f.logged = Date.now(); if (f.track) f.track.logged = f.logged; f.updated = Date.now();
      save(); d.remove(); toast("Saved to your logbook. Currency is updated."); kick();
    };
    setTimeout(() => { const i = d.querySelector('[data-k="total"]'); if (i) i.focus(); }, 30);
  }
  const when = (f) => { const a = arrAt(f); if (!a) return ""; const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / 864e5); return days <= 0 ? "today" : days === 1 ? "yesterday" : `on ${a.toLocaleDateString([], { weekday: "long" })}`; };
  function ask(page) {
    const list = due().slice(0, 3);
    let s = page.querySelector("#lgAsk");
    const sig = list.map((f) => f.id).join();
    if (!list.length) { if (s) s.remove(); return; }
    if (s && s.dataset.sig === sig) return;
    if (!s) { s = document.createElement("section"); s.className = "panel"; s.id = "lgAsk"; const td = page.querySelector("#tdCard"), h1 = page.querySelector(":scope > h1"); if (td) td.after(s); else if (h1) h1.before(s); else page.prepend(s); }
    s.dataset.sig = sig;
    s.innerHTML = `<h2>Did you fly it?</h2>${list.map((f) => `<div class="lg-row"><div class="lg-r"><b>${h(f.route)}</b> <span class="small muted">${h(when(f))}${f.tail ? " · " + h(f.tail) : ""}</span></div><button type="button" class="btn sm" data-l="${h(f.id)}">Log it</button><button type="button" class="btn sec sm" data-n="${h(f.id)}">Didn't fly</button></div>`).join("")}
      <p class="small muted" style="margin:6px 0 0">Logging keeps your currency and the brief's warnings accurate.</p>`;
    s.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => { const f = S.flights.find((x) => x.id === b.dataset.l); if (f) open(f); }));
    s.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => { const f = S.flights.find((x) => x.id === b.dataset.n); if (f) { f.noLog = Date.now(); save(); kick(); } }));
  }
  let t = 0, busy = false;
  function apply() {
    if (busy) return;
    const hash = location.hash || "";
    if (!(/^#\/plan(\/|$|\?)/.test(hash) || hash === "" || hash === "#/")) return;
    const page = document.querySelector("#view .page.qp");
    if (!page || page.classList.contains("qdone")) return;
    busy = true;
    try { ask(page); } catch (e) { console.error(e); } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 250); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroLogPlan = { due, open, fromPlan, arrAt, depAt };
})();
