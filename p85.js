"use strict";
/* p85: turbulence, icing and other weather advisory areas drawn on the Maps page, plus the newer
   brief features in the demo tour and the narrated tutorial.
   Map layer: an overlay "Turbulence and icing" in the layer control (on by default, remembered in
   S.advMapOn) with the G AIRMET areas for the forecast hour nearest now (turbulence amber, icing blue,
   IFR and mountain obscuration grey, low level wind shear red), SIGMETs and Center Weather Advisories,
   and turbulence or icing pilot reports as small markers. Data from the wxhaz relay for a box around
   the current flight's route (or the visible map when there is no route). */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const NAME = { "TURB-HI": "Turbulence above FL180", "TURB-LO": "Turbulence below FL180", ICE: "Icing", IFR: "IFR conditions", MT_OBSC: "Mountains obscured", LLWS: "Low level wind shear", SFC_WND: "Strong surface winds" };
  const color = (hz) => (/LLWS|CONV|TS/i.test(hz) ? "#ff4d6a" : /TURB|WND/i.test(hz) ? "#ffb648" : /IC/i.test(hz) ? "#5aa9ff" : "#9fb0c8");
  const lvl = (v) => { if (v == null || v === "") return ""; const s = String(v); if (/SFC/i.test(s)) return "surface"; if (/FZL/i.test(s)) return "freezing level"; const n = Number(s); if (!isFinite(n)) return s; const ft = n < 1000 ? n * 100 : n; return ft >= 18000 ? `FL${Math.round(ft / 100)}` : `${ft.toLocaleString("en-US")} ft`; };
  let ctl = null;
  L.Control.Layers.addInitHook(function () { ctl = this; });

  function bboxFor(map) {
    let f = null; try { f = currentFlight(); } catch {}
    const pts = ((f && f.points) || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    let a, b, c, d;
    if (pts.length) { a = Math.min(...pts.map((p) => p.lat)) - 1.5; c = Math.max(...pts.map((p) => p.lat)) + 1.5; b = Math.min(...pts.map((p) => p.lon)) - 1.5; d = Math.max(...pts.map((p) => p.lon)) + 1.5; }
    else { const bb = map.getBounds(); a = bb.getSouth(); b = bb.getWest(); c = bb.getNorth(); d = bb.getEast(); }
    a = Math.max(-89, a); c = Math.min(89, c); b = Math.max(-179, b); d = Math.min(179, d);
    if (c - a > 28) { const m = (a + c) / 2; a = m - 14; c = m + 14; }
    if (d - b > 38) { const m = (b + d) / 2; b = m - 19; d = m + 19; }
    return [a, b, c, d].map((v) => v.toFixed(1)).join(",");
  }

  function draw(group, data) {
    group.clearLayers();
    // One forecast hour per hazard: the earliest available (closest to now)
    const fh = {};
    for (const g of data.gairmets || []) fh[g.hazard] = Math.min(fh[g.hazard] ?? 99, g.fh);
    for (const g of (data.gairmets || []).filter((g) => g.fh === fh[g.hazard] && (g.pts || []).length > 2)) {
      const col = color(g.hazard);
      L.polygon(g.pts, { color: col, weight: 1.5, opacity: 0.85, fillColor: col, fillOpacity: 0.12, dashArray: /IFR|MT_OBSC/.test(g.hazard) ? "4 4" : null })
        .bindPopup(`<b>G AIRMET: ${h(NAME[g.hazard] || g.hazard)}</b><br>${h([lvl(g.base), lvl(g.top)].filter(Boolean).join(" to "))}${g.sev ? `<br>Intensity ${h(g.sev)}` : ""}${g.due ? `<br>Due to ${h(g.due)}` : ""}<br><span style="opacity:.75">Forecast hour ${g.fh}</span>`)
        .addTo(group);
    }
    for (const s of [...(data.sigmets || []), ...(data.cwas || [])].filter((s) => (s.pts || []).length > 2)) {
      const col = color(s.hazard || s.kind);
      L.polygon(s.pts, { color: col, weight: 2.5, opacity: 1, fillColor: col, fillOpacity: 0.18 })
        .bindPopup(`<b>${h(s.kind || "CWA")}: ${h(s.hazard)}</b>${s.to ? `<br>Until ${h(new Date(s.to).toISOString().slice(11, 16))}Z` : ""}<div style="font:11px monospace;white-space:pre-wrap;max-width:260px;margin-top:4px">${h(String(s.raw || "").slice(0, 600))}</div>`)
        .addTo(group);
    }
    for (const p of data.pireps || []) {
      const tb = p.tb && !/NEG|SMTH/i.test(p.tb), ic = p.ic && !/NEG/i.test(p.ic);
      if (!tb && !ic) continue;
      const col = tb ? "#ffb648" : "#5aa9ff";
      L.circleMarker([p.lat, p.lon], { radius: /SEV|EXTRM/i.test(`${p.tb} ${p.ic}`) ? 8 : 5, color: p.urgent ? "#ff4d6a" : col, weight: 2, fillColor: col, fillOpacity: 0.6 })
        .bindPopup(`<b>${p.urgent ? "URGENT " : ""}PIREP</b> ${h(p.ac || "")}${p.fl ? ` at ${h(lvl(p.fl))}` : ""}<br>${tb ? `Turbulence ${h(p.tb)}` : ""}${tb && ic ? ", " : ""}${ic ? `Icing ${h(p.ic)} ${h(p.icType || "")}` : ""}<div style="font:11px monospace;white-space:pre-wrap;max-width:260px;margin-top:4px">${h(p.raw)}</div>`)
        .addTo(group);
    }
  }

  L.Map.addInitHook(function () {
    const map = this;
    let tries = 0;
    const init = () => {
      if (map._advLayer) return;
      if (!(map._loaded && map._container && map._container.isConnected)) { if (++tries < 30) setTimeout(init, 400); return; }
      if (!/^#\/maps/.test(location.hash || "")) return;
      const group = L.featureGroup();
      map._advLayer = group;
      let loaded = "";
      const load = () => {
        const bb = bboxFor(map);
        if (bb === loaded) return;
        loaded = bb;
        fnGet(`wxhaz?bbox=${bb}`).then((d) => { if (d && !d.error) draw(group, d); }).catch(() => {});
      };
      if (S.advMapOn !== false) { group.addTo(map); load(); }
      const c = ctl && ctl._map === map ? ctl : null;
      if (c) c.addOverlay(group, "Turbulence and icing");
      map.on("overlayadd", (e) => { if (e.layer === group) { S.advMapOn = true; save(); load(); } });
      map.on("overlayremove", (e) => { if (e.layer === group) { S.advMapOn = false; save(); } });
      map.on("moveend", () => { let f = null; try { f = currentFlight(); } catch {} if (map.hasLayer(group) && !(f && (f.points || []).length)) load(); });
    };
    setTimeout(init, 700);
  });

  // Demo tour and narrated tutorial
  try {
    if (typeof TOURS !== "undefined") {
      for (const k of ["civil", "military"]) {
        const st = TOURS[k] && TOURS[k].steps;
        if (!Array.isArray(st) || st._p85) continue;
        st._p85 = true;
        const i = st.findIndex((s) => s[0] === "#/brief");
        if (i >= 0) st[i] = [st[i][0], st[i][1], `${st[i][2]} ${k === "military" ? "For training routes, the Low level route card times every leg and records your emergency abort altitude. " : ""}Runway winds shows the best runway, crosswind and density altitude at each airport, Diversion airports lists usable runways along the way, and Turbulence and icing shows the advisories that cross your route. After the flight, add your track log to see how close you passed to past accidents.`];
      }
    }
  } catch {}
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    for (const k of ["civil", "military"]) {
      const sc = T && T[k] && T[k].scenes;
      if (!sc || sc._p85) continue;
      sc._p85 = true;
      let at = sc.findIndex((s) => s.hash === "#/feedback");
      if (at < 0) at = sc.length - 1;
      const add = [
        { hash: "#/brief", sel: "#rwPanel", wait: "#rwPanel", text: "Runway winds picks the best runway at each airport and shows the headwind, the crosswind in gusts and the density altitude, checked against your own crosswind limit." },
        { hash: "#/brief", sel: "#dvPanel", wait: "#dvPanel", text: "Diversion airports lists the runways you could reach along the route, and points out any stretch where the nearest one is too far away." },
      ];
      if (k === "military") add.push({ hash: "#/brief", sel: "#llPanel", wait: "#llPanel", text: "For a training route, the low level card gives the course, distance and time for every leg, your entry and exit times, and the emergency abort altitude you record." });
      sc.splice(at, 0, ...add);
    }
  } catch (e) { console.error(e); }
})();
