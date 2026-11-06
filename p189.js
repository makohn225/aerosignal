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
   and towers, wires and other obstacles are not drawn. Nothing is stored or sent. */
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

  const tiles = new Map();
  function elev(lat, lon) {
    const z = 12, n = 2 ** z, x = ((lon + 180) / 360) * n, sl = Math.sin(lat * R), y = (0.5 - Math.log((1 + sl) / (1 - sl)) / (4 * Math.PI)) * n;
    const tx = Math.floor(x), ty = Math.floor(y), key = `${tx}/${ty}`;
    let t = tiles.get(key);
    if (!t) {
      t = { data: null };
      tiles.set(key, t);
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => { try { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0); t.data = g.getImageData(0, 0, 256, 256).data; } catch (e) { t.data = false; } };
      img.onerror = () => { t.data = false; setTimeout(() => tiles.delete(key), 15000); };
      img.src = DEM.replace("{z}", z).replace("{x}", tx).replace("{y}", ty);
      if (tiles.size > 400) tiles.delete(tiles.keys().next().value);
    }
    if (!t.data) return null;
    const px = Math.min(255, Math.floor((x - tx) * 256)), py = Math.min(255, Math.floor((y - ty) * 256)), i = (py * 256 + px) * 4;
    return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
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
      <p class="pv-disc">Preview for situational awareness only. Terrain and imagery are approximate and may be out of date, and towers, wires and other obstacles are not shown. Not for navigation.</p>
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
    function frame(dtSec, force) {
      if (!st.map) return;
      const mode = $("#pvMode").value, setFt = Math.max(100, +$("#pvAlt").value || alt0), mult = +$("#pvSpd").value || 15;
      st.s = Math.min(T.total, st.s + (kt0 * mult * dtSec) / 3600);
      const p = T.at(st.s);
      const gM = ground(p);
      // Height above ground: look a little ahead too, so the camera climbs before a ridge, and smooth it
      let want;
      if (mode === "agl") {
        let g = gM || 0;
        for (const d of [0.3, 0.6, 1]) { const q = ahead(p, p.crs, d); const gq = ground(q); if (gq != null) g = Math.max(g, gq); }
        want = g + setFt / FT;
      } else want = setFt / FT;
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
      $("#pvHud").innerHTML = `<div><small>Next</small>${h(p.next.ident)} ${p.toNext.toFixed(1)} nm</div><div><small>Course</small>${deg(p.crs)}T</div>
        <div><small>Altitude</small>${Math.round(mslFt / 10) * 10} ft MSL</div><div><small>Ground</small>${gFt == null ? "…" : `${Math.round(gFt / 10) * 10} ft`}</div>
        <div class="${agl != null && agl < 500 ? "low" : ""}"><small>Above ground</small>${agl == null ? "…" : `${Math.round(agl / 10) * 10} ft`}</div><div><small>Flown</small>${Math.round(st.s)} of ${Math.round(T.total)} nm</div>`;
      if (!force) $("#pvScrub").value = String(Math.round((st.s / T.total) * 1000));
      if (st.s >= T.total && st.run) { stop(); $("#pvPlay").textContent = "Replay"; }
    }
    function loop(now) { if (!st.run || !el.isConnected) return stop(); const dt = Math.min(0.25, (now - st.last) / 1000); st.last = now; frame(dt); st.raf = requestAnimationFrame(loop); }
    loadLib().then((ml) => {
      if (!el.isConnected) return;
      const line = { type: "Feature", geometry: { type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) }, properties: {} };
      const marks = { type: "FeatureCollection", features: pts.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { n: p.ident } })) };
      const map = new ml.Map({
        container: $("#pvMap"), maxPitch: 85, attributionControl: { compact: true },
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
  window.AeroPreview = { track, ahead, state: st };
})();
