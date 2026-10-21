"use strict";
/* p72: weight, balance and fuel on the civil flight brief.
   Each aircraft's numbers (empty weight and arm, maximum weights, CG limits, station arms, usable
   fuel and burn) are entered once and saved with that tail. The loading for each flight (people,
   baggage, fuel at start) is saved with the flight. The panel works out takeoff and landing weight
   and CG against the envelope, draws both points on a small envelope chart, and checks the fuel on
   board against trip fuel plus the legal reserve (14 CFR 91.151 day and night VFR, 91.167 IFR with
   an alternate). The bottom line card gets a one line summary, the section row a chip, and the
   aircraft and fuel items of the Before you go checklist show the result. Nothing leaves the device.
   The only built in template is the Cessna 172S; every other type uses the pilot's own POH numbers. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #wbPanel .wb-src{font-size:13px;color:var(--ink2,#9fb0c8);margin:0 0 10px;line-height:1.45}
    #wbPanel .wb-src .ex{color:#ffb648;font-weight:700}
    #wbPanel .wb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px 12px;margin:6px 0 12px}
    #wbPanel .wb-grid label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--ink2,#9fb0c8);text-transform:none;letter-spacing:normal;margin:0}
    #wbPanel .wb-grid input{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:8px 10px;border-radius:9px;border:1px solid var(--line2,rgba(255,255,255,.18));background:rgba(0,0,0,.25);color:var(--ink,#EAF2FF)}
    #wbPanel .wb-out{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:14px;align-items:start}
    @media (max-width:640px){#wbPanel .wb-out{grid-template-columns:1fr}}
    #wbPanel table{width:100%;border-collapse:collapse;font-size:14px}
    #wbPanel td,#wbPanel th{padding:6px 4px;border-top:1px solid var(--line2,rgba(255,255,255,.08));text-align:left;font-weight:400}
    #wbPanel th{color:var(--ink2,#9fb0c8);font-size:12px;text-transform:uppercase;letter-spacing:1px}
    #wbPanel td.n{font-family:var(--mono,monospace);text-align:right;white-space:nowrap}
    #wbPanel .pill{display:inline-block;font:700 11px var(--mono,monospace);letter-spacing:.5px;padding:2px 9px;border-radius:999px;border:1px solid currentColor;margin:2px 6px 2px 0}
    #wbPanel .ok,.bf-wbf .ok,#goPanel .wbst .ok{color:#46e39b}
    #wbPanel .warn,.bf-wbf .warn,#goPanel .wbst .warn{color:#ffb648}
    #wbPanel .bad,.bf-wbf .bad,#goPanel .wbst .bad{color:#ff4d6a}
    #wbPanel .wb-st{margin:10px 0 4px;font-size:14px;line-height:1.5}
    #wbPanel svg{width:100%;max-width:340px;height:auto;display:block;background:rgba(0,0,0,.2);border-radius:10px}
    #wbPanel svg text{font:10px var(--mono,monospace);fill:#9fb0c8}
    #wbPanel details.wb-ac{margin:12px 0 4px;border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:0 12px}
    #wbPanel details.wb-ac>summary{cursor:pointer;padding:10px 0;font-size:14px;color:#3DE0FF}
    #wbPanel .wb-acts{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 12px}
    #wbPanel .wb-disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #wbPanel h3{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--ink2,#9fb0c8);margin:14px 0 4px}
    #bfBluf .bf-wbf{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-wbf b{font:700 11px var(--mono,monospace);padding:1px 6px;border-radius:999px;border:1px solid currentColor;margin:0 2px}
    #bfBluf .bf-wbf .mut{color:var(--ink2,#9fb0c8)}
    #goPanel .wbst{display:block;margin-top:4px;font-size:12.5px;text-transform:none;letter-spacing:normal}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const on = (re) => re.test(location.hash || "");
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
  const lb = (n) => Math.ceil(n).toLocaleString("en-US");
  const flight = () => { try { const f = currentFlight(); return f && (f.points || []).length && !f.missionId ? f : null; } catch { return null; } };

  /* Cessna 172S, normal category (POH section 6). The empty weight is an example only. */
  const C172S = {
    tpl: "C172S", emptyEx: true, empty: 1680, emptyArm: 40.6, maxTO: 2550, maxLdg: 2550,
    fwdLo: 35.0, fwdW: 1950, fwdHi: 41.0, aft: 47.3,
    front: 37, rear: 73, bag1: 95, bag1Max: 120, bag2: 123, bag2Max: 50, bagMax: 120,
    fuelArm: 48, usable: 53, gph: 9, lbGal: 6,
  };
  const FIELDS = [
    ["empty", "Empty weight (lb)"], ["emptyArm", "Empty weight arm (in)"], ["maxTO", "Max takeoff weight (lb)"], ["maxLdg", "Max landing weight (lb)"],
    ["fwdLo", "Forward CG limit, light (in)"], ["fwdW", "Up to this weight (lb)"], ["fwdHi", "Forward CG limit at max weight (in)"], ["aft", "Aft CG limit (in)"],
    ["front", "Front seats arm (in)"], ["rear", "Rear seats arm (in)"], ["bag1", "Baggage area 1 arm (in)"], ["bag1Max", "Baggage area 1 max (lb)"],
    ["bag2", "Baggage area 2 arm (in)"], ["bag2Max", "Baggage area 2 max (lb)"], ["bagMax", "Baggage total max (lb)"],
    ["fuelArm", "Fuel arm (in)"], ["usable", "Usable fuel (gal)"], ["gph", "Fuel burn (gal per hr)"], ["lbGal", "Fuel weight (lb per gal)"],
  ];
  const NEED = ["empty", "emptyArm", "maxTO", "fwdLo", "aft", "front", "fuelArm", "gph"];

  function acft(f) {
    const all = (() => { try { return allAircraft(); } catch { return {}; } })();
    const a = all[f.tail] || {};
    const prof = (S.profiles = S.profiles || {}), p = (prof[f.tail] = prof[f.tail] || {});
    if (!p.wb && a.family === "C172") p.wb = { ...C172S };
    return { a, p, wb: p.wb || null };
  }
  const ready = (wb) => wb && NEED.every((k) => num(wb[k]) != null);

  function fwdAt(wb, w) {
    const lo = num(wb.fwdLo), hi = num(wb.fwdHi), w1 = num(wb.fwdW), max = num(wb.maxTO);
    if (hi == null || w1 == null || !max || w <= w1) return lo;
    return lo + (hi - lo) * Math.min(1, (w - w1) / (max - w1));
  }

  function calc(f, wb) {
    const L = f.wb || {};
    const g = (k) => num(L[k]) || 0;
    const lbGal = num(wb.lbGal) || 6;
    const items = [
      ["Empty aircraft", num(wb.empty), num(wb.emptyArm)],
      ["Front seats", g("front"), num(wb.front)],
      ["Rear seats", g("rear"), num(wb.rear) ?? num(wb.front)],
      ["Baggage area 1", g("bag1"), num(wb.bag1)],
      ["Baggage area 2", g("bag2"), num(wb.bag2)],
    ].filter(([, w, arm]) => w && arm != null);
    let w0 = 0, m0 = 0;
    for (const [, w, arm] of items) { w0 += w; m0 += w * arm; }
    let p = null;
    try { p = profile(f); } catch {}
    const ete = p && isFinite(p.ete) ? p.ete : 1;
    const gph = num(wb.gph) || 0, taxi = 1;
    const fuel = g("fuel"), usable = num(wb.usable);
    const trip = ete * gph;
    const night = !!(p && p.nightArr), ifr = f.rules === "IFR";
    const resMin = ifr ? 45 : night ? 45 : 30;
    const altMin = ifr ? g("altMin") : 0;
    const reserve = (resMin / 60) * gph, altFuel = (altMin / 60) * gph;
    const need = taxi + trip + altFuel + reserve;
    const fArm = num(wb.fuelArm);
    const toW = w0 + Math.max(0, fuel - taxi) * lbGal, toM = m0 + Math.max(0, fuel - taxi) * lbGal * fArm;
    const burn = Math.min(Math.max(0, fuel - taxi), trip);
    const ldW = toW - burn * lbGal, ldM = toM - burn * lbGal * fArm;
    const pt = (w, m) => ({ w, cg: w ? m / w : 0, fwd: fwdAt(wb, w), aft: num(wb.aft) });
    const to = pt(toW, toM), ld = pt(ldW, ldM);
    const probs = [];
    const maxTO = num(wb.maxTO), maxLdg = num(wb.maxLdg) || maxTO;
    if (toW > maxTO) probs.push(["bad", `${lb(toW - maxTO)} lb over max takeoff weight`]);
    if (ldW > maxLdg) probs.push(["bad", `${lb(ldW - maxLdg)} lb over max landing weight`]);
    for (const [nm, x] of [["takeoff", to], ["landing", ld]]) {
      if (x.cg < x.fwd - 0.05) probs.push(["bad", `CG forward of limit at ${nm}`]);
      if (x.cg > x.aft + 0.05) probs.push(["bad", `CG aft of limit at ${nm}`]);
    }
    const b1 = g("bag1"), b2 = g("bag2");
    if (num(wb.bag1Max) && b1 > num(wb.bag1Max)) probs.push(["bad", "Baggage area 1 over its limit"]);
    if (num(wb.bag2Max) && b2 > num(wb.bag2Max)) probs.push(["bad", "Baggage area 2 over its limit"]);
    if (num(wb.bagMax) && b1 + b2 > num(wb.bagMax)) probs.push(["bad", "Total baggage over its limit"]);
    if (usable && fuel > usable) probs.push(["bad", `More fuel than the ${usable} gal usable`]);
    const fuelOk = fuel >= need;
    return { items, to, ld, fuel, need, trip, reserve, resMin, altFuel, altMin, taxi, ete, gph, ifr, night, fuelOk, probs, loaded: g("front") > 0 && fuel > 0, endur: gph ? (fuel - taxi) / gph : 0, lbGal, fArm };
  }

  function chart(wb, r) {
    const maxTO = num(wb.maxTO), lo = Math.min(num(wb.fwdLo), r.to.cg, r.ld.cg) - 1.5, hi = Math.max(num(wb.aft), r.to.cg, r.ld.cg) + 1.5;
    const wMin = Math.min(Math.round((maxTO * 0.62) / 50) * 50, Math.floor(r.ld.w / 50) * 50 - 50), wMax = Math.max(maxTO, r.to.w) + 60;
    const W = 220, H = 170, P = 26;
    const x = (cg) => P + ((cg - lo) / (hi - lo)) * (W - P - 8), y = (w) => H - P + 6 - ((w - wMin) / (wMax - wMin)) * (H - P - 4);
    const env = [[num(wb.fwdLo), wMin], [num(wb.fwdLo), Math.min(num(wb.fwdW) || maxTO, maxTO)], [fwdAt(wb, maxTO), maxTO], [num(wb.aft), maxTO], [num(wb.aft), wMin]];
    const poly = env.map(([c, w]) => `${x(c).toFixed(1)},${y(w).toFixed(1)}`).join(" ");
    const dot = (p, col, t) => `<circle cx="${x(p.cg).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="4.5" fill="${col}"/><text x="${(x(p.cg) + 7).toFixed(1)}" y="${(y(p.w) + 3).toFixed(1)}" style="fill:${col}">${t}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="CG envelope with takeoff and landing points">
      <polygon points="${poly}" fill="rgba(61,224,255,.08)" stroke="#3DE0FF" stroke-width="1.2"/>
      <line x1="${x(r.to.cg).toFixed(1)}" y1="${y(r.to.w).toFixed(1)}" x2="${x(r.ld.cg).toFixed(1)}" y2="${y(r.ld.w).toFixed(1)}" stroke="#9fb0c8" stroke-dasharray="3 3"/>
      ${dot(r.to, r.probs.some((p) => /takeoff/.test(p[1])) ? "#ff4d6a" : "#46e39b", "TO")}${dot(r.ld, r.probs.some((p) => /landing/.test(p[1])) ? "#ff4d6a" : "#5aa9ff", "LDG")}
      <text x="${P}" y="${H - 4}">${lo.toFixed(0)} in</text><text x="${W - 40}" y="${H - 4}">${hi.toFixed(0)} in</text>
      <text x="2" y="${(y(maxTO) + 3).toFixed(1)}">${Math.round(maxTO / 100) / 10}k</text><text x="2" y="${(y(wMin) + 3).toFixed(1)}">${Math.round(wMin / 100) / 10}k</text>
    </svg>`;
  }

  function summary(f) {
    const { wb } = acft(f);
    if (!ready(wb)) return { k: "none", t: "Set up the aircraft numbers in Weight, balance and fuel" };
    if (!f.wb || !(num(f.wb.front) > 0) || !(num(f.wb.fuel) > 0)) return { k: "none", t: "Enter people, baggage and fuel in Weight, balance and fuel" };
    const r = calc(f, wb);
    const wbBad = r.probs.length, fuelBad = !r.fuelOk;
    return { k: wbBad || fuelBad ? "bad" : wb.emptyEx ? "warn" : "ok", r, wbBad, fuelBad, ex: !!wb.emptyEx };
  }

  function results(f, wb, box) {
    const r = calc(f, wb);
    const st = [];
    if (r.probs.length) st.push(...r.probs.map(([k, t]) => `<span class="pill ${k}">${h(t.toUpperCase())}</span>`));
    else st.push(`<span class="pill ok">WITHIN LIMITS</span>`);
    st.push(r.fuelOk ? `<span class="pill ok">ENOUGH FUEL</span>` : `<span class="pill bad">SHORT ${Math.ceil(r.need - r.fuel)} GAL</span>`);
    if (wb.emptyEx) st.push(`<span class="pill warn">EXAMPLE EMPTY WEIGHT</span>`);
    const resWhy = r.ifr ? "45 min IFR reserve (91.167)" : r.night ? "45 min night VFR reserve (91.151)" : "30 min day VFR reserve (91.151)";
    const hm = (hr) => { const m = Math.max(0, Math.floor(hr * 60)); return `${Math.floor(m / 60)} hr ${m % 60} min`; };
    box.innerHTML = `<div class="wb-st">${st.join("")}</div>
      <div class="wb-out"><div><table>
        <tr><th></th><th style="text-align:right">Weight</th><th style="text-align:right">CG</th><th style="text-align:right">Limits</th></tr>
        <tr><td>Takeoff</td><td class="n">${lb(r.to.w)} lb</td><td class="n">${r.to.cg.toFixed(1)} in</td><td class="n">${r.to.fwd.toFixed(1)} to ${r.to.aft.toFixed(1)}</td></tr>
        <tr><td>Landing</td><td class="n">${lb(r.ld.w)} lb</td><td class="n">${r.ld.cg.toFixed(1)} in</td><td class="n">${r.ld.fwd.toFixed(1)} to ${r.ld.aft.toFixed(1)}</td></tr>
        <tr><td>Max takeoff</td><td class="n">${lb(num(wb.maxTO))} lb</td><td></td><td class="n">${lb(Math.max(0, num(wb.maxTO) - r.to.w))} lb to spare</td></tr>
      </table>
      <h3>Fuel</h3><table>
        <tr><td>Taxi and runup</td><td class="n">${r.taxi} gal</td></tr>
        <tr><td>Trip, ${hm(r.ete)} at ${r.gph} gal per hr</td><td class="n">${Math.ceil(r.trip)} gal</td></tr>
        ${r.ifr ? `<tr><td>To the alternate, ${r.altMin || 0} min</td><td class="n">${Math.ceil(r.altFuel)} gal</td></tr>` : ""}
        <tr><td>${resWhy}</td><td class="n">${Math.ceil(r.reserve)} gal</td></tr>
        <tr><td><b>Needed at engine start</b></td><td class="n"><b>${Math.ceil(r.need)} gal</b></td></tr>
        <tr><td>On board, endurance ${hm(r.endur)}</td><td class="n ${r.fuelOk ? "ok" : "bad"}">${r.fuel} gal</td></tr>
      </table></div>${chart(wb, r)}</div>`;
  }

  function panel(page, f) {
    let sec = page.querySelector("#wbPanel");
    const { a, p, wb } = acft(f);
    const sig = `${f.id}|${f.tail}|${f.rules}|${JSON.stringify(wb || {})}`;
    if (sec && sec.dataset.sig === sig) return sec;
    if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "wbPanel"; }
    sec.dataset.sig = sig;
    const L = (f.wb = f.wb || {});
    if (wb && L.fuel == null && num(wb.usable)) L.fuel = num(wb.usable);
    const name = `${h(f.tail || "This aircraft")}${a.typeCode || a.model ? ` ${h(a.typeCode || a.model)}` : ""}`;
    const src = !wb ? `Enter ${name}'s numbers from its POH and current weight and balance record once; they are saved for every flight in this aircraft.`
      : wb.tpl && wb.emptyEx ? `${name}: Cessna 172S limits from the POH. <span class="ex">The empty weight is an example.</span> Enter the empty weight and arm from this aircraft's weight and balance record below.`
      : `${name}: your aircraft numbers.`;
    const inp = (k, label, v, step) => `<label>${h(label)}<input type="number" inputmode="decimal" step="${step || "any"}" data-l="${k}" value="${v ?? ""}"></label>`;
    sec.innerHTML = `<h2>Weight, balance and fuel</h2>
      <p class="wb-src">${src}</p>
      ${ready(wb) ? `<div class="wb-grid">
        ${inp("front", "Pilot and front seat (lb)", L.front)}${inp("rear", "Rear seats (lb)", L.rear)}
        ${inp("bag1", "Baggage area 1 (lb)", L.bag1)}${num(wb.bag2) != null ? inp("bag2", "Baggage area 2 (lb)", L.bag2) : ""}
        ${inp("fuel", "Fuel at engine start (gal)", L.fuel)}${f.rules === "IFR" ? inp("altMin", "Minutes to the alternate", L.altMin) : ""}
      </div><div class="wb-res"></div>` : ""}
      <details class="wb-ac"${ready(wb) ? "" : " open"}><summary>${ready(wb) ? "Edit aircraft numbers" : "Aircraft numbers"}</summary>
        <div class="wb-grid">${FIELDS.map(([k, l]) => `<label>${h(l)}<input type="number" inputmode="decimal" step="any" data-a="${k}" value="${wb && wb[k] != null ? wb[k] : ""}"></label>`).join("")}</div>
        <div class="wb-acts"><button type="button" class="btn sm" data-x="save">Save aircraft numbers</button>${a.family === "C172" || !wb ? `<button type="button" class="btn sec sm" data-x="c172">Use Cessna 172S limits</button>` : ""}${wb ? `<button type="button" class="btn sec sm" data-x="clear">Clear</button>` : ""}</div>
      </details>
      <p class="wb-disc">Planning aid only. Use this aircraft's current weight and balance record and POH. The pilot in command is responsible for loading and fuel.</p>`;
    const res = sec.querySelector(".wb-res");
    if (res) results(f, wb, res);
    sec.querySelectorAll("input[data-l]").forEach((i) => (i.oninput = () => {
      const v = num(i.value); if (v == null) delete L[i.dataset.l]; else L[i.dataset.l] = Math.max(0, v);
      f.updated = Date.now(); try { save(); } catch {}
      results(f, wb, res); line(page, f); hints(f);
    }));
    sec.querySelectorAll("button[data-x]").forEach((b) => (b.onclick = () => {
      const x = b.dataset.x;
      if (x === "c172") p.wb = { ...C172S };
      else if (x === "clear") delete p.wb;
      else {
        const nw = { ...(wb || {}) };
        sec.querySelectorAll("input[data-a]").forEach((i) => { const v = num(i.value); if (v == null) delete nw[i.dataset.a]; else nw[i.dataset.a] = v; });
        if (wb && wb.emptyEx && (nw.empty !== wb.empty || nw.emptyArm !== wb.emptyArm)) delete nw.emptyEx;
        if (!NEED.every((k) => num(nw[k]) != null)) { try { toast("Enter at least the empty weight and arm, max takeoff weight, CG limits, front seat and fuel arms and fuel burn"); } catch {} return; }
        p.wb = nw;
      }
      try { save(); } catch {}
      try { toast(x === "clear" ? "Aircraft numbers cleared" : "Aircraft numbers saved"); } catch {}
      sec.dataset.sig = ""; panel(page, f); line(page, f); hints(f);
    }));
    return sec;
  }

  function place(page, sec) {
    const go = page.querySelector(":scope > #goPanel");
    if (go) { if (go.previousElementSibling !== sec) go.before(sec); return; }
    if (sec.isConnected) return;
    const anchor = page.querySelector(":scope > #dbPanel") || page.querySelector(":scope > #bbody");
    if (anchor) anchor.after(sec); else page.appendChild(sec);
  }

  function line(page, f) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    const s = summary(f);
    let html;
    if (!s.r) html = `Weight and fuel: <span class="mut">${h(s.t)}</span>`;
    else {
      const wbTxt = s.wbBad ? `<b class="bad">CHECK</b> ${h(s.r.probs[0][1])}` : `<b class="${s.ex ? "warn" : "ok"}">OK</b> ${lb(s.r.to.w)} lb, CG ${s.r.to.cg.toFixed(1)} in${s.ex ? ` <span class="mut">(example empty weight)</span>` : ""}`;
      const fTxt = s.fuelBad ? `<b class="bad">SHORT</b> ${s.r.fuel} gal on board, ${Math.ceil(s.r.need)} needed` : `<b class="ok">OK</b> ${s.r.fuel} gal on board, ${Math.ceil(s.r.need)} needed`;
      html = `Weight and balance: ${wbTxt}  ·  Fuel: ${fTxt}`;
    }
    let el = card.querySelector(".bf-wbf");
    if (el && el.dataset.v === html) return;
    if (!el) {
      el = document.createElement("div"); el.className = "bf-wbf";
      const after = card.querySelector(".bf-nt") || card.querySelector(".bf-wx") || card.querySelector(".k");
      if (after) after.after(el); else card.prepend(el);
    }
    el.dataset.v = html; el.innerHTML = html;
  }

  function chip(page) {
    const j = page.querySelector("#bfJump");
    if (!j || !page.querySelector("#wbPanel") || j.querySelector('[data-s="#wbPanel"]')) return;
    const a = document.createElement("a");
    a.href = "#"; a.dataset.s = "#wbPanel"; a.textContent = "Weight and fuel";
    a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("wbPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
    const ck = j.querySelector('[data-s="#goPanel"]');
    if (ck) ck.before(a); else j.appendChild(a);
  }

  function hints(f) {
    const s = summary(f);
    for (const [k, txt] of [
      ["acft", !s.r ? ["none", s.t] : s.wbBad ? ["bad", s.r.probs[0][1]] : [s.ex ? "warn" : "ok", `Within limits: ${lb(s.r.to.w)} lb at takeoff${s.ex ? ", example empty weight" : ""}`]],
      ["fuel", !s.r ? ["none", s.t] : s.fuelBad ? ["bad", `Short: ${s.r.fuel} gal on board, ${Math.ceil(s.r.need)} needed`] : ["ok", `${s.r.fuel} gal on board, ${Math.ceil(s.r.need)} needed with reserve`]],
    ]) {
      const lab = document.querySelector(`#goPanel label[for="go_${k}"]`);
      if (!lab) continue;
      const html = `<span class="${txt[0] === "none" ? "" : txt[0]}">${h(txt[1])}</span>`;
      let el = lab.querySelector(".wbst");
      if (el && el.dataset.v === html) continue;
      if (!el) { el = document.createElement("span"); el.className = "wbst"; lab.appendChild(el); }
      el.dataset.v = html; el.innerHTML = html;
    }
  }

  let busy = false, t = 0;
  function apply() {
    if (busy || !on(/^#\/brief(\/|$|\?)/)) return;
    const page = document.querySelector("#view .page"), f = flight();
    if (!page || !f || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      const sec = panel(page, f);
      place(page, sec);
      line(page, f); chip(page); hints(f);
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 200); };
  new MutationObserver((list) => {
    if (busy) return;
    // Typing in the panel's own inputs does not need a rebuild
    if (list.every((m) => m.target.closest && m.target.closest("#wbPanel .wb-res, #bfBluf .bf-wbf, #goPanel .wbst"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();

  // Demo tour step
  try {
    if (typeof TOURS !== "undefined" && TOURS.civil && Array.isArray(TOURS.civil.steps) && !TOURS.civil.steps._wb) {
      const st = TOURS.civil.steps;
      const i = st.findIndex((s) => s[0] === "#/brief");
      if (i >= 0) st[i] = [st[i][0], st[i][1], `${st[i][2]} Weight, balance and fuel sits near the end: enter the people, baggage and fuel once and it checks the CG envelope and the legal fuel reserve.`];
      st._wb = true;
    }
  } catch {}
  window.AeroWB = { calc, summary, C172S };
})();
