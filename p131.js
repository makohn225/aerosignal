"use strict";
/* p131: approach debrief.
   1. Recording: while "Follow my aircraft" (p126) runs, each GPS fix (one every 2 seconds) is kept
      and saved as the current flight's track (marked as recorded here), unless a track was
      imported. The last 10 minutes keep every point so the approach stays sharp; earlier parts are
      thinned to stay inside the 1,500 point limit of the track debrief (p78).
   2. Debrief: on the brief, under the track debrief, the final approach is compared with the
      runway's published glidepath and threshold crossing height (FAA CIFP, p128), with stabilized
      approach gates at 1,000 and 500 ft above the runway: path deviation, distance off the
      extended centerline, descent rate, and groundspeed spread from 1,000 ft down. A small profile
      shows the flown points against the path.
   GPS altitude on a phone or in an exported track can be off by 100 ft or more. This is a debrief
   aid, not a flight data record and not a substitute for an instructor. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #apdPanel .apd-sum{font-size:15px;line-height:1.5;margin:6px 0 10px}
    #apdPanel .apd-sum b.ok{color:#46e39b}#apdPanel .apd-sum b.bad{color:#ff4d6a}#apdPanel .apd-sum b.warn{color:#ffb547}
    #apdPanel table{width:100%;border-collapse:collapse;font-size:13.5px;margin:6px 0 10px}
    #apdPanel th,#apdPanel td{text-align:left;padding:6px 8px;border-top:1px solid var(--line2,rgba(255,255,255,.1))}
    #apdPanel th{font-weight:600;color:var(--ink2,#9fb0c8);font-size:12px}
    #apdPanel td.ok{color:#46e39b}#apdPanel td.bad{color:#ff4d6a}#apdPanel td.warn{color:#ffb547}
    #apdPanel svg{width:100%;height:auto;display:block;background:rgba(5,10,20,.5);border-radius:10px;margin:6px 0}
    #apdPanel .d{color:#ff4d6a;font-weight:700;font-size:12.5px;margin-top:6px}
    #apdPanel .muted{color:var(--ink2,#9fb0c8);font-size:13px}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180, FT = 6076.12;
  const nm = (a, b) => { const p1 = a[0] * R, p2 = b[0] * R, dp = p2 - p1, dl = (b[1] - a[1]) * R; const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(x))); };
  const brg = (a, b) => { const p1 = a[0] * R, p2 = b[0] * R, dl = (b[1] - a[1]) * R; return (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / R + 360) % 360; };
  const adiff = (a, b) => ((a - b + 540) % 360) - 180;
  const up = (n) => Math.ceil(n).toLocaleString("en-US");
  const icao = (id) => { id = String(id || "").toUpperCase(); return /^[A-Z]{3}$/.test(id) ? "K" + id : id; };

  /* ---------- 1. Recording ---------- */
  let rec = [], recFlight = null, lastSave = 0;
  const NAME = "Recorded in AeroSignal";
  function thin(pts) {
    if (pts.length <= 1500) return pts;
    const tEnd = pts[pts.length - 1][3], keepFrom = pts.findIndex((p) => p[3] >= tEnd - 10 * 6e4);
    const tail = pts.slice(Math.max(0, keepFrom)).slice(-900), head = pts.slice(0, pts.length - tail.length);
    const room = 1500 - tail.length, step = Math.ceil(head.length / Math.max(1, room));
    return [...head.filter((_, i) => i % step === 0), ...tail];
  }
  function saveRec(force) {
    if (!recFlight || rec.length < 5) return;
    if (!force && Date.now() - lastSave < 30000) return;
    lastSave = Date.now();
    let f = null; try { f = (S.flights || []).find((x) => x.id === recFlight) || null; } catch { /* no flights */ }
    if (!f || (f.track && !f.track.rec)) return; // never overwrite an imported track
    f.track = { name: NAME, rec: true, pts: thin(rec), at: (f.track && f.track.at) || Date.now() };
    f.updated = Date.now();
    try { save(); } catch { /* storage full: keep recording in memory */ }
  }
  if (typeof L !== "undefined") {
    L.Map.addInitHook(function () {
      const map = this;
      map.on("aerofix", (e) => {
        const fx = e.fix;
        if (!fx || !fx.ll) return;
        if (!recFlight) { try { const f = currentFlight(); recFlight = f ? f.id : null; } catch { recFlight = null; } if (!recFlight) return; }
        const last = rec[rec.length - 1], t = fx.t || Date.now();
        if (last && t - last[3] < 2000) return;
        rec.push([+fx.ll.lat.toFixed(5), +fx.ll.lng.toFixed(5), fx.alt == null ? null : Math.round(fx.alt), t]);
        if (rec.length > 12000) rec = thin(rec);
        saveRec(false);
      });
      map.on("aerofixstop", () => { saveRec(true); rec = []; recFlight = null; });
    });
    window.addEventListener("pagehide", () => saveRec(true));
  }

  /* ---------- 2. Analysis ---------- */
  function runwayFor(d, pts) {
    // The runway whose threshold the track passes closest to at the end, aligned within 30 degrees
    const rw = Object.entries(d.runways || {});
    const recip = (id) => { const m = /^(\d{1,2})([LRC]?)$/.exec(id); if (!m) return null; let n = ((+m[1] + 18 - 1) % 36) + 1; const side = { L: "R", R: "L", C: "C", "": "" }[m[2]]; return String(n).padStart(2, "0") + side; };
    let best = null;
    for (const [id, r] of rw) {
      const rc = recip(id), o = rc ? d.runways[rc] || (Object.entries(d.runways).find(([k]) => k.replace(/^0/, "") === rc.replace(/^0/, "")) || [])[1] : null;
      const crs = o ? brg([r.lat, r.lon], [o.lat, o.lon]) : r.brgM; // true course where the far end is known
      if (crs == null) continue;
      for (let i = pts.length - 1; i >= Math.max(1, pts.length - 600); i--) {
        const p = pts[i], dd = nm([r.lat, r.lon], p);
        if (dd > 0.6) continue;
        const trk = brg(pts[i - 1], p);
        if (Math.abs(adiff(trk, crs)) > 30) continue;
        if (!best || i > best.i || (i === best.i && dd < best.dd)) best = { id, r, crs, i, dd };
        break;
      }
    }
    return best;
  }
  function analyze(track, d, apName) {
    const pts = track.pts;
    const rw = runwayFor(d, pts);
    if (!rw) return { err: "The track does not end on a runway with published data at this airport." };
    const r = rw.r, thr = [r.lat, r.lon], back = (rw.crs + 180) % 360;
    const ap = (d.approaches || []).filter((a) => a.rwy === rw.id).sort((a, b) => (a.kind === "ILS" ? 0 : 1) - (b.kind === "ILS" ? 0 : 1))[0];
    const gpa = ap ? ap.gpa : 3, tch = r.tch != null ? r.tch : 50, elev = r.elev || 0, tan = Math.tan(gpa * R);
    // Walk back from the threshold while the aircraft is on final (within 10 nm, within 45 degrees of the extended centerline)
    const s = [];
    for (let i = rw.i; i >= 0; i--) {
      const p = pts[i], d0 = nm(thr, p), off = adiff(brg(thr, p), back);
      if (d0 > 10) break;
      if (Math.abs(off) > 45 && d0 > 0.5) break;
      const along = d0 * Math.cos(off * R), lat = -d0 * Math.sin(off * R);
      if (p[2] == null) continue;
      const pathAlt = elev + tch + tan * Math.max(0, along) * FT;
      s.unshift({ along, lat, alt: p[2], agl: p[2] - elev, dev: p[2] - pathAlt, t: p[3] });
    }
    if (s.length < 4) return { err: "There are not enough track points with altitude on final to debrief this approach." };
    // descent rate and groundspeed from neighbors
    for (let i = 0; i < s.length; i++) {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
      const dt = a.t && b.t ? (b.t - a.t) / 6e4 : null;
      s[i].vs = dt ? (b.alt - a.alt) / dt : null;
      s[i].gs = dt ? ((a.along - b.along) / dt) * 60 : null;
    }
    const at = (agl) => { // interpolate the moment the aircraft passed this height above the runway
      for (let i = 1; i < s.length; i++) if (s[i - 1].agl >= agl && s[i].agl <= agl) { const k = (s[i - 1].agl - agl) / Math.max(1, s[i - 1].agl - s[i].agl); const m = (x) => (s[i - 1][x] == null || s[i][x] == null ? null : s[i - 1][x] + k * (s[i][x] - s[i - 1][x])); return { along: m("along"), lat: m("lat"), dev: m("dev"), vs: m("vs"), gs: m("gs") }; }
      return null;
    };
    const below1000 = s.filter((x) => x.agl <= 1000 && x.along > 0.1 && x.gs != null && x.gs > 20);
    const gsSpread = below1000.length > 2 ? Math.max(...below1000.map((x) => x.gs)) - Math.min(...below1000.map((x) => x.gs)) : null;
    const gate = (g) => {
      if (!g) return null;
      const why = [];
      if (g.dev != null && Math.abs(g.dev) > 150) why.push(`${up(Math.abs(g.dev))} ft ${g.dev > 0 ? "high" : "low"}`);
      if (g.lat != null && Math.abs(g.lat) > 0.2) why.push(`${Math.abs(g.lat).toFixed(1)} nm ${g.lat > 0 ? "right" : "left"} of centerline`);
      if (g.vs != null && g.vs < -1000) why.push(`descending ${up(-g.vs)} fpm`);
      return { ...g, ok: !why.length, why };
    };
    const g1000 = gate(at(1000)), g500 = gate(at(500));
    return { apt: apName, rwy: rw.id, name: ap ? `${ap.kind} RWY ${rw.id}` : `RWY ${rw.id}`, gpa, tch, elev, s, g1000, g500, gsSpread, cycle: d.cycle };
  }

  /* ---------- Card ---------- */
  function svg(a) {
    const W = 900, H = 170, maxNm = Math.min(10, Math.max(3, Math.ceil(Math.max(...a.s.map((x) => x.along))))), tan = Math.tan(a.gpa * R);
    const maxAlt = Math.max(a.elev + a.tch + tan * maxNm * FT, ...a.s.map((x) => x.alt)) + 200, minAlt = a.elev - 100;
    const X = (n) => W - 14 - (Math.max(0, n) / maxNm) * (W - 40), Y = (ft) => H - 14 - ((ft - minAlt) / (maxAlt - minAlt)) * (H - 28);
    const pts = a.s.filter((x) => x.along <= maxNm).map((x) => `${X(x.along).toFixed(1)},${Y(x.alt).toFixed(1)}`).join(" ");
    const ticks = []; for (let n = 1; n < maxNm; n++) ticks.push(`<text x="${X(n)}" y="${H - 2}" font-size="10" text-anchor="middle" fill="#9db2ce">${n}</text>`);
    const gl = (agl, lab) => `<line x1="0" x2="${W}" y1="${Y(a.elev + agl)}" y2="${Y(a.elev + agl)}" stroke="rgba(255,255,255,.15)" stroke-dasharray="3 5"/><text x="4" y="${Y(a.elev + agl) - 3}" font-size="10" fill="#9db2ce">${lab}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Flown approach against the glidepath">
      <line x1="0" x2="${W}" y1="${Y(a.elev)}" y2="${Y(a.elev)}" stroke="rgba(255,255,255,.3)"/>${gl(500, "500 ft")}${gl(1000, "1,000 ft")}
      <line x1="${X(0)}" y1="${Y(a.elev + a.tch)}" x2="${X(maxNm)}" y2="${Y(a.elev + a.tch + tan * maxNm * FT)}" stroke="#3DE0FF" stroke-width="2" stroke-dasharray="6 4"/>
      <polyline points="${pts}" fill="none" stroke="#FFD23F" stroke-width="2.5"/>${ticks.join("")}
      <rect x="${X(0) - 3}" y="${Y(a.elev) - 2}" width="12" height="4" fill="#EAF2FF"/></svg>`;
  }
  const cell = (g, k) => {
    if (!g || g[k] == null) return "<td>n/a</td>";
    if (k === "dev") return `<td class="${Math.abs(g.dev) > 150 ? "bad" : "ok"}">${Math.abs(g.dev) < 50 ? "on path" : `${up(Math.abs(g.dev))} ft ${g.dev > 0 ? "high" : "low"}`}</td>`;
    if (k === "lat") return `<td class="${Math.abs(g.lat) > 0.2 ? "bad" : "ok"}">${Math.abs(g.lat) < 0.05 ? "on centerline" : `${Math.abs(g.lat).toFixed(1)} nm ${g.lat > 0 ? "right" : "left"}`}</td>`;
    if (k === "vs") return `<td class="${g.vs < -1000 ? "bad" : "ok"}">${up(Math.abs(g.vs))} fpm ${g.vs < 0 ? "down" : "up"}</td>`;
    if (k === "gs") return `<td>${up(g.gs)} kt</td>`;
    return "<td></td>";
  };
  function draw(sec, f) {
    const head = `<h2>Approach debrief</h2>`;
    const dest = (() => { try { const p = profile(f).pts; return icao(p[p.length - 1].ident); } catch { return ""; } })();
    if (!f.track || !f.track.pts || f.track.pts.length < 10) { sec.innerHTML = `${head}<p class="muted">Record a flight with Follow my aircraft on the map, or import a track above, and the final approach is compared with the published glidepath here.</p>`; return; }
    sec.innerHTML = `${head}<p class="muted">Checking the approach into ${h(dest || "the destination")}...</p>`;
    const go = window.AeroApproach && AeroApproach.cifp ? AeroApproach.cifp(dest) : Promise.resolve(null);
    go.then((d) => {
      if (!d) { sec.innerHTML = `${head}<p class="muted">No published runway data for ${h(dest || "this airport")} (the FAA publishes it for airports with an instrument approach). Nothing to compare yet.</p>`; return; }
      const a = analyze(f.track, d, dest);
      if (a.err) { sec.innerHTML = `${head}<p class="muted">${h(a.err)}</p>`; return; }
      const g = a.g500 || a.g1000;
      const verdict = !g ? `<b class="warn">The track does not reach 500 ft above the runway with altitude data.</b>`
        : a.g500 && a.g500.ok ? `<b class="ok">Stable by 500 ft</b> on the ${h(a.name)} path${a.g1000 && !a.g1000.ok ? `, after being ${h(a.g1000.why.join(", "))} at 1,000 ft` : ""}.`
        : a.g500 ? `<b class="bad">Not stable at 500 ft:</b> ${h(a.g500.why.join(", "))}.` : "";
      sec.innerHTML = `${head}
        <p class="apd-sum">${h(a.apt)} ${h(a.name)}, ${String(+a.gpa.toFixed(2))}° glidepath, crossing height ${up(a.tch)} ft. ${verdict}${a.gsSpread != null ? ` Groundspeed varied ${up(a.gsSpread)} kt from 1,000 ft down.` : ""}</p>
        ${svg(a)}
        <table><tr><th>Gate</th><th>Glidepath</th><th>Centerline</th><th>Descent</th><th>Groundspeed</th></tr>
        <tr><td>1,000 ft</td>${cell(a.g1000, "dev")}${cell(a.g1000, "lat")}${cell(a.g1000, "vs")}${cell(a.g1000, "gs")}</tr>
        <tr><td>500 ft</td>${cell(a.g500, "dev")}${cell(a.g500, "lat")}${cell(a.g500, "vs")}${cell(a.g500, "gs")}</tr></table>
        <p class="muted">Gates use common stabilized approach limits: within 150 ft of the path, 0.2 nm of centerline, and no more than 1,000 fpm down. Published path from FAA procedure data, cycle ${h(a.cycle || "")}.</p>
        <div class="d">From GPS altitude on the track, which can be off by 100 ft or more. A debrief aid, not a flight data record.</div>`;
    }).catch(() => { sec.innerHTML = `${head}<p class="muted">Could not load the published runway data. Try again with a connection.</p>`; });
  }

  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"), trk = page && page.querySelector(":scope > #trkPanel");
    let f = null; try { f = currentFlight(); } catch { /* none */ }
    if (!page || !trk || !f) return;
    busy = true;
    try {
      let sec = page.querySelector("#apdPanel");
      const sig = `${f.id}|${f.track ? f.track.at + ":" + f.track.pts.length : 0}`;
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "apdPanel"; }
      if (sec.dataset.sig !== sig) { sec.dataset.sig = sig; draw(sec, f); }
      // After the runway sections (p138 closures, p86, p84, p83 all chain off the flight track), else
      // just after the flight track. Sitting directly after #trkPanel fought Runway winds (p83) for that spot.
      const anchor = page.querySelector(":scope > #clPanel") || page.querySelector(":scope > #pfPanel") || page.querySelector(":scope > #dvPanel") || page.querySelector(":scope > #rwPanel") || trk;
      if (anchor.nextElementSibling !== sec) anchor.after(sec);
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 320); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#apdPanel"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroApproachDebrief = { analyze, thin };
})();
