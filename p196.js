"use strict";
/* p196: terrain for flying without signal, and offline status on the Fly screen (November 9, 2026). Save for
   offline (p69, p110) already keeps the brief and the charts along the route. Two things were missing in the air:
   1. Terrain. The Fly screen's terrain ahead warning (p182) and the 3D preview (p189) read elevation tiles from
      the network, so with no signal the warning went quiet. Whenever a flight is saved for offline, the terrain
      along its route (about 2 nm either side) is now saved too, in the store the tile clean up never trims, and
      p189 reads saved terrain first. It is removed when the offline copy is removed.
   2. Status where the pilot is looking. The Fly screen shows Ready offline (brief, charts, terrain and when), or
      says the flight is not saved yet with a link to the brief, and opens the saved brief in one tap.
   Nothing leaves the device. Browsers can clear stored data when space runs low. */
(function () {
  if (!("caches" in window)) return;
  const REGION = "aerosignal-region-v1";
  const DEM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/";
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = Math.PI / 180;
  const css = document.createElement("style");
  css.textContent = `
    #ofFly{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:14px;padding:10px 14px;margin:0 0 14px;background:rgba(127,127,127,.06);display:flex;gap:8px 12px;align-items:center;justify-content:space-between;flex-wrap:wrap;font-size:14px}
    #ofFly .of-ok{font-weight:700;color:#2fbf71}#ofFly .of-warn{font-weight:700;color:#e0a100}
    #offBar .of-t{flex-basis:100%;font-size:12.5px;color:var(--ink2,#9fb0c8)}`;
  document.head.appendChild(css);

  const pts = (f) => ((f && f.points) || []).filter((p) => p && isFinite(p.lat) && isFinite(p.lon));
  const routeKey = (f) => pts(f).map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(";");
  const store = () => { S.offTerrain = S.offTerrain || {}; return S.offTerrain; };
  function dist(a, b) { const p1 = a.lat * R, p2 = b.lat * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2; return 6880.13 * Math.asin(Math.min(1, Math.sqrt(x))); }
  const tx = (lon) => Math.floor(((lon + 180) / 360) * 4096);
  const ty = (lat) => { const r = lat * R; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 4096); };
  function demUrls(P) {
    const set = new Set();
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], d = dist(a, b), n = Math.max(1, Math.ceil(d / 1.5));
      const k = Math.cos(((a.lat + b.lat) / 2) * R) || 1e-6;
      let ux = (b.lon - a.lon) * k, uy = b.lat - a.lat; const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
      for (let s = 0; s <= n; s++) {
        const t = s / n, lat = a.lat + (b.lat - a.lat) * t, lon = a.lon + (b.lon - a.lon) * t;
        // 2 nm either side: perpendicular to the leg is (-uy east, ux north)
        for (const o of [-2, 0, 2]) set.add(`${DEM}${tx(lon + ((o / 60) * -uy) / k)}/${ty(lat + (o / 60) * ux)}.png`);
      }
    }
    return [...set].slice(0, 500);
  }
  async function download(list) {
    const c = await caches.open(REGION);
    let i = 0, ok = 0, full = false;
    const one = async () => {
      while (i < list.length && !full) {
        const u = list[i++];
        try {
          if (await c.match(u)) { ok++; continue; }
          const r = await fetch(u, { mode: "cors", credentials: "omit" });
          if (r.ok) { const b = await r.blob(); await c.put(u, new Response(b, { headers: { "content-type": "image/png", "x-as-at": String(Date.now()) } })); ok++; }
        } catch (e) { if (e && e.name === "QuotaExceededError") full = true; }
      }
    };
    await Promise.all([one(), one(), one(), one()]);
    return ok;
  }
  const busy = new Set();
  async function saveTerrain(f) {
    const key = routeKey(f); if (busy.has(f.id)) return; busy.add(f.id);
    try {
      const list = demUrls(pts(f)), ok = await download(list);
      store()[f.id] = { key, n: ok, of: list.length, at: Date.now() }; save();
    } catch (e) { console.error(e); } finally { busy.delete(f.id); kick(); }
  }
  async function dropTerrain(id, P) {
    const keep = new Set();
    for (const [oid] of Object.entries(store())) if (oid !== id) { const g = (S.flights || []).find((x) => x.id === oid); if (g) for (const u of demUrls(pts(g))) keep.add(u); }
    try { const c = await caches.open(REGION); for (const u of demUrls(P)) if (!keep.has(u)) await c.delete(u); } catch (e) {}
    delete store()[id]; save();
  }
  const when = (ms) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const savedBrief = (f) => { try { return window.AeroOffline ? AeroOffline.saved(f) : null; } catch (e) { return null; } };
  // Keep terrain in step with the offline copy of each flight
  function sync() {
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!f || f.missionId || pts(f).length < 2) return;
    const s = savedBrief(f), t = store()[f.id];
    if (s && navigator.onLine !== false && (!t || t.key !== routeKey(f) || t.n < t.of * 0.9 && Date.now() - t.at > 6e5)) saveTerrain(f);
    if (!s && t && !busy.has(f.id)) dropTerrain(f.id, pts(f));
  }
  function flyCard(page, f) {
    const h1 = page.querySelector("h1"); if (!h1) return;
    const s = savedBrief(f), t = store()[f.id];
    const key = `${f.id}|${s ? s.at : 0}|${t ? t.n : -1}|${busy.has(f.id)}|${navigator.onLine}`;
    let el = page.querySelector("#ofFly");
    if (!el) { el = document.createElement("div"); el.id = "ofFly"; h1.after(el); }
    if (el.dataset.k === key) return; el.dataset.k = key;
    if (!s) { el.innerHTML = `<span><b>Not saved for offline.</b> <span class="small">Save the brief, charts and terrain before you fly somewhere without signal.</span></span><a class="btn sm" href="#/brief">Open the brief to save</a>`; return; }
    const old = Date.now() - s.at > 2 * 36e5;
    const terr = busy.has(f.id) ? "terrain saving now" : t && t.n ? `terrain saved (${t.n.toLocaleString("en-US")} tiles)` : "terrain not saved yet";
    el.innerHTML = `<span><span class="${old || !(t && t.n) ? "of-warn" : "of-ok"}">${old ? "Saved, but getting old" : t && t.n ? "Ready offline" : "Partly saved"}</span> <span class="small">Brief and charts saved ${h(when(s.at))}, ${terr}.${old ? " Open the brief with signal to refresh it." : ""}</span></span><button type="button" class="btn sec sm" data-open>Open saved brief</button>`;
    el.querySelector("[data-open]").onclick = () => { location.hash = "#/brief"; setTimeout(() => { try { AeroOffline.show(); } catch (e) {} }, 900); };
  }
  function briefLine(page, f) {
    const bar = page.querySelector("#offBar"); if (!bar) return;
    const s = savedBrief(f), t = store()[f.id];
    let l = bar.querySelector(".of-t");
    const txt = !s ? "" : busy.has(f.id) ? "Saving terrain along the route for the Fly screen…" : t && t.n ? `Terrain along the route is saved too (${t.n.toLocaleString("en-US")} tiles), so terrain ahead works on the Fly screen without signal.` : "";
    if (!txt) { if (l) l.remove(); return; }
    if (!l) { l = document.createElement("span"); l.className = "of-t"; bar.appendChild(l); }
    if (l.textContent !== txt) l.textContent = txt;
  }
  function scan() {
    const hash = location.hash || "", page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!page || !f || f.missionId || pts(f).length < 2) return;
    if (/^#\/(brief|fly)/.test(hash)) sync();
    if (/^#\/fly/.test(hash)) flyCard(page, f);
    if (/^#\/brief/.test(hash)) briefLine(page, f);
  }
  let tm = 0;
  function kick() { clearTimeout(tm); tm = setTimeout(() => { try { scan(); } catch (e) { console.error(e); } }, 500); }
  new MutationObserver((list) => { if (list.every((m) => m.target.closest && m.target.closest("#ofFly, .of-t"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("online", kick); window.addEventListener("offline", kick); window.addEventListener("hashchange", kick);
  kick();
  window.AeroSaveFlight = { demUrls };
})();
