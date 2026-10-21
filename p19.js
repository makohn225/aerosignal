"use strict";
/* Narrated, self playing tutorial. It drives the real app with sample data, spotlights each
   feature and reads a caption aloud. It can be screen recorded to make a tutorial video. */
(function () {
  const MID = "m_sample_itx_iron";
  /* Each scene: the page (hash), what to spotlight (sel, a comma list tried in order, where
     "@h:Heading" means the section or block under that heading), what to wait for, and the line.
     Written to be read aloud: short sentences, plain words, no dashes. */
  const SCRIPTS = {
    military: {
      label: "Military pilot",
      scenes: [
        { hash: "#/missions", sel: ".page ul.list > li, .page ul.list, .page h1", text: "Alright, here's the deal. AeroSignal puts the hard lessons in front of the crew before the brief, not after the mishap. This run is a notional Osprey pilot and an eleven aircraft night raid at Yuma." },
        { hash: `#/missions/${MID}/plan`, sel: ".legcard, @h:Legs and mission types", wait: ".legcard", text: "Every mission holds the plan, the brief and the debrief. Each leg takes airport IDs, objective area names, lat long or MGRS grids, and gets its own mission type." },
        { hash: `#/missions/${MID}/plan`, sel: ".oapanel, @h:Objective area diagram", wait: ".oapanel", text: "The objective area diagram draws your LZs, battle positions and contact points with standard military symbols. Load the unit's KML or a TAK data package, and export it right back out." },
        { hash: `#/missions/${MID}/brief`, sel: "#routecheck", wait: "#routecheck", text: "On the brief, the route check covers safe altitudes, training routes and special use airspace, with past military mishaps near the route right alongside. One look and you know what's out there." },
        { hash: `#/missions/${MID}/brief`, sel: "@h:Hazards for this mission", wait: ".bsec", text: "Hazards are matched to each mission type, with lessons from past debriefs riding along. Then the brief lays out in five paragraphs, ready to talk through at the table." },
        { hash: `#/missions/${MID}/debrief`, sel: "section.panel.rat", wait: "section.panel.rat", text: "After the flight, debrief with RAT. Reconstruct what happened, analyze why, and teach the fix. Every focus point ends with an owner." },
        { hash: "#/missions/m_sample_dve_workup/brief", sel: "@h:Lessons from your past debriefs, @h:Hazards for this mission", wait: ".bsec", text: "Here's the payoff. The next mission's brief already carries the fixes from that debrief. Every sortie teaches the next one." },
        { hash: `#/kneeboard/${MID}`, sel: "#kbNav", wait: "#kbNav", text: "Kneeboard cards build straight from the plan. The navlog gives courses, distances and times, and backs time from your TOT to a latest launch." },
        { hash: `#/kneeboard/${MID}`, sel: "#ckvBtn", wait: "#ckvBtn", text: "Cockpit view runs one leg at a time in big type. Tap Over the point as you pass it, and it tells you if you're early or late." },
        { hash: "#/maps", pre: "mapMission", sel: "#view .leaflet-container, #map", wait: ".mtabs", text: "Send the route to Maps and it rides the sectional, with every mishap along the corridor plotted." },
        { hash: "#/maps", sel: ".hzitem, #blSum, #hzlist", wait: ".hzitem, #hzlist", text: "Every mishap opens bottom line up front. Lessons you can act on come first. Mechanical stuff and things outside your control wait below." },
        { hash: "#/maps", pre: "airTab", sel: "#mtrSec, .mtabs", wait: "#mtrSec", text: "The airspace tab lists training routes and special use airspace near the route. Add only the ones you'll actually fly." },
        { hash: "#/logbook", sel: "#milpanel, @h:Totals", wait: "#milpanel", text: "The logbook reads a ForeFlight file. The military view tracks NVG hours, days since your last goggle flight, and your T&R codes." },
        { hash: "#/safety", sel: "#sfForm, .page h1", wait: "#sfForm", text: "Safety search pulls past mishaps by aircraft, place or hazard. Military narratives come from public reporting only." },
        { hash: "#/feedback", sel: "#fbf, .page", text: "That's the tour. Never enter CUI or classified information. Send feedback from any page, every note gets read. Fly safe." },
      ],
    },
    civil: {
      label: "Civilian pilot",
      scenes: [
        { hash: "#/flights", sel: "#flist .item-btn.on, @h:Saved flights, .page h1", text: "Alright, let's get after it. AeroSignal puts the hard lessons in front of you before you fly. Our sample pilot is instrument rated, flying IFR from Manassas down to Lynchburg." },
        { hash: "#/flights", sel: "#route, @h:Route", wait: "#route", text: "File the route the way you always do. Airports, navaids, fixes and airways all resolve, and V143 opens up into every fix along the way." },
        { hash: "#/brief", sel: "a.frat-chip", wait: "a.frat-chip", text: "Here's the brief. Up top is your risk score, built from your own recent flying, the route and the conditions. Tap it to work the full checklist." },
        { hash: "#/brief", sel: "#tfrPanel", wait: "#tfrPanel", text: "Temporary flight restrictions within ten miles of the route come straight from the FAA, with altitudes and times. No surprises." },
        { hash: "#/brief", sel: "@all:#bbody .phase, #bbody, #mnPanel", wait: "#bbody .phase, #mnPanel", text: "Here's the heart of it. Real accidents from flights that look like yours, sorted by phase of flight and weighed against your own recent time. Read them before you launch, not after." },
        { hash: "#/maps", sel: "#view .leaflet-container, #map", wait: ".mtabs", text: "On Maps, the route rides the sectional, with every accident along the corridor plotted." },
        { hash: "#/maps", sel: ".hzitem, #blSum, #hzlist", wait: ".hzitem, #hzlist", text: "Each one opens bottom line up front. Lessons you can act on come first. Tap any entry to fly the map to it and read what happened." },
        { hash: "#/maps", pre: "altTab", sel: "#altOut, .mtabs", wait: "#altOut", text: "The altitudes tab works out a safe altitude for every leg from terrain and the FAA obstacle file." },
        { hash: "#/maps", sel: ".re-ctl, .leaflet-control-layers", wait: ".re-ctl", text: "Tap Edit route to drag a waypoint or add one right on the map. Tap anywhere to read lat long and MGRS. Charts swap in the top right corner." },
        { hash: "#/maps", sel: ".pl-btn, .leaflet-control-layers", wait: ".leaflet-container", text: "Tap Plates to lay an approach plate right on the map, lined up where it belongs." },
        { hash: "#/logbook", sel: "#curPanel, @h:Totals", wait: "#curPanel", text: "Bring in your ForeFlight logbook. Totals, currency and time in type feed the brief, so the warnings fit the pilot actually flying." },
        { hash: "#/safety", sel: "#sfForm, .page h1", wait: "#sfForm", text: "Safety search lets you study any type, airport or hazard before you go. Accidents by aircraft, place and radius, weather or years." },
        { hash: "#/plan", sel: "#qText, .qbar", wait: "#qText", text: "Rather skip the forms? Describe the flight in plain words and it builds the route and times for you. Tap Ask on any page to change things the same way." },
        { hash: "#/feedback", sel: "#fbf, .page", text: "That's the tour. Fly smart, and send feedback from any page. Every note gets read." },
      ],
    },
  };
  // The scenes above are the whole script. Older add ons that appended scenes stand down.
  Object.assign(SCRIPTS, { _ask: true, _ck: true, _msm: true, _tfr: true });
  for (const k of ["civil", "military"]) Object.assign(SCRIPTS[k].scenes, { _procs: true, _plates: true, _bluf: true });

  const T = { on: false, track: null, i: 0, playing: true, voice: true, timer: null, snap: null, hadData: false, token: 0 };
  const synth = window.speechSynthesis;

  function css() {
    if (document.getElementById("tutCss")) return;
    const s = document.createElement("style");
    s.id = "tutCss";
    s.textContent = `
      body.tut #tourBar,body.tut #fbFab,body.tut #asWelcome{display:none!important}
      #tutRing{position:fixed;z-index:9998;pointer-events:none;border:3px solid #3DE0FF;border-radius:12px;box-shadow:0 0 0 9999px rgba(3,8,18,.6),0 0 22px rgba(61,224,255,.65);transition:left .3s ease,top .3s ease,width .3s ease,height .3s ease,opacity .25s;opacity:0}
      #tutRing.on{opacity:1;animation:tutPulse 1.8s ease-in-out infinite}
      @keyframes tutPulse{0%,100%{box-shadow:0 0 0 9999px rgba(3,8,18,.6),0 0 14px rgba(61,224,255,.45)}50%{box-shadow:0 0 0 9999px rgba(3,8,18,.6),0 0 30px rgba(61,224,255,.9)}}
      @media (prefers-reduced-motion:reduce){#tutRing,#tutRing.on{transition:none;animation:none}}
      #tutBar{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:9999;width:min(760px,calc(100vw - 24px));background:rgba(6,12,24,.97);border:1px solid rgba(61,224,255,.5);border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.6);padding:14px 16px 12px;color:#EAF2FF}
      #tutBar .tt{font-size:16.5px;line-height:1.5;min-height:50px}
      #tutBar .tr{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
      #tutBar .tp{flex:1;height:4px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden;min-width:80px}
      #tutBar .tp i{display:block;height:100%;background:#3DE0FF;width:0;transition:width .3s}
      #tutBar .tn{font-family:var(--mono);font-size:12px;color:var(--ink2)}
      #tutBar button{appearance:none;border:1px solid rgba(255,255,255,.2);background:transparent;color:#EAF2FF;border-radius:9px;padding:6px 10px;font-size:13px;cursor:pointer}
      #tutBar button.pri{background:#3DE0FF;color:#041018;border-color:#3DE0FF;font-weight:700}
      #tutBar .tk{font-family:var(--disp);font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#3DE0FF;margin-bottom:4px}
      #tutBar.top{top:calc(64px + env(safe-area-inset-top,0px));bottom:auto}
      @media (max-width:860px){#tutBar{bottom:calc(var(--tabh,64px) + 10px);padding:11px 12px 9px}#tutBar .tt{font-size:15px;min-height:0}#tutBar .tr{margin-top:8px;gap:6px}#tutBar button{padding:5px 9px}}
    `;
    document.head.appendChild(s);
  }

  function ui() {
    css();
    let ring = document.getElementById("tutRing");
    if (!ring) { ring = document.createElement("div"); ring.id = "tutRing"; document.body.appendChild(ring); }
    let bar = document.getElementById("tutBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "tutBar";
      bar.setAttribute("role", "dialog");
      bar.setAttribute("aria-label", "Tutorial");
      bar.innerHTML = `<div class="tk" id="tutK"></div><div class="tt" id="tutT" aria-live="polite"></div>
        <div class="tr"><button type="button" id="tutPrev" aria-label="Previous">Back</button><button type="button" class="pri" id="tutPlay">Pause</button><button type="button" id="tutNext" aria-label="Next">Next</button>
        <div class="tp"><i id="tutP"></i></div><span class="tn" id="tutN"></span><button type="button" id="tutVoice"></button><button type="button" id="tutX">Exit</button></div>`;
      document.body.appendChild(bar);
      $("#tutPrev").onclick = () => show(Math.max(0, T.i - 1));
      $("#tutNext").onclick = () => next();
      $("#tutPlay").onclick = () => { T.playing = !T.playing; paint(); if (T.playing) schedule(); else { clearTimeout(T.timer); if (synth) synth.cancel(); } };
      $("#tutVoice").onclick = () => { T.voice = !T.voice; if (!T.voice && synth) synth.cancel(); paint(); if (T.playing) { clearTimeout(T.timer); speakAndWait(); } };
      $("#tutX").onclick = () => stop(true);
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", place);
      window.addEventListener("scroll", place, true);
    }
    clearInterval(T.track_);
    T.track_ = setInterval(() => { if (T.on) place(); }, 250);
    return { ring, bar };
  }
  function onKey(e) {
    if (!T.on) return;
    if (e.key === "Escape") stop(true);
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") show(Math.max(0, T.i - 1));
  }
  function paint() {
    const sc = SCRIPTS[T.track].scenes;
    $("#tutK").textContent = `AeroSignal tutorial · ${SCRIPTS[T.track].label}`;
    $("#tutN").textContent = `${T.i + 1} / ${sc.length}`;
    $("#tutP").style.width = `${((T.i + 1) / sc.length) * 100}%`;
    $("#tutPlay").textContent = T.playing ? "Pause" : "Play";
    $("#tutVoice").textContent = T.voice ? "Voice on" : "Voice off";
    $("#tutVoice").setAttribute("aria-pressed", T.voice);
    $("#tutNext").textContent = T.i === sc.length - 1 ? "Finish" : "Next";
  }

  let target = null; // an element, or a list of elements spotlighted together
  const els = () => (target ? (Array.isArray(target) ? target : [target]) : []).filter((e) => document.body.contains(e));
  function box() {
    const L = els();
    if (!L.length) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const e of L) { const q = e.getBoundingClientRect(); if (!q.width && !q.height) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    if (l === Infinity) return null;
    // Inside a scrolling panel, only the part showing in the panel counts
    const sc = scroller(L[0]);
    if (sc !== window) { const c = sc.getBoundingClientRect(); t = Math.max(t, c.top); b = Math.min(b, c.bottom); l = Math.max(l, c.left); r = Math.min(r, c.right); if (b <= t) return null; }
    return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
  }
  // The clear part of the screen: below the header and above the caption bar, or below the bar
  // when the bar has moved to the top to get out of the way.
  function zone() {
    const bar = document.getElementById("tutBar");
    if (!bar) return { top: 76, bottom: innerHeight };
    const q = bar.getBoundingClientRect();
    if (bar.classList.contains("top")) {
      const tabs = innerWidth <= 860 ? (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tabh")) || 64) : 0;
      return { top: q.bottom + 10, bottom: innerHeight - tabs - 4 };
    }
    return { top: 76, bottom: q.top - 10 };
  }
  function place() {
    const ring = document.getElementById("tutRing");
    if (!ring) return;
    const r = box();
    if (!r) { ring.classList.remove("on"); return; }
    const pad = 8, z = zone();
    const top = Math.max(z.top - 8, 4, r.top - pad);
    const bottom = Math.min(r.bottom + pad, z.bottom);
    if (bottom - top < 16) { ring.classList.remove("on"); return; } // scrolled out of view
    const left = Math.max(4, r.left - pad);
    ring.style.left = `${left}px`;
    ring.style.top = `${top}px`;
    ring.style.width = `${Math.min(innerWidth - 4 - left, r.right + pad - left)}px`;
    ring.style.height = `${bottom - top}px`;
    ring.classList.add("on");
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(sel, ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().height > 0);
      if (el) return el;
      await wait(150);
    }
    return null;
  }
  const seen = (e) => { const q = e.getBoundingClientRect(); return q.height > 0 && q.width > 0; };
  // "@h:Text" finds a heading that starts with Text. Under an h2 it is the whole section; under an
  // h3 it is the heading and what follows it, up to the next heading.
  function byHeading(txt) {
    const want = txt.toLowerCase();
    const h = [...document.querySelectorAll("#view h1, #view h2, #view h3")].find((x) => seen(x) && x.textContent.trim().toLowerCase().startsWith(want));
    if (!h) return null;
    if (h.tagName === "H3") {
      const list = [h];
      for (let n = h.nextElementSibling; n && !/^H[1-3]$/.test(n.tagName); n = n.nextElementSibling) if (seen(n)) list.push(n);
      return list;
    }
    return h.closest("section") || h;
  }
  function firstVisible(sel) {
    for (const s of sel.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (s.startsWith("@h:")) { const x = byHeading(s.slice(3)); if (x) return x; continue; }
      if (s.startsWith("@all:")) { const L = [...document.querySelectorAll(s.slice(5))].filter(seen); if (L.length) return L; continue; }
      const el = [...document.querySelectorAll(s)].find(seen);
      if (el) return el;
    }
    return null;
  }
  // Bring the spotlight into the clear part of the screen: below the header, above the caption bar.
  // Tall things line up near the top so their start is what you see.
  async function settle(sc) {
    const pos = () => (sc === window ? scrollY : sc.scrollTop);
    let last = pos(), still = 0;
    for (let k = 0; k < 16 && still < 2; k++) { await wait(60); const p = pos(); still = Math.abs(p - last) < 1 ? still + 1 : 0; last = p; }
  }
  async function frame(again) {
    const L = els();
    if (!L.length) return;
    const first = L[0], sc = scroller(first), z = zone();
    if (sc !== window) {
      // A scrolling panel: bring the start of the target to the top of the panel
      const c = sc.getBoundingClientRect(), q = first.getBoundingClientRect();
      const d = q.top - c.top - 8;
      if (Math.abs(d) > 4) { sc.scrollBy({ top: d, behavior: "smooth" }); await settle(sc); }
    } else {
      const q = box();
      if (!q) return;
      const room = z.bottom - 2 - z.top;
      const ok = q.top >= z.top - 4 && (q.bottom <= z.bottom || (q.height > room && q.top <= z.top + 40));
      if (!ok) {
        const d = q.height > room * 0.85 ? q.top - z.top : q.top - z.top - (room - q.height) / 2;
        window.scrollBy({ top: d, behavior: "smooth" });
        await settle(window);
      }
    }
    // Still under the caption bar (a fixed panel on a phone): move the bar up top
    const r2 = box(), bar = document.getElementById("tutBar");
    if (!again && bar && !bar.classList.contains("top") && (innerWidth <= 860 || sc !== window) && (!r2 || r2.top > zone().bottom - 50) && first.getBoundingClientRect().top > zone().bottom - 50) {
      bar.classList.add("top"); await wait(60); return frame(true);
    }
  }
  function scroller(el) {
    for (let p = el && el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 4) return p;
    }
    return window;
  }

  const PRE = {
    async mapMission() {
      const m = getMission(MID);
      const f = currentFlight();
      if (m && !(f && f.missionId === MID)) { try { await missionToMaps(m); } catch {} }
    },
    async airTab() { const b = await waitFor('.mtabs [data-t="air"]', 6000); if (b) b.click(); },
    async altTab() { const b = await waitFor('.mtabs [data-t="alt"]', 6000); if (b) b.click(); },
  };

  async function show(i) {
    const tok = ++T.token;
    clearTimeout(T.timer);
    if (synth) synth.cancel();
    const sc = SCRIPTS[T.track].scenes;
    T.i = i;
    const s = sc[i];
    paint();
    $("#tutT").textContent = s.text;
    target = null;
    place();
    const tb = document.getElementById("tutBar"); if (tb) tb.classList.remove("top");
    if (s.pre && PRE[s.pre] && s.pre === "mapMission") await PRE[s.pre]();
    if (tok !== T.token) return;
    const moved = (location.hash || "") !== s.hash;
    if (moved) location.hash = s.hash;
    await wait(moved ? 300 : 60);
    if (s.pre && PRE[s.pre] && s.pre !== "mapMission") await PRE[s.pre]();
    if (s.wait) await waitFor(s.wait, 7000);
    if (tok !== T.token) return;
    target = firstVisible(s.sel) || firstVisible(".page h1, #view .page");
    await frame();
    if (tok !== T.token) return;
    place();
    // Pages keep filling in after they draw (reports, maps). Re frame if that pushed the spotlight away.
    for (const ms of [900, 1600]) setTimeout(() => { if (tok === T.token && T.on) { const t2 = firstVisible(s.sel); if (t2) target = t2; frame().then(place); } }, ms);
    if (T.playing) speakAndWait();
  }

  function schedule(ms) {
    clearTimeout(T.timer);
    if (!T.playing) return;
    const s = SCRIPTS[T.track].scenes[T.i];
    T.timer = setTimeout(next, ms != null ? ms : Math.max(4000, s.text.length * 50));
  }
  function speakAndWait() {
    const s = SCRIPTS[T.track].scenes[T.i];
    if (!T.voice || !synth || typeof SpeechSynthesisUtterance === "undefined") return schedule();
    const tok = T.token;
    const u = new SpeechSynthesisUtterance(s.text.replace(/\bV143\b/g, "Victor one forty three").replace(/\bMGRS\b/g, "M G R S").replace(/\bMTR\b/g, "M T R").replace(/\bTOT\b/g, "T O T").replace(/\bNVG\b/g, "N V G").replace(/\bT&R\b/g, "T and R").replace(/\bCUI\b/g, "C U I").replace(/\bLZs\b/g, "L Zs").replace(/\bKML\b/g, "K M L").replace(/\bNTSB\b/g, "N T S B").replace(/\bMSA\b/g, "M S A"));
    u.rate = 1.06;
    const voices = synth.getVoices ? synth.getVoices() : [];
    const v = voices.find((x) => /en[-_]US/i.test(x.lang) && /natural|premium|enhanced|google/i.test(x.name)) || voices.find((x) => /en[-_]US/i.test(x.lang));
    if (v) u.voice = v;
    let done = false;
    const fin = () => { if (done || tok !== T.token) return; done = true; schedule(600); };
    u.onend = fin;
    u.onerror = () => { if (!done) { done = true; schedule(); } };
    synth.speak(u);
    clearTimeout(T.timer);
    T.timer = setTimeout(() => { if (!done) { done = true; next(); } }, Math.max(9000, s.text.length * 90));
  }
  function next() {
    const sc = SCRIPTS[T.track].scenes;
    if (T.i >= sc.length - 1) return stop(false);
    show(T.i + 1);
  }

  async function loadSample(track) {
    const b = await loadDemoBundle();
    const key = track === "military" ? "military" : "civil";
    const lb = importForeFlight(b.logbooks[key]);
    S.logbook = { ...lb, importedAt: Date.now(), source: `Demo ${track === "military" ? "military" : "civilian"} logbook` };
    const ids = new Set(b.missions.map((m) => m.id));
    S.missions = [...b.missions, ...(S.missions || []).filter((m) => !ids.has(m.id))];
    let f = S.flights.find((x) => x.demo);
    if (!f) { f = newFlight(); f.demo = true; }
    f.route = b.flight.route;
    f.rules = b.flight.rules || "IFR";
    f.missionId = undefined;
    const ac = Object.entries(lb.aircraft).find(([, a]) => /C172|P28A|SR22/.test(a.typeCode || ""));
    f.tail = (ac && ac[0]) || Object.keys(lb.aircraft)[0] || f.tail;
    try { const r = await resolveRoute(f.route); f.points = r.points; f.unresolved = r.unresolved; } catch { f.points = []; }
    S.currentId = f.id;
    S.demoLoaded = track;
    save();
  }

  async function start(track, statusEl) {
    if (T.on) stop(true);
    const hasOwn = (S.logbook && S.logbook.flights && S.logbook.flights.length && !/^Demo /.test(S.logbook.source || "")) || (S.missions || []).some((m) => !/^m_sample_/.test(m.id));
    T.snap = hasOwn ? JSON.stringify(S) : null;
    T.hadData = !!hasOwn;
    if (statusEl) statusEl.textContent = "Loading the sample data…";
    try { await loadSample(track); } catch (e) {
      if (statusEl) statusEl.textContent = (e && e.message) || "The sample data could not be loaded. Check your connection.";
      return;
    }
    if (statusEl) statusEl.textContent = "";
    try { if (typeof TOUR_KEY !== "undefined") sessionStorage.removeItem(TOUR_KEY); } catch {}
    T.on = true; T.track = track; T.playing = true;
    document.body.classList.add("tut");
    const tb = document.getElementById("tourBar");
    if (tb) tb.hidden = true;
    ui();
    show(0);
  }

  function stop(early) {
    T.token++;
    clearTimeout(T.timer);
    if (synth) synth.cancel();
    T.on = false;
    target = null;
    clearInterval(T.track_);
    const ring = document.getElementById("tutRing"), bar = document.getElementById("tutBar");
    if (ring) ring.remove();
    if (bar) bar.remove();
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, true);
    document.body.classList.remove("tut");
    if (T.snap) {
      const old = JSON.parse(T.snap);
      for (const k of Object.keys(S)) delete S[k];
      Object.assign(S, old);
      save();
      T.snap = null;
      toast("Tutorial closed. Your own data is restored.");
      location.hash = "#/flights";
      go();
    } else {
      toast(early ? "Tutorial closed. The sample data stays loaded so you can explore." : "Tutorial complete. The sample data stays loaded so you can explore.");
    }
  }

  function pageTutorial(el) {
    el.innerHTML = `<div class="page welcome">
      <p class="wk">AEROSIGNAL TUTORIAL</p>
      <h1>A quick guided tutorial.</h1>
      <p class="lede">It plays by itself and reads each step aloud. Pause, go back or skip at any time. Sample data loads first, and if you already have your own data it is put back when the tutorial ends.</p>
      <div class="wchoice">
        <button class="wcard" data-p="civil"><span class="wic">✈</span><span class="wt">Civilian pilot</span><span class="wd">Route entry, the risk brief, mishaps on the map, safe altitudes, the logbook and plain word planning.</span><span class="wgo">Play the civilian tutorial</span></button>
        <button class="wcard mil" data-p="military"><span class="wic">★</span><span class="wt">Military pilot</span><span class="wd">Mission plan, objective area diagram, the brief, the RAT debrief, kneeboard cards, mishaps and MTRs, and the logbook.</span><span class="wgo">Play the military tutorial</span></button>
      </div>
      <p id="tutStatus" class="small muted" style="min-height:22px;margin-top:14px"></p>
      <p class="small muted">Tip: to make a video for new users, start a screen recording, then play the tutorial.</p>
    </div>`;
    $$(".wcard", el).forEach((b) => (b.onclick = () => start(b.dataset.p, $("#tutStatus"))));
  }
  ROUTES.tutorial = pageTutorial;

  function addLinks() {
    const h = location.hash || "";
    if ((h.startsWith("#/demo") || h.startsWith("#/welcome")) && !document.getElementById("tutLink")) {
      const st = document.getElementById("wStatus");
      if (st) {
        const p = document.createElement("p");
        p.id = "tutLink";
        p.className = "small";
        p.innerHTML = `Prefer to watch? <a href="#/tutorial">Play the narrated tutorial</a>`;
        st.after(p);
      }
    }
    if (h.startsWith("#/more") && !document.getElementById("tutMore")) {
      const page = document.querySelector("#view .page") || document.getElementById("view");
      const anchor = page && page.querySelector("section.panel");
      if (anchor) {
        const s = document.createElement("section");
        s.className = "panel";
        s.id = "tutMore";
        s.innerHTML = `<h2>Tutorial</h2><p style="margin-top:0">A narrated walkthrough of the app that plays by itself.</p><a class="btn" href="#/tutorial">Play the tutorial</a>`;
        anchor.before(s);
      }
    }
  }
  window.addEventListener("hashchange", () => setTimeout(addLinks, 60));
  setTimeout(addLinks, 120);
  window.AeroTutorial = { start, stop, scripts: SCRIPTS };
  if ((location.hash || "").startsWith("#/tutorial")) go();
})();
