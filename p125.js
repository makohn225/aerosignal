"use strict";
/* p125: point tools on every map. Press and hold one finger on the map (right click on a computer)
   for a card about that spot:
   Position report: the radial and distance from the nearest VOR or TACAN and from the nearest public
   airport, like "MRB 155° at 11 nm" (magnetic from p124, nearest navaids and airports from the
   nearfix function), plus the latitude and longitude.
   Range rings: 5, 10 or 25 nm circles around the spot (any mix), labeled, cleared from the card or
   the Tools menu.
   Measure from here: starts Measure distance (p123) with this spot as the first point. */
(function () {
  if (typeof L === "undefined") return;
  const css = document.createElement("style");
  css.textContent = `
    .pt-card .leaflet-popup-content{margin:10px 12px;min-width:230px;font:13.5px/1.45 var(--body,system-ui)}
    .pt-card .pt-k{display:block;font:700 11px var(--disp,system-ui);letter-spacing:1.5px;text-transform:uppercase;color:var(--cyan,#3DE0FF);margin:8px 0 3px}
    .pt-card .pt-k:first-child{margin-top:0}
    .pt-card .pt-rep{font:700 15px var(--mono,monospace);margin:2px 0}
    .pt-card .pt-rep span{display:block;font:400 12px var(--body,system-ui);opacity:.75}
    .pt-card .pt-ll{font:12.5px var(--mono,monospace);opacity:.8}
    .pt-card .pt-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
    .pt-card .pt-row button{font:600 12.5px var(--body,system-ui);padding:6px 10px;border-radius:8px;border:1px solid rgba(127,140,160,.6);background:transparent;color:inherit;cursor:pointer}
    .pt-card .pt-row button.on{background:var(--cyan,#3DE0FF);color:#041018;border-color:var(--cyan,#3DE0FF)}
    .rr-lbl{font:700 11px var(--mono,monospace);color:#fff;background:rgba(5,10,20,.8);border:1px solid rgba(61,224,255,.8);border-radius:6px;padding:1px 5px;transform:translate(-50%,-50%);white-space:nowrap;pointer-events:none}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180;
  function dist(a, b) { const p1 = a.lat * R, p2 = b.lat * R, dp = p2 - p1, dl = (b.lng - a.lng) * R; const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(x))); }
  function brg(a, b) { const p1 = a.lat * R, p2 = b.lat * R, dl = (b.lng - a.lng) * R; const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl); return (Math.atan2(y, x) / R + 360) % 360; }
  const deg3 = (d) => String(Math.round(d) % 360 || 360).padStart(3, "0");
  // Radial from a station: the course from it to the spot, magnetic at the station
  function radial(st, p) {
    const t = brg(st, p), M = window.AeroMag;
    return M ? { v: deg3(M.magOf(t, st.lat, st.lng)), u: "°" } : { v: deg3(t), u: "°T" };
  }
  const dm = (v, pos, neg, w) => { const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60; return `${v >= 0 ? pos : neg}${String(d).padStart(w, "0")}°${m.toFixed(2).padStart(5, "0")}'`; };
  const llTxt = (p) => `${dm(p.lat, "N", "S", 2)} ${dm(p.lng, "E", "W", 3)}`;
  const nmTxt = (n) => n < 10 ? n.toFixed(1) : String(Math.round(n));

  async function nearby(p) {
    try { const d = await fnGet(`nearfix?lat=${p.lat.toFixed(4)}&lon=${p.lng.toFixed(4)}&r=30&only=report`); return (d && d.rows) || []; } catch { return null; }
  }

  function rings(map) {
    if (!map._rr) map._rr = L.layerGroup().addTo(map);
    return map._rr;
  }
  function addRing(map, c, nm) {
    const g = rings(map);
    const key = `${c.lat.toFixed(5)},${c.lng.toFixed(5)},${nm}`;
    const have = g.getLayers().find((l) => l._rrKey === key);
    if (have) { g.removeLayer(have); return false; }
    const grp = L.layerGroup();
    grp._rrKey = key;
    L.circle(c, { radius: nm * 1852, color: "#3DE0FF", weight: 2, dashArray: "6 6", fill: false, interactive: false }).addTo(grp);
    const top = L.latLng(c.lat + nm / 60, c.lng);
    L.marker(top, { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="rr-lbl">${nm} nm</div>` }) }).addTo(grp);
    if (!g.getLayers().some((l) => l._rrCenter && l._rrCenter === `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`)) {
      const dot = L.circleMarker(c, { radius: 4, color: "#3DE0FF", fillColor: "#fff", fillOpacity: 1, weight: 2, interactive: false });
      const dg = L.layerGroup([dot]); dg._rrCenter = `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`; dg.addTo(g);
    }
    grp.addTo(g);
    return true;
  }
  const ringCount = (map) => (map._rr ? map._rr.getLayers().filter((l) => l._rrKey).length : 0);
  function clearRings(map) { if (map._rr) map._rr.clearLayers(); }

  function card(map, p) {
    const C = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const on = (nm) => !!(map._rr && map._rr.getLayers().some((l) => l._rrKey === `${C},${nm}`));
    const pop = L.popup({ className: "pt-card", maxWidth: 300, autoPanPadding: [20, 20] }).setLatLng(p);
    const paint = (rep) => {
      const repHtml = rep === undefined ? `<div class="pt-ll">Finding the nearest VOR and airport…</div>`
        : rep === null ? `<div class="pt-ll">Could not look up nearby navaids just now.</div>`
        : rep.length ? rep.map((x) => `<div class="pt-rep">${h(x.ident)} ${x.r.v}${x.r.u} at ${nmTxt(x.nm)} nm <span>${h(x.what)}</span></div>`).join("") : `<div class="pt-ll">No VOR or airport within 30 nm.</div>`;
      pop.setContent(`<b class="pt-k">Position</b>${repHtml}<div class="pt-ll">${h(llTxt(p))}</div>
        <b class="pt-k">Range rings</b><div class="pt-row">${[5, 10, 25].map((n) => `<button type="button" data-rr="${n}" class="${on(n) ? "on" : ""}">${n} nm</button>`).join("")}${ringCount(map) ? `<button type="button" data-rr="clear">Clear rings</button>` : ""}</div>
        <div class="pt-row"><button type="button" data-ms="1">Measure from here</button></div>`);
      const el = pop.getElement();
      if (!el) return;
      el.querySelectorAll("[data-rr]").forEach((b) => (b.onclick = (e) => { L.DomEvent.stop(e); const v = b.dataset.rr; if (v === "clear") clearRings(map); else addRing(map, p, +v); paint(rep); }));
      const ms = el.querySelector("[data-ms]");
      if (ms) ms.onclick = (e) => { L.DomEvent.stop(e); map.closePopup(); if (map._aeroMeasure) { map._aeroMeasure.start("dist"); map._aeroMeasure.add && map._aeroMeasure.add(p); } };
    };
    pop.openOn(map);
    paint(undefined);
    nearby(p).then((rows) => {
      if (rows == null) return paint(null);
      const ll = (x) => L.latLng(x.lat, x.lon);
      const vor = rows.find((x) => x.kind === "navaid");
      const ap = rows.find((x) => x.kind === "airport" && /^[A-Z]{3,4}$/.test(x.ident)) || rows.find((x) => x.kind === "airport");
      const out = [];
      for (const [x, what] of [[vor, vor && /TACAN/.test(vor.type || "") && !/VOR/.test(vor.type || "") ? "TACAN" : "VOR"], [ap, "airport"]]) {
        if (!x) continue;
        const s = ll(x);
        out.push({ ident: x.ident, what: `${what}${x.name ? ", " + x.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : ""}`, nm: dist(s, p), r: radial(s, p) });
      }
      paint(out);
    });
  }

  L.Map.addInitHook(function () {
    const map = this;
    map.on("contextmenu", (e) => {
      const t = e.originalEvent && e.originalEvent.target;
      if (t && t.closest && t.closest(".leaflet-marker-icon, .leaflet-control, .pl-panel")) return;
      if (map._aeroMeasure && map._aeroMeasure.active && map._aeroMeasure.active()) return;
      card(map, e.latlng);
    });
  });
  window.AeroPointTools = { radial, addRing, clearRings };
})();
