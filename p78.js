"use strict";
/* p78: track log debrief. After a flight, import the track log from ForeFlight (KML) or Garmin
   Pilot and most GPS apps (GPX). The brief then shows the track flown over the planned route,
   the flight's time, distance and highest altitude, a replay slider, and every accident site and
   military mishap from the brief that the track passed close to, with the closest distance. It
   turns "here is the risk we briefed" into "here is how close we flew to it". The track is kept
   with the flight on this device (and synced with the flight when account sync is on). */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #trkPanel .tk-drop{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 4px}
    #trkPanel .tk-map{height:280px;border-radius:12px;overflow:hidden;margin:10px 0 6px;border:1px solid var(--line2,rgba(255,255,255,.14))}
    #trkPanel .tk-sum{font-size:14.5px;line-height:1.5;margin:8px 0}
    #trkPanel .tk-rp{display:flex;align-items:center;gap:10px;margin:6px 0 10px}
    #trkPanel .tk-rp input{flex:1}
    #trkPanel .tk-rp output{font:600 12.5px var(--mono,monospace);min-width:170px;text-align:right;color:var(--ink,#EAF2FF)}
    #trkPanel ul.tk-near{list-style:none;margin:0;padding:0}
    #trkPanel ul.tk-near li{padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08));font-size:14px;line-height:1.45}
    #trkPanel ul.tk-near li:first-child{border-top:0}
    #trkPanel .tk-d{font:700 11px var(--mono,monospace);padding:1px 7px;border-radius:999px;border:1px solid currentColor;margin-right:6px}
    #trkPanel .tk-d.c{color:#ff4d6a}#trkPanel .tk-d.m{color:#ffb648}#trkPanel .tk-d.f{color:var(--ink2,#9fb0c8)}
    #trkPanel .tk-ex{display:block;color:var(--ink2,#9fb0c8);font-size:13px;margin-top:2px}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180;
  const dist = (a, b) => { const dLa = (b[0] - a[0]) * R, dLo = (b[1] - a[1]) * R; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin(dLo / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.sqrt(x)); };
  const fmt = (n) => Math.ceil(n).toLocaleString("en-US");
  const pad = (n) => String(n).padStart(2, "0");

  /* ---------- reading GPX and KML ---------- */
  function parse(text, name) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("This file could not be read as GPX or KML.");
    const pts = [];
    const tp = doc.getElementsByTagName("trkpt").length ? doc.getElementsByTagName("trkpt") : doc.getElementsByTagName("rtept");
    for (const p of tp) {
      const lat = +p.getAttribute("lat"), lon = +p.getAttribute("lon");
      const ele = p.getElementsByTagName("ele")[0], tm = p.getElementsByTagName("time")[0];
      if (isFinite(lat) && isFinite(lon)) pts.push([lat, lon, ele ? +ele.textContent * 3.28084 : null, tm ? Date.parse(tm.textContent) || null : null]);
    }
    if (!pts.length) {
      // KML gx:Track (ForeFlight): <when> and <gx:coord> in pairs
      const whens = [...doc.getElementsByTagName("when")], coords = [...doc.getElementsByTagNameNS("*", "coord")];
      if (coords.length) coords.forEach((c, i) => { const [lon, lat, alt] = c.textContent.trim().split(/\s+/).map(Number); if (isFinite(lat) && isFinite(lon)) pts.push([lat, lon, isFinite(alt) ? alt * 3.28084 : null, whens[i] ? Date.parse(whens[i].textContent) || null : null]); });
    }
    if (!pts.length) {
      // KML LineString coordinates
      for (const c of doc.getElementsByTagName("coordinates")) for (const tok of c.textContent.trim().split(/\s+/)) { const [lon, lat, alt] = tok.split(",").map(Number); if (isFinite(lat) && isFinite(lon)) pts.push([lat, lon, isFinite(alt) ? alt * 3.28084 : null, null]); }
    }
    if (pts.length < 2) throw new Error("No track points were found in this file.");
    // Keep at most 1,500 points so the flight stays small
    const step = Math.ceil(pts.length / 1500);
    const out = pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => [+p[0].toFixed(5), +p[1].toFixed(5), p[2] == null ? null : Math.round(p[2]), p[3]]);
    return { name: name || "Track", pts: out, at: Date.now() };
  }

  function stats(tr) {
    let d = 0, maxA = null;
    for (let i = 1; i < tr.pts.length; i++) d += dist(tr.pts[i - 1], tr.pts[i]);
    for (const p of tr.pts) if (p[2] != null && (maxA == null || p[2] > maxA)) maxA = p[2];
    const t0 = tr.pts[0][3], t1 = tr.pts[tr.pts.length - 1][3];
    return { nm: d, maxA, dur: t0 && t1 ? (t1 - t0) / 36e5 : null, t0, t1 };
  }
  // Closest distance from a point to the track (point to segment, flat earth is fine at these scales)
  function closest(tr, lat, lon) {
    let best = Infinity, bi = 0;
    const k = Math.cos(lat * R);
    for (let i = 1; i < tr.pts.length; i++) {
      const a = tr.pts[i - 1], b = tr.pts[i];
      const ax = (a[1] - lon) * k, ay = a[0] - lat, bx = (b[1] - lon) * k, by = b[0] - lat;
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy) * 60;
      if (d < best) { best = d; bi = i; }
    }
    return { nm: best, i: bi };
  }

  const accCache = new Map();
  async function nearby(f, tr) {
    const out = [];
    try {
      const key = f.id + "|" + tr.at;
      if (!accCache.has(key)) accCache.set(key, typeof corridorAccidents === "function" ? corridorAccidents(tr.pts.filter((_, i) => i % Math.ceil(tr.pts.length / 60) === 0).map((p) => ({ lat: p[0], lon: p[1] })), 3).catch(() => []) : Promise.resolve([]));
      for (const a of (await accCache.get(key)) || []) {
        if (!isFinite(a.lat) || !isFinite(a.lon)) continue;
        const c = closest(tr, a.lat, a.lon);
        if (c.nm <= 2) out.push({ kind: "civil", lat: a.lat, lon: a.lon, nm: c.nm, i: c.i, fatal: a.fatal > 0, title: `${String(a.event_date || "").slice(0, 4)} ${[a.make, a.model].filter(Boolean).join(" ")}`.trim(), text: a.excerpt || "" });
      }
    } catch {}
    try {
      const data = window.AeroMil ? await AeroMil.load() : window.AeroMilData || [];
      for (const e of data || []) {
        if (!isFinite(e.lat) || !isFinite(e.lon)) continue;
        const c = closest(tr, e.lat, e.lon);
        const lim = e.loc_precision === "area" || /range/.test(e.loc_precision || "") ? 10 : 5;
        if (c.nm <= lim) out.push({ kind: "mil", lat: e.lat, lon: e.lon, nm: c.nm, i: c.i, fatal: !!e.fatal, title: `${String(e.date || "").slice(0, 4)} ${e.service || ""} ${e.aircraft || ""}`.trim(), text: e.hazard || e.narrative || "" });
      }
    } catch {}
    return out.sort((a, b) => a.nm - b.nm).slice(0, 12);
  }

  /* ---------- the panel ---------- */
  function when(t) { const d = new Date(t); return `${pad(d.getHours())}${pad(d.getMinutes())}`; }
  function hm(hr) { const m = Math.round(hr * 60); return `${Math.floor(m / 60)} hr ${m % 60} min`; }
  let map = null;
  function draw(sec, f) {
    const tr = f.track;
    if (map) { try { map.remove(); } catch {} map = null; }
    if (!tr) {
      sec.innerHTML = `<h2>Flight track</h2>
        <p class="small" style="margin:0">After the flight, add the track log to see the route you flew against the risks you briefed: how close you passed to past accident sites and military mishaps, with a replay.</p>
        <div class="tk-drop"><label class="btn sm" style="cursor:pointer">Add a track log<input type="file" accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml,text/xml" hidden></label><span class="small muted">GPX from Garmin Pilot and most GPS apps, or KML from ForeFlight (Track Logs, Share, KML).</span></div>`;
      wire(sec, f);
      return;
    }
    const st = stats(tr);
    sec.innerHTML = `<h2>Flight track</h2>
      <p class="tk-sum">${h(tr.name)}: ${st.dur != null ? `${hm(st.dur)}, ` : ""}${fmt(st.nm)} nm${st.maxA != null ? `, highest ${fmt(st.maxA)} ft` : ""}${st.t0 ? `, ${when(st.t0)} to ${when(st.t1)}` : ""}. <span class="tk-n">Checking the brief's accident sites along the track…</span></p>
      <div class="tk-map"></div>
      <div class="tk-rp"><input type="range" min="0" max="${tr.pts.length - 1}" value="0" aria-label="Replay the flight"><output>Start</output></div>
      <ul class="tk-near"></ul>
      <div class="tk-drop"><label class="btn sec sm" style="cursor:pointer">Replace track<input type="file" accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml,text/xml" hidden></label><button type="button" class="btn sec sm" data-x="rm">Remove track</button></div>`;
    wire(sec, f);
    const el = sec.querySelector(".tk-map");
    if (typeof L === "undefined") { el.textContent = "The map library is not loaded."; return; }
    map = L.map(el, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 16, attribution: "&copy; OpenStreetMap, &copy; CARTO" }).addTo(map);
    const plan = (f.points || []).filter((p) => isFinite(p.lat)).map((p) => [p.lat, p.lon]);
    if (plan.length > 1) L.polyline(plan, { color: "#ffffff", weight: 2, opacity: 0.7, dashArray: "6 6" }).addTo(map);
    const line = L.polyline(tr.pts.map((p) => [p[0], p[1]]), { color: "#3DE0FF", weight: 3 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [16, 16] });
    const me = L.circleMarker([tr.pts[0][0], tr.pts[0][1]], { radius: 7, color: "#fff", weight: 2, fillColor: "#3DE0FF", fillOpacity: 1 }).addTo(map);
    const out = sec.querySelector(".tk-rp output");
    sec.querySelector(".tk-rp input").oninput = (e) => {
      const p = tr.pts[+e.target.value];
      me.setLatLng([p[0], p[1]]);
      out.textContent = `${p[3] ? when(p[3]) + "  " : ""}${p[2] != null ? fmt(p[2]) + " ft" : ""}`;
    };
    nearby(f, tr).then((list) => {
      if (!sec.isConnected) return;
      const n = sec.querySelector(".tk-n");
      if (n) n.textContent = list.length ? `You passed close to ${list.length} past accident site${list.length === 1 ? "" : "s"} or military mishap${list.length === 1 ? "" : "s"}.` : "No accident sites from the brief were within 2 nm of your track.";
      sec.querySelector(".tk-near").innerHTML = list.map((x, k) => `<li data-k="${k}"><span class="tk-d ${x.nm < 0.5 ? "c" : x.nm < 1 ? "m" : "f"}">${x.nm < 0.1 ? "OVER" : x.nm.toFixed(1) + " NM"}</span><b>${h(x.kind === "mil" ? "Military: " : "")}${h(x.title)}</b>${x.fatal ? " · fatal" : ""}<span class="tk-ex">${h(String(x.text).slice(0, 220))}${String(x.text).length > 220 ? "…" : ""}</span></li>`).join("");
      if (!map) return;
      list.forEach((x, k) => {
        const m = L.circleMarker([x.lat, x.lon], { radius: 6, color: x.kind === "mil" ? "#ffb648" : "#ff4d6a", weight: 2, fillOpacity: 0.5 }).addTo(map).bindPopup(`${h(x.title)}<br>${x.nm.toFixed(1)} nm from your track`);
        const li = sec.querySelector(`li[data-k="${k}"]`);
        if (li) li.onclick = () => { map.setView([x.lat, x.lon], Math.max(map.getZoom(), 11)); m.openPopup(); const r = sec.querySelector(".tk-rp input"); r.value = x.i; r.oninput({ target: r }); };
      });
    });
  }
  function wire(sec, f) {
    for (const inp of sec.querySelectorAll('input[type="file"]')) inp.onchange = async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      try {
        if (file.size > 25e6) throw new Error("That file is larger than 25 MB.");
        const tr = parse(await file.text(), file.name.replace(/\.(gpx|kml)$/i, ""));
        f.track = tr; f.updated = Date.now();
        try { save(); } catch (e) { delete f.track; throw new Error("This device is out of storage space for the track."); }
        try { toast(`Track added: ${tr.pts.length} points`); } catch {}
        draw(sec, f);
      } catch (e) { try { toast(e.message || "Could not read that file"); } catch {} }
    };
    const rm = sec.querySelector('[data-x="rm"]');
    if (rm) rm.onclick = () => { delete f.track; f.updated = Date.now(); try { save(); } catch {} draw(sec, f); };
  }

  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId || !(f.points || []).length || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      let sec = page.querySelector("#trkPanel");
      const sig = `${f.id}|${f.track ? f.track.at : 0}`;
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "trkPanel"; }
      if (sec.dataset.sig !== sig) { sec.dataset.sig = sig; draw(sec, f); }
      // Just after the When to go timeline, or the debrief
      const anchor = page.querySelector(":scope > #wtgPanel") || page.querySelector(":scope > #dbPanel") || page.querySelector(":scope > #bbody");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) page.appendChild(sec);
      if (map) setTimeout(() => { try { map.invalidateSize(); } catch {} }, 50);
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 280); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#trkPanel"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroTrack = { parse, stats, closest };
})();
