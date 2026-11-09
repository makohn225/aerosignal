"use strict";
/* p192: FAA airport data in the app (November 8, 2026, approved with the faa_airports table, its functions and a
   weekly refresh). Source: the FAA NASR 28 day airport file (fuel, public or private use, tower, attendance).
   1. Airport pages get a Fuel and services panel: fuel sold, public or private use, tower, attended hours,
      lighting and services, with the FAA cycle date.
   2. The brief gets a Fuel stops panel (#fsPanel, after #kiPanel): from the nav log start fuel, burn and speed and a
      chosen reserve, the range with no wind; when the route is longer, public airports within 15 nm of the line
      that sell the chosen fuel are suggested as stops, each about as far along as the fuel allows, with Add stop.
   2b. (Nov 8 evening) The same panel checks the arrival: estimated arrival time against the destination's attended
      hours, private use, no fuel listed, and night arrivals where lighting is by remark.
      Times use each airport's own time zone (from its state and position).
   3. AeroFAA.publicSet(box) gives other modules the public use airports in an area (VFR checkpoints and the Fly
      screen's nearest airports use it to leave out private fields). */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = Math.PI / 180;
  const FUEL = { "100LL": "100LL avgas", "100": "100 avgas", A: "Jet A", "A+": "Jet A+", "A1": "Jet A1", "A1+": "Jet A1+", MOGAS: "Mogas", UL91: "UL91", UL94: "UL94", B: "Jet B", "B+": "Jet B+" };
  const TWR = { ATCT: "Towered", "NON-ATCT": "No tower", "ATCT-A/C": "Tower with approach control", "ATCT-RAPCON": "Tower with radar approach control", "ATCT-TRACON": "Tower with TRACON", "NON-ATCT-A/C": "No tower, approach control on field" };
  const css = document.createElement("style");
  css.textContent = `
    #faPanel dl{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 14px;margin:0;font-size:14px}
    #faPanel dt{color:var(--ink2,#9db2ce)}#faPanel dd{margin:0}
    #fsPanel .fs-ctl{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:4px 0 8px}
    #fsPanel .fs-ctl label{display:flex;align-items:center;gap:6px;font-size:13.5px}
    #fsPanel table{width:100%;border-collapse:collapse;font-size:13.5px}
    #fsPanel td,#fsPanel th{text-align:left;padding:6px 4px;border-top:1px solid var(--line2,rgba(255,255,255,.1));vertical-align:top}
    #fsPanel td small{display:block;color:var(--ink2,#9db2ce)}`;
  document.head.appendChild(css);
  const tc = (t) => String(t || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Nas|Afb|Rgnl|Intl|Muni|Fld)\b/g, (m) => ({ Nas: "NAS", Afb: "AFB", Rgnl: "Regional", Intl: "International", Muni: "Municipal", Fld: "Field" }[m]));
  const fuelText = (t) => (t ? t.split(",").map((x) => FUEL[x.trim()] || x.trim()).join(", ") : "None listed");
  const attText = (t) => {
    if (!t) return "Not listed";
    if (/UNAT/.test(t)) return "Unattended";
    const day = (d) => d.replace(/\s*-\s*/g, "-").replace(/^ALL$/, "daily").replace(/M-F/, "MON-FRI").replace(/\b([A-Z]{3})\b/g, (m) => m[0] + m.slice(1).toLowerCase()).replace(/-/g, " to ");
    const hrs = (x) => x.replace(/\s*-\s*/g, "-").replace(/^ALL$/, "all hours").replace(/^(IREG|IRREG)$/, "irregular hours").replace(/^INTMNT$/, "intermittently").replace(/^DALGT$/, "daylight hours").replace(/^ON CALL$/, "on call").replace(/DUSK|DARK/, "dusk").replace(/^([0-9]{4})-/, "$1 to ");
    return t.split(";").map((e) => { const m = /^(\S+)\s+(.+?)\s+(ALL|IREG|IRREG|INTMNT|ON CALL|DALGT|DAWN\s*-\s*DUSK|SR-SS|[0-9]{4}\s*-\s*\S+)$/.exec(e.trim().replace(/\s+/g, " ")); if (!m) { const x = e.trim(); return /^(IREG|IRREG)$/.test(x) ? "Irregular hours" : /^INTMNT$/.test(x) ? "Intermittent" : /ON CALL/.test(x) ? "On call" : x; } const mo = m[1] === "ALL" ? "" : day(m[1]) + ": "; const dd = day(m[2]); return `${mo}${dd.charAt(0).toUpperCase() + dd.slice(1)} ${hrs(m[3])}`; }).join("; ");
  };
  function dist(a, b) { const p1 = a.lat * R, p2 = b.lat * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2; return 6880.13 * Math.asin(Math.min(1, Math.sqrt(x))); }
  function along(a, b, q) { const k = Math.cos(((a.lat + b.lat) / 2) * R) * 60, bx = (b.lon - a.lon) * k, by = (b.lat - a.lat) * 60, px = (q.lon - a.lon) * k, py = (q.lat - a.lat) * 60, L = Math.hypot(bx, by) || 1, t = (px * bx + py * by) / L; return { t, x: Math.abs(bx * py - by * px) / L, L }; }

  // ---------- shared lookups ----------
  const boxes = new Map();
  function box(minLat, minLon, maxLat, maxLon, pub) {
    const k = [minLat, minLon, maxLat, maxLon].map((v) => v.toFixed(1)).join(",") + (pub === false ? "a" : "p");
    if (!boxes.has(k)) boxes.set(k, rpc("faa_airports_box", { min_lat: minLat, min_lon: minLon, max_lat: maxLat, max_lon: maxLon, public_only: pub !== false }).then((r) => (Array.isArray(r) ? r : [])).catch(() => (boxes.delete(k), [])));
    return boxes.get(k);
  }
  async function publicSet(minLat, minLon, maxLat, maxLon) {
    const rows = await box(minLat, minLon, maxLat, maxLon, true);
    const set = new Set(); for (const r of rows) { set.add(r.ident); if (/^K[A-Z0-9]{3}$/.test(r.ident)) set.add(r.ident.slice(1)); else if (/^[A-Z0-9]{3}$/.test(r.ident)) set.add("K" + r.ident); }
    return set;
  }

  // ---------- 1. airport page ----------
  async function airportPage() {
    const apt = document.getElementById("apt"); if (!apt) return;
    const h2 = apt.querySelector("section.panel h2"); if (!h2 || apt.querySelector("#faPanel")) return;
    const code = (h2.firstChild && h2.firstChild.nodeValue || h2.textContent || "").trim().split(/\s+/)[0];
    if (!code) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "faPanel";
    sec.innerHTML = `<h2>Fuel and services</h2><p class="muted" style="margin:0">Loading FAA airport data…</p>`;
    h2.closest("section.panel").after(sec);
    try {
      const [a] = (await rpc("faa_airport", { code })) || [];
      if (!a) { sec.innerHTML = `<h2>Fuel and services</h2><p class="muted" style="margin:0">Not in the FAA airport file (it covers US airports).</p>`; return; }
      sec.innerHTML = `<h2>Fuel and services</h2><dl>
        <dt>Fuel</dt><dd><b>${h(fuelText(a.fuel_types))}</b></dd>
        <dt>Use</dt><dd>${a.facility_use === "PU" ? "Public use" : a.facility_use === "PR" ? "<b>Private use</b>: permission needed before landing" : h(a.facility_use || "Not listed")}</dd>
        <dt>Tower</dt><dd>${h(TWR[a.twr_type] || a.twr_type || "Not listed")}</dd>
        <dt>Attended</dt><dd>${h(attText(a.attendance))}</dd>
        <dt>Lighting</dt><dd>${h(!a.lgt_sked ? "Not listed" : a.lgt_sked === "SS-SR" ? "Sunset to sunrise" : a.lgt_sked === "SEE RMK" ? "See the Chart Supplement" : a.lgt_sked)}</dd>
        ${a.other_services ? `<dt>Services</dt><dd>${h(a.other_services.split(",").join(", "))}</dd>` : ""}
      </dl><p class="small muted" style="margin:8px 0 0">FAA airport data, cycle effective ${h(a.cycle)}. Call ahead: fuel and hours can change.</p>`;
    } catch (e) { sec.innerHTML = `<h2>Fuel and services</h2><p class="muted" style="margin:0">FAA airport data could not load right now.</p>`; }
  }

  // ---------- 2. fuel stops on the brief ----------
  const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  function inputs(f) {
    const nl = f.nl || {}, prof = ((S.profiles || {})[f.tail] || {}), wb = prof.wb || {};
    let tas = Number(nl.tas) || 0; if (!tas) try { const a = (allAircraft() || {})[f.tail]; tas = (a && (Number(a.cruiseKt) || Number(a.tas))) || 0; } catch (e) {}
    return { fuel: Number(nl.fuel) || Number((f.wb || {}).fuel) || 0, gph: Number(nl.gph) || Number(wb.gph) || 0, taxi: nl.taxi != null && nl.taxi !== "" ? Number(nl.taxi) : 1, tas };
  }
  async function plan(f, fuelKind, reserveMin) {
    const P = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    const I = inputs(f);
    if (P.length < 2) return { msg: "Load a route first." };
    if (!I.fuel || !I.gph || !I.tas) return { msg: "Set start fuel, burn and true airspeed in the nav log (or the aircraft) to work out fuel stops." };
    const usable = I.fuel - I.taxi - (I.gph * reserveMin) / 60;
    if (usable <= 0) return { msg: `Start fuel (${I.fuel} gal) does not cover taxi and a ${reserveMin} minute reserve at ${I.gph} gal per hour. Check the nav log numbers.` };
    const range = Math.max(0, (usable / I.gph) * I.tas * 0.9); // 10% margin for wind and climb
    const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + dist(P[i - 1], P[i]));
    const total = cum[cum.length - 1];
    const base = { range, total, usable, I };
    if (total <= range) return { ...base, stops: [], msg: null };
    let a = 90, b = 180, c = -90, d = -180; for (const p of P) { a = Math.min(a, p.lat); b = Math.min(b, p.lon); c = Math.max(c, p.lat); d = Math.max(d, p.lon); }
    const rows = await box(a - 0.3, b - 0.35, c + 0.3, d + 0.35, true);
    const want = fuelKind === "JET" ? /\bA(1)?\+?\b|\bB\+?\b/ : fuelKind === "MOGAS" ? /MOGAS|UL9[14]/ : /100LL|\b100\b|UL9[14]/;
    // Candidates: position along the route (nm from the start) and distance off the line
    const cands = [];
    for (const r of rows) {
      if (!r.fuel_types || !want.test(r.fuel_types.split(",").map((x) => x.trim()).join(" "))) continue;
      let best = null;
      for (let i = 1; i < P.length; i++) { const g = along(P[i - 1], P[i], r); if (g.t < -2 || g.t > g.L + 2) continue; if (!best || g.x < best.x) best = { x: g.x, s: cum[i - 1] + Math.max(0, Math.min(g.L, g.t)) }; }
      if (best && best.x <= 15) cands.push({ ...r, s: best.s, x: best.x });
    }
    const stops = []; let pos = 0, guard = 0;
    while (total - pos > range && guard++ < 12) {
      const reach = cands.filter((c) => c.s > pos + 5 && c.s - pos + c.x <= range).sort((p, q) => q.s - p.s || p.x - q.x);
      const pick = reach[0]; if (!pick) { stops.push({ none: true, from: pos }); break; }
      stops.push(pick); pos = pick.s;
    }
    return { ...base, stops, msg: null };
  }
  function addStop(f, st) {
    const P = (f.points || []).slice();
    let at = P.length - 1, acc = 0; for (let i = 1; i < P.length; i++) { acc += dist(P[i - 1], P[i]); if (acc >= st.s) { at = i; break; } }
    P.splice(at, 0, { ident: st.ident, name: st.name, kind: "airport", lat: st.lat, lon: st.lon, elev: st.elev_ft });
    f.points = P; f.route = P.map((p) => p.ident).join(" "); f.updated = Date.now(); save();
    toast(`${st.ident} added as a fuel stop`); window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  // ---------- arrival check (Nov 8 evening) ----------
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"], MONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  function inRange(list, from, to, v) { const a = list.indexOf(from), b = list.indexOf(to), x = list.indexOf(v); if (a < 0 || b < 0 || x < 0) return null; return a <= b ? x >= a && x <= b : x >= a || x <= b; }
  function partHas(part, list, v) {
    part = part.replace(/\s*-\s*/g, "-").trim();
    if (!part || part === "ALL") return true;
    return part.split(/[,&]/).some((seg) => { seg = seg.trim(); if (seg === "WKDY" || seg === "WKDAYS") seg = "MON-FRI"; if (seg === "WKND" || seg === "WKENDS") seg = "SAT-SUN"; const m = /^([A-Z]{3})-([A-Z]{3})$/.exec(seg); if (m) return !!inRange(list, m[1], m[2], v); return seg.slice(0, 3) === v; });
  }
  // attendance text and a local Date -> "attended", "closed", "unattended" or "unknown"
  function attendedAt(text, d, sunUp) {
    if (!text) return "unknown";
    if (/UNAT/.test(text)) return "unattended";
    let unknown = false, dayMatch = false, parsed = 0;
    for (const e of text.split(";").map((x) => x.trim()).filter(Boolean)) {
      const m = /^(\S+(?:\s*-\s*[A-Z]{3})?)\s+(.+?)\s+(ALL|IREG|IRREG|INTMNT|ON CALL|DALGT|DAWN-DUSK|SR-SS|[0-9]{4}\s*-\s*(?:[0-9]{4}|DUSK|SS|DARK)|DAWN\s*-\s*[0-9]{4})$/.exec(e.replace(/\s+/g, " ").replace(/\bM-F\b/, "MON-FRI"));
      if (!m) { unknown = true; continue; }
      parsed++;
      if (!partHas(m[1], MONS, MONS[d.getMonth()]) || !partHas(m[2], DAYS, DAYS[d.getDay()])) continue;
      dayMatch = true;
      const hrs = m[3].replace(/\s+/g, "");
      if (hrs === "ALL") return "attended";
      if (/^(IREG|IRREG|INTMNT|ONCALL)$/.test(hrs)) { unknown = true; continue; }
      if (/DALGT|DAWN-DUSK|SR-SS/.test(hrs)) { if (sunUp == null) unknown = true; else if (sunUp) return "attended"; continue; }
      const t = d.getHours() * 100 + d.getMinutes();
      const hm = /^([0-9]{4})-([0-9]{4})$/.exec(hrs);
      if (hm) { const a = +hm[1], b = +hm[2]; if (a <= b ? t >= a && t <= b : t >= a || t <= b) return "attended"; continue; }
      const dusk = /^([0-9]{4})-(DUSK|SS|DARK)$/.exec(hrs);
      if (dusk) { if (t >= +dusk[1] && (sunUp == null ? t <= 1800 : sunUp)) return "attended"; continue; }
    }
    if (!parsed) return "unknown";
    return unknown ? "unknown" : "closed";
  }
  // US airport time zones from the FAA state code and position (split states by longitude), Nov 8 night
  const TZ = { AL: "America/Chicago", AR: "America/Chicago", AZ: "America/Phoenix", CA: "America/Los_Angeles", CO: "America/Denver", CT: "America/New_York", DC: "America/New_York", DE: "America/New_York", GA: "America/New_York", HI: "Pacific/Honolulu", IA: "America/Chicago", IL: "America/Chicago", LA: "America/Chicago", MA: "America/New_York", MD: "America/New_York", ME: "America/New_York", MN: "America/Chicago", MO: "America/Chicago", MS: "America/Chicago", MT: "America/Denver", NC: "America/New_York", NH: "America/New_York", NJ: "America/New_York", NM: "America/Denver", NV: "America/Los_Angeles", NY: "America/New_York", OH: "America/New_York", OK: "America/Chicago", PA: "America/New_York", RI: "America/New_York", SC: "America/New_York", UT: "America/Denver", VA: "America/New_York", VT: "America/New_York", WA: "America/Los_Angeles", WI: "America/Chicago", WV: "America/New_York", WY: "America/Denver", PR: "America/Puerto_Rico", VI: "America/St_Thomas", GU: "Pacific/Guam", AS: "Pacific/Pago_Pago", MP: "Pacific/Saipan" };
  function tzFor(st, lat, lon) {
    switch (st) {
      case "FL": return lon < -85.0 ? "America/Chicago" : "America/New_York";
      case "TN": return lon < -85.3 ? "America/Chicago" : "America/New_York";
      case "KY": return lon < -85.9 ? "America/Chicago" : "America/New_York";
      case "IN": return lon < -86.9 && (lat > 41.0 || lat < 38.6) ? "America/Chicago" : "America/Indiana/Indianapolis";
      case "MI": return lon < -87.6 && lat > 45.5 ? "America/Chicago" : "America/Detroit";
      case "ND": return lon < -101.3 && lat < 47.2 ? "America/Denver" : "America/Chicago";
      case "SD": return lon < -100.5 ? "America/Denver" : "America/Chicago";
      case "NE": return lon < -101.0 ? "America/Denver" : "America/Chicago";
      case "KS": return lon < -101.5 ? "America/Denver" : "America/Chicago";
      case "TX": return lon < -104.9 ? "America/Denver" : "America/Chicago";
      case "ID": return lat > 45.5 ? "America/Los_Angeles" : "America/Boise";
      case "OR": return lon > -117.7 && lat < 44.5 ? "America/Boise" : "America/Los_Angeles";
      case "AK": return lon < -169 ? "America/Adak" : "America/Anchorage";
      default: return TZ[st] || null;
    }
  }
  function offsetMin(ms, tz) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(ms / 60000) * 60000) / 60000;
  }
  function instantAt(date, time, tz) {
    const [y, mo, d] = date.split("-").map(Number), [hh, mm] = time.split(":").map(Number), guess = Date.UTC(y, mo - 1, d, hh, mm);
    if (!tz) return new Date(`${date}T${time}`).getTime();
    let t = guess - offsetMin(guess, tz) * 60000; t = guess - offsetMin(t, tz) * 60000; return t;
  }
  function clockAt(ms, tz) { if (!tz) return new Date(ms); const o = offsetMin(ms, tz); const u = new Date(ms + o * 60000); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes()); }
  const tzName = (ms, tz) => { try { return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(ms)).find((x) => x.type === "timeZoneName").value; } catch (e) { return ""; } };
  async function arrival(f) {
    const P = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon)); if (P.length < 2) return null;
    const dest = P[P.length - 1]; if (dest.kind && dest.kind !== "airport") return null;
    let a = null; try { [a] = (await rpc("faa_airport", { code: dest.ident })) || []; } catch (e) {}
    if (!a) return null;
    // Departure time is local at the departure airport; attended hours are local at the destination
    let eta = null, etaMs = null, tzD = tzFor(a.state, a.lat, a.lon), zone = "";
    if (f.date && f.time) {
      let tz0 = null; try { const [a0] = (await rpc("faa_airport", { code: P[0].ident })) || []; if (a0) tz0 = tzFor(a0.state, a0.lat, a0.lon); } catch (e) {}
      const depMs = instantAt(f.date, f.time, tz0);
      if (isFinite(depMs)) { let tot = 0; for (let i = 1; i < P.length; i++) tot += dist(P[i - 1], P[i]); const tas = inputs(f).tas || 110; etaMs = depMs + (tot / tas) * 36e5 + 10 * 60000; eta = clockAt(etaMs, tzD); zone = tzD ? tzName(etaMs, tzD) : ""; }
    }
    let sunUp = null; try { if (etaMs && window.AeroLogTrack && AeroLogTrack.sunEl) sunUp = AeroLogTrack.sunEl(etaMs, dest.lat, dest.lon) > -0.8; } catch (e) {}
    const att = eta ? attendedAt(a.attendance, eta, sunUp) : "unknown";
    const notes = [];
    if (a.facility_use === "PR") notes.push({ bad: true, t: `${a.ident} is a private use airport: get permission before you land.` });
    if (eta) {
      const when = eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + (zone ? ` ${zone}` : "") + " local";
      if (att === "closed") notes.push({ bad: true, t: `You arrive about ${when}, outside ${a.ident}'s attended hours (${attText(a.attendance)}). Fuel and services may not be available; check self serve fuel and call ahead.` });
      else if (att === "unattended") notes.push({ bad: false, t: `${a.ident} is unattended. ${a.fuel_types ? "Fuel listed: " + fuelText(a.fuel_types) + ", likely self serve." : "No fuel listed."}` });
      else if (att === "attended") notes.push({ bad: false, t: `You arrive about ${when}, within ${a.ident}'s attended hours.` });
      else notes.push({ bad: false, t: `${a.ident} attended hours: ${attText(a.attendance)}. Call ahead to confirm.` });
      if (sunUp === false && /SEE RMK/.test(a.lgt_sked || "")) notes.push({ bad: false, t: `Night arrival: ${a.ident}'s runway lighting schedule is in the Chart Supplement remarks; check it and the pilot controlled lighting frequency.` });
    }
    if (!a.fuel_types) notes.push({ bad: false, t: `No fuel is listed at ${a.ident}; plan fuel for the return or the next leg.` });
    return { a, eta, att, notes };
  }
  let fsBusy = false;
  async function briefPanel() {
    if (fsBusy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"); let f = null; try { f = currentFlight(); } catch (e) {}
    if (!page || !f || f.missionId || !page.querySelector("#bfBluf")) return;
    let sec = page.querySelector(":scope > #fsPanel");
    const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(" ")}|${JSON.stringify(inputs(f))}|${pref("vg_fs_fuel", "100LL")}|${pref("vg_fs_res", "45")}`;
    const anchor = page.querySelector(":scope > #kiPanel") || page.querySelector(":scope > #gpPanel") || page.querySelector(":scope > #nsPanel");
    if (sec && sec.dataset.k === key && (!anchor || anchor.nextElementSibling === sec)) return;
    fsBusy = true;
    try {
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "fsPanel"; }
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      if (sec.dataset.k === key) return;
      sec.dataset.k = key;
      const fk = pref("vg_fs_fuel", "100LL"), rm = Number(pref("vg_fs_res", "45"));
      sec.innerHTML = `<h2>Fuel stops</h2><p class="muted" style="margin:0">Working out range…</p>`;
      const r = await plan(f, fk, rm);
      const ctl = `<div class="fs-ctl"><label>Fuel <select data-fk><option value="100LL">100LL</option><option value="JET">Jet A</option><option value="MOGAS">Mogas or UL94</option></select></label><label>Reserve <select data-rm><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></label></div>`;
      let body;
      if (r.msg) body = `<p style="margin:0">${h(r.msg)}</p>`;
      else if (!r.stops.length) body = `<p style="margin:0"><b>No fuel stop needed.</b> Range about ${Math.floor(r.range)} nm with no wind, keeping a ${rm} minute reserve; the route is ${Math.round(r.total)} nm.</p>`;
      else body = `<p style="margin:0 0 6px"><b>Range about ${Math.floor(r.range)} nm</b> with no wind and a ${rm} minute reserve, for a ${Math.round(r.total)} nm route. Suggested stops at public airports that sell ${h(fk === "JET" ? "Jet A" : fk === "MOGAS" ? "mogas or UL94" : "100LL")}:</p>
        <table>${r.stops.map((s, i) => s.none ? `<tr><td colspan="3"><b>No suitable airport within reach</b> after ${Math.round(s.from)} nm. Plan this leg yourself.</td></tr>` : `<tr><td><b>${h(s.ident)}</b><small>${h(tc(s.name))}, ${h(tc(s.city))} ${h(s.state || "")}</small></td><td>${Math.round(s.s)} nm along, ${s.x.toFixed(1)} nm off route<small>${h(fuelText(s.fuel_types))} · ${h(attText(s.attendance))}</small></td><td><button type="button" class="btn sec sm" data-add="${i}">Add stop</button></td></tr>`).join("")}</table>`;
      let arr = null; try { arr = await arrival(f); } catch (e) {}
      const arrHtml = arr && arr.notes.length ? `<div style="margin:10px 0 0"><b class="small">Arrival at ${h(arr.a.ident)}</b><ul style="margin:4px 0 0 18px">${arr.notes.map((n) => `<li${n.bad ? ' style="color:#ffb648;font-weight:600"' : ""}>${h(n.t)}</li>`).join("")}</ul></div>` : "";
      sec.innerHTML = `<h2>Fuel stops</h2>${ctl}${body}${arrHtml}<p class="small muted" style="margin:8px 0 0">Planning aid: no wind, 10% margin, from your nav log numbers and FAA airport data. Confirm fuel and hours by phone, and check your own fuel plan.</p>`;
      sec.querySelector("[data-fk]").value = fk; sec.querySelector("[data-rm]").value = String(rm);
      sec.querySelector("[data-fk]").onchange = (e) => { setPref("vg_fs_fuel", e.target.value); sec.dataset.k = ""; briefPanel(); };
      sec.querySelector("[data-rm]").onchange = (e) => { setPref("vg_fs_res", e.target.value); sec.dataset.k = ""; briefPanel(); };
      sec.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => addStop(f, r.stops[+b.dataset.add])));
      const jmp = page.querySelector("#bfJump");
      if (jmp && !jmp.querySelector('[data-s="#fsPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#fsPanel"; a.textContent = "Fuel stops";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("fsPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
        jmp.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (fsBusy = false), 0); }
  }
  let t = 0;
  new MutationObserver((list) => {
    if (list.every((m) => m.target.closest && m.target.closest("#fsPanel, #faPanel"))) return;
    clearTimeout(t); t = setTimeout(() => { try { airportPage(); briefPanel(); } catch (e) { console.error(e); } }, 450);
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroFAA = { box, publicSet, plan, fuelText, attText, attendedAt, arrival };
})();
