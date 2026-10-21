"use strict";
/* p79: turbulence, icing and other weather advisories along the route. Uses the wxhaz relay
   (aviationweather.gov PIREPs, SIGMETs, G AIRMETs and Center Weather Advisories for a box around
   the route) and keeps only what touches the route: advisory areas the route passes through at the
   forecast hour closest to departure, and turbulence or icing PIREPs within 25 nm of the route in
   the last 3 hours. Shown as a panel on the flight brief and one line in the bottom line card. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #advPanel ul{list-style:none;margin:6px 0 0;padding:0}
    #advPanel li{padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08));font-size:14px;line-height:1.45}
    #advPanel li:first-child{border-top:0}
    #advPanel .tg{display:inline-block;font:700 10.5px var(--mono,monospace);letter-spacing:.5px;padding:1px 7px;border-radius:999px;border:1px solid currentColor;margin-right:6px;vertical-align:1px}
    #advPanel .t-tb{color:#ffb648}#advPanel .t-ic{color:#5aa9ff}#advPanel .t-cv{color:#ff4d6a}#advPanel .t-ot{color:var(--ink2,#9fb0c8)}
    #advPanel .raw{display:block;font:12px var(--mono,monospace);color:var(--ink2,#9fb0c8);margin-top:3px;white-space:pre-wrap;word-break:break-word}
    #advPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #bfBluf .bf-adv{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-adv b{font:700 11px var(--mono,monospace);padding:1px 6px;border-radius:999px;border:1px solid currentColor;margin:0 2px}
    #bfBluf .bf-adv .warn{color:#ffb648}#bfBluf .bf-adv .bad{color:#ff4d6a}#bfBluf .bf-adv .ok{color:#46e39b}#bfBluf .bf-adv .mut{color:var(--ink2,#9fb0c8)}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180;
  const NAME = { "TURB-HI": "Turbulence above FL180", "TURB-LO": "Turbulence below FL180", ICE: "Icing", IFR: "IFR conditions", MT_OBSC: "Mountains obscured", LLWS: "Low level wind shear", SFC_WND: "Strong surface winds", CONVECTIVE: "Convective SIGMET (thunderstorms)", TS: "Thunderstorms", TURB: "Turbulence", ICING: "Icing", IFR_CIG: "IFR ceilings", ASH: "Volcanic ash" };
  const kind = (hz) => (/TURB|LLWS|WND/i.test(hz) ? "tb" : /IC/i.test(hz) ? "ic" : /CONV|TS/i.test(hz) ? "cv" : "ot");
  const lvl = (v) => { if (v == null || v === "") return null; const s = String(v); if (/SFC/i.test(s)) return "surface"; if (/FZL/i.test(s)) return "freezing level"; const n = Number(s); if (!isFinite(n)) return s; const ft = n < 1000 ? n * 100 : n; return ft >= 18000 ? `FL${String(Math.round(ft / 100)).padStart(3, "0")}` : `${ft.toLocaleString("en-US")} ft`; };

  // Points every ~5 nm along the route
  function samples(pts) {
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = 60 * Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos(a.lat * R));
      const n = Math.max(1, Math.ceil(d / 5));
      for (let k = 0; k < n; k++) out.push([a.lat + ((b.lat - a.lat) * k) / n, a.lon + ((b.lon - a.lon) * k) / n]);
    }
    const z = pts[pts.length - 1]; out.push([z.lat, z.lon]);
    return out;
  }
  function inside(poly, p) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i], [yj, xj] = poly[j];
      if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  const crosses = (poly, S) => poly && poly.length > 2 && S.some((p) => inside(poly, p));
  function nearNm(S, lat, lon) { let best = Infinity; const k = Math.cos(lat * R); for (const p of S) best = Math.min(best, 60 * Math.hypot(p[0] - lat, (p[1] - lon) * k)); return best; }

  const cache = new Map();
  async function load(f) {
    const pts = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    if (!pts.length) return null;
    let a = 90, b = 180, c = -90, d = -180;
    for (const p of pts) { a = Math.min(a, p.lat); b = Math.min(b, p.lon); c = Math.max(c, p.lat); d = Math.max(d, p.lon); }
    const bbox = [a - 1, b - 1, c + 1, d + 1].map((v) => v.toFixed(1)).join(",");
    if (!cache.has(bbox) || Date.now() - cache.get(bbox).at > 10 * 6e4) cache.set(bbox, { at: Date.now(), p: fnGet(`wxhaz?bbox=${bbox}`).catch((e) => ({ error: String(e && e.message || e) })) });
    const data = await cache.get(bbox).p;
    if (!data || data.error) return { error: (data && data.error) || "no data" };
    const S = samples(pts);
    let prof = null; try { prof = profile(f); } catch {}
    const dep = prof && prof.depLocal ? new Date(prof.depLocal) : new Date();
    const arr = prof && prof.arrLocal ? new Date(prof.arrLocal) : new Date(+dep + 36e5);
    const hrsOut = (dep - Date.now()) / 36e5;
    const items = [];
    // G AIRMETs: the forecast hour closest to departure (0, 3 or 6), one entry per hazard and band
    const fhWant = Math.max(0, Math.min(6, Math.round(hrsOut / 3) * 3));
    const ga = (data.gairmets || []).filter((g) => crosses(g.pts, S));
    const byHaz = new Map();
    for (const g of ga) {
      const k = `${g.hazard}|${g.base}|${g.top}`;
      const cur = byHaz.get(k);
      if (!cur || Math.abs(g.fh - fhWant) < Math.abs(cur.fh - fhWant)) byHaz.set(k, g);
    }
    for (const g of byHaz.values()) items.push({ base0: g.base, src: "G AIRMET", hz: g.hazard, k: kind(g.hazard), title: NAME[g.hazard] || g.hazard, band: [lvl(g.base), lvl(g.top)].filter(Boolean).join(" to "), note: [g.sev && `${({ LGT: "light", MOD: "moderate", SEV: "severe" })[g.sev] || g.sev} intensity`, g.due && `due to ${g.due}`, `forecast hour ${g.fh}`].filter(Boolean).join(", ") });
    const live = (x) => { const fr = x.from ? new Date(x.from) : null, to = x.to ? new Date(x.to) : null; return !(to && to < dep) && !(fr && fr > arr); };
    for (const s of (data.sigmets || []).filter((s) => crosses(s.pts, S) && live(s))) items.push({ base0: s.lo, src: s.kind || "SIGMET", hz: s.hazard, k: kind(s.hazard || s.kind), title: NAME[s.hazard] || `${s.kind} ${s.hazard}`, band: [lvl(s.lo), lvl(s.hi)].filter(Boolean).join(" to "), note: s.to ? `valid until ${new Date(s.to).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "", raw: s.raw });
    for (const c of (data.cwas || []).filter((c) => crosses(c.pts, S) && live(c))) items.push({ base0: c.lo, src: "CWA", hz: c.hazard, k: kind(c.hazard), title: `Center Weather Advisory: ${NAME[c.hazard] || c.hazard}`, band: [lvl(c.lo), lvl(c.hi)].filter(Boolean).join(" to "), note: c.qual || "", raw: c.raw });
    const pir = (data.pireps || []).filter((p) => ((p.tb && !/NEG|SMTH/i.test(p.tb)) || (p.ic && !/NEG/i.test(p.ic))) && nearNm(S, p.lat, p.lon) <= 25);
    // Drop advisories that start well above the planned cruise altitude (you still climb and descend through anything below it)
    const cr = (() => { const a = String(f.cruiseAlt || f.alt || "").replace(/[\s,]/g, ""); const m = /^FL(\d+)/i.exec(a); if (m) return +m[1] * 100; return +a || (f.rules === "IFR" ? 7000 : 5500); })();
    const ftOf = (v) => { if (v == null || v === "" || /SFC|FZL/i.test(String(v))) return 0; const n = Number(v); return !isFinite(n) ? 0 : n < 1000 ? n * 100 : n; };
    const above = items.filter((x) => ftOf(x.base0) > cr + 3000).length;
    for (let i = items.length - 1; i >= 0; i--) if (ftOf(items[i].base0) > cr + 3000) items.splice(i, 1);
    const order = { cv: 0, tb: 1, ic: 2, ot: 3 };
    items.sort((x, y) => order[x.k] - order[y.k]);
    return { items, pir, hrsOut, above, cr, partial: !!data.partial };
  }

  function bluf(page, r) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    let html;
    if (!r) html = `Advisories: <span class="mut">checking turbulence and icing along your route…</span>`;
    else if (r.error) html = `Advisories: <span class="mut">could not load turbulence and icing advisories right now.</span>`;
    else {
      const tb = r.items.filter((x) => x.k === "tb").length, ic = r.items.filter((x) => x.k === "ic").length, cv = r.items.filter((x) => x.k === "cv").length;
      const ptb = r.pir.filter((p) => p.tb && !/NEG|SMTH/i.test(p.tb)).length, pic = r.pir.filter((p) => p.ic && !/NEG/i.test(p.ic)).length;
      const parts = [];
      if (cv) parts.push(`<b class="bad">CONVECTIVE</b>`);
      if (tb) parts.push(`<b class="warn">TURB</b>`);
      if (ic) parts.push(`<b class="warn">ICE</b>`);
      const other = r.items.length - tb - ic - cv;
      html = r.items.length || r.pir.length
        ? `Advisories: ${parts.join(" ")} ${r.items.length} along your route${other ? ` (${other} other)` : ""}${ptb || pic ? `, ${ptb ? `${ptb} turbulence` : ""}${ptb && pic ? " and " : ""}${pic ? `${pic} icing` : ""} PIREP${ptb + pic === 1 ? "" : "s"} nearby` : ""}. <a href="#" data-adv="1">Read them</a>`
        : `Advisories: <b class="ok">NONE</b> along your route${r.hrsOut > 6 ? " in the next 6 hours; check again closer to departure" : ""}.`;
    }
    let el = card.querySelector(".bf-adv");
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-adv"; const after = card.querySelector(".bf-wx") || card.querySelector(".k"); if (after) after.after(el); else card.prepend(el); }
    el.dataset.v = html; el.innerHTML = html;
    const a = el.querySelector("[data-adv]");
    if (a) a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("advPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
  }

  function paint(sec, r) {
    if (!r) { sec.innerHTML = `<h2>Turbulence and icing</h2><p class="small muted" style="margin:0">Checking advisories and pilot reports along your route…</p>`; return; }
    if (r.error) { sec.innerHTML = `<h2>Turbulence and icing</h2><p class="small muted" style="margin:0">Could not reach aviationweather.gov right now. Try again in a few minutes.</p>`; return; }
    const li = r.items.map((x) => `<li><span class="tg t-${x.k}">${h(x.src)}</span><b>${h(x.title)}</b>${x.band ? `, ${h(x.band)}` : ""}${x.note ? `<span class="small muted"> · ${h(x.note)}</span>` : ""}${x.raw ? `<details><summary class="small muted">Full text</summary><span class="raw">${h(x.raw)}</span></details>` : ""}</li>`).join("");
    const pl = r.pir.slice(0, 12).map((p) => `<li><span class="tg t-${p.tb && !/NEG|SMTH/i.test(p.tb) ? "tb" : "ic"}">${p.urgent ? "URGENT PIREP" : "PIREP"}</span><b>${h([p.tb && !/NEG|SMTH/i.test(p.tb) ? `${p.tb} turbulence` : "", p.ic && !/NEG/i.test(p.ic) ? `${p.ic} ${p.icType || ""} icing` : ""].filter(Boolean).join(", ").toLowerCase())}</b>${p.fl ? ` at ${h(lvl(p.fl))}` : ""}${p.ac ? `, ${h(p.ac)}` : ""}<span class="raw">${h(p.raw)}</span></li>`).join("");
    sec.innerHTML = `<h2>Turbulence and icing</h2>
      <p class="small" style="margin:0">${r.items.length ? `${r.items.length} advisor${r.items.length === 1 ? "y" : "ies"} cross your route` : "No turbulence, icing or other advisories cross your route"}${r.above ? `. ${r.above} more ${r.above === 1 ? "starts" : "start"} well above your ${r.cr >= 18000 ? `FL${Math.round(r.cr / 100)}` : `${r.cr.toLocaleString("en-US")} ft`} cruise and ${r.above === 1 ? "is" : "are"} not shown` : ""}${r.hrsOut > 6 ? ". G AIRMETs here reach 6 hours ahead, so check again closer to departure" : ""}.${r.partial ? " Some sources did not answer; this list may be incomplete." : ""}</p>
      ${li ? `<ul>${li}</ul>` : ""}
      <h3 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--ink2,#9fb0c8);margin:14px 0 4px">Pilot reports within 25 nm, last 3 hours</h3>
      ${pl ? `<ul>${pl}</ul>` : `<p class="small muted" style="margin:0">No turbulence or icing reports near your route.</p>`}
      <p class="disc">From aviationweather.gov for planning. Get an official weather briefing before flight.</p>`;
  }

  let busy = false, t = 0, last = { key: "", r: null, pending: false };
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId || !(f.points || []).length || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${f.date}|${f.time}`;
      let sec = page.querySelector("#advPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "advPanel"; sec.dataset.k = ""; }
      if (last.key !== key) { last = { key, r: null, pending: true }; load(f).then((r) => { if (last.key === key) { last.r = r; last.pending = false; const s = document.getElementById("advPanel"); if (s) s.dataset.k = ""; kick(); } }); }
      const stamp = `${key}|${last.r ? "r" : "p"}`;
      if (sec.dataset.k !== stamp) { sec.dataset.k = stamp; paint(sec, last.r); }
      bluf(page, last.r);
      // Just after the NOTAMs panel when it is there, else after the TFR panel, else before the checklist
      const nt = page.querySelector(":scope > #ntPanel") || page.querySelector(":scope > #tfrPanel");
      if (nt) { if (nt.nextElementSibling !== sec) nt.after(sec); }
      else if (!sec.isConnected) { const go_ = page.querySelector(":scope > #goPanel"); if (go_) go_.after(sec); else page.appendChild(sec); }
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#advPanel"]')) {
        const a = document.createElement("a");
        a.href = "#"; a.dataset.s = "#advPanel"; a.textContent = "Turbulence and icing";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("advPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
        const nc = j.querySelector('[data-s="#ntPanel"]'); if (nc) nc.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 300); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#advPanel, #bfBluf .bf-adv"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroAdvisories = { load, samples, inside };
})();
