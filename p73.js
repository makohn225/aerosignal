"use strict";
/* p73: military flying without a mission.
   1. Ask helper and training routes. A route such as "KNCA VR084 B-F 13NC" holds the training route
      as a name plus its entry and exit points. Edits like "add 13NC after VR084 F" used to land
      between the name and its points and broke the route. The helper now treats each training
      route segment as one unit: "after VR084 F" means after the exit, "before VR084 B" means before
      the entry, and remove or replace never splits it.
   2. Aircraft for each flight from a dropdown. "Add aircraft" opens a short form with a grouped list
      of civil and military types (tail, bureau or side number optional) instead of two typed
      prompts. Type fields elsewhere (mission aircraft, Safety search, account) get the same list as
      suggestions.
   3. Load computation for military aircraft, on the flight brief and the mission brief: operating
      weight, useful load, payload available for the fuel loaded, how many passengers or how much
      cargo still fits, fuel needed and landing weight. Every number is the pilot's own, entered
      from unclassified planning figures; only publicly released MV-22B figures are offered as a
      starting point. Nothing leaves the device. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const on = (re) => re.test(location.hash || "");
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : null; };
  const lb = (n) => Math.ceil(n).toLocaleString("en-US");
  const curF = () => { try { return currentFlight(); } catch { return null; } };

  const css = document.createElement("style");
  css.textContent = `
    #acAdd{position:fixed;inset:0;z-index:4500;background:rgba(2,6,12,.72);display:flex;align-items:center;justify-content:center;padding:16px}
    #acAdd .bx{width:min(440px,100%);max-height:calc(100% - 32px);overflow:auto;background:#0b1626;border:1px solid rgba(61,224,255,.45);border-radius:14px;padding:16px;color:var(--ink,#EAF2FF);box-shadow:0 12px 40px rgba(0,0,0,.5)}
    #acAdd h3{margin:0 0 10px;font:600 15px var(--disp,inherit);letter-spacing:1px;text-transform:uppercase;color:#3DE0FF}
    #acAdd label{display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--ink2,#9fb0c8);margin:0 0 12px;text-transform:none;letter-spacing:normal}
    #acAdd input,#acAdd select{font:inherit;font-size:16px;padding:9px 10px;border-radius:9px;border:1px solid var(--line2,rgba(255,255,255,.2));background:#06101d;color:var(--ink,#EAF2FF)}
    #acAdd label[hidden]{display:none}
    #acAdd .row{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px}
    #acAdd .nt{font-size:12.5px;color:var(--ink2,#9fb0c8);margin:-4px 0 12px}
    #lcPanel .lc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px 12px;margin:6px 0 12px}
    #lcPanel label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--ink2,#9fb0c8);text-transform:none;letter-spacing:normal;margin:0}
    #lcPanel input,#lcPanel select{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:8px 10px;border-radius:9px;border:1px solid var(--line2,rgba(255,255,255,.18));background:rgba(0,0,0,.25);color:var(--ink,#EAF2FF)}
    #lcPanel h3{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--ink2,#9fb0c8);margin:14px 0 4px}
    #lcPanel table{width:100%;border-collapse:collapse;font-size:14px}
    #lcPanel td{padding:6px 4px;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #lcPanel td.n{font-family:var(--mono,monospace);text-align:right;white-space:nowrap}
    #lcPanel tr.big td{font-weight:700}
    #lcPanel .pill{display:inline-block;font:700 11px var(--mono,monospace);letter-spacing:.5px;padding:2px 9px;border-radius:999px;border:1px solid currentColor;margin:2px 6px 2px 0}
    #lcPanel .ok,.bf-lc .ok,#goPanel .lcst .ok{color:#46e39b}
    #lcPanel .warn,.bf-lc .warn,#goPanel .lcst .warn{color:#ffb648}
    #lcPanel .bad,.bf-lc .bad,#goPanel .lcst .bad{color:#ff4d6a}
    #lcPanel .lc-src{font-size:13px;color:var(--ink2,#9fb0c8);margin:0 0 8px;line-height:1.45}
    #lcPanel details{margin:12px 0 4px;border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:0 12px}
    #lcPanel details>summary{cursor:pointer;padding:10px 0;font-size:14px;color:#3DE0FF}
    #lcPanel .acts{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 12px}
    #lcPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #lcPanel .fit{font-size:14.5px;line-height:1.5;margin:8px 0 2px}
    #bfBluf .bf-lc{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-lc b{font:700 11px var(--mono,monospace);padding:1px 6px;border-radius:999px;border:1px solid currentColor;margin:0 2px}
    #goPanel .lcst{display:block;margin-top:4px;font-size:12.5px;text-transform:none;letter-spacing:normal}
    body.mil-ac #wbPanel,body.mil-ac #bfBluf .bf-wbf,body.mil-ac #goPanel .wbst,body.mil-ac #bfJump a[data-s="#wbPanel"]{display:none!important}
  `;
  document.head.appendChild(css);

  /* ---------------- aircraft types ---------------- */
  // [code stored as the type, name shown, planning speed in knots (an editable starting point)]
  const TYPES = [
    ["Civil airplanes", [["C152", "Cessna 152", 95], ["C172", "Cessna 172", 115], ["C182", "Cessna 182", 135], ["C206", "Cessna 206", 140], ["C210", "Cessna 210", 165], ["P28A", "Piper Cherokee, Warrior, Archer", 120], ["P28R", "Piper Arrow", 135], ["PA32", "Piper Saratoga, Lance", 150], ["SR20", "Cirrus SR20", 150], ["SR22", "Cirrus SR22", 175], ["DA40", "Diamond DA40", 130], ["DA42", "Diamond DA42", 160], ["M20P", "Mooney M20", 145], ["BE36", "Beechcraft Bonanza A36", 165], ["BE58", "Beechcraft Baron 58", 195], ["PC12", "Pilatus PC 12", 270]]],
    ["Civil helicopters", [["R22", "Robinson R22", 90], ["R44", "Robinson R44", 110], ["R66", "Robinson R66", 120], ["B06", "Bell 206", 110], ["AS50", "Airbus H125", 125]]],
    ["Military tiltrotor", [["MV-22B", "MV-22B Osprey", 240], ["CV-22B", "CV-22B Osprey", 240], ["CMV-22B", "CMV-22B Osprey", 240]]],
    ["Military helicopters", [["CH-53E", "CH-53E Super Stallion", 150], ["CH-53K", "CH-53K King Stallion", 150], ["UH-1Y", "UH-1Y Venom", 140], ["AH-1Z", "AH-1Z Viper", 140], ["UH-60M", "UH-60M Black Hawk", 140], ["HH-60W", "HH-60W Jolly Green II", 140], ["MH-60R", "MH-60R Seahawk", 140], ["MH-60S", "MH-60S Seahawk", 140], ["CH-47F", "CH-47F Chinook", 150], ["AH-64E", "AH-64E Apache", 140], ["UH-72A", "UH-72A Lakota", 120], ["TH-73A", "TH-73A Thrasher", 120]]],
    ["Military fixed wing", [["KC-130J", "KC-130J Super Hercules", 320], ["C-130J", "C-130J Super Hercules", 320], ["F-35B", "F-35B Lightning II", 450], ["F-35C", "F-35C Lightning II", 450], ["F/A-18E", "F/A-18E/F Super Hornet", 450], ["AV-8B", "AV-8B Harrier II", 420], ["T-6B", "T-6B Texan II", 270], ["T-45C", "T-45C Goshawk", 380], ["T-38C", "T-38C Talon", 450], ["P-8A", "P-8A Poseidon", 440], ["C-12", "C-12 Huron", 260], ["UC-35", "UC-35 Citation", 380]]],
  ];
  const ALL = TYPES.flatMap(([g, l]) => l.map((t) => ({ g, code: t[0], name: t[1], tas: t[2], mil: /^Military/.test(g) })));
  const MILRE = /(^|[^A-Z])(MV|CV|CMV|CH|UH|AH|HH|MH|SH|VH|KC|EC|HC|MC|AC|TH|UC|RC)-?\d|V-?22|^V22$|^H53|^H60|^H47|^UH1|^AH1|^C30J|F-?35|F\/?A-?18|AV-?8|T-?(6B|45|38)|P-?8A|^TEX2$/i;
  function isMil(tail) {
    try {
      const a = allAircraft()[tail] || {};
      if (a.mil || /^\d{6}$/.test(String(tail || ""))) return true;
      const s = `${a.typeCode || ""} ${a.model || ""}`;
      return MILRE.test(s) || /powered lift|osprey/i.test(`${a.category || ""} ${a.model || ""}`);
    } catch { return false; }
  }

  function typeOptions(sel) {
    return TYPES.map(([g, l]) => `<optgroup label="${h(g)}">${l.map(([c, n]) => `<option value="${h(c)}"${c === sel ? " selected" : ""}>${h(n)}</option>`).join("")}</optgroup>`).join("") + `<option value="__other">Other, I will type it</option>`;
  }

  function addAircraft(f, sel) {
    document.getElementById("acAdd")?.remove();
    const d = document.createElement("div");
    d.id = "acAdd"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Add aircraft");
    d.innerHTML = `<div class="bx"><h3>Add aircraft</h3>
      <label>Type<select data-k="type"><option value="">Choose a type</option>${typeOptions("")}</select></label>
      <label data-k="otherL" hidden>Type code or name<input data-k="other" placeholder="For example BE20 or MQ-9A" autocomplete="off"></label>
      <label>Tail, bureau or side number (optional)<input data-k="tail" placeholder="N12345, 168020 or YM-02" autocomplete="off"></label>
      <label>Planning speed (knots)<input data-k="tas" type="number" inputmode="numeric" min="40" max="600"></label>
      <p class="nt">The speed is a starting point for times and fuel. Change it to what you plan with.</p>
      <div class="row"><button type="button" class="btn sec sm" data-a="no">Cancel</button><button type="button" class="btn sm" data-a="ok">Use this aircraft</button></div></div>`;
    document.body.appendChild(d);
    const q = (k) => d.querySelector(`[data-k="${k}"]`);
    q("type").onchange = () => {
      const v = q("type").value, t = ALL.find((x) => x.code === v);
      q("otherL").hidden = v !== "__other";
      if (t) q("tas").value = t.tas;
      if (v === "__other") q("other").focus();
    };
    const close = () => { d.remove(); try { go(); } catch {} };
    d.addEventListener("click", (e) => { if (e.target === d) close(); });
    d.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    d.querySelector('[data-a="no"]').onclick = close;
    d.querySelector('[data-a="ok"]').onclick = () => {
      const v = q("type").value;
      const t = ALL.find((x) => x.code === v);
      const code = v === "__other" ? q("other").value.trim().toUpperCase() : v;
      if (!code) { try { toast("Pick a type"); } catch {} return; }
      let tail = q("tail").value.trim().toUpperCase().replace(/\s+/g, "");
      if (!tail) { tail = code; let i = 2; while ((S.profiles || {})[tail] && (S.profiles[tail].typeCode !== code)) tail = `${code} ${i++}`; }
      S.profiles = S.profiles || {};
      const p = (S.profiles[tail] = S.profiles[tail] || {});
      p.typeCode = code;
      if (t) { p.model = t.name; if (t.mil) p.mil = true; }
      else if (MILRE.test(code)) p.mil = true;
      const tas = num(q("tas").value); if (tas) p.tas = tas;
      if (f) { f.tail = tail; f.updated = Date.now(); }
      try { save(); } catch {}
      try { toast(`${tail} added`); } catch {}
      close();
    };
    setTimeout(() => q("type").focus(), 30);
  }
  // Take over the "Add aircraft…" choice in the Flights page aircraft list
  document.addEventListener("change", (e) => {
    const s = e.target;
    if (!s || s.id !== "tail" || s.value !== "__new") return;
    e.stopImmediatePropagation(); e.preventDefault();
    const f = curF();
    s.value = (f && f.tail) || "";
    addAircraft(f);
  }, true);

  // The aircraft list in Flights: show the type name with each aircraft
  function tailLabels() {
    const s = document.getElementById("tail");
    if (!s || s.dataset.lbl) return;
    s.dataset.lbl = "1";
    let all = {}; try { all = allAircraft(); } catch {}
    for (const o of s.options) {
      const a = all[o.value];
      if (!a) continue;
      const t = ALL.find((x) => x.code === a.typeCode);
      const name = a.model || (t && t.name) || "";
      if (name && !o.textContent.includes(name)) o.textContent = `${o.value}  ${name}${a.typeCode && !name.includes(a.typeCode) ? ` (${a.typeCode})` : ""}`;
    }
    const nw = [...s.options].find((o) => o.value === "__new");
    if (nw) nw.textContent = "Add aircraft or type…";
  }

  // Suggestion lists on free text type fields
  function datalists() {
    if (!document.getElementById("acTypesDL")) {
      const dl = document.createElement("datalist");
      dl.id = "acTypesDL";
      dl.innerHTML = ALL.map((t) => `<option value="${h(t.code)}">${h(t.name)}</option>`).join("");
      document.body.appendChild(dl);
    }
    if (!document.getElementById("crewDL")) {
      const dl = document.createElement("datalist");
      dl.id = "crewDL";
      dl.innerHTML = ["HAC, H2P, CC, AO", "HAC, H2P, CC", "HAC, H2P, CC, AO, AO", "PIC, SIC", "PIC, SIC, crew chief", "Pilot, WSO", "Instructor, student"].map((v) => `<option value="${h(v)}"></option>`).join("");
      document.body.appendChild(dl);
    }
    for (const i of document.querySelectorAll('#view input[placeholder="MV-22B"], #view input[placeholder="MV-22B, C172, F-35B"], #view input[placeholder="C172, R44, UH 60, MV 22"], #view input[data-ac][data-k="type"]')) if (!i.getAttribute("list")) i.setAttribute("list", "acTypesDL");
    for (const i of document.querySelectorAll('#view input[data-ac][data-k="crew"], #view input[placeholder="HAC, H2P, CC, AO"]')) if (!i.getAttribute("list")) i.setAttribute("list", "crewDL");
  }

  /* ---------------- Ask helper and training routes ---------------- */
  const MTR_TOK = /^(IR|VR|SR)(\d{1,4}[A-Z]?)$/;
  const SEG_TOK = /^[A-Z0-9]{1,2}-[A-Z0-9]{1,2}$/;
  const MTR_ONE = /^(IR|VR|SR)(\d{1,4}[A-Z]?)[\/ -]?([A-Z0-9]{1,2}-[A-Z0-9]{1,2})$/;
  const ALIAS = new Map(); // alias -> original text
  let seq = 0;
  const key = (kind, n) => `${kind}${String(n).replace(/^0+(?=\d)/, "")}`;
  function aliasRoute(route) {
    const t = String(route || "").toUpperCase().trim().split(/\s+/).filter(Boolean);
    const out = [], groups = [];
    for (let i = 0; i < t.length; i++) {
      let m = t[i].match(MTR_TOK), text = null, seg = null, k = null;
      if (m) { k = key(m[1], m[2]); text = t[i]; if (SEG_TOK.test(t[i + 1] || "")) { seg = t[i + 1]; text += " " + seg; i++; } }
      else if ((m = t[i].match(MTR_ONE))) { k = key(m[1], m[2]); text = t[i]; seg = m[3]; }
      if (!text) { out.push(t[i]); continue; }
      const a = "MZ" + (++seq).toString(36).toUpperCase().padStart(3, "0");
      ALIAS.set(a, text);
      groups.push({ a, k, text, entry: seg ? seg.split("-")[0] : null, exit: seg ? seg.split("-")[1] : null });
      out.push(a);
    }
    return { route: out.join(" "), groups };
  }
  const expand = (s) => String(s || "").replace(/\bMZ[0-9A-Z]{3}\b/g, (a) => ALIAS.get(a) || a);
  function rewrite(text, groups, notes) {
    return String(text).replace(/\b(IR|VR|SR)\s?-?(\d{1,4}[A-Z]?)(?:(?:\s+|\/|-)([A-Z]\d?)(?:\s*-\s*([A-Z]\d?))?)?\b/gi, (all, kind, n, p1, p2, off, str) => {
      const g = groups.find((x) => x.k === key(kind.toUpperCase(), n.toUpperCase()));
      if (!g) return all;
      const before = str.slice(0, off).toUpperCase();
      const w = (before.match(/\b(AFTER|BEFORE|BETWEEN|AND)\s*$/) || [])[1];
      const pt = p1 && !p2 ? p1.toUpperCase() : null;
      if (pt && g.exit && w === "AFTER" && pt !== g.exit) notes.push(`A point cannot go inside ${g.text}, so it goes after the exit at ${g.exit}.`);
      if (pt && g.entry && w === "BEFORE" && pt !== g.entry) notes.push(`A point cannot go inside ${g.text}, so it goes before the entry at ${g.entry}.`);
      return g.a;
    });
  }
  const PROC = /^[A-Z]{3,5}\d{1,2}[A-Z]?$/;
  function say(who, html, warn) {
    const log = document.getElementById("askLog");
    if (!log) return;
    const d = document.createElement("div");
    d.className = `m ${who}${warn ? " warn" : ""}`; d.innerHTML = html;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }
  let asking = false;
  async function askMtr(text) {
    const f = curF();
    const { route, groups } = aliasRoute(f.route);
    const notes = [];
    const t2 = rewrite(text, groups, notes);
    say("u", h(text));
    asking = true;
    const orig = f.route;
    let res = null;
    try {
      f.route = route;
      res = await AeroAsk.run(t2);
    } catch (e) { console.error(e); }
    const g = curF() || f;
    g.route = expand(g.route);
    if (!res) { g.route = orig; asking = false; say("a", "Something went wrong applying that. Nothing was changed.", true); return; }
    const warn = (res.warn || []).filter((w) => !/^These did not plot/.test(w)).map(expand);
    if (res.touched) {
      try {
        const r = await resolveRoute(g.route);
        if (r) { if (r.route) g.route = r.route; g.points = r.points || []; g.unresolved = r.unresolved || []; if (r.joins && r.joins.length) notes.push(r.joins.join(". ") + "."); }
        const bad = (g.unresolved || []).filter((u) => !PROC.test(String(u)));
        if (bad.length) warn.push(`These did not plot: ${bad.join(", ")}. Check the spelling, or use a coordinate like 3830N07700W.`);
      } catch { warn.push("The route could not be checked right now."); }
      g.updated = Date.now();
      try { save(); } catch {}
    }
    asking = false;
    const said = (res.said || []).map(expand).concat(notes);
    if (said.length && res.touched) say("a", `${said.map(h).join(" ")}<br>Route: <code>${h(g.route)}</code>`);
    if (warn.length) say("a", warn.map(h).join(" ") + (res.touched ? "" : ` Try something like "add 13NC after ${h((groups[0] || {}).text || "VR084")}" or type help.`), true);
    const ub = document.querySelector('#askPanel [data-a="undo"]'); if (ub && res.touched) ub.disabled = false;
    const ctx = document.querySelector("#askCtx code"); if (ctx) ctx.textContent = g.route;
    if (res.touched) {
      let view = null;
      try { if (typeof leafletMap !== "undefined" && leafletMap && /^#\/maps/.test(location.hash)) view = { c: leafletMap.getCenter(), z: leafletMap.getZoom() }; } catch {}
      try { go(); } catch {}
      if (view) setTimeout(() => { try { leafletMap.setView(view.c, view.z, { animate: false }); } catch {} }, 450);
    }
  }
  function wantMtr(text) {
    if (!text || /^\s*(undo|undo that|go back|revert|help|what can you do|\?)\s*[.!]?\s*$/i.test(text)) return false;
    if (/^#\/(missions|kneeboard)\//.test(location.hash || "")) return false;
    const f = curF();
    return !!(f && f.route && aliasRoute(f.route).groups.length);
  }
  const takeOver = (e) => {
    const inp = document.getElementById("askIn");
    if (!inp || asking) return;
    const text = inp.value.trim();
    if (!wantMtr(text)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    inp.value = "";
    askMtr(text);
  };
  document.addEventListener("submit", (e) => { if (e.target && e.target.id === "askForm") takeOver(e); }, true);
  document.addEventListener("keydown", (e) => { if (e.target && e.target.id === "askIn" && e.key === "Enter" && !e.shiftKey) takeOver(e); }, true);
  // An undo restores the route as it was saved during the edit; put the training route names back
  function unalias() {
    const f = curF();
    if (f && /\bMZ[0-9A-Z]{3}\b/.test(f.route || "")) { f.route = expand(f.route); try { save(); go(); } catch {} }
  }

  /* ---------------- load computation ---------------- */
  const V22 = { pub: true, basic: 33140, maxGross: 52600, seats: 24 };
  const ACF = [["basic", "Basic weight (lb)"], ["maxGross", "Max gross weight, this configuration (lb)"], ["seats", "Passenger seats"], ["burn", "Fuel burn (lb per hr)"], ["maxFuel", "Max fuel (lb)"]];
  function lcAircraft(tail, type) {
    S.profiles = S.profiles || {};
    const p = (S.profiles[tail] = S.profiles[tail] || {});
    if (!p.typeCode && type) p.typeCode = type;
    return p;
  }
  function calc(A, L, ete) {
    const g = (k, d) => { const v = num(L[k]); return v == null ? d : v; };
    const crew = g("crewN", 0) * g("crewWt", 220);
    const operating = (num(A.basic) || 0) + crew + g("equip", 0);
    const limit = Math.min(num(A.maxGross) || Infinity, num(L.maxToday) || Infinity);
    const fuel = g("fuel", 0), paxWt = g("paxWt", 240), pax = g("pax", 0), cargo = g("cargo", 0), ext = g("ext", 0);
    const payload = pax * paxWt + cargo + ext;
    const useful = limit - operating;
    const avail = limit - operating - fuel;
    const gross = operating + fuel + payload;
    const margin = limit - gross;
    const burn = num(A.burn) || 0, hrs = num(L.ete) != null ? num(L.ete) : ete || 0, res = g("resMin", 30);
    const need = burn ? burn * hrs + (burn * res) / 60 : null;
    const seats = num(A.seats);
    const paxFit = Math.max(0, Math.floor((avail - cargo - ext) / paxWt));
    const paxMore = Math.max(0, Math.min(seats != null ? seats - pax : Infinity, Math.floor(margin / paxWt)));
    const cargoMore = Math.max(0, margin);
    const ldg = gross - Math.min(fuel, burn * hrs);
    const probs = [];
    if (margin < 0) probs.push(`${lb(-margin)} lb over the limit`);
    if (seats != null && pax > seats) probs.push(`${pax - seats} more passengers than seats`);
    if (num(A.maxFuel) && fuel > num(A.maxFuel)) probs.push("More fuel than the tanks hold");
    if (need != null && fuel < need) probs.push(`${lb(need - fuel)} lb short of fuel needed`);
    return { operating, limit, useful, avail, gross, margin, fuel, payload, need, hrs, res, seats, paxFit: seats != null ? Math.min(seats, paxFit) : paxFit, paxMore, cargoMore, ldg, probs, burn, paxWt, pax, cargo, ext, ready: isFinite(limit) && num(A.basic) != null };
  }
  function lcHtml(A, L, r, typeName) {
    const inp = (k, label, v, ph) => `<label>${h(label)}<input type="number" inputmode="decimal" step="any" data-l="${k}" value="${v ?? ""}"${ph != null ? ` placeholder="${h(ph)}"` : ""}></label>`;
    const ainp = (k, label) => `<label>${h(label)}<input type="number" inputmode="decimal" step="any" data-a="${k}" value="${A[k] ?? ""}"></label>`;
    const src = !r.ready ? `Enter this aircraft's basic weight and max gross weight below once; they are saved with the aircraft.`
      : A.pub ? `Using publicly released ${h(typeName)} figures. <b class="warn">Replace the basic weight with this aircraft's from its weight and balance records.</b>` : `Using your numbers for this aircraft.`;
    const st = !r.ready ? "" : r.probs.length ? r.probs.map((p) => `<span class="pill bad">${h(p.toUpperCase())}</span>`).join("") : `<span class="pill ok">WITHIN LIMITS</span>`;
    const fit = !r.ready ? "" : r.margin >= 0
      ? `Room for <b>${r.paxMore}</b> more passenger${r.paxMore === 1 ? "" : "s"} at ${lb(r.paxWt)} lb${r.seats != null ? ` (${Math.max(0, r.seats - r.pax)} seats open)` : ""}, or <b>${lb(r.cargoMore)} lb</b> more cargo.`
      : `Take off <b>${lb(-r.margin)} lb</b>: about <b>${Math.ceil(-r.margin / r.paxWt)}</b> passenger${Math.ceil(-r.margin / r.paxWt) === 1 ? "" : "s"}, or that much cargo${r.need != null && r.fuel - r.need > 0 ? `, or up to ${lb(r.fuel - r.need)} lb of fuel above what you need` : ""}.`;
    return `<h2>Load computation</h2>
      <p class="lc-src">${src}</p>
      <div class="lc-grid">
        ${inp("crewN", "Crew", L.crewN)}${inp("crewWt", "Weight per crew member (lb)", L.crewWt, 220)}
        ${inp("equip", "Mission equipment (lb)", L.equip, 0)}${inp("fuel", "Fuel at takeoff (lb)", L.fuel)}
        ${inp("maxToday", "Max gross for today's conditions (lb)", L.maxToday, "Optional")}
        ${inp("pax", "Passengers", L.pax)}${inp("paxWt", "Weight per passenger with gear (lb)", L.paxWt, 240)}
        ${inp("cargo", "Internal cargo (lb)", L.cargo)}${inp("ext", "External load (lb)", L.ext)}
        ${inp("ete", "Flight time (hr)", L.ete, r.hrs ? r.hrs.toFixed(1) : "")}${inp("resMin", "Reserve (min)", L.resMin, 30)}
      </div>
      ${r.ready ? `<div class="lc-st">${st}</div><p class="fit">${fit}</p>
      <table>
        <tr><td>Basic weight</td><td class="n">${lb(num(A.basic))} lb</td></tr>
        <tr><td>Operating weight (basic, crew, equipment)</td><td class="n">${lb(r.operating)} lb</td></tr>
        <tr><td>Gross weight limit${num(L.maxToday) && num(L.maxToday) < (num(A.maxGross) || Infinity) ? ", today's conditions" : ""}</td><td class="n">${lb(r.limit)} lb</td></tr>
        <tr class="big"><td>Useful load (fuel and payload)</td><td class="n">${lb(r.useful)} lb</td></tr>
        <tr><td>Fuel</td><td class="n">${lb(r.fuel)} lb</td></tr>
        <tr class="big"><td>Payload available with this fuel</td><td class="n">${lb(Math.max(0, r.avail))} lb</td></tr>
        <tr><td>Planned payload (${r.pax} passengers, ${lb(r.cargo)} lb cargo${r.ext ? `, ${lb(r.ext)} lb external` : ""})</td><td class="n">${lb(r.payload)} lb</td></tr>
        <tr class="big"><td>Takeoff gross weight</td><td class="n ${r.margin < 0 ? "bad" : "ok"}">${lb(r.gross)} lb</td></tr>
        <tr><td>${r.margin < 0 ? "Over the limit by" : "Margin below the limit"}</td><td class="n ${r.margin < 0 ? "bad" : "ok"}">${lb(Math.abs(r.margin))} lb</td></tr>
        <tr><td>Most passengers with this fuel${r.cargo || r.ext ? " and cargo" : ""}</td><td class="n">${r.paxFit}</td></tr>
        ${r.need != null ? `<tr><td>Fuel needed, ${r.hrs.toFixed(1)} hr plus ${r.res} min reserve</td><td class="n ${r.fuel < r.need ? "bad" : ""}">${lb(r.need)} lb</td></tr>
        <tr><td>Payload available with only the fuel needed</td><td class="n">${lb(Math.max(0, r.limit - r.operating - r.need))} lb</td></tr>
        <tr><td>Landing weight</td><td class="n">${lb(r.ldg)} lb</td></tr>` : `<tr><td colspan="2" class="small muted">Add the fuel burn below to see fuel needed and landing weight.</td></tr>`}
      </table>` : ""}
      <details${r.ready ? "" : " open"}><summary>${r.ready ? "Edit aircraft numbers" : "Aircraft numbers"}</summary>
        <div class="lc-grid">${ACF.map(([k, l]) => ainp(k, l)).join("")}</div>
        <div class="acts"><button type="button" class="btn sm" data-x="save">Save aircraft numbers</button>${/V-?22|^V22$/i.test(typeName) ? `<button type="button" class="btn sec sm" data-x="v22">Start from public MV-22B figures</button>` : ""}</div>
        <p class="small muted" style="margin:0 0 10px">Leave max gross for today blank to use the aircraft limit. Public MV-22B figures: empty weight about 33,140 lb, max vertical takeoff weight 52,600 lb, 24 troop seats. This app does not compute aircraft performance; enter today's limit from your own performance planning.</p>
      </details>
      <p class="disc">Planning aid only. Use this aircraft's basic weight from its weight and balance records and today's performance planning from the approved flight manual. Do not enter CUI or classified information.</p>`;
  }
  function mount(sec, A, L, ete, typeName, onChange) {
    const paint = () => {
      const r = calc(A, L, ete);
      const act = document.activeElement, which = act && sec.contains(act) ? (act.dataset.l ? `[data-l="${act.dataset.l}"]` : act.dataset.a ? `[data-a="${act.dataset.a}"]` : null) : null;
      const pos = act && which ? act.selectionStart : null;
      const open = sec.querySelector("details") ? sec.querySelector("details").open : null;
      sec.innerHTML = lcHtml(A, L, r, typeName);
      if (open != null && sec.querySelector("details")) sec.querySelector("details").open = open || !r.ready;
      if (which) { const el = sec.querySelector(which); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch {} } }
      sec.querySelectorAll("input[data-l]").forEach((i) => (i.oninput = () => { const v = num(i.value); if (v == null) delete L[i.dataset.l]; else L[i.dataset.l] = Math.max(0, v); onChange(); paint(); }));
      sec.querySelectorAll("button[data-x]").forEach((b) => (b.onclick = () => {
        if (b.dataset.x === "v22") Object.assign(A, V22);
        else {
          sec.querySelectorAll("input[data-a]").forEach((i) => { const v = num(i.value); if (v == null) delete A[i.dataset.a]; else A[i.dataset.a] = v; });
          if (A.pub && A.basic !== V22.basic) delete A.pub;
          if (num(A.basic) == null || num(A.maxGross) == null) { try { toast("Enter at least the basic weight and the max gross weight"); } catch {} return; }
        }
        onChange(); try { toast("Aircraft numbers saved"); } catch {} paint();
      }));
      // number inputs: typing must not lose focus; paint keeps it
      return r;
    };
    return paint();
  }
  function lcSummary(A, L, ete) {
    const r = calc(A, L, ete);
    if (!r.ready) return { k: "none", t: "Set up the aircraft numbers in Load computation" };
    if (!(num(L.fuel) > 0)) return { k: "none", t: "Enter fuel and load in Load computation" };
    return { k: r.probs.length ? "bad" : A.pub ? "warn" : "ok", r };
  }

  // Flight brief for a military aircraft
  function flightLc(page, f) {
    const mil = isMil(f.tail);
    document.body.classList.toggle("mil-ac", mil);
    const old = page.querySelector("#lcPanel");
    if (!mil) { if (old) old.remove(); return; }
    let a = {}; try { a = allAircraft()[f.tail] || {}; } catch {}
    const p = lcAircraft(f.tail, a.typeCode);
    const A = (p.lc = p.lc || {}), L = (f.lc = f.lc || {});
    let ete = 0; try { ete = profile(f).ete || 0; } catch {}
    const sig = `${f.id}|${f.tail}`;
    let sec = old;
    if (!sec || sec.dataset.sig !== sig) {
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "lcPanel"; }
      sec.dataset.sig = sig;
      mount(sec, A, L, ete, a.model || a.typeCode || "", () => { f.updated = Date.now(); try { save(); } catch {} bluf(page, A, L, ete); hints(A, L, ete); });
    }
    // Sits just ahead of the weight and fuel panel (hidden for military aircraft) and the checklist
    const wb = page.querySelector(":scope > #wbPanel"), go_ = page.querySelector(":scope > #goPanel");
    const anchor = wb || go_;
    if (anchor) { if (sec.nextElementSibling !== anchor && !(wb && sec.nextElementSibling === go_ && !wb.isConnected)) anchor.before(sec); }
    else if (!sec.isConnected) { const an = page.querySelector(":scope > #dbPanel") || page.querySelector(":scope > #bbody"); if (an) an.after(sec); else page.appendChild(sec); }
    bluf(page, A, L, ete); hints(A, L, ete);
    const j = page.querySelector("#bfJump");
    if (j && !j.querySelector('[data-s="#lcPanel"]')) {
      const c = document.createElement("a");
      c.href = "#"; c.dataset.s = "#lcPanel"; c.textContent = "Load";
      c.onclick = (e) => { e.preventDefault(); const s = document.getElementById("lcPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
      const ck = j.querySelector('[data-s="#goPanel"]'); if (ck) ck.before(c); else j.appendChild(c);
    }
  }
  function bluf(page, A, L, ete) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    const s = lcSummary(A, L, ete);
    const html = !s.r ? `Load: <span class="mut">${h(s.t)}</span>`
      : s.r.probs.length ? `Load: <b class="bad">CHECK</b> ${h(s.r.probs[0])}`
      : `Load: <b class="${s.k}">OK</b> ${lb(s.r.gross)} of ${lb(s.r.limit)} lb, room for ${s.r.paxMore} more passenger${s.r.paxMore === 1 ? "" : "s"}${s.r.need != null ? `  ·  Fuel: ${lb(s.r.fuel)} lb, ${lb(s.r.need)} needed` : ""}`;
    let el = card.querySelector(".bf-lc");
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-lc"; const after = card.querySelector(".bf-nt") || card.querySelector(".bf-wx") || card.querySelector(".k"); if (after) after.after(el); else card.prepend(el); }
    el.dataset.v = html; el.innerHTML = html;
  }
  function hints(A, L, ete) {
    const s = lcSummary(A, L, ete);
    for (const [k, txt] of [
      ["acft", !s.r ? ["", s.t] : s.r.probs.filter((p) => !/fuel/.test(p)).length ? ["bad", s.r.probs.filter((p) => !/fuel/.test(p))[0]] : [s.k, `Load within limits: ${lb(s.r.gross)} lb`]],
      ["fuel", !s.r ? ["", s.t] : s.r.need == null ? ["", "Add the fuel burn in Load computation to check fuel"] : s.r.fuel < s.r.need ? ["bad", `${lb(s.r.need - s.r.fuel)} lb short of fuel needed`] : ["ok", `${lb(s.r.fuel)} lb on board, ${lb(s.r.need)} needed with reserve`]],
    ]) {
      const lab = document.querySelector(`#goPanel label[for="go_${k}"]`);
      if (!lab) continue;
      const html = `<span class="${txt[0]}">${h(txt[1])}</span>`;
      let el = lab.querySelector(".lcst");
      if (el && el.dataset.v === html) continue;
      if (!el) { el = document.createElement("span"); el.className = "lcst"; lab.appendChild(el); }
      el.dataset.v = html; el.innerHTML = html;
    }
  }

  // Mission brief: one load computation per aircraft in the mission
  function missionLc(page, m) {
    const ac = (m.aircraft || []).filter((a) => a && (a.type || a.callsign));
    if (!ac.length) return;
    let sec = page.querySelector("#lcPanel");
    m.lcSel = m.lcSel && ac.some((a) => a.id === m.lcSel) ? m.lcSel : ac[0].id;
    const a = ac.find((x) => x.id === m.lcSel);
    const sig = `${m.id}|${a.id}|${a.type}|${ac.length}`;
    if (sec && sec.dataset.sig === sig) return;
    if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "lcPanel"; }
    sec.dataset.sig = sig;
    const tailKey = a.bureau ? String(a.bureau).toUpperCase() : `${(a.type || "AIRCRAFT").toUpperCase()}`;
    const p = lcAircraft(tailKey, a.type);
    if (!p.mil) p.mil = true;
    const A = (p.lc = p.lc || {});
    m.lc = m.lc || {};
    const L = (m.lc[a.id] = m.lc[a.id] || {});
    const save_ = () => { m.updated = Date.now(); try { save(); } catch {} };
    const wrap = document.createElement("div");
    mount(wrap, A, L, 0, a.type || "", save_);
    const pick = ac.length > 1 ? `<label style="display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--ink2,#9fb0c8);max-width:320px;margin:0 0 10px;text-transform:none;letter-spacing:normal">Aircraft<select data-k="pick">${ac.map((x) => `<option value="${h(x.id)}"${x.id === a.id ? " selected" : ""}>${h([x.callsign, x.type, x.bureau].filter(Boolean).join("  "))}</option>`).join("")}</select></label>` : "";
    sec.innerHTML = "";
    sec.appendChild(wrap);
    if (pick) { const t = document.createElement("div"); t.innerHTML = pick; wrap.querySelector("h2").after(t.firstChild); }
    const sel = sec.querySelector('select[data-k="pick"]');
    if (sel) sel.onchange = () => { m.lcSel = sel.value; save_(); sec.dataset.sig = ""; missionLc(page, m); };
    // keep the select after repaints
    new MutationObserver(() => { if (pick && !sec.querySelector('select[data-k="pick"]') && wrap.querySelector("h2")) { const t = document.createElement("div"); t.innerHTML = pick; wrap.querySelector("h2").after(t.firstChild); const s2 = sec.querySelector('select[data-k="pick"]'); s2.onchange = sel.onchange; } }).observe(wrap, { childList: true });
    if (!sec.isConnected) {
      const rc = page.querySelector("#routecheck") || page.querySelector("section.panel");
      if (rc) rc.after(sec); else page.appendChild(sec);
    }
  }

  /* ---------------- wiring ---------------- */
  let busy = false, t = 0;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      unalias();
      datalists();
      if (on(/^#\/flights(\/|$|\?)/)) tailLabels();
      const page = document.querySelector("#view .page");
      if (on(/^#\/brief(\/|$|\?)/)) {
        const f = curF();
        if (page && f && !f.missionId && (f.points || []).length && page.querySelector(":scope > h1") && !page.querySelector("#offSnap")) flightLc(page, f);
      } else document.body.classList.remove("mil-ac");
      const mm = (location.hash || "").match(/^#\/missions\/([^/]+)\/brief/);
      if (mm && page && typeof getMission === "function") { const m = getMission(mm[1]); if (m) missionLc(page, m); }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 220); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#lcPanel, #bfBluf .bf-lc, #goPanel .lcst"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  document.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest('#askPanel [data-a="undo"]')) setTimeout(unalias, 60); });
  kick();
  window.AeroMilFlight = { TYPES, ALL, isMil, addAircraft, aliasRoute, rewrite, calc };
})();
