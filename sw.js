/* AeroSignal service worker.
   App shell: served straight from the saved copy so the app opens instantly, even on weak signal.
   A new version installs in the background as a complete set and the app offers a reload.
   Map tiles and libraries: saved after first use so charts redraw instantly and work with poor signal.
   Live data (weather, TFRs, accidents, airspace) always comes from the network. */
const CACHE = "aerosignal-shell-v37";
const TILES = "aerosignal-tiles-v1";
const LIBS = "aerosignal-libs-v1";
const CHARTS = "aerosignal-charts-v1";
const TILE_MAX = 2500;
const TILE_FRESH = 7 * 864e5;
const SHELL = ["/", "/manifest.webmanifest", "/styles.css", "/map.css", "/missions.css", "/oa.css", "/alt.css", "/mil.css", "/route.css", "/demo.css", "/acct.css", "/fb.css", "/tour.css", "/sym.css", "/mtab.css", "/kb.css",
  "/p1.js", "/p2.js", "/p3.js", "/p4.js", "/p5.js", "/p6.js", "/p7.js", "/p8.js", "/p9.js", "/p10.js", "/p11.js", "/p12.js", "/p13.js", "/p14.js", "/p15.js", "/p16.js", "/p17.js", "/p18.js", "/p19.js", "/p20.js", "/p21.js", "/p22.js", "/p23.js", "/p24.js", "/p25.js", "/p26.js", "/p27.js", "/p28.js", "/p29.js", "/p30.js", "/p31.js", "/p32.js", "/p33.js", "/p34.js", "/p35.js", "/p36.js", "/p37.js", "/p38.js", "/p39.js", "/p40.js", "/p41.js", "/p42.js", "/p43.js", "/p44.js", "/p45.js", "/p46.js", "/p47.js", "/p48.js", "/p49.js", "/p50.js", "/p51.js", "/p52.js", "/p53.js", "/p54.js", "/p55.js", "/p56.js", "/p57.js", "/milmishaps.js",
  "/samples/missions.bin", "/icons/icon-192.png", "/icons/apple-touch-icon.png"];
const SHELL_SET = new Set(SHELL);
const LIB_PRELOAD = ["https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js", "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"];
const TILE_HOSTS = /(^|\.)(tiles\.arcgis\.com|arcgisonline\.com|tile\.openstreetmap\.org|basemaps\.cartocdn\.com|opentopomap\.org|tile\.opentopomap\.org|stamen-tiles\.a\.ssl\.fastly\.net|tiles\.stadiamaps\.com)$/;
const LIB_HOSTS = /^(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => null)));
    const l = await caches.open(LIBS);
    await Promise.all(LIB_PRELOAD.map(async (u) => { if (!(await l.match(u))) { try { const r = await fetch(u, { mode: "cors" }); if (r.ok) await l.put(u, r); } catch (_) {} } }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("aerosignal-shell-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function shellFirst(req, key) {
  const c = await caches.open(CACHE);
  const hit = await c.match(key || req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.type === "basic" && !res.redirected) c.put(key || req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic" && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  } catch (err) {
    const m = await caches.match(req, { ignoreSearch: true });
    if (m) return m;
    throw err;
  }
}

let trimming = false;
async function trimTiles(c) {
  if (trimming) return; trimming = true;
  try { const ks = await c.keys(); if (ks.length > TILE_MAX) for (const k of ks.slice(0, ks.length - TILE_MAX + 200)) await c.delete(k); } catch (_) {}
  trimming = false;
}

async function tile(req, e) {
  const c = await caches.open(TILES);
  const hit = await c.match(req.url);
  const age = hit ? Date.now() - Number(hit.headers.get("x-as-at") || 0) : Infinity;
  const refresh = async () => {
    const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      const body = await res.clone().blob();
      const h = new Headers(res.headers); h.set("x-as-at", String(Date.now()));
      await c.put(req.url, new Response(body, { status: 200, headers: h }));
      trimTiles(c);
    }
    return res;
  };
  if (hit && age < TILE_FRESH) return hit;
  if (hit) { e.waitUntil(refresh().catch(() => null)); return hit; }
  try { return await refresh(); } catch (_) { return fetch(req); }
}

// Approach plates you have opened stay on the device for the cockpit; refreshed daily when there is signal
async function chart(req, e) {
  const c = await caches.open(CHARTS);
  const hit = await c.match(req.url, { ignoreVary: true });
  const age = hit ? Date.now() - Number(hit.headers.get("x-as-at") || 0) : Infinity;
  const refresh = async () => {
    const res = await fetch(req);
    if (res.ok) {
      const body = await res.clone().blob();
      const h = new Headers(res.headers); h.set("x-as-at", String(Date.now()));
      await c.put(req.url, new Response(body, { status: 200, headers: h }));
      const ks = await c.keys(); if (ks.length > 300) for (const k of ks.slice(0, ks.length - 300)) await c.delete(k);
    }
    return res;
  };
  if (hit && age < 864e5) return hit;
  if (hit) { e.waitUntil(refresh().catch(() => null)); return hit; }
  return refresh();
}

async function lib(req) {
  const c = await caches.open(LIBS);
  const hit = await c.match(req.url);
  if (hit) return hit;
  try {
    const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
    const len = Number(res.headers.get("content-length") || 0);
    if (res.ok && len < 4e6) c.put(req.url, res.clone());
    return res;
  } catch (_) { return fetch(req); }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") { e.respondWith(shellFirst(req, "/").catch(() => fetch(req))); return; }
    if (SHELL_SET.has(url.pathname)) { e.respondWith(shellFirst(req).catch(() => fetch(req))); return; }
    e.respondWith(networkFirst(req));
    return;
  }
  if (/\/functions\/v1\/plates$/.test(url.pathname) && (url.searchParams.has("pdf") || url.searchParams.has("geo"))) { e.respondWith(chart(req, e)); return; }
  if (TILE_HOSTS.test(url.hostname) && req.destination === "image") { e.respondWith(tile(req, e)); return; }
  if (LIB_HOSTS.test(url.hostname)) { e.respondWith(lib(req)); return; }
});

self.addEventListener("message", (e) => { if (e.data === "as-version") e.source && e.source.postMessage({ asVersion: CACHE }); });
