"use strict";
/* p127: approach profile while following your aircraft (p126). When you are lined up within about
   12 nm of a runway (nearest airports from nearfix, runway ends and elevations from the rwyends
   function, OurAirports data), a small profile appears on the map: a 3 degree reference path down
   to 50 ft over the threshold, your aircraft on it from GPS distance and GPS altitude, how far you
   are high or low of that path, and how far left or right of the extended centerline.
   It is a reference path from runway data, not the published glidepath or vertical guidance, and
   GPS altitude on a phone can be off by a hundred feet or more. Fly the approach chart. */
(function () {
  if (typeof L === "undefined") return;
  const css = document.createElement("style");
  css.textContent = `
    .ap-prof{position:absolute;left:10px;bottom:24px;z-index:1000;width:min(300px,calc(100% - 20px));background:rgba(5,10,20,.93);border:1px solid rgba(61,224,255,.6);border-radius:12px;padding:8px 10px;color:#EAF2FF;font:12px/1.35 var(--body,system-ui);box-shadow:0 4px 14px rgba(0,0,0,.5)}
    .ap-prof .t{display:flex;justify-content:space-between;gap:8px;font:700 11px var(--disp,system-ui);letter-spacing:1px;text-transform:uppercase;color:#3DE0FF}
    .ap-prof svg{width:100%;height:84px;display:block;margin:4px 0}
    .ap-prof .big{font:700 16px var(--mono,monospace)}
    .ap-prof .ok{color:#46e39b}.ap-prof .warn{color:#ffb547}.ap-prof .bad{color:#ff4d6a}
    .ap-prof .d{color:#ff4d6a;font-weight:700;font-size:10.5px;margin-top:4px}
  `;
  document.head.appendChild(css);
  const R = Math.PI / 180, FT = 6076.12, TAN3 = Math.tan(3 * R);
  function dist(a, b) { const p1 = a.lat * R, p2 = b.lat * R, dp = p2 - p1, dl = (b.lng - a.lng) * R; const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(x))); }
  function brg(a, b) { const p1 = a.lat * R, p2 = b.lat * R, dl = (b.lng - a.lng) * R; const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl); return (Math.atan2(y, x) / R + 360) % 360; }
  const adiff = (a, b) => { const d = ((a - b + 540) % 360) - 180; return d; };
  function move(p, crs, nm) { // point nm along a true course
    const d = nm / 3440.065, la1 = p.lat * R, lo1 = p.lng * R, c = crs * R;
    const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(c));
    const lo2 = lo1 + Math.atan2(Math.sin(c) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
    return L.latLng(la2 / R, lo2 / R);
  }
  const ends = new Map(); // airport ident -> promise of runway rows
  async function runways(ll) {
    let near = [];
    try { const d = await fnGet(`nearfix?lat=${ll.lat.toFixed(3)}&lon=${ll.lng.toFixed(3)}&r=15&only=report`); near = ((d && d.rows) || []).filter((x) => x.kind === "airport" && /^[A-Z]{3,4}$/.test(x.ident)).slice(0, 4); } catch { return []; }
    const need = near.map((x) => x.ident).filter((id) => !ends.has(id));
    if (need.length) {
      const pr = fnGet(`rwyends?ids=${need.join(",")}`).then((d) => (d && d.rows) || {}).catch(() => ({}));
      for (const id of need) ends.set(id, pr.then((rows) => rows[id] || []));
    }
    const out = [];
    for (const a of near) {
      for (const r of await ends.get(a.ident)) {
        if (r.closed || !(r.len >= 1500)) continue;
        for (const [th, far] of [[r.le, r.he], [r.he, r.le]]) {
          if (!th || !far || !isFinite(th.lat) || !isFinite(far.lat)) continue;
          const A = L.latLng(th.lat, th.lon), B = L.latLng(far.lat, far.lon), crs = brg(A, B);
          const thr = th.disp ? move(A, crs, th.disp / FT) : A;
          out.push({ ap: a.ident, rwy: th.id, thr, crs, elev: th.elev != null ? th.elev : far.elev });
        }
      }
    }
    return out;
  }
  function pick(cands, ll, trk) {
    let best = null;
    for (const c of cands) {
      const d = dist(c.thr, ll); if (d > 12 || d < 0.2) continue;
      const fromThr = brg(c.thr, ll), off = adiff(fromThr, (c.crs + 180) % 360);
      if (Math.abs(off) > 30) continue;
      if (trk != null && Math.abs(adiff(trk, c.crs)) > 45) continue;
      // off > 0 puts the aircraft left of the centerline as seen on final
      const along = d * Math.cos(off * R), lat = -d * Math.sin(off * R);
      if (!best || Math.abs(lat) < Math.abs(best.lat)) best = { ...c, along, lat };
    }
    return best;
  }
  function panel(map, a, fix) {
    let el = map.getContainer().querySelector(".ap-prof");
    if (!a) { if (el) el.remove(); return; }
    if (!el) { el = L.DomUtil.create("div", "ap-prof", map.getContainer()); L.DomEvent.disableClickPropagation(el); }
    const pathAlt = (a.elev || 0) + 50 + TAN3 * a.along * FT;
    const alt = fix.alt;
    const dev = alt != null ? alt - pathAlt : null;
    const cls = dev == null ? "" : Math.abs(dev) <= 150 ? "ok" : Math.abs(dev) <= 400 ? "warn" : "bad";
    // Profile drawing: runway at the right, distance to the left
    const W = 280, H = 84, maxNm = Math.max(5, Math.ceil(a.along + 1)), top = (a.elev || 0) + 50 + TAN3 * maxNm * FT;
    const minAlt = (a.elev || 0) - 100, maxAlt = Math.max(top, alt || 0) + 300;
    const X = (nm) => W - 8 - (nm / maxNm) * (W - 20), Y = (ft) => H - 8 - ((ft - minAlt) / (maxAlt - minAlt)) * (H - 16);
    const ticks = []; for (let n = 1; n < maxNm; n++) if (maxNm <= 6 || n % 2 === 0) ticks.push(`<line x1="${X(n)}" y1="${H - 8}" x2="${X(n)}" y2="${H - 4}" stroke="#9db2ce"/><text x="${X(n)}" y="${H}" text-anchor="middle" font-size="8" fill="#9db2ce">${n}</text>`);
    const lr = Math.abs(a.lat) < 0.05 ? "on the extended centerline" : `${Math.abs(a.lat).toFixed(1)} nm ${a.lat > 0 ? "right" : "left"} of the extended centerline`;
    el.innerHTML = `<div class="t"><span>${a.ap} RWY ${a.rwy} · 3° reference</span><span>${a.along.toFixed(1)} nm</span></div>
      <svg viewBox="0 0 ${W} ${H}"><line x1="0" y1="${Y(a.elev || 0)}" x2="${W}" y2="${Y(a.elev || 0)}" stroke="rgba(255,255,255,.2)"/>
        <rect x="${X(0) - 2}" y="${Y(a.elev || 0) - 2}" width="10" height="4" fill="#EAF2FF"/>
        <line x1="${X(0)}" y1="${Y((a.elev || 0) + 50)}" x2="${X(maxNm)}" y2="${Y(top)}" stroke="#3DE0FF" stroke-width="2" stroke-dasharray="5 4"/>
        ${ticks.join("")}
        ${alt != null ? `<circle cx="${X(Math.min(a.along, maxNm))}" cy="${Y(alt)}" r="5" fill="#FFD23F" stroke="#000"/>` : ""}</svg>
      <div class="big ${cls}">${dev == null ? "No GPS altitude" : Math.abs(dev) < 50 ? "On the 3° path" : `${Math.round(Math.abs(dev) / 10) * 10} ft ${dev > 0 ? "high" : "low"}`}</div>
      <div>${lr}${dev != null ? ` · path ${Math.round(pathAlt / 10) * 10} ft, you ${Math.round(alt / 10) * 10} ft GPS` : ""}</div>
      <div class="d">Reference path from runway data, not the published glidepath. GPS altitude can be off. Fly the chart.</div>`;
  }
  L.Map.addInitHook(function () {
    const map = this;
    let cands = [], from = null, busy = false;
    map.on("aerofix", async (e) => {
      const fix = e.fix, ll = fix.ll;
      if (!busy && (!from || dist(from, ll) > 3)) {
        busy = true; from = ll;
        try { cands = await runways(ll); } catch { cands = []; } finally { busy = false; }
      }
      panel(map, pick(cands, ll, e.trk), fix);
    });
    map.on("aerofixstop", () => panel(map, null));
  });
  window.AeroApproach = { pick, move };
})();
