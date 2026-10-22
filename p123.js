"use strict";
/* p123: an easier map.
   Satellite: a Satellite base layer (Esri World Imagery with place names and roads) on every map
   that has the chart choices, so pilots can look at fields, roads and clearings.
   Measure, like ForeFlight: hold two fingers still on the map for a moment and a line appears
   between them with the distance and magnetic course (p124); move your fingers to adjust, lift to keep it on
   screen for a few seconds. The Tools menu also has Measure distance (tap points; each leg and the
   total) and Measure landing zone (tap the corners; each side in feet and meters, the length and
   width, and the area). Points can be dragged.
   Tools menu: one button on the map replaces the separate Edit route, Plates and Glide buttons, and
   adds My location. Edit route's Undo shows only while editing.
   Side panel: the sort, corridor and filter settings fold under a Filters button with a one line
   summary, the accident patterns fold to their title, and the Safety search link becomes a chip. */
(function () {
  if (typeof L === "undefined") return;
  const css = document.createElement("style");
  css.textContent = `
    .leaflet-control.re-ctl:not(:has(button.on)){display:none!important}
    .leaflet-control.pl-btn,.leaflet-control.gl-btn{display:none!important}
    body.role-civil .leaflet-control.mn-leg{display:none!important}
    .ms-tools{background:#0d1a2b;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.45);border:1px solid rgba(61,224,255,.4)}
    .ms-tools > button{display:flex;align-items:center;gap:6px;appearance:none;border:0;background:transparent;color:#e8f6ff;font:700 13px/1 var(--disp,system-ui);letter-spacing:.5px;padding:10px 12px;cursor:pointer;min-height:40px}
    .ms-tools > button svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2}
    .ms-menu{position:absolute;left:0;top:calc(100% + 6px);min-width:230px;background:#0d1a2b;border:1px solid rgba(61,224,255,.4);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.55);padding:6px;display:none;z-index:1000}
    .ms-tools.open .ms-menu{display:block}
    .leaflet-right .ms-menu{left:auto;right:0}
    .ms-menu{max-height:min(70vh,520px);overflow:auto}
    .leaflet-top.leaflet-left:has(.ms-tools.open){z-index:1100}
    @media (max-width:860px){.ms-menu{position:fixed;left:12px;right:12px;top:auto;bottom:calc(var(--tabh,64px) + 20px + env(safe-area-inset-bottom,0px));min-width:0;z-index:10010}}
    .ms-menu button{display:flex;flex-direction:column;width:100%;align-items:flex-start;gap:2px;appearance:none;border:0;background:transparent;color:#e8f6ff;font:600 14px var(--body,system-ui);padding:10px 10px;border-radius:8px;cursor:pointer;text-align:left}
    .ms-menu button:hover,.ms-menu button:focus{background:rgba(61,224,255,.12);outline:none}
    .ms-menu button small{display:block;font-weight:400;font-size:11.5px;color:#9db2ce}
    .ms-menu hr{border:0;border-top:1px solid rgba(255,255,255,.1);margin:4px 0}
    .ms-lbl{background:rgba(5,10,20,.88);color:#fff;border:1px solid rgba(61,224,255,.8);border-radius:7px;padding:3px 7px;font:700 12.5px/1.25 var(--mono,monospace);white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.5);transform:translate(-50%,-50%);pointer-events:none}
    .ms-lbl.big{font-size:15px;padding:5px 9px}
    .ms-pt{width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #3DE0FF;box-shadow:0 0 0 2px rgba(0,0,0,.5);margin:-3px 0 0 -3px}
    .ms-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:1000;background:rgba(5,10,20,.95);color:#EAF2FF;border:1px solid rgba(61,224,255,.6);border-radius:12px;padding:8px 10px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;max-width:calc(100% - 24px);font:13.5px/1.35 var(--body,system-ui);box-shadow:0 6px 20px rgba(0,0,0,.5)}
    .ms-bar b{font-family:var(--mono,monospace)}
    .ms-bar button{appearance:none;border:1px solid rgba(255,255,255,.25);background:transparent;color:#EAF2FF;border-radius:8px;padding:6px 10px;font:600 12.5px var(--body,system-ui);cursor:pointer}
    .ms-bar button.p{background:#3DE0FF;color:#041018;border-color:#3DE0FF}
    .ms-me{width:16px;height:16px;border-radius:50%;background:#2f8cff;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,140,255,.25)}
    .map-measuring{cursor:crosshair}
    .leaflet-control-layers-toggle{width:40px!important;height:40px!important}
    #mctl .hzctl.ms-fold{display:none}
    #mctl .ms-filt{appearance:none;border:1px solid var(--line2,rgba(255,255,255,.2));background:transparent;color:var(--ink,#EAF2FF);border-radius:8px;padding:5px 10px;font:600 12px var(--body,system-ui);cursor:pointer;margin-right:6px}
    #mctl .ms-fsum{font-size:12.5px;color:var(--ink2,#9db2ce);margin:6px 0 0}
    #mctl #hzPat.ms-pc > :not(h3){display:none}
    #mctl #hzPat > h3{cursor:pointer}
    #mctl #hzPat > h3::after{content:" ▾";color:var(--cyan,#3DE0FF)}
    #mctl #hzPat.ms-pc > h3::after{content:" ▸"}
    #mctl #mpSafety{margin:0 0 6px}
    #mctl #mpSafety .small{display:none}
  `;
  document.head.appendChild(css);
  const R = Math.PI / 180;
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Satellite base layer next to the charts */
  const isChart = (l) => l && typeof l._url === "string" && /VFR_Sectional|IFR_Area|IFR_High/.test(l._url);
  L.Control.Layers.addInitHook(function () {
    const ls = this._layers || [];
    if (!ls.some((x) => !x.overlay && isChart(x.layer)) || ls.some((x) => /^Satellite/.test(x.name))) return;
    const img = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, maxNativeZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" });
    const roads = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, opacity: 0.8 });
    const names = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19 });
    this.addBaseLayer(L.layerGroup([img, roads, names]), "Satellite");
  });

  /* Geometry */
  function dist(a, b) { // nautical miles, great circle
    const p1 = a.lat * R, p2 = b.lat * R, dp = p2 - p1, dl = (b.lng - a.lng) * R;
    const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function brg(a, b) { const p1 = a.lat * R, p2 = b.lat * R, dl = (b.lng - a.lng) * R; const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl); return (Math.atan2(y, x) / R + 360) % 360; }
  const FT = 6076.12;
  const len = (nm) => nm < 0.5 ? `${Math.round(nm * FT).toLocaleString()} ft (${Math.round(nm * 1852).toLocaleString()} m)` : `${nm < 10 ? nm.toFixed(1) : Math.round(nm)} nm`;
  // Magnetic course (p124) when available, true otherwise
  const crs = (d, at) => { const M = window.AeroMag; const v = M && at ? M.magOf(d, at.lat, at.lng) : d; return `${String(Math.round(v) % 360 || 360).padStart(3, "0")}°${M && at ? "M" : "T"}`; };
  function areaFt2(pts) { // small polygons: local flat projection in feet
    if (pts.length < 3) return 0;
    const o = pts[0], k = Math.cos(o.lat * R);
    const xy = pts.map((p) => [(p.lng - o.lng) * 60 * k * FT, (p.lat - o.lat) * 60 * FT]);
    let a = 0; for (let i = 0; i < xy.length; i++) { const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length]; a += x1 * y2 - x2 * y1; }
    return Math.abs(a) / 2;
  }
  const label = (map, ll, html, big) => L.marker(ll, { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="ms-lbl${big ? " big" : ""}">${html}</div>` }) }).addTo(map);

  /* Two finger hold to measure */
  function twoFinger(map) {
    const el = map.getContainer();
    let timer = 0, start = null, active = false, g = null, keep = 0;
    const pt = (t) => map.containerPointToLatLng(map.mouseEventToContainerPoint(t));
    const clear = () => { if (g) { g.remove(); g = null; } };
    function draw(a, b) {
      clear();
      g = L.layerGroup().addTo(map);
      L.polyline([a, b], { color: "#000", weight: 7, opacity: 0.45, interactive: false }).addTo(g);
      L.polyline([a, b], { color: "#fff", weight: 3, dashArray: "8 6", interactive: false }).addTo(g);
      for (const p of [a, b]) L.circleMarker(p, { radius: 7, color: "#3DE0FF", weight: 3, fillColor: "#fff", fillOpacity: 1, interactive: false }).addTo(g);
      const d = dist(a, b);
      label(map, L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2), `${len(d)} · ${crs(brg(a, b), a)}`, true).addTo(g);
    }
    el.addEventListener("touchstart", (e) => {
      clearTimeout(keep);
      if (e.touches.length !== 2) { clearTimeout(timer); return; }
      start = [[e.touches[0].clientX, e.touches[0].clientY], [e.touches[1].clientX, e.touches[1].clientY]];
      clearTimeout(timer);
      timer = setTimeout(() => {
        active = true;
        map.dragging.disable(); map.touchZoom.disable();
        if (navigator.vibrate) try { navigator.vibrate(15); } catch {}
        draw(pt({ clientX: start[0][0], clientY: start[0][1] }), pt({ clientX: start[1][0], clientY: start[1][1] }));
      }, 420);
    }, { passive: true });
    // Window capture runs before the map's own pinch handling, so a held measure does not zoom
    window.addEventListener("touchmove", (e) => {
      if (!start) return;
      if (!active) {
        if (e.touches.length !== 2) { clearTimeout(timer); start = null; return; }
        const moved = [0, 1].some((i) => Math.hypot(e.touches[i].clientX - start[i][0], e.touches[i].clientY - start[i][1]) > 6);
        if (moved) { clearTimeout(timer); start = null; }
        return;
      }
      if (e.touches.length === 2) { e.preventDefault(); e.stopPropagation(); draw(pt(e.touches[0]), pt(e.touches[1])); }
    }, { capture: true, passive: false });
    const end = (e) => {
      clearTimeout(timer);
      if (active && e.touches.length < 2) {
        active = false; start = null;
        map.dragging.enable(); map.touchZoom.enable();
        keep = setTimeout(clear, 6000);
      } else if (!active && e.touches.length < 2) start = null;
    };
    window.addEventListener("touchend", end, true);
    window.addEventListener("touchcancel", end, true);
    map.on("click", () => { if (!active && g) { clearTimeout(keep); clear(); } });
  }

  // The Satellite choice in this map's layers menu
  const satInput = (map) => { const l = [...map.getContainer().querySelectorAll(".leaflet-control-layers-base label")].find((x) => /^\s*Satellite/.test(x.textContent)); return l ? l.querySelector("input") : null; };

  /* Tap to measure: distance or landing zone */
  function measurer(map) {
    let mode = null, pts = [], g = null, bar = null, markers = [];
    const clearDraw = () => { if (g) { g.remove(); g = null; } markers = []; };
    function stop() {
      mode = null; pts = []; clearDraw();
      if (bar) { bar.remove(); bar = null; }
      map.getContainer().classList.remove("map-measuring");
      map.doubleClickZoom.enable();
    }
    function redraw() {
      clearDraw();
      g = L.layerGroup().addTo(map);
      const lz = mode === "lz", ring = lz && pts.length >= 3 ? [...pts, pts[0]] : pts;
      if (ring.length >= 2) {
        L.polyline(ring, { color: "#000", weight: 7, opacity: 0.4, interactive: false }).addTo(g);
        L.polyline(ring, { color: lz ? "#FFB547" : "#fff", weight: 3, dashArray: lz ? null : "8 6", interactive: false }).addTo(g);
        if (lz && pts.length >= 3) L.polygon(pts, { stroke: false, fillColor: "#FFB547", fillOpacity: 0.18, interactive: false }).addTo(g);
      }
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i], b = ring[i + 1], d = dist(a, b);
        const mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
        label(map, mid, lz ? `${Math.round(d * FT).toLocaleString()} ft` : `${len(d)} · ${crs(brg(a, b), a)}`).addTo(g);
      }
      pts.forEach((p, i) => {
        const m = L.marker(p, { draggable: true, icon: L.divIcon({ className: "", iconSize: [16, 16], iconAnchor: [8, 8], html: '<div class="ms-pt"></div>' }) }).addTo(g);
        m.on("drag", (e) => { pts[i] = e.target.getLatLng(); });
        m.on("dragend", () => redraw());
        m.on("click", (e) => { L.DomEvent.stopPropagation(e); if (lz && i === 0 && pts.length >= 3) finish(); });
        markers.push(m);
      });
      paintBar();
    }
    function summary() {
      if (mode === "lz") {
        if (pts.length < 3) return `Tap the corners of the landing zone (${pts.length} of at least 3).`;
        const sides = pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]) * FT);
        const area = areaFt2(pts), longest = Math.max(...sides), width = area / longest;
        return `Landing zone about <b>${Math.round(longest).toLocaleString()} × ${Math.round(width).toLocaleString()} ft</b> (${Math.round(longest * 0.3048).toLocaleString()} × ${Math.round(width * 0.3048).toLocaleString()} m), ${area >= 43560 ? `${area >= 435600 ? Math.round(area / 43560).toLocaleString() : (area / 43560).toFixed(1)} acres` : `${Math.round(area).toLocaleString()} sq ft`}.`;
      }
      if (pts.length < 2) return pts.length ? "Now tap the next point." : "Tap points on the map to measure.";
      let tot = 0; for (let i = 1; i < pts.length; i++) tot += dist(pts[i - 1], pts[i]);
      return `Total <b>${len(tot)}</b>${pts.length > 2 ? ` over ${pts.length - 1} legs` : ` · ${crs(brg(pts[0], pts[1]), pts[0])}`}`;
    }
    function paintBar() {
      if (!bar) {
        bar = L.DomUtil.create("div", "ms-bar", map.getContainer());
        L.DomEvent.disableClickPropagation(bar); L.DomEvent.disableScrollPropagation(bar);
      }
      const sat = mode === "lz" && satInput(map) && !satInput(map).checked;
      bar.innerHTML = `<span>${summary()}</span>${sat ? '<button type="button" data-m="sat">Satellite</button>' : ""}<button type="button" data-m="undo">Undo</button><button type="button" data-m="clear">Clear</button><button type="button" class="p" data-m="done">Done</button>`;
      const sb = bar.querySelector('[data-m="sat"]'); if (sb) sb.onclick = () => { const i = satInput(map); if (i) i.click(); setTimeout(paintBar, 50); };
      bar.querySelector('[data-m="undo"]').onclick = () => { pts.pop(); redraw(); };
      bar.querySelector('[data-m="clear"]').onclick = () => { pts = []; redraw(); };
      bar.querySelector('[data-m="done"]').onclick = stop;
    }
    function finish() { redraw(); }
    function start(m) {
      // Measuring and route editing both use taps, so editing stops first
      const ed = document.querySelector(".re-ctl button.on"); if (ed) ed.click();
      stop(); mode = m; pts = [];
      map.getContainer().classList.add("map-measuring");
      map.doubleClickZoom.disable();
      redraw();
      if (m === "lz" && map.getZoom() < 14) toast("Zoom in on the landing zone, then tap its corners. Satellite view shows the ground best.");
    }
    // Taps are read on the map container before route lines, corridors and other layers see them,
    // so a measuring tap never opens a popup or edits the route. Drags still pan the map.
    const C = map.getContainer();
    let down = null;
    C.addEventListener("pointerdown", (e) => { down = mode ? [e.clientX, e.clientY] : null; }, true);
    C.addEventListener("click", (e) => {
      if (!mode) return;
      if (e.target.closest && e.target.closest(".leaflet-control, .ms-bar, .ms-pt, .pl-panel")) return;
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      e.stopPropagation(); e.preventDefault();
      pts.push(map.mouseEventToLatLng(e));
      setTimeout(() => map.closePopup(), 0);
      redraw();
    }, true);
    map.on("unload", stop);
    return { start, stop, active: () => !!mode, add: (p) => { if (!mode) return; pts.push(p); redraw(); } };
  }

  /* My location */
  function locate(map) {
    if (!navigator.geolocation) { toast("Location is not available on this device"); return; }
    navigator.geolocation.getCurrentPosition((p) => {
      const ll = L.latLng(p.coords.latitude, p.coords.longitude);
      if (map._msMe) map._msMe.remove();
      map._msMe = L.marker(ll, { interactive: false, icon: L.divIcon({ className: "", iconSize: [16, 16], iconAnchor: [8, 8], html: '<div class="ms-me"></div>' }) }).addTo(map);
      map.setView(ll, Math.max(map.getZoom(), 11));
    }, () => toast("Could not get your location. Check location permission."), { enableHighAccuracy: true, timeout: 10000 });
  }

  /* Tools menu */
  const ICON = '<svg viewBox="0 0 24 24"><path d="M3 17l14-14 4 4-14 14H3z M14 6l4 4 M7 13l2 2 M10 10l2 2"/></svg>';
  function tools(map, ms) {
    const ctl = L.control({ position: "topleft" });
    ctl.onAdd = () => {
      const d = L.DomUtil.create("div", "leaflet-control ms-tools");
      L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
      d.innerHTML = `<button type="button" aria-haspopup="true" aria-expanded="false" class="ms-open">${ICON}Tools</button><div class="ms-menu" role="menu"></div>`;
      const menu = d.querySelector(".ms-menu"), btn = d.querySelector(".ms-open");
      const items = () => {
        const has = (sel) => !!map.getContainer().querySelector(sel);
        const list = [
          ["dist", "Measure distance", "Tap points. Or hold two fingers on the map."],
          ["lz", "Measure landing zone", "Tap the corners for size and area"],
          null,
          has(".re-ctl button") ? ["edit", "Edit route", "Drag or add waypoints on the map"] : null,
          has(".pl-btn a") ? ["plates", "Approach plates", "Lay a plate on the map"] : null,
          has(".gl-btn") ? ["glide", "Glide from me", "Your gliding range from GPS"] : null,
          has(".gl-btn") ? ["glset", "Climb, descent and glide settings", "Used for TOC, TOD and glide range"] : null,
          ["me", "My location", "Center the map on you"],
          window.AeroPointTools ? ["pt", "Range rings and position", "Or press and hold anywhere on the map"] : null,
          map._rr && map._rr.getLayers().length ? ["rrx", "Clear range rings", "Remove every ring on this map"] : null,
        ];
        return list.filter((x, i) => x || i === 2);
      };
      const paint = () => {
        menu.innerHTML = items().map((x) => (x ? `<button type="button" role="menuitem" data-t="${x[0]}">${h(x[1])}<small>${h(x[2])}</small></button>` : "<hr>")).join("");
        menu.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => {
          d.classList.remove("open"); btn.setAttribute("aria-expanded", "false");
          const t = b.dataset.t, C = map.getContainer();
          if (t === "dist" || t === "lz") ms.start(t);
          else if (t === "edit") { ms.stop(); const e = C.querySelector(".re-ctl button"); if (e) e.click(); }
          else if (t === "plates") { const e = C.querySelector(".pl-btn a"); if (e) e.click(); }
          else if (t === "glide" || t === "glset") { const a = C.querySelectorAll(".gl-btn a"); const e = a[t === "glide" ? 0 : 1]; if (e) e.click(); }
          else if (t === "me") locate(map);
          else if (t === "pt") map.fire("contextmenu", { latlng: map.getCenter(), originalEvent: {} });
          else if (t === "rrx" && window.AeroPointTools) AeroPointTools.clearRings(map);
        }));
      };
      btn.onclick = () => { const o = !d.classList.contains("open"); if (o) paint(); d.classList.toggle("open", o); btn.setAttribute("aria-expanded", String(o)); };
      document.addEventListener("click", (e) => { if (!d.contains(e.target)) { d.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });
      return d;
    };
    ctl.addTo(map);
  }

  L.Map.addInitHook(function () {
    const map = this;
    setTimeout(() => {
      if (!map._container || !document.body.contains(map._container)) return;
      try {
        twoFinger(map);
        const ms = measurer(map);
        map._aeroMeasure = ms;
        tools(map, ms);
      } catch (e) { console.error(e); }
    }, 0);
  });

  /* Side panel on the Maps page */
  let t = 0, patOpen = false, filtOpen = false;
  function side() {
    if (!/^#\/maps(\/|$|\?)/.test(location.hash || "")) return;
    const p = document.getElementById("mctl");
    if (!p) return;
    const ctl = p.querySelector(".hzctl"), head = p.querySelector(".hzhead");
    if (ctl && head) {
      ctl.classList.toggle("ms-fold", !filtOpen);
      let b = head.querySelector(".ms-filt");
      if (!b) {
        b = document.createElement("button"); b.type = "button"; b.className = "ms-filt";
        const hide = head.querySelector("#mmin"); if (hide) hide.before(b); else head.querySelector(".row").appendChild(b);
        b.onclick = () => { filtOpen = !filtOpen; side(); };
      }
      const lbl = filtOpen ? "Close filters" : "Filters";
      if (b.textContent !== lbl) b.textContent = lbl;
      let s = head.querySelector(".ms-fsum");
      const sortB = ctl.querySelector("#hzsort button.on, #hzsort button[aria-pressed=true]");
      const corr = ctl.querySelector("#corr"), fat = ctl.querySelector("#fatalOnly"), dim = ctl.querySelector("#dimChart");
      const txt = [sortB ? sortB.textContent.trim() : "", corr ? corr.options[corr.selectedIndex].textContent : "", fat && fat.checked ? "fatal only" : "", dim && dim.checked ? "chart dimmed" : ""].filter(Boolean).join(" · ");
      if (!filtOpen) { if (!s) { s = document.createElement("p"); s.className = "ms-fsum"; head.appendChild(s); } if (s.textContent !== txt) s.textContent = txt; } else if (s) s.remove();
    }
    const pat = p.querySelector("#hzPat");
    if (pat) {
      pat.classList.toggle("ms-pc", !patOpen);
      const h3 = pat.querySelector(":scope > h3");
      if (h3 && !h3.dataset.ms) { h3.dataset.ms = "1"; h3.setAttribute("role", "button"); h3.tabIndex = 0; h3.onclick = () => { patOpen = !patOpen; side(); }; }
    }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(side, 200); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  // Tutorial spotlights for Edit route and Plates point at the Tools menu that now holds them
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    for (const k of ["civil", "military"]) for (const sc of (T && T[k] && T[k].scenes) || []) if (typeof sc.sel === "string" && /\.re-ctl|\.pl-btn/.test(sc.sel)) sc.sel = sc.sel.replace(/\.re-ctl|\.pl-btn/g, ".ms-tools");
  } catch {}
  window.AeroMeasure = { dist, brg, areaFt2, len };
})();
