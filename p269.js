"use strict";
/* p269: see an accident in 3D (November 14, 2026). Every NTSB accident shown in the app (the brief's reports, the
   route accidents section, map popups and the map list) gets a "See in 3D" button. It opens a full screen view over
   real terrain and satellite imagery at the accident location, with the nearest runway, the date, aircraft,
   weather, injuries, the phase of flight read from the report, and the first lines of the NTSB account. The camera
   circles the site so the ridges, towers and runway around it are easy to see.
   "Play illustration" draws and flies a generic path for that phase (a normal approach to the nearest runway for a
   landing accident, a climb out for a takeoff accident, a gentle descent for the rest). Public NTSB data does not
   include the actual flight path, so the path is labeled as an illustration everywhere it shows.
   Data: public NTSB tables (ntsb_events, ntsb_narratives), airports and runway ends (rwyends). Same 3D libraries and
   tiles as the route preview (p189). */
(function () {
  const LIB = "https://unpkg.com/maplibre-gl@4.7.1/dist/";
  const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
  const IMG = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  // An NTSB number such as ERA24FA053 or DCA22MA001A; the text around it can run straight on ("ERA24FA053Match 80")
  const NUM = /\b([A-Z]{3}\d{2}[A-Z]{2}\d{3})([A-Z](?![a-z]))?/;
  const R = Math.PI / 180, M_PER_NM = 1852, FT = 0.3048;
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let libP = null;
  function loadLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (libP) return libP;
    libP = new Promise((res, rej) => {
      if (!document.querySelector(`link[href="${LIB}maplibre-gl.css"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = LIB + "maplibre-gl.css"; document.head.appendChild(l); }
      const s = document.createElement("script"); s.src = LIB + "maplibre-gl.js"; s.async = true;
      s.onload = () => (window.maplibregl ? res(window.maplibregl) : rej(new Error("3D map did not load")));
      s.onerror = () => { libP = null; rej(new Error("The 3D map could not load. Check the connection.")); };
      document.head.appendChild(s);
    });
    return libP;
  }
  const rest = async (q) => { const r = await fetch(`${SUPA.url}/rest/v1/${q}`, { headers: HDR }); if (!r.ok) throw new Error("lookup " + r.status); return r.json(); };
  const dist = (a, b) => { const x = Math.sin(((b.lat - a.lat) * R) / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2; return 3440.065 * 2 * Math.asin(Math.min(1, Math.sqrt(x))); };
  const brg = (a, b) => { const y = Math.sin((b.lon - a.lon) * R) * Math.cos(b.lat * R), x = Math.cos(a.lat * R) * Math.sin(b.lat * R) - Math.sin(a.lat * R) * Math.cos(b.lat * R) * Math.cos((b.lon - a.lon) * R); return (Math.atan2(y, x) / R + 360) % 360; };
  const move = (p, b, nm) => { const d = nm / 3440.065, la = p.lat * R, lo = p.lon * R, t = b * R; const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(t)); const lo2 = lo + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2)); return { lat: la2 / R, lon: lo2 / R }; };

  function phaseOf(text) {
    const t = String(text || "").slice(0, 900).toLowerCase();
    const n = (re) => (t.match(re) || []).length;
    const sc = [
      ["landing", n(/landing|touchdown|touched down|flare|final approach|on final|approach to (the )?runway|go.?around|bounced|short of the runway/g)],
      ["takeoff", n(/takeoff|take off|initial climb|lifted off|liftoff|rotat(ed|ion)|departure roll|after departure/g)],
      ["maneuver", n(/maneuvering|low altitude|aerial application|banner|pipeline|hover|survey|sightseeing/g)],
      ["enroute", n(/cruise|en ?route|cruising|flight level/g)],
      ["taxi", n(/\btaxi(ing|ed)?\b|ramp|parking/g)],
    ].sort((a, b) => b[1] - a[1]);
    return sc[0][1] ? sc[0][0] : "unknown";
  }
  const PHASE = { landing: "Approach and landing", takeoff: "Takeoff and climb", maneuver: "Maneuvering, low altitude", enroute: "En route", taxi: "Taxi or ground", unknown: "Not clear from the report" };

  async function nearestAirport(ev) {
    if (ev.airport_code) return ev.airport_code.toUpperCase();
    const d = 0.25;
    const rows = await rest(`airports?select=ident,lat,lon,type&lat=gte.${ev.latitude - d}&lat=lte.${ev.latitude + d}&lon=gte.${ev.longitude - d}&lon=lte.${ev.longitude + d}&type=in.(small_airport,medium_airport,large_airport)&limit=60`).catch(() => []);
    rows.sort((a, b) => dist({ lat: ev.latitude, lon: ev.longitude }, a) - dist({ lat: ev.latitude, lon: ev.longitude }, b));
    return rows[0] ? rows[0].ident : null;
  }
  // The runway end the illustration uses: for a landing, the threshold the site lies short of or nearest; for a takeoff, the end the climb would head toward the site from
  function pickEnd(rws, site, phase) {
    let best = null;
    for (const r of rws || []) for (const [a, b] of [[r.le, r.he], [r.he, r.le]]) {
      if (!a || !b || !isFinite(a.lat) || !isFinite(b.lat)) continue;
      const hdg = brg(a, b);   // direction of travel landing on a, or taking off from a toward b
      let score;
      if (phase === "takeoff") { const away = brg(b, site); score = dist(b, site) + Math.abs(((away - hdg + 540) % 360) - 180) / 30; }
      else { const toThr = brg(site, a); score = dist(site, a) + Math.abs(((toThr - hdg + 540) % 360) - 180) / 30; }
      if (!best || score < best.score) best = { a, b, hdg, score };
    }
    return best;
  }
  // Generic path for the phase: [{lat, lon, agl ft}]
  function illustration(site, phase, end) {
    const pts = [];
    if (end && phase === "landing" && dist(site, end.a) < 6) {
      const start = move(end.a, (end.hdg + 180) % 360, 5);
      for (let i = 0; i <= 30; i++) { const f = i / 30; pts.push({ lat: start.lat + (end.a.lat - start.lat) * f, lon: start.lon + (end.a.lon - start.lon) * f, agl: 1600 * (1 - f) }); }
      const d = dist(end.a, site);
      if (d > 0.05) for (let i = 1; i <= 10; i++) { const f = i / 10; pts.push({ lat: end.a.lat + (site.lat - end.a.lat) * f, lon: end.a.lon + (site.lon - end.a.lon) * f, agl: 0 }); }
      else pts[pts.length - 1] = { lat: site.lat, lon: site.lon, agl: 0 };
      return pts;
    }
    if (end && phase === "takeoff" && dist(site, end.b) < 6) {
      for (let i = 0; i <= 10; i++) { const f = i / 10; pts.push({ lat: end.a.lat + (end.b.lat - end.a.lat) * f, lon: end.a.lon + (end.b.lon - end.a.lon) * f, agl: f > 0.6 ? (f - 0.6) * 200 : 0 }); }
      const d = dist(end.b, site), peak = Math.min(1200, 300 + d * 350);
      for (let i = 1; i <= 24; i++) { const f = i / 24; pts.push({ lat: end.b.lat + (site.lat - end.b.lat) * f, lon: end.b.lon + (site.lon - end.b.lon) * f, agl: 80 + Math.sin(Math.PI * Math.min(1, f * 1.25)) * peak * (1 - f * 0.3) * (f < 0.95 ? 1 : 0) }); }
      pts[pts.length - 1] = { lat: site.lat, lon: site.lon, agl: 0 };
      return pts;
    }
    const from = move(site, 250, 4);
    for (let i = 0; i <= 30; i++) { const f = i / 30; pts.push({ lat: from.lat + (site.lat - from.lat) * f, lon: from.lon + (site.lon - from.lon) * f, agl: (phase === "taxi" ? 0 : 1500) * (1 - f) }); }
    return pts;
  }
  // Thin columns from the ground up to the path, so the height of the illustration reads in 3D
  function curtain(pts, ac) {
    const feats = [];
    const sq = (p, half, base, top, kind) => {
      const dLat = half / 111320, dLon = half / (111320 * Math.cos(p.lat * R));
      return { type: "Feature", properties: { b: base, t: top, k: kind }, geometry: { type: "Polygon", coordinates: [[[p.lon - dLon, p.lat - dLat], [p.lon + dLon, p.lat - dLat], [p.lon + dLon, p.lat + dLat], [p.lon - dLon, p.lat + dLat], [p.lon - dLon, p.lat - dLat]]] } };
    };
    for (const p of pts) feats.push(sq(p, 9, 0, Math.max(3, p.agl * FT), "c"));
    if (ac) feats.push(sq(ac, 28, Math.max(0, ac.agl * FT - 14), ac.agl * FT + 14, "a"));
    return { type: "FeatureCollection", features: feats };
  }

  const st = document.createElement("style");
  st.textContent = `
    #m3{position:fixed;inset:0;z-index:9000;background:#06101f;color:#EAF2FF;display:flex;flex-direction:column}
    #m3 .m3-top{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.12)}
    #m3 .m3-top b{font-size:15px;flex:1;min-width:0}
    #m3 .m3-x{appearance:none;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;border-radius:999px;width:40px;height:40px;font-size:18px;cursor:pointer}
    #m3 .m3-map{flex:1;position:relative;min-height:0}
    #m3 #m3Map{position:absolute;inset:0}
    #m3 .m3-tag{position:absolute;left:10px;top:10px;z-index:2;background:rgba(6,16,31,.85);border:1px solid rgba(255,77,106,.6);color:#ff4d6a;font:700 12.5px system-ui,sans-serif;padding:6px 10px;border-radius:10px;max-width:70%}
    #m3 .m3-msg{position:absolute;inset:auto 10px 10px 10px;z-index:2;background:rgba(6,16,31,.85);padding:8px 12px;border-radius:10px;font-size:13px}
    #m3 .m3-info{max-height:42vh;overflow:auto;padding:12px 14px 16px;border-top:1px solid rgba(255,255,255,.12);font-size:14px;line-height:1.45}
    #m3 .m3-row{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0 0 8px;font-size:13px;color:#BFD0E6}
    #m3 .m3-row b{color:#EAF2FF}
    #m3 .m3-btns{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
    #m3 .m3-disc{color:#ff4d6a;font-weight:700;font-size:13px;margin:8px 0 0}
    @media (min-width:900px){#m3{flex-direction:row;flex-wrap:wrap}#m3 .m3-top{width:100%}#m3 .m3-map{flex:1 1 60%;height:calc(100% - 61px)}#m3 .m3-info{flex:0 0 380px;max-height:none;height:calc(100% - 61px);border-top:0;border-left:1px solid rgba(255,255,255,.12)}}
    .m3-go{appearance:none;border:1px solid #3DE0FF;background:transparent;color:#3DE0FF;border-radius:999px;padding:4px 10px;font:600 12px system-ui,sans-serif;cursor:pointer;margin:4px 6px 0 0;min-height:30px}`;
  document.head.appendChild(st);

  let cur = null;   // { map, raf, orbit }
  function close() {
    if (!cur) return;
    cancelAnimationFrame(cur.raf); clearInterval(cur.orbitT);
    try { cur.map && cur.map.remove(); } catch (e) {}
    const el = document.getElementById("m3"); if (el) el.remove();
    document.removeEventListener("keydown", cur.key);
    cur = null;
  }

  async function open(num) {
    close();
    const el = document.createElement("div"); el.id = "m3"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Accident in 3D");
    el.innerHTML = `<div class="m3-top"><b>NTSB ${h(num)}</b><button type="button" class="m3-x" aria-label="Close">&#10005;</button></div>
      <div class="m3-map"><div id="m3Map"></div><div class="m3-tag" hidden>Illustration only, not the actual flight path</div><div class="m3-msg">Loading the accident and 3D terrain…</div></div>
      <div class="m3-info"><p class="small">Loading…</p></div>`;
    document.body.appendChild(el);
    cur = { key: (e) => { if (e.key === "Escape") close(); } };
    document.addEventListener("keydown", cur.key);
    el.querySelector(".m3-x").onclick = close;
    const msg = (t) => { const m = el.querySelector(".m3-msg"); if (!m) return; m.hidden = !t; m.textContent = t || ""; };
    let ev, narr;
    try {
      const rows = await rest(`ntsb_events?select=ev_id,accident_number,event_date,location,latitude,longitude,airport_code,airport_name,injury_severity,aircraft_damage,make,model,fatal,serious,weather_condition&accident_number=eq.${encodeURIComponent(num)}&limit=1`);
      ev = rows[0];
      if (!ev) throw new Error("This accident is not in the app's NTSB data.");
      const n = await rest(`ntsb_narratives?select=narrative&ev_id=eq.${encodeURIComponent(ev.ev_id)}&limit=1`).catch(() => []);
      narr = (n[0] && n[0].narrative) || "";
    } catch (e) { msg(e.message || "The accident could not load."); return; }
    if (!cur) return;
    const site = { lat: ev.latitude, lon: ev.longitude };
    const phase = phaseOf(narr);
    const first = (narr.match(/^(.{40,600}?[.!?])(\s+.{20,400}?[.!?])?/) || [narr.slice(0, 500)])[0];
    const info = el.querySelector(".m3-info");
    const hasSite = isFinite(site.lat) && isFinite(site.lon);
    info.innerHTML = `<div class="m3-row"><span><b>${h(ev.event_date)}</b></span><span>${h(ev.location || "")}</span><span>${h([ev.make, ev.model].filter(Boolean).join(" "))}</span></div>
      <div class="m3-row"><span>${ev.fatal > 0 ? `<b style="color:#ff4d6a">Fatal, ${ev.fatal} killed</b>` : `<b>${h(ev.injury_severity || "Nonfatal")}</b>`}</span><span>Weather <b>${h(ev.weather_condition || "not stated")}</b></span><span>Phase <b>${h(PHASE[phase])}</b> <span class="small">(read from the report)</span></span></div>
      <p style="margin:6px 0">${h(first)}${narr.length > first.length ? ` <a href="#" class="m3-more">Read the full account</a>` : ""}</p>
      <div class="m3-full" hidden><p style="white-space:pre-wrap">${h(narr)}</p></div>
      <div class="m3-btns"><button type="button" class="btn sm m3-play" disabled>Play illustration</button><button type="button" class="btn sec sm m3-orbit" disabled>Stop circling</button></div>
      <p class="small" style="margin:0">The location, date, aircraft, injuries and weather come from public NTSB data${ev.airport_code ? `, near ${h(ev.airport_code)}` : ""}. Some locations are approximate.</p>
      <p class="m3-disc">The dashed path is an illustration of a typical ${h(PHASE[phase].toLowerCase())}, not the actual flight path, which public NTSB data does not include. For learning only. Not for navigation.</p>`;
    const more = info.querySelector(".m3-more"); if (more) more.onclick = (e) => { e.preventDefault(); info.querySelector(".m3-full").hidden = false; more.remove(); };
    if (!hasSite) { msg("This report has no position, so it cannot be shown in 3D."); return; }
    let ml;
    try { ml = await loadLib(); } catch (e) { msg(e.message); return; }
    if (!cur) return;
    let end = null;
    try {
      const ap = await nearestAirport(ev);
      if (ap) { const d = await fnGet(`rwyends?ids=${encodeURIComponent(ap)}`); end = pickEnd(((d && d.rows) || {})[ap] || Object.values((d && d.rows) || {})[0], site, phase); if (end) end.ap = ap; }
    } catch (e) {}
    const path = illustration(site, phase, end);
    let map;
    try { map = new ml.Map({
      container: "m3Map", maxPitch: 80, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), attributionControl: { compact: true },
      style: { version: 8, glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          img: { type: "raster", tiles: [IMG], tileSize: 256, maxzoom: 18, attribution: "Imagery Esri, Maxar, Earthstar Geographics" },
          dem: { type: "raster-dem", tiles: [DEM], tileSize: 256, maxzoom: 14, encoding: "terrarium", attribution: "Elevation AWS open data, USGS, SRTM" },
          dem2: { type: "raster-dem", tiles: [DEM], tileSize: 256, maxzoom: 14, encoding: "terrarium" },
          site: { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [site.lon, site.lat] }, properties: { n: ev.fatal > 0 ? "Accident site (fatal)" : "Accident site" } } },
          rwy: { type: "geojson", data: end ? { type: "FeatureCollection", features: [{ type: "Feature", properties: { n: `${end.ap} ${end.a.id || ""}` }, geometry: { type: "LineString", coordinates: [[end.a.lon, end.a.lat], [end.b.lon, end.b.lat]] } }] } : { type: "FeatureCollection", features: [] } },
          path: { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: path.map((p) => [p.lon, p.lat]) } } },
          cur: { type: "geojson", data: curtain([], null) },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#1b2433" } },
          { id: "img", type: "raster", source: "img" },
          { id: "hs", type: "hillshade", source: "dem2", paint: { "hillshade-exaggeration": 0.25 } },
          { id: "rwy", type: "line", source: "rwy", paint: { "line-color": "#ffffff", "line-width": 6, "line-opacity": 0.85 } },
          { id: "rwyl", type: "symbol", source: "rwy", layout: { "text-field": ["get", "n"], "text-size": 12, "symbol-placement": "line-center", "text-font": ["Open Sans Semibold"] }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 } },
          { id: "path", type: "line", source: "path", layout: { visibility: "none" }, paint: { "line-color": "#ffd23f", "line-width": 3, "line-dasharray": [2, 2] } },
          { id: "cur", type: "fill-extrusion", source: "cur", paint: { "fill-extrusion-color": ["case", ["==", ["get", "k"], "a"], "#ffd23f", "rgba(255,210,63,0.55)"], "fill-extrusion-base": ["get", "b"], "fill-extrusion-height": ["get", "t"], "fill-extrusion-opacity": 0.85 } },
          { id: "siteh", type: "circle", source: "site", paint: { "circle-radius": 18, "circle-color": "rgba(255,77,106,0.25)", "circle-stroke-color": "#ff4d6a", "circle-stroke-width": 2 } },
          { id: "site", type: "circle", source: "site", paint: { "circle-radius": 6, "circle-color": "#ff4d6a", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } },
          { id: "sitel", type: "symbol", source: "site", layout: { "text-field": ["get", "n"], "text-size": 13, "text-offset": [0, -1.6], "text-font": ["Open Sans Semibold"] }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 } },
        ],
        terrain: { source: "dem", exaggeration: 1.2 },
        sky: { "sky-color": "#7fb0e6", "horizon-color": "#d6e6f5", "fog-color": "#e3ecf5", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.75, "atmosphere-blend": 0.4 },
      },
      center: [site.lon, site.lat], zoom: 13.2, pitch: 62, bearing: end ? (end.hdg + 90) % 360 : 0,
    }); } catch (e) { msg("3D needs WebGL, which this browser has turned off. The account and details are below."); return; }
    cur.map = map;
    map.addControl(new ml.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.on("error", (e) => console.warn("accident 3D", e && e.error && e.error.message));
    let orbiting = true;
    const orbitBtn = info.querySelector(".m3-orbit"), playBtn = info.querySelector(".m3-play");
    const startOrbit = () => { clearInterval(cur.orbitT); cur.orbitT = setInterval(() => { if (orbiting && cur && cur.map && !cur.playing) map.setBearing((map.getBearing() + 0.35) % 360); }, 50); };
    map.on("dragstart", () => { orbiting = false; orbitBtn.textContent = "Circle the site"; });
    map.once("load", () => {
      msg("");
      startOrbit();
      orbitBtn.disabled = false; playBtn.disabled = false;
    });
    setTimeout(() => { if (cur && cur.map === map) { msg(""); orbitBtn.disabled = false; playBtn.disabled = false; startOrbit(); } }, 6000);
    orbitBtn.onclick = () => { orbiting = !orbiting; orbitBtn.textContent = orbiting ? "Stop circling" : "Circle the site"; };
    playBtn.onclick = () => {
      cancelAnimationFrame(cur.raf);
      cur.playing = true; orbiting = false; orbitBtn.textContent = "Circle the site";
      el.querySelector(".m3-tag").hidden = false;
      map.setLayoutProperty("path", "visibility", "visible");
      const total = 14000, t0 = performance.now();
      const b0 = brg(path[0], path[path.length - 1]);
      map.easeTo({ center: [(path[0].lon + site.lon) / 2, (path[0].lat + site.lat) / 2], zoom: 12.6, pitch: 64, bearing: (b0 + 60) % 360, duration: 1200 });
      const step = (now) => {
        if (!cur || cur.map !== map) return;
        const f = Math.min(1, (now - t0) / total), i = f * (path.length - 1), k = Math.floor(i), fr = i - k;
        const a = path[k], b = path[Math.min(path.length - 1, k + 1)];
        const p = { lat: a.lat + (b.lat - a.lat) * fr, lon: a.lon + (b.lon - a.lon) * fr, agl: a.agl + (b.agl - a.agl) * fr };
        try { map.getSource("cur").setData(curtain(path.slice(0, k + 1), p)); } catch (e) {}
        if (f < 1) cur.raf = requestAnimationFrame(step);
        else { cur.playing = false; playBtn.textContent = "Play again"; map.easeTo({ center: [site.lon, site.lat], zoom: 13.4, duration: 1500 }); orbiting = true; orbitBtn.textContent = "Stop circling"; }
      };
      cur.raf = requestAnimationFrame(step);
    };
  }

  /* "See in 3D" next to every NTSB accident number on screen */
  function scan(root) {
    for (const box of root.querySelectorAll(".rep, .hzpop, #rtPanel li, #rtPanel .rt-item, .hzitem .hzb")) {
      if (box.querySelector(".m3-go") || box.dataset.m3 === (box.textContent || "").length + "") continue;
      const m = NUM.exec(box.textContent || "");
      if (!m) { box.dataset.m3 = (box.textContent || "").length + ""; continue; }   // looked at; look again if the text changes
      const num = m[1] + (m[2] || "");
      const b = document.createElement("button"); b.type = "button"; b.className = "m3-go"; b.textContent = "See in 3D"; b.dataset.n = num;
      b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); open(num); });
      (box.classList.contains("rep") ? box.querySelector(".rh") || box : box).appendChild(b);
    }
  }
  let t = 0;
  new MutationObserver((l) => { if (l.every((x) => x.target.closest && x.target.closest(".m3-go,#m3"))) return; clearTimeout(t); t = setTimeout(() => scan(document), 250); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", close);
  window.AeroMishap3D = { open, close, phaseOf, illustration, pickEnd };
})();
