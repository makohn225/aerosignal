"use strict";
/* Password rules to match the Supabase Auth settings (minimum 10 characters with lowercase,
   uppercase, a digit and a symbol). Updates the hint under every new password field, checks the
   password in the browser before it is sent, and replaces the older "8 characters" wording in
   error messages. */
(function () {
  const HINT = "At least 10 characters, with an uppercase letter, a lowercase letter, a number and a symbol.";
  const OLD = /At least 8 characters, with letters and numbers\.?/;
  const OLD_ERR = /Choose a stronger password: at least 8 characters with letters and numbers\.?/;
  const NEW_ERR = "Choose a stronger password: " + HINT.charAt(0).toLowerCase() + HINT.slice(1);
  function problems(v) {
    const miss = [];
    if (v.length < 10) miss.push("at least 10 characters");
    if (!/[a-z]/.test(v)) miss.push("a lowercase letter");
    if (!/[A-Z]/.test(v)) miss.push("an uppercase letter");
    if (!/[0-9]/.test(v)) miss.push("a number");
    if (!/[^A-Za-z0-9]/.test(v)) miss.push("a symbol");
    return miss;
  }
  function fix(root) {
    root.querySelectorAll('input[type="password"][autocomplete="new-password"]').forEach((el) => {
      if (el.dataset.pw10) return;
      el.dataset.pw10 = "1";
      el.minLength = 10;
      const check = () => {
        const m = el.value ? problems(el.value) : [];
        el.setCustomValidity(m.length ? `Needs ${m.join(", ")}.` : "");
      };
      el.addEventListener("input", check);
      check();
    });
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (OLD.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(OLD, HINT);
      else if (OLD_ERR.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(OLD_ERR, NEW_ERR);
    }
  }
  // Only look at what was just added, and skip the map, so busy pages stay fast
  new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.addedNodes) {
      const el = n.nodeType === 1 ? n : n.parentElement;
      if (!el || (el.closest && el.closest(".leaflet-container"))) continue;
      if (n.nodeType === 3) { if (OLD.test(n.nodeValue) || OLD_ERR.test(n.nodeValue)) fix(el); }
      else if (n.nodeType === 1) fix(n);
    }
  }).observe(document.body, { childList: true, subtree: true });
  fix(document.body);
  window.AeroPwRules = { problems };
})();

/* p61: the "Try the demo" tour, rewritten in the same voice as the narrated tutorial, with each
   step pointing at the part of the page it talks about. Runs after every older module, so the
   steps here are the whole tour. The spotlight is a soft pulsing outline that never blocks taps. */
