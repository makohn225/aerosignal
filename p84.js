"use strict";
/* p84: diversion airports along the route. Uses the divert edge function (public airport and runway
   data) to list airports with a usable runway (paved and at least 3,000 ft by default, both set by the
   pilot) within 25 nm of the route, ordered by where they fall along it, and finds the stretches where
   the nearest one is more than a pilot set distance away (10 nm by default, roughly a light single's
   glide from a few thousand feet). It answers "where do I go if the engine or the weather turns" before
   the flight, the way an EFB's Nearest page does in the air. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #dvPanel .dv-sum{font-size:14px;line-height:1.5;margin:0 0 6px}
    #dvPanel .dv-gap{margin:6px 0;padding:8px 10px;border:1px solid rgba(255,182,72,.45);border-radius:10px;font-size:13.5px}
    #dvPanel .dv-tw{overflow-x:auto}
    #dvPanel table{border-collapse:collapse;width:100%;min-width:420px;font:12.5px var(--mono,monospace);margin-top:6px}
    #dvPanel th,#dvPanel td{padding:4px 6px;text-align:right;border-bottom:1px solid var(--line2,rgba(255,255,255,.07));white-space:nowrap}
    #dvPanel th:nth-child(2),#dvPanel td:nth-child(2),#dvPanel th:nth-child(3),#dvPanel td:nth-child(3){text-align:left}
    #dvPanel td:nth-child(3){white-space:normal;font-family:"Atkinson Hyperlegible",system-ui,sans-serif;font-size:13px;min-width:150px;max-width:240px}
    #dvPanel th{color:var(--ink2,#9fb0c8);font-weight:600;font-size:11px}
    #dvPanel .dv-set{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin-top:10px;font-size:13px}
    #dvPanel .dv-set input[type=number]{width:84px;font:14px var(--mono,monospace)}
    #dvPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #bfBluf .bf-dv{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-dv .warn{color:#ffb648;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const prefs = () => Object.assign({ min: 3000, paved: true, gap: 10, r: 25 }, S.dvPrefs || {});

  // Route points every ~2 nm with their along route distance
  function samples(pts) {
    const out = [[pts[0].lat, pts[0].lon, 0]];
    let at = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = 60 * Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * R));
      const n = Math.max(1, Math.ceil(d / 2));
      for (let k = 1; k <= n; k++) out.push([a.lat + ((b.lat - a.lat) * k) / n, a.lon + ((b.lon - a.lon) * k) / n, at + (d * k) / n]);
      at += d;
    }
    return out;
  }
  function gaps(S2, aps, lim) {
    const out = [];
    let cur = null;
    for (const [la, lo, at] of S2) {
      const k = Math.cos(la * R);
      let best = Infinity;
      for (const a of aps) best = Math.min(best, 60 * Math.hypot(a.lat - la, (a.lon - lo) * k));
      if (best > lim) { if (!cur) cur = { from: at, to: at, worst: best }; else { cur.to = at; cur.worst = Math.max(cur.worst, best); } }
      else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out.filter((g) => g.to - g.from >= 2);
  }

  const cache = new Map();
  async function load(f) {
    const p = prefs();
    const pts = (f.points || []).filter((x) => isFinite(x.lat) && isFinite(x.lon));
    if (pts.length < 2) return null;
    // Keep the request small: thin the route to at most 60 points
    const step = Math.ceil(pts.length / 60);
    const q = pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((x) => `${x.lat.toFixed(4)},${x.lon.toFixed(4)}`).join(";");
    const url = `divert?pts=${q}&r=${p.r}&min=${p.min}&paved=${p.paved ? 1 : 0}`;
    if (!cache.has(url)) cache.set(url, fnGet(url).catch((e) => ({ error: String((e && e.message) || e) })));
    const d = await cache.get(url);
    if (!d || d.error) { cache.delete(url); return { error: (d && d.error) || "no data" }; }
    const dep = String(pts[0].ident || "").toUpperCase(), dst = String(pts[pts.length - 1].ident || "").toUpperCase();
    const aps = (d.airports || []).filter((a) => a.ident !== dep && a.ident !== dst && "K" + a.ident !== dep && "K" + a.ident !== dst);
    const S2 = samples(pts);
    const all = d.airports || [];
    const g = gaps(S2, all, p.gap);
    // Closest airport in each 15 nm stretch of the route, for a short list
    const by = new Map();
    for (const a of aps) { const k = Math.floor(a.along / 15); const c = by.get(k); if (!c || a.off < c.off) by.set(k, a); }
    const short = [...by.values()].sort((x, y) => x.along - y.along);
    return { p, total: d.total_nm, aps, short, gaps: g };
  }

  function paint(sec, r, showAll) {
    if (!r) { sec.innerHTML = `<h2>Diversion airports</h2><p class="small muted" style="margin:0">Finding airports along your route…</p>`; return; }
    if (r.error) { sec.innerHTML = `<h2>Diversion airports</h2><p class="small muted" style="margin:0">Could not look up airports along the route right now. Try again in a few minutes.</p>`; return; }
    const p = r.p;
    const rows = (showAll ? r.aps : r.short).map((a) => `<tr><td>${fmt(a.along)}</td><td><b>${h(a.ident)}</b></td><td>${h(a.name)}</td><td>${a.off < 1 ? "on route" : Math.ceil(a.off)}</td><td>${fmt(a.longest)}</td><td>${a.lit ? "Yes" : "<span class='muted'>No</span>"}</td><td>${fmt(a.elev_ft || 0)}</td></tr>`).join("");
    const worst = r.gaps.reduce((m, g) => Math.max(m, g.to - g.from), 0);
    const gapTxt = r.gaps.length
      ? `<div class="dv-gap"><b>${r.gaps.length === 1 ? "One stretch" : `${r.gaps.length} stretches`}</b> where the nearest ${p.paved ? "paved " : ""}runway of ${fmt(p.min)} ft or more is over ${p.gap} nm away: ${r.gaps.map((g) => `nm ${fmt(g.from)} to ${fmt(g.to)} (up to ${Math.ceil(g.worst)} nm away)`).join("; ")}. Plan a higher altitude, a route closer to airports, or a lower limit for these parts.</div>`
      : `<p class="small" style="margin:6px 0">A suitable runway is within ${p.gap} nm of the whole route.</p>`;
    sec.innerHTML = `<h2>Diversion airports</h2>
      <p class="dv-sum">${r.aps.length ? `${r.aps.length} airport${r.aps.length === 1 ? "" : "s"} with a ${p.paved ? "paved " : ""}runway of ${fmt(p.min)} ft or more within ${p.r} nm of your ${fmt(Math.ceil(r.total))} nm route.` : `No airports with a ${p.paved ? "paved " : ""}runway of ${fmt(p.min)} ft or more within ${p.r} nm of the route.`}</p>
      ${gapTxt}
      ${rows ? `<div class="dv-tw"><table><thead><tr><th>Route nm</th><th>Airport</th><th>Name</th><th>Off route</th><th>Longest ft</th><th>Lit</th><th>Elev ft</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${r.aps.length > r.short.length ? `<button type="button" class="btn sec sm" data-all="1" style="margin-top:8px">${showAll ? "Show the closest in each 15 nm" : `Show all ${r.aps.length}`}</button>` : ""}` : ""}
      <div class="dv-set">
        <label>Shortest runway (ft) <input type="number" min="0" max="15000" step="100" data-k="min" value="${p.min}"></label>
        <label>Flag gaps over (nm) <input type="number" min="2" max="50" step="1" data-k="gap" value="${p.gap}"></label>
        <label><input type="checkbox" data-k="paved" ${p.paved ? "checked" : ""}> Paved only</label>
      </div>
      <p class="disc">Planning aid from public airport data. Check each airport's status, NOTAMs, hours and services before relying on it.</p>`;
    const b = sec.querySelector("[data-all]");
    if (b) b.onclick = () => { st.all = !st.all; paint(sec, r, st.all); };
    sec.querySelectorAll("[data-k]").forEach((inp) => (inp.onchange = () => {
      const k = inp.dataset.k;
      S.dvPrefs = Object.assign(prefs(), S.dvPrefs || {});
      S.dvPrefs[k] = k === "paved" ? inp.checked : Math.max(k === "gap" ? 2 : 0, Math.min(k === "gap" ? 50 : 15000, Math.round(+inp.value || 0)));
      save(); st.key = ""; kick();
    }));
  }

  function bluf(page, r) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    let el = card.querySelector(".bf-dv");
    if (!r || r.error) { if (el) el.remove(); return; }
    const worst = r.gaps.reduce((m, g) => Math.max(m, g.to - g.from), 0);
    const html = `Diversions: ${r.aps.length} airport${r.aps.length === 1 ? "" : "s"} within ${r.p.r} nm${r.gaps.length ? `, <span class="warn">${Math.ceil(worst)} nm stretch</span> over ${r.p.gap} nm from one` : `, none more than ${r.p.gap} nm away`}. <a href="#" data-dv="1">List</a>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-dv"; const after = card.querySelector(".bf-rw") || card.querySelector(".bf-wx"); if (after) after.after(el); else card.appendChild(el); }
    el.dataset.v = html; el.innerHTML = html;
    el.querySelector("[data-dv]").onclick = jump;
  }
  function jump(e) {
    e.preventDefault();
    const s = document.getElementById("dvPanel");
    if (!s) return;
    if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true);
    s.style.scrollMarginTop = "84px";
    s.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  let busy = false, t = 0;
  const st = { key: "", r: null, all: false };
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId || (f.points || []).length < 2 || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${JSON.stringify(S.dvPrefs || {})}`;
      let sec = page.querySelector(":scope > #dvPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "dvPanel"; }
      if (st.key !== key) {
        st.key = key; st.r = null; sec.dataset.k = "";
        load(f).then((r) => { if (st.key === key) { st.r = r; sec.dataset.k = ""; kick(); } }).catch(() => {});
      }
      const stamp = `${key}|${st.r ? 1 : 0}`;
      if (sec.dataset.k !== stamp) { sec.dataset.k = stamp; paint(sec, st.r, st.all); }
      bluf(page, st.r);
      // Just after Runway winds (p83), which nothing else positions itself against
      const anchor = page.querySelector(":scope > #rwPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) { const g = page.querySelector(":scope > #goPanel"); if (g) g.after(sec); else page.appendChild(sec); }
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#dvPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#dvPanel"; a.textContent = "Diversions"; a.onclick = jump;
        const w = j.querySelector('[data-s="#rwPanel"]'); if (w) w.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 320); };
  new MutationObserver((l) => {
    if (busy) return;
    if (l.every((m) => m.target.closest && m.target.closest("#dvPanel, #bfBluf .bf-dv"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroDivert = { load, gaps, samples };
})();
