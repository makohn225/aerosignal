"use strict";
/* p126: follow your aircraft on the map and on approach plates.
   Follow my aircraft (Tools menu): the device's GPS position as an aircraft symbol pointed along the
   track, a trail of where you have been, and a readout of groundspeed, magnetic track and GPS
   altitude. The map stays centered on you; pan away and a Recenter button brings it back. The
   screen stays awake while following, where the device allows it. A plate laid on the map (p49)
   shows your aircraft on the plan view in its true position.
   Plates line up tighter: the FAA georeference covers the whole page in its own Lambert projection,
   and fitting it straight onto the web map left the plan view up to about 70 m off. The plate's
   reference points are moved onto the plan view, computed exactly from the FAA projection, so the
   fit is accurate where you fly the approach.
   For situational awareness only, not for navigation. */
(function () {
  if (typeof L === "undefined") return;
  const R = Math.PI / 180;

  /* Plate georeference: four reference points on the plan view from the FAA Lambert projection */
  function tighten(geo) {
    try {
      if (!geo || !geo.params || !/LCC/i.test(geo.projection || "") || !geo.gpts || geo.gpts.length !== 8 || !geo.lpts || geo.lpts.length !== 8) return geo;
      const p = geo.params, sp1 = p.sp1 * R, sp2 = p.sp2 * R;
      const n = Math.abs(sp1 - sp2) < 1e-9 ? Math.sin(sp1) : Math.log(Math.cos(sp1) / Math.cos(sp2)) / Math.log(Math.tan(Math.PI / 4 + sp2 / 2) / Math.tan(Math.PI / 4 + sp1 / 2));
      const F = Math.cos(sp1) * Math.pow(Math.tan(Math.PI / 4 + sp1 / 2), n) / n;
      const rho = (la) => F / Math.pow(Math.tan(Math.PI / 4 + la * R / 2), n), r0 = rho(p.lat0);
      const fwd = (la, lo) => { const r = rho(la), t = n * (lo - p.cm) * R; return [r * Math.sin(t), r0 - r * Math.cos(t)]; };
      const inv = (x, y) => { const yy = r0 - y, r = Math.sign(n) * Math.hypot(x, yy), t = Math.atan2(Math.sign(n) * x, Math.sign(n) * yy); return [(2 * Math.atan(Math.pow(F / r, 1 / n)) - Math.PI / 2) / R, p.cm + t / n / R]; };
      // Affine from normalized page position (lpts) to projected coordinates, from the FAA corners
      const S = [], D = [];
      for (let k = 0; k < 4; k++) { S.push([geo.lpts[2 * k], geo.lpts[2 * k + 1]]); D.push(fwd(geo.gpts[2 * k], geo.gpts[2 * k + 1])); }
      const fit = (j) => { const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0]; S.forEach((s, i) => { const q = [s[0], s[1], 1]; for (let a = 0; a < 3; a++) { for (let b = 0; b < 3; b++) A[a][b] += q[a] * q[b]; v[a] += q[a] * D[i][j]; } }); return solve(A, v); };
      const fx = fit(0), fy = fit(1);
      if (!fx || !fy) return geo;
      // Residual check: the FAA corners must agree with the projection before trusting it
      const res = Math.max(...S.map((s, i) => Math.hypot(fx[0] * s[0] + fx[1] * s[1] + fx[2] - D[i][0], fy[0] * s[0] + fy[1] * s[1] + fy[2] - D[i][1])));
      const span = Math.hypot(D[2][0] - D[0][0], D[2][1] - D[0][1]);
      if (!(res < span * 1e-3)) return geo;
      // The plan view sits in the upper half of an approach page; put the points around it
      const L2 = [[0.3, 0.5], [0.7, 0.5], [0.7, 0.85], [0.3, 0.85]];
      const gpts = [], lpts = [];
      for (const [u, v] of L2) { const xy = [fx[0] * u + fx[1] * v + fx[2], fy[0] * u + fy[1] * v + fy[2]]; const ll = inv(xy[0], xy[1]); gpts.push(ll[0], ll[1]); lpts.push(u, v); }
      if (gpts.some((x) => !isFinite(x))) return geo;
      return { ...geo, gpts, lpts, tightened: true };
    } catch { return geo; }
  }
  function solve(A, b) {
    A = A.map((r) => r.slice()); b = b.slice();
    const n = 3;
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; if (Math.abs(A[c][c]) < 1e-15) return null; for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
    const x = [0, 0, 0]; for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; } return x;
  }
  if (typeof fnGet === "function") {
    const base = fnGet;
    fnGet = function (path) {
      const pr = base.apply(this, arguments);
      return /^plates\?geo=/.test(String(path)) ? pr.then((d) => (d && d.geo ? { ...d, geo: tighten(d.geo) } : d)) : pr;
    };
  }

  /* Follow my aircraft */
  const css = document.createElement("style");
  css.textContent = `
    .own-ac svg{width:34px;height:34px;filter:drop-shadow(0 0 3px rgba(0,0,0,.9))}
    .own-hud{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:1000;display:flex;gap:4px 12px;align-items:center;flex-wrap:wrap;justify-content:center;background:rgba(5,10,20,.92);border:1px solid rgba(61,224,255,.6);border-radius:12px;padding:6px 10px;color:#EAF2FF;font:12px/1.2 var(--body,system-ui);box-shadow:0 4px 14px rgba(0,0,0,.5);max-width:calc(100% - 120px)}
    .own-hud .v{display:flex;flex-direction:column;align-items:center;min-width:44px}
    .own-hud .v b{font:700 17px/1.1 var(--mono,monospace)}
    .own-hud .v span{font-size:10px;letter-spacing:1px;color:#9db2ce;text-transform:uppercase}
    .own-hud button{appearance:none;border:1px solid rgba(255,255,255,.3);background:transparent;color:#EAF2FF;border-radius:8px;padding:6px 9px;font:700 11.5px var(--body,system-ui);cursor:pointer}
    .own-hud button.p{background:#3DE0FF;color:#041018;border-color:#3DE0FF}
    .own-hud .d{flex-basis:100%;text-align:center;color:#ff4d6a;font-weight:700;font-size:10.5px}
  `;
  document.head.appendChild(css);
  const PLANE = '<svg viewBox="-12 -12 24 24"><path d="M0,-10 L1.6,-3 L9,1.5 L9,3.2 L1.6,1.2 L1.2,7 L3.6,8.8 L3.6,10 L0,9 L-3.6,10 L-3.6,8.8 L-1.2,7 L-1.6,1.2 L-9,3.2 L-9,1.5 L-1.6,-3 Z" fill="#FFD23F" stroke="#000" stroke-width="1"/></svg>';
  function dist(a, b) { const p1 = a.lat * R, p2 = b.lat * R, dp = p2 - p1, dl = (b.lng - a.lng) * R; const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(x))); }
  function brg(a, b) { const p1 = a.lat * R, p2 = b.lat * R, dl = (b.lng - a.lng) * R; const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl); return (Math.atan2(y, x) / R + 360) % 360; }

  function follower(map) {
    let watch = null, mk = null, trail = null, hud = null, follow = true, last = null, lock = null, trk = null, own = false;
    if (!map.getPane("ownship")) { const p = map.createPane("ownship"); p.style.zIndex = 690; p.style.pointerEvents = "none"; }
    const unlock = () => { try { if (lock) lock.release(); } catch {} lock = null; };
    async function keepAwake() { try { if ("wakeLock" in navigator) lock = await navigator.wakeLock.request("screen"); } catch {} }
    document.addEventListener("visibilitychange", () => { if (watch != null && document.visibilityState === "visible") keepAwake(); });
    function paintHud(fix) {
      if (!hud) {
        hud = L.DomUtil.create("div", "own-hud", map.getContainer());
        L.DomEvent.disableClickPropagation(hud); L.DomEvent.disableScrollPropagation(hud);
      }
      const gs = fix && fix.gs != null ? Math.round(fix.gs) : "--";
      const t = fix && trk != null ? (window.AeroMag ? AeroMag.magOf(trk, fix.ll.lat, fix.ll.lng) : trk) : null;
      const alt = fix && fix.alt != null ? Math.round(fix.alt / 10) * 10 : null;
      hud.innerHTML = `<div class="v"><b>${gs}</b><span>GS kt</span></div><div class="v"><b>${t == null ? "---" : String(Math.round(t) % 360 || 360).padStart(3, "0")}</b><span>TRK ${window.AeroMag ? "°M" : "°T"}</span></div><div class="v"><b>${alt == null ? "----" : alt.toLocaleString()}</b><span>GPS ALT ft</span></div>${follow ? "" : '<button type="button" class="p" data-o="re">Recenter</button>'}<button type="button" data-o="stop">Stop</button><div class="d">GPS position for awareness only. Not for navigation.</div>`;
      const re = hud.querySelector('[data-o="re"]'); if (re) re.onclick = () => { follow = true; if (last) map.panTo(last.ll, { animate: true }); paintHud(last); };
      hud.querySelector('[data-o="stop"]').onclick = stop;
    }
    function onFix(p) {
      const c = p.coords, ll = L.latLng(c.latitude, c.longitude), now = p.timestamp || Date.now();
      let gs = c.speed != null && isFinite(c.speed) ? c.speed * 1.943844 : null;
      if (last && dist(last.ll, ll) > 0.003) {
        const dt = (now - last.t) / 36e5;
        if (gs == null && dt > 0) gs = dist(last.ll, ll) / dt;
        trk = c.heading != null && isFinite(c.heading) && (gs || 0) > 3 ? c.heading : brg(last.ll, ll);
      } else if (c.heading != null && isFinite(c.heading)) trk = c.heading;
      const fix = { ll, t: now, gs, alt: c.altitude != null ? c.altitude * 3.28084 : null };
      if (!mk) mk = L.marker(ll, { pane: "ownship", interactive: false, keyboard: false, icon: L.divIcon({ className: "own-ac", iconSize: [34, 34], iconAnchor: [17, 17], html: `<div style="transform:rotate(0deg)">${PLANE}</div>` }) }).addTo(map);
      mk.setLatLng(ll);
      const el = mk.getElement && mk.getElement(); if (el && trk != null) el.firstChild.style.transform = `rotate(${trk}deg)`;
      if (!trail) trail = L.polyline([], { pane: "ownship", color: "#FFD23F", weight: 3, opacity: 0.8, dashArray: "2 6", interactive: false }).addTo(map);
      trail.addLatLng(ll);
      const pts = trail.getLatLngs(); if (pts.length > 1800) trail.setLatLngs(pts.slice(-1500));
      if (follow) { own = true; map.panTo(ll, { animate: true, duration: 0.5 }); setTimeout(() => (own = false), 700); }
      last = fix;
      paintHud(fix);
    }
    function start() {
      if (watch != null) { follow = true; if (last) map.panTo(last.ll); paintHud(last); return; }
      if (!navigator.geolocation) { toast("This device cannot share its position"); return; }
      follow = true; paintHud(null);
      watch = navigator.geolocation.watchPosition(onFix, (e) => { if (e && e.code === 1) { toast("Location permission is off. Allow it for AeroSignal to follow your aircraft."); stop(); } else if (!last || Date.now() - last.t > 20000) toast("Waiting for a GPS position…"); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
      keepAwake();
      if (map.getZoom() < 11) map.setZoom(11);
    }
    function stop() {
      if (watch != null) navigator.geolocation.clearWatch(watch);
      watch = null; unlock();
      if (hud) { hud.remove(); hud = null; }
      if (mk) { mk.remove(); mk = null; }
      if (trail) { trail.remove(); trail = null; }
      last = null; trk = null;
    }
    map.on("dragstart zoomstart", (e) => { if (watch != null && !own && e.type === "dragstart") { follow = false; paintHud(last); } });
    map.on("unload", stop);
    return { start, stop, on: () => watch != null };
  }

  L.Map.addInitHook(function () {
    const map = this;
    setTimeout(() => {
      if (!map._container || !document.body.contains(map._container)) return;
      map._aeroFollow = follower(map);
      // Add the item to this map's Tools menu (p123) each time it opens
      const tools = map.getContainer().querySelector(".ms-tools");
      if (!tools) return;
      const open = tools.querySelector(".ms-open");
      open.addEventListener("click", () => setTimeout(() => {
        const menu = tools.querySelector(".ms-menu");
        if (!menu || menu.querySelector('[data-t="follow"]')) return;
        const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.dataset.t = "follow";
        const on = map._aeroFollow.on();
        b.innerHTML = `${on ? "Stop following my aircraft" : "Follow my aircraft"}<small>${on ? "Turn off GPS tracking" : "Live GPS position, track and speed. Works on plates."}</small>`;
        b.onclick = () => { tools.classList.remove("open"); open.setAttribute("aria-expanded", "false"); if (map._aeroFollow.on()) map._aeroFollow.stop(); else map._aeroFollow.start(); };
        menu.prepend(b);
      }, 0));
    }, 30);
  });
  window.AeroFollow = { tighten };
})();
