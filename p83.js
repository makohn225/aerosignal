"use strict";
/* p83: runway winds and density altitude on the flight brief, for the departure, destination and
   alternate. Wind comes from the METAR for departure (or the TAF at the departure time when it is
   more than an hour out) and from the TAF at the arrival time for the destination and alternate
   (METAR when there is no TAF). For each runway end it works out headwind and crosswind (with the
   gust), picks the best runway, flags tailwind and any crosswind above the pilot's own limit, and
   gives density altitude from the reported temperature and altimeter. Runway data comes from the
   airport_detail RPC (true headings; when a heading is missing the runway number is used and the
   result is marked approximate). One line goes in the bottom line card and a chip in the jump bar. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #rwPanel .rw-ap{padding:10px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #rwPanel .rw-ap:first-of-type{border-top:0;padding-top:4px}
    #rwPanel .rw-hd{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline}
    #rwPanel .rw-hd b{font:700 15px var(--mono,monospace)}
    #rwPanel .rw-big{display:flex;flex-wrap:wrap;gap:6px 18px;margin:8px 0 4px;font-size:14px}
    #rwPanel .rw-big span b{font-family:var(--mono,monospace)}
    #rwPanel .rw-tw{overflow-x:auto}
    #rwPanel table{border-collapse:collapse;width:100%;min-width:360px;font:12.5px var(--mono,monospace);margin-top:6px}
    #rwPanel th,#rwPanel td{padding:4px 6px;text-align:right;border-bottom:1px solid var(--line2,rgba(255,255,255,.07));white-space:nowrap}
    #rwPanel th:first-child,#rwPanel td:first-child{text-align:left}
    #rwPanel th{color:var(--ink2,#9fb0c8);font-weight:600;font-size:11px}
    #rwPanel tr.best td{color:var(--ink,#EAF2FF);font-weight:700}
    #rwPanel .ok{color:#46e39b}#rwPanel .warn{color:#ffb648}#rwPanel .bad{color:#ff4d6a}
    #rwPanel .rw-lim{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:13px}
    #rwPanel .rw-lim input{width:80px;font:14px var(--mono,monospace)}
    #rwPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #bfBluf .bf-rw{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-rw .warn{color:#ffb648;font-weight:700}#bfBluf .bf-rw .bad{color:#ff4d6a;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const hhmmZ = (d) => `${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}Z`;

  const apCache = new Map();
  function apDetail(code) {
    if (!apCache.has(code)) apCache.set(code, rpc("airport_detail", { code }).catch(() => { apCache.delete(code); return null; }));
    return apCache.get(code);
  }

  function reports(f) {
    const metars = {}, tafs = {};
    try {
      for (const r of splitReports(f.wxText || "")) {
        if (r.kind === "METAR") { const m = parseMetar(r.text, new Date()); if (m && m.station && (!metars[m.station] || metars[m.station].time < m.time)) metars[m.station] = m; }
        else { const t = parseTaf(r.text, new Date()); if (t && t.station && (!tafs[t.station] || tafs[t.station].from < t.from)) tafs[t.station] = t; }
      }
    } catch {}
    return { metars, tafs };
  }

  // Conditions to use at a station for a time: METAR when the time is within an hour, else the TAF
  function condsAt(st, when, rep) {
    const m = rep.metars[st], t = rep.tafs[st];
    const soon = Math.abs(when - Date.now()) < 36e5;
    if (t && !soon) {
      const x = tafAt(t, when);
      if (x && x.prev && x.prev.wind != null) {
        const gustT = Math.max(x.prev.gust || 0, ...x.temps.map((g) => g.gust || 0));
        return { src: `TAF for ${hhmmZ(when)}`, dir: x.prev.dir, wind: x.prev.wind, gust: x.prev.gust || 0, tempoGust: gustT > (x.prev.gust || 0) ? gustT : 0, temp: m ? m.temp : null, alt: m ? m.alt : null, tempNote: m ? "temperature and altimeter from the current METAR" : "" };
      }
    }
    if (m && m.wind != null) return { src: `METAR ${hhmmZ(m.time)}`, dir: m.dir, wind: m.wind, gust: m.gust || 0, tempoGust: 0, temp: m.temp, alt: m.alt, tempNote: "" };
    return null;
  }

  function comps(dir, spd, hdg) {
    const a = (dir - hdg) * R;
    return { head: spd * Math.cos(a), cross: spd * Math.sin(a) };
  }

  function analyze(ap, c, xwMin) {
    const a = ap.airport || {}, rws = (ap.runways || []).filter((r) => r.le_ident || r.he_ident);
    const elev = +a.elev_ft || 0;
    const ends = [];
    for (const r of rws) {
      for (const [id, hd] of [[r.le_ident, r.le_heading], [r.he_ident, r.he_heading]]) {
        if (!id || /^H/i.test(id)) continue;
        let hdg = hd != null && isFinite(+hd) ? +hd : null, approx = false;
        if (hdg == null) { const n = parseInt(id, 10); if (!isFinite(n)) continue; hdg = (n * 10) % 360; approx = true; }
        ends.push({ id, hdg, approx, len: +r.length_ft || 0, wid: +r.width_ft || 0, surf: r.surface || "", lit: !!r.lighted });
      }
    }
    let da = null;
    if (c && c.temp != null && c.alt) {
      const pa = elev + (29.92 - c.alt) * 1000;
      da = pa + 118.8 * (c.temp - (15 - (2 * elev) / 1000));
    }
    const out = { ident: a.ident, name: a.name, elev, ends, da, c, longest: Math.max(0, ...ends.map((e) => e.len)) };
    if (!c || !ends.length) return out;
    const vrb = c.dir === "VRB" || c.wind === 0;
    const dir = vrb ? null : +c.dir;
    const g = Math.max(c.gust || 0, c.tempoGust || 0);
    for (const e of ends) {
      if (vrb) { e.head = 0; e.cross = c.wind; e.gx = g || c.wind; continue; }
      const k = comps(dir, c.wind, e.hdg), kg = g ? comps(dir, g, e.hdg) : k;
      e.head = k.head; e.cross = Math.abs(k.cross); e.gx = Math.abs(kg.cross); e.side = k.cross >= 0 ? "R" : "L";
    }
    const pool = ends.filter((e) => e.len >= 1500).length ? ends.filter((e) => e.len >= 1500) : ends;
    out.best = [...pool].sort((x, y) => (y.head - x.head) || (x.gx - y.gx) || (y.len - x.len))[0];
    out.vrb = vrb; out.g = g;
    out.over = xwMin ? out.best.gx > xwMin : false;
    out.tail = out.best.head < -2;
    return out;
  }

  function list(f) {
    const pts = (f.points || []).filter((p) => p.kind === "airport" || /^[A-Z]{4}$/.test(p.ident || ""));
    const dep = (f.points || [])[0], dst = (f.points || [])[(f.points || []).length - 1];
    const out = [];
    const id = (p) => (p ? String(p.ident || "").toUpperCase() : "");
    if (dep && dep.kind === "airport") out.push({ role: "Departure", code: id(dep) });
    if (dst && dst.kind === "airport" && id(dst) !== id(dep)) out.push({ role: "Destination", code: id(dst) });
    else if (dst && dst.kind === "airport" && out.length === 1) out[0].role = "Departure and return";
    const alt = String(f.alternate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (alt && !out.some((x) => x.code === alt || x.code === "K" + alt)) out.push({ role: "Alternate", code: alt.length === 3 ? "K" + alt : alt });
    void pts;
    return out;
  }

  async function load(f) {
    let prof = null; try { prof = profile(f); } catch {}
    const dep = prof && prof.depLocal ? new Date(prof.depLocal) : new Date();
    const arr = prof && prof.arrLocal ? new Date(prof.arrLocal) : new Date(+dep + 36e5);
    const rep = reports(f);
    const xwMin = +(S.rwPrefs && S.rwPrefs.xw) || 0;
    const res = [];
    for (const x of list(f)) {
      const ap = await apDetail(x.code);
      if (!ap || !ap.airport) { res.push({ role: x.role, code: x.code, missing: true }); continue; }
      const st = ap.airport.icao_code || ap.airport.gps_code || ap.airport.ident || x.code;
      const when = x.role === "Departure" || x.role === "Departure and return" ? dep : arr;
      const c = condsAt(st, when, rep) || condsAt(x.code, when, rep);
      res.push({ role: x.role, code: x.code, ...analyze(ap, c, xwMin) });
    }
    return { res, xwMin, hasWx: !!(f.wxText || "").trim() };
  }

  function sideTxt(e) { return e.side ? (e.side === "R" ? " from the right" : " from the left") : ""; }

  function paint(sec, r) {
    if (!r) { sec.innerHTML = `<h2>Runway winds</h2><p class="small muted" style="margin:0">Working out runway winds and density altitude…</p>`; return; }
    const blocks = r.res.map((a) => {
      if (a.missing) return `<div class="rw-ap"><div class="rw-hd"><b>${h(a.code)}</b><span class="small muted">${h(a.role)}</span></div><p class="small muted" style="margin:4px 0 0">No runway data for this airport.</p></div>`;
      const head = `<div class="rw-hd"><span><b>${h(a.ident)}</b> <span class="small">${h(a.name || "")}</span></span><span class="small muted">${h(a.role)} · elevation ${fmt(a.elev)} ft</span></div>`;
      if (!a.c) return `<div class="rw-ap">${head}<p class="small muted" style="margin:4px 0 0">No weather for this airport in the brief. Load current weather to see runway winds.${a.longest ? ` Longest runway ${fmt(a.longest)} ft.` : ""}</p></div>`;
      const b = a.best;
      const wind = a.c.wind === 0 ? "Calm" : `${a.c.dir === "VRB" ? "Variable" : String(a.c.dir).padStart(3, "0") + "°"} at ${a.c.wind} kt${a.c.gust ? ` gusting ${a.c.gust}` : ""}${a.c.tempoGust ? ` (TEMPO gusts ${a.c.tempoGust})` : ""}`;
      const xCls = a.over ? "bad" : b && b.gx >= 15 ? "warn" : "ok";
      const daCls = a.da == null ? "" : a.da - a.elev >= 2000 ? "bad" : a.da - a.elev >= 1000 ? "warn" : "";
      const big = b ? `<div class="rw-big">
        <span>Best runway <b>${h(b.id)}</b>${b.approx ? " (approximate heading)" : ""}, ${fmt(b.len)} ft</span>
        <span>${b.head >= 0 ? "Headwind" : "<span class='bad'>Tailwind</span>"} <b>${Math.ceil(Math.abs(b.head))} kt</b></span>
        <span>Crosswind <b class="${xCls}">${Math.ceil(b.cross)} kt</b>${sideTxt(b)}${a.g ? `, <b class="${xCls}">${Math.ceil(b.gx)} kt</b> in gusts` : ""}</span>
        ${a.da != null ? `<span>Density altitude <b class="${daCls}">${fmt(Math.ceil(a.da / 100) * 100)} ft</b></span>` : ""}
      </div>` : "";
      const rows = [...a.ends].sort((x, y) => y.head - x.head).map((e) => `<tr class="${e === b ? "best" : ""}"><td>${h(e.id)}${e.approx ? "~" : ""}</td><td>${fmt(e.len)} × ${fmt(e.wid)}</td><td>${e.head >= 0 ? Math.ceil(e.head) : "<span class='bad'>" + -Math.ceil(-e.head) + "</span>"}</td><td>${Math.ceil(e.cross)}${e.side || ""}</td><td>${a.g ? Math.ceil(e.gx) : ""}</td><td>${h(e.surf)}${e.lit ? ", lit" : ""}</td></tr>`).join("");
      const notes = [a.over ? `<span class="bad">Crosswind${a.g ? " in gusts" : ""} is above your ${r.xwMin} kt limit on every runway.</span>` : "", a.tail ? `<span class="bad">Every runway has a tailwind.</span>` : "", a.vrb && a.c.wind ? "Wind is variable, so the full wind is treated as crosswind." : "", a.c.tempNote ? `Density altitude uses the ${h(a.c.tempNote)}.` : ""].filter(Boolean).join(" ");
      return `<div class="rw-ap">${head}<div class="small muted">${h(wind)} · ${h(a.c.src)}</div>${big}${notes ? `<p class="small" style="margin:4px 0">${notes}</p>` : ""}
        <div class="rw-tw"><table><thead><tr><th>Runway</th><th>Size ft</th><th>Head</th><th>Cross</th><th>Gust X</th><th>Surface</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }).join("");
    sec.innerHTML = `<h2>Runway winds</h2>
      ${r.res.length ? blocks : `<p class="small muted" style="margin:0">Add a departure and destination airport to see runway winds.</p>`}
      ${r.hasWx ? "" : `<p class="small muted" style="margin:8px 0 0">Load current weather on this page to fill in winds and density altitude.</p>`}
      <div class="rw-lim"><label for="rwXw">My crosswind limit (kt)</label><input id="rwXw" type="number" min="0" max="60" step="1" placeholder="None" value="${r.xwMin || ""}"><span class="small muted">Use your own limit or the aircraft's demonstrated crosswind, whichever is lower.</span></div>
      <p class="disc">Planning aid from the reported wind and public runway data. Runway in use is set by ATC or local traffic. Check the current ATIS or AWOS before takeoff and landing.</p>`;
    const inp = sec.querySelector("#rwXw");
    inp.onchange = () => { S.rwPrefs = S.rwPrefs || {}; S.rwPrefs.xw = Math.max(0, Math.min(60, Math.round(+inp.value || 0))) || 0; save(); last.key = ""; kick(); };
  }

  function bluf(page, r) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    let el = card.querySelector(".bf-rw");
    const have = r && r.res.filter((a) => a.best && a.c);
    if (!have || !have.length) { if (el) el.remove(); return; }
    const html = "Runways: " + have.map((a) => {
      const b = a.best, cls = a.over || a.tail ? "bad" : b.gx >= 15 ? "warn" : "";
      return `${h(a.ident)} ${h(b.id)}, ${a.tail ? `<span class="bad">tailwind ${Math.ceil(-b.head)}</span>` : `head ${Math.ceil(b.head)}`}, cross <span class="${cls}">${Math.ceil(a.g ? b.gx : b.cross)}${a.g ? " gust" : ""}</span>${a.da != null && a.da - a.elev >= 1000 ? `, DA <span class="warn">${fmt(Math.ceil(a.da / 100) * 100)}</span>` : ""}`;
    }).join("; ") + `. <a href="#" data-rw="1">Details</a>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-rw"; const after = card.querySelector(".bf-wx"); if (after) after.after(el); else card.appendChild(el); }
    el.dataset.v = html; el.innerHTML = html;
    el.querySelector("[data-rw]").onclick = jump;
  }
  function jump(e) {
    e.preventDefault();
    const s = document.getElementById("rwPanel");
    if (!s) return;
    if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true);
    s.style.scrollMarginTop = "84px";
    s.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  let busy = false, t = 0;
  const last = { key: "", r: null };
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId || !(f.points || []).length || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${f.alternate || ""}|${f.date}|${f.time}|${(f.wxText || "").length}|${(S.rwPrefs || {}).xw || 0}`;
      let sec = page.querySelector(":scope > #rwPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "rwPanel"; }
      if (last.key !== key) {
        last.key = key; last.r = null; sec.dataset.k = "";
        load(f).then((r) => { if (last.key === key) { last.r = r; sec.dataset.k = ""; kick(); } }).catch(() => {});
      }
      const stamp = `${key}|${last.r ? 1 : 0}`;
      if (sec.dataset.k !== stamp) { sec.dataset.k = stamp; paint(sec, last.r); }
      bluf(page, last.r);
      // Just after the flight track panel (nothing positions itself after it), else after When to go
      const anchor = page.querySelector(":scope > #trkPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) { const g = page.querySelector(":scope > #goPanel"); if (g) g.after(sec); else page.appendChild(sec); }
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#rwPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#rwPanel"; a.textContent = "Runway winds"; a.onclick = jump;
        const w = j.querySelector('[data-s="#wtgPanel"]'); if (w) w.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 300); };
  new MutationObserver((l) => {
    if (busy) return;
    if (l.every((m) => m.target.closest && m.target.closest("#rwPanel, #bfBluf .bf-rw"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroRunways = { analyze, comps, load };
})();