(function () {
  if (typeof TOURS === "undefined") return;
  const MID = "m_sample_itx_iron";
  // [page, title, text, what to point at (a comma list tried in order)]
  TOURS.civil.steps = [
    ["#/flights", "Your flight", "IFR from Manassas down to Lynchburg. File it the way you always do. V143 opens up into every fix along the way, and the route is checked against your airplane and your logbook.", "#route"],
    ["#/brief", "The brief", "Your risk score up top, then real NTSB accidents from flights that look like this one. Same kind of airplane, route, weather and time of day, weighed against your own recent flying.", "a.frat-chip, #bbody"],
    ["#/maps", "The route", "Every accident along the corridor, plus training routes, restricted airspace and safe altitudes. Swap charts in the top right, tap Edit route to drag waypoints, and tap anywhere for lat long and MGRS.", "#view .leaflet-container"],
    ["#/logbook", "The logbook", "Totals and currency straight from a ForeFlight logbook. That's what tunes the warnings in the brief.", "#curPanel"],
    ["#/safety", "Safety search", "Study a type, an airport or a hazard before you go. NTSB records and public military mishap narratives, side by side.", "#sfForm"],
    ["#/plan", "Plan in plain words", "Describe the flight the way you'd tell a buddy, and it builds the route and the times. Tap Ask on any page to make changes the same way, with an undo.", "#qText, .qbar"],
    ["#/feedback", "Your turn", "That's the tour. Tell me what worked, what didn't, and what you want next. It comes straight to me.", "#fbf"],
  ];
  TOURS.military.steps = [
    [`#/missions/${MID}/plan`, "The mission", "A notional night raid at Yuma. Eleven aircraft, in on route ARIZONA and out on route NEVADA, eight legs with mission types, and an objective area diagram of the LZs and waypoints.", ".legcard"],
    [`#/missions/${MID}/brief`, "The brief", "Hazards for each mission type, lessons from past debriefs, and a route check with safe altitudes, training routes and restricted airspace on one map.", "#routecheck"],
    [`#/missions/${MID}/debrief`, "The debrief", "RAT, the way aviators already debrief. Reconstruct, Analyze, Teach. Every focus point ends in a fix with an owner.", "section.panel.rat"],
    ["#/missions/m_sample_dve_workup/brief", "Lessons carried forward", "The next mission's brief already carries the fixes from the raid's debrief. Every sortie teaches the next one.", "@h:Lessons from your past debriefs"],
    [`#/kneeboard/${MID}`, "Kneeboard", "Cards built straight from the plan: navlog, waypoints in lat long and MGRS, and comm. Print them, or fly them one leg at a time in cockpit view.", "#kbNav"],
    ["#/logbook", "The logbook", "NVG hours, T&R codes and currency from a military logbook.", "#milpanel"],
    ["#/maps", "Maps", "The route on the sectional or the IFR enroute charts, with mishaps along the corridor. Tap Edit route to move a waypoint, and tap anywhere for lat long and MGRS.", "#view .leaflet-container"],
    ["#/safety", "Safety search", "Past mishaps by aircraft, place or hazard. Military narratives come from public reporting only, never from official mishap reports.", "#sfForm"],
    ["#/feedback", "Your turn", "That's the tour. Never enter CUI or classified information. Tell me what worked and what you want next. It comes straight to me.", "#fbf"],
  ];
  // Older add ons look for these flags before adding their own steps
  Object.assign(TOURS, { _ask: true, _ck: true, _tfr: true });

  const css = document.createElement("style");
  css.textContent = `
    .tourHi{outline:3px solid #3DE0FF!important;outline-offset:4px;border-radius:12px;animation:tourHi 1.8s ease-in-out infinite;scroll-margin-top:84px}
    @keyframes tourHi{0%,100%{box-shadow:0 0 0 0 rgba(61,224,255,0)}50%{box-shadow:0 0 22px 2px rgba(61,224,255,.55)}}
    @media (prefers-reduced-motion:reduce){.tourHi{animation:none}}
  `;
  document.head.appendChild(css);

  const seen = (e) => { const q = e.getBoundingClientRect(); return q.width > 0 && q.height > 0; };
  function find(sel) {
    for (const s of String(sel || "").split(",").map((x) => x.trim()).filter(Boolean)) {
      if (s.startsWith("@h:")) {
        const want = s.slice(3).toLowerCase();
        const h = [...document.querySelectorAll("#view h2, #view h3")].find((x) => seen(x) && x.textContent.trim().toLowerCase().startsWith(want));
        if (h) return h.tagName === "H2" ? h.closest("section") || h : h.nextElementSibling || h.parentElement;
        continue;
      }
      const el = [...document.querySelectorAll(s)].find(seen);
      if (el) return el;
    }
    return null;
  }
  const clear = () => document.querySelectorAll(".tourHi").forEach((e) => e.classList.remove("tourHi"));
  let run = 0;
  async function mark() {
    const me = ++run;
    clear();
    let st = null;
    try { st = typeof tourGet === "function" ? tourGet() : null; } catch {}
    if (!st || !TOURS[st.p] || document.body.classList.contains("tut")) return;
    const step = TOURS[st.p].steps[st.i];
    if (!step || step[0] !== location.hash || !step[3]) return;
    for (let k = 0; k < 30 && me === run; k++) {
      const el = find(step[3]);
      if (el) {
        el.classList.add("tourHi");
        const bar = document.getElementById("tourBar");
        const bottom = bar ? bar.getBoundingClientRect().top : innerHeight;
        const fit = () => { const q = el.getBoundingClientRect(); if (me === run && document.body.contains(el) && (q.top < 60 || q.top > bottom - 120)) el.scrollIntoView({ block: "start", behavior: "smooth" }); };
        fit();
        // Pages keep filling in after they draw; line it up again once they settle
        setTimeout(fit, 1200); setTimeout(fit, 2600);
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  window.addEventListener("hashchange", () => setTimeout(mark, 250));
  // The page can redraw after loading data; put the outline back if it was lost
  setInterval(() => { if (document.getElementById("tourBar") && !document.querySelector(".tourHi")) mark(); }, 1500);
  setTimeout(mark, 400);
  try { if (typeof renderTour === "function" && document.getElementById("tourBar")) renderTour(); } catch {}

  // Recorded narration for the rewritten tutorial lines (files ending in "m"). A line whose file is
  // not uploaded yet is read by the device voice instead.
  try { if (window.AeroNarration && AeroNarration.manifest) Object.assign(AeroNarration.manifest, {"a9a5220f":["a9a5220fm",12.8],"c7199468":["c7199468m",12.7],"43300868":["43300868m",13.6],"ba94525d":["ba94525dm",12.1],"2f607bd9":["2f607bd9m",10.2],"739e1d32":["739e1d32m",8.9],"caf10cc4":["caf10cc4m",7.9],"986df244":["986df244m",9.7],"46250b0a":["46250b0am",7.9],"5202a10e":["5202a10em",6.0],"7e86c41b":["7e86c41bm",9.6],"eaec04ef":["eaec04efm",7.5],"95c41362":["6a736b71m",9.4],"6a736b71":["6a736b71m",9.4],"fbe6330c":["fbe6330cm",8.0],"9acfb8c5":["9acfb8c5m",9.8],"c4e8012d":["c4e8012dm",12.3],"16809982":["d1a032c3m",10.7],"d1a032c3":["d1a032c3m",10.7],"832991fa":["832991fam",9.4],"92cc43bc":["92cc43bcm",8.9],"fe487f55":["fe487f55m",11.6],"53bf9739":["53bf9739m",5.8],"50ee752b":["50ee752bm",8.8],"8cd782e6":["8cd782e6m",6.9],"19b6fff0":["19b6fff0m",10.0],"f6e44498":["f6e44498m",4.9],"9593f57e":["9593f57em",8.7],"ed657b7f":["ed657b7fm",8.6],"19aa381c":["19aa381cm",9.8],"20fa5a51":["20fa5a51m",6.1]}); } catch {}
  window.AeroTourHi = { mark };
})();
