"use strict";
/* p69: offline brief package. One tap on the flight brief saves a copy of the whole brief as it
   stands (route, bottom line, weather, NOTAM and TFR panels, mishaps along the route) on this device,
   and loads the chart tiles along the route so the Maps page still draws with no signal. With no
   connection, the Brief page opens the saved copy with a clear note of when it was saved. A saved
   brief refreshes itself whenever the pilot opens it again with signal. Nothing leaves the device. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #offBar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0 4px;padding:10px 12px;border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;font-size:13.5px}
    #offBar .tx{flex:1 1 220px;color:var(--ink2,#9fb0c8);line-height:1.4}
    #offBar .tx b{color:var(--ink,#EAF2FF)}
    #offBar .ok{color:#46e39b}
    #offBar .bt{display:flex;gap:6px;flex-wrap:wrap}
    #offBar progress{width:120px;height:6px;accent-color:#3DE0FF}
    #offNote{margin:0 0 12px;padding:12px 14px;border-radius:12px;border:1px solid #ffb648;background:rgba(255,182,72,.08);font-size:14px;line-height:1.45}
    #offNote b{color:#ffb648}
    #offSnap button,#offSnap input,#offSnap select,#offSnap textarea{pointer-events:none;opacity:.55}
    #offSnap section.panel>h2 .pnl-tg{pointer-events:auto;opacity:1}
  `;
  document.head.appendChild(css);
  const onBrief = () => /^#\/brief(\/|$|\?)/.test(location.hash || "");
  const flight = () => { try { const f = currentFlight(); return f && (f.points || []).length ? f : null; } catch { return null; } };
  const KEY = (id) => "aero_off_" + id, IDX = "aero_off_idx", KEEP = 4;
  const when = (t) => new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const saved = (f) => (f ? ls.get(KEY(f.id)) : null);
  let forceView = false;

  /* Snapshot of the rendered brief, without the controls that only work live */
  function snapshot(page) {
    const c = page.cloneNode(true);
    c.querySelectorAll("#offBar,#offNote,#goPanel,#bfShare,#asWelcome,.pnl-tg,.leaflet-container,script,style,iframe,#askFab,#askPanel").forEach((e) => e.remove());
    return c.innerHTML.replace(/\s{2,}/g, " ");
  }
  function store(f, page, tiles) {
    const prev = saved(f) || {};
    const rec = { at: Date.now(), route: (f.points || []).map((p) => p.ident).join(" "), html: snapshot(page), tiles: tiles != null ? tiles : prev.tiles || 0, go: f.go || null };
    let idx = (ls.get(IDX) || []).filter((x) => x !== f.id);
    idx.unshift(f.id);
    for (const old of idx.slice(KEEP)) ls.del(KEY(old));
    idx = idx.slice(0, KEEP);
    if (!ls.set(KEY(f.id), rec)) {
      // Device storage is full: drop the oldest saved briefs and try again
      for (const old of idx.slice(1)) ls.del(KEY(old));
      idx = [f.id];
      if (!ls.set(KEY(f.id), rec)) return false;
    }
    ls.set(IDX, idx);
    return true;
  }

  /* Chart tiles along the route. Loading them as images lets the app's offline store keep them. */
  const ARC = "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/";
  const SETS = {
    sect: { url: ARC + "VFR_Sectional/MapServer/tile/{z}/{y}/{x}", z: [8, 9, 10] },
    low: { url: ARC + "IFR_AreaLow/MapServer/tile/{z}/{y}/{x}", z: [8, 9, 10, 11] },
    high: { url: ARC + "IFR_High/MapServer/tile/{z}/{y}/{x}", z: [7, 8, 9] },
  };
  const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
  const ty = (lat, z) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z); };
  function tileList(f) {
    const pts = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    if (!pts.length) return [];
    const sets = ["sect"];
    const ifr = /IFR/i.test(f.rules || f.flightRules || "") || /IFR Enroute Low/.test(S.mapBase || "");
    if (ifr) sets.push("low");
    if (/IFR Enroute High/.test(S.mapBase || "")) sets.push("high");
    const out = new Set();
    for (const s of sets) for (const z of SETS[s].z) {
      const add = (x, y) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.add(SETS[s].url.replace("{z}", z).replace("{x}", x + dx).replace("{y}", y + dy)); };
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[i + 1] || a;
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(tx(b.lon, z) - tx(a.lon, z)), Math.abs(ty(b.lat, z) - ty(a.lat, z))) * 2));
        for (let k = 0; k <= n; k++) { const t = k / n; add(tx(a.lon + (b.lon - a.lon) * t, z), ty(a.lat + (b.lat - a.lat) * t, z)); }
      }
    }
    return [...out].slice(0, 1200);
  }
  function loadTiles(list, prog) {
    return new Promise((done) => {
      let i = 0, fin = 0, ok = 0;
      if (!list.length) return done(0);
      const next = () => {
        if (i >= list.length) return;
        const img = new Image();
        img.onload = () => { ok++; end(); };
        img.onerror = end;
        img.src = list[i++];
      };
      function end() { fin++; prog(fin / list.length); if (fin === list.length) done(ok); else next(); }
      for (let k = 0; k < 6; k++) next();
    });
  }

  /* Save bar on the live brief */
  let saving = false;
  function bar(page, f) {
    let el = page.querySelector("#offBar");
    if (!el) {
      el = document.createElement("div");
      el.id = "offBar";
      const at = page.querySelector("#bfBluf") || page.querySelector(":scope > h1");
      if (!at) return;
      at.after(el);
    }
    const s = saved(f);
    const sig = saving ? "saving" : s ? "s" + s.at : "none";
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig;
    if (saving) return;
    el.innerHTML = s
      ? `<span class="tx"><b class="ok">Saved for offline</b> ${when(s.at)}${s.tiles ? `, with ${s.tiles} chart tiles along the route` : ""}. It updates whenever you open this brief with signal.</span><span class="bt"><button type="button" class="btn sec sm" data-a="save">Update now</button><button type="button" class="btn sec sm" data-a="view">View saved copy</button><button type="button" class="btn sec sm" data-a="del">Remove</button></span>`
      : `<span class="tx"><b>Flying where there is no signal?</b> Save this brief and the charts along your route on this device.</span><span class="bt"><button type="button" class="btn sm" data-a="save">Save for offline</button></span>`;
    el.querySelectorAll("button").forEach((b) => (b.onclick = () => act(b.dataset.a, page, f, el)));
  }
  async function act(a, page, f, el) {
    if (a === "del") { ls.del(KEY(f.id)); ls.set(IDX, (ls.get(IDX) || []).filter((x) => x !== f.id)); el.dataset.sig = ""; bar(page, f); try { toast("Offline copy removed"); } catch {} return; }
    if (a === "view") { forceView = true; apply(); return; }
    if (saving) return;
    saving = true;
    el.dataset.sig = "saving";
    el.innerHTML = `<span class="tx"><b>Saving the brief and charts…</b></span><progress max="1" value="0"></progress>`;
    const pr = el.querySelector("progress");
    if (!store(f, page)) { saving = false; el.dataset.sig = ""; bar(page, f); try { toast("This device is out of storage space for offline briefs"); } catch {} return; }
    const n = await loadTiles(tileList(f), (p) => { if (pr) pr.value = p; });
    saving = false;
    // Save again so anything that finished loading meanwhile is in the copy
    const live = document.querySelector("#view .page");
    if (onBrief() && live && live.querySelector(":scope > h1")) store(f, live, n); else { const s = saved(f); if (s) { s.tiles = n; ls.set(KEY(f.id), s); } }
    el.dataset.sig = "";
    bar(live || page, f);
    try { toast("Brief saved for offline"); } catch {}
  }

  /* Saved copy, shown with no signal or on request */
  function show(page, f, s) {
    page.innerHTML = `<div id="offNote"><b>${navigator.onLine ? "Saved copy" : "You are offline."}</b> This is the brief for ${esc(s.route)} you saved ${when(s.at)}. Weather, NOTAMs and TFRs may have changed since then; get an updated briefing before you fly.${navigator.onLine ? ` <a href="#" id="offLive">Back to the live brief</a>` : ""}</div><div id="offSnap">${s.html}</div>`;
    const back = page.querySelector("#offLive");
    if (back) back.onclick = (e) => { e.preventDefault(); forceView = false; try { go(); } catch { location.reload(); } };
    page.querySelectorAll("#offSnap section.pnl-min").forEach((x) => x.classList.remove("pnl-min"));
    page.scrollIntoView && window.scrollTo(0, 0);
  }

  let busy = false, t = 0, refreshed = {};
  function apply() {
    if (busy || !onBrief()) return;
    const page = document.querySelector("#view .page"), f = flight();
    if (!page || !f) return;
    busy = true;
    try {
      const s = saved(f);
      if (s && (forceView || !navigator.onLine)) { if (!page.querySelector("#offSnap")) show(page, f, s); return; }
      if (!page.querySelector(":scope > h1")) return;
      bar(page, f);
      // A saved brief refreshes itself once the page has settled on a later visit with signal
      if (s && navigator.onLine && !saving && !refreshed[f.id]) {
        refreshed[f.id] = true;
        setTimeout(() => {
          const live = document.querySelector("#view .page");
          if (onBrief() && navigator.onLine && live && live.querySelector(":scope > h1") && flight() === f && saved(f)) { store(f, live); const b = live.querySelector("#offBar"); if (b) { b.dataset.sig = ""; bar(live, f); } }
        }, 6000);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 160); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { forceView = false; kick(); });
  window.addEventListener("online", () => { forceView = false; if (onBrief() && document.getElementById("offSnap")) { try { go(); } catch {} } });
  window.addEventListener("offline", () => { if (onBrief()) { const p = document.querySelector("#view .page"), f = flight(), s = saved(f); if (p && f && s) show(p, f, s); } });
  kick();
  window.AeroOffline = { saved, tileList, show: () => { forceView = true; apply(); } };
})();
