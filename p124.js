"use strict";
/* p124: magnetic courses. Magnetic variation anywhere on earth from the International Geomagnetic
   Reference Field (IGRF 14, IAGA, public domain), computed on the device with no network. Used by:
   the map's measure tools, which now show magnetic courses (°M) like ForeFlight; the military
   kneeboard cards, whose Magnetic variation box fills in from the route when left empty so the
   navlog's magnetic course column is complete; and the civil kneeboard card, which lists the
   variation along the route. Checked against the reference IGRF code to a hundredth of a degree. */
(function () {
  // n, m, g (2025.0), g change per year, h (2025.0), h change per year (nT)
  const C = [[1,0,-29350.0,12.6,0.0,0.0],[1,1,-1410.3,10.0,4545.5,-21.5],[2,0,-2556.2,-11.2,0.0,0.0],[2,1,2950.9,-5.3,-3133.6,-27.3],[2,2,1648.7,-8.3,-814.2,-11.1],[3,0,1360.9,-1.5,0.0,0.0],[3,1,-2404.2,-4.4,-56.9,3.8],[3,2,1243.8,0.4,237.6,-0.2],[3,3,453.4,-15.6,-549.6,-3.9],[4,0,894.7,-1.7,0.0,0.0],[4,1,799.6,-2.3,278.6,-1.3],[4,2,55.8,-5.8,-134.0,4.1],[4,3,-281.1,5.4,212.0,1.6],[4,4,12.0,-6.8,-375.4,-4.1],[5,0,-232.9,0.6,0.0,0.0],[5,1,369.0,1.3,45.3,-0.5],[5,2,187.2,0.0,220.0,2.1],[5,3,-138.7,0.7,-122.9,0.5],[5,4,-141.9,2.3,42.9,1.7],[5,5,20.9,1.0,106.2,1.9],[6,0,64.3,-0.2,0.0,0.0],[6,1,63.8,-0.3,-18.4,0.3],[6,2,76.7,0.8,16.8,-1.6],[6,3,-115.7,1.2,48.9,-0.4],[6,4,-40.9,-0.8,-59.8,0.8],[6,5,14.9,0.4,10.9,0.7],[6,6,-60.8,0.9,72.8,0.9],[7,0,79.6,-0.1,0.0,0.0],[7,1,-76.9,-0.1,-48.9,0.6],[7,2,-8.8,-0.1,-14.4,0.5],[7,3,59.3,0.5,-1.0,-0.7],[7,4,15.8,-0.1,23.5,0.0],[7,5,2.5,-0.8,-7.4,-0.9],[7,6,-11.2,-0.8,-25.1,0.5],[7,7,14.3,0.9,-2.2,-0.3],[8,0,23.1,-0.1,0.0,0.0],[8,1,10.9,0.2,7.2,-0.3],[8,2,-17.5,0.0,-12.6,0.4],[8,3,2.0,0.4,11.5,-0.3],[8,4,-21.8,-0.1,-9.7,0.4],[8,5,16.9,0.3,12.7,-0.5],[8,6,14.9,0.1,0.7,-0.6],[8,7,-16.8,0.0,-5.2,0.3],[8,8,1.0,0.3,3.9,0.2],[9,0,4.7,0.0,0.0,0.0],[9,1,8.0,0.0,-24.8,0.0],[9,2,3.0,0.0,12.1,0.0],[9,3,-0.2,0.0,8.3,0.0],[9,4,-2.5,0.0,-3.4,0.0],[9,5,-13.1,0.0,-5.3,0.0],[9,6,2.4,0.0,7.2,0.0],[9,7,8.6,0.0,-0.6,0.0],[9,8,-8.7,0.0,0.8,0.0],[9,9,-12.8,0.0,9.8,0.0],[10,0,-1.3,0.0,0.0,0.0],[10,1,-6.4,0.0,3.3,0.0],[10,2,0.2,0.0,0.1,0.0],[10,3,2.0,0.0,2.5,0.0],[10,4,-1.0,0.0,5.4,0.0],[10,5,-0.5,0.0,-9.0,0.0],[10,6,-0.9,0.0,0.4,0.0],[10,7,1.5,0.0,-4.2,0.0],[10,8,0.9,0.0,-3.8,0.0],[10,9,-2.6,0.0,0.9,0.0],[10,10,-3.9,0.0,-9.0,0.0],[11,0,3.0,0.0,0.0,0.0],[11,1,-1.4,0.0,0.0,0.0],[11,2,-2.5,0.0,2.8,0.0],[11,3,2.4,0.0,-0.6,0.0],[11,4,-0.6,0.0,0.1,0.0],[11,5,0.0,0.0,0.5,0.0],[11,6,-0.6,0.0,-0.3,0.0],[11,7,-0.1,0.0,-1.2,0.0],[11,8,1.1,0.0,-1.7,0.0],[11,9,-1.0,0.0,-2.9,0.0],[11,10,-0.1,0.0,-1.8,0.0],[11,11,2.6,0.0,-2.3,0.0],[12,0,-2.0,0.0,0.0,0.0],[12,1,-0.1,0.0,-1.2,0.0],[12,2,0.4,0.0,0.6,0.0],[12,3,1.2,0.0,1.0,0.0],[12,4,-1.2,0.0,-1.5,0.0],[12,5,0.6,0.0,0.0,0.0],[12,6,0.5,0.0,0.6,0.0],[12,7,0.5,0.0,-0.2,0.0],[12,8,-0.1,0.0,0.8,0.0],[12,9,-0.5,0.0,0.1,0.0],[12,10,-0.2,0.0,-0.9,0.0],[12,11,-1.2,0.0,0.1,0.0],[12,12,-0.7,0.0,0.2,0.0],[13,0,0.2,0.0,0.0,0.0],[13,1,-0.9,0.0,-0.9,0.0],[13,2,0.6,0.0,0.7,0.0],[13,3,0.7,0.0,1.2,0.0],[13,4,-0.2,0.0,-0.3,0.0],[13,5,0.5,0.0,-1.3,0.0],[13,6,0.1,0.0,-0.1,0.0],[13,7,0.7,0.0,0.2,0.0],[13,8,0.0,0.0,-0.2,0.0],[13,9,0.3,0.0,0.5,0.0],[13,10,0.2,0.0,0.6,0.0],[13,11,0.4,0.0,-0.6,0.0],[13,12,-0.5,0.0,-0.3,0.0],[13,13,-0.4,0.0,-0.5,0.0]];
  const R = Math.PI / 180;
  const yearOf = (d) => { d = d || new Date(); const y = d.getFullYear(); return y + (d - new Date(y, 0, 1)) / (new Date(y + 1, 0, 1) - new Date(y, 0, 1)); };
  // East is positive, west negative
  function decl(lat, lon, altFt, date) {
    const a = 6378.137, b = 6356.7523142, re = 6371.2, alt = (altFt || 0) * 0.0003048, t = Math.min(5, Math.max(0, yearOf(date) - 2025));
    const N = 13, a2 = a * a, b2 = b * b, c2 = a2 - b2, slat = Math.sin(lat * R), clat = Math.cos(lat * R);
    const q = Math.sqrt(a2 - c2 * slat * slat), q1 = alt * q, q2 = ((q1 + a2) / (q1 + b2)) ** 2;
    const ct = slat / Math.sqrt(q2 * clat * clat + slat * slat), st = Math.sqrt(1 - ct * ct);
    const r = Math.sqrt(alt * alt + 2 * q1 + (a2 * a2 - (a2 * a2 - b2 * b2) * slat * slat) / (q * q));
    const d = Math.sqrt(a2 * clat * clat + b2 * slat * slat), ca = (alt + d) / r, sa = c2 * clat * slat / (r * d);
    const P = [], dP = [], S = [];
    for (let n = 0; n <= N; n++) { P.push(new Array(N + 1).fill(0)); dP.push(new Array(N + 1).fill(0)); S.push(new Array(N + 1).fill(0)); }
    P[0][0] = 1; S[0][0] = 1;
    for (let n = 1; n <= N; n++) { S[n][0] = S[n - 1][0] * (2 * n - 1) / n; for (let m = 1; m <= n; m++) S[n][m] = S[n][m - 1] * Math.sqrt((n - m + 1) * (m === 1 ? 2 : 1) / (n + m)); }
    for (let n = 1; n <= N; n++) for (let m = 0; m <= n; m++) {
      if (n === m) { P[n][m] = st * P[n - 1][m - 1]; dP[n][m] = st * dP[n - 1][m - 1] + ct * P[n - 1][m - 1]; }
      else { const K = n > 1 ? ((n - 1) ** 2 - m * m) / ((2 * n - 1) * (2 * n - 3)) : 0; P[n][m] = ct * P[n - 1][m] - (n > 1 ? K * P[n - 2][m] : 0); dP[n][m] = ct * dP[n - 1][m] - st * P[n - 1][m] - (n > 1 ? K * dP[n - 2][m] : 0); }
    }
    let br = 0, bt = 0, bp = 0; const lam = lon * R;
    for (const [n, m, g0, gs, h0, hs] of C) {
      const g = (g0 + gs * t) * S[n][m], h = (h0 + hs * t) * S[n][m], ar = (re / r) ** (n + 2), cm = Math.cos(m * lam), sm = Math.sin(m * lam), tmp = g * cm + h * sm;
      br += (n + 1) * ar * tmp * P[n][m]; bt -= ar * tmp * dP[n][m]; bp += ar * m * (g * sm - h * cm) * P[n][m] / (st || 1e-9);
    }
    return Math.atan2(bp, -bt * ca - br * sa) / R;
  }
  const label = (v) => `${Math.round(Math.abs(v))}°${v >= 0 ? "E" : "W"}`;
  const magOf = (trueDeg, lat, lon) => (trueDeg - decl(lat, lon) + 720) % 360;
  window.AeroMag = { decl, label, magOf };

  // Kneeboard cards: fill an empty Magnetic variation box from the route
  let t = 0;
  function fill() {
    const inp = document.getElementById("kbVar");
    if (inp && !inp.value.trim() && !inp.dataset.mag) {
      const id = decodeURIComponent((location.hash.split("/")[2] || "").split("?")[0]);
      inp.dataset.mag = "1";
      (async () => {
        let pts = [];
        try { const m = (S.missions || []).find((x) => x.id === id); if (m && typeof missionRoute === "function") { const r = await missionRoute(m); pts = (r && r.points && r.points.length ? r.points : ((r && r.legs) || []).flatMap((l) => [l.a, l.b])).filter(Boolean); } } catch {}
        if (!pts.length) { try { const f = (S.flights || []).find((x) => x.missionId === id); pts = (f && f.points) || []; } catch {} }
        pts = pts.filter((p) => isFinite(p.lat) && isFinite(p.lon));
        const cur = document.getElementById("kbVar");
        if (!pts.length || !cur || cur.value.trim()) return;
        const mid = pts[Math.floor(pts.length / 2)];
        { const v = decl(mid.lat, mid.lon); cur.value = `${Math.round(Math.abs(v))}${v >= 0 ? "E" : "W"}`; }
        cur.dispatchEvent(new Event("change", { bubbles: true }));
        toast(`Magnetic variation ${cur.value} filled in from the route (IGRF model). Change it if your unit uses another value.`);
      })();
    }
    // Civil kneeboard card: variation along the route
    const card = document.getElementById("kcCard");
    if (card && !card.querySelector(".kc-var")) {
      let f = null; try { f = currentFlight(); } catch {}
      const pts = ((f && f.points) || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
      const sub = card.querySelector(".sub");
      if (pts.length && sub) {
        const a = decl(pts[0].lat, pts[0].lon), b = decl(pts[pts.length - 1].lat, pts[pts.length - 1].lon);
        const s = document.createElement("span"); s.className = "kc-var";
        s.textContent = ` · magnetic variation ${label(a)}${label(a) !== label(b) ? ` to ${label(b)}` : ""}`;
        sub.appendChild(s);
      }
    }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(fill, 300); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
