"use strict";
/* p182: Fly screen (November 4, 2026). #/fly turns the current flight into an in flight display from the
   device GPS, the way an EFB's instrument strip works: groundspeed, magnetic track and GPS altitude; the
   next waypoint with distance, magnetic bearing and time to it (it moves on by itself as each waypoint is
   passed, or pick Direct to); the destination with distance, time en route and arrival time in local and
   Zulu; an estimate of fuel remaining and fuel at the destination from the nav log numbers (start fuel,
   taxi allowance and burn); a flight timer; and the nearest airports with bearing and distance. The screen
   stays awake while flying where the device allows it. Situational awareness only, not for navigation.
   Nothing is stored or sent except the nearest airport lookup. */
(function () {
  if (typeof ROUTES === "undefined") return;
  const R = Math.PI / 180, NM = 3440.065;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    .fly .fl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
    .fly .fl-t{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:8px 10px;background:rgba(0,0,0,.12)}
    .fly .fl-t small{display:block;font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--ink2,#9db2ce)}
    .fly .fl-t b{display:block;font:700 24px/1.15 var(--mono,monospace);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .fly .fl-t b em{font:600 12px var(--mono,monospace);font-style:normal;margin-left:3px;opacity:.8}
    .fly .fl-near{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:10px 12px}
    .fly .fl-near h2{margin:0 0 6px;font-size:15px}
    .fly .fl-t span{font-size:12px;color:var(--ink2,#9db2ce)}
    .fly .fl-t.wide{grid-column:span 3}
    .fly .fl-t.warn b{color:#ffb648}.fly .fl-t.bad b{color:#ff4d6a}
    .fly .row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
    .fly .fl-disc{color:#ff4d6a;font-weight:700;font-size:13px;margin:8px 0}
    .fly .fl-near li{margin:4px 0}
    .fly select{min-height:40px}
    @media (min-width:900px){.fly .fl-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.fly .fl-t.wide{grid-column:span 3}}`;
  document.head.appendChild(css);

  function dist(a, b) {
    const p1 = a.lat * R, p2 = b.lat * R, dp = p2 - p1, dl = (b.lon - a.lon) * R;
    const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * NM * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function brg(a, b) {
    const p1 = a.lat * R, p2 = b.lat * R, dl = (b.lon - a.lon) * R;
    const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) / R + 360) % 360;
  }
  const mag = (t, at) => { try { return window.AeroMag ? AeroMag.magOf(t, at.lat, at.lon) : t; } catch (e) { return t; } };
  const deg = (d) => String(Math.round(d) % 360 || 360).padStart(3, "0") + "°";
  const hm = (hrs) => { if (!isFinite(hrs) || hrs < 0) return "--:--"; const m = Math.round(hrs * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
  const clock = (d) => `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")} local · ${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
  const num = (v) => (v == null || v === "" || isNaN(+v) ? null : +v);

  // Advance past a waypoint once abeam or past it on the current leg, or within half a mile
  function nextIndex(pts, i, pos) {
    while (i < pts.length - 1) {
      const a = pts[i - 1] || pos, b = pts[i];
      const d = dist(pos, b);
      if (d < 0.5) { i++; continue; }
      if (i > 0) {
        const legB = brg(a, b), toB = brg(pos, b);
        const diff = Math.abs(((toB - legB + 540) % 360) - 180);
        if (diff > 100 && d < 5) { i++; continue; }
      }
      break;
    }
    return i;
  }
  function fuelInfo(f) {
    const o = f.nl || {}, wb = ((S.profiles || {})[f.tail] || {}).wb || {};
    return { fuel: num(o.fuel) ?? num((f.wb || {}).fuel), gph: num(o.gph) ?? num(wb.gph), taxi: num(o.taxi) ?? 1 };
  }

  const st = { watch: null, lock: null, pos: null, ni: 1, t0: null, last: null, near: null, nearAt: 0, el: null, f: null };
  function stop() {
    if (st.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(st.watch);
    st.watch = null;
    try { st.lock && st.lock.release(); } catch (e) {}
    st.lock = null;
  }
  async function wake() { try { if (navigator.wakeLock) st.lock = await navigator.wakeLock.request("screen"); } catch (e) {} }
  function feed(p) {
    // p: { lat, lon, altFt, kt, trk }
    const prev = st.pos;
    // Work out speed and track from successive fixes only when they are precise (a real GPS); a laptop's Wi-Fi
    // position wanders by hundreds of feet and would show a false groundspeed. (Nov 6 edit)
    const good = p.acc == null || p.acc <= 30;
    const dtS = prev ? (Date.now() - prev.at) / 1000 : 0;
    if (p.kt == null && prev && good && prev.acc != null && prev.acc <= 30 && dtS >= 2) p.kt = dist(prev, p) / (dtS / 3600);
    if (p.trk == null && prev && good && dist(prev, p) > 0.05) p.trk = brg(prev, p);
    st.coarse = p.acc != null && p.acc > 100;
    st.pos = { ...p, at: Date.now() };
    if (!st.t0 && (p.kt || 0) > 40) st.t0 = Date.now();
    render();
  }
  function start() {
    if (!navigator.geolocation) return toast("This device does not share a GPS position");
    stop(); wake();
    st.watch = navigator.geolocation.watchPosition((g) => {
      const c = g.coords;
      feed({ acc: c.accuracy, lat: c.latitude, lon: c.longitude, altFt: c.altitude != null ? c.altitude * 3.28084 : null, kt: c.speed != null && c.speed >= 0 ? c.speed * 1.94384 : null, trk: c.heading != null && !isNaN(c.heading) && (c.speed || 0) > 1 ? c.heading : null });
    }, (e) => { toast(e.code === 1 ? "Allow location for Vigilyn to use the Fly screen" : "No GPS position yet"); }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    render();
  }
  async function nearest() {
    const p = st.pos; if (!p) return;
    if (st.near && Date.now() - st.nearAt < 60000 && st.last && dist(st.last, p) < 3) return;
    st.nearAt = Date.now(); st.last = { lat: p.lat, lon: p.lon };
    try {
      const j = await fnGet(`divert?pts=${p.lat.toFixed(4)},${p.lon.toFixed(4)}&r=30&min=2000&paved=0`);
      const rows = (j && (j.airports || j.rows || j)) || [];
      st.near = (Array.isArray(rows) ? rows : []).map((a) => ({ ...a, d: dist(p, { lat: +a.lat, lon: +a.lon }), b: mag(brg(p, { lat: +a.lat, lon: +a.lon }), p) })).sort((x, y) => x.d - y.d).slice(0, 5);
      render();
    } catch (e) { st.near = []; }
  }
  // val may end in a unit ("118 kt"); the unit is drawn small so the number fits a phone width tile
  function tile(label, val, sub, cls) {
    const m = /^(.*?)\s(kt|nm|ft|gal)$/.exec(String(val));
    const v = m ? `${h(m[1])}<em>${m[2]}</em>` : h(val);
    return `<div class="fl-t ${cls || ""}"><small>${h(label)}</small><b>${v}</b>${sub ? `<span>${h(sub)}</span>` : ""}</div>`;
  }
  function render() {
    const el = st.el, f = st.f;
    if (!el || !el.isConnected || !f) { if (el && !el.isConnected) stop(); return; }
    const out = el.querySelector("#flOut"); if (!out) return;
    const pts = (f.points || []).filter((x) => x.ident && isFinite(x.lat) && isFinite(x.lon));
    const p = st.pos;
    const on = st.watch != null;
    el.querySelector("#flGo").textContent = on ? "Stop" : "Start flying";
    if (p && st.coarse && !(p.kt > 0)) { out.innerHTML = `<p class="muted">This device's position is only approximate (about ${Math.round((p.acc || 0) * 3.28084).toLocaleString("en-US")} ft), so it has no GPS. The Fly screen needs a phone or tablet with GPS, or a GPS receiver connected to this device.</p>`; return; }
    if (!p) { out.innerHTML = `<p class="muted">${on ? "Waiting for a GPS position…" : "Tap Start flying. Vigilyn uses this device's GPS."}</p>`; return; }
    st.ni = Math.max(1, Math.min(pts.length - 1, nextIndex(pts, st.ni, p)));
    const nx = pts[st.ni], dest = pts[pts.length - 1];
    const gs = p.kt || 0;
    const dN = dist(p, nx), bN = mag(brg(p, nx), p);
    let dD = dN; for (let i = st.ni; i < pts.length - 1; i++) dD += dist(pts[i], pts[i + 1]);
    const eteN = gs > 25 ? dN / gs : NaN, eteD = gs > 25 ? dD / gs : NaN;
    const eta = isFinite(eteD) ? clock(new Date(Date.now() + eteD * 36e5)) : "--";
    const fi = fuelInfo(f);
    let fuelNow = null, fuelDest = null;
    if (fi.fuel != null && fi.gph) {
      const hrs = st.t0 ? (Date.now() - st.t0) / 36e5 : 0;
      fuelNow = fi.fuel - (fi.taxi || 0) - fi.gph * hrs;
      if (isFinite(eteD)) fuelDest = fuelNow - fi.gph * eteD;
    }
    const resMin = fuelDest != null && fi.gph ? (fuelDest / fi.gph) * 60 : null;
    const timer = st.t0 ? hm((Date.now() - st.t0) / 36e5) : "0:00";
    out.innerHTML = `<div class="fl-grid">
        ${tile("Groundspeed", gs ? `${Math.round(gs)} kt` : "--")}
        ${tile("Track", p.trk != null ? `${deg(mag(p.trk, p))}M` : "--")}
        ${tile("GPS altitude", p.altFt != null ? `${(Math.round(p.altFt / 10) * 10).toLocaleString("en-US")} ft` : "--", "MSL, from GPS")}
        ${tile(`Next: ${nx.ident}`, `${dN.toFixed(1)} nm`, `${deg(bN)}M · ${hm(eteN)}`, "wide")}
        ${tile(`Destination: ${dest.ident}`, `${Math.round(dD)} nm`, `ETE ${hm(eteD)} · ETA ${eta}`, "wide")}
        ${tile("Fuel now (estimate)", fuelNow != null ? `${Math.max(0, fuelNow).toFixed(1)} gal` : "--", fuelNow != null ? `burn ${fi.gph} gal per hr` : "Set start fuel and burn in the nav log")}
        ${tile("Fuel at destination", fuelDest != null ? `${fuelDest.toFixed(1)} gal` : "--", resMin != null ? `about ${Math.max(0, Math.floor(resMin))} min reserve` : "", resMin != null && resMin < 30 ? "bad" : resMin != null && resMin < 45 ? "warn" : "")}
        ${tile("Flight time", timer, st.t0 ? "since takeoff roll" : "starts above 40 kt")}
      </div>
      <div class="fl-near"><h2>Nearest airports</h2>${st.near == null ? `<p class="muted" style="margin:0">Looking…</p>` : st.near.length ? `<ol style="margin:0 0 0 18px">${st.near.map((a) => `<li><b>${h(a.ident)}</b> ${h(a.name || "")}: ${a.d.toFixed(1)} nm, ${deg(a.b)}M${a.longest ? `, longest runway ${Number(a.longest).toLocaleString()} ft` : ""}</li>`).join("")}</ol>` : `<p class="muted" style="margin:0">None found within 30 nm.</p>`}</div>`;
    nearest();
  }

  ROUTES.fly = function (el) {
    let f = null; try { f = currentFlight(); } catch (e) {}
    st.el = el; st.f = f; st.ni = 1; st.t0 = null; st.near = null;
    const pts = f ? (f.points || []).filter((x) => x.ident && isFinite(x.lat) && isFinite(x.lon)) : [];
    el.innerHTML = `<div class="page fly"><h1>Fly${pts.length > 1 ? ` <span class="muted" style="font-size:.55em">${h(pts[0].ident)} to ${h(pts[pts.length - 1].ident)}</span>` : ""}</h1>
      <p class="fl-disc">Situational awareness only. Not for navigation. Fly with your certified avionics and approved charts.</p>
      ${pts.length > 1 ? `<div class="row"><button type="button" class="btn" id="flGo">Start flying</button>
        <label class="small" style="display:flex;align-items:center;gap:6px">Direct to <select id="flDto">${pts.slice(1).map((x, i) => `<option value="${i + 1}">${h(x.ident)}</option>`).join("")}</select></label>
        <a class="btn sec sm" href="#/maps">Map</a><a class="btn sec sm" href="#/brief">Brief</a></div>
        <div id="flOut"></div>` : `<p>Plan a flight with at least two points first.</p><p><a class="btn" href="#/plan">Plan a flight</a></p>`}
      </div>`;
    if (pts.length < 2) return;
    el.querySelector("#flGo").onclick = () => (st.watch != null ? (stop(), render()) : start());
    el.querySelector("#flDto").onchange = (e) => { st.ni = +e.target.value; render(); };
    render();
  };
  window.addEventListener("hashchange", () => { if (!/^#\/fly/.test(location.hash)) stop(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && st.watch != null) wake(); });

  // Entry points: a Fly button next to the Flight Service handoff on the brief
  new MutationObserver(() => {
    const go = document.querySelector("#fpPanel .fp-go");
    if (go && !go.querySelector('[href="#/fly"]')) go.insertAdjacentHTML("beforeend", `<a class="btn sec sm" href="#/fly">Fly this route</a>`);
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });

  window.AeroFly = { feed, dist, brg, nextIndex, state: st };
})();
