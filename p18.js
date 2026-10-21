"use strict";
/* JMPS style planning aids: MGRS entry, kneeboard cards (navlog with TOT back timing,
   waypoint card, comm card), waypoint import and export. */

const MGRS = (function () {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const BANDS = "CDEFGHJKLMNPQRSTUVWX";
  const COLS = ["ABCDEFGH", "JKLMNPQR", "STUVWXYZ"];
  const ROWS = "ABCDEFGHJKLMNPQRSTUV";
  const R = Math.PI / 180;

  function zoneFor(lat, lon) {
    let z = Math.floor((lon + 180) / 6) + 1;
    if (z > 60) z = 60;
    if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) z = 32;
    if (lat >= 72 && lat < 84) {
      if (lon >= 0 && lon < 9) z = 31;
      else if (lon >= 9 && lon < 21) z = 33;
      else if (lon >= 21 && lon < 33) z = 35;
      else if (lon >= 33 && lon < 42) z = 37;
    }
    return z;
  }
  function band(lat) {
    if (lat >= 72) return "X";
    return BANDS[Math.floor((lat + 80) / 8)];
  }
  function toUtm(lat, lon, zone) {
    zone = zone || zoneFor(lat, lon);
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const phi = lat * R, lam = (lon - lon0) * R;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * lam;
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
      - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
      + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
      - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
    const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    let No = k0 * (M + N * Math.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
    if (lat < 0) No += 10000000;
    return { zone, E, N: No };
  }
  function fromUtm(zone, E, No, south) {
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const x = E - 500000, y = south ? No - 10000000 : No;
    const M = y / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
      + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
    const N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), T1 = Math.tan(p1) ** 2, C1 = ep2 * Math.cos(p1) ** 2;
    const R1 = a * (1 - e2) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = x / (N1 * k0);
    const lat = p1 - (N1 * Math.tan(p1) / R1) * (D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4 / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6 / 720);
    const lon = (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5 / 120) / Math.cos(p1);
    return { lat: lat / R, lon: lon0 + lon / R };
  }
  function toMgrs(lat, lon, digits = 5) {
    if (!(lat >= -80 && lat < 84)) return "";
    const u = toUtm(lat, lon);
    const set = ((u.zone - 1) % 3);
    const col = COLS[set][Math.floor(u.E / 100000) - 1];
    const rowOff = u.zone % 2 === 0 ? 5 : 0;
    const row = ROWS[(Math.floor(u.N / 100000) + rowOff) % 20];
    const p = 10 ** (5 - digits);
    const e = String(Math.floor((u.E % 100000) / p)).padStart(digits, "0");
    const n = String(Math.floor((u.N % 100000) / p)).padStart(digits, "0");
    return `${String(u.zone).padStart(2, "0")}${band(lat)} ${col}${row} ${e} ${n}`;
  }
  const RE = /^\s*(\d{1,2})\s*([C-HJ-NP-X])\s*([A-HJ-NP-Z])\s*([A-HJ-NP-V])\s*(\d+)\s*(\d*)\s*$/i;
  function parse(s) {
    const m = String(s || "").toUpperCase().match(RE);
    if (!m) return null;
    const zone = +m[1], bnd = m[2], c = m[3], r = m[4];
    let digs = m[5] + m[6];
    if (zone < 1 || zone > 60 || !digs.length || digs.length % 2 || digs.length > 10) return null;
    const h = digs.length / 2, prec = 10 ** (5 - h);
    const e5 = +digs.slice(0, h) * prec + prec / 2, n5 = +digs.slice(h) * prec + prec / 2;
    const set = (zone - 1) % 3, ci = COLS[set].indexOf(c);
    if (ci < 0) return null;
    const rowOff = zone % 2 === 0 ? 5 : 0;
    let ri = ROWS.indexOf(r);
    if (ri < 0) return null;
    ri = (ri - rowOff + 20) % 20;
    const E = (ci + 1) * 100000 + e5;
    const bi = BANDS.indexOf(bnd);
    const south = bi < BANDS.indexOf("N");
    const bandLat = -80 + bi * 8;
    const lon0 = (zone - 1) * 6 - 180 + 3;
    const minN = toUtm(bandLat, lon0, zone).N;
    let N = ri * 100000 + n5;
    while (N < minN - 100000) N += 2000000;
    const ll = fromUtm(zone, E, N, south);
    if (!(ll.lat >= -80.5 && ll.lat <= 84.5)) return null;
    return { lat: ll.lat, lon: ll.lon, precision: prec, text: `${String(zone).padStart(2, "0")}${bnd} ${c}${r} ${digs.slice(0, h)} ${digs.slice(h)}` };
  }
  const isCompact = (t) => /^\d{1,2}[C-HJ-NP-X][A-HJ-NP-Z][A-HJ-NP-V](\d{2}|\d{4}|\d{6}|\d{8}|\d{10})$/i.test(String(t || ""));
  return { toMgrs, parse, isCompact, toUtm, fromUtm };
})();

