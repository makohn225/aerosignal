"use strict";
/* p70: NOTAMs in the flight brief. Pulls the current NOTAMs for the departure, destination,
   alternate and the navaids on the route from the FAA NOTAM Search (notams relay), keeps only the
   ones in effect during the flight, ranks them (read first, good to know, routine), and shows each
   in plain words with the FAA text one tap away. A NOTAMs line is added to the bottom line card and
   a NOTAMs chip to the section row. The plain words are a reading aid; the FAA text governs. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #ntPanel .nt-sum{margin:0 0 10px}
    #ntPanel ul.nt{list-style:none;margin:0;padding:0}
    #ntPanel ul.nt li{padding:9px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #ntPanel ul.nt li:first-child{border-top:0}
    #ntPanel .tg{display:inline-block;font:700 10.5px var(--mono,monospace);letter-spacing:.5px;padding:1px 7px;border-radius:999px;border:1px solid currentColor;margin-right:6px;vertical-align:1px}
    #ntPanel .r1 .tg{color:#ff4d6a}#ntPanel .r2 .tg{color:#ffb648}#ntPanel .r3 .tg{color:var(--ink2,#9fb0c8)}
    #ntPanel .pl{font-size:14.5px;line-height:1.45}
    #ntPanel .wh{display:block;font-size:12.5px;color:var(--ink2,#9fb0c8);margin-top:2px}
    #ntPanel details.raw summary{font-size:12px;color:#3DE0FF;cursor:pointer;margin-top:3px}
    #ntPanel details.raw pre{white-space:pre-wrap;font:12px/1.45 var(--mono,monospace);margin:4px 0 0;color:var(--ink2,#9fb0c8)}
    #ntPanel h3{font:600 12px var(--disp,inherit);letter-spacing:1.5px;text-transform:uppercase;color:var(--ink2,#9fb0c8);margin:14px 0 4px}
    #ntPanel details.loc{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:0 12px;margin-top:8px}
    #ntPanel details.loc>summary{cursor:pointer;padding:10px 0;font-size:14px}
    #ntPanel .warn{margin-top:12px;font-weight:700;color:#ff4d6a;font-size:13px;line-height:1.4}
    #bfBluf .bf-nt{margin:2px 0 4px;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-nt .hot{color:#ff4d6a;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const onBrief = () => /^#\/brief(\/|$|\?)/.test(location.hash || "");
  const flight = () => { try { const f = currentFlight(); return f && (f.points || []).length ? f : null; } catch { return null; } };

  /* Which places to ask about */
  function places(f) {
    const pts = f.points || [], out = [];
    const add = (id) => { id = String(id || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (id.length >= 3 && id.length <= 5 && !out.includes(id)) out.push(id); };
    if (pts[0]) add(pts[0].ident);
    if (pts.length > 1) add(pts[pts.length - 1].ident);
    add(f.alt || f.alternate || "");
    for (const p of pts.slice(1, -1)) if (/airport|navaid|vor|ndb|tacan/i.test(p.kind || "")) add(p.ident);
    return out.slice(0, 8);
  }

  /* Times: "MM/DD/YYYY HHMM" in UTC, or PERM */
  function t(s) { const m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d)(\d\d)/.exec(s || ""); return m ? Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]) : null; }
  function windowOf(f) {
    const d = new Date(`${f.date}T${f.time || "12:00"}:00`);
    if (isNaN(d)) return null;
    let ete = 1.5; try { const p = profile(f); if (p && p.ete) ete = p.ete; } catch {}
    return [+d - 30 * 60e3, +d + (ete + 1) * 36e5];
  }
  const fmt = (ms) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  /* Plain words */
  const WORDS = { RWY: "runway", RWYS: "runways", TWY: "taxiway", TWYS: "taxiways", TXL: "taxilane", APN: "apron", CLSD: "closed", BTN: "between", OTS: "out of service", LGT: "lights", LGTS: "lights", LGTD: "lighted", AVBL: "available", UNAVBL: "unavailable", HEL: "helicopter", OPS: "operations", OBST: "obstacle", ABV: "above", BLW: "below", ACFT: "aircraft", AD: "airport", AP: "airport", ARPT: "airport", TWR: "tower", FREQ: "frequency", SVC: "service", DLY: "daily", EXC: "except", WEF: "starting", UFN: "until further notice", PERM: "permanent", CONST: "construction", WIP: "work in progress", MAINT: "maintenance", INOP: "inoperative", COM: "radio", GND: "ground", LOC: "localizer", OM: "outer marker", MM: "middle marker", PJE: "parachute jumping", WI: "within", SFC: "surface", UNL: "unlimited", BCN: "beacon", ROT: "rotating", WX: "weather", PPR: "prior permission required", REIL: "runway end identifier lights", THR: "threshold", DTHR: "displaced threshold", DSPLCD: "displaced", AMDT: "amendment", ORIG: "original", DEP: "departure", ARR: "arrival", ALS: "approach lights", IAP: "instrument approach", ODP: "obstacle departure procedure", UAS: "drone", CRANE: "crane", TOWER: "tower", FLAGGED: "flagged", AND: "and", ID: "identifier", MNT: "monitored", NA: "not authorized", ACT: "active", HR: "hours", HRS: "hours", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday", SUN: "Sunday", TO: "to", FOR: "for", OF: "of", IN: "in", ON: "on", NOT: "not", SEE: "see", FROM: "from", EFFECT: "effect", INSTRUCTIONS: "instructions", SECURITY: "security", DIRECTIONAL: "directional", LOCATION: "location", SIGN: "sign", END: "end", EAST: "east", WEST: "west", NORTH: "north", SOUTH: "south", TERMINAL: "terminal", RAMP: "ramp", SPOT: "spot", PHASE: "phase", TRANSITION: "transition", DEPARTURE: "departure", PROCEDURE: "procedure", PROCEDURES: "procedures", TAKEOFF: "takeoff", MINIMUMS: "minimums", OBSTACLE: "obstacle", AREA: "area", DEFINED: "defined", AS: "as", RADIUS: "radius", AIRSPACE: "airspace", FUEL: "fuel", SELF: "self", ATTENDED: "attended", ONLY: "only", WITH: "with", CHANGED: "changed", TEMPORARILY: "temporarily" };
  const KW = { RWY: "Runway", TWY: "Taxiway", APRON: "Apron", AD: "Airport", OBST: "Obstacle", NAV: "Navaid", COM: "Radio", SVC: "Services", AIRSPACE: "Airspace", IAP: "Approach", SID: "Departure", STAR: "Arrival", ODP: "Departure", MILITARY: "Military", LTA: "Letter", SECURITY: "Security", CHART: "Chart", DATA: "Data", ROUTE: "Route", SPECIAL: "Special" };
  function plain(raw) {
    let s = String(raw || "").replace(/\s+/g, " ").trim();
    s = s.replace(/^(NAV|COM|OBST|SVC|AIRSPACE|APRON|AD)\s+/, "");
    s = s.replace(/\s\d{10}(EST)?\s*-\s*(\d{10}(EST)?|PERM)\.?\s*$/, "");
    s = s.replace(/\((ASR|ASN)[^)]*\)\s*/g, "").replace(/\b\d{6}(\.\d+)?N\d{7}(\.\d+)?W\b\s*/g, "");
    s = s.replace(/U\/S/g, "out of service").replace(/NOT MNT/g, "not monitored");
    s = s.replace(/\((\d+(?:\.\d+)?)NM ([NSEW]{1,3}) ([A-Z0-9]{3,4})\)/g, (m, d, b, id) => `(${Math.ceil(+d)} NM ${b} of ${id})`);
    s = s.replace(/(\d+(?:\.\d+)?)\s?FT \((\d+(?:\.\d+)?)\s?FT AGL\)/g, (m, a, b) => `${Math.ceil(+a)} ft (${Math.ceil(+b)} ft above ground)`);
    s = s.replace(/\b(\d+)FT\b/g, "$1 ft");
    const out = s.split(" ").map((w) => {
      const core = w.replace(/[.,;:()]/g, "");
      const lw = WORDS[core];
      if (lw) return w.replace(core, lw);
      return w;
    }).join(" ");
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  /* Ranking: 1 read first, 2 good to know, 3 routine */
  function rank(n, ifr) {
    const x = String(n.text || "").toUpperCase(), kw = String(n.kw || "").toUpperCase();
    if (kw === "RWY" && /\bCLSD\b/.test(x) && !/CLSD TO (HEL|TRANSIENT)/.test(x)) return 1;
    if (/\bAD AP CLSD\b|\bAIRPORT CLSD\b/.test(x)) return 1;
    if (/\bFUEL\b[^.]*\b(UNAVBL|NOT AVBL|OTS)\b/.test(x)) return 1;
    if (kw === "AIRSPACE" && !/SECURITY INSTRUCTIONS/.test(x)) return /\b(TFR|UAS|PJE|AEROBATIC|FIREWORKS|ROCKET)\b/.test(x) || /\bSFC-\d+FT\b/.test(x) ? 2 : 1;
    if (kw === "NAV" && /\b(OTS|U\/S|UNUSABLE|NOT MNT|DECOMMISSIONED)\b/.test(x)) return ifr && /\b(ILS|LOC|VOR|DME|GS|GP|TACAN)\b/.test(x) ? 1 : 2;
    if (kw === "IAP") return ifr && /\b(NA|UNUSABLE|NOT AUTHORIZED)\b/.test(x) ? 1 : ifr ? 2 : 3;
    if (kw === "SID" || kw === "ODP" || kw === "STAR") return ifr ? 2 : 3;
    if (kw === "RWY") return 2;
    if (/\bTWR\b|\bATC\b|\bCTAF\b|\bUNICOM\b/.test(x)) return 2;
    if (kw === "OBST") { const m = /\((\d+(?:\.\d+)?)NM/.exec(x), a = /(\d+(?:\.\d+)?)\s?FT AGL/.exec(x); return m && +m[1] <= 3 && a && +a[1] >= 150 ? 2 : 3; }
    if (kw === "MILITARY" && /BASH/.test(x)) return 2;
    if (/SECURITY INSTRUCTIONS/.test(x)) return 2;
    return 3;
  }

  /* Fetch with a ten minute memory */
  const memo = {};
  async function load(ids) {
    const key = ids.join(","), m = memo[key];
    if (m && Date.now() - m.at < 10 * 60e3) return m.data;
    const data = await fnGet("notams?ids=" + encodeURIComponent(key));
    memo[key] = { at: Date.now(), data };
    return data;
  }
  function digest(f, data) {
    const ids = places(f), w = windowOf(f), ifr = /IFR/i.test(f.rules || "");
    const seen = new Set(), all = [];
    for (const id of ids) for (const n of (data.notams || {})[id] || []) {
      const k = (n.num || "") + "|" + (n.text || "").slice(0, 80);
      if (seen.has(k)) continue;
      seen.add(k);
      const s = t(n.start), e = /PERM/.test(n.end || "") ? Infinity : t(n.end);
      if (w && s != null && s > w[1]) continue;
      if (w && e != null && e < w[0]) continue;
      all.push({ ...n, at: id, r: rank(n, ifr), s, e });
    }
    all.sort((a, b) => a.r - b.r || ids.indexOf(a.at) - ids.indexOf(b.at));
    return { ids, all, first: all.filter((n) => n.r === 1), errors: data.errors || [] };
  }

  function item(n) {
    const when = n.e === Infinity ? "Permanent" : n.e ? `Until ${fmt(n.e)}` : "";
    const from = n.s && n.s > Date.now() ? `From ${fmt(n.s)}. ` : "";
    return `<li class="r${n.r}"><span class="tg">${h(n.at)} ${h(KW[String(n.kw).toUpperCase()] || n.kw || "NOTAM")}</span><span class="pl">${h(plain(n.text))}</span><span class="wh">${h(from + when)}${n.num ? ` · NOTAM ${h(n.num)}` : ""}</span><details class="raw"><summary>FAA text</summary><pre>${h(n.text)}</pre></details></li>`;
  }
  function render(sec, f, d) {
    const n = d.all.length, list = (a) => `<ul class="nt">${a.map(item).join("")}</ul>`;
    const by = d.ids.map((id) => [id, d.all.filter((x) => x.at === id && x.r > 1)]).filter(([, a]) => a.length);
    sec.innerHTML = `<h2>NOTAMs</h2>
      <p class="small muted nt-sum">${n ? `${n} NOTAMs in effect around your flight time at ${h(d.ids.join(", "))}. ${d.first.length ? `<b style="color:#ff4d6a">${d.first.length} to read first.</b>` : "None that close a runway, an airport or airspace on your route."}` : `No NOTAMs in effect around your flight time at ${h(d.ids.join(", "))}.`}${d.errors.length ? ` Could not load ${h(d.errors.map((e) => e.split(":")[0]).join(", "))}.` : ""}</p>
      ${d.first.length ? `<h3>Read first</h3>${list(d.first)}` : ""}
      ${by.map(([id, a]) => `<details class="loc"><summary>${h(id)}: ${a.length} more (${a.filter((x) => x.r === 2).length} good to know)</summary>${list(a)}</details>`).join("")}
      <p class="warn">The plain words are a reading aid only. The FAA NOTAM text governs. Always get a full briefing from Flight Service before you fly.</p>
      <p class="small muted" style="margin:6px 0 0">Source: FAA NOTAM Search. <a href="https://notams.aim.faa.gov/notamSearch/" target="_blank" rel="noopener">Open it</a></p>`;
  }

  function bluf(page, d) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    let el = card.querySelector(".bf-nt");
    const html = d ? `NOTAMs: ${d.first.length ? `<span class="hot">${d.first.length} to read first</span>, ` : ""}${d.all.length} in effect. <a href="#" data-nt="1">Read them</a>` : `NOTAMs: <span class="mut">loading</span>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-nt"; const after = card.querySelector(".bf-wx") || card.querySelector(".k"); if (after) after.after(el); else card.prepend(el); }
    el.dataset.v = html; el.innerHTML = html;
    const a = el.querySelector("[data-nt]");
    if (a) a.onclick = (e) => { e.preventDefault(); jump(); };
  }
  function jump() {
    const s = document.getElementById("ntPanel");
    if (!s) return;
    if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true);
    s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function chip(page) {
    const j = page.querySelector("#bfJump");
    if (j && document.getElementById("ntPanel") && !j.querySelector('[data-s="#ntPanel"]')) {
      const a = document.createElement("a");
      a.href = "#"; a.dataset.s = "#ntPanel"; a.textContent = "NOTAMs";
      a.onclick = (e) => { e.preventDefault(); jump(); };
      j.appendChild(a);
    }
  }

  const state = {};
  function panel(page, f) {
    let sec = page.querySelector("#ntPanel");
    const key = f.id + "|" + places(f).join(",") + "|" + f.date + f.time;
    if (!sec) {
      sec = document.createElement("section");
      sec.className = "panel"; sec.id = "ntPanel";
      const tfr = [...page.querySelectorAll(":scope > section.panel")].find((s) => /^temporary flight restrictions/i.test(((s.querySelector("h2") || {}).textContent || "").trim()));
      const anchor = tfr || page.querySelector(":scope > #dbPanel") || page.querySelector(":scope > #bbody");
      if (tfr) tfr.after(sec); else if (anchor && anchor.id === "dbPanel") anchor.before(sec); else if (anchor) anchor.after(sec); else page.appendChild(sec);
      sec.dataset.k = "";
    }
    const st = state[key];
    if (st && st.d) { if (sec.dataset.k !== key) { render(sec, f, st.d); sec.dataset.k = key; } bluf(page, st.d); return; }
    if (st && st.err) { if (sec.dataset.k !== key + "e") { sec.innerHTML = `<h2>NOTAMs</h2><p class="small muted">Could not reach the FAA NOTAM service right now. Check NOTAMs with Flight Service at 1800wxbrief.com.</p>`; sec.dataset.k = key + "e"; } return; }
    if (sec.dataset.k !== key + "l") { sec.innerHTML = `<h2>NOTAMs</h2><p class="small muted">Loading NOTAMs for ${h(places(f).join(", "))}…</p>`; sec.dataset.k = key + "l"; }
    bluf(page, null);
    if (st) return;
    state[key] = { loading: true };
    load(places(f)).then((data) => { state[key] = { d: digest(f, data) }; kick(); }).catch(() => { state[key] = { err: true }; kick(); });
  }

  let busy = false, tm = 0;
  function apply() {
    if (busy || !onBrief()) return;
    const page = document.querySelector("#view .page"), f = flight();
    if (!page || !f || f.missionId || !page.querySelector(":scope > h1") || !places(f).length) return;
    busy = true;
    try { panel(page, f); chip(page); } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(tm); tm = setTimeout(apply, 150); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroNotams = { places, plain, rank, digest };
})();
