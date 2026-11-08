"use strict";
/* p189: 3D route preview (November 6, 2026, owner request: "virtually fly a route and preview it", for MTRs and
   mountainous terrain). #/preview flies the current route over 3D terrain with satellite imagery or the FAA
   sectional draped on it, from the cockpit or from behind the aircraft. The pilot picks the altitude: the
   planned altitude (fixed MSL), or a height above the ground such as 500 ft for a low level route, and the
   playback speed. Readouts show the next point, distance to it, MSL altitude, the ground below and the height
   above it, turning red under 500 ft. A scrub bar jumps anywhere along the route.
   Data: AWS open elevation tiles (Terrarium, public domain sources such as USGS 3DEP and SRTM), Esri World
   Imagery (as on the 2D map) and the FAA VFR sectional. MapLibre GL JS 4.7.1 is loaded from unpkg only when the page
   opens. Preview for situational awareness only: terrain and imagery are approximate and may be out of date,
   and only FAA obstacle file entries 200 ft AGL or taller are drawn (added Nov 6); wires are not. Nothing is stored or sent.
   November 8: a Training route block altitude mode for MTRs (200 ft above each segment's published floor, under its
   ceiling) with the route drawn in purple; cloud bases from current METARs near the route drawn as gray layers with a
   ceiling readout; and the scene lit for day, dusk or night at the planned departure time. */
