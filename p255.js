"use strict";
/* p255: route weather profile (November 13, 2026). Pilots asking what their EFB is missing keep naming the same
   thing: a side view of the route showing terrain, the planned altitude, cloud bases, the freezing level and the
   winds, to pick an altitude and see where the squeeze is. The brief now draws one (#rpPanel, after #dpPanel):
   - terrain along the route (public elevation tiles, the same ones as the 3D preview),
   - the planned altitude with climb and descent (p90),
   - the lowest broken or overcast layer reported at airports near the route (current METARs, as heights above
     sea level), and a mark for airports reporting no ceiling,
   - the freezing level from the winds aloft forecast temperatures (p36), and the forecast wind at the planned
     altitude at points along the route.
   Under it, plain sentences: the lowest ceiling and how much room it leaves over the terrain near it, and
   whether the planned altitude is above the freezing level. Current reports and forecasts mixed in one picture
   are a planning aid, and the panel says so. */
(function () {
  const R = Math.PI / 180, FT = 3.28084;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const up100 = (x) => Math.ceil(x / 100) * 100;
  const dist = (a, b) => { const p1 = a.lat * R, p2 = b.lat * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2; return 3440.065 * 2 * Math.asin(Math.min(1, Math.sqrt(x))); };
  const css = document.createElement("style");
  css.textContent = `
    #rpPanel svg{width:100%;height:auto;display:block;margin:6px 0 4px;font-family:var(--body,system-ui,sans-serif)}
    #rpPanel .rp-k{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;opacity:.9;margin:2px 0 8px}
    #rpPanel .rp-k i{display:inline-block;width:18px;height:0;border-top:3px solid;vertical-align:middle;margin-right:5px}
    #rpPanel ul{margin:6px 0 0;padding-left:18px;font-size:14.5px;line-height:1.5}`;
  document.head.appendChild(css);
  const pts = (f) => ((f && f.points) || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
  function samples(P, n) {
    let total = 0; const legs = [];
    for (let i = 1; i < P.length; i++) { const d = dist(P[i - 1], P[i]); legs.push({ a: P[i - 1], b: P[i], d, at: total }); total += d; }
    const out = [];
    for (let k = 0; k <= n; k++) {
      const x = (total * k) / n, L = legs.find((l) => x <= l.at + l.d) || legs[legs.length - 1], t = L.d ? Math.max(0, Math.min(1, (x - L.at) / L.d)) : 0;
      out.push({ at: x, lat: L.a.lat + (L.b.lat - L.a.lat) * t, lon: L.a.lon + (L.b.lon - L.a.lon) * t });
    }
    return { out, total, legs };
  }
  function project(legs, q) {
    let best = null;
    for (const L of legs) {
      const k = Math.cos(((L.a.lat + L.b.lat) / 2) * R), bx = (L.b.lon - L.a.lon) * k, by = L.b.lat - L.a.lat, px = (q.lon - L.a.lon) * k, py = q.lat - L.a.lat;
      const L2 = bx * bx + by * by || 1e-12, t = Math.max(0, Math.min(1, (px * bx + py * by) / L2)), x = Math.hypot(px - t * bx, py - t * by) * 60;
      if (!best || x < best.off) best = { off: x, at: L.at + t * L.d };
    }
    return best;
  }
  async function terrain(S) {
    const E = window.AeroPreview && AeroPreview.elev; if (!E) return null;
    let v = [];
    for (let i = 0; i < 30; i++) { v = S.map((s) => E(s.lat, s.lon)); if (v.filter((x) => x != null).length >= S.length * 0.95) break; await new Promise((r) => setTimeout(r, 200)); }
    if (v.filter((x) => x != null).length < S.length * 0.8) return null;
    let last = 0; return v.map((m) => (m == null ? last : (last = m * FT)));
  }
  function freezing(W, q) {
    if (!W || !window.AeroWinds) return null;
    let prev = null;
    for (let a = 3000; a <= 18000; a += 1000) {
      const w = AeroWinds.windAt(W, q, a); if (!w || w.temp == null) continue;
      if (prev && prev.t > 0 && w.temp <= 0) return prev.a + ((a - prev.a) * prev.t) / (prev.t - w.temp);
      if (!prev && w.temp <= 0) return a; // already below freezing at the lowest level with a temperature
      prev = { a, t: w.temp };
    }
    return null; // above 18,000 ft
  }
  async function data(f) {
    const P = pts(f); const { out: S, total, legs } = samples(P, Math.min(240, Math.max(40, Math.round(dist(P[0], P[P.length - 1]) * 2))));
    let vn = null; try { vn = window.AeroVnav ? AeroVnav.vnav(f) : null; } catch (e) {}
    const [ter, cl, W] = await Promise.all([
      terrain(S),
      (async () => { try { return window.AeroPreview && AeroPreview.clouds ? await AeroPreview.clouds(P) : []; } catch (e) { return []; } })(),
      (async () => { try { return window.AeroWinds ? await AeroWinds.fetchWinds(f) : null; } catch (e) { return null; } })(),
    ]);
    const clouds = (cl || []).map((c) => { const p = project(legs, c); return { ...c, at: p ? p.at : null, off: p ? p.off : 99 }; }).filter((c) => c.at != null && c.off <= 25);
    const fz = W && W.stations && W.stations.length ? S.filter((_, i) => i % Math.max(1, Math.round(S.length / 12)) === 0 || _ === S[S.length - 1]).map((s) => ({ at: s.at, ft: freezing(W, s) })) : [];
    const alt = vn ? vn.alt : (window.AeroWinds ? AeroWinds.altOf(f) : 5500);
    const winds = W && W.stations && W.stations.length ? [0.2, 0.5, 0.8].map((t) => { const s = S[Math.round((S.length - 1) * t)]; const w = AeroWinds.windAt(W, s, alt); return w ? { at: s.at, w } : null; }).filter(Boolean) : [];
    return { S, total, ter, clouds, fz, alt, vn, winds, P };
  }
  // Drawn at the panel's real width, so the labels stay readable on a phone
  function svg(d, width) {
    const Wd = Math.max(320, Math.min(1100, Math.round(width || 760))), Ht = Wd < 520 ? 240 : 300, L = 40, Rt = 8, T = 30, B = 24, w = Wd - L - Rt, hgt = Ht - T - B;
    const cx = (x, half) => Math.max(L + half, Math.min(Wd - Rt - half, x));
    const terMax = d.ter ? Math.max(...d.ter) : 0;
    const cMax = Math.max(0, ...d.clouds.map((c) => (c.baseAgl != null ? c.ceilFt || 0 : 0)));
    let yMax = Math.max(d.alt + 2500, terMax + 2500, Math.min(cMax + 1000, d.alt + 6000));
    yMax = Math.ceil(yMax / 2000) * 2000;
    const X = (nm) => L + (nm / d.total) * w, Y = (ft) => T + hgt - (Math.max(0, ft) / yMax) * hgt;
    const g = [];
    for (let a = 0; a <= yMax; a += yMax > 12000 ? 4000 : 2000) g.push(`<line x1="${L}" x2="${Wd - Rt}" y1="${Y(a)}" y2="${Y(a)}" stroke="currentColor" stroke-opacity=".12"/><text x="${L - 6}" y="${Y(a) + 4}" font-size="12" text-anchor="end" fill="currentColor" fill-opacity=".7">${a ? `${a / 1000}k` : "0"}</text>`);
    const step = d.total > 200 ? 50 : d.total > 80 ? 20 : 10;
    for (let n = 0; n <= d.total; n += step) g.push(`<text x="${cx(X(n), 8)}" y="${Ht - 6}" font-size="12" text-anchor="middle" fill="currentColor" fill-opacity=".7">${n}</text>`);
    if (d.ter) g.push(`<path d="M${X(0)},${Y(0)} ${d.S.map((s, i) => `L${X(s.at).toFixed(1)},${Y(d.ter[i]).toFixed(1)}`).join(" ")} L${X(d.total)},${Y(0)} Z" fill="#8a6d3b" fill-opacity=".55" stroke="#8a6d3b"/>`);
    // freezing level
    const fzOk = d.fz.filter((p) => p.ft != null && p.ft < yMax);
    if (fzOk.length >= 2) g.push(`<path d="${fzOk.map((p, i) => `${i ? "L" : "M"}${X(p.at).toFixed(1)},${Y(p.ft).toFixed(1)}`).join(" ")}" fill="none" stroke="#4aa3ff" stroke-width="2" stroke-dasharray="6 4"/>`);
    // planned altitude
    if (d.vn) { const v = d.vn; const tocX = Math.min(v.tocNm, d.total / 2), todX = Math.max(d.total - v.todNm, d.total / 2); g.push(`<path d="M${X(0)},${Y(v.e0)} L${X(tocX)},${Y(v.alt)} L${X(todX)},${Y(v.alt)} L${X(d.total)},${Y(v.e1 + 1000)}" fill="none" stroke="#3DE0FF" stroke-width="3"/>`); }
    else g.push(`<line x1="${X(0)}" x2="${X(d.total)}" y1="${Y(d.alt)}" y2="${Y(d.alt)}" stroke="#3DE0FF" stroke-width="3"/>`);
    // cloud bases
    for (const c of d.clouds) {
      const x = X(c.at);
      if (c.baseAgl == null) { g.push(`<text x="${cx(x, 30)}" y="${T - 16}" font-size="11" text-anchor="middle" fill="#2fbf71">${h(c.station)}</text><text x="${cx(x, 30)}" y="${T - 4}" font-size="11" text-anchor="middle" fill="#2fbf71">no ceiling</text>`); continue; }
      const y = Y(c.ceilFt || c.baseAgl);
      g.push(`<line x1="${x - 18}" x2="${x + 18}" y1="${y}" y2="${y}" stroke="#e0a100" stroke-width="4"/><text x="${cx(x, 40)}" y="${y - 6}" font-size="11.5" text-anchor="middle" fill="#e0a100" font-weight="700">${h(c.station)} ${fmt(up100(c.ceilFt || c.baseAgl))}</text>`);
    }
    for (const p of d.winds) { const w = p.w; if (w.dir == null) continue; g.push(`<text x="${cx(X(p.at), 24)}" y="${Y(d.alt) + 16}" font-size="11.5" text-anchor="middle" fill="currentColor" fill-opacity=".85">${String(Math.round(w.dir / 10) * 10 % 360 || 360).padStart(3, "0")}/${Math.round(w.spd)}</text>`); }
    return `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="Side view of the route: terrain, planned altitude, cloud bases and freezing level">${g.join("")}</svg>`;
  }
  function notes(d, f) {
    const out = [];
    const withC = d.clouds.filter((c) => c.baseAgl != null && c.ceilFt != null);
    if (withC.length) {
      const low = withC.sort((a, b) => a.ceilFt - b.ceilFt)[0];
      let ter = null; if (d.ter) { d.S.forEach((s, i) => { if (Math.abs(s.at - low.at) <= 10) ter = Math.max(ter == null ? -1e9 : ter, d.ter[i]); }); }
      out.push(`Lowest reported ceiling near the route: <b>${fmt(up100(low.ceilFt))} ft</b> above sea level at ${h(low.station)} (${fmt(low.baseAgl)} ft above the airport)${ter != null ? `, leaving about ${fmt(Math.max(0, low.ceilFt - ter))} ft over the highest terrain within 10 nm of it` : ""}.`);
      if (String(f.rules || "").toUpperCase() !== "IFR" && low.ceilFt < d.alt + 500) out.push(`<b>Your planned altitude of ${fmt(d.alt)} ft is at or above that ceiling.</b> A VFR flight would have to go lower or around it.`);
    } else if (d.clouds.length) out.push("Airports reporting near the route have no ceiling right now.");
    else out.push("No current cloud reports were found near this route.");
    const fz = d.fz.filter((p) => p.ft != null);
    if (fz.length) { const lo = Math.min(...fz.map((p) => p.ft)); out.push(lo <= d.alt ? `Forecast freezing level as low as <b>${fmt(up100(lo))} ft</b>, at or below your planned altitude: avoid visible moisture there.` : `Forecast freezing level is about ${fmt(up100(lo))} ft or higher, above your planned altitude.`); }
    else if (d.fz.length) out.push("The forecast has no freezing level below 18,000 ft along the route.");
    if (!d.ter) out.push("Terrain could not load right now, so the ground is not drawn.");
    return out;
  }
  const H2 = "<h2>Route weather profile</h2>";
  let busy = false, t = 0;
  async function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"); if (!page || !page.querySelector("#bfBluf")) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!f || f.missionId || pts(f).length < 2) return;
    busy = true;
    try {
      let sec = page.querySelector(":scope > #rpPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "rpPanel"; sec.innerHTML = `${H2}<p class="muted">Drawing the route…</p>`; }
      const anchor = page.querySelector(":scope > #dpPanel") || page.querySelector(":scope > #wcPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      const key = `${pts(f).map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(";")}|${f.cruiseAlt || ""}|${f.rules || ""}|${f.date || ""}|${f.time || ""}`;
      if (sec.dataset.k === key) return;
      sec.dataset.k = key;
      const d = await data(f);
      if (!sec.isConnected || sec.dataset.k !== key) return;
      sec.innerHTML = `${H2}${svg(d, sec.clientWidth - 2 * (parseFloat(getComputedStyle(sec).paddingLeft) || 0))}
        <div class="rp-k"><span><i style="border-color:#3DE0FF"></i>Planned altitude ${fmt(d.alt)} ft</span><span><i style="border-color:#8a6d3b"></i>Terrain</span><span><i style="border-color:#e0a100"></i>Lowest broken or overcast layer reported now</span><span><i style="border-color:#4aa3ff;border-top-style:dashed"></i>Forecast freezing level</span><span>Bottom: nm along the route. Numbers on the line: forecast wind at that altitude</span></div>
        <ul>${notes(d, f).map((n) => `<li>${n}</li>`).join("")}</ul>
        <p class="small muted" style="margin:8px 0 0">Heights above sea level. Cloud bases are current airport reports, not forecasts, and clouds between airports are unknown. Freezing level and winds from the winds aloft forecast. Planning aid only.</p>`;
    } catch (e) { console.error(e); } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 650); };
  new MutationObserver((l) => { if (busy || l.every((m) => m.target.closest && m.target.closest("#rpPanel"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick); kick();
  window.AeroRouteProfile = { data, freezing };
})();
