"use strict";
/* p80: low level route card for military training routes (IR, VR, SR) on a flight.
   For each MTR added to the flight (f.mtrs, from the Maps tab or added here) it builds a leg table
   from the public FAA AIS route data: point letters, true course, leg distance, altitude block,
   corridor width, and timing from a pilot entered low level groundspeed and entry time, so every
   point gets an ETA and the exit time is known. The pilot also records the emergency abort altitude
   (EAA) and the scheduling activity confirmation. Stored on the flight as f.ll[name].
   Shown on military flight briefs, and on any brief that has an MTR added. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #llPanel .ll-rt{margin-top:12px;padding-top:10px;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #llPanel .ll-rt:first-of-type{border-top:0;margin-top:4px;padding-top:0}
    #llPanel .ll-in{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 12px;margin:8px 0}
    #llPanel .ll-in label{display:flex;flex-direction:column;font-size:11.5px;letter-spacing:.4px;color:var(--ink2,#9fb0c8);gap:3px}
    #llPanel .ll-in input{width:100%;box-sizing:border-box;font:14px var(--mono,monospace)}
    #llPanel .ll-tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
    #llPanel table{border-collapse:collapse;width:100%;min-width:520px;font:12.5px var(--mono,monospace)}
    #llPanel th,#llPanel td{padding:5px 6px;text-align:right;border-bottom:1px solid var(--line2,rgba(255,255,255,.07));white-space:nowrap}
    #llPanel th{color:var(--ink2,#9fb0c8);font-weight:600;font-size:11px;letter-spacing:.4px}
    #llPanel th:first-child,#llPanel td:first-child{text-align:left}
    #llPanel tfoot td{font-weight:700;border-bottom:0}
    #llPanel .ll-sum{font-size:14px;margin:6px 0 0}
    #llPanel .ll-sum b{font-family:var(--mono,monospace)}
    #llPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:12px 0 0}
    #llPanel .ll-add{display:flex;gap:8px;margin-top:8px}
    #llPanel .ll-add input{width:140px;font:14px var(--mono,monospace);text-transform:uppercase}
    #bfBluf .bf-ll{margin:2px 0;font-size:13.5px;line-height:1.45}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180;
  const norm = (s) => String(s || "").toUpperCase().replace(/[\s-]/g, "");
  const pretty = (q) => { const m = norm(q).match(/^(IR|VR|SR)(\d{1,4}[A-Z]?)$/); return m ? `${m[1]} ${m[2].padStart(m[2].replace(/[A-Z]$/, "").length < 3 ? m[2].length + 3 - m[2].replace(/[A-Z]$/, "").length : m[2].length, "0")}` : null; };
  const nmBetween = (a, b) => { const p1 = a[1] * R, p2 = b[1] * R, dl = (b[0] - a[0]) * R; return (Math.acos(Math.min(1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl))) * 180 / Math.PI) * 60; };
  const course = (a, b) => { const p1 = a[1] * R, p2 = b[1] * R, dl = (b[0] - a[0]) * R; const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl); return (Math.atan2(y, x) / R + 360) % 360; };
  const alt = (v, uom, code) => { if (v == null) return "?"; const ft = uom === "FL" ? v * 100 : v; const s = ft >= 18000 ? `FL${Math.round(ft / 100)}` : ft.toLocaleString("en-US"); return code === "HEI" ? `${s} AGL` : code === "STD" || ft >= 18000 ? s : `${s} MSL`; };
  const letters = (i) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
  const mmss = (min) => { const m = Math.max(0, Math.round(min * 60)); return `${Math.floor(m / 60)}+${String(m % 60).padStart(2, "0")}`; };
  const hhmm = (t) => { if (t == null) return ""; const m = ((Math.round(t) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}`; };
  const parseHhmm = (s) => { const m = /^(\d{1,2}):?(\d{2})$/.exec(String(s || "").trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };

  const rowsCache = new Map();
  function rowsFor(name) {
    const k = norm(name);
    if (!rowsCache.has(k)) rowsCache.set(k, rpc("mtr_by_ident", { q: k }).then((r) => r || []).catch((e) => { rowsCache.delete(k); throw e; }));
    return rowsCache.get(k);
  }

  // Chain the route segments into ordered legs (FAA AIS rows come one per leg, in route order by objectid)
  function legsOf(rows) {
    const segs = [];
    for (const e of [...rows].sort((a, b) => a.objectid - b.objectid))
      for (const s of e.coords || []) for (let i = 1; i < s.length; i++) segs.push({ a: s[i - 1], b: s[i], e });
    const legs = [];
    for (const s of segs) {
      const last = legs[legs.length - 1];
      const nm = nmBetween(s.a, s.b);
      if (nm < 0.05) continue;
      // Join a split leg that continues on the same course with the same block and widths
      if (last && nmBetween(last.b, s.a) < 0.05 && Math.abs(course(s.a, s.b) - last.crs) < 1 && last.e.upper_val === s.e.upper_val && last.e.lower_val === s.e.lower_val && last.e.width_left_nm === s.e.width_left_nm && last.e.width_right_nm === s.e.width_right_nm) { last.b = s.b; last.nm += nm; continue; }
      legs.push({ a: s.a, b: s.b, e: s.e, nm, crs: course(s.a, s.b), gap: last ? nmBetween(last.b, s.a) : 0 });
    }
    return legs;
  }

  function cfg(f, name, prof) {
    f.ll = f.ll || {};
    const c = (f.ll[name] = f.ll[name] || {});
    if (!c.gs) { const tas = (prof && prof.tas) || 0; c.gs = tas ? Math.min(420, Math.round(tas / 10) * 10) : 240; }
    return c;
  }

  function block(f, name, rows) {
    let prof = null; try { prof = (S.profiles || {})[f.tail] || (allAircraft() || {})[f.tail] || null; } catch {}
    const c = cfg(f, name, prof);
    const legs = legsOf(rows);
    if (!legs.length) return { html: `<div class="ll-rt" data-n="${h(name)}"><h3 style="margin:0;font-size:15px">${h(name)}</h3><p class="small muted">No route geometry found for ${h(name)} in the FAA data.</p></div>`, sum: null };
    const entry = parseHhmm(c.entry);
    let cum = 0, cumNm = 0;
    const tr = legs.map((L, i) => {
      const min = (L.nm / c.gs) * 60;
      cum += min; cumNm += L.nm;
      const eta = entry != null ? entry + cum : null;
      return `<tr><td>${letters(i)} to ${letters(i + 1)}${L.gap > 0.5 ? ` <span class="muted" title="Gap from previous point">(gap ${L.gap.toFixed(1)})</span>` : ""}</td><td>${String(Math.round(L.crs)).padStart(3, "0")}°T</td><td>${L.nm.toFixed(1)}</td><td>${mmss(min)}</td><td>${mmss(cum)}</td><td>${eta != null ? hhmm(eta) : ""}</td><td>${h(alt(L.e.lower_val, L.e.lower_uom, L.e.lower_code))} to ${h(alt(L.e.upper_val, L.e.upper_uom, L.e.upper_code))}</td><td>${L.e.width_left_nm ?? "?"}L ${L.e.width_right_nm ?? "?"}R</td></tr>`;
    }).join("");
    const exit = entry != null ? entry + cum : null;
    const src = (legs[0].e.source || "") === "FAA AIS" ? "FAA AIS, current cycle" : "DoD DISDI data, may be outdated";
    const sum = { name, nm: cumNm, min: cum, gs: c.gs, entry, exit, eaa: c.eaa };
    const html = `<div class="ll-rt" data-n="${h(name)}">
      <div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="margin:0;font-size:15px">${h(name)}</h3><span class="small muted">${legs.length} legs, ${letters(0)} to ${letters(legs.length)} · ${h(src)}</span></div>
      <div class="ll-in">
        <label>Low level groundspeed (kt)<input type="number" inputmode="numeric" min="60" max="600" step="10" data-k="gs" value="${h(c.gs)}"></label>
        <label>Entry time (Z, HHMM)<input type="text" inputmode="numeric" maxlength="5" placeholder="1430" data-k="entry" value="${h(c.entry || "")}"></label>
        <label>Emergency abort altitude (ft MSL)<input type="number" inputmode="numeric" min="0" max="45000" step="100" placeholder="From your chart" data-k="eaa" value="${h(c.eaa || "")}"></label>
        <label>Scheduled with<input type="text" maxlength="40" placeholder="Scheduling activity" data-k="sched" value="${h(c.sched || "")}"></label>
      </div>
      <div class="ll-tw"><table><thead><tr><th>Leg</th><th>Course</th><th>NM</th><th>Leg time</th><th>Elapsed</th><th>ETA Z</th><th>Altitude block</th><th>Width</th></tr></thead>
      <tbody>${tr}</tbody><tfoot><tr><td>Total</td><td></td><td>${cumNm.toFixed(1)}</td><td></td><td>${mmss(cum)}</td><td>${exit != null ? hhmm(exit) : ""}</td><td colspan="2"></td></tr></tfoot></table></div>
      <p class="ll-sum">${Math.ceil(cumNm)} nm in <b>${Math.ceil(cum)} min</b> at ${c.gs} kt${entry != null ? `, enter at <b>${hhmm(entry)}Z</b>, exit at <b>${hhmm(exit)}Z</b>` : ". Enter an entry time to get an ETA at each point"}.${c.eaa ? ` EAA <b>${Number(c.eaa).toLocaleString("en-US")} ft MSL</b>.` : ` <span class="muted">Record the emergency abort altitude from your route chart.</span>`}${c.sched ? ` Scheduled with ${h(c.sched)}.` : ""}</p>
      <div class="row" style="gap:8px;margin-top:6px"><button type="button" class="btn sm sec" data-rm="${h(name)}">Remove ${h(name)} from this flight</button></div>
    </div>`;
    return { html, sum };
  }

  function bluf(page, sums) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    let el = card.querySelector(".bf-ll");
    if (!sums.length) { if (el) el.remove(); return; }
    const html = `Low level: ${sums.map((s) => `${h(s.name)}, ${Math.ceil(s.nm)} nm, ${Math.ceil(s.min)} min${s.entry != null ? ` (${hhmm(s.entry)}Z to ${hhmm(s.exit)}Z)` : ""}${s.eaa ? `, EAA ${Number(s.eaa).toLocaleString("en-US")}` : ""}`).join("; ")}. <a href="#" data-ll="1">Leg card</a>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-ll"; const after = card.querySelector(".bf-lc") || card.querySelector(".bf-adv") || card.querySelector(".bf-wx"); if (after) after.after(el); else card.appendChild(el); }
    el.dataset.v = html; el.innerHTML = html;
    el.querySelector("[data-ll]").onclick = jump;
  }
  function jump(e) {
    e.preventDefault();
    const s = document.getElementById("llPanel");
    if (!s) return;
    if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true);
    s.style.scrollMarginTop = "84px";
    s.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const state = { key: "", rows: new Map(), err: new Set() };
  async function paint(sec, f) {
    const names = Array.isArray(f.mtrs) ? f.mtrs.slice() : [];
    const parts = [], sums = [];
    for (const n of names) {
      if (!state.rows.has(n)) { parts.push(`<div class="ll-rt"><h3 style="margin:0;font-size:15px">${h(n)}</h3><p class="small muted">${state.err.has(n) ? "Could not load this route. Check the connection." : "Loading route data…"}</p></div>`); continue; }
      const b = block(f, n, state.rows.get(n));
      parts.push(b.html); if (b.sum) sums.push(b.sum);
    }
    sec.innerHTML = `<h2>Low level route</h2>
      ${names.length ? "" : `<p class="small" style="margin:0">Add a military training route to get a leg card with course, distance, timing and the altitude block for each leg. You can also add routes on the Maps tab.</p>`}
      ${parts.join("")}
      <form class="ll-add"><input type="text" placeholder="VR1257" aria-label="Training route" maxlength="8"><button class="btn sm" type="submit">Add route</button></form>
      <p class="small muted ll-msg" style="margin:4px 0 0"></p>
      <p class="disc">Route data is public FAA information for planning. Verify the route, altitudes, widths and the emergency abort altitude against current DoD FLIP (AP/1B) and your scheduling activity before flight. Do not enter classified or CUI information.</p>`;
    wire(sec, f);
    return sums;
  }

  function wire(sec, f) {
    sec.querySelectorAll(".ll-rt input[data-k]").forEach((inp) => {
      inp.onchange = () => {
        const n = inp.closest(".ll-rt").dataset.n, k = inp.dataset.k;
        const c = (f.ll = f.ll || {})[n] = (f.ll || {})[n] || {};
        let v = inp.value.trim();
        if (k === "gs") { v = Math.max(60, Math.min(600, Math.round(+v || 240))); }
        if (k === "entry" && v && parseHhmm(v) == null) { toast("Enter the entry time as HHMM, for example 1430"); inp.value = c.entry || ""; return; }
        if (k === "eaa") v = v ? Math.max(0, Math.round(+v)) : "";
        c[k] = v; f.updated = Date.now(); save(); refresh(true);
      };
    });
    sec.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { const i = (f.mtrs || []).indexOf(b.dataset.rm); if (i >= 0) f.mtrs.splice(i, 1); f.updated = Date.now(); save(); refresh(true); }));
    const form = sec.querySelector(".ll-add"), msg = sec.querySelector(".ll-msg");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = pretty(form.querySelector("input").value);
      if (!name) { msg.textContent = "Enter a route such as IR218, VR1257 or SR213."; return; }
      if ((f.mtrs || []).includes(name)) { msg.textContent = `${name} is already on this flight.`; return; }
      msg.textContent = `Looking up ${name}…`;
      try {
        const rows = await rowsFor(name);
        if (!rows.length) { msg.textContent = `${name} was not found in the FAA route data.`; return; }
        state.rows.set(name, rows);
        (f.mtrs = Array.isArray(f.mtrs) ? f.mtrs : []).push(name); f.updated = Date.now(); save(); refresh(true);
      } catch { msg.textContent = "Route data unavailable. Check the connection and try again."; }
    };
  }

  function wanted(f) {
    if (!f || f.missionId || !(f.points || []).length) return false;
    if (Array.isArray(f.mtrs) && f.mtrs.length) return true;
    try { return !!(window.AeroMilFlight && AeroMilFlight.isMil(f.tail)); } catch { return false; }
  }

  let busy = false, t = 0, force = false;
  function refresh(now) { force = true; if (now) apply(); else kick(); }
  async function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    let sec = page.querySelector(":scope > #llPanel");
    if (!wanted(f)) { if (sec) sec.remove(); const b = page.querySelector("#bfBluf .bf-ll"); if (b) b.remove(); return; }
    busy = true;
    try {
      const names = f.mtrs || [];
      const key = `${f.id}|${names.join(",")}|${JSON.stringify(f.ll || {})}|${[...state.rows.keys()].filter((n) => names.includes(n)).length}|${f.tail}`;
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "llPanel"; }
      if (force || state.key !== key || !sec.childElementCount) {
        force = false; state.key = key;
        const sums = await paint(sec, f);
        bluf(page, sums);
        for (const n of names) if (!state.rows.has(n) && !state.err.has(n)) rowsFor(n).then((r) => { state.rows.set(n, r); refresh(); }).catch(() => { state.err.add(n); refresh(); });
      }
      // Just before the load computation (military) or weight and balance panel, else before the checklist.
      // Those panels place themselves by their next sibling, so sitting in front of them never fights.
      const anchor = page.querySelector(":scope > #lcPanel") || page.querySelector(":scope > #wbPanel") || page.querySelector(":scope > #goPanel");
      if (anchor) { if (anchor.previousElementSibling !== sec) anchor.before(sec); }
      else if (!sec.isConnected) page.appendChild(sec);
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#llPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#llPanel"; a.textContent = "Low level"; a.onclick = jump; j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 280); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#llPanel, #bfBluf .bf-ll"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroLowLevel = { legsOf, rowsFor };
})();