(function () {
  if (typeof ROUTES === "undefined") return;
  const LIB = "https://unpkg.com/maplibre-gl@4.7.1/dist/";
  const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
  const IMG = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const VFR = "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}";
  const R = Math.PI / 180, FT = 3.28084;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    .pv{max-width:none!important}
    .pv .pv-wrap{position:relative;height:min(68vh,640px);min-height:340px;border-radius:14px;overflow:hidden;border:1px solid var(--line2,rgba(255,255,255,.14));background:#0b1220}
    .pv #pvMap{position:absolute;inset:0}
    .pv .pv-hud{position:absolute;left:10px;top:10px;right:10px;display:flex;flex-wrap:wrap;gap:6px;pointer-events:none}
    .pv .pv-hud div{background:rgba(5,10,20,.72);color:#fff;border-radius:8px;padding:5px 9px;font:600 13px/1.25 var(--mono,monospace)}
    .pv .pv-hud small{display:block;font:600 10px system-ui;letter-spacing:.5px;text-transform:uppercase;opacity:.75}
    .pv .pv-hud .low{background:rgba(200,20,45,.85)}
    .pv .pv-ctl{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin:10px 0}
    .pv .pv-ctl label{display:flex;align-items:center;gap:6px;font-size:13.5px}
    .pv .pv-ctl select,.pv .pv-ctl input[type=number]{min-height:38px}
    .pv .pv-ctl input[type=number]{width:90px}
    .pv #pvScrub{width:100%}
    .pv .pv-disc{color:#ff4d6a;font-weight:700;font-size:13px;margin:8px 0}
    .pv .pv-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:14px;text-align:center;padding:20px}`;
  document.head.appendChild(css);

  let libP = null;
  function loadLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (libP) return libP;
    libP = new Promise((res, rej) => {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = LIB + "maplibre-gl.css"; document.head.appendChild(l);
      const s = document.createElement("script"); s.src = LIB + "maplibre-gl.js"; s.async = true;
      s.onload = () => (window.maplibregl ? res(window.maplibregl) : rej(new Error("3D map did not load")));
      s.onerror = () => { libP = null; rej(new Error("3D map could not load. Check the connection.")); };
      document.head.appendChild(s);
    });
    return libP;
  }
  function dist(a, b) {
    const p1 = a.lat * R, p2 = b.lat * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2;
    return 6880.13 * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function brg(a, b) {
    const p1 = a.lat * R, p2 = b.lat * R, dl = (b.lon - a.lon) * R;
    return (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / R + 360) % 360;
  }
  function ahead(p, bearing, nm) {
    const d = nm / 3440.065, b = bearing * R, l1 = p.lat * R, o1 = p.lon * R;
    const l2 = Math.asin(Math.sin(l1) * Math.cos(d) + Math.cos(l1) * Math.sin(d) * Math.cos(b));
    const o2 = o1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(l1), Math.cos(d) - Math.sin(l1) * Math.sin(l2));
    return { lat: l2 / R, lon: (((o2 / R) + 540) % 360) - 180 };
  }
  function track(pts) {
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    const total = cum[cum.length - 1];
    function at(s) {
      s = Math.max(0, Math.min(total, s));
      let i = 1; while (i < pts.length - 1 && cum[i] < s) i++;
      const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1] || 1, t = (s - cum[i - 1]) / seg;
      return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, leg: i, crs: brg(a, b), toNext: cum[i] - s, next: b };
    }
    return { at, total, cum };
  }
  const deg = (d) => String(Math.round(d) % 360 || 360).padStart(3, "0") + "°";
  function planned(f) { let a = 0; try { a = window.AeroWinds ? Number(AeroWinds.altOf(f)) || 0 : 0; } catch (e) {} return a || Number(String(f.cruiseAlt || "").replace(/\D/g, "")) || 4500; }
  function speed(f) { try { const nl = f.nl || {}; if (Number(nl.tas)) return Number(nl.tas); const a = (allAircraft() || {})[f.tail]; const v = a && (Number(a.cruiseKt) || Number(a.tas)); if (v) return v; } catch (e) {} return f.missionId ? 240 : 110; }

  // FAA Digital Obstacle File along the route (200 ft AGL and taller, within 3 nm of the line), Nov 6 addition
  function xt(a, b, q) {
    const k = Math.cos(((a.lat + b.lat) / 2) * R) * 60, bx = (b.lon - a.lon) * k, by = (b.lat - a.lat) * 60, px = (q.lon - a.lon) * k, py = (q.lat - a.lat) * 60;
    const L2 = bx * bx + by * by || 1, t = Math.max(0, Math.min(1, (px * bx + py * by) / L2));
    return { d: Math.hypot(px - bx * t, py - by * t), t };
  }
  async function obstacles(pts) {
    if (typeof arcQuery !== "function") return [];
    const out = new Map();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], pad = 0.06;
      const env = [Math.min(a.lon, b.lon) - pad, Math.min(a.lat, b.lat) - pad, Math.max(a.lon, b.lon) + pad, Math.max(a.lat, b.lat) + pad];
      try {
        const j = await arcQuery("Digital_Obstacle_File", { where: "AGL>=200", geometry: env.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "OBJECTID,AGL,AMSL,Type_Code,Lat_DD,Long_DD,Lighting", orderByFields: "AMSL DESC", resultRecordCount: "1000", returnGeometry: "false", f: "json" });
        for (const f of j.features || []) {
          const o = f.attributes || {}, q = { lat: +o.Lat_DD, lon: +o.Long_DD };
          if (!isFinite(q.lat) || !isFinite(q.lon) || xt(a, b, q).d > 3) continue;
          out.set(`${q.lat.toFixed(5)},${q.lon.toFixed(5)}`, { lat: q.lat, lon: q.lon, agl: +o.AGL || 0, amsl: +o.AMSL || 0, type: String(o.Type_Code || "obstacle").toLowerCase(), lit: o.Lighting });
        }
      } catch (e) { console.warn("obstacles", e); }
    }
    return [...out.values()];
  }
  function obsGeo(list) {
    const sq = (o) => { const d = 0.00028, k = Math.cos(o.lat * R); return [[[o.lon - d / k, o.lat - d], [o.lon + d / k, o.lat - d], [o.lon + d / k, o.lat + d], [o.lon - d / k, o.lat + d], [o.lon - d / k, o.lat - d]]]; };
    return {
      cols: { type: "FeatureCollection", features: list.map((o) => ({ type: "Feature", geometry: { type: "Polygon", coordinates: sq(o) }, properties: { h: o.agl / FT } })) },
      tops: { type: "FeatureCollection", features: list.map((o) => ({ type: "Feature", geometry: { type: "Point", coordinates: [o.lon, o.lat] }, properties: { t: `${Math.round(o.agl).toLocaleString("en-US")} AGL` } })) },
    };
  }
  // ---- Nov 8 additions: training route blocks, cloud bases, daylight ----
  function circle(c, nm) { const out = []; for (let i = 0; i <= 32; i++) { const q = ahead(c, (i * 360) / 32, nm); out.push([q.lon, q.lat]); } return out; }
  function blk(val, uom, code) { let ft = Number(val) || 0; if (/FL/i.test(uom || "")) ft *= 100; const agl = /HEI|AGL|SFC/i.test(code || ""); return { ft, agl, txt: ft ? `${ft.toLocaleString("en-US")} ${agl ? "AGL" : "MSL"}` : "surface" }; }
  async function loadMtr(f) {
    const ids = [...new Set((String(f.route || "").toUpperCase().match(/\b(VR|IR|SR)\d{2,4}\b/g) || []))];
    const out = [];
    for (const q of ids.slice(0, 3)) {
      let rows = []; try { rows = await rpc("mtr_by_ident", { q }); } catch (e) {}
      for (const r of rows || []) {
        const c = typeof r.coords === "string" ? JSON.parse(r.coords) : r.coords; if (!Array.isArray(c)) continue;
        const lines = Array.isArray(c[0] && c[0][0]) ? c : [c];
        const lo = blk(r.lower_val, r.lower_uom, r.lower_code), hi = blk(r.upper_val, r.upper_uom, r.upper_code);
        out.push({ name: q, lines, lo, hi, text: `${lo.txt} to ${hi.txt}` });
      }
    }
    return out;
  }
  async function clouds(pts) {
    const ids = new Set(pts.filter((p) => p.kind === "airport" && /^K[A-Z0-9]{3}$/.test(p.ident)).map((p) => p.ident));
    for (let i = 1; i < pts.length && ids.size < 10; i++) {
      const a = pts[i - 1], b = pts[i], len = dist(a, b);
      for (let k = 1; k < Math.min(4, Math.floor(len / 25) + 1) && ids.size < 10; k++) {
        const t = k / Math.min(4, Math.floor(len / 25) + 1), q = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
        try { const j = await fnGet(`nearfix?lat=${q.lat.toFixed(3)}&lon=${q.lon.toFixed(3)}&r=20&only=report`); for (const r of (j && j.rows) || []) if (r.kind === "airport" && /^K[A-Z0-9]{3}$/.test(r.ident) && ids.size < 10) ids.add(r.ident); } catch (e) {}
      }
    }
    if (!ids.size) return [];
    const j = await fnGet(`wx?ids=${[...ids].slice(0, 10).join(",")}`);
    const where = new Map(); pts.forEach((p) => where.set(p.ident, p));
    const out = [];
    for (const m of (j && j.metar) || []) {
      const raw = String(m.raw || ""), layers = [...raw.matchAll(/\b(BKN|OVC|VV)(\d{3})\b/g)].map((x) => ({ cov: x[1], ft: +x[2] * 100 }));
      let loc = where.get(m.station);
      if (!loc) { try { const r = await rpc("resolve_points", { tokens: [m.station] }); const a = (r || []).find((x) => x.ident === m.station); if (a) loc = { lat: +a.lat, lon: +a.lon }; } catch (e) {} }
      if (!loc) continue;
      elev(loc.lat, loc.lon); // start loading the elevation tile for the station
      const low = layers.sort((x, y) => x.ft - y.ft)[0];
      out.push({ station: m.station, lat: loc.lat, lon: loc.lon, baseAgl: low && low.ft <= 12000 ? low.ft : null, get ceilFt() { if (this.baseAgl == null) return null; const g = elev(this.lat, this.lon); return this.baseAgl + (g || 0) * FT; }, layer: low ? `${low.cov}${String(low.ft / 100).padStart(3, "0")}` : "" });
    }
    return out;
  }
  function daylight(map, f, pts, el) {
    try {
      const d = f.date && f.time ? new Date(`${f.date}T${f.time}`) : null;
      if (!d || isNaN(d) || !(window.AeroLogTrack && AeroLogTrack.sunEl)) return;
      const sun = AeroLogTrack.sunEl(d.getTime(), pts[0].lat, pts[0].lon);
      const n = el.querySelector("#pvSunN");
      const when = d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
      if (sun < -6) {
        ["img", "vfr"].forEach((id) => { map.setPaintProperty(id, "raster-brightness-max", 0.22); map.setPaintProperty(id, "raster-saturation", -0.5); });
        map.setSky({ "sky-color": "#06101f", "horizon-color": "#13233b", "fog-color": "#0b1424", "sky-horizon-blend": 0.5, "horizon-fog-blend": 0.5, "fog-ground-blend": 0.8, "atmosphere-blend": 0.2 });
        if (n) n.textContent = `Lit for night: the sun is below the horizon at your planned departure (${when}).`;
      } else if (sun < 6) {
        ["img", "vfr"].forEach((id) => map.setPaintProperty(id, "raster-brightness-max", 0.6));
        map.setSky({ "sky-color": "#3a5a8c", "horizon-color": "#f2a65a", "fog-color": "#d9a27a", "sky-horizon-blend": 0.7, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.75, "atmosphere-blend": 0.4 });
        if (n) n.textContent = `Lit for dusk or dawn: the sun is low at your planned departure (${when}).`;
      } else if (n) n.textContent = `Daylight at your planned departure (${when}).`;
    } catch (e) {}
  }
  const tiles = new Map();
  function elev(lat, lon) {
    const z = 12, n = 2 ** z, x = ((lon + 180) / 360) * n, sl = Math.sin(lat * R), y = (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * n;
    const tx = Math.floor(x), ty = Math.floor(y), key = `${tx}/${ty}`;
    let t = tiles.get(key);
    if (!t) {
      t = { data: null };
      tiles.set(key, t);
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { try { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0); const px = g.getImageData(0, 0, 256, 256).data, e = new Int16Array(65536); for (let i = 0, j = 0; i < 65536; i++, j += 4) e[i] = Math.round(px[j] * 256 + px[j + 1] + px[j + 2] / 256 - 32768); t.data = e; } catch (e) { t.data = false; } };
      img.onerror = () => { t.data = false; setTimeout(() => tiles.delete(key), 15000); };
      img.src = DEM.replace("{z}", z).replace("{x}", tx).replace("{y}", ty);
      if (tiles.size > 220) tiles.delete(tiles.keys().next().value);
    }
    if (!t.data) return null;
    const px = Math.min(255, Math.floor((x - tx) * 256)), py = Math.min(255, Math.floor((y - ty) * 256));
    return t.data[py * 256 + px]; // heights kept as whole meters (Int16) to keep memory low on phones
  }
  const st = { map: null, raf: 0, run: false, s: 0, last: 0, alt: null, view: "cockpit" };
  function stop() { st.run = false; cancelAnimationFrame(st.raf); }
  ROUTES.preview = function (el) {
    stop(); try { st.map && st.map.remove(); } catch (e) {} st.map = null;
    let f = null; try { f = currentFlight(); } catch (e) {}
    const pts = f ? (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon)) : [];
    if (pts.length < 2) { el.innerHTML = `<div class="page"><h1>Preview flight</h1><p>Plan a route with at least two points first.</p><p><a class="btn" href="#/plan">Plan a flight</a></p></div>`; return; }
    const T = track(pts), kt0 = speed(f), alt0 = planned(f);
    st.s = 0; st.alt = null;
    el.innerHTML = `<div class="page pv"><h1>Preview flight <span class="muted" style="font-size:.55em">${h(pts[0].ident)} to ${h(pts[pts.length - 1].ident)}, ${Math.round(T.total)} nm</span></h1>
      <p class="pv-disc">Preview for situational awareness only. Terrain and imagery are approximate and may be out of date. Only obstacles 200 ft AGL or taller from the FAA obstacle file are shown; wires and newer or shorter obstacles are not. Not for navigation.</p>
      <div class="pv-ctl">
        <button type="button" class="btn" id="pvPlay">Play</button>
        <label>Altitude <select id="pvMode"><option value="msl">Fixed MSL</option><option value="agl">Above ground</option></select></label>
        <label><input type="number" id="pvAlt" step="100" min="100" value="${alt0}"> ft</label>
        <label>Speed <select id="pvSpd"><option value="1">${kt0} kt, real time</option><option value="5">5x</option><option value="15" selected>15x</option><option value="40">40x</option></select></label>
        <label>View <select id="pvView"><option value="cockpit">Cockpit</option><option value="chase">Behind the aircraft</option><option value="top">Overhead</option></select></label>
        <label>Map <select id="pvBase"><option value="img">Satellite</option><option value="vfr">VFR sectional</option></select></label>
      </div>
      <div class="pv-wrap"><div id="pvMap"></div><div class="pv-hud" id="pvHud"></div><div class="pv-load" id="pvLoad">Loading 3D terrain…</div></div>
      <input type="range" id="pvScrub" min="0" max="1000" value="0" aria-label="Position along the route">
      <p class="small" id="pvObsN" style="margin:6px 0 0">Loading FAA obstacles along the route…</p>
      <p class="small" id="pvWxN" style="margin:4px 0 0">Loading current weather along the route…</p>
      <p class="small" id="pvMtrN" style="margin:4px 0 0"></p>
      <p class="small" id="pvSunN" style="margin:4px 0 0"></p>
      <p class="small muted">Terrain: AWS open elevation tiles (USGS and SRTM). Imagery: Esri World Imagery. Chart: FAA VFR sectional. For a low level or MTR route, choose Above ground and set the height you plan to fly.</p></div>`;
    const $ = (s) => el.querySelector(s);
    $("#pvMode").onchange = (e) => { if (e.target.value === "agl" && +$("#pvAlt").value > 3000) $("#pvAlt").value = 500; if (e.target.value === "msl" && +$("#pvAlt").value < 1000) $("#pvAlt").value = alt0; st.alt = null; frame(0, true); };
    $("#pvAlt").onchange = () => { st.alt = null; frame(0, true); };
    $("#pvView").onchange = (e) => { st.view = e.target.value; frame(0, true); };
    $("#pvScrub").oninput = (e) => { st.s = (T.total * +e.target.value) / 1000; st.alt = null; frame(0, true); };
    $("#pvPlay").onclick = () => { if (st.run) { stop(); $("#pvPlay").textContent = "Play"; } else { if (st.s >= T.total - 0.01) st.s = 0; st.run = true; st.last = performance.now(); $("#pvPlay").textContent = "Pause"; st.raf = requestAnimationFrame(loop); } };
    // Terrain height in meters MSL, read straight from the elevation tiles (zoom 12, about 40 m per pixel) so it
    // works for the ground under the aircraft even when that spot is out of the camera's view.
    function ground(p) { return elev(p.lat, p.lon); }
    function mtrAt(p) {
      let best = null;
      for (const g of st.mtr || []) for (const ln of g.lines) for (let i = 1; i < ln.length; i++) {
        const a = { lat: ln[i - 1][1], lon: ln[i - 1][0] }, b = { lat: ln[i][1], lon: ln[i][0] }, d = xt(a, b, p).d;
        if (d < 2.5 && (!best || d < best.d)) best = { ...g, d };
      }
      return best;
    }
    function frame(dtSec, force) {
      if (!st.map) return;
      const mode = $("#pvMode").value, setFt = Math.max(100, +$("#pvAlt").value || alt0), mult = +$("#pvSpd").value || 15;
      st.s = Math.min(T.total, st.s + (kt0 * mult * dtSec) / 3600);
      const p = T.at(st.s);
      const gM = ground(p);
      // Height above ground: look a little ahead too, so the camera climbs before a ridge, and smooth it
      let want;
      const seg = mode === "mtr" ? mtrAt(p) : null;
      const follow = mode === "agl" || (seg && seg.lo.agl);
      const aglFt = mode === "agl" ? setFt : seg ? seg.lo.ft + 200 : setFt;
      if (follow) {
        let g = gM || 0;
        for (const d of [0.3, 0.6, 1]) { const q = ahead(p, p.crs, d); const gq = ground(q); if (gq != null) g = Math.max(g, gq); }
        want = g + aglFt / FT;
        if (seg && !seg.hi.agl && seg.hi.ft) want = Math.min(want, (seg.hi.ft - 100) / FT);
      } else want = (seg ? seg.lo.ft + 200 : setFt) / FT;
      st.alt = st.alt == null || force ? want : st.alt + (want - st.alt) * Math.min(1, dtSec * 1.5);
      const altM = st.alt;
      try {
        if (st.view === "top") st.map.jumpTo({ center: [p.lon, p.lat], zoom: 11.5, pitch: 0, bearing: p.crs });
        else {
          // MapLibre puts the target on the terrain, so give the target its own terrain height and the camera its
          // true altitude; the camera then sits at the chosen altitude above sea level.
          let cam = p, camAlt = altM, tgt;
          if (st.view === "chase") { cam = ahead(p, (p.crs + 180) % 360, 0.9); camAlt = altM + 250; tgt = p; }
          else { const above = Math.max(60, altM - (gM || 0)); tgt = ahead(p, p.crs, Math.max(1.5, Math.min(12, (above * 6) / 1852))); }
          const tgtAlt = ground(tgt) || 0;
          const o = st.map.calculateCameraOptionsFromTo(new maplibregl.LngLat(cam.lon, cam.lat), Math.max(camAlt, tgtAlt + 30), new maplibregl.LngLat(tgt.lon, tgt.lat), tgtAlt);
          st.map.jumpTo(o);
        }
        const src = st.map.getSource("pvAc"); if (src) src.setData({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: {} });
      } catch (e) {}
      const gFt = gM == null ? null : gM * FT, mslFt = altM * FT, agl = gFt == null ? null : mslFt - gFt;
      // The tallest obstacle within 1 nm of the track in the next 5 nm
      let ob = null;
      for (const o of st.obs || []) { const b2 = brg(p, o), dd = dist(p, o); const off = Math.abs(Math.sin(((b2 - p.crs) * R))) * dd, fwd = Math.cos((b2 - p.crs) * R) * dd; if (fwd > 0 && fwd < 5 && off < 1 && (!ob || o.amsl > ob.amsl)) ob = { ...o, fwd }; }
      // Training route block and the nearest reported cloud base
      let blk = "";
      if (seg) { const loMsl = seg.lo.agl ? (gFt || 0) + seg.lo.ft : seg.lo.ft, hiMsl = seg.hi.agl ? (gFt || 0) + seg.hi.ft : seg.hi.ft; const out = mslFt < loMsl - 50 || (hiMsl && mslFt > hiMsl + 50); blk = `<div class="${out ? "low" : ""}"><small>Route block</small>${h(seg.text)}</div>`; }
      else if (mode === "mtr") blk = `<div><small>Route block</small>off the training route</div>`;
      let cl = null; for (const c of st.wx || []) { if (!c.ceilFt) continue; const d = dist(p, c); if (d < 25 && (!cl || d < cl.d)) cl = { ...c, d }; }
      const clHtml = cl ? `<div class="${mslFt > cl.ceilFt - 500 ? "low" : ""}"><small>Ceiling ${h(cl.station)}</small>${Math.round(cl.ceilFt / 100) * 100} MSL</div>` : "";
      const obHtml = ob ? `<div class="${ob.amsl > mslFt - 500 ? "low" : ""}"><small>Obstacle ahead</small>${h(ob.type)} ${Math.round(ob.amsl).toLocaleString("en-US")} MSL, ${ob.fwd.toFixed(1)} nm</div>` : "";
      $("#pvHud").innerHTML = `<div><small>Next</small>${h(p.next.ident)} ${p.toNext.toFixed(1)} nm</div><div><small>Course</small>${deg(p.crs)}T</div>
        <div><small>Altitude</small>${Math.round(mslFt / 10) * 10} ft MSL</div><div><small>Ground</small>${gFt == null ? "…" : `${Math.round(gFt / 10) * 10} ft`}</div>
        <div class="${agl != null && agl < 500 ? "low" : ""}"><small>Above ground</small>${agl == null ? "…" : `${Math.round(agl / 10) * 10} ft`}</div><div><small>Flown</small>${Math.round(st.s)} of ${Math.round(T.total)} nm</div>${blk}${clHtml}${obHtml}`;
      if (!force) $("#pvScrub").value = String(Math.round((st.s / T.total) * 1000));
      if (st.s >= T.total && st.run) { stop(); $("#pvPlay").textContent = "Replay"; }
    }
    function loop(now) { if (!st.run || !el.isConnected) return stop(); const dt = Math.min(0.25, (now - st.last) / 1000); st.last = now; frame(dt); st.raf = requestAnimationFrame(loop); }
    loadLib().then((ml) => {
      if (!el.isConnected) return;
      const line = { type: "Feature", geometry: { type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) }, properties: {} };
      const marks = { type: "FeatureCollection", features: pts.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { n: p.ident } })) };
      const map = new ml.Map({
        container: $("#pvMap"), maxPitch: 85, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), // lighter on phones and high density screens (Nov 8)
        attributionControl: { compact: true },
        style: { version: 8, glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: {
            img: { type: "raster", tiles: [IMG], tileSize: 256, maxzoom: 18, attribution: "Imagery Esri, Maxar, Earthstar Geographics" },
            vfr: { type: "raster", tiles: [VFR], tileSize: 256, minzoom: 8, maxzoom: 12, attribution: "FAA" },
            dem: { type: "raster-dem", tiles: [DEM], tileSize: 256, maxzoom: 14, encoding: "terrarium", attribution: "Elevation AWS open data, USGS, SRTM" },
            dem2: { type: "raster-dem", tiles: [DEM], tileSize: 256, maxzoom: 14, encoding: "terrarium" },
            route: { type: "geojson", data: line }, pts: { type: "geojson", data: marks },
            pvAc: { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [pts[0].lon, pts[0].lat] }, properties: {} } },
          },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#1b2433" } },
            { id: "img", type: "raster", source: "img" },
            { id: "vfr", type: "raster", source: "vfr", layout: { visibility: "none" } },
            { id: "hs", type: "hillshade", source: "dem2", paint: { "hillshade-exaggeration": 0.25 } },
            { id: "route", type: "line", source: "route", paint: { "line-color": "#FF4FD8", "line-width": 4, "line-opacity": 0.9 } },
            { id: "pts", type: "circle", source: "pts", paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#FF4FD8", "circle-stroke-width": 2 } },
            { id: "lbl", type: "symbol", source: "pts", layout: { "text-field": ["get", "n"], "text-size": 13, "text-offset": [0, -1.2], "text-font": ["Open Sans Semibold"] }, paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 } },
            { id: "ac", type: "circle", source: "pvAc", paint: { "circle-radius": 6, "circle-color": "#ffd23f", "circle-stroke-color": "#000", "circle-stroke-width": 2 } },
          ],
          terrain: { source: "dem", exaggeration: 1 },
          sky: { "sky-color": "#7fb0e6", "horizon-color": "#d6e6f5", "fog-color": "#e3ecf5", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.75, "atmosphere-blend": 0.4 },
        },
        center: [pts[0].lon, pts[0].lat], zoom: 11, pitch: 70, bearing: brg(pts[0], pts[1]),
      });
      st.map = map;
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), "bottom-right");
      $("#pvBase").onchange = (e) => { const v = e.target.value === "vfr"; map.setLayoutProperty("vfr", "visibility", v ? "visible" : "none"); map.setLayoutProperty("img", "visibility", v ? "none" : "visible"); };
      map.on("error", (e) => console.warn("preview map", e && e.error && e.error.message));
      // The full "load" waits for every tile; start as soon as the style is ready and drop the notice on first draw
      let started = false;
      const start = () => { if (started) return; started = true; frame(0, true); setTimeout(() => frame(0, true), 1500); };
      map.once("style.load", start); map.once("load", start);
      map.once("render", () => { const l = $("#pvLoad"); if (l) l.remove(); });
      st.obs = []; st.mtr = []; st.wx = [];
      map.once("style.load", () => {
        daylight(map, f, pts, el);
        loadMtr(f).then((segs) => {
          if (st.map !== map || !segs.length) return;
          st.mtr = segs;
          map.addSource("mtr", { type: "geojson", data: { type: "FeatureCollection", features: segs.map((g) => ({ type: "Feature", geometry: { type: "MultiLineString", coordinates: g.lines }, properties: {} })) } });
          map.addLayer({ id: "mtr", type: "line", source: "mtr", paint: { "line-color": "#7a5cff", "line-width": 3, "line-dasharray": [2, 1] } }, "route");
          const m = $("#pvMode"); if (m && !m.querySelector('[value="mtr"]')) { m.insertAdjacentHTML("beforeend", `<option value="mtr">Training route block</option>`); m.value = "mtr"; st.alt = null; frame(0, true); }
          const n = el.querySelector("#pvMtrN"); if (n) n.textContent = `Training route ${segs[0].name} drawn in purple. Training route block flies 200 ft above each segment's published floor.`;
        }).catch(() => {});
        clouds(pts).then((list) => {
          if (st.map !== map) return;
          st.wx = list;
          const withCeil = list.filter((c) => c.baseAgl != null);
          if (withCeil.length) {
            map.addSource("cld", { type: "geojson", data: { type: "FeatureCollection", features: withCeil.map((c) => ({ type: "Feature", geometry: { type: "Polygon", coordinates: [circle(c, 8)] }, properties: { b: c.baseAgl / FT, t: c.baseAgl / FT + 300 } })) } });
            map.addLayer({ id: "cld", type: "fill-extrusion", source: "cld", paint: { "fill-extrusion-color": "#f4f6f8", "fill-extrusion-base": ["get", "b"], "fill-extrusion-height": ["get", "t"], "fill-extrusion-opacity": 0.45 } });
          }
          const n = el.querySelector("#pvWxN");
          if (n) n.textContent = !list.length ? "No current weather reports near the route." : withCeil.length ? `Cloud bases from current reports at ${withCeil.map((c) => `${c.station} ${c.layer}`).join(", ")} are drawn as gray layers about 8 nm across. Current reports, not a forecast.` : `Current reports at ${list.map((c) => c.station).join(", ")} show no ceiling.`;
        }).catch(() => { const n = el.querySelector("#pvWxN"); if (n) n.textContent = "Current weather could not load."; });
      });
      map.once("style.load", () => obstacles(pts).then((list) => {
        if (st.map !== map) return;
        st.obs = list; const g = obsGeo(list);
        map.addSource("obsC", { type: "geojson", data: g.cols }); map.addSource("obsT", { type: "geojson", data: g.tops });
        map.addLayer({ id: "obsC", type: "fill-extrusion", source: "obsC", paint: { "fill-extrusion-color": "#ff3b3b", "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.9 } });
        map.addLayer({ id: "obsT", type: "symbol", source: "obsT", minzoom: 12, layout: { "text-field": ["get", "t"], "text-size": 11, "text-font": ["Open Sans Semibold"], "text-offset": [0, -1] }, paint: { "text-color": "#fff", "text-halo-color": "#b00020", "text-halo-width": 1.5 } });
        const n = el.querySelector("#pvObsN"); if (n) n.textContent = list.length ? `${list.length} obstacle${list.length === 1 ? "" : "s"} 200 ft AGL or taller within 3 nm of the route ${list.length === 1 ? "is" : "are"} drawn in red (FAA Digital Obstacle File).` : "No obstacles 200 ft AGL or taller were found within 3 nm of the route.";
      }));
    }).catch((e) => { const l = $("#pvLoad"); if (l) l.textContent = e.message || "3D preview could not load."; });
  };
  window.addEventListener("hashchange", () => { if (!/^#\/preview/.test(location.hash)) { stop(); try { st.map && st.map.remove(); } catch (e) {} st.map = null; } });

  // Ways in: the Maps Route tab, the Fly screen and the training route (MTR) panel
  new MutationObserver(() => {
    const add = (host, cls) => { if (host && !host.querySelector('[href="#/preview"]')) host.insertAdjacentHTML("beforeend", `<a class="btn sec sm ${cls || ""}" href="#/preview" style="margin:6px 6px 0 0">Preview in 3D</a>`); };
    add(document.querySelector("#ptsSec [data-tbl]"));
    const fly = document.querySelector(".fly .row"); if (fly) add(fly);
    add(document.querySelector("#mtrSec"));
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroPreview = { track, ahead, elev, state: st };
})();
