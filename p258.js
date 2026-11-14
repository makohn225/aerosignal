"use strict";
/* p258: lightning, free from NOAA (November 13, 2026). Pilots asking what their EFB is missing name lightning, but
   in the big apps it needs a paid satellite weather subscription. NOAA's nowCOAST publishes the NWS Ocean
   Prediction Center's lightning strike density (15 minute periods, about 5 by 5 mile cells, from ground based
   detection networks) free and open for public use. Vigilyn now uses it in three places:
   1. Maps: a Lightning button on the map (next to Full map and Route) lays the latest 15 minutes over the chart,
      with the time it is valid for.
   2. Brief: "Lightning near the route" (#ltPanel, after #rpPanel) says whether any was detected within 30 nm of
      the route, how close, and where along it.
   3. Fly screen: with a data connection, every 5 minutes, the nearest lightning within 40 nm and its direction
      from the aircraft (ahead, left, right, behind) and distance.
   The data is about 15 to 30 minutes old by the time it is published, can miss strikes, and NOAA says it is not
   for lightning safety decisions on the ground; every place it appears says how old it is. Nothing is sent
   anywhere except the map image request to NOAA. */
(function () {
  const WMS = "https://nowcoast.noaa.gov/geoserver/observations/lightning_detection/ows";
  const LAYER = "ldn_lightning_strike_density", R = Math.PI / 180;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const dist = (a, b) => { const p1 = a.lat * R, p2 = b.lat * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2; return 3440.065 * 2 * Math.asin(Math.min(1, Math.sqrt(x))); };
  const brg = (a, b) => { const y = Math.sin((b.lon - a.lon) * R) * Math.cos(b.lat * R), x = Math.cos(a.lat * R) * Math.sin(b.lat * R) - Math.sin(a.lat * R) * Math.cos(b.lat * R) * Math.cos((b.lon - a.lon) * R); return (Math.atan2(y, x) / R + 360) % 360; };
  const css = document.createElement("style");
  css.textContent = `
    .mnav button[data-n="lt"][aria-pressed="true"]{border-color:#ffd23f;color:#ffd23f}
    .lt-tag{background:rgba(8,16,30,.9);color:#fff;font:600 12px var(--body,system-ui);padding:4px 8px;border-radius:8px;border:1px solid rgba(255,210,63,.6)}
    #ltPanel .lt-r{font-size:14.5px;line-height:1.5;margin:0}
    #ltFly{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:14px;padding:8px 14px;margin:0 0 14px;font-size:14.5px}
    #ltFly.warn{border-color:#ffd23f;background:rgba(255,210,63,.1)}`;
  document.head.appendChild(css);
  // Latest time step from the service
  let tCache = null;
  async function latest() {
    if (tCache && Date.now() - tCache.at < 5 * 60000) return tCache.t;
    try {
      const x = await (await fetch(`${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`)).text();
      const m = /<Dimension[^>]*name="time"[^>]*>([^<]+)</.exec(x); const list = m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
      const t = list.length ? list[list.length - 1] : null; tCache = { t, at: Date.now() }; return t;
    } catch (e) { return null; }
  }
  const when = (iso) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
  const ageMin = (iso) => iso ? Math.round((Date.now() - Date.parse(iso)) / 60000) : null;
  // Lightning cells in a box, from the map image (each coloured pixel is a cell with strikes)
  async function cells(b, t) {
    const W = 360, H = Math.max(120, Math.min(480, Math.round((W * (b.n - b.s)) / Math.max(0.01, (b.e - b.w) * Math.cos(((b.n + b.s) / 2) * R)))));
    const url = `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${LAYER}&STYLES=&CRS=EPSG:4326&BBOX=${b.s.toFixed(3)},${b.w.toFixed(3)},${b.n.toFixed(3)},${b.e.toFixed(3)}&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=true${t ? `&TIME=${encodeURIComponent(t)}` : ""}`;
    const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("lightning image")); i.src = url; });
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data, out = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 40) out.push({ lat: b.n - ((y + 0.5) / H) * (b.n - b.s), lon: b.w + ((x + 0.5) / W) * (b.e - b.w) });
    return out;
  }
  const boxAround = (P, nm) => { let s = 90, n = -90, w = 180, e = -180; for (const p of P) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); e = Math.max(e, p.lon); } const dl = nm / 60, k = Math.cos(((s + n) / 2) * R) || 0.5; return { s: s - dl, n: n + dl, w: w - dl / k, e: e + dl / k }; };
  function nearRoute(P, q) {
    let best = null, at = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], L = dist(a, b), k = Math.cos(((a.lat + b.lat) / 2) * R);
      const bx = (b.lon - a.lon) * k, by = b.lat - a.lat, px = (q.lon - a.lon) * k, py = q.lat - a.lat, L2 = bx * bx + by * by || 1e-12;
      const t = Math.max(0, Math.min(1, (px * bx + py * by) / L2)), x = Math.hypot(px - t * bx, py - t * by) * 60;
      if (!best || x < best.x) best = { x, at: at + t * L };
      at += L;
    }
    return best;
  }
  // 1. Maps overlay
  let layer = null, tag = null;
  async function toggle(btn) {
    const m = typeof leafletMap !== "undefined" ? leafletMap : null; if (!m) return;
    if (layer && m.hasLayer(layer)) { m.removeLayer(layer); if (tag) m.removeControl(tag); btn.setAttribute("aria-pressed", "false"); return; }
    const t = await latest();
    layer = L.tileLayer.wms(WMS, { layers: LAYER, styles: "", format: "image/png", transparent: true, version: "1.3.0", opacity: 0.85, attribution: "Lightning: NOAA nowCOAST, NWS OPC", ...(t ? { time: t } : {}) }).addTo(m);
    tag = L.control({ position: "bottomleft" }); tag.onAdd = () => { const d = L.DomUtil.create("div", "lt-tag"); d.textContent = t ? `Lightning, 15 min to ${when(t)} (${ageMin(t)} min old)` : "Lightning, latest 15 minutes"; return d; }; tag.addTo(m);
    btn.setAttribute("aria-pressed", "true");
  }
  function mapsButton() {
    if (!/^#\/maps/.test(location.hash || "")) return;
    const nav = document.querySelector(".mnav"); if (!nav || nav.querySelector("[data-n='lt']")) return;
    const b = document.createElement("button"); b.type = "button"; b.dataset.n = "lt"; b.setAttribute("aria-pressed", "false"); b.title = "Show lightning from the last 15 minutes";
    b.innerHTML = `<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg><span>Lightning</span>`;
    b.onclick = () => toggle(b).catch(() => { try { toast("Lightning data could not load right now"); } catch (e) {} });
    nav.appendChild(b);
  }
  // 2. Brief panel
  const H2 = "<h2>Lightning near the route</h2>";
  let busy = false;
  async function brief() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"); if (!page || !page.querySelector("#bfBluf")) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    const P = ((f && f.points) || []).filter((p) => isFinite(p.lat) && isFinite(p.lon)); if (!f || f.missionId || P.length < 2) return;
    busy = true;
    try {
      let sec = page.querySelector(":scope > #ltPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "ltPanel"; sec.innerHTML = `${H2}<p class="muted">Checking…</p>`; }
      const anchor = page.querySelector(":scope > #rpPanel") || page.querySelector(":scope > #dpPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      const t = await latest(), key = `${P.map((p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`).join(";")}|${t}`;
      if (sec.dataset.k === key) return; sec.dataset.k = key;
      let C;
      try { C = await cells(boxAround(P, 30), t); } catch (e) { sec.innerHTML = `${H2}<p class="muted" style="margin:0">Lightning data could not load right now.</p>`; return; }
      const near = C.map((c) => ({ c, r: nearRoute(P, c) })).filter((x) => x.r && x.r.x <= 30).sort((a, b) => a.r.x - b.r.x);
      const age = ageMin(t);
      let txt;
      const per = t ? `in the 15 minutes to ${when(t)}` : "in the latest 15 minutes";
      if (!near.length) txt = `No lightning detected within 30 nm of the route ${per}.`;
      else { const n = near[0]; txt = `<b>Lightning detected ${n.r.x < 1 ? "on the route" : `${fmt(Math.max(1, n.r.x))} nm from the route`}</b>, near ${fmt(n.r.at)} nm along it, ${per}. Thunderstorms nearby mean turbulence, hail and wind shear well beyond the cell: plan to stay at least 20 nm clear.`; }
      sec.innerHTML = `${H2}<p class="lt-r">${txt}</p><p class="small muted" style="margin:8px 0 0">${age != null ? `${age} minutes old. ` : ""}NWS Ocean Prediction Center lightning strike density via NOAA nowCOAST, from ground based detection networks. It can miss strikes and is not for lightning safety decisions. <a href="#/maps">Show it on the map</a>.</p>`;
    } catch (e) { console.error(e); } finally { setTimeout(() => (busy = false), 0); }
  }
  // 3. Fly screen
  let flyAt = 0, flyRes = null;
  async function fly() {
    if (!/^#\/fly/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"); if (!page) return;
    const st = window.AeroFly && AeroFly.state, pos = st && st.pos;
    let el = page.querySelector("#ltFly");
    if (!pos || navigator.onLine === false) { if (el) el.remove(); return; }
    if (Date.now() - flyAt > 5 * 60000 || !flyRes || (flyRes.from && dist(flyRes.from, pos) > 15 && Date.now() - flyAt > 60000)) {
      flyAt = Date.now();
      try { const t = await latest(); const C = await cells(boxAround([pos], 40), t); const near = C.map((c) => ({ c, d: dist(pos, c) })).filter((x) => x.d <= 40).sort((a, b) => a.d - b.d); flyRes = { t, n: near[0] || null, from: { lat: pos.lat, lon: pos.lon } }; } catch (e) { flyRes = null; }
    }
    if (!flyRes) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "ltFly"; const a = page.querySelector("#daFly") || page.querySelector("#tdFly") || page.querySelector("#recFly") || page.querySelector("h1"); if (a) a.after(el); else page.prepend(el); }
    let html;
    if (!flyRes.n) { el.className = ""; html = `No lightning within 40 nm <span class="small">(${flyRes.t ? `${ageMin(flyRes.t)} min old data` : "latest data"})</span>`; }
    else {
      const d = dist(pos, flyRes.n.c), b = brg(pos, flyRes.n.c), trk = st.trk != null ? st.trk : (pos.trk != null ? pos.trk : null);
      let side = ""; if (trk != null) { const rel = ((b - trk + 540) % 360) - 180; side = Math.abs(rel) <= 30 ? "ahead" : Math.abs(rel) >= 150 ? "behind" : rel > 0 ? "to the right" : "to the left"; }
      el.className = d <= 20 ? "warn" : "";
      html = `<b>Lightning ${fmt(Math.max(1, d))} nm ${side || `bearing ${String(Math.round(b)).padStart(3, "0")}°`}</b> <span class="small">(${flyRes.t ? `${ageMin(flyRes.t)} min old data` : "latest data"}, NOAA)</span>${d <= 20 ? `<br><span class="small">Stay at least 20 nm from thunderstorms.</span>` : ""}`;
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  let t1 = 0;
  const kick = () => { clearTimeout(t1); t1 = setTimeout(() => { try { mapsButton(); brief(); } catch (e) { console.error(e); } }, 700); };
  new MutationObserver((l) => { if (busy || l.every((m) => m.target.closest && m.target.closest("#ltPanel"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick); kick();
  setInterval(() => { mapsButton(); fly().catch(() => {}); }, 4000);
  window.AeroLightning = { latest, cells, nearRoute };
})();
