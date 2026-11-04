"use strict";
/* p172: scenario practice from real accidents (November 3, 2026).
   #/scenarios turns public NTSB accident records near the pilot's route into oral exam style scenarios:
   how the flight began, then "what would you do" questions tied to the area of the Private Pilot ACS it
   touches, then a reveal of what the NTSB found. For flight reviews, checkride prep and ground lessons.
   Public NTSB data only (the same accidents the brief already shows); nothing new is stored or sent. */
(function () {
  if (typeof ROUTES === "undefined") return;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CATS = [
    { k: "weather", re: /\b(instrument meteorological|IMC|low clouds?|ceilings?|visibility|fog|mist|thunderstorms?|convective|VFR flight into|clouds)\b/i, acs: "Preflight Preparation: Weather Information",
      q: ["Which weather reports and forecasts before departure would have shown these conditions, and what would they likely have said?", "What ceiling and visibility do your personal minimums require here, and where would you have turned around or diverted?"] },
    { k: "fuel", re: /fuel (exhaustion|starvation)|ran out of fuel|fuel quantity|no usable fuel/i, acs: "Preflight Preparation: Cross Country Flight Planning",
      q: ["How much fuel would you plan for this leg, including the required reserve and your own extra?", "At what points in the flight would you check fuel burn against your plan, and what would make you land early?"] },
    { k: "performance", re: /density altitude|gross weight|over ?weight|above (its |the )?maximum|center of gravity|takeoff (distance|performance)|climb performance|high elevation/i, acs: "Preflight Preparation: Performance and Limitations",
      q: ["Work the takeoff and climb performance for these conditions. What margin would you want before you go?", "How would weight and balance change what happened here?"] },
    { k: "stall", re: /\bstall|angle of attack|\bspin\b|loss of (airplane |aircraft )?control|failed to maintain (airplane |aircraft )?control/i, acs: "Slow Flight and Stalls",
      q: ["In this phase of flight, what signs of an approaching stall would you watch for?", "What is your recovery, and how much altitude would it take?"] },
    { k: "landing", re: /\blanding|go.around|bounced|\bflare|touchdown|crosswind|runway excursion|overran|ran off the runway/i, acs: "Takeoffs, Landings, and Go Arounds",
      q: ["What would make you go around in this situation, and at what point?", "How would you correct for the wind on this runway, and what is your crosswind limit in this airplane?"] },
    { k: "engine", re: /loss of engine power|engine (failure|quit|stopped|lost power)|carburetor ice|partial power|power loss/i, acs: "Emergency Operations",
      q: ["If the engine quit at that point, where would you put the airplane?", "Walk through your engine failure checklist from memory."] },
    { k: "night", re: /\bnight\b|\bdark(ness)?\b|moonless/i, acs: "Night Operations",
      q: ["What changes in your planning and personal minimums for a night flight like this one?", "Which visual illusions could have played a part, and how do you guard against them?"] },
    { k: "terrain", re: /\bterrain\b|mountain|ridge|controlled flight into|obstacle|power lines?|\bwires?\b|\btower\b/i, acs: "Preflight Preparation: Cross Country Flight Planning",
      q: ["What is the minimum safe altitude along this part of the route, and how would you know you were too low?", "Where on your chart would you mark this hazard before the flight?"] },
    { k: "human", re: /fatigue|alcohol|impair|medication|distract|complacen|self.induced pressure|get.there|continued (the )?flight/i, acs: "Preflight Preparation: Human Factors",
      q: ["What pressures might the pilot have felt to keep going?", "How would you use IMSAFE and PAVE before this flight?"] },
  ];
  const GENERIC = "Where is the first point in this story where you would have changed the plan?";
  const sentences = (t) => String(t || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-Z])/);
  function classify(a, text) {
    const t = `${text || a.excerpt || ""} ${a.weather_condition === "IMC" ? "IMC" : ""}`;
    return CATS.filter((c) => c.re.test(t));
  }
  const css = document.createElement("style");
  css.textContent = `
    .scn .sc-card{border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:14px;padding:14px 16px;margin:0 0 12px;background:rgba(0,0,0,.14)}
    .scn .sc-card h3{margin:0 0 4px;font-size:16px}
    .scn .sc-meta{font-size:12.5px;color:var(--ink2,#9db2ce);margin:0 0 10px}
    .scn .sc-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
    .scn .sc-tags span{font:600 11.5px var(--sans,system-ui);padding:3px 9px;border-radius:999px;border:1px solid rgba(61,224,255,.45);color:var(--cyan,#3DE0FF)}
    .scn ol{margin:8px 0 10px 20px;padding:0}.scn ol li{margin:4px 0}
    .scn details summary{cursor:pointer;color:var(--cyan,#3DE0FF);font-weight:600;min-height:40px;display:flex;align-items:center}
    .scn .sc-route{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .scn .sc-route input{flex:1 1 220px;min-height:40px}
    @media print{.scn .sc-route,.scn .sc-noprint{display:none!important}.scn .sc-card{break-inside:avoid;border-color:#999;background:none}}`;
  document.head.appendChild(css);

  let last = null; // { key, items }
  async function build(points) {
    const lats = points.map((p) => p.lat), lons = points.map((p) => p.lon);
    let acc = [];
    acc = (await rpc("accidents_near_route", { lats, lons, corridor_nm: 15, lim: 250 })) || [];
    acc = acc.filter((a) => a.ev_id).sort((a, b) => String(b.event_date).localeCompare(String(a.event_date))).slice(0, 40);
    const text = new Map();
    for (let i = 0; i < acc.length; i += 20) {
      const ids = acc.slice(i, i + 20).map((a) => a.ev_id);
      try { const r = await fnGet(`ntsbtext?ids=${encodeURIComponent(ids.join(","))}`); for (const row of r.rows || []) text.set(String(row.ev_id), row.narrative || ""); } catch (e) { /* use excerpts */ }
    }
    const picked = [], used = new Set();
    const cands = acc.map((a) => { const t = text.get(String(a.ev_id)) || a.excerpt || ""; return { a, t, cats: classify(a, t) }; }).filter((x) => sentences(x.t).length >= 3);
    // Spread the scenarios across different ACS areas first, then fill
    for (const x of cands) { const c = x.cats.find((c) => !used.has(c.k)); if (c && picked.length < 6) { used.add(c.k); picked.push({ ...x, main: c }); } }
    for (const x of cands) { if (picked.length >= 6) break; if (!picked.includes(x) && !picked.some((p) => p.a.ev_id === x.a.ev_id)) picked.push({ ...x, main: x.cats[0] || null }); }
    return picked;
  }
  function card(x, i) {
    const a = x.a, s = sentences(x.t);
    // Tell the story only up to the point things went wrong, so the outcome stays hidden until the reveal
    const OUT = /\b(impact|collided|crash|damage|collapsed|struck|nosed over|nose over|bounced|fatal|injur|came to rest|went down|lost control|loss of control|ditched|wreckage|accident site|exceeded the airplane|stalled|sank|overturned|flipped)/i;
    let cut = s.findIndex((x) => OUT.test(x));
    if (cut < 0) cut = Math.min(2, s.length - 1);
    let setupS = s.slice(0, Math.min(cut, 2));
    if (!setupS.length) { const m = OUT.exec(s[0]); const head = m ? s[0].slice(0, m.index).replace(/[,;]?\s*(and|when|but|where|which|after)?\s*(the )?(airplane|aircraft|pilot)?\s*$/i, "").trim() : ""; setupS = [head.split(" ").length >= 6 ? `${head}…` : `A ${a.weather_condition === "IMC" ? "flight in instrument conditions" : "flight"} in a ${a.model || "light airplane"} near ${a.location || "your route"}.`]; }
    const setup = setupS.join(" "), rest = s.slice(setupS[0].endsWith("…") || setupS[0].startsWith("A flight") || setupS[0].startsWith("A flight in") ? 0 : setupS.length).join(" ");
    const qs = [GENERIC, ...((x.main && x.main.q) || [])];
    const areas = [...new Set(x.cats.map((c) => c.acs))].slice(0, 3);
    const when = a.event_date ? new Date(`${a.event_date}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "";
    return `<article class="sc-card">
      <h3>Scenario ${i + 1}: ${h(a.model || "Airplane")} near ${h(a.location || "the route")}</h3>
      <p class="sc-meta">${h(when)}${a.dist_nm != null ? ` · about ${Math.ceil(a.dist_nm)} nm from your route` : ""}${a.weather_condition ? ` · ${h(a.weather_condition)}` : ""}${a.accident_number ? ` · NTSB ${h(a.accident_number)}` : ""}</p>
      ${areas.length ? `<div class="sc-tags">${areas.map((t) => `<span>ACS: ${h(t)}</span>`).join("")}</div>` : ""}
      <p><b>How it began.</b> ${h(setup)}</p>
      <p style="margin:10px 0 0"><b>Talk it through</b></p><ol>${qs.map((q) => `<li>${h(q)}</li>`).join("")}</ol>
      <details><summary>Reveal what the NTSB found</summary><p class="small">${h(rest)}</p>${a.injury_severity ? `<p class="small muted">Outcome: ${h(a.injury_severity)} injuries.</p>` : ""}</details>
    </article>`;
  }
  function routeOf() {
    let f = null; try { f = currentFlight(); } catch (e) {}
    return f && (f.points || []).length ? { pts: f.points, label: (f.points || []).map((p) => p.ident).filter(Boolean).join(" ") } : null;
  }
  ROUTES.scenarios = function (el) {
    const cur = routeOf();
    el.innerHTML = `<div class="page scn">
      <h1>Scenario practice from real accidents</h1>
      <p class="lede">Accidents near your route, told as the flight began, with the questions an examiner or instructor would ask. Talk it through, then reveal what the NTSB found.</p>
      <section class="panel sc-route"><input id="scRoute" placeholder="Airports on your route, like KPNS KJKA" value="${h(cur ? cur.label : "")}" aria-label="Route"><button class="btn" type="button" id="scGo">Build scenarios</button><button class="btn sec sc-noprint" type="button" id="scPrint" hidden>Print with answers</button></section>
      <div id="scOut"><p class="muted">${cur ? "Building scenarios for your current flight…" : "Enter the airports on your route, or plan a flight first."}</p></div>
      <p class="small muted">From public NTSB accident records near the route. A discussion aid for you and your instructor; it does not replace the NTSB's full report or your instructor's judgment.</p>
    </div>`;
    const out = el.querySelector("#scOut"), go = el.querySelector("#scGo"), pr = el.querySelector("#scPrint");
    async function run() {
      const txt = el.querySelector("#scRoute").value.trim();
      if (!txt) return;
      go.disabled = true; out.innerHTML = `<p class="muted">Finding accidents along ${h(txt)} and building scenarios…</p>`;
      try {
        let pts = cur && txt === cur.label ? cur.pts : null;
        if (!pts) { const r = await resolveRoute(txt); pts = (r && r.points) || []; }
        if (!pts.length) { out.innerHTML = `<p>Those airports were not found. Use identifiers like KPNS.</p>`; return; }
        const key = pts.map((p) => `${p.lat},${p.lon}`).join(";");
        const items = last && last.key === key ? last.items : await build(pts);
        last = { key, items };
        if (!el.isConnected) return;
        out.innerHTML = items.length ? items.map(card).join("") : `<p>No accident records with enough detail were found near this route. Try a longer route or a busier area.</p>`;
        pr.hidden = !items.length;
      } catch (e) { console.error(e); out.innerHTML = `<p>Scenarios could not load right now. Check your connection and try again.</p>`; }
      finally { go.disabled = false; }
    }
    go.onclick = run;
    el.querySelector("#scRoute").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    pr.onclick = () => { const d = [...el.querySelectorAll("details")]; const was = d.map((x) => x.open); d.forEach((x) => (x.open = true)); setTimeout(() => { window.print(); d.forEach((x, i) => (x.open = was[i])); }, 50); };
    if (cur) run();
  };
  window.AeroScenarios = { classify, CATS, card };
})();