function fmtDdm(v, pos, neg, w) {
  const h = v >= 0 ? pos : neg, x = Math.abs(v), d = Math.floor(x);
  let m = (x - d) * 60;
  let dd = d;
  if (m >= 59.995) { m = 0; dd += 1; }
  return `${h}${String(dd).padStart(w, "0")} ${m.toFixed(2).padStart(5, "0")}`;
}
const llDdm = (p) => `${fmtDdm(p.lat, "N", "S", 2)} ${fmtDdm(p.lon, "E", "W", 3)}`;

(function () {
  if (typeof srcLabel === "object") { srcLabel.mgrs = "MGRS"; srcLabel.imported = "imported waypoint"; }

  const baseIndex = diagramIndex;
  diagramIndex = function (m) {
    const idx = baseIndex(m);
    for (const w of (m && m.wpts) || []) {
      const k = normName(w.name);
      if (k && !idx.has(k)) idx.set(k, { lat: w.lat, lon: w.lon, src: "imported", kind: "point" });
    }
    return idx;
  };

  const baseName = resolveName;
  resolveName = async function (s, idx) {
    const t = String(s || "").trim();
    if (t && idx && idx.has && idx.has(normName(t))) return baseName(s, idx);
    const g = MGRS.parse(t);
    if (g) return { ident: g.text, lat: g.lat, lon: g.lon, src: "mgrs", kind: "point" };
    return baseName(s, idx);
  };

  const baseRoute = resolveRoute;
  resolveRoute = async function (str) {
    const toks = tokenize(str);
    if (!toks.some((t) => MGRS.isCompact(t))) return baseRoute(str);
    const out = { points: [], unresolved: [], airways: [] };
    let run = [];
    const flush = async () => {
      if (!run.length) return;
      const r = await baseRoute(run.join(" "));
      out.points.push(...(r.points || []));
      out.unresolved.push(...(r.unresolved || []));
      if (r.airways) out.airways.push(...r.airways);
      run = [];
    };
    for (const t of toks) {
      if (!MGRS.isCompact(t)) { run.push(t); continue; }
      await flush();
      const g = MGRS.parse(t);
      if (g) out.points.push({ ident: t.toUpperCase(), name: g.text, kind: "fix", subtype: "MGRS", lat: g.lat, lon: g.lon, elev: null });
      else out.unresolved.push(t);
    }
    await flush();
    return out;
  };

  const baseMissions = ROUTES.missions;
  ROUTES.missions = function (el, arg) {
    baseMissions(el, arg);
    const id = (location.hash || "").split("/")[2];
    const tab = (location.hash || "").split("/")[3] || "plan";
    const exp = el.querySelector("#mexp");
    if (!exp || !id || id === "templates" || !getMission(id)) return;
    const kb = document.createElement("button");
    kb.className = "btn sm";
    kb.id = "mkb";
    kb.textContent = "Kneeboard cards";
    kb.onclick = () => { location.hash = `#/kneeboard/${id}`; };
    const imp = document.createElement("button");
    imp.className = "btn sec sm";
    imp.id = "mimp";
    imp.textContent = "Import waypoints";
    imp.onclick = () => importWaypointsUI(id);
    exp.after(imp);
    exp.after(kb);
    if (tab === "plan" && !el.querySelector("#mgrsHint")) {
      const firstLeg = el.querySelector(".legcard");
      if (firstLeg && firstLeg.parentNode) {
        const p = document.createElement("p");
        p.id = "mgrsHint";
        p.className = "small muted";
        p.style.margin = "0 0 10px";
        p.textContent = "Leg points can be names from the objective area diagram, airport or navaid IDs, lat,lon, MGRS (for example 11S QS 62694 13732) or imported waypoint names.";
        firstLeg.parentNode.insertBefore(p, firstLeg);
      }
    }
  };
})();

