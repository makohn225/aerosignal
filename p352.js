"use strict";
/* p352: Copy pad (November 16, 2026, scheduled competitive upgrade). ForeFlight scratchpads and the new
   FltPlan Go CRAFT and ATIS templates let a pilot copy the ATIS and a clearance on the device. AeroSignal only
   had empty boxes on the printed packet and kneeboard. The Copy pad is a full screen sheet that opens over any
   page (so opening it on the Fly screen never stops GPS or the track recorder), with:
   - ATIS for each route airport (departure, destination, alternate): letter, time, wind, visibility, sky,
     temperature and dew point, altimeter, runway, notes. As you type it works out the headwind and crosswind
     on the runway you copied (runway data from airport_detail, wind as copied, so magnetic), density altitude,
     flags an altimeter more than 0.03 in from the latest METAR or outside 28.00 to 31.50, flags a crosswind
     over the limit set in Runway winds (S.rwPrefs.xw), says when the copy is over an hour old, and gives the
     "with information" call. The latest METAR shows as the placeholder so the pilot sees what to expect.
   - Clearance in CRAFT order with a Cleared as filed button, checks on the squawk (four digits 0 to 7, the
     emergency codes), the frequency (118.000 to 136.975), a limit short of the destination and an altitude
     above the planned cruise, plus the readback written out and read aloud with the device voice.
   - A scribble pad (finger or stylus; saved on this device only, last five flights) and a notes box.
   Typed copies are saved on the flight as f.pad. Entry points: a Copy pad button on the Fly screen row, an
   optional Fly card (#cpFly, registered in p264's CARDS) with the current ATIS letter, altimeter, runway and
   squawk, a button on the Flight plan sheet's handoff row, and #/pad. Loads at the end of the list; nothing
   here needs to load early. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = Math.PI / 180;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const ICAO = { A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "Xray", Y: "Yankee", Z: "Zulu" };
  const DIG = ["zero", "one", "two", "tree", "four", "fife", "six", "seven", "eight", "niner"];
  const css = document.createElement("style");
  css.textContent = `
    #cpOver{position:fixed;inset:0;z-index:9000;background:var(--bg,#0b1220);color:var(--ink,#EAF2FF);overflow-y:auto;-webkit-overflow-scrolling:touch}
    #cpOver .cp-in,.page.cp-page .cp-in{max-width:880px;margin:0 auto;padding:12px 16px 90px}
    .cp-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;position:sticky;top:0;background:var(--bg,#0b1220);padding:6px 0 8px;z-index:2;border-bottom:1px solid var(--line2,rgba(255,255,255,.1))}
    #cpOver .cp-top{margin:-12px -16px 10px;padding:10px 16px}
    .cp-top h1{font-size:20px;margin:0}
    .cp-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
    .cp-tabs button{appearance:none;border:1px solid var(--line2,rgba(255,255,255,.2));background:transparent;color:inherit;border-radius:999px;padding:8px 14px;min-height:40px;font:600 14px inherit;cursor:pointer}
    .cp-tabs button[aria-pressed="true"]{background:var(--amber,#ffb648);color:#111;border-color:var(--amber,#ffb648)}
    .cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 10px}
    .cp-grid label,.cp-craft label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--ink2,#9fb0c8);min-width:0}
    .cp-grid input,.cp-craft input,.cp-notes{background:transparent;color:var(--ink,#EAF2FF);border:1px solid var(--line2,rgba(255,255,255,.2));border-radius:8px;padding:9px 10px;font:16px var(--mono,monospace);min-width:0;width:100%;box-sizing:border-box;text-transform:uppercase}
    .cp-notes{text-transform:none;font-family:inherit;min-height:110px;resize:vertical}
    .cp-grid input::placeholder,.cp-craft input::placeholder{color:var(--ink2,#9fb0c8);opacity:.55}
    .cp-craft{display:grid;grid-template-columns:34px 1fr;gap:8px 10px;align-items:end}
    .cp-craft b{font:800 22px var(--mono,monospace);color:var(--amber,#ffb648);text-align:center;padding-bottom:8px}
    .cp-chk{list-style:none;margin:10px 0 0;padding:0;font-size:14px;line-height:1.5}
    .cp-chk li{padding:4px 0;border-top:1px solid var(--line2,rgba(255,255,255,.07))}
    .cp-chk li:first-child{border-top:0}
    .cp-chk .ok{color:#46e39b;font-weight:700}.cp-chk .warn{color:#ffb648;font-weight:700}.cp-chk .bad{color:#ff4d6a;font-weight:700}
    .cp-say{font:15px var(--mono,monospace);border:1px dashed var(--line2,rgba(255,255,255,.25));border-radius:10px;padding:10px 12px;margin:10px 0;word-break:break-word}
    .cp-ap{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
    .cp-draw{position:relative;border:1px solid var(--line2,rgba(255,255,255,.2));border-radius:12px;overflow:hidden;background:rgba(255,255,255,.02)}
    .cp-draw canvas{display:block;width:100%;height:min(62vh,520px);touch-action:none;cursor:crosshair}
    .cp-tools{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
    .cp-disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:14px 0 0}
    .cp-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
    #cpFly{border:2px solid var(--line2,rgba(255,255,255,.2));border-radius:14px;padding:10px 14px;margin:0 0 14px;font-size:15px;line-height:1.45}
    #cpFly .cp-h{font-weight:700;font-size:13px;letter-spacing:.5px;text-transform:uppercase;opacity:.85;margin-bottom:2px}
    #cpFly .cp-n{font:700 18px var(--mono,monospace)}`;
  document.head.appendChild(css);

  const FIELDS = [["info", "Information", "B"], ["time", "Time (Z)", "1453"], ["wind", "Wind", "27010G18"], ["vis", "Visibility (sm)", "10"], ["sky", "Sky", "BKN045"], ["td", "Temp / dew (C)", "18/09"], ["alt", "Altimeter", "30.02"], ["rwy", "Runway", "27"], ["note", "Notes", "Taxiway A closed"]];
  const CRAFT = [["c", "C", "Clearance limit"], ["r", "R", "Route"], ["a", "A", "Altitude, and expect"], ["fq", "F", "Departure frequency"], ["t", "T", "Transponder"]];

  function flight() { try { return currentFlight(); } catch (e) { return null; } }
  function airports(f) {
    const P = (f && f.points) || [], out = [];
    const id = (p) => String((p && p.ident) || "").toUpperCase();
    const dep = P[0], dst = P[P.length - 1];
    if (dep && (dep.kind === "airport" || /^[A-Z]{4}$/.test(id(dep)))) out.push({ code: id(dep), role: "Departure" });
    if (dst && id(dst) !== id(dep) && (dst.kind === "airport" || /^[A-Z]{4}$/.test(id(dst)))) out.push({ code: id(dst), role: "Destination" });
    let alt = String((f && f.alternate) || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (alt.length === 3) alt = "K" + alt;
    if (alt && !out.some((x) => x.code === alt)) out.push({ code: alt, role: "Alternate" });
    return out;
  }
  function pad(f) { if (!f.pad || typeof f.pad !== "object") f.pad = {}; f.pad.atis = f.pad.atis || {}; f.pad.craft = f.pad.craft || {}; return f.pad; }
  let saveT = 0;
  const persist = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { save(); } catch (e) {} }, 500); };

  // Reference data: latest METAR and runways, cached per airport for 10 minutes
  const ref = new Map();
  function load(code) {
    const c = ref.get(code);
    if (c && Date.now() - c.at < 6e5) return c.p;
    const p = Promise.all([
      fnGet(`wx?ids=${encodeURIComponent(code)}`).then((j) => { const m = ((j && j.metar) || []).find((x) => x.station === code) || ((j && j.metar) || [])[0]; return m && m.raw ? (typeof parseMetar === "function" ? parseMetar(String(m.raw), new Date()) : null) || { raw: m.raw } : null; }).catch(() => null),
      rpc("airport_detail", { code }).catch(() => null)
    ]).then(([metar, ap]) => ({ metar, ap }));
    ref.set(code, { at: Date.now(), p });
    return p;
  }

  // Parsing what was copied
  function parseWind(s) {
    const t = String(s || "").toUpperCase().replace(/\s|KT/g, "");
    if (/^CALM$|^0{5}$/.test(t)) return { calm: true, dir: 0, spd: 0, g: 0 };
    let m = /^(\d{3}|VRB)(?:@|\/)?(\d{1,3})(?:G(\d{1,3}))?$/.exec(t);
    if (!m) return null;
    return { vrb: m[1] === "VRB", dir: m[1] === "VRB" ? null : +m[1] % 360, spd: +m[2], g: m[3] ? +m[3] : 0 };
  }
  function parseAlt(s) {
    const t = String(s || "").replace(/[^\d.]/g, "");
    if (!t) return null;
    let v = t.includes(".") ? +t : /^\d{4}$/.test(t) ? +t / 100 : NaN;
    if (/^\d{3}$/.test(t)) v = NaN;
    return isFinite(v) ? v : null;
  }
  function parseTd(s) { const m = /^(M|-)?(\d{1,2})(?:\s*\/\s*(M|-)?(\d{1,2}))?$/i.exec(String(s || "").trim()); return m ? { t: (m[1] ? -1 : 1) * +m[2], d: m[4] != null ? (m[3] ? -1 : 1) * +m[4] : null } : null; }
  function ends(ap) {
    const out = [];
    for (const r of (ap && ap.runways) || []) for (const [id, hd] of [[r.le_ident, r.le_heading], [r.he_ident, r.he_heading]]) {
      if (!id || /^H/i.test(id)) continue;
      const n = parseInt(id, 10); if (!isFinite(n)) continue;
      // Runway numbers are magnetic, like a wind on the ATIS, so use the number for the components
      out.push({ id: String(id).toUpperCase(), hdg: (n * 10) % 360 || 360, len: +r.length_ft || 0, trueHdg: hd != null ? +hd : null });
    }
    return out;
  }

  function atisChecks(code, a, info) {
    const L = [], ap = info && info.ap, m = info && info.metar;
    const w = parseWind(a.wind), alt = parseAlt(a.alt), td = parseTd(a.td);
    const E = ends(ap), xw = +(S.rwPrefs && S.rwPrefs.xw) || 0;
    const rw = String(a.rwy || "").toUpperCase().match(/\d{1,2}[LCR]?/g) || [];
    if (a.wind && !w) L.push(["warn", "Wind not read. Write it as 270 10, 27010 or 27010G18."]);
    if (w && rw.length && E.length) {
      for (const id of rw.slice(0, 3)) {
        const e = E.find((x) => x.id === id.padStart(2, "0") || x.id === id || x.id.replace(/^0/, "") === id.replace(/^0/, ""));
        if (!e) { L.push(["warn", `Runway ${h(id)} is not in the runway list for ${h(code)}. Check you copied it right.`]); continue; }
        if (w.calm) { L.push(["ok", `Runway ${h(e.id)}: wind calm.`]); continue; }
        if (w.vrb) { L.push([xw && Math.max(w.spd, w.g) > xw ? "warn" : "ok", `Runway ${h(e.id)}: variable wind, plan for up to ${fmt(Math.max(w.spd, w.g))} kt from any side.`]); continue; }
        const k = (s) => ({ hd: s * Math.cos((w.dir - e.hdg) * R), x: s * Math.sin((w.dir - e.hdg) * R) });
        const c = k(w.spd), g = w.g ? k(w.g) : c, gx = Math.ceil(Math.abs(g.x) - 0.05);
        const head = c.hd >= 0 ? `${fmt(Math.ceil(c.hd))} kt headwind` : `<b class="warn">${fmt(Math.ceil(-c.hd))} kt tailwind</b>`;
        const cx = Math.ceil(Math.abs(c.x) - 0.05), side = (c.x || g.x) >= 0 ? "right" : "left";
        const cross = cx || gx ? `${fmt(cx)} kt crosswind from the ${side}${w.g && gx > cx ? `, ${fmt(gx)} kt in gusts` : ""}` : "no crosswind";
        const over = xw && gx > xw;
        L.push([over || c.hd < -2 ? "warn" : "ok", `Runway ${h(e.id)}${e.len ? ` (${fmt(e.len)} ft)` : ""}: ${head}, ${cross}.${over ? ` Over your ${fmt(xw)} kt limit.` : ""}`]);
      }
    } else if (w && !rw.length && E.length && !w.calm && !w.vrb) {
      const best = E.map((e) => ({ e, hd: w.spd * Math.cos((w.dir - e.hdg) * R) })).sort((x, y) => y.hd - x.hd)[0];
      if (best) L.push(["", `Most into the wind: runway ${h(best.e.id)}. Type the runway in use for the components.`]);
    }
    if (a.alt) {
      if (alt == null) L.push(["warn", "Altimeter not read. Write it as 30.02 or 3002."]);
      else if (alt < 28 || alt > 31.5) L.push(["bad", `Altimeter ${alt.toFixed(2)} is outside 28.00 to 31.50. Check you copied it right.`]);
      else if (m && m.alt && Math.abs(m.alt - alt) > 0.03) L.push(["warn", `Altimeter ${alt.toFixed(2)} differs from the latest METAR (${m.alt.toFixed(2)}). Check it, or listen for a newer ATIS.`]);
      else if (m && m.alt) L.push(["ok", `Altimeter ${alt.toFixed(2)} matches the latest METAR.`]);
    }
    const elev = ap && ap.airport ? +ap.airport.elev_ft : NaN;
    if (td && alt && isFinite(elev)) {
      const pa = elev + (29.92 - alt) * 1000, da = pa + 118.8 * (td.t - (15 - (2 * elev) / 1000));
      const dr = Math.ceil(da / 100) * 100;
      L.push([da - elev > 2000 ? "warn" : "", `Density altitude about ${dr < 0 ? `${fmt(-dr)} ft below sea level` : `${fmt(dr)} ft`} (field ${fmt(elev)} ft).${da - elev > 2000 ? " Expect longer takeoff and a slower climb." : ""}`]);
    }
    if (td && td.d != null && td.t - td.d <= 3) L.push(["warn", `Temperature and dew point within ${fmt(td.t - td.d)} C: fog or low cloud can form.`]);
    if (a.at && Date.now() - a.at > 36e5) L.push(["warn", `Copied ${fmt((Date.now() - a.at) / 6e4)} minutes ago. ATIS usually updates every hour; listen for a new letter.`]);
    const ltr = String(a.info || "").trim().toUpperCase().slice(0, 1);
    if (ICAO[ltr]) L.push(["", `Call up with: <b>"with information ${ICAO[ltr]}"</b>.`]);
    return L;
  }

  function craftChecks(f, c) {
    const L = [];
    const sq = String(c.t || "").replace(/\D/g, "");
    if (c.t) {
      if (!/^[0-7]{4}$/.test(sq)) L.push(["bad", "A squawk is four digits, each 0 to 7. Check it with ATC."]);
      else if (sq === "7500" || sq === "7600" || sq === "7700") L.push(["bad", `${sq} is an emergency code. Confirm it with ATC.`]);
      else if (sq === "1200") L.push(["warn", "1200 is the VFR code. An IFR clearance normally gives a discrete code."]);
      else L.push(["ok", `Squawk ${sq}.`]);
    }
    if (c.fq) {
      const n = parseFloat(String(c.fq).replace(/[^\d.]/g, ""));
      if (!(n >= 118 && n <= 136.975)) L.push(["warn", "Frequency is outside the 118.000 to 136.975 airband. Check it."]);
    }
    const A = airports(f), dst = A.find((x) => x.role === "Destination");
    if (c.c && dst) {
      const v = String(c.c).toUpperCase().replace(/[^A-Z0-9]/g, "");
      const ok = v.includes(dst.code) || v.includes(dst.code.replace(/^K/, "")) || /DESTINATION/.test(String(c.c).toUpperCase());
      if (!ok) L.push(["warn", `The clearance limit is not ${h(dst.code)}. Know what to do on reaching it and expect further clearance before you get there.`]);
    }
    if (c.a) {
      const nums = (String(c.a).toUpperCase().replace(/,/g, "").match(/\d+/g) || []).map((x) => +x).map((x) => (x < 600 ? x * 100 : x));
      let cruise = 0; try { cruise = window.AeroWinds && AeroWinds.altOf ? Number(AeroWinds.altOf(f)) || 0 : 0; } catch (e) {}
      const top = Math.max(0, ...nums);
      if (cruise && top > cruise + 500) L.push(["warn", `${fmt(top)} ft is above your planned ${fmt(cruise)} ft. Check oxygen, fuel and winds for that altitude.`]);
    }
    return L;
  }
  function readback(f, c) {
    const bits = [];
    if (c.c) bits.push(`cleared to ${c.c}`);
    if (c.r) bits.push(/as filed/i.test(c.r) ? "as filed" : `via ${c.r}`);
    if (c.a) bits.push(`climb and maintain ${c.a}`);
    if (c.fq) bits.push(`departure ${c.fq}`);
    if (c.t) bits.push(`squawk ${c.t}`);
    if (bits.length) bits[0] = bits[0][0].toUpperCase() + bits[0].slice(1);
    return bits.length ? `${bits.join(", ")}, ${String((f && f.tail) || "callsign").toUpperCase()}.` : "";
  }
  function speakable(s) { return String(s).replace(/\d/g, (d) => ` ${DIG[+d]} `).replace(/\./g, " point ").replace(/\s+/g, " "); }

  const list = (L) => (L.length ? `<ul class="cp-chk">${L.map(([c, t]) => `<li>${c ? `<span class="${c}">${c === "ok" ? "OK" : c === "warn" ? "CHECK" : "STOP"}</span> ` : ""}${t}</li>`).join("")}</ul>` : "");

  // Scribble pad: kept on this device only (images are large for account sync)
  const DKEY = "vg_pad_draw";
  function drawStore() { try { return JSON.parse(localStorage.getItem(DKEY) || "{}") || {}; } catch (e) { return {}; } }
  function drawSave(id, data) {
    try {
      const d = drawStore();
      if (data) d[id] = { at: Date.now(), img: data }; else delete d[id];
      const keys = Object.keys(d).sort((a, b) => d[b].at - d[a].at);
      for (const k of keys.slice(5)) delete d[k];
      localStorage.setItem(DKEY, JSON.stringify(d));
    } catch (e) { if (typeof toast === "function") toast("Could not save the drawing on this device"); }
  }

  const state = { tab: "atis", ap: null };
  function render(root) {
    const f = flight();
    const box = root.querySelector(".cp-body");
    if (!f) { box.innerHTML = `<p>Plan a flight first. The copy pad keeps the ATIS and clearance with the flight.</p><p><a class="btn" href="#/plan">Plan a flight</a></p>`; return; }
    const P = pad(f), A = airports(f);
    if (!state.ap || !A.some((x) => x.code === state.ap)) state.ap = (A[0] || {}).code || null;
    root.querySelectorAll(".cp-tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === state.tab)));
    if (state.tab === "atis") {
      if (!A.length) { box.innerHTML = `<p class="muted">No airports on this route. Add a departure or destination airport.</p>`; return; }
      const a = P.atis[state.ap] || {};
      box.innerHTML = `<div class="cp-ap">${A.map((x) => `<button type="button" class="btn ${x.code === state.ap ? "" : "sec "}sm" data-ap="${h(x.code)}">${h(x.role)} ${h(x.code)}${P.atis[x.code] && P.atis[x.code].info ? ` (${h(String(P.atis[x.code].info).toUpperCase())})` : ""}</button>`).join("")}</div>
        <div class="cp-grid">${FIELDS.map(([k, l, ph]) => `<label>${l}<input data-k="${k}" value="${h(a[k] || "")}" placeholder="${h(ph)}" autocomplete="off" autocapitalize="characters" spellcheck="false" ${k === "alt" ? 'inputmode="decimal"' : k === "time" ? 'inputmode="numeric"' : ""}></label>`).join("")}</div>
        <p class="small muted cp-mx" style="margin:8px 0 0"></p>
        <div class="cp-out"></div>
        <div class="cp-row"><button type="button" class="btn sec sm cp-clr">Clear this ATIS</button></div>`;
      box.querySelectorAll("[data-ap]").forEach((b) => b.onclick = () => { state.ap = b.dataset.ap; render(root); });
      const code = state.ap;
      const upd = (info) => {
        const cur = P.atis[code] || {};
        box.querySelector(".cp-out").innerHTML = list(atisChecks(code, cur, info));
        const m = info && info.metar;
        const mx = box.querySelector(".cp-mx");
        if (mx) mx.textContent = m && m.raw ? `Latest METAR: ${m.raw}` : info ? "No METAR found for this airport." : "Loading the latest METAR and runways…";
        if (m) {
          const ph = { wind: m.dir != null ? `${m.dir}${String(m.wind).padStart(2, "0")}${m.gust ? "G" + m.gust : ""}` : "", vis: m.vis != null ? String(m.vis > 6 ? 10 : +m.vis.toFixed(2)) : "", alt: m.alt ? m.alt.toFixed(2) : "", td: m.temp != null ? `${m.temp}/${m.dew ?? ""}` : "", sky: (m.clouds || []).map((c) => c[0] + String(c[1] / 100).padStart(3, "0")).join(" ") || (m.clear ? "CLR" : "") };
          for (const [k, v] of Object.entries(ph)) { const i = box.querySelector(`input[data-k="${k}"]`); if (i && v) i.placeholder = v; }
        }
      };
      let info = null; upd(null);
      load(code).then((x) => { info = x; if (state.ap === code && box.isConnected) upd(info); });
      box.querySelectorAll("input[data-k]").forEach((i) => i.oninput = () => {
        const cur = P.atis[code] = P.atis[code] || {};
        cur[i.dataset.k] = i.value.trim();
        if (i.dataset.k === "info" || !cur.at) cur.at = Date.now();
        persist(); upd(info); fly();
      });
      box.querySelector(".cp-clr").onclick = () => { delete P.atis[code]; persist(); render(root); fly(); };
    } else if (state.tab === "craft") {
      const c = P.craft;
      box.innerHTML = `<div class="cp-craft">${CRAFT.map(([k, b, l]) => `<b>${b}</b><label>${l}<input data-k="${k}" value="${h(c[k] || "")}" autocomplete="off" autocapitalize="characters" spellcheck="false" ${k === "t" ? 'inputmode="numeric"' : k === "fq" ? 'inputmode="decimal"' : ""}></label>`).join("")}</div>
        <div class="cp-row"><button type="button" class="btn sec sm cp-filed">Cleared as filed</button><button type="button" class="btn sec sm cp-say-b">Read the readback aloud</button><button type="button" class="btn sec sm cp-clr">Clear</button>${typeof ROUTES !== "undefined" && ROUTES.clearance ? `<a class="btn sec sm cp-prac" href="#/clearance">Practice copying</a>` : ""}</div>
        <div class="cp-say" aria-live="polite"></div><div class="cp-out"></div>`;
      const upd = () => { const t = readback(f, c); box.querySelector(".cp-say").innerHTML = t ? `<span class="small muted">Readback</span><br>${h(t)}` : `<span class="small muted">Type the clearance as you hear it. The readback builds here.</span>`; box.querySelector(".cp-out").innerHTML = list(craftChecks(f, c)); };
      box.querySelectorAll("input[data-k]").forEach((i) => i.oninput = () => { c[i.dataset.k] = i.value.trim(); c.at = Date.now(); persist(); upd(); fly(); });
      box.querySelector(".cp-filed").onclick = () => { const A2 = airports(f), d = A2.find((x) => x.role === "Destination"); if (d && !c.c) c.c = d.code; c.r = "as filed"; persist(); render(root); };
      box.querySelector(".cp-say-b").onclick = () => { const t = readback(f, c); const ss = window.speechSynthesis; if (!t) return toast("Type the clearance first"); if (!ss || typeof SpeechSynthesisUtterance === "undefined") return toast("This device has no voice"); try { ss.cancel(); const u = new SpeechSynthesisUtterance(speakable(t)); u.rate = 1.05; u._aero = true; ss.speak(u); } catch (e) {} };
      box.querySelector(".cp-clr").onclick = () => { P.craft = {}; persist(); render(root); fly(); };
      const pr = box.querySelector(".cp-prac"); if (pr) pr.onclick = () => close();
      upd();
    } else if (state.tab === "draw") {
      box.innerHTML = `<div class="cp-tools"><button type="button" class="btn sm" data-pen="pen" aria-pressed="true">Pen</button><button type="button" class="btn sec sm" data-pen="erase">Eraser</button><button type="button" class="btn sec sm cp-wipe">Clear drawing</button></div>
        <div class="cp-draw"><canvas aria-label="Scribble pad"></canvas></div><p class="small muted">Drawings stay on this device only.</p>`;
      scribble(box, f.id);
    } else {
      box.innerHTML = `<label class="small muted" for="cpNotes">Notes: taxi instructions, frequencies, holds, times</label><textarea id="cpNotes" class="cp-notes" spellcheck="false">${h(P.notes || "")}</textarea>`;
      box.querySelector("#cpNotes").oninput = (e) => { P.notes = e.target.value; persist(); };
    }
  }

  function scribble(box, id) {
    const cv = box.querySelector("canvas"), ctx = cv.getContext("2d");
    let mode = "pen", down = false, last = null, dirty = false, t = 0;
    // Pen color follows the text color the pad is actually drawn with, so it stays dark on the light theme and light
    // on the dark one (Nov 18: the --ink fallback drew pale grey on the light theme)
    const ink = (() => {
      // Dark ink on a pad that looks light, light ink on one that looks dark. The light theme inverts the page with a CSS
      // filter (and the canvas inverts back), so count the inverting filters on the way up for both the background and the canvas
      const inv = (e) => { let n = 0; for (; e; e = e.parentElement) if (/invert\(1\)/.test(getComputedStyle(e).filter || "")) n++; return n % 2 === 1; };
      let lum = 0, bgEl = document.documentElement;
      for (let e = cv.parentElement; e; e = e.parentElement) {
        const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(e).backgroundColor || "");
        if (m && (m[4] === undefined || +m[4] > 0.5)) { lum = 0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]; bgEl = e; break; }
      }
      const looksLight = inv(bgEl) ? lum < 115 : lum > 140;
      const want = looksLight ? "#14181f" : "#eef2f8", flip = { "#14181f": "#eef2f8", "#eef2f8": "#14181f" };
      return inv(cv) ? flip[want] : want;   // what is drawn on the canvas shows inverted if the canvas sits under an odd number of inverts
    })();
    const size = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      const img = cv.width ? cv.toDataURL() : (drawStore()[id] || {}).img;
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineCap = ctx.lineJoin = "round";
      if (img) { const im = new Image(); im.onload = () => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "source-over"; ctx.drawImage(im, 0, 0, cv.width, cv.height); ctx.restore(); }; im.src = img; }
    };
    size();
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5]; };
    const keep = () => { dirty = true; clearTimeout(t); t = setTimeout(() => { if (dirty) { drawSave(id, cv.toDataURL("image/png")); dirty = false; } }, 600); };
    cv.onpointerdown = (e) => { down = true; last = pt(e); try { cv.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); };
    cv.onpointermove = (e) => {
      if (!down) return;
      const p = pt(e);
      ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
      ctx.strokeStyle = ink; ctx.lineWidth = mode === "erase" ? 22 : 2.6 + p[2] * 2.2;
      ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      last = p; keep(); e.preventDefault();
    };
    cv.onpointerup = cv.onpointercancel = () => { down = false; };
    box.querySelectorAll("[data-pen]").forEach((b) => b.onclick = () => { mode = b.dataset.pen; box.querySelectorAll("[data-pen]").forEach((x) => { const on = x === b; x.setAttribute("aria-pressed", String(on)); x.classList.toggle("sec", !on); }); });
    box.querySelector(".cp-wipe").onclick = () => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore(); drawSave(id, null); };
  }

  function shell(inOverlay) {
    return `<div class="cp-in"><div class="cp-top"><h1>Copy pad</h1>${inOverlay ? `<button type="button" class="btn sm cp-close">Done</button>` : ""}</div>
      <div class="cp-tabs" role="tablist">${[["atis", "ATIS"], ["craft", "Clearance"], ["draw", "Scribble"], ["notes", "Notes"]].map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="false">${l}</button>`).join("")}</div>
      <div class="cp-body"></div>
      <p class="cp-disc">Copy aid only. ATC instructions and the official ATIS govern. Read back every clearance to ATC and confirm anything you are unsure of. Not for navigation.</p></div>`;
  }
  function wire(root) {
    root.querySelectorAll(".cp-tabs button").forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; render(root); });
    render(root);
  }
  let lastFocus = null;
  function open(tab) {
    if (tab) state.tab = tab;
    let o = document.getElementById("cpOver");
    if (!o) {
      lastFocus = document.activeElement;
      o = document.createElement("div"); o.id = "cpOver"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", "Copy pad");
      o.innerHTML = shell(true);
      document.body.appendChild(o);
      o.querySelector(".cp-close").onclick = close;
      o.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    }
    wire(o);
    const b = o.querySelector(".cp-close"); if (b) b.focus();
  }
  function close() {
    const o = document.getElementById("cpOver"); if (o) o.remove();
    try { save(); } catch (e) {}
    fly();
    try { if (lastFocus && lastFocus.isConnected) lastFocus.focus(); } catch (e) {}
  }

  // Fly screen: a button on the row (always) and an optional card with the copied numbers
  function summary(f) {
    if (!f || !f.pad) return "";
    const A = airports(f), P = f.pad, bits = [];
    for (const x of A) {
      const a = P.atis && P.atis[x.code]; if (!a || !(a.info || a.alt || a.rwy)) continue;
      bits.push(`<span class="cp-n">${h(x.code)}</span> ${a.info ? `info ${h(String(a.info).toUpperCase())}` : ""}${a.alt ? `, ${h(a.alt)}` : ""}${a.rwy ? `, runway ${h(String(a.rwy).toUpperCase())}` : ""}`);
    }
    if (P.craft && P.craft.t) bits.push(`Squawk <span class="cp-n">${h(P.craft.t)}</span>${P.craft.fq ? `, departure ${h(P.craft.fq)}` : ""}`);
    return bits.join("<br>");
  }
  function fly() {
    if (!/^#\/fly(\/|$|\?)/.test(location.hash || "")) return;
    const pg = document.querySelector("#view .page.fly"); if (!pg) return;
    const row = pg.querySelector(":scope > .row");
    if (row && !row.querySelector("#flPad")) {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn sec sm"; b.id = "flPad"; b.textContent = "Copy pad";
      b.onclick = () => open();
      row.appendChild(b);
    }
    const f = flight();
    if (!f || (f.points || []).length < 2) return;
    let c = pg.querySelector("#cpFly");
    if (!c) {
      c = document.createElement("div"); c.id = "cpFly";
      const box = pg.querySelector("#flCards"), a = pg.querySelector("h1");
      if (box) box.appendChild(c); else if (a) a.after(c); else return;
      c.onclick = (e) => { if (e.target.closest("button")) open(); };
    }
    const s = summary(f);
    const html = `<div class="cp-h">Copy pad</div>${s || `<span class="small muted">Nothing copied yet. Copy the ATIS and your clearance here.</span>`}<div style="margin-top:6px"><button type="button" class="btn sec sm">Open copy pad</button></div>`;
    if (c.innerHTML !== html) c.innerHTML = html;
  }
  try { if (window.AeroFlyLayout && AeroFlyLayout.CARDS && !AeroFlyLayout.CARDS.cpFly) AeroFlyLayout.CARDS.cpFly = "Copy pad"; } catch (e) {}

  // Brief: a button on the Flight plan sheet's handoff row, next to Fly this route
  function brief() {
    const go = document.querySelector("#fpPanel .fp-go");
    if (go && !go.querySelector(".cp-bf")) { const b = document.createElement("button"); b.type = "button"; b.className = "btn sec sm cp-bf"; b.textContent = "Copy pad"; b.onclick = () => open(); go.appendChild(b); }
  }

  // #/pad: the same pad as a page
  if (typeof ROUTES !== "undefined") {
    ROUTES.pad = function (el) {
      el.innerHTML = `<div class="page cp-page">${shell(false)}</div>`;
      wire(el.querySelector(".page"));
    };
  }

  let busy = false, t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { if (busy) return; busy = true; try { fly(); brief(); } catch (e) { console.error(e); } busy = false; }, 120); };
  new MutationObserver((list) => {
    if (list.every((m) => m.target.closest && m.target.closest("#cpFly"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { const o = document.getElementById("cpOver"); if (o) close(); kick(); });
  kick();
  window.AeroCopyPad = { open, close, atisChecks, craftChecks, readback, parseWind, parseAlt };

  // What's new list on More, demo tour and narrated tutorial (Mario can ask for the new narration line to be recorded)
  try { if (window.AeroWhatsNew && Array.isArray(AeroWhatsNew.ITEMS) && !AeroWhatsNew.ITEMS._p352) { AeroWhatsNew.ITEMS._p352 = true; AeroWhatsNew.ITEMS.unshift(["#/pad", "Copy pad for ATIS and clearances", "Copy the ATIS and your clearance on the device from the Fly screen or the brief. It works out the crosswind on your runway, checks the altimeter against the METAR and the squawk, and writes out your readback."]); } } catch (e) {}
  try {
    if (typeof TOURS !== "undefined") {
      const st = TOURS.civil && TOURS.civil.steps;
      if (Array.isArray(st) && !st._p352) {
        st._p352 = true;
        const i = st.findIndex((s) => s[0] === "#/brief");
        if (i >= 0) st[i] = [st[i][0], st[i][1], `${st[i][2]} The Copy pad, on the Flight plan sheet and the Fly screen, takes down the ATIS and your clearance and checks them as you type.`, ...st[i].slice(3)];
      }
    }
  } catch (e) {}
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    const sc = T && T.civil && T.civil.scenes;
    if (sc && !sc._p352) {
      sc._p352 = true;
      let at = sc.findIndex((x) => x.hash === "#/feedback");
      if (at < 0) at = sc.length;
      sc.splice(at, 0, { hash: "#/pad", sel: ".cp-tabs, .cp-body", wait: ".cp-body", text: "The Copy pad takes down the ATIS and your clearance. Type the wind and runway and it works out the crosswind, checks the altimeter against the latest METAR, checks the squawk, and writes out your readback. There is a scribble pad for a finger or stylus, too." });
    }
  } catch (e) { console.error(e); }
})();
