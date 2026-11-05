"use strict";
/* p185: the magenta route line follows the drag (November 5, 2026, from tester feedback: "it says you can drag
   and drop or edit points for the route but it doesn't seem to move the magenta line"). In Edit route on the
   map (p39), dragging a waypoint or a leg's middle dot only moved a thin dashed line; the solid magenta route
   stayed put until the drop was looked up and the map redrew. Now the magenta route itself moves with the
   finger or mouse while dragging. If the change cannot be plotted, it springs back. */
(function () {
  if (typeof L === "undefined") return;
  const same = (a, b) => Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
  function routeLine(map, pts) {
    let best = null;
    map.eachLayer((l) => {
      if (!(l instanceof L.Polyline) || l instanceof L.Polygon) return;
      const ll = l.getLatLngs(); if (!Array.isArray(ll) || ll.length !== pts.length || Array.isArray(ll[0])) return;
      if (l.options && l.options.dashArray) return; // the edit layer's own dashed line
      if (ll.every((p, i) => same(p, L.latLng(pts[i].lat, pts[i].lon)))) best = best || l;
    });
    return best;
  }
  function hook(map) {
    if (map._vgFollow) return; map._vgFollow = true;
    map.on("layeradd", (e) => {
      const m = e.layer;
      if (!(m instanceof L.Marker) || !m.options || !m.options.draggable || m._vgFollow) return;
      const html = (m.options.icon && m.options.icon.options && m.options.icon.options.html) || "";
      if (!/re-h|re-g/.test(html)) return; // only the Edit route handles
      m._vgFollow = true;
      let line = null, base = null, idx = -1, insert = false;
      m.on("dragstart", () => {
        let f = null; try { f = currentFlight(); } catch (err) {}
        const pts = ((f && f.points) || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
        line = pts.length > 1 ? routeLine(map, pts) : null;
        if (!line) return;
        base = line.getLatLngs().map((p) => L.latLng(p.lat, p.lng));
        const s = m.getLatLng();
        idx = base.findIndex((p) => same(p, s)); insert = false;
        if (idx < 0) {
          // A leg's middle dot: insert between the two ends of that leg
          for (let i = 1; i < base.length; i++) { const mid = L.latLng((base[i - 1].lat + base[i].lat) / 2, (base[i - 1].lng + base[i].lng) / 2); if (same(mid, s)) { idx = i; insert = true; break; } }
        }
        if (idx < 0) line = null;
      });
      m.on("drag", () => {
        if (!line) return;
        const ll = base.slice(); const at = m.getLatLng();
        if (insert) ll.splice(idx, 0, at); else ll[idx] = at;
        line.setLatLngs(ll);
      });
      m.on("dragend", () => {
        const l = line, b = base; line = null;
        // The map redraws once the new point is plotted; put the line back if that does not happen
        if (l && b) setTimeout(() => { try { if (l._map) l.setLatLngs(b); } catch (err) {} }, 6000);
      });
    });
  }
  let t = 0;
  const scan = () => { try { if (typeof leafletMap !== "undefined" && leafletMap) hook(leafletMap); } catch (e) {} };
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 300); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroRouteFollow = { routeLine };
})();