function parseWaypointFile(text, filename) {
  const out = [];
  const t = String(text || "");
  if (/<gpx[\s>]/i.test(t) || /\.gpx$/i.test(filename || "")) {
    const doc = new DOMParser().parseFromString(t, "application/xml");
    let pts = [...doc.getElementsByTagName("rtept")];
    if (!pts.length) pts = [...doc.getElementsByTagName("wpt")];
    if (!pts.length) pts = [...doc.getElementsByTagName("trkpt")];
    pts.forEach((p, i) => {
      const lat = +p.getAttribute("lat"), lon = +p.getAttribute("lon");
      const n = p.getElementsByTagName("name")[0];
      if (isFinite(lat) && isFinite(lon)) out.push({ name: (n && n.textContent.trim()) || `WP${i + 1}`, lat, lon });
    });
    return out;
  }
  const rows = parseCSV(t).filter((r) => r.some((c) => String(c).trim()));
  if (!rows.length) return out;
  const head = rows[0].map((c) => String(c).trim().toLowerCase());
  const hi = (re) => head.findIndex((h) => re.test(h));
  let iName = hi(/^(name|ident|id|waypoint|wpt|point|label)/), iLat = hi(/^lat/), iLon = hi(/^(lon|lng|long)/), iM = hi(/mgrs/);
  const hasHead = iName >= 0 || iLat >= 0 || iM >= 0;
  const body = hasHead ? rows.slice(1) : rows;
  if (!hasHead) { iName = 0; iLat = 1; iLon = 2; }
  body.forEach((r, i) => {
    const name = String(r[iName] ?? "").trim() || `WP${i + 1}`;
    let lat = parseCoord(r[iLat]), lon = parseCoord(r[iLon]);
    if ((lat == null || lon == null) && iM >= 0) {
      const g = MGRS.parse(r[iM]);
      if (g) { lat = g.lat; lon = g.lon; }
    }
    if ((lat == null || lon == null) && !hasHead) {
      const g = MGRS.parse(r[1]);
      if (g) { lat = g.lat; lon = g.lon; }
    }
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) out.push({ name, lat, lon });
  });
  return out;
}

