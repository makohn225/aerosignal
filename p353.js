"use strict";
/* p353: IFR alternate check on the flight brief (November 23, 2026, scheduled competitive upgrade).
   ForeFlight and Garmin Pilot both carry an alternate in the flight plan and help pick one; ForeFlight's new
   Trip Feasibility agent checks the plan against the rules. AeroSignal read flight.alternate in six modules
   (runway winds, airport diagrams, GPS and approaches, the flight plan sheet, decision points, the Copy pad)
   but had no place to enter one. This panel, shown on IFR flights:
   1. Asks the 14 CFR 91.169 question: from 1 hour before to 1 hour after the arrival time, does the
      destination TAF forecast a ceiling of at least 2,000 ft and visibility of at least 3 sm (helicopters:
      1,000 ft and 2 sm)? Also when the destination has no published instrument approach. TEMPO and PROB
      groups below those values are shown as a reason to file one even when the main forecast passes.
   2. Lets the pilot enter the alternate (saved in flight.alternate, the field the other modules already
      read) and checks the alternate's TAF at its own arrival time against the standard alternate minimums
      for the approaches it has (precision 600 ft and 2 sm, nonprecision 800 ft and 2 sm, none: basic VFR
      from the MEA), notes when the FAA publishes nonstandard or not authorized alternate minimums there,
      and the GPS planning rules from the AIM when every approach there needs GPS.
   3. Suggests up to three alternates within 50 nm of the destination (public airports with a paved
      runway of at least 4,000 ft from the divert relay, a TAF that meets the minimums at the ETA, and an
      instrument approach from the d TPP index). One tap uses one; it also fills Minutes to the alternate
      in Weight, balance and fuel when that is empty.
   Public data only (wx, plates and divert relays, resolve_points). Advisory; the disclaimer is bold and red.
   Hidden on military aircraft and missions (service rules govern there).
   Panel position: after #acPanel when present, otherwise after #ltPanel, the end of the brief chain
   (COORDINATION.md). p260 keeps #acPanel right after #ltPanel, so the two never claim the same spot.
   Also a line in the bottom line card (.bf-alt) and a chip in the jump bar. Loads at the end of the list. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #iaPanel .ia-v{font-size:14.5px;line-height:1.5;margin:4px 0 8px}
    #iaPanel .ok{color:#46e39b}#iaPanel .warn{color:#ffb648}#iaPanel .bad{color:#ff4d6a}
    #iaPanel .ia-blk{border-top:1px solid var(--line2,rgba(255,255,255,.1));padding:10px 0 4px}
    #iaPanel .ia-blk h3{font-size:14px;margin:0 0 6px}
    #iaPanel .ia-tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
    #iaPanel table{border-collapse:collapse;width:100%;min-width:300px;font:12.5px var(--mono,monospace);margin:4px 0 6px}
    #iaPanel th,#iaPanel td{padding:4px 6px;text-align:left;border-bottom:1px solid var(--line2,rgba(255,255,255,.07))}
    #iaPanel th{color:var(--ink2,#9fb0c8);font-weight:600;font-size:11px}
    #iaPanel .ia-set{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}
    #iaPanel .ia-set input{width:96px;min-height:36px;text-transform:uppercase;font:15px var(--mono,monospace);padding:0 8px;border-radius:8px;border:1px solid var(--line2,rgba(255,255,255,.25));background:transparent;color:inherit}
    #iaPanel ul{margin:6px 0 0;padding-left:18px;font-size:13.5px;line-height:1.5}
    #iaPanel .ia-sug{display:grid;gap:6px;margin:6px 0}
    #iaPanel .ia-sug>div{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:space-between;border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:10px;padding:8px 10px;font-size:13.5px}
    #iaPanel .ia-sug b{font-family:var(--mono,monospace)}
    #bfBluf .bf-alt{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-alt .warn{color:#ffb648;font-weight:700}
    #iaPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}`;
  document.head.appendChild(css);

  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => Math.ceil(n).toLocaleString("en-US");
  const pad = (n) => String(n).padStart(2, "0");
  const hhmm = (d) => `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const clean = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  const visTxt = (v) => (v == null ? "?" : v > 6 ? "more than 6 sm" : `${Math.round(v * 100) / 100} sm`);
  const ceilTxt = (c) => (c == null ? "no ceiling" : `${num(c)} ft`);
  const PREC = /\b(ILS|GLS|PAR)\b/i, SAT = /\b(RNAV|GPS|RNP)\b/i, GROUND = /\b(ILS|LOC|VOR|NDB|LDA|SDF|TACAN|ASR|PAR|GLS)\b/i;

  // Shared answers for 30 minutes so the brief does not ask twice
  const cache = new Map();
  function cached(key, fn, ms = 18e5) {
    const c = cache.get(key);
    if (c && Date.now() - c.at < ms) return c.p;
    const p = Promise.resolve().then(fn);
    cache.set(key, { at: Date.now(), p });
    p.catch(() => cache.delete(key));
    return p;
  }
  const plateId = (a) => (a.length === 4 && a[0] === "K" ? a.slice(1) : a);
  async function approaches(a) {
    const p = await cached(`p|${a}`, () => fnGet(`plates?apt=${encodeURIComponent(plateId(a))}`), 36e5);
    const charts = (p && p.charts) || [];
    const names = [...new Set(charts.filter((c) => c.code === "IAP" && !/CONT\.?\s*\d*$/i.test(c.name)).map((c) => c.name))];
    const altMin = charts.find((c) => /ALTERNATE MIN/i.test(c.name || ""));
    return {
      names, prec: names.filter((n) => PREC.test(n)),
      gpsOnly: names.length > 0 && !names.some((n) => GROUND.test(n)),
      anyGps: names.some((n) => SAT.test(n) && !GROUND.test(n)),
      altPdf: altMin ? altMin.pdf : null,
    };
  }
  async function tafFor(id) {
    const j = await cached(`w|${id}`, () => fnGet(`wx?ids=${encodeURIComponent(id)}`), 9e5);
    const now = new Date();
    let best = null;
    for (const t of (j && j.taf) || []) { try { const x = parseTaf(t.raw, now); if (x && (!best || x.from > best.from)) best = x; } catch {} }
    return best;
  }
  async function tafsFor(ids) {
    if (!ids.length) return {};
    const j = await cached(`w|${ids.join(",")}`, () => fnGet(`wx?ids=${encodeURIComponent(ids.join(","))}`), 9e5);
    const now = new Date(), out = {};
    for (const t of (j && j.taf) || []) { try { const x = parseTaf(t.raw, now); if (x && x.station && (!out[x.station] || x.from > out[x.station].from)) out[x.station] = x; } catch {} }
    return out;
  }
  async function locate(id) {
    const r = await cached(`r|${id}`, () => rpc("resolve_points", { tokens: [id] }), 864e5);
    const a = (r || []).find((x) => String(x.token || "").toUpperCase() === id && x.lat != null) || (r || []).find((x) => x.lat != null);
    return a ? { ident: id, lat: +a.lat, lon: +a.lon, elev: a.elev } : null;
  }
  const R = Math.PI / 180;
  const dist = (a, b) => 60 * Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * R));

  // Conditions at a time: the main forecast, and the worst TEMPO or PROB group in force
  function condAt(taf, t) {
    let r = null; try { r = tafAt(taf, t); } catch {}
    if (!r || !r.prev) return null;
    const main = { ceiling: r.prev.ceiling, vis: r.prev.vis };
    const temps = (r.temps || []).map((g) => ({ type: g.type, ceiling: (g.clouds && g.clouds.length) || g.clear ? g.ceiling : main.ceiling, vis: g.vis != null ? g.vis : main.vis }));
    return { main, temps };
  }
  const meets = (c, m) => c && (c.ceiling == null || c.ceiling >= m.c) && (c.vis == null || c.vis >= m.v);

  /* 1. Is an alternate required? */
  function required(taf, eta, helo, hasIap) {
    const m = helo ? { c: 1000, v: 2 } : { c: 2000, v: 3 };
    const out = { m, rows: [], need: false, advise: false, why: [], noTaf: !taf, beyond: false };
    if (hasIap === false) { out.need = true; out.why.push("no published instrument approach"); }
    if (!taf) return out;
    if (+eta + 36e5 > +taf.to || +eta - 36e5 < +taf.from) out.beyond = true;
    for (let k = -60; k <= 60; k += 30) {
      const t = new Date(+eta + k * 6e4), c = condAt(taf, t);
      if (!c) continue;
      const okMain = meets(c.main, m), badT = c.temps.filter((g) => !meets(g, m));
      out.rows.push({ t, c, okMain, badT });
      if (!okMain) out.need = true;
      if (badT.length) out.advise = true;
    }
    if (out.rows.some((r) => !r.okMain)) out.why.push(`forecast below ${num(m.c)} ft or ${m.v} sm within an hour of arrival`);
    return out;
  }

  /* 2. Does the alternate meet the alternate minimums at its arrival time? */
  function altMins(ap, helo) {
    if (!ap || !ap.names.length) return { c: 1000, v: 3, kind: "none", label: "no instrument approach: the ceiling and visibility must allow a descent from the MEA and an approach and landing under basic VFR" };
    if (helo) { const c = ap.prec.length ? 400 : 600; return { c, v: 1, kind: "helo", label: `helicopters: 200 ft above the minimums for the approach you plan and at least 1 sm (never below that approach's visibility); this check screens at ${c} ft and 1 sm, so compare with the plate` }; }
    if (ap.prec.length) return { c: 600, v: 2, kind: "prec", label: "precision approach (ILS, GLS or PAR): 600 ft and 2 sm" };
    return { c: 800, v: 2, kind: "np", label: "nonprecision approaches only: 800 ft and 2 sm" };
  }
  function altCheck(taf, eta, mins) {
    if (!taf) return { noTaf: true };
    if (+eta > +taf.to || +eta < +taf.from) return { beyond: true };
    const c = condAt(taf, eta);
    if (!c) return { beyond: true };
    return { c, ok: meets(c.main, mins), tempBad: c.temps.filter((g) => !meets(g, mins)) };
  }

  async function build(f) {
    const pts = f.points || [];
    const dstP = pts[pts.length - 1];
    const dst = clean(dstP && dstP.ident);
    let p = null; try { p = profile(f); } catch {}
    const eta = p && p.arrLocal ? new Date(p.arrLocal) : null;
    let helo = false; try { helo = !!(window.AeroAcClass && (AeroAcClass.flightClass(f) || {}).cls === "helo"); } catch {}
    const tas = (p && p.ac && p.ac.tas) || 120;
    const r = { f, dst, dstP, eta, helo, tas };
    const T = (window.AeroWhenToGo && AeroWhenToGo.tafs(f)) || {};
    try { r.dstAp = await approaches(dst); } catch { r.dstApErr = true; }
    let dTaf = T[dst] || T["K" + dst] || null;
    if (!dTaf) { try { dTaf = await tafFor(dst); } catch {} }
    r.req = eta ? required(dTaf, eta, helo, r.dstAp ? r.dstAp.names.length > 0 : null) : null;
    const alt = clean(f.alternate);
    if (alt) {
      r.alt = alt;
      try {
        const [loc, ap, taf] = await Promise.all([locate(alt), approaches(alt).catch(() => null), tafFor(alt).catch(() => null)]);
        r.altLoc = loc; r.altAp = ap;
        r.altNm = loc && dstP ? dist(dstP, loc) : null;
        r.altEta = eta ? new Date(+eta + ((r.altNm || 0) / tas) * 36e5 + 6e5) : null;   // plus about 10 min for the missed approach
        r.mins = altMins(ap, helo);
        r.chk = r.altEta ? altCheck(taf, r.altEta, r.mins) : null;
      } catch (e) { r.altErr = true; }
    }
    return r;
  }

  async function suggest(r) {
    if (!r.dstP || r.dstP.lat == null) return [];
    const j = await cached(`d|${r.dstP.lat.toFixed(2)},${r.dstP.lon.toFixed(2)}`, () => fnGet(`divert?pts=${r.dstP.lat.toFixed(4)},${r.dstP.lon.toFixed(4)}&r=50&min=4000&paved=1`), 864e5);
    const rank = { large_airport: 0, medium_airport: 1, small_airport: 2 };
    const cand = ((j && j.airports) || [])
      .filter((a) => /^[A-Z][A-Z0-9]{3}$/.test(a.ident) && clean(a.ident) !== r.dst && clean(a.ident) !== "K" + r.dst && a.off >= 5)
      .sort((a, b) => (rank[a.type] ?? 3) - (rank[b.type] ?? 3) || a.off - b.off)
      .slice(0, 10);
    if (!cand.length) return [];
    const T = await tafsFor(cand.map((a) => a.ident));
    const out = [];
    for (const a of cand.sort((x, y) => x.off - y.off)) {
      const taf = T[a.ident]; if (!taf || !r.eta) continue;
      const eta = new Date(+r.eta + (a.off / r.tas) * 36e5 + 6e5);
      const pre = altCheck(taf, eta, { c: 800, v: 2 });        // quick screen at the stricter value
      if (!pre.c || !meets(pre.c.main, { c: 600, v: 2 })) continue;
      let ap = null; try { ap = await approaches(a.ident); } catch {}
      if (!ap || !ap.names.length) continue;
      const mins = altMins(ap, r.helo), chk = altCheck(taf, eta, mins);
      if (!chk.ok) continue;
      out.push({ ident: a.ident, name: a.name, nm: a.off, mins, chk, ap });
      if (out.length >= 3) break;
    }
    return out;
  }

  function verdict(r) {
    if (!r || !r.req) return null;
    const q = r.req;
    let need;
    if (q.need) need = ["bad", "Alternate required"];
    else if (q.noTaf) need = ["warn", `No TAF for ${r.dst}: file an alternate`];
    else if (q.advise) need = ["warn", "Alternate advised (TEMPO or PROB below the rule)"];
    else if (q.beyond) need = ["warn", "Arrival is outside the TAF: check again later"];
    else need = ["ok", "Alternate not required by the forecast"];
    let alt = "";
    if (r.alt) {
      const c = r.chk;
      if (!c || r.altErr) alt = ` ${r.alt}: could not be checked`;
      else if (c.noTaf) alt = ` ${r.alt}: no TAF, so it cannot serve as the alternate on forecast weather`;
      else if (c.beyond) alt = ` ${r.alt}: arrival is outside its TAF`;
      else alt = c.ok ? ` ${r.alt} meets ${r.mins.kind === "none" ? "basic VFR" : `${num(r.mins.c)} ft and ${r.mins.v} sm`} at its arrival time${c.tempBad.length ? ", TEMPO lower" : ""}` : ` ${r.alt} is below its alternate minimums at its arrival time`;
      if (c && !c.noTaf && !c.beyond) need = [c.ok ? (c.tempBad.length ? "warn" : "ok") : "bad", need[1]];
    } else if (q.need || q.noTaf || q.advise) alt = " None entered yet.";
    return { cls: need[0], text: `${need[1]}.${alt}${/[.]$/.test(alt) || !alt ? "" : "."}` };
  }

  function rowsHtml(q) {
    return `<div class="ia-tw"><table><thead><tr><th>Local</th><th>Ceiling</th><th>Visibility</th><th>Result</th></tr></thead><tbody>${q.rows.map((x) => {
      const t = x.badT[0];
      return `<tr><td>${hhmm(x.t)}</td><td>${h(ceilTxt(x.c.main.ceiling))}</td><td>${h(visTxt(x.c.main.vis))}</td><td class="${x.okMain ? (t ? "warn" : "ok") : "bad"}">${x.okMain ? (t ? `meets, ${h(t.type)} ${h(ceilTxt(t.ceiling))} ${h(visTxt(t.vis))}` : "meets") : "below"}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function paint(sec, r) {
    const v = verdict(r);
    const q = r.req;
    let reqHtml;
    if (!r.eta) reqHtml = `<p class="small muted">Set a departure date and time to check the forecast at arrival.</p>`;
    else {
      const lines = [];
      if (r.dstAp && !r.dstAp.names.length) lines.push(`<li><b class="bad">${h(r.dst)} has no published instrument approach</b>, so an alternate is required whatever the weather.</li>`);
      if (r.dstApErr) lines.push(`<li>The approach list for ${h(r.dst)} could not load; check the plates.</li>`);
      if (q.noTaf) lines.push(`<li>${h(r.dst)} has no TAF. 91.169 also allows other forecasts, such as a nearby TAF or the graphical forecast, but this check cannot read them; most pilots file an alternate.</li>`);
      if (q.beyond) lines.push(`<li>Part of the hour either side of arrival (${hhmm(r.eta)} local) is outside the TAF period. Check again when the next TAF covers it.</li>`);
      if (q.advise && !q.need) lines.push(`<li>A TEMPO or PROB group goes below ${num(q.m.c)} ft or ${q.m.v} sm. The main forecast meets the rule, but plan and fuel for an alternate.</li>`);
      reqHtml = `<p class="small" style="margin:0 0 4px">Rule (${r.helo ? "helicopter" : "airplane"}, 91.169): from 1 hour before to 1 hour after your ${hhmm(r.eta)} local arrival, a ceiling of at least <b>${num(q.m.c)} ft</b> and visibility of at least <b>${q.m.v} sm</b> at ${h(r.dst)}${r.helo ? " (and 400 ft above the lowest approach minimums, whichever is higher; compare with the plate)" : ""}.</p>
        ${q.rows.length ? rowsHtml(q) : ""}${lines.length ? `<ul>${lines.join("")}</ul>` : ""}`;
    }
    let altHtml = "";
    if (r.alt) {
      const c = r.chk, tips = [];
      if (r.altErr || !c) tips.push(`<li>${h(r.alt)} could not be checked right now.</li>`);
      else if (c.noTaf) tips.push(`<li><b class="warn">${h(r.alt)} has no TAF.</b> Choose an alternate with a forecast, or check the rules for using other forecasts.</li>`);
      else if (c.beyond) tips.push(`<li>The arrival at ${h(r.alt)} is outside its TAF period.</li>`);
      else {
        tips.push(`<li>Forecast at ${h(r.alt)} around ${hhmm(r.altEta)} local: ${h(ceilTxt(c.c.main.ceiling))}, ${h(visTxt(c.c.main.vis))}. <b class="${c.ok ? "ok" : "bad"}">${c.ok ? "Meets" : "Below"}</b> the alternate minimums.</li>`);
        for (const g of c.tempBad) tips.push(`<li class="warn">${h(g.type)}: ${h(ceilTxt(g.ceiling))}, ${h(visTxt(g.vis))}, below the minimums for part of the time.</li>`);
      }
      if (r.mins) tips.push(`<li>Minimums used: ${h(r.mins.label)}.</li>`);
      if (r.altAp && r.altAp.altPdf) tips.push(`<li><b class="warn">The FAA publishes nonstandard alternate minimums for ${h(r.alt)}</b> (an A in a triangle on the plate, or A NA where an approach cannot be used for the alternate). <button type="button" class="linkbtn" data-pdf="${h(r.altAp.altPdf)}">Open the Alternate Minimums page</button></li>`);
      if (r.altAp && r.altAp.gpsOnly) tips.push(`<li>Every approach at ${h(r.alt)} needs GPS. With WAAS, plan on LNAV or circling minimums there, not LPV or LNAV/VNAV. Without WAAS, you may plan a GPS approach at the destination or the alternate, not both (see the GPS section of the AIM).</li>`);
      if (r.altNm != null) tips.push(`<li>${num(r.altNm)} nm from ${h(r.dst)}, about ${num((r.altNm / r.tas) * 60)} min at ${num(r.tas)} kt. 91.167 fuel: to the destination, then the alternate, then 45 minutes.</li>`);
      altHtml = `<ul>${tips.join("")}</ul>`;
    }
    sec.innerHTML = `<h2>IFR alternate</h2>
      ${v ? `<p class="ia-v"><b class="${v.cls}">${h(v.text)}</b></p>` : ""}
      <div class="ia-blk"><h3>Do you need an alternate?</h3>${reqHtml}</div>
      <div class="ia-blk"><h3>Your alternate</h3>
        <div class="ia-set"><label class="small" for="iaIn">Alternate airport</label><input id="iaIn" maxlength="5" autocomplete="off" spellcheck="false" value="${h(r.alt || "")}" placeholder="KORF"><button type="button" class="btn sec sm" id="iaSave">${r.alt ? "Change" : "Use"}</button>${r.alt ? `<button type="button" class="btn sec sm" id="iaClear">Clear</button>` : ""}<button type="button" class="btn sec sm" id="iaSug">Suggest alternates</button></div>
        ${altHtml}
        <div class="ia-sug" id="iaSugList" aria-live="polite"></div>
      </div>
      <p class="disc">A planning aid built from the TAF text and the FAA chart index. It does not read nonstandard minimums from the plates or other forecasts. Check 14 CFR 91.169, the plates and an official briefing; the pilot in command decides.</p>`;
    const inp = sec.querySelector("#iaIn");
    const set = (val) => {
      const f = r.f, a = clean(val);
      f.alternate = a || "";
      save(); sec.dataset.k = ""; toast(a ? `Alternate set to ${a}` : "Alternate cleared"); kick();
      if (a) fillAltMin(f, a);
    };
    sec.querySelector("#iaSave").onclick = () => set(inp.value);
    inp.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); set(inp.value); } };
    const clr = sec.querySelector("#iaClear"); if (clr) clr.onclick = () => set("");
    sec.querySelector("#iaSug").onclick = () => runSuggest(sec, r, set);
    sec.querySelectorAll("[data-pdf]").forEach((b) => (b.onclick = () => openPdf(b.dataset.pdf)));
    // Suggest straight away when an alternate is needed and none is set
    if (!r.alt && q && (q.need || q.noTaf || q.advise)) runSuggest(sec, r, set);
  }

  async function runSuggest(sec, r, set) {
    const box = sec.querySelector("#iaSugList"); if (!box) return;
    box.innerHTML = `<p class="small muted" style="margin:0">Looking for alternates within 50 nm of ${h(r.dst)}…</p>`;
    let list = [];
    try { list = await suggest(r); } catch (e) { box.innerHTML = `<p class="small muted" style="margin:0">Suggestions could not load right now.</p>`; return; }
    if (!box.isConnected) return;
    if (!list.length) { box.innerHTML = `<p class="small muted" style="margin:0">No airport within 50 nm with a TAF, an instrument approach and a paved runway of 4,000 ft or more meets the alternate minimums at your arrival time. Look farther, or wait for better weather.</p>`; return; }
    box.innerHTML = `<p class="small muted" style="margin:0">Within 50 nm, with a TAF that meets the alternate minimums at your arrival time:</p>` + list.map((a) => `<div><span><b>${h(a.ident)}</b> ${h(a.name || "")} · ${num(a.nm)} nm · ${h(ceilTxt(a.chk.c.main.ceiling))}, ${h(visTxt(a.chk.c.main.vis))} · ${a.mins.kind === "prec" ? "ILS or other precision" : "nonprecision"}${a.chk.tempBad.length ? " · TEMPO lower" : ""}${a.ap.altPdf ? " · nonstandard minimums" : ""}</span><button type="button" class="btn sec sm" data-use="${h(a.ident)}">Use ${h(a.ident)}</button></div>`).join("");
    box.querySelectorAll("[data-use]").forEach((b) => (b.onclick = () => set(b.dataset.use)));
  }

  // Fill Minutes to the alternate (Weight, balance and fuel, p72) only when the pilot has not entered it
  async function fillAltMin(f, a) {
    try {
      const pts = f.points || [], d = pts[pts.length - 1];
      const loc = await locate(a);
      if (!loc || !d || d.lat == null) return;
      let tas = 120; try { tas = (profile(f).ac || {}).tas || 120; } catch {}
      f.wb = f.wb || {};
      if (!(+f.wb.altMin > 0)) { f.wb.altMin = Math.ceil((dist(d, loc) / tas) * 60) + 10; save(); }
    } catch {}
  }

  async function openPdf(pdf) {
    const w = window.open("", "_blank");
    try {
      const res = await fetch(`${SUPA.url}/functions/v1/plates?pdf=${encodeURIComponent(pdf)}`, { headers: typeof HDR !== "undefined" ? HDR : {} });
      if (!res.ok) throw new Error(res.status);
      const url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "application/pdf" }));
      if (w) w.location = url; else location.href = url;
    } catch (e) { if (w) w.close(); toast("The chart could not load. Try the Plates page."); }
  }

  function bluf(page, r) {
    const card = page.querySelector("#bfBluf"); if (!card) return;
    const v = r ? verdict(r) : null;
    let el = card.querySelector(".bf-alt");
    if (!v) { if (el) el.remove(); return; }
    const html = `Alternate: <span class="${v.cls === "ok" ? "" : "warn"}">${h(v.text.replace(/^Alternate /, ""))}</span>`;
    if (el && el.dataset.v === html) return;
    if (!el) {
      el = document.createElement("div"); el.className = "bf-alt";
      const after = card.querySelector(".bf-gps") || card.querySelector(".bf-ns") || card.querySelector(".bf-wx") || card.querySelector(".k");
      if (after) after.after(el); else card.appendChild(el);
    }
    el.dataset.v = html; el.innerHTML = html;
  }

  let busy = false, t = 0, gen = 0;
  async function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    let mil = !!f.missionId;
    try { if (window.AeroMilFlight && AeroMilFlight.isMil(f.tail)) mil = true; } catch {}
    const show = !mil && (f.rules || "VFR") === "IFR" && (f.points || []).length >= 2;
    let sec = page.querySelector(":scope > #iaPanel");
    if (!show) { if (sec) sec.remove(); const b = page.querySelector("#bfBluf .bf-alt"); if (b) b.remove(); const j = page.querySelector('#bfJump [data-s="#iaPanel"]'); if (j) j.remove(); return; }
    busy = true;
    try {
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "iaPanel"; sec.dataset.k = ""; sec.innerHTML = `<h2>IFR alternate</h2><p class="muted">Checking the destination forecast and approaches…</p>`; }
      const anchor = ["#acPanel", "#ltPanel", "#rpPanel", "#dpPanel", "#wcPanel", "#rtPanel", "#fsPanel"].map((s) => page.querySelector(":scope > " + s)).find(Boolean);
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#iaPanel"]')) {
        const a = document.createElement("a");
        a.href = "#"; a.dataset.s = "#iaPanel"; a.textContent = "Alternate";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("iaPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
        j.appendChild(a);
      }
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${f.alternate || ""}|${f.date}|${f.time}|${f.tail}|${(f.wxText || "").length}|${new Date().getHours()}`;
      if (sec.dataset.k !== key) {
        sec.dataset.k = key;
        const my = ++gen;
        let r = null;
        try { r = await build(f); } catch (e) { console.error(e); }
        if (my !== gen) return;
        sec._r = r;
        if (sec.isConnected) { if (r) paint(sec, r); else sec.innerHTML = `<h2>IFR alternate</h2><p class="muted">The alternate check could not load right now.</p>`; }
      }
      const pg = document.querySelector("#view .page");
      if (pg) bluf(pg, sec._r);
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 450); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#iaPanel, #bfBluf .bf-alt"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroAlternate = { required, altCheck, altMins, condAt, verdict };

  // Demo tour and narrated tutorial (Mario can ask for the new narration line to be recorded)
  try {
    if (typeof TOURS !== "undefined") {
      const st = TOURS.civil && TOURS.civil.steps;
      if (Array.isArray(st) && !st._p353) {
        st._p353 = true;
        const i = st.findIndex((s) => s[0] === "#/brief");
        if (i >= 0) st[i] = [st[i][0], st[i][1], `${st[i][2]} On an IFR flight, IFR alternate checks whether the destination forecast requires an alternate and whether yours meets its minimums.`, ...st[i].slice(3)];
      }
    }
  } catch {}
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    const sc = T && T.civil && T.civil.scenes;
    if (sc && !sc._p353) {
      sc._p353 = true;
      let at = sc.findIndex((s) => s.hash === "#/feedback");
      if (at < 0) at = sc.length - 1;
      sc.splice(at, 0, { hash: "#/brief", sel: "#iaPanel, #bfBluf", wait: "#bfBluf", text: "On an IFR flight, IFR alternate reads the destination forecast for the hour either side of arrival and tells you if the rules require an alternate. Enter one, or tap Suggest alternates, and it checks the alternate's forecast against its minimums." });
    }
  } catch (e) { console.error(e); }
})();
