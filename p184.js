"use strict";
/* p184: route around special use airspace (November 5, 2026, from tester feedback: "can you choose to not fly
   through MOAs, Warning areas, etc?"). On the Flights page and in the brief's airspace panel (#asPanel), the
   pilot picks which kinds to avoid (prohibited and restricted, warning areas, MOAs, alert areas) and taps
   Reroute. Vigilyn loads the same FAA special use airspace the brief uses (p92), keeps the ones that reach
   the planned cruise altitude, and finds the shortest path around them with a 3 nm margin, leg by leg, as
   user waypoints (DDMMN DDDMMW) inserted into the route. The original route can be restored with Undo.
   Prohibited and restricted areas are always included. Planning aid only: check NOTAMs and activation times,
   and ask ATC; an inactive MOA can often be flown through. */
(function () {
  const FAA = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services";
  const KINDS = [["RP", "Prohibited and restricted", true, /^(P|R)$/], ["W", "Warning areas", true, /^W$/], ["MOA", "MOAs", true, /^MOA$/], ["A", "Alert areas", false, /^A$/]];
  const BUF = 3; // nm margin around each area
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    .sua-av{margin-top:10px;padding-top:10px;border-top:1px solid var(--line2,rgba(255,255,255,.1))}
    .sua-av .ks{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 0}
    .sua-av .ks label{display:flex;align-items:center;gap:6px;font-size:13.5px}
    .sua-av .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .sua-av .msg{font-size:13.5px;margin:8px 0 0}
    .sua-av .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:8px 0 0}`;
  document.head.appendChild(css);

  // ---------- geometry in a local flat frame, nautical miles ----------
  function frame(lat0) { const k = Math.cos(lat0 * Math.PI / 180) * 60; return { to: (lat, lon) => [lon * k, lat * 60], from: (x, y) => ({ lat: y / 60, lon: x / k }) }; }
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); // counter clockwise
  }
  function simplify(hl, max) { if (hl.length <= max) return hl; const out = []; const step = hl.length / max; for (let i = 0; i < max; i++) out.push(hl[Math.floor(i * step)]); return hull(out.concat(hl.filter((_, i) => i % Math.ceil(step) === 0))); }
  function offset(hl, d) {
    // Push a counter clockwise convex polygon outward by d (miter, capped)
    const n = hl.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = hl[(i + n - 1) % n], b = hl[i], c = hl[(i + 1) % n];
      const n1 = norm([b[1] - a[1], a[0] - b[0]]), n2 = norm([c[1] - b[1], b[0] - c[0]]);
      let m = [n1[0] + n2[0], n1[1] + n2[1]]; const dot = n1[0] * n2[0] + n1[1] * n2[1];
      const s = Math.min(3, 1 / Math.max(0.1, (1 + dot) / 2) ** 0.5);
      m = norm(m); out.push([b[0] + m[0] * d * s, b[1] + m[1] * d * s]);
    }
    return out;
  }
  function norm(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
  function insideConvex(pg, p, eps) { for (let i = 0; i < pg.length; i++) if (cross(pg[i], pg[(i + 1) % pg.length], p) < (eps || 0)) return false; return true; }
  function segHits(pg, a, b) {
    // True when segment a-b passes through the interior of convex polygon pg (touching an edge or vertex is allowed)
    if (insideConvex(pg, a, 1e-6) || insideConvex(pg, b, 1e-6)) return true;
    for (let t = 0.125; t < 1; t += 0.125) if (insideConvex(pg, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], 1e-4)) return true;
    for (let i = 0; i < pg.length; i++) {
      const c = pg[i], e = pg[(i + 1) % pg.length];
      const d1 = cross(a, b, c), d2 = cross(a, b, e), d3 = cross(c, e, a), d4 = cross(c, e, b);
      if (((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) && ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6))) return true;
    }
    return false;
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function shortest(a, b, obs) {
    // Visibility graph over the start, end and every obstacle vertex that is not inside another obstacle
    const nodes = [a, b];
    obs.forEach((o, oi) => o.pg.forEach((v) => { if (!obs.some((q, qi) => qi !== oi && insideConvex(q.pg, v, 1e-4))) nodes.push(v); }));
    const N = nodes.length, D = new Array(N).fill(Infinity), P = new Array(N).fill(-1), done = new Array(N).fill(false);
    D[0] = 0;
    for (;;) {
      let u = -1; for (let i = 0; i < N; i++) if (!done[i] && D[i] < Infinity && (u < 0 || D[i] < D[u])) u = i;
      if (u < 0 || u === 1) break;
      done[u] = true;
      for (let v = 0; v < N; v++) {
        if (done[v] || v === u) continue;
        const w = D[u] + dist(nodes[u], nodes[v]);
        if (w >= D[v]) continue;
        if (obs.some((o) => segHits(o.pg, nodes[u], nodes[v]))) continue;
        D[v] = w; P[v] = u;
      }
    }
    if (D[1] === Infinity) return null;
    const path = []; for (let v = 1; v >= 0; v = P[v]) path.unshift(nodes[v]);
    return path;
  }

  // ---------- data ----------
  async function loadSua(env) {
    const u = new URL(`${FAA}/Special_Use_Airspace/FeatureServer/0/query`);
    const p = { where: "1=1", geometry: `${env[1]},${env[0]},${env[3]},${env[2]}`, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "NAME,TYPE_CODE,UPPER_VAL,UPPER_UOM,UPPER_CODE,LOWER_VAL,LOWER_UOM,LOWER_CODE", outSR: "4326", maxAllowableOffset: "0.004", resultRecordCount: "800", f: "geojson" };
    for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
    const r = await fetch(u); if (!r.ok) throw new Error("FAA airspace service error");
    const j = await r.json(); if (j.error) throw new Error("FAA airspace query failed");
    return j.features || [];
  }
  const ftOf = (val, uom, code, fallback) => { let v = +val; if (val == null || val === "" || !isFinite(v)) return fallback; if (/FL/i.test(uom || "")) v *= 100; if (/SFC|AGL|HEI/i.test(code || "")) v += 1000; return v; };
  function cruiseAlt(f) { let a = 0; try { a = window.AeroWinds ? Number(AeroWinds.altOf(f)) || 0 : 0; } catch (e) {} return a || Number(String(f.cruiseAlt || "").replace(/\D/g, "")) || 5500; }

  function token(ll) {
    const one = (v, w, pos, neg) => { const a = Math.abs(v); let d = Math.floor(a), m = Math.round((a - d) * 60); if (m === 60) { d++; m = 0; } return String(d).padStart(w, "0") + String(m).padStart(2, "0") + (v >= 0 ? pos : neg); };
    return one(ll.lat, 2, "N", "S") + one(ll.lon, 3, "E", "W");
  }
  async function plan(f, kinds) {
    const pts = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    if (pts.length < 2) throw new Error("Load a route with at least two points first");
    let a = 90, b = 180, c = -90, d = -180;
    for (const p of pts) { a = Math.min(a, p.lat); b = Math.min(b, p.lon); c = Math.max(c, p.lat); d = Math.max(d, p.lon); }
    const env = [a - 1, b - 1.2, c + 1, d + 1.2];
    const feats = await loadSua(env);
    const res = KINDS.filter(([k, , , re]) => kinds.includes(k)).map((x) => x[3]);
    const alt = cruiseAlt(f);
    const F = frame((a + c) / 2);
    const obs = [], skipped = new Set();
    for (const ft of feats) {
      const pr = ft.properties || {}, type = String(pr.TYPE_CODE || "").toUpperCase();
      if (!res.some((re) => re.test(type))) continue;
      const lo = ftOf(pr.LOWER_VAL, pr.LOWER_UOM, pr.LOWER_CODE, 0), hi = ftOf(pr.UPPER_VAL, pr.UPPER_UOM, pr.UPPER_CODE, 99999);
      if (!(alt >= lo - 500 && alt <= hi + 500)) continue;
      const g = ft.geometry || {}; const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      for (const pl of polys) {
        const ring = (pl[0] || []).map(([lon, lat]) => F.to(lat, lon)); if (ring.length < 3) continue;
        const hl = simplify(hull(ring), 18); if (hl.length < 3) continue;
        obs.push({ name: pr.NAME || type, type, raw: hl, pg: offset(hl, BUF) });
      }
    }
    const P = pts.map((p) => F.to(p.lat, p.lon));
    const out = [pts[0]]; const avoided = new Set(), warn = [];
    let added = 0, before = 0, after = 0;
    for (let i = 1; i < pts.length; i++) {
      const A = P[i - 1], B = P[i];
      before += dist(A, B);
      // Areas the ends sit in cannot be avoided on this leg
      const usable = obs.filter((o) => { if (insideConvex(o.pg, A, 1e-6) || insideConvex(o.pg, B, 1e-6)) { if (insideConvex(o.raw, A) || insideConvex(o.raw, B)) skipped.add(o.name); return false; } return true; });
      let act = usable.filter((o) => segHits(o.pg, A, B));
      let path = [A, B];
      for (let it = 0; it < 8 && act.length; it++) {
        const p2 = shortest(A, B, act); if (!p2) { warn.push(`No way around between ${pts[i - 1].ident} and ${pts[i].ident}`); path = [A, B]; break; }
        path = p2;
        const more = usable.filter((o) => !act.includes(o) && path.some((q, k) => k && segHits(o.pg, path[k - 1], q)));
        if (!more.length) break;
        act = act.concat(more);
      }
      act.forEach((o) => avoided.add(o.name));
      for (let k = 1; k < path.length - 1; k++) { const ll = F.from(path[k][0], path[k][1]); const t = token(ll); out.push({ ident: t, name: "User waypoint", kind: "user", lat: ll.lat, lon: ll.lon, elev: null }); added++; }
      for (let k = 1; k < path.length; k++) after += dist(path[k - 1], path[k]);
      out.push(pts[i]);
    }
    return { points: out, added, avoided: [...avoided], skipped: [...skipped], warn, before, after, alt, count: obs.length };
  }
  function routeOf(points) { return points.map((p) => (p.kind === "user" && /^\d{4}[NS]\d{5}[EW]$/.test(p.ident) ? p.ident : p.kind === "user" ? token(p) : p.ident)).join(" "); }

  // ---------- UI ----------
  function picks() { let v = null; try { v = JSON.parse(localStorage.getItem("vg_sua_av") || "null"); } catch (e) {} return Array.isArray(v) ? v : KINDS.filter((k) => k[2]).map((k) => k[0]); }
  function box(where) {
    const p = picks();
    const el = document.createElement("div"); el.className = "sua-av";
    el.innerHTML = `<b>Avoid special use airspace</b>
      <div class="ks">${KINDS.map(([k, label]) => `<label><input type="checkbox" data-k="${k}" ${p.includes(k) || k === "RP" ? "checked" : ""} ${k === "RP" ? "disabled" : ""}> ${h(label)}</label>`).join("")}</div>
      <div class="row"><button type="button" class="btn sm" data-go>Reroute around them</button><button type="button" class="btn sec sm" data-undo hidden>Undo</button></div>
      <div class="msg" data-msg></div>
      <p class="disc">Planning aid only. Check NOTAMs and activation times and talk to ATC; an inactive MOA or restricted area can often be flown through.</p>`;
    el.querySelectorAll("[data-k]").forEach((c) => (c.onchange = () => { const ks = [...el.querySelectorAll("[data-k]:checked")].map((x) => x.dataset.k); try { localStorage.setItem("vg_sua_av", JSON.stringify(ks)); } catch (e) {} }));
    const msg = el.querySelector("[data-msg]"), go = el.querySelector("[data-go]"), undo = el.querySelector("[data-undo]");
    const f0 = currentFlight(); if (f0 && f0._suaPrev) { undo.hidden = false; if (f0._suaMsg) msg.innerHTML = f0._suaMsg; }
    go.onclick = async () => {
      const f = currentFlight(); if (!f) return;
      go.disabled = true; msg.textContent = "Loading FAA special use airspace and finding a way around…";
      try {
        const ks = [...el.querySelectorAll("[data-k]:checked")].map((x) => x.dataset.k);
        const r = await plan(f, ks);
        if (!r.added) {
          msg.innerHTML = r.skipped.length ? `The route only touches areas it starts or ends in (${h(r.skipped.join(", "))}), so there is nothing to route around.` : `The route already stays clear of the selected areas at ${r.alt.toLocaleString("en-US")} ft. No change.`;
        } else {
          f._suaPrev = { route: f.route, points: f.points };
          f.route = routeOf(r.points); f.points = r.points;
          const extra = Math.ceil(r.after - r.before);
          f._suaMsg = msg.innerHTML = `Rerouted around ${h(r.avoided.slice(0, 6).join(", "))}${r.avoided.length > 6 ? ` and ${r.avoided.length - 6} more` : ""} with ${r.added} added point${r.added === 1 ? "" : "s"}; about ${extra} nm longer at ${r.alt.toLocaleString("en-US")} ft.${r.skipped.length ? ` Not avoidable because the route starts or ends inside: ${h(r.skipped.join(", "))}.` : ""}${r.warn.length ? ` ${h(r.warn.join(". "))}.` : ""}`;
          save();
          toast("Route updated");
          setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 600);
        }
      } catch (e) { console.error(e); msg.textContent = e.message || "The reroute could not be worked out right now."; }
      finally { go.disabled = false; }
    };
    undo.onclick = () => {
      const f = currentFlight(); if (!f || !f._suaPrev) return;
      f.route = f._suaPrev.route; f.points = f._suaPrev.points; delete f._suaPrev; delete f._suaMsg; save();
      toast("Original route restored"); window.dispatchEvent(new HashChangeEvent("hashchange"));
    };
    return el;
  }
  function scan() {
    const hash = location.hash || "";
    if (/^#\/brief/.test(hash)) {
      const as = document.querySelector("#asPanel"); let f = null; try { f = currentFlight(); } catch (e) {}
      if (as && f && !f.missionId && !as.querySelector(".sua-av") && as.querySelector("li, p")) { const d = as.querySelector(".disc"); const b = box("brief"); if (d) d.before(b); else as.appendChild(b); }
    }
    if (/^#\/(flights|plan)/.test(hash)) {
      const row = document.querySelector("#xfpl") && document.querySelector("#xfpl").closest(".row");
      if (row && !row.parentElement.querySelector(".sua-av")) row.after(box("flights"));
    }
  }
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { try { scan(); } catch (e) { console.error(e); } }, 350); })
    .observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroSuaAvoid = { plan, routeOf, token, hull, offset, shortest, segHits, frame };
})();
