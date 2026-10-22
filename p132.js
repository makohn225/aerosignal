"use strict";
/* p132: save charts for an area, for flying without signal.
   Maps, Tools, "Save charts for this area" keeps every tile of the chart on screen (sectional with
   terminal area charts, IFR low or IFR high) for the area in view, at all chart zoom levels, in a
   separate store on this device that the normal tile clean up never trims (service worker,
   cache "aerosignal-region-v1"). "Saved chart areas" lists them with their size and age, and can
   refresh or delete each one. FAA VFR charts change every 56 days and IFR enroute charts every 56
   days, so areas older than that are flagged. Up to 6,000 tiles per area (a state is usually
   1,000 to 3,000 for the sectional). Browsers can still clear stored data when the device runs low
   on space; the phone apps keep it more reliably. */
(function () {
  if (typeof L === "undefined") return;
  const REGION = "aerosignal-region-v1";
  const ARC = "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/";
  const SETS = {
    sect: { name: "VFR sectional and terminal area", parts: [{ svc: "VFR_Sectional", z: [8, 9, 10, 11] }, { svc: "VFR_Terminal", z: [10, 11, 12] }] },
    low: { name: "IFR enroute low", parts: [{ svc: "IFR_AreaLow", z: [8, 9, 10, 11] }] },
    high: { name: "IFR enroute high", parts: [{ svc: "IFR_High", z: [7, 8, 9] }] },
  };
  const MAX = 6000, KB = 38; // average FAA chart tile is about 38 KB
  const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
  const ty = (lat, z) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z); };
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const up = (n) => Math.ceil(n).toLocaleString("en-US");
  const areas = () => { if (typeof S === "undefined") return []; S.chartAreas = S.chartAreas || []; return S.chartAreas; };

  function urls(b, set) {
    const out = [];
    for (const p of SETS[set].parts) for (const z of p.z) {
      const x0 = tx(b.w, z), x1 = tx(b.e, z), y0 = ty(b.n, z), y1 = ty(b.s, z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(`${ARC}${p.svc}/MapServer/tile/${z}/${y}/${x}`);
    }
    return out;
  }
  function setOf(map) {
    let s = "sect";
    map.eachLayer((l) => { const u = l._url || ""; if (/IFR_AreaLow/.test(u)) s = "low"; else if (/IFR_High/.test(u)) s = "high"; });
    return s;
  }
  async function download(list, prog, stop) {
    const c = await caches.open(REGION);
    let i = 0, ok = 0, bytes = 0, done = 0;
    const one = async () => {
      while (i < list.length && !stop.v) {
        const u = list[i++];
        try {
          if (!(await c.match(u))) {
            const r = await fetch(u, { mode: "cors", credentials: "omit" });
            if (r.ok) { const b = await r.blob(); bytes += b.size; await c.put(u, new Response(b, { headers: { "content-type": r.headers.get("content-type") || "image/jpeg", "x-as-at": String(Date.now()) } })); ok++; }
            // 404 means the chart has no tile there (outside coverage); that is fine
          } else ok++;
        } catch (e) { if (e && e.name === "QuotaExceededError") { stop.v = true; stop.full = true; } }
        done++; prog(done / list.length);
      }
    };
    await Promise.all([one(), one(), one(), one(), one(), one()]);
    return { ok, bytes };
  }
  async function remove(area) {
    const keep = new Set(areas().filter((a) => a.id !== area.id).flatMap((a) => urls(a.b, a.set)));
    const c = await caches.open(REGION);
    for (const u of urls(area.b, area.set)) if (!keep.has(u)) await c.delete(u);
    S.chartAreas = areas().filter((a) => a.id !== area.id); save();
  }

  /* Dialog */
  function dialog(html) {
    let d = document.getElementById("caDlg");
    if (!d) {
      const css = document.createElement("style");
      css.textContent = `
        #caDlg{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);padding:16px}
        #caDlg .box{background:#0d1a2b;border:1px solid rgba(61,224,255,.4);border-radius:14px;max-width:460px;width:100%;padding:16px 18px;color:#EAF2FF;font:14px/1.45 var(--body,system-ui);max-height:85vh;overflow:auto}
        #caDlg h3{margin:0 0 8px;font:700 15px var(--disp,system-ui);letter-spacing:.5px;color:#3DE0FF;text-transform:uppercase}
        #caDlg .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        #caDlg button{font:600 13.5px var(--body,system-ui);border-radius:9px;padding:8px 12px;border:1px solid rgba(61,224,255,.5);background:transparent;color:#3DE0FF;cursor:pointer}
        #caDlg button.p{background:#3DE0FF;color:#04121f;border-color:#3DE0FF}
        #caDlg progress{width:100%;margin-top:10px}
        #caDlg ul{list-style:none;margin:6px 0 0;padding:0}#caDlg li{padding:9px 0;border-top:1px solid rgba(255,255,255,.08)}
        #caDlg .old{color:#ffb547;font-weight:600}#caDlg .m{color:#9db2ce;font-size:12.5px}
        #caDlg .d{color:#ff4d6a;font-weight:700;font-size:12px;margin-top:8px}
      `;
      document.head.appendChild(css);
      d = document.createElement("div"); d.id = "caDlg"; document.body.appendChild(d);
      d.addEventListener("click", (e) => { if (e.target === d) d.remove(); });
    }
    d.innerHTML = `<div class="box" role="dialog" aria-modal="true">${html}</div>`;
    return d;
  }
  const OLD = 56 * 864e5;
  function saveArea(map) {
    const bb = map.getBounds(), b = { n: bb.getNorth(), s: bb.getSouth(), e: bb.getEast(), w: bb.getWest() };
    const set = setOf(map), list = urls(b, set);
    if (list.length > MAX) { toast(`That area needs ${up(list.length)} tiles. Zoom in until it is under ${up(MAX)}.`); return; }
    const mb = (list.length * KB) / 1024;
    const name = `${SETS[set].name}, ${b.s.toFixed(1)}° to ${b.n.toFixed(1)}° N, ${Math.abs(b.w).toFixed(1)}° to ${Math.abs(b.e).toFixed(1)}° W`;
    const d = dialog(`<h3>Save charts for this area</h3>
      <p>${h(SETS[set].name)} charts for the area on screen, every chart zoom level: about <b>${up(list.length)} tiles, ${up(mb)} MB</b> at most. Places outside chart coverage take no space.</p>
      <p class="m">Switch the map to IFR low or high first to save those charts instead.</p>
      <progress value="0" max="1" hidden></progress><p class="st m"></p>
      <div class="row"><button class="p" data-a="go">Save</button><button data-a="x">Cancel</button></div>
      <div class="d">Check the FAA chart dates before flight. Saved charts are not updated until you refresh them.</div>`);
    const stop = { v: false };
    d.querySelector('[data-a="x"]').onclick = () => { stop.v = true; d.remove(); };
    d.querySelector('[data-a="go"]').onclick = async (ev) => {
      ev.target.disabled = true;
      const pr = d.querySelector("progress"), st = d.querySelector(".st"); pr.hidden = false;
      const r = await download(list, (p) => { pr.value = p; st.textContent = `${Math.round(p * 100)}%`; }, stop);
      if (stop.full) { st.textContent = "This device is out of storage space. Saved what fit."; }
      if (r.ok) {
        const a = { id: Date.now().toString(36), name, set, b, tiles: r.ok, mb: Math.max(1, Math.ceil(r.bytes / 1048576)), at: Date.now() };
        S.chartAreas = [...areas(), a]; save();
        st.textContent = `${stop.full ? st.textContent + " " : ""}Saved ${up(r.ok)} tiles (${a.mb} MB).`;
        toast("Charts saved for this area");
      } else if (!stop.v) st.textContent = "Nothing was saved. Check your connection and try again.";
      d.querySelector('[data-a="x"]').textContent = "Close";
    };
  }
  function manage(map) {
    const list = areas();
    const d = dialog(`<h3>Saved chart areas</h3>
      ${list.length ? `<ul>${list.map((a) => { const old = Date.now() - a.at > OLD; return `<li><b>${h(a.name)}</b><br><span class="m">${up(a.tiles)} tiles, ${up(a.mb)} MB, saved ${new Date(a.at).toLocaleDateString()}</span>${old ? ' <span class="old">Older than one chart cycle, refresh it</span>' : ""}<div class="row"><button data-v="${a.id}">Show</button><button data-r="${a.id}">Refresh</button><button data-d="${a.id}">Delete</button></div></li>`; }).join("")}</ul>` : '<p class="m">None yet. Move the map over the area you will fly, then Tools, Save charts for this area.</p>'}
      <div class="row"><button data-a="x">Close</button></div>`);
    d.querySelector('[data-a="x"]').onclick = () => d.remove();
    d.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => { const a = list.find((x) => x.id === b.dataset.v); d.remove(); map.fitBounds([[a.b.s, a.b.w], [a.b.n, a.b.e]]); }));
    d.querySelectorAll("[data-d]").forEach((b) => (b.onclick = async () => { b.disabled = true; await remove(list.find((x) => x.id === b.dataset.d)); toast("Chart area deleted"); manage(map); }));
    d.querySelectorAll("[data-r]").forEach((b) => (b.onclick = async () => {
      const a = list.find((x) => x.id === b.dataset.r); b.disabled = true; b.textContent = "Refreshing...";
      const c = await caches.open(REGION); for (const u of urls(a.b, a.set)) await c.delete(u);
      const r = await download(urls(a.b, a.set), () => {}, { v: false });
      a.tiles = r.ok; a.mb = Math.max(1, Math.ceil(r.bytes / 1048576)); a.at = Date.now(); save(); manage(map);
    }));
  }

  /* Tools menu items (p123 hook, shared with p129 and p130) */
  const prev = window.AeroMapTools;
  window.AeroMapTools = {
    items: (map) => [...(prev ? prev.items(map) : []), ["casave", "Save charts for this area", "For flying without signal"], ["calist", "Saved chart areas", areas().length ? `${areas().length} saved` : "None yet"]],
    run: (t, map) => {
      if (t === "casave") { if (!("caches" in window)) { toast("This browser cannot save charts"); return; } saveArea(map); return; }
      if (t === "calist") { manage(map); return; }
      if (prev) prev.run(t, map);
    },
  };
  window.AeroChartAreas = { urls, remove };
})();
