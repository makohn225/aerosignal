"use strict";
/* p117: less retyping.
   Fly again: copy any saved flight (route, aircraft, rules, alternate, cruise altitude and training
   routes) to a new date and time in one step. Weather, checks, track logs and the logbook flag stay
   with the old flight. From the Today card (p115) and an "Again" button on each Your flights row (p108).
   Add to calendar: downloads a calendar event (.ics) for the flight that phones and computers open
   in their calendar, with the route, aircraft and a link back to AeroSignal.
   Import a flight plan: a Garmin or ForeFlight .fpl file, or a .gpx route, becomes a new flight on the
   Plan page. Airports, navaids and fixes keep their names; user waypoints become lat/lon points. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #faDlg{position:fixed;inset:0;z-index:10003;background:rgba(3,8,18,.72);display:grid;place-items:center;padding:12px}
    #faDlg .box{width:min(420px,100%);background:var(--panel,#0a1424);border:1px solid var(--line2,rgba(255,255,255,.16));border-radius:16px;padding:16px}
    #faDlg .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    #faDlg label{display:block;font-size:12px;color:var(--ink2,#9db2ce)}
    #faDlg input{width:100%;box-sizing:border-box;margin-top:3px}
    #plImp{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const depAt = (f) => { const d = new Date(`${f.date}T${String(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`); return isNaN(d) ? null : d; };
  function arrAt(f) { try { const p = profile(f); if (p.arrLocal && !isNaN(new Date(p.arrLocal))) return new Date(p.arrLocal); } catch {} const d = depAt(f); return d ? new Date(+d + 36e5) : null; }

  /* Fly again */
  const KEEP = ["route", "points", "unresolved", "tail", "rules", "purpose", "terrain", "alternate", "alt", "cruise", "gs", "ll", "mtr", "planText", "nick", "manual"];
  function again(src) {
    if (document.getElementById("faDlg")) return;
    const old = depAt(src) || new Date();
    const t = new Date(); t.setDate(t.getDate() + 1);
    const d = document.createElement("div"); d.id = "faDlg";
    d.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="Fly again"><h2 style="margin-top:0">Fly ${h(src.route)} again</h2>
      <p class="small muted" style="margin-top:0">Same route, aircraft and settings. Weather and checks start fresh.</p>
      <div class="grid"><label>Date<input type="date" id="faD" value="${ymd(t)}"></label><label>Departure time<input type="time" id="faT" value="${pad(old.getHours())}:${pad(old.getMinutes())}"></label></div>
      <div class="row" style="gap:8px;margin-top:14px"><button type="button" class="btn sm" id="faGo">Create and brief</button><button type="button" class="btn sec sm" id="faX">Cancel</button></div></div>`;
    document.body.appendChild(d);
    d.onclick = (e) => { if (e.target === d) d.remove(); };
    d.querySelector("#faX").onclick = () => d.remove();
    d.querySelector("#faGo").onclick = () => {
      const date = d.querySelector("#faD").value, time = d.querySelector("#faT").value;
      if (!date || !time) { toast("Pick a date and time"); return; }
      const n = newFlight();
      for (const k of KEEP) if (src[k] !== undefined) n[k] = JSON.parse(JSON.stringify(src[k]));
      n.date = date; n.time = time; n.updated = Date.now();
      S.currentId = n.id; save(); d.remove();
      toast("Flight created");
      location.hash = "#/brief";
    };
  }

  /* Add to calendar */
  function icsTime(d) { return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`; }
  const icsEsc = (s) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  function calendar(f) {
    const d0 = depAt(f), d1 = arrAt(f) || (d0 && new Date(+d0 + 36e5));
    if (!d0) { toast("This flight has no departure time"); return; }
    const title = `Flight ${f.route}`;
    const desc = `${f.route}${f.tail ? `\nAircraft ${f.tail}` : ""}${f.rules ? `\n${f.rules}` : ""}${f.alternate ? `\nAlternate ${f.alternate}` : ""}\nOpen AeroSignal to brief: https://aerosignal-app.vercel.app/#/plan`;
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AeroSignal//Flight//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      `UID:${f.id}-${+d0}@aerosignal`, `DTSTAMP:${icsTime(new Date())}`, `DTSTART:${icsTime(d0)}`, `DTEND:${icsTime(d1)}`,
      `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(desc)}`, `LOCATION:${icsEsc(((f.points || [])[0] || {}).ident || "")}`,
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc("Brief " + f.route + " in AeroSignal")}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `${String(f.route).replace(/[^A-Z0-9]+/gi, " ").trim().replace(/\s+/g, " ").slice(0, 40) || "flight"}.ics`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast("Calendar event downloaded. Open it to add the flight, with a reminder 2 hours before.");
  }

  /* Import a flight plan file */
  function dm(v, pos, neg, w) { const a = Math.abs(v), deg = Math.floor(a), min = Math.round((a - deg) * 60); return `${String(deg + (min === 60 ? 1 : 0)).padStart(w, "0")}${pad(min === 60 ? 0 : min)}${v >= 0 ? pos : neg}`; }
  const llTok = (lat, lon) => dm(lat, "N", "S", 2) + dm(lon, "E", "W", 3);
  function parsePlan(text, name) {
    const x = new DOMParser().parseFromString(text, "application/xml");
    if (x.querySelector("parsererror")) throw new Error("That file could not be read as a flight plan.");
    const T = (el, tag) => { const n = el.getElementsByTagName(tag)[0]; return n ? n.textContent.trim() : ""; };
    const toks = [];
    if (x.getElementsByTagName("flight-plan").length) {
      const wps = {};
      for (const w of x.getElementsByTagName("waypoint")) wps[T(w, "identifier")] = { type: T(w, "type"), lat: +T(w, "lat"), lon: +T(w, "lon") };
      const rps = [...x.getElementsByTagName("route-point")];
      const ids = rps.length ? rps.map((r) => T(r, "waypoint-identifier")) : Object.keys(wps);
      for (const id of ids) { const w = wps[id] || {}; toks.push(/USER/i.test(w.type || "") && isFinite(w.lat) ? llTok(w.lat, w.lon) : id.toUpperCase()); }
    } else {
      const pts = [...x.getElementsByTagName("rtept")].length ? [...x.getElementsByTagName("rtept")] : [...x.getElementsByTagName("wpt")];
      for (const p of pts) { const n = T(p, "name").toUpperCase().replace(/\s+/g, ""), lat = +p.getAttribute("lat"), lon = +p.getAttribute("lon"); toks.push(/^[A-Z0-9]{2,5}$/.test(n) ? n : llTok(lat, lon)); }
    }
    const out = toks.filter(Boolean).filter((t, i, a) => i === 0 || t !== a[i - 1]);
    if (out.length < 2) throw new Error(`No route found in ${name}.`);
    return out.join(" ");
  }
  async function importFile(file) {
    try {
      const route = parsePlan(await file.text(), file.name);
      const n = newFlight(); n.route = route;
      try { const r = await resolveRoute(route); n.points = r.points; n.unresolved = r.unresolved; } catch { n.points = []; }
      n.updated = Date.now(); S.currentId = n.id; save();
      toast(`Imported ${route}. Set the date and time, then brief it.`);
      location.hash = "#/flights";
    } catch (e) { toast((e && e.message) || "That file could not be imported"); }
  }
  function planButtons(page) {
    const pf = page.querySelector("#plFlights");
    if (!pf) return;
    if (!pf.querySelector("#plImp")) {
      const d = document.createElement("div"); d.id = "plImp";
      d.innerHTML = `<label class="btn sec sm" style="cursor:pointer">Import a flight plan file<input type="file" accept=".fpl,.gpx,application/xml,text/xml" hidden></label><span class="small muted">Garmin or ForeFlight .fpl, or a .gpx route</span>`;
      d.querySelector("input").onchange = (e) => { const f = e.target.files && e.target.files[0]; if (f) importFile(f); e.target.value = ""; };
      pf.appendChild(d);
    }
    pf.querySelectorAll(".pf-row").forEach((row) => {
      const b = row.querySelector("[data-b]");
      if (!b || row.querySelector("[data-ag]")) return;
      const a = document.createElement("button"); a.type = "button"; a.className = "btn sec sm"; a.dataset.ag = b.dataset.b; a.textContent = "Again";
      a.onclick = () => { const f = S.flights.find((x) => x.id === a.dataset.ag); if (f) again(f); };
      row.appendChild(a);
    });
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { const hash = location.hash || ""; if (!(/^#\/plan(\/|$|\?)/.test(hash) || hash === "" || hash === "#/")) return; const page = document.querySelector("#view .page.qp"); if (page) planButtons(page); }, 260); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroFlyTools = { again, calendar, parsePlan, importFile };
})();
