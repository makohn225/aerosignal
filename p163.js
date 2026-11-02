"use strict";
/* p163: VFR nav log on the brief (November 2, 2026). The classic student nav log, worked out for the
   flight's route, cruise altitude and true airspeed with the winds aloft forecast (p36 AeroWinds) and
   magnetic variation (p124 AeroMag):
   checkpoint, altitude, true course, wind, wind correction angle, true heading, variation, magnetic
   heading, distance (leg and remaining), groundspeed, time (leg and total), fuel (leg and remaining),
   with empty columns for actual time and ATA on the printout.
   Times and fuel are rounded up, so the log never promises more than the numbers support. Times assume
   cruise speed on every leg; the pilot adds the climb from the POH. Fuel burn and fuel on board come
   from the airplane's weight and balance numbers (p72) and can be changed for this flight. No compass
   deviation is applied; the printout leaves a compass heading column for the pilot's deviation card.
   window.AeroNavLog.compute(flight, winds, opts) is the calculation, used by tests/calc.test.mjs. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
  const deg = (d) => (d == null ? "" : String(((Math.round(d) % 360) + 360) % 360 || 360).padStart(3, "0"));
  const up1 = (x) => Math.ceil(x * 10 - 1e-9) / 10;
  const signed = (d) => (Math.round(d) === 0 ? "0" : `${Math.abs(Math.round(d))}${d > 0 ? "R" : "L"}`);
  const varLbl = (v) => (Math.round(v) === 0 ? "0" : `${Math.abs(Math.round(v))}${v > 0 ? "E" : "W"}`);
  const hm = (min) => { const m = Math.ceil(min - 1e-9); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}` : `${m}`; };

  function wbOf(f) { try { return ((S.profiles || {})[f.tail] || {}).wb || null; } catch { return null; } }
  function inputs(f) {
    const W = window.AeroWinds, wb = wbOf(f) || {}, o = f.nl || {};
    return {
      alt: num(o.alt) ?? (W ? W.altOf(f) : 5500),
      tas: num(o.tas) ?? (W ? W.tasOf(f) : 110),
      gph: num(o.gph) ?? num(wb.gph),
      fuel: num(o.fuel) ?? num((f.wb || {}).fuel),
      taxi: num(o.taxi) ?? 1,
    };
  }
  // The calculation: legs from AeroWinds.legs, the wind triangle from AeroWinds.solve, variation at
  // each leg's midpoint. Returns rows plus totals.
  function compute(f, winds, opt) {
    const W = window.AeroWinds, M = window.AeroMag;
    const I = Object.assign(inputs(f), opt || {});
    const legs = W.legs(f);
    if (!(winds && Array.isArray(winds.stations) && Array.isArray(winds.levels))) winds = null;
    const sol = W.solve(winds || { stations: [], levels: [] }, legs, I.tas, I.alt);
    const total = legs.reduce((a, l) => a + l.nm, 0);
    let dist = 0, min = 0, fuelLeft = I.fuel != null ? I.fuel - (I.taxi || 0) : null;
    const rows = sol.rows.map((r) => {
      const v = M ? M.decl(r.mid.lat, r.mid.lon, I.alt, f.date ? new Date(`${f.date}T12:00:00`) : undefined) : 0;
      const wca = ((r.hdg - r.crs + 540) % 360) - 180;
      const mh = (r.hdg - v + 720) % 360;
      dist += r.nm; min += r.min;
      const legFuel = I.gph ? up1((Math.ceil(r.min - 1e-9) / 60) * I.gph) : null;
      if (fuelLeft != null && legFuel != null) fuelLeft -= legFuel;
      return {
        from: r.from.ident, to: r.to.ident, nm: r.nm, rem: Math.max(0, total - dist), tc: r.crs, wind: r.w && r.w.dir != null ? { dir: r.w.dir, spd: r.w.spd } : null,
        wca, th: r.hdg, var: v, mh, gs: r.gs, min: r.min, cum: min, fuel: legFuel, fuelLeft: fuelLeft != null && legFuel != null ? fuelLeft : null,
      };
    });
    const tripFuel = rows.reduce((a, r) => a + (r.fuel || 0), 0);
    return { I, rows, total, min, tripFuel: I.gph ? tripFuel : null, landFuel: fuelLeft, windsUsed: !!(winds && winds.stations && winds.stations.length), valid: winds && winds.valid ? winds.valid : null };
  }

  const css = document.createElement("style");
  css.textContent = `
    #nlPanel .nl-in{display:flex;flex-wrap:wrap;gap:8px 12px;margin:0 0 10px}
    #nlPanel .nl-in label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--ink2);min-width:96px;flex:1 1 96px;max-width:150px}
    #nlPanel .nl-in input{width:100%;box-sizing:border-box;font:14px var(--mono,monospace)}
    #nlPanel .nl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
    #nlPanel table{border-collapse:collapse;font-size:13px;width:100%;min-width:760px}
    #nlPanel th,#nlPanel td{padding:5px 6px;border-bottom:1px solid var(--line2);text-align:right;white-space:nowrap}
    #nlPanel th{font:600 11px var(--body,system-ui);color:var(--ink2);text-transform:uppercase;letter-spacing:.5px}
    #nlPanel td.ck,#nlPanel th.ck{text-align:left}
    #nlPanel td{font-family:var(--mono,monospace)}
    #nlPanel td.mh{font-weight:700;color:var(--cyan,#3DE0FF)}
    #nlPanel tr.tot td{font-weight:700;border-bottom:0}
    #nlPanel .nl-note{font-size:12.5px;color:var(--ink2);margin:8px 0 0}
    #nlPanel .nl-warn{color:#ffb648}
    #nlPrint{display:none}
    @media print{
      html.day:has(body.nl-print){filter:none!important}
      body.nl-print > *:not(#nlPrint){display:none!important}
      body.nl-print{background:#fff!important}
      body.nl-print::before{display:none!important}
      body.nl-print #nlPrint,body.nl-print #nlPrint *{visibility:visible!important}
      body.nl-print #nlPrint{display:block!important;color:#000;background:#fff;font:9.5pt/1.3 Arial,sans-serif}
      #nlPrint h1{font:700 14pt Arial,sans-serif;margin:0 0 4pt}
      #nlPrint .hd{display:flex;flex-wrap:wrap;gap:4pt 16pt;margin:0 0 6pt}
      #nlPrint table{border-collapse:collapse;width:100%}
      #nlPrint th,#nlPrint td{border:1px solid #444;padding:3pt 4pt;text-align:center;color:#000}
      #nlPrint th{background:#eee!important;font-size:8pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      #nlPrint td.ck{text-align:left}
      #nlPrint td.w{min-width:34pt}
      #nlPrint .ft{font-size:8pt;margin-top:6pt}
      @page{size:landscape;margin:10mm}
    }
  `;
  document.head.appendChild(css);

  const winds = new Map();
  async function getWinds(f) {
    const W = window.AeroWinds;
    if (!W) return null;
    const key = `${f.date}T${f.time}`;
    if (!winds.has(key)) {
      // Never hold the nav log hostage to a slow forecast: after 8 seconds show it without wind and
      // try again on the next refresh
      const p = Promise.race([W.fetchWinds(f).catch(() => null), new Promise((r) => setTimeout(() => r(undefined), 8000))])
        .then((x) => { if (x === undefined) { winds.delete(key); return null; } return x; });
      winds.set(key, p);
    }
    return winds.get(key);
  }
  function table(c, pr) {
    const head = `<tr><th class="ck">Checkpoint</th><th>Alt</th><th>TC</th><th>Wind</th><th>WCA</th><th>TH</th><th>Var</th><th>MH</th>${pr ? "<th>Dev</th><th>CH</th>" : ""}<th>Leg nm</th><th>Rem nm</th><th>GS</th><th>ETE</th><th>Total</th>${pr ? "<th>ATE</th><th>ETA</th><th>ATA</th>" : ""}<th>Fuel</th><th>Fuel left</th></tr>`;
    const rows = c.rows.map((r) => `<tr><td class="ck">${h(r.from)} to ${h(r.to)}</td><td>${Math.round(c.I.alt).toLocaleString("en-US")}</td><td>${deg(r.tc)}</td><td>${r.wind ? `${deg(r.wind.dir)}/${Math.round(r.wind.spd)}` : "none"}</td><td>${signed(r.wca)}</td><td>${deg(r.th)}</td><td>${varLbl(r.var)}</td><td class="mh">${deg(r.mh)}</td>${pr ? '<td class="w"></td><td class="w"></td>' : ""}<td>${r.nm.toFixed(1)}</td><td>${r.rem.toFixed(1)}</td><td>${Math.round(r.gs)}</td><td>${hm(r.min)}</td><td>${hm(r.cum)}</td>${pr ? '<td class="w"></td><td class="w"></td><td class="w"></td>' : ""}<td>${r.fuel != null ? r.fuel.toFixed(1) : ""}</td><td class="${r.fuelLeft != null && r.fuelLeft < 0 ? "nl-warn" : ""}">${r.fuelLeft != null ? r.fuelLeft.toFixed(1) : ""}</td></tr>`).join("");
    const tot = `<tr class="tot"><td class="ck">Total</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>${pr ? "<td></td><td></td>" : ""}<td>${c.total.toFixed(1)}</td><td></td><td></td><td></td><td>${hm(c.min)}</td>${pr ? "<td></td><td></td><td></td>" : ""}<td>${c.tripFuel != null ? up1(c.tripFuel).toFixed(1) : ""}</td><td>${c.landFuel != null ? c.landFuel.toFixed(1) : ""}</td></tr>`;
    return `<table><thead>${head}</thead><tbody>${rows}${tot}</tbody></table>`;
  }
  function notes(c) {
    const out = [];
    if (c.windsUsed && c.valid) { const d = new Date(c.valid); if (!isNaN(d)) out.push(`Winds: National Weather Service winds aloft forecast valid ${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}00Z, from aviationweather.gov.`); }
    if (!c.windsUsed) out.push(`<span class="nl-warn">No winds aloft forecast is loaded for this time, so headings and groundspeeds are without wind.</span>`);
    if (c.I.gph == null) out.push(`<span class="nl-warn">Enter the fuel burn to see fuel for each leg.</span>`);
    else if (c.I.fuel == null) out.push(`Enter fuel at engine start to see fuel remaining.`);
    if (c.landFuel != null && c.I.gph) { const res = c.landFuel / c.I.gph * 60; out.push(`Fuel left at the destination: ${c.landFuel.toFixed(1)} gal, about ${Math.floor(res)} minutes at ${c.I.gph} gal per hour.${res < 30 ? ' <span class="nl-warn">Less than the 30 minute day VFR reserve (91.151).</span>' : ""}`); }
    out.push("Times assume cruise speed on every leg; add your climb time and fuel from the POH. MH has no compass deviation applied. Winds are a forecast; check them against your official briefing.");
    return out.map((t) => `<p class="nl-note">${t}</p>`).join("");
  }
  function print(f, c) {
    let p = document.getElementById("nlPrint"); if (!p) { p = document.createElement("div"); p.id = "nlPrint"; document.body.appendChild(p); }
    p.innerHTML = `<h1>VFR navigation log: ${h((f.points || []).map((x) => x.ident).join(" "))}</h1>
      <div class="hd"><span>Aircraft ${h(f.tail || "")}</span><span>Date ${h(f.date || "")} ${h(f.time || "")} local</span><span>Cruise ${Math.round(c.I.alt).toLocaleString("en-US")} ft</span><span>TAS ${Math.round(c.I.tas)} kt</span>${c.I.gph ? `<span>Burn ${c.I.gph} gal per hr</span>` : ""}${c.I.fuel != null ? `<span>Fuel at start ${c.I.fuel} gal, taxi ${c.I.taxi} gal</span>` : ""}<span>Winds ${c.windsUsed ? "forecast aloft" : "not loaded"}</span></div>
      ${table(c, true)}
      <p class="ft">Times and fuel are rounded up and assume cruise speed on every leg; add climb from the POH. Apply your compass deviation card for CH. Planning aid only: check against the POH, current charts and an official weather briefing. The pilot in command is responsible for the flight.</p>`;
    document.body.classList.add("nl-print");
    const done = () => { document.body.classList.remove("nl-print"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { try { window.print(); } catch {} setTimeout(done, 1500); }, 60);
  }
  let busy = false;
  async function panel() {
    if (!/^#\/brief/.test(location.hash || "")) return;
    let f = null; try { f = currentFlight(); } catch {}
    if (!f || f.missionId || !(f.points || []).length || f.points.length < 2 || !window.AeroWinds) return;
    let view = document.querySelector("#view .page");
    if (!view) return;
    let sec = document.getElementById("nlPanel");
    const sig = `${f.id}|${(f.points || []).map((p) => p.ident).join(" ")}|${JSON.stringify(f.nl || {})}|${(f.wb || {}).fuel}|${f.tail}|${f.date}T${f.time}|${f.cruiseAlt}`;
    if (sec && sec.dataset.sig === sig) return;
    if (busy) return;
    busy = true;
    try {
      const w = await getWinds(f);
      // The brief may have redrawn while the forecast loaded: work on the page that is showing now
      if (!document.body.contains(view)) { view = document.querySelector("#view .page"); if (!view || !/^#\/brief/.test(location.hash || "")) return; sec = document.getElementById("nlPanel"); }
      const c = compute(f, w);
      if (!sec) {
        sec = document.createElement("section"); sec.className = "panel"; sec.id = "nlPanel";
        const after = document.getElementById("wbPanel") || document.getElementById("waPanel");
        if (after) after.after(sec); else view.appendChild(sec);
      }
      sec.dataset.sig = sig;
      const I = c.I;
      sec.innerHTML = `<h2>VFR nav log</h2>
        <div class="nl-in"><label>Cruise altitude (ft)<input data-k="alt" inputmode="numeric" value="${h(Math.round(I.alt))}"></label><label>True airspeed (kt)<input data-k="tas" inputmode="numeric" value="${h(Math.round(I.tas))}"></label><label>Fuel burn (gal per hr)<input data-k="gph" inputmode="decimal" value="${h(I.gph ?? "")}" placeholder="POH"></label><label>Fuel at start (gal)<input data-k="fuel" inputmode="decimal" value="${h(I.fuel ?? "")}"></label><label>Taxi and runup (gal)<input data-k="taxi" inputmode="decimal" value="${h(I.taxi)}"></label></div>
        <div class="nl-wrap">${table(c, false)}</div>${notes(c)}
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn sm" id="nlPrintB">Print nav log</button></div>
        <p class="d" style="color:#ff4d6a;font-weight:700;font-size:12.5px;margin:8px 0 0">Planning aid only. Check every number against the POH, current charts and an official weather briefing. The pilot in command is responsible for the flight.</p>`;
      sec.querySelectorAll("input[data-k]").forEach((inp) => (inp.onchange = () => {
        const k = inp.dataset.k, v = num(inp.value);
        f.nl = f.nl || {};
        if (v == null || v < 0) delete f.nl[k]; else f.nl[k] = v;
        if (k === "alt" && v > 0) f.cruiseAlt = v;
        f.updated = Date.now(); save(); panel();
      }));
      sec.querySelector("#nlPrintB").onclick = () => print(f, compute(f, w));
    } catch (e) { console.error(e); } finally { busy = false; }
  }
  let t = 0;
  // Throttle, not debounce: the brief keeps changing while it loads, and a debounce could wait forever
  const kick = () => { if (t) return; t = setTimeout(() => { t = 0; panel(); }, 400); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroNavLog = { compute, inputs, refresh: () => panel(), busy: () => busy };
})();