function parseCoord(v) {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (/^[-+]?\d+(\.\d+)?$/.test(s)) return +s;
  const m = s.match(/^([NSEW])?\s*(\d{1,3})[°\s:]+(\d{1,2}(?:\.\d+)?)(?:['\s:]+(\d{1,2}(?:\.\d+)?))?["\s]*([NSEW])?$/);
  if (!m) return null;
  const h = m[1] || m[5] || "";
  let x = +m[2] + +m[3] / 60 + (m[4] ? +m[4] / 3600 : 0);
  if (h === "S" || h === "W") x = -x;
  return x;
}

function importWaypointsUI(id) {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".gpx,.csv,.txt,application/gpx+xml,text/csv";
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const m = getMission(id);
    if (!m) return;
    let wps = [];
    try { wps = parseWaypointFile(await file.text(), file.name); } catch { wps = []; }
    if (wps.length < 2) return toast("No route found. Use a GPX file or a CSV with name, lat and lon (or MGRS) columns.");
    const names = new Set();
    wps.forEach((w) => {
      let n = w.name.toUpperCase().slice(0, 24), k = 2;
      while (names.has(n)) n = `${w.name.toUpperCase().slice(0, 20)} ${k++}`;
      names.add(n);
      w.name = n;
    });
    const replace = !(m.legs || []).some((l) => l.from || l.to) || confirm(`Replace the ${m.legs.length} current legs with ${wps.length - 1} leg${wps.length > 2 ? "s" : ""} from ${file.name}? Cancel keeps your legs and only adds the waypoints, so you can use their names in legs.`);
    const keep = (m.wpts || []).filter((w) => !names.has(w.name));
    m.wpts = [...keep, ...wps.map((w) => ({ name: w.name, lat: +w.lat.toFixed(6), lon: +w.lon.toFixed(6) }))];
    if (replace) {
      const stamp = Date.now().toString(36);
      m.legs = wps.slice(1).map((w, i) => ({ id: `l${stamp}${i}`, from: wps[i].name, to: w.name, types: [], notes: "" }));
    }
    m.updated = Date.now();
    save();
    toast(replace ? `Imported ${wps.length} waypoints as ${wps.length - 1} leg${wps.length > 2 ? "s" : ""}` : `Added ${wps.length} waypoints. Use their names in your legs.`);
    go();
  };
  inp.click();
}

function waypointCsv(points) {
  const q = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const rows = [["Seq", "Name", "Latitude", "Longitude", "Lat DDM", "Lon DDM", "MGRS"]];
  points.forEach((p, i) => rows.push([i + 1, p.ident, p.lat.toFixed(6), p.lon.toFixed(6), fmtDdm(p.lat, "N", "S", 2), fmtDdm(p.lon, "E", "W", 3), MGRS.toMgrs(p.lat, p.lon)]));
  return rows.map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
}
function waypointGpx(name, points) {
  const x = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
  const pt = (tag, p) => `<${tag} lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><name>${x(p.ident)}</name><desc>${x(MGRS.toMgrs(p.lat, p.lon))}</desc></${tag}>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="AeroSignal" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${x(name)}</name></metadata>\n${points.map((p) => pt("wpt", p)).join("\n")}\n<rte><name>${x(name)}</name>\n${points.map((p) => pt("rtept", p)).join("\n")}\n</rte>\n</gpx>\n`;
}

const KB_NETS = ["Tower", "Ground", "Approach / departure", "Flight common", "Package common", "DASC / TAD", "Tanker", "JTAC / FAC(A)", "Escort", "LZ control", "Guard"];

function kbPrefs(m) {
  m.kb = m.kb || {};
  const k = m.kb;
  if (!(k.gs > 0)) k.gs = 140;
  if (typeof k.vari !== "string") k.vari = "";
  if (!k.mode) k.mode = "launch";
  k.legs = k.legs || {};
  return k;
}
function parseHHMM(s) {
  const m = String(s || "").trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return +m[1] * 60 + +m[2];
}
const kbHHMM = (min) => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}${String(t % 60).padStart(2, "0")}`;
};
const kbHM = (min) => { const t = Math.round(min); return `${Math.floor(t / 60)}+${String(t % 60).padStart(2, "0")}`; };
const mmss = (min) => {
  const s = Math.round(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
function trueCourse(a, b) {
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
  const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
function parseVar(s) {
  const m = String(s || "").trim().toUpperCase().match(/^(\d{1,2}(?:\.\d)?)\s*([EW])$/);
  if (!m) return null;
  return m[2] === "E" ? -+m[1] : +m[1];
}
const deg3 = (d) => String(Math.round(d) % 360 || 360).padStart(3, "0");

function kbCompute(m, route) {
  const k = kbPrefs(m);
  const legs = route.legs.filter((l) => l.a && l.b);
  const v = parseVar(k.vari);
  const rows = [];
  let cum = 0, dist = 0;
  legs.forEach((l, i) => {
    const lp = k.legs[l.leg.id] || {};
    const gs = +lp.gs > 0 ? +lp.gs : k.gs;
    const d = nm(l.a, l.b);
    const ete = (d / gs) * 60;
    const tc = trueCourse(l.a, l.b);
    const delay = Math.max(0, +lp.delay || 0);
    rows.push({ i, l, gs, d, ete, tc, mc: v == null ? null : (tc + v + 360) % 360, delay, depart: cum });
    cum += ete;
    dist += d;
    rows[i].arrive = cum;
    rows[i].cumDist = dist;
    cum += delay;
  });
  const launch = parseHHMM(m.launch);
  let t0 = launch;
  let totInfo = null;
  if (k.mode === "tot") {
    const tot = parseHHMM(k.totTime);
    const ti = Math.min(Math.max(0, +k.totLeg || 0), Math.max(0, rows.length - 1));
    if (tot != null && rows[ti]) {
      t0 = tot - rows[ti].arrive;
      totInfo = { ti, tot, launch: t0 };
    }
  }
  const burn = +k.burn > 0 ? +k.burn : null, fuel0 = +k.fuel > 0 ? +k.fuel : null;
  rows.forEach((r) => {
    r.eta = t0 == null ? null : t0 + r.arrive;
    r.etd = t0 == null ? null : t0 + r.depart;
    r.fuel = burn && fuel0 ? fuel0 - (burn * (r.arrive)) / 60 : null;
  });
  return { k, rows, t0, totInfo, total: cum, dist, broken: route.broken };
}

function pageKneeboard(el) {
  const id = (location.hash || "").split("/")[2];
  const m = id && getMission(id);
  if (!m) {
    el.innerHTML = `<div class="page"><h1>Kneeboard cards</h1><section class="panel"><p>Mission not found. Open a mission on the <a href="#/missions">Missions</a> page and choose Kneeboard cards.</p></section></div>`;
    return;
  }
  const k = kbPrefs(m);
  m.comm = Array.isArray(m.comm) && m.comm.length ? m.comm : KB_NETS.map((n) => ({ net: n, cs: "", freq: "", notes: "" }));
  el.innerHTML = `<div class="page kbpage">
    <div class="row kbtop" style="justify-content:space-between;align-items:flex-end">
      <div><a href="#/missions/${esc(id)}/plan" class="small">Back to the mission</a><h1 style="margin:4px 0 0">Kneeboard cards</h1>
      <p class="lede" style="margin:4px 0 0">${esc(m.name || "Mission")}${m.date ? ` · ${esc(m.date)}` : ""}</p></div>
      <div class="row" style="gap:8px"><button class="btn" id="kbPrint">Print cards</button><button class="btn sec sm" id="kbCsv">Waypoints CSV</button><button class="btn sec sm" id="kbGpx">Route GPX</button></div></div>
    <p class="kbwarn secwarn">Do not enter CUI or classified information. Real frequencies, callsigns and code words may be controlled. Use notional values in this prototype.</p>
    <section class="panel kbctl"><h2>Timing</h2>
      <div class="fields kbfields">
        <div><label for="kbGs">Planned groundspeed, kts</label><input id="kbGs" type="number" min="20" max="600" value="${k.gs}"></div>
        <div><label for="kbVar">Magnetic variation</label><input id="kbVar" placeholder="e.g. 11E" value="${esc(k.vari)}"></div>
        <div><label>Plan from</label><div class="seg sm" id="kbMode"><button type="button" data-v="launch">Launch time</button><button type="button" data-v="tot">TOT, back timed</button></div></div>
        <div id="kbLaunchBox"><label for="kbLaunch">Launch time</label><input id="kbLaunch" placeholder="HHMM" value="${esc((m.launch || "").replace(":", ""))}"></div>
        <div id="kbTotBox"><label for="kbTotPt">TOT at</label><select id="kbTotPt"></select></div>
        <div id="kbTotTimeBox"><label for="kbTot">TOT</label><input id="kbTot" placeholder="HHMM" value="${esc(k.totTime || "")}"></div>
        <div><label for="kbFuel">Fuel at launch, lbs (optional)</label><input id="kbFuel" type="number" min="0" step="100" value="${k.fuel || ""}"></div>
        <div><label for="kbBurn">Burn rate, lbs/hr (optional)</label><input id="kbBurn" type="number" min="0" step="50" value="${k.burn || ""}"></div>
      </div>
      <p class="small muted" style="margin:8px 0 0">Set a groundspeed or delay on any leg in the navlog below, for example time on deck at an LZ or a hold. Times use the same clock as the mission launch time. Courses are great circle initial courses; verify against JMPS or your charts.</p>
    </section>
    <div id="kbCards" class="loading">Building the cards</div>
  </div>`;

  const seg = $("#kbMode");
  const showMode = () => {
    $$("button", seg).forEach((b) => b.setAttribute("aria-pressed", b.dataset.v === k.mode));
    $("#kbTotBox").hidden = $("#kbTotTimeBox").hidden = k.mode !== "tot";
    $("#kbLaunchBox").hidden = k.mode === "tot";
  };
  showMode();

  let route = null;
  const persist = () => { m.updated = Date.now(); save(); };
  const render = () => {
    if (!route) return;
    const c = kbCompute(m, route);
    const box = $("#kbCards");
    if (!document.body.contains(box)) return;
    const pts = route.points;
    const sel = $("#kbTotPt");
    sel.innerHTML = c.rows.map((r) => `<option value="${r.i}">${esc(r.l.b.ident)} (leg ${r.i + 1})</option>`).join("");
    const defTot = c.rows.findIndex((r) => /^(OBJ|LZ|HLZ|TGT)\b/i.test(r.l.b.ident));
    if (k.totLeg == null && defTot >= 0) k.totLeg = defTot;
    sel.value = String(Math.min(+k.totLeg || 0, Math.max(0, c.rows.length - 1)));
    if (!c.rows.length) {
      box.className = "empty";
      box.innerHTML = `<section class="panel"><p>No legs resolve yet. On the mission Plan tab give each leg a from and to point.</p></section>`;
      return;
    }
    const t = (x) => (x == null ? "" : kbHHMM(x));
    const ac = (m.aircraft || []).filter((a) => a.callsign || a.type);
    const cw = m.brief && m.brief.v ? Object.entries(m.brief.v).filter(([key, val]) => /^Command and signal\|/i.test(key) && String(val || "").trim()) : [];
    box.className = "";
    box.innerHTML = `
      ${c.broken ? `<p class="note">Some legs did not resolve and are left off the cards. Check the Plan tab.</p>` : ""}
      ${c.totInfo ? `<div class="kbsum"><span>Launch NLT</span><b>${kbHHMM(c.totInfo.launch)}</b><span>for TOT ${kbHHMM(c.totInfo.tot)} at ${esc(c.rows[c.totInfo.ti].l.b.ident)}</span></div>` : ""}
      <article class="kbcard" id="kbNav"><header><b>NAVLOG</b><span>${esc(m.name || "")}</span></header>
        <div class="kbmeta"><span>GS ${c.k.gs} kts</span><span>${c.k.vari ? `VAR ${esc(c.k.vari.toUpperCase())}` : "VAR not set, MC blank"}</span><span>${fmt(Math.round(c.dist))} nm</span><span>${kbHM(c.total)} total</span>${c.t0 != null ? `<span>Launch ${kbHHMM(c.t0)}</span>` : ""}</div>
        <div class="scroll"><table class="t kbt"><thead><tr><th>#</th><th>To</th><th>TC</th><th>MC</th><th>NM</th><th>GS</th><th>ETE</th><th>ETA</th><th>Delay</th>${c.rows.some((r) => r.fuel != null) ? "<th>Fuel</th>" : ""}</tr></thead><tbody>
        ${c.rows.map((r) => `<tr${c.totInfo && c.totInfo.ti === r.i ? ' class="kbtot"' : ""}><td>${r.i + 1}</td><td class="mono">${esc(r.l.b.ident)}</td><td>${deg3(r.tc)}</td><td>${r.mc == null ? "" : deg3(r.mc)}</td><td>${r.d.toFixed(1)}</td>
          <td><input class="kbin" data-leg="${esc(r.l.leg.id)}" data-f="gs" type="number" min="20" max="600" value="${(k.legs[r.l.leg.id] || {}).gs || ""}" placeholder="${c.k.gs}" aria-label="Groundspeed leg ${r.i + 1}"></td>
          <td>${mmss(r.ete)}</td><td class="mono"><b>${t(r.eta)}</b></td>
          <td><input class="kbin" data-leg="${esc(r.l.leg.id)}" data-f="delay" type="number" min="0" max="600" value="${(k.legs[r.l.leg.id] || {}).delay || ""}" placeholder="0" aria-label="Delay minutes at end of leg ${r.i + 1}"></td>
          ${r.fuel != null ? `<td class="${r.fuel < 0 ? "kbneg" : ""}">${fmt(Math.round(r.fuel))}</td>` : ""}</tr>`).join("")}
        </tbody></table></div>
        <p class="kbfoot">From ${esc(c.rows[0].l.a.ident)}. Delay is minutes held at the end of the leg (LZ time, hold). ETA is arrival at the point.</p>
      </article>
      <article class="kbcard" id="kbWpt"><header><b>WAYPOINTS</b><span>${esc(m.name || "")}</span></header>
        <div class="scroll"><table class="t kbt"><thead><tr><th>#</th><th>Name</th><th>Lat / Lon</th><th>MGRS</th></tr></thead><tbody>
        ${pts.map((p, i) => `<tr><td>${i}</td><td class="mono">${esc(p.ident)}</td><td class="mono">${llDdm(p)}</td><td class="mono">${MGRS.toMgrs(p.lat, p.lon)}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="kbfoot">WGS84. Lat and lon in degrees and decimal minutes.</p>
      </article>
      <article class="kbcard" id="kbComm"><header><b>COMM CARD</b><span>${esc(m.name || "")}</span></header>
        ${ac.length ? `<div class="kbmeta">${ac.map((a) => `<span>${esc(a.callsign || "")}${a.type ? ` ${esc(a.type)}` : ""}</span>`).join("")}</div>` : ""}
        <div class="scroll"><table class="t kbt kbcomm"><thead><tr><th>Net</th><th>Callsign</th><th>Freq / chan</th><th>Notes</th><th class="kbctl"></th></tr></thead><tbody>
        ${m.comm.map((r, i) => `<tr><td><input class="kbc" data-i="${i}" data-f="net" value="${esc(r.net || "")}" aria-label="Net"></td><td><input class="kbc" data-i="${i}" data-f="cs" value="${esc(r.cs || "")}" aria-label="Callsign"></td><td><input class="kbc mono" data-i="${i}" data-f="freq" value="${esc(r.freq || "")}" aria-label="Frequency or channel"></td><td><input class="kbc" data-i="${i}" data-f="notes" value="${esc(r.notes || "")}" aria-label="Notes"></td><td class="kbctl"><button type="button" class="linkbtn kbdel" data-i="${i}" aria-label="Remove row">×</button></td></tr>`).join("")}
        </tbody></table></div>
        <div class="kbctl" style="margin-top:8px"><button type="button" class="btn sec sm" id="kbAddRow">Add row</button></div>
        ${cw.length ? `<div class="kbbrief">${cw.map(([key, val]) => `<div><b>${esc(key.split("|")[1])}</b><div>${esc(val)}</div></div>`).join("")}</div>` : ""}
        <p class="kbfoot">Comm entries save with the mission. Briefing notes come from the Command and signal section of the brief.</p>
      </article>`;
  };

  const rerenderKeepFocus = () => {
    const a = document.activeElement;
    const key = a && a.dataset && a.dataset.leg ? `[data-leg="${a.dataset.leg}"][data-f="${a.dataset.f}"]` : null;
    render();
    if (key) { const n = document.querySelector(key); if (n) { n.focus(); } }
  };

  $("#kbCards").addEventListener("change", (e) => {
    const t = e.target;
    if (t.classList.contains("kbin")) {
      const lp = (k.legs[t.dataset.leg] = k.legs[t.dataset.leg] || {});
      const v = +t.value;
      if (t.value === "" || !(v >= 0)) delete lp[t.dataset.f]; else lp[t.dataset.f] = v;
      persist();
      rerenderKeepFocus();
    } else if (t.classList.contains("kbc")) {
      m.comm[+t.dataset.i][t.dataset.f] = t.value.slice(0, 80);
      persist();
    }
  });
  $("#kbCards").addEventListener("click", (e) => {
    if (e.target.id === "kbAddRow") { m.comm.push({ net: "", cs: "", freq: "", notes: "" }); persist(); render(); }
    const d = e.target.closest(".kbdel");
    if (d) { m.comm.splice(+d.dataset.i, 1); persist(); render(); }
  });
  seg.onclick = (e) => { const v = e.target.dataset && e.target.dataset.v; if (v) { k.mode = v; persist(); showMode(); render(); } };
  $("#kbGs").onchange = (e) => { k.gs = Math.max(20, +e.target.value || 140); persist(); render(); };
  $("#kbVar").onchange = (e) => {
    const v = e.target.value.trim();
    if (v && parseVar(v) == null) { toast("Enter variation like 11E or 3W"); e.target.value = k.vari; return; }
    k.vari = v.toUpperCase(); persist(); render();
  };
  $("#kbLaunch").onchange = (e) => {
    const t = parseHHMM(e.target.value);
    if (e.target.value && t == null) { toast("Enter launch as HHMM"); return; }
    m.launch = t == null ? "" : `${kbHHMM(t).slice(0, 2)}:${kbHHMM(t).slice(2)}`; persist(); render();
  };
  $("#kbTot").onchange = (e) => {
    if (e.target.value && parseHHMM(e.target.value) == null) { toast("Enter TOT as HHMM"); return; }
    k.totTime = e.target.value.replace(":", ""); persist(); render();
  };
  $("#kbTotPt").onchange = (e) => { k.totLeg = +e.target.value; persist(); render(); };
  $("#kbFuel").onchange = (e) => { k.fuel = +e.target.value || null; persist(); render(); };
  $("#kbBurn").onchange = (e) => { k.burn = +e.target.value || null; persist(); render(); };
  $("#kbPrint").onclick = () => window.print();
  const fname = (m.name || "mission").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  $("#kbCsv").onclick = () => route && route.points.length && download(`${fname}_waypoints.csv`, waypointCsv(route.points), "text/csv");
  $("#kbGpx").onclick = () => route && route.points.length && download(`${fname}_route.gpx`, waypointGpx(m.name || "Route", route.points), "application/gpx+xml");

  missionRoute(m).then((r) => { route = r; render(); }).catch(() => {
    const b = $("#kbCards");
    if (b) { b.className = "note"; b.textContent = "Could not resolve the route. Check the connection and try again."; }
  });
}
ROUTES.kneeboard = pageKneeboard;
if ((location.hash || "").startsWith("#/kneeboard") || (location.hash || "").startsWith("#/missions")) go();
