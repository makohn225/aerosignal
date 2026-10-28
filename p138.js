"use strict";
/* p138: runway closures on the flight brief. Garmin Pilot and ForeFlight draw NOTAM closures on airport
   diagrams; AeroSignal now does the same for the departure, destination and alternate.
   1. Reads the FAA NOTAMs the brief already loads (same notams relay call as p70, so the browser cache
      answers it) and keeps the runway and airport closures in effect at that airport's own time: the
      departure time for the departure, the arrival time for the destination, the hour after arrival for
      the alternate.
   2. Draws a runway sketch for each airport from public runway end positions (rwyends, OurAirports):
      a closed runway gets red X marks like the FAA closed runway marking, a runway end closed to
      takeoff or landing gets a red label, a closure with conditions or hours is amber, and the wind
      arrow comes from the brief's own weather (p83).
   3. Cross checks Runway winds (p83): when the runway the wind favors is closed at your time, it says
      so and names the best open runway with its headwind and crosswind.
   4. One line in the bottom line card (.bf-cl), read by the verdict (p107): an airport or every runway
      closed is red, the wind runway closed or a closure with conditions is amber. No line when there
      is nothing closed.
   The panel sits after Runway length (p86), else after Diversions (p84), else after Runway winds (p83);
   nothing positions itself after Runway length. The FAA NOTAM text is one tap away on every line and
   governs. Adds a demo tour sentence and a narrated tutorial scene (device voice until a recording
   is made). */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #clPanel .cl-ap{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:10px 16px;padding:12px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #clPanel .cl-ap:first-of-type{border-top:0;padding-top:4px}
    #clPanel .cl-hd{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline}
    #clPanel .cl-hd b{font:700 15px var(--mono,monospace)}
    #clPanel svg{width:100%;height:auto;max-width:190px;display:block;border:1px solid var(--line2,rgba(255,255,255,.1));border-radius:12px;background:rgba(127,127,127,.06)}
    #clPanel svg text{font:700 10px var(--mono,monospace);fill:var(--ink2,#9fb0c8)}
    #clPanel svg text.x{fill:#ff4d6a}
    #clPanel ul{list-style:none;margin:6px 0 0;padding:0}
    #clPanel li{padding:6px 0;font-size:14px;line-height:1.45;border-top:1px solid var(--line2,rgba(255,255,255,.06))}
    #clPanel li:first-child{border-top:0}
    #clPanel .tg{display:inline-block;font:700 10.5px var(--mono,monospace);letter-spacing:.5px;padding:1px 7px;border-radius:999px;border:1px solid currentColor;margin-right:6px;vertical-align:1px}
    #clPanel .t-x{color:#ff4d6a}#clPanel .t-c{color:#ffb648}#clPanel .t-i{color:var(--ink2,#9fb0c8)}
    #clPanel .wh{display:block;font-size:12.5px;color:var(--ink2,#9fb0c8)}
    #clPanel details.raw summary{font-size:12px;color:var(--cyan,#3DE0FF);cursor:pointer;margin-top:2px}
    #clPanel details.raw pre{white-space:pre-wrap;word-break:break-word;font:12px/1.45 var(--mono,monospace);margin:4px 0 0;color:var(--ink2,#9fb0c8)}
    #clPanel .cl-wind{margin:8px 0 0;font-size:14px;line-height:1.45}
    #clPanel .bad{color:#ff4d6a;font-weight:700}#clPanel .warn{color:#ffb648;font-weight:700}#clPanel .ok{color:#46e39b;font-weight:700}
    #clPanel .disc{margin:12px 0 0;font-weight:700;color:#ff4d6a;font-size:12.5px;line-height:1.4}
    #clPanel .cl-key{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--ink2,#9fb0c8);margin-top:6px}
    #clPanel .cl-key i{display:inline-block;width:18px;height:5px;border-radius:2px;vertical-align:middle;margin-right:4px}
    #bfBluf .bf-cl{margin:2px 0 4px;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-cl .bad{color:#ff4d6a;font-weight:700}#bfBluf .bf-cl .warn{color:#ffb648;font-weight:700}
    @media (max-width:560px){#clPanel .cl-ap{grid-template-columns:minmax(0,1fr)}#clPanel svg{max-width:220px;margin:0 auto}}
  `;
  document.head.appendChild(css);

  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const onBrief = () => /^#\/brief(\/|$|\?)/.test(location.hash || "");
  const up = (n) => Math.ceil(Math.abs(n));
  const hhmmZ = (ms) => { const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}Z`; };
  const fmt = (ms) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  /* Runway identifiers: "06" and "6" are the same end */
  const norm = (id) => { const m = /^0*(\d{1,2})([LRC]?)$/i.exec(String(id || "").trim()); return m ? `${+m[1]}${m[2].toUpperCase()}` : String(id || "").toUpperCase(); };

  /* Which airports, and the time that matters at each */
  function airports(f) {
    const pts = f.points || [], out = [];
    const id = (p) => (p ? String(p.ident || "").toUpperCase() : "");
    const dep = pts[0], dst = pts[pts.length - 1];
    let prof = null; try { prof = profile(f); } catch {}
    const d0 = prof && prof.depLocal ? +new Date(prof.depLocal) : +new Date(`${f.date}T${f.time || "12:00"}:00`);
    const t0 = isFinite(d0) ? d0 : Date.now();
    const a0 = prof && prof.arrLocal ? +new Date(prof.arrLocal) : t0 + 36e5;
    const t1 = isFinite(a0) ? a0 : t0 + 36e5;
    if (dep && dep.kind === "airport") out.push({ role: "Departure", code: id(dep), op: "takeoff", w: [t0 - 30 * 60e3, t0 + 30 * 60e3], at: t0, when: "departure" });
    if (dst && dst.kind === "airport" && id(dst) !== id(dep)) out.push({ role: "Destination", code: id(dst), op: "landing", w: [t1 - 30 * 60e3, t1 + 60 * 60e3], at: t1, when: "arrival" });
    else if (dst && dst !== dep && dst.kind === "airport" && out.length === 1) out.push({ role: "Return", code: id(dst), op: "landing", w: [t1 - 30 * 60e3, t1 + 60 * 60e3], at: t1, when: "return" });
    const alt = String(f.alternate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (alt) { const c = alt.length === 3 ? "K" + alt : alt; if (!out.some((x) => x.code === c)) out.push({ role: "Alternate", code: c, op: "landing", w: [t1, t1 + 2 * 36e5], at: t1 + 36e5, when: "possible diversion" }); }
    return out;
  }

  /* Read one NOTAM. Returns null when it is not a runway or airport closure. */
  const TIME_TAIL = /\s*\d{10}(EST)?\s*-\s*(\d{10}(EST)?|PERM)\.?\s*$/;
  function parse(n) {
    const raw = String(n.text || "").replace(/\s+/g, " ").trim();
    const x = raw.replace(TIME_TAIL, "").trim();
    let m = /^RWY ((?:\d{1,2}[LRC]?)(?:\/\d{1,2}[LRC]?)?) CLSD\b\s*(.*)$/.exec(x);
    if (m) {
      const ends = m[1].split("/").map(norm), rest = m[2].trim();
      let kind, label;
      if (!rest) { kind = "closed"; label = "Closed"; }
      else if (/^EXC TAX\b/.test(rest) && !/\b(DLY|MON|TUE|WED|THU|FRI|SAT|SUN|\d{4}-\d{4})\b/.test(rest)) { kind = "closed"; label = "Closed except taxiing"; }
      else if (/^TO (TKOF AND LDG|LDG AND TKOF)$/.test(rest)) { kind = "closed"; label = "Closed to takeoff and landing"; }
      else if (/^TO LDG$/.test(rest)) { kind = "noland"; label = "Closed to landing"; }
      else if (/^TO TKOF$/.test(rest)) { kind = "notko"; label = "Closed to takeoff"; }
      else { kind = "cond"; label = "Closed at times or with conditions"; }
      return { type: "rwy", ends, disp: m[1], pair: ends.length === 2, kind, label, raw };
    }
    m = /^AD AP CLSD\b\s*(.*)$/.exec(x);
    if (m) return { type: "ad", kind: m[1].trim() ? "cond" : "closed", label: m[1].trim() ? "Airport closed to some traffic or at times" : "Airport closed", raw };
    if (/^TWY\b.*\bCLSD\b/.test(x)) return { type: "twy", kind: "info", label: "Taxiway closed", raw };
    return null;
  }
  const hits = (c, op) => c.kind === "closed" || c.kind === "cond" || (op === "landing" && c.kind === "noland") || (op === "takeoff" && c.kind === "notko");
  const endClosed = (list, op, end) => list.find((c) => c.type === "rwy" && c.ends.includes(norm(end)) && hits(c, op));

  /* Data: NOTAMs (same request p70 makes), runway ends, and the brief's runway winds */
  const memo = new Map();
  function once(key, fn, ttl) {
    const m = memo.get(key);
    if (m && Date.now() - m.at < ttl) return m.p;
    const p = fn().catch((e) => { memo.delete(key); throw e; });
    memo.set(key, { at: Date.now(), p });
    return p;
  }
  function notamIds(f) {
    try { if (window.AeroNotams && AeroNotams.places) return AeroNotams.places(f); } catch {}
    return airports(f).map((a) => a.code);
  }
  const waitNt = (f) => new Promise((res) => {
    const t0 = Date.now();
    (function poll() {
      const s = document.getElementById("ntPanel");
      const k = s && s.dataset.k;
      if ((k && !/[le]$/.test(k) && k.startsWith(String(f.id))) || Date.now() - t0 > 5000) return res();
      setTimeout(poll, 250);
    })();
  });

  async function load(f) {
    const aps = airports(f);
    if (!aps.length) return { aps: [] };
    const ids = notamIds(f);
    const ntP = waitNt(f).then(() => once("nt:" + ids.join(","), () => fnGet("notams?ids=" + encodeURIComponent(ids.join(","))), 9 * 60e3));
    const reP = once("re:" + aps.map((a) => a.code).join(","), () => fnGet("rwyends?ids=" + encodeURIComponent(aps.map((a) => a.code).join(","))), 6 * 36e5).catch(() => null);
    const rwP = window.AeroRunways && AeroRunways.load ? AeroRunways.load(f).catch(() => null) : Promise.resolve(null);
    let nt = null, ntErr = false;
    try { nt = await ntP; } catch { ntErr = true; }
    const [re, rw] = await Promise.all([reP, rwP]);
    const out = [];
    for (const a of aps) {
      const t = (s) => { const q = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d)(\d\d)/.exec(s || ""); return q ? Date.UTC(+q[3], +q[1] - 1, +q[2], +q[4], +q[5]) : null; };
      const list = [];
      const seen = new Set();
      const src = nt && nt.notams ? (nt.notams[a.code] || nt.notams[a.code.replace(/^K/, "")] || []) : [];
      for (const n of src) {
        const c = parse(n);
        if (!c) continue;
        const k = (n.num || "") + c.raw.slice(0, 60);
        if (seen.has(k)) continue;
        seen.add(k);
        const s = t(n.start), e = /PERM/.test(n.end || "") ? Infinity : t(n.end);
        if (s != null && s > a.w[1]) continue;
        if (e != null && e < a.w[0]) continue;
        list.push({ ...c, num: n.num || "", s, e });
      }
      const rows = re && re.rows ? (re.rows[a.code] || []) : [];
      const w = rw && rw.res ? rw.res.find((x) => x.code === a.code) : null;
      // Wind runway against the closures
      let wind = null;
      if (w && w.best && w.c) {
        const shut = endClosed(list, a.op, w.best.id);
        if (shut) {
          const pool0 = (w.ends || []).filter((e) => !endClosed(list, a.op, e.id));
          const pool = pool0.filter((e) => e.len >= 1500).length ? pool0.filter((e) => e.len >= 1500) : pool0;
          const alt = [...pool].sort((x, y) => (y.head - x.head) || (x.gx - y.gx) || (y.len - x.len))[0] || null;
          wind = { best: w.best, shut, alt, g: w.g };
        } else wind = { best: w.best, ok: true };
      }
      const rwyClosed = list.filter((c) => c.type === "rwy" && hits(c, a.op) && c.kind !== "cond");
      const allEnds = (w && w.ends && w.ends.length ? w.ends.map((e) => e.id) : rows.flatMap((r) => [r.le && r.le.id, r.he && r.he.id])).filter((id) => id && !/^H/i.test(id));
      const allShut = allEnds.length > 0 && allEnds.every((id) => rwyClosed.some((c) => c.ends.includes(norm(id))));
      const adShut = list.some((c) => c.type === "ad" && c.kind === "closed");
      out.push({ ...a, list, rows, wind, allShut, adShut, wx: w && w.c ? w.c : null });
    }
    return { aps: out, ntErr };
  }

  /* Runway sketch */
  function sketch(a) {
    const rows = (a.rows || []).filter((r) => r.le && r.he && isFinite(r.le.lat) && isFinite(r.he.lat) && isFinite(r.le.lon) && isFinite(r.he.lon) && !r.closed && !/^H/i.test(r.le.id || ""));
    if (!rows.length) return "";
    const lat0 = rows.reduce((s, r) => s + r.le.lat + r.he.lat, 0) / (rows.length * 2);
    const k = Math.cos((lat0 * Math.PI) / 180);
    const P = (p) => [p.lon * k * 60, -p.lat * 60];
    const segs = rows.map((r) => ({ r, a: P(r.le), b: P(r.he) }));
    const xs = segs.flatMap((s) => [s.a[0], s.b[0]]), ys = segs.flatMap((s) => [s.a[1], s.b[1]]);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const W = 190, pad = 26, span = Math.max(maxx - minx, maxy - miny, 0.05);
    const sc = (W - pad * 2) / span;
    const ox = pad + ((W - pad * 2) - (maxx - minx) * sc) / 2, oy = pad + ((W - pad * 2) - (maxy - miny) * sc) / 2;
    const X = (p) => [ox + (p[0] - minx) * sc, oy + (p[1] - miny) * sc];
    let g = "";
    const placed = [];
    for (const s of segs) {
      const A = X(s.a), B = X(s.b);
      const le = norm(s.r.le.id), he = norm(s.r.he.id);
      const full = a.list.find((c) => c.type === "rwy" && c.pair && c.ends.includes(le) && c.ends.includes(he) && c.kind === "closed");
      const cond = a.list.find((c) => c.type === "rwy" && (c.ends.includes(le) || c.ends.includes(he)) && c.kind === "cond");
      const col = full ? "#ff4d6a" : cond ? "#ffb648" : "var(--ink2,#9fb0c8)";
      g += `<line x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="${col}" stroke-width="7" stroke-linecap="butt"${cond && !full ? ' stroke-dasharray="10 5"' : ""}/>`;
      if (full) {
        for (const f of [0.25, 0.5, 0.75]) {
          const cx = A[0] + (B[0] - A[0]) * f, cy = A[1] + (B[1] - A[1]) * f;
          g += `<path d="M${(cx - 5).toFixed(1)} ${(cy - 5).toFixed(1)}L${(cx + 5).toFixed(1)} ${(cy + 5).toFixed(1)}M${(cx + 5).toFixed(1)} ${(cy - 5).toFixed(1)}L${(cx - 5).toFixed(1)} ${(cy + 5).toFixed(1)}" stroke="#fff" stroke-width="2.4"/>`;
        }
      }
      // Each end's number sits just beyond its threshold
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, ux = (B[0] - A[0]) / len, uy = (B[1] - A[1]) / len;
      for (const [P0, u, id, raw] of [[A, -1, le, s.r.le.id], [B, 1, he, s.r.he.id]]) {
        const bx = P0[0] + ux * u * 12, by = P0[1] + uy * u * 12 + 3.5;
        let tx = bx, ty = by;
        // Slide a number sideways when it would sit on top of another one
        for (const o of [0, 14, -14, 26, -26]) {
          tx = Math.min(W - 12, Math.max(12, bx - uy * o)); ty = Math.min(W - 4, Math.max(12, by + ux * o));
          if (!placed.some(([px, py]) => Math.abs(px - tx) < 20 && Math.abs(py - ty) < 11)) break;
        }
        placed.push([tx, ty]);
        const shut = endClosed(a.list, a.op, id);
        const pick = a.wind ? (a.wind.shut ? a.wind.alt : a.wind.best) : null, best = pick && norm(pick.id) === id;
        g += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" class="${shut ? "x" : ""}"${best && !shut ? ' style="fill:#46e39b"' : ""}>${h(raw)}</text>`;
      }
    }
    // Wind arrow from the brief's weather, pointing the way the wind blows
    if (a.wx && a.wx.wind && a.wx.dir !== "VRB" && isFinite(+a.wx.dir)) {
      const to = ((+a.wx.dir + 180) % 360) * Math.PI / 180, cx = W - 30, cy = 20, L = 12;
      const dx = Math.sin(to) * L, dy = -Math.cos(to) * L;
      g += `<g stroke="#3DE0FF" stroke-width="2" fill="#3DE0FF"><line x1="${(cx - dx).toFixed(1)}" y1="${(cy - dy).toFixed(1)}" x2="${(cx + dx).toFixed(1)}" y2="${(cy + dy).toFixed(1)}"/><circle cx="${(cx + dx).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" r="2.6"/></g><text x="${cx}" y="${cy + 26}" text-anchor="middle" style="fill:#3DE0FF">${String(a.wx.dir).padStart(3, "0")}° ${h(a.wx.wind)} kt</text>`;
    }
    g += `<text x="10" y="16" style="fill:var(--ink2,#9fb0c8)">N ↑</text>`;
    return `<svg viewBox="0 0 ${W} ${W}" role="img" aria-label="Runway sketch for ${h(a.code)}">${g}</svg>`;
  }

  function when(c) {
    const from = c.s && c.s > Date.now() ? `From ${fmt(c.s)}. ` : "";
    const to = c.e === Infinity ? "Permanent" : c.e ? `Until ${fmt(c.e)}` : "";
    return from + to;
  }
  function item(c) {
    const cls = c.kind === "info" ? "t-i" : c.kind === "cond" ? "t-c" : "t-x";
    const what = c.type === "rwy" ? `Runway ${c.disp}` : c.type === "ad" ? "Airport" : "Taxiway";
    let plainTxt = c.raw;
    try { if (window.AeroNotams && AeroNotams.plain) plainTxt = AeroNotams.plain(c.raw); } catch {}
    return `<li><span class="tg ${cls}">${h(what)}</span><b>${h(c.label)}.</b> ${h(plainTxt)}<span class="wh">${h(when(c))}${c.num ? ` · NOTAM ${h(c.num)}` : ""}</span><details class="raw"><summary>FAA text</summary><pre>${h(c.raw)}</pre></details></li>`;
  }

  function windLine(a) {
    const w = a.wind;
    if (!w) return "";
    if (w.ok) return `<p class="cl-wind">Wind favors runway <b>${h(w.best.id)}</b>, which is open at your ${h(a.when)} time.</p>`;
    const alt = w.alt;
    const altTxt = alt ? ` Best open runway: <b>${h(alt.id)}</b>, ${alt.head >= 0 ? `headwind ${up(alt.head)} kt` : `<span class="bad">tailwind ${up(alt.head)} kt</span>`}, crosswind ${up(alt.cross)} kt${w.g ? ` (${up(alt.gx)} kt in gusts)` : ""}, ${Math.ceil((alt.len || 0) / 100) * 100} ft.` : ` <span class="bad">No open runway end found for ${h(a.op)}.</span>`;
    return `<p class="cl-wind"><span class="warn">Wind favors runway ${h(w.best.id)}, but a NOTAM closes it${w.shut.kind === "cond" ? " at times or with conditions" : ""} around your ${h(a.when)} time.</span>${altTxt}</p>`;
  }

  function paint(sec, r) {
    const intro = (txt) => `<h2>Runway closures</h2><p class="small muted" style="margin:0 0 6px">${txt}</p>`;
    if (!r) { sec.innerHTML = intro("Checking NOTAMs for closed runways at your airports…"); return; }
    if (!r.aps.length) { sec.innerHTML = intro("Add a departure and destination airport to check for closed runways."); return; }
    const total = r.aps.reduce((n, a) => n + a.list.filter((c) => c.type !== "twy").length, 0);
    const top = r.ntErr ? "Could not reach the FAA NOTAM service, so closures are not checked. Check NOTAMs with Flight Service at 1800wxbrief.com."
      : total ? `${total} runway or airport ${total === 1 ? "closure" : "closures"} in effect around your times at ${h(r.aps.map((a) => a.code).join(", "))}.`
      : `No runway or airport closures in the NOTAMs around your times at ${h(r.aps.map((a) => a.code).join(", "))}.`;
    const blocks = r.aps.map((a) => {
      const rw = a.list.filter((c) => c.type !== "twy"), tw = a.list.filter((c) => c.type === "twy");
      const flag = a.adShut ? `<p class="bad" style="margin:6px 0 0">The airport is closed by NOTAM around your ${h(a.when)} time.</p>` : a.allShut ? `<p class="bad" style="margin:6px 0 0">Every runway is closed to ${h(a.op)} around your ${h(a.when)} time.</p>` : "";
      const pic = sketch(a);
      return `<div class="cl-ap"><div><div class="cl-hd"><span><b>${h(a.code)}</b></span><span class="small muted">${h(a.role)} · checked for ${hhmmZ(a.at)}</span></div>
        ${flag}${r.ntErr ? "" : rw.length ? `<ul>${rw.map(item).join("")}</ul>` : `<p class="small" style="margin:6px 0 0"><span class="ok">No runway closures</span> in the NOTAMs for this time.</p>`}
        ${windLine(a)}
        ${tw.length ? `<details class="raw"><summary>${tw.length} taxiway ${tw.length === 1 ? "closure" : "closures"}</summary><ul>${tw.map(item).join("")}</ul></details>` : ""}
      </div><div>${pic || `<p class="small muted" style="margin:0">No runway positions for a sketch.</p>`}</div></div>`;
    }).join("");
    sec.innerHTML = `${intro(top)}${blocks}
      <div class="cl-key"><span><i style="background:#ff4d6a"></i>Closed (X marks)</span><span><i style="background:#ffb648"></i>Closed at times or with conditions</span><span><i style="background:var(--ink2,#9fb0c8)"></i>Open</span><span style="color:#46e39b">Green number: best open runway for the wind</span><span style="color:#ff4d6a">Red number: end closed for your use</span></div>
      <p class="disc">Planning aid only. The sketch is drawn from public runway positions, is not an airport diagram and must not be used to taxi. The FAA NOTAM text governs. Check NOTAMs with Flight Service and listen to the ATIS before you fly.</p>`;
  }

  function bluf(page, r) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    let el = card.querySelector(".bf-cl");
    const parts = [];
    let sev = "";
    for (const a of (r && !r.ntErr ? r.aps : [])) {
      if (a.adShut) { parts.push(`<span class="bad">${h(a.code)} airport closed</span>`); sev = "bad"; continue; }
      if (a.allShut) { parts.push(`<span class="bad">${h(a.code)} every runway closed</span>`); sev = "bad"; continue; }
      const bits = [];
      if (a.wind && a.wind.shut) { bits.push(`<span class="warn">wind runway ${h(a.wind.best.id)} closed${a.wind.alt ? `, use ${h(a.wind.alt.id)}` : ""}</span>`); if (!sev) sev = "warn"; }
      const cond = a.list.filter((c) => (c.type === "rwy" || c.type === "ad") && c.kind === "cond");
      const shut = a.list.filter((c) => c.type === "rwy" && c.kind !== "cond" && hits(c, a.op) && !(a.wind && a.wind.shut === c));
      if (shut.length) bits.push(`${shut.map((c) => h(c.disp)).join(", ")} closed`);
      if (cond.length) { bits.push(`<span class="warn">${cond.length} with conditions or hours</span>`); if (!sev) sev = "warn"; }
      if (bits.length) parts.push(`${h(a.code)} ${bits.join(", ")}`);
    }
    if (!parts.length) { if (el) el.remove(); return; }
    const html = `Runway closures: ${parts.join("; ")}. <a href="#" data-cl="1">Details</a>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-cl"; const after = card.querySelector(".bf-nt") || card.querySelector(".bf-rw") || card.querySelector(".bf-wx"); if (after) after.after(el); else card.appendChild(el); }
    el.dataset.v = html; el.innerHTML = html;
    el.querySelector("[data-cl]").onclick = jump;
    void sev;
  }
  function jump(e) {
    if (e) e.preventDefault();
    const s = document.getElementById("clPanel");
    if (!s) return;
    if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true);
    s.style.scrollMarginTop = "84px";
    s.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  let busy = false, tm = 0;
  const last = { key: "", r: null };
  function apply() {
    if (busy || !onBrief()) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId || !(f.points || []).length || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${f.alternate || ""}|${f.date}|${f.time}|${(f.wxText || "").length}`;
      let sec = page.querySelector(":scope > #clPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "clPanel"; sec.dataset.k = ""; }
      if (last.key !== key) {
        last.key = key; last.r = null;
        load(f).then((r) => { if (last.key === key) { last.r = r; kick(); } }).catch(() => { if (last.key === key) { last.r = { aps: airports(f).map((a) => ({ ...a, list: [], rows: [] })), ntErr: true }; kick(); } });
      }
      const stamp = `${key}|${last.r ? 1 : 0}`;
      if (sec.dataset.k !== stamp) { sec.dataset.k = stamp; paint(sec, last.r); }
      bluf(page, last.r);
      // After Runway length (p86), else Diversions (p84), else Runway winds (p83)
      const anchor = page.querySelector(":scope > #pfPanel") || page.querySelector(":scope > #dvPanel") || page.querySelector(":scope > #rwPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) { const g = page.querySelector(":scope > #goPanel"); if (g) g.after(sec); else page.appendChild(sec); }
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#clPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#clPanel"; a.textContent = "Closures"; a.onclick = jump;
        const w = j.querySelector('[data-s="#rwPanel"]'); if (w) w.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  // Debounce, but never wait more than about a second while the page keeps changing
  let first = 0;
  const kick = () => { clearTimeout(tm); const now = Date.now(); if (!first) first = now; tm = setTimeout(() => { first = 0; apply(); }, Math.max(0, Math.min(350, 1000 - (now - first)))); };
  new MutationObserver((l) => {
    if (busy) return;
    if (l.every((m) => m.target.closest && m.target.closest("#clPanel, #bfBluf .bf-cl"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroClosures = { parse, airports, load };

  // Demo tour and narrated tutorial
  try {
    if (typeof TOURS !== "undefined") {
      for (const k of ["civil", "military"]) {
        const st = TOURS[k] && TOURS[k].steps;
        if (!Array.isArray(st) || st._p138) continue;
        st._p138 = true;
        const i = st.findIndex((s) => s[0] === "#/brief");
        if (i >= 0) st[i] = [st[i][0], st[i][1], `${st[i][2]} Runway closures draws each airport's runways, marks any runway a NOTAM closes at your time with red X marks, and names the best open runway when the wind runway is closed.`];
      }
    }
  } catch (e) { console.error(e); }
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    for (const k of ["civil", "military"]) {
      const sc = T && T[k] && T[k].scenes;
      if (!sc || sc._p138) continue;
      sc._p138 = true;
      let at = sc.findIndex((s) => s.sel === "#rwPanel");
      at = at >= 0 ? at + 1 : sc.findIndex((s) => s.hash === "#/feedback");
      if (at < 0) at = sc.length - 1;
      sc.splice(at, 0, { hash: "#/brief", sel: "#clPanel", wait: "#clPanel", text: "Runway closures checks the NOTAMs at each airport for your time and draws the runways, with red X marks on any that are closed. If the wind favors a closed runway, it names the best open one." });
    }
  } catch (e) { console.error(e); }
})();
