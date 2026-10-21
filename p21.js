"use strict";
/* Usability round from competitor review research:
   1. Day mode and text size (sunlight readability, small text on iPad mini)
   2. Patterns along the route at the top of the Mishaps list (synthesis instead of a data dump)
   3. Automatic local backups and restore from a backup file (protection from accidental loss) */
(function () {
  const DKEY = "aerosignal.display";
  const readDisp = () => { try { return JSON.parse(localStorage.getItem(DKEY)) || {}; } catch { return {}; } };
  const disp = Object.assign({ day: false, text: "n" }, readDisp());
  const st = document.createElement("style");
  st.textContent = `
    html.day{filter:invert(1) hue-rotate(180deg);background:#fff}
    html.day img,html.day video,html.day canvas,html.day .kbcard,html.day .mil-wrap svg,html.day #tutRing{filter:invert(1) hue-rotate(180deg)}
    html.day .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg)!important}
    html.day #map.dimmed .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.75) saturate(.6)!important}
    html.day .leaflet-tile-pane img{filter:none}
    html.day .kbcard img,html.day .kbcard canvas{filter:none}
    body.ts-l #view .page{zoom:1.12}
    body.ts-xl #view .page{zoom:1.25}
    .dispbtn{appearance:none;border:1px solid var(--line2);background:transparent;color:var(--ink);border-radius:9px;padding:5px 9px;font-size:12px;font-family:var(--disp);letter-spacing:1px;text-transform:uppercase;cursor:pointer;margin-left:8px;white-space:nowrap}
    .dispbtn:focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
    .dispseg{display:inline-flex;gap:6px;flex-wrap:wrap}
    .dispseg button[aria-pressed=true]{background:var(--cyan);color:#041018;border-color:var(--cyan)}
    #hzPat{margin:8px 10px 2px;padding:10px 12px;border:1px solid var(--line2);border-radius:12px;background:rgba(61,224,255,.05)}
    #hzPat h3{margin:0 0 6px;font-family:var(--disp);font-weight:600;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--cyan)}
    #hzPat .pl{font-size:13.5px;line-height:1.5;color:var(--ink)}
    #hzPat .pchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    #hzPat .pchips button{appearance:none;border:1px solid var(--line2);background:transparent;color:var(--ink);border-radius:999px;padding:4px 10px;font-size:12.5px;cursor:pointer}
    #hzPat .pchips button b{font-family:var(--mono);margin-left:4px;color:var(--amber)}
    #hzPat .pchips button[aria-pressed=true]{background:var(--cyan);color:#041018;border-color:var(--cyan)}
    #hzPat .pchips button[aria-pressed=true] b{color:#041018}
    #hzPat .pnote{font-size:11.5px;color:var(--ink3);margin-top:6px}
    #mctl:not([data-tab=hz]) #hzPat{display:none}
    .hzitem.pathide{display:none!important}
  `;
  document.head.appendChild(st);

  function applyDisp() {
    document.documentElement.classList.toggle("day", !!disp.day);
    document.body.classList.toggle("ts-l", disp.text === "l");
    document.body.classList.toggle("ts-xl", disp.text === "xl");
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.content = disp.day ? "#F4F7FB" : "#050A14";
    const b = document.getElementById("dayBtn");
    if (b) { b.textContent = disp.day ? "Night" : "Day"; b.setAttribute("aria-label", disp.day ? "Switch to night display" : "Switch to day display"); }
    try { localStorage.setItem(DKEY, JSON.stringify(disp)); } catch {}
  }
  function addDayBtn() {
    if (document.getElementById("dayBtn")) return;
    const bar = document.querySelector(".topbar");
    if (!bar) return;
    const b = document.createElement("button");
    b.type = "button";
    b.id = "dayBtn";
    b.className = "dispbtn";
    b.title = "Day mode is easier to read in sunlight";
    b.onclick = () => { disp.day = !disp.day; applyDisp(); };
    const chip = document.getElementById("flightChip");
    if (chip) chip.before(b); else bar.appendChild(b);
  }
  addDayBtn();
  applyDisp();

  function displayPanel() {
    const s = document.createElement("section");
    s.className = "panel";
    s.id = "dispMore";
    s.innerHTML = `<h2>Display</h2>
      <p style="margin-top:0">Day mode uses dark text on a light background, which is easier to read in a sunny cockpit. Night mode keeps the screen dark for night flying.</p>
      <div class="row" style="gap:16px;align-items:center;flex-wrap:wrap">
        <div><div class="small muted" style="margin-bottom:4px">Mode</div><div class="dispseg" id="dMode"><button type="button" class="dispbtn" data-v="night">Night</button><button type="button" class="dispbtn" data-v="day">Day</button></div></div>
        <div><div class="small muted" style="margin-bottom:4px">Text size</div><div class="dispseg" id="dText"><button type="button" class="dispbtn" data-v="n">Normal</button><button type="button" class="dispbtn" data-v="l">Large</button><button type="button" class="dispbtn" data-v="xl">Extra large</button></div></div>
      </div>`;
    const paint = () => {
      $$("#dMode button", s).forEach((b) => b.setAttribute("aria-pressed", (b.dataset.v === "day") === !!disp.day));
      $$("#dText button", s).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === disp.text));
    };
    s.querySelector("#dMode").onclick = (e) => { const v = e.target.dataset && e.target.dataset.v; if (v) { disp.day = v === "day"; applyDisp(); paint(); } };
    s.querySelector("#dText").onclick = (e) => { const v = e.target.dataset && e.target.dataset.v; if (v) { disp.text = v; applyDisp(); paint(); } };
    paint();
    return s;
  }

  const THEMES = [
    ["Landing", /\b(landing(?! gear)|landed|flare|touchdown|bounced|go-around|go around)\b/i],
    ["Takeoff and climb", /\b(takeoff|take-off|departure|initial climb|rotation|lift ?off)\b/i],
    ["Loss of control", /\b(loss of control|lost control|stall(ed)?|spin|aerodynamic stall)\b/i],
    ["Engine power loss", /\b(loss of engine power|power loss|lost (engine )?power|engine (failure|failed|quit|stopped)|partial power)\b/i],
    ["Fuel", /\b(fuel exhaustion|fuel starvation|ran out of fuel|fuel (mis)?management|fuel contamination)\b/i],
    ["Instrument conditions", /\b(instrument meteorological|imc\b|clouds?|low visibility|fog|ceiling)/i],
    ["Wind and gusts", /\b(gust(s|ing)?|crosswind|tailwind|wind ?shear|strong wind)/i],
    ["Night", /\b(night|dark(ness)?)\b/i],
    ["Terrain, wires and obstacles", /\b(wires?|power ?lines?|trees?|terrain|obstacle|tower|mountain)/i],
    ["Icing", /\b(icing|ice accretion|structural ice|carburetor ice)/i],
    ["Spatial disorientation", /\b(spatial disorientation|disoriented)/i],
  ];
  let patKey = "", patData = null, patBusy = false, patFilter = null;

  function patternsFor(rows) {
    const n = rows.length, fat = rows.filter((r) => +r.fatal > 0).length;
    const imc = rows.filter((r) => String(r.weather_condition || "").toUpperCase() === "IMC").length;
    const models = new Map();
    for (const r of rows) { const m = String(r.model || "").trim().toUpperCase(); if (m) models.set(m, (models.get(m) || 0) + 1); }
    const topModel = [...models.entries()].sort((a, b) => b[1] - a[1])[0];
    const themes = THEMES.map(([label, re]) => {
      const ids = rows.filter((r) => re.test(r.excerpt || "") || (label === "Instrument conditions" && String(r.weather_condition || "").toUpperCase() === "IMC")).map((r) => String(r.ev_id || r.accident_number || ""));
      return { label, ids };
    }).filter((t) => t.ids.length).sort((a, b) => b.ids.length - a.ids.length).slice(0, 7);
    const years = rows.map((r) => +String(r.event_date || "").slice(0, 4)).filter(Boolean);
    return { n, fat, imc, topModel, themes, y0: Math.min(...years), y1: Math.max(...years) };
  }

  function renderPatterns() {
    const box = document.getElementById("hzPat");
    if (!box) return;
    if (!patData) { box.hidden = true; return; }
    const p = patData;
    if (!p.n) { box.hidden = true; return; }
    box.hidden = false;
    const pct = (k) => Math.round((k / p.n) * 100);
    box.innerHTML = `<h3>Patterns along this route</h3>
      <div class="pl"><b>${fmt(p.n)}</b> accident${p.n === 1 ? "" : "s"}${isFinite(p.y0) ? ` from ${p.y0} to ${p.y1}` : ""}, <b>${fmt(p.fat)}</b> fatal (${pct(p.fat)}%). ${p.imc ? `${fmt(p.imc)} happened in instrument conditions. ` : ""}${p.topModel && p.topModel[1] > 1 ? `Most common aircraft: ${esc(p.topModel[0])} (${p.topModel[1]}).` : ""}</div>
      ${p.themes.length ? `<div class="pchips" role="group" aria-label="Filter by theme">${p.themes.map((t, i) => `<button type="button" data-i="${i}" aria-pressed="${patFilter === i}">${esc(t.label)}<b>${t.ids.length}</b></button>`).join("")}</div>
      <div class="pnote">${patFilter != null ? `Showing the ${p.themes[patFilter].ids.length} accidents that mention ${esc(p.themes[patFilter].label.toLowerCase())}. Tap again to show all.` : "Tap a theme to show only those accidents. Themes come from words in the NTSB summaries, and one accident can match several."}</div>` : ""}`;
    box.querySelectorAll(".pchips button").forEach((b) => (b.onclick = () => { const i = +b.dataset.i; patFilter = patFilter === i ? null : i; applyFilter(); renderPatterns(); }));
    applyFilter();
  }
  function applyFilter() {
    const ids = patFilter != null && patData && patData.themes[patFilter] ? new Set(patData.themes[patFilter].ids) : null;
    document.querySelectorAll("#hzlist .hzitem").forEach((li) => li.classList.toggle("pathide", !!ids && !ids.has(li.dataset.id)));
  }

  async function updatePatterns() {
    const f = currentFlight && currentFlight();
    const corr = document.getElementById("corr");
    if (!f || !f.points || !f.points.length || !corr) return;
    const key = JSON.stringify([f.points.map((p) => [p.lat, p.lon]), corr.value]);
    if (key === patKey) { renderPatterns(); return; }
    if (patBusy) return;
    patBusy = true;
    try {
      const rows = await corridorAccidents(f.points, +corr.value);
      patKey = key;
      patData = patternsFor(rows || []);
      patFilter = null;
    } catch { patData = null; }
    patBusy = false;
    renderPatterns();
  }

  function setupPatterns() {
    const list = document.getElementById("hzlist");
    if (!list || document.getElementById("hzPat")) return;
    const box = document.createElement("div");
    box.id = "hzPat";
    box.hidden = true;
    list.before(box);
    new MutationObserver(() => { if (patData) applyFilter(); updatePatterns(); }).observe(list, { childList: true });
    const corr = document.getElementById("corr");
    if (corr) corr.addEventListener("change", () => setTimeout(updatePatterns, 50));
    patKey = "";
    updatePatterns();
  }

  const baseMaps = ROUTES.maps;
  ROUTES.maps = function (el, arg) {
    baseMaps(el, arg);
    try { setupPatterns(); } catch (e) { console.error(e); }
  };

  const DB = "aerosignal-backups", STORE = "snaps", KEEP = 7;
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "at" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE)); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
  const hasData = () => (S.logbook && S.logbook.flights && S.logbook.flights.length) || (S.missions || []).length || (S.flights || []).some((f) => f.points && f.points.length);
  async function snapshot(force) {
    if (!("indexedDB" in window) || !hasData()) return;
    const day = new Date().toISOString().slice(0, 10);
    const all = await listSnaps();
    if (!force && all.some((s) => s.day === day)) return;
    const data = JSON.stringify(S);
    await tx("readwrite", (os) => os.put({ day, at: Date.now(), size: data.length, summary: summary(S), data }));
    const extra = (await listSnaps()).slice(KEEP);
    for (const s of extra) await tx("readwrite", (os) => os.delete(s.at));
  }
  async function listSnaps() {
    if (!("indexedDB" in window)) return [];
    try {
      const rows = await tx("readonly", (os) => os.getAll());
      return (rows || []).map(({ day, at, size, summary: sm }) => ({ day, at, size, summary: sm })).sort((a, b) => b.at - a.at);
    } catch { return []; }
  }
  const getSnap = (at) => tx("readonly", (os) => os.get(at));
  function summary(s) {
    const lb = (s.logbook && s.logbook.flights && s.logbook.flights.length) || 0;
    return `${lb} logbook entries, ${(s.flights || []).length} flights, ${(s.missions || []).length} missions`;
  }
  function restoreState(obj) {
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, obj);
    save();
    toast("Backup restored");
    setTimeout(() => location.reload(), 500);
  }

  async function backupPanel() {
    const s = document.createElement("section");
    s.className = "panel";
    s.id = "bkPanel";
    s.innerHTML = `<h2>Backups</h2>
      <p style="margin-top:0">AeroSignal saves a backup of the data on this device once a day and keeps the last ${KEEP}. If something is deleted by mistake, restore it here. To move to another device, export a backup file above and restore it there.</p>
      <div id="bkList" class="small muted">Loading backups</div>
      <div class="row" style="gap:8px;margin-top:10px"><button type="button" class="btn sec sm" id="bkNow">Back up now</button><label class="btn sec sm" style="cursor:pointer">Restore from a backup file<input type="file" id="bkFile" accept=".json,application/json" hidden></label></div>`;
    const paint = async () => {
      const rows = await listSnaps();
      const box = s.querySelector("#bkList");
      box.className = rows.length ? "" : "small muted";
      box.innerHTML = rows.length ? `<table class="t"><tr><th>Saved</th><th>Contents</th><th></th></tr>${rows.map((r) => `<tr><td class="mono">${esc(new Date(r.at).toLocaleString())}</td><td class="small">${esc(r.summary || "")}</td><td><button type="button" class="btn sec sm" data-day="${r.at}">Restore</button></td></tr>`).join("")}</table>` : "No backups yet. One is saved automatically each day you use the app.";
      box.querySelectorAll("button[data-day]").forEach((b) => (b.onclick = async () => {
        if (!confirm("Replace the data on this device with this backup? A backup of the current data is saved first.")) return;
        const snap = await getSnap(+b.dataset.day);
        if (!snap) return toast("That backup could not be read");
        await snapshot(true).catch(() => {});
        restoreState(JSON.parse(snap.data));
      }));
    };
    s.querySelector("#bkNow").onclick = async () => { await snapshot(true); toast("Backup saved"); paint(); };
    s.querySelector("#bkFile").onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      let obj = null;
      try { obj = JSON.parse(await file.text()); } catch {}
      const data = obj && obj.kind === "aerosignal.backup" && obj.data;
      if (!data || typeof data !== "object") return toast("That file is not an AeroSignal backup");
      if (!confirm(`Restore ${file.name}? It contains ${summary(data)}. It replaces the data on this device; a backup of the current data is saved first.`)) return;
      await snapshot(true).catch(() => {});
      restoreState(data);
    };
    paint();
    return s;
  }

  setTimeout(() => snapshot(false).catch(() => {}), 4000);
  window.addEventListener("pagehide", () => { snapshot(false).catch(() => {}); });

  async function decorate() {
    addDayBtn();
    applyDisp();
    const h = location.hash || "";
    const page = document.querySelector("#view .page");
    if (!page) return;
    if (h.startsWith("#/more") && !document.getElementById("dispMore")) {
      const first = page.querySelector("section.panel");
      const p = displayPanel();
      if (first) first.before(p); else page.appendChild(p);
    }
    if (h.startsWith("#/data") && !document.getElementById("bkPanel")) {
      const secs = page.querySelectorAll("section.panel");
      const p = await backupPanel();
      if (!document.getElementById("bkPanel")) { if (secs[0]) secs[0].after(p); else page.appendChild(p); }
    }
  }
  window.addEventListener("hashchange", () => setTimeout(decorate, 120));
  setTimeout(decorate, 200);
  window.AeroUX = { snapshot, listSnaps, patternsFor, disp };
  if ((location.hash || "").startsWith("#/maps")) go();
})();
