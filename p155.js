"use strict";
/* p155: Planning lab (October 28, 2026). Six short lessons on preflight planning, each tied to the
   Private Pilot Airman Certification Standards, Area I Preflight Preparation, with key points, notes
   for common trainers (Cessna 172 and Piper Warrior), a practice flight that opens the matching part
   of the brief, and three check questions. Progress is saved on this device (S.lab).
   Content is general training material. Aircraft notes say "typically" and point to the POH; the
   school's own POH, checklists and instructor govern. Nothing here is a substitute for ground or
   flight instruction from a certificated instructor. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LESSONS = [
    {
      id: "wx", title: "Weather: is the flight legal and wise?", acs: "Area I, Task C: Weather information", min: 6, panel: "wtgPanel",
      why: "Most weather accidents start on the ground, with a decision to go into conditions the pilot or airplane could not handle. Good weather planning answers two questions: is the flight legal, and is it within my personal minimums?",
      points: [
        "Get an official briefing for every flight (Flight Service at 1800wxbrief.com or 1 800 WX BRIEF). The app's weather is for planning.",
        "Read the METAR for now and the TAF for your arrival time. A TEMPO or PROB group means conditions may get worse for part of that window; plan for the worse case.",
        "Basic VFR in Class E below 10,000 feet MSL: 3 statute miles visibility, and stay 500 feet below, 1,000 feet above and 2,000 feet horizontally from clouds (14 CFR 91.155). Class B: 3 miles and clear of clouds. Class C and D: same as Class E.",
        "In Class G during the day at or below 1,200 feet above the surface: 1 mile and clear of clouds. Know which airspace you will be in, because the minimums change.",
        "Set personal minimums with your instructor that are higher than the legal ones, and write them down before you look at the forecast.",
        "Check winds against your crosswind limit, and look for turbulence, icing and convective advisories along the route.",
      ],
      ac: "Training airplanes like the 172 and Warrior are not approved for flight into known icing. Treat any icing forecast at your altitude as a no go.",
      practice: "Open the brief and read the When to go timeline: which hours are VFR at both ends?",
      quiz: [
        ["In Class E airspace below 10,000 feet MSL, what are the basic VFR visibility and cloud clearances?", ["1 mile and clear of clouds", "3 miles; 500 below, 1,000 above, 2,000 horizontal", "5 miles; 1,000 below, 1,000 above, 1 mile horizontal"], 1, "14 CFR 91.155: 3 statute miles, 500 feet below, 1,000 feet above and 2,000 feet horizontal."],
        ["A TAF shows TEMPO 1 1/2SM BR OVC008 during your arrival window. How should you plan?", ["Ignore it; TEMPO is only temporary", "Plan as if those conditions will occur during that window", "Plan only from the main line of the TAF"], 1, "Temporary conditions are expected to occur; a VFR student should plan for them and have an alternate or a later time."],
        ["Where should you get your official weather briefing?", ["Any weather app", "Flight Service (1800wxbrief.com or 1 800 WX BRIEF)", "The previous pilot"], 1, "Flight Service provides the official briefing and keeps a record of it."],
      ],
    },
    {
      id: "perf", title: "Performance: density altitude and runway length", acs: "Area I, Task F: Performance and limitations", min: 6, panel: "pfPanel",
      why: "An airplane that climbs well on a cool morning can barely climb on a hot afternoon at the same field. Density altitude is how the airplane feels the air, and it changes takeoff distance and climb rate.",
      points: [
        "Pressure altitude is field elevation plus 1,000 feet for every inch of mercury the altimeter setting is below 29.92 (minus when above).",
        "Standard temperature is 15 °C at sea level and about 2 °C cooler per 1,000 feet. Density altitude rises about 120 feet for each degree Celsius above standard.",
        "Use the takeoff and landing distance charts in your airplane's POH with the actual pressure altitude, temperature, weight and wind. Add your school's safety margin.",
        "Grass, a wet runway, an upslope or a tailwind all lengthen the takeoff roll. The POH notes say how much.",
        "Pick an abort point before takeoff: if you are not at a set speed by a set point on the runway, stop.",
      ],
      ac: "In a 172 or Warrior at full weight on a hot summer day, the takeoff roll and climb can be much worse than in your usual training weather. Always run the POH numbers for the day.",
      practice: "Open the brief and look at Takeoff and landing distance and the density altitude for each airport.",
      quiz: [
        ["The altimeter is 29.42 at a field 1,000 feet above sea level. What is the pressure altitude?", ["500 feet", "1,000 feet", "1,500 feet"], 2, "29.92 minus 29.42 is 0.50 inch, about 500 feet, added to 1,000 feet of elevation."],
        ["Higher density altitude means:", ["Shorter takeoff and better climb", "Longer takeoff and weaker climb", "No change if the runway is long"], 1, "Thinner air reduces engine power, propeller thrust and wing lift."],
        ["Where do the takeoff distance numbers for your airplane come from?", ["A rule of thumb", "The POH charts for that airplane", "The last flight"], 1, "The POH charts, used with the day's conditions and weight."],
      ],
    },
    {
      id: "wb", title: "Weight and balance: inside the envelope", acs: "Area I, Task F: Performance and limitations", min: 7, panel: "wbPanel",
      why: "An airplane loaded over weight or with the center of gravity outside limits can be hard or impossible to control, especially at low speed. You confirm both before every flight, for takeoff and for landing.",
      points: [
        "Use the empty weight and arm from that airplane's current weight and balance record, not a book example. Each tail is different.",
        "Weight times arm equals moment. Add up the moments and divide by the total weight to get the center of gravity.",
        "Check takeoff and landing. Burning fuel moves the center of gravity, so a loading that is fine at takeoff can be outside limits at landing.",
        "Avgas weighs about 6 pounds per gallon. Full tanks often mean you cannot fill every seat; something has to give.",
        "Many trainers, including the 172, have a smaller utility category envelope for maneuvers such as spins. Know which category your lesson requires.",
      ],
      ac: "Your school's fleet page holds each airplane's numbers. Pick your tail on the flight so the brief uses them.",
      practice: "Open the brief's Weight, balance and fuel panel, enter yourself, your instructor and fuel, and check both points on the envelope.",
      quiz: [
        ["Where should the empty weight come from?", ["The POH sample loading", "The airplane's current weight and balance record", "An average for the type"], 1, "Each airplane's current weight and balance record reflects its equipment."],
        ["Why check the center of gravity at landing as well as takeoff?", ["Fuel burn moves it", "Landing weight is always higher", "It is not needed"], 0, "Fuel burned changes both weight and center of gravity."],
        ["About how much does a gallon of avgas weigh?", ["4 pounds", "6 pounds", "8 pounds"], 1, "About 6 pounds per gallon."],
      ],
    },
    {
      id: "fuel", title: "Fuel: plan it, check it, manage it", acs: "Area I, Task D: Cross country flight planning", min: 6, panel: "wbPanel",
      why: "Fuel exhaustion and fuel starvation accidents are almost entirely preventable. They happen when the plan was optimistic, the tanks were not checked, or the fuel system was managed wrong.",
      points: [
        "VFR reserve (14 CFR 91.151): enough fuel to reach the first point of intended landing and fly 30 more minutes at normal cruise by day, 45 at night. Many schools require more.",
        "Plan with the POH fuel burn for your power setting, plus fuel for taxi, runup and climb, and a headwind margin.",
        "Check fuel visually before every flight, and sump each drain for water and the right color.",
        "Know unusable fuel: the gauge reading is not all usable fuel.",
        "Set a time to check fuel in flight, and land with your reserve intact.",
      ],
      ac: "Typically, a 172 feeds from both tanks with the selector on BOTH, while a Warrior has a left and right selector and you switch tanks on a schedule; the Warrior also has an electric fuel pump used for takeoff and landing. Your POH and checklist govern.",
      practice: "Open the brief's fuel check and see whether fuel on board covers the trip plus the reserve.",
      quiz: [
        ["What is the day VFR fuel reserve under 14 CFR 91.151?", ["15 minutes", "30 minutes at normal cruise", "1 hour"], 1, "30 minutes by day and 45 minutes at night, at normal cruising speed."],
        ["How should you confirm the fuel on board before flight?", ["Trust the gauges", "Check the tanks visually and sump the drains", "Ask the last renter"], 1, "Visual check plus sumping for water and contamination."],
        ["In a Warrior with a left and right tank selector, what does good fuel management include?", ["Never switching tanks", "Switching tanks on a schedule and checking the selector before landing", "Running one tank dry first"], 1, "Switch on a schedule per the POH and confirm the selector and pump before landing."],
      ],
    },
    {
      id: "air", title: "Airspace and the route", acs: "Area I, Task E: National Airspace System", min: 6, panel: "asPanel",
      why: "Airspace mistakes and missed TFRs are among the most common enforcement actions against new pilots. A route plan names every airspace, the entry requirements, and the frequencies you will need.",
      points: [
        "Class B needs an explicit clearance (\"cleared into the Class Bravo\"). Class C needs two way radio communication established. Class D needs two way communication before entering.",
        "Within 30 nautical miles of a Class B primary airport (the Mode C veil) you need a transponder with altitude reporting and ADS B Out.",
        "Check TFRs for the route and time every time, right before you go. Some appear on short notice.",
        "Note restricted areas, MOAs and military training routes along the route, and how you will avoid or cross them.",
        "Choose checkpoints you can see from the air, and write frequencies and altitudes on your nav log.",
      ],
      ac: "Around Pensacola, for example, there is busy military training airspace and Navy fields. Plan lateral and vertical limits, and talk to approach when you can.",
      practice: "Open the map with the route and look at the airspace and TFR layers along it.",
      quiz: [
        ["What do you need before entering Class B airspace?", ["Two way radio contact", "An explicit clearance from ATC", "Nothing in VFR conditions"], 1, "You must be cleared into Class B."],
        ["Within the Mode C veil around a Class B primary airport you need:", ["A transponder with altitude reporting and ADS B Out", "Only a radio", "An instrument rating"], 0, "Altitude reporting transponder and ADS B Out are required within 30 nautical miles."],
        ["When should you check TFRs?", ["Once when you plan", "When you plan and again right before departure", "Only for long trips"], 1, "TFRs can appear on short notice."],
      ],
    },
    {
      id: "risk", title: "Risk and the go or no go decision", acs: "Area I, Task H: Human factors, and risk management", min: 5, panel: "bfBluf",
      why: "Most accidents involve a chain of small decisions. A simple risk check before every flight, made honestly, breaks the chain early.",
      points: [
        "PAVE: Pilot, Aircraft, enVironment, External pressures. Look at each before every flight.",
        "IMSAFE for yourself: Illness, Medication, Stress, Alcohol, Fatigue, Emotion.",
        "Alcohol: no flying within 8 hours of drinking, or at 0.04 blood alcohol or more, or while impaired (14 CFR 91.17). Many pilots use 12 or 24 hours.",
        "External pressures (a schedule, passengers, a checkride date) push pilots past their minimums. Name them out loud.",
        "Decide your no go triggers before you look at the forecast, and keep them.",
      ],
      ac: "The brief's verdict and the accident lessons show what has gone wrong in flights like yours. Read them as a conversation starter with your instructor, not as a grade.",
      practice: "Open the brief, read the verdict and the reasons, and then score the flight risk assessment.",
      quiz: [
        ["What does the E in PAVE stand for?", ["Engine", "Environment", "Experience"], 1, "Pilot, Aircraft, enVironment, External pressures."],
        ["Under 14 CFR 91.17, the minimum time between drinking and flying is:", ["4 hours", "8 hours", "24 hours"], 1, "8 hours bottle to throttle, plus the 0.04 limit and no impairment."],
        ["When should you set your no go triggers?", ["After reading the forecast", "Before looking at the forecast", "Only for cross country flights"], 1, "Setting them first keeps the decision honest."],
      ],
    },
  ];
  const lab = () => (S.lab = S.lab && typeof S.lab === "object" ? S.lab : {});
  const css = document.createElement("style");
  css.textContent = `
    .lab-page .lab-list a{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px;border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:14px;margin:0 0 8px;color:var(--ink,#EAF2FF);text-decoration:none;min-height:44px}
    .lab-page .lab-list a b{font-size:15.5px}
    .lab-page .lab-list a small{display:block;color:var(--ink2,#9db2ce);font-size:12.5px;margin-top:2px}
    .lab-page .done{color:#46e39b;font:700 12px var(--mono,monospace);white-space:nowrap}
    .lab-page .todo{color:var(--ink2,#9db2ce);font:600 12px var(--mono,monospace);white-space:nowrap}
    .lab-page .bar{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin:6px 0 14px}
    .lab-page .bar i{display:block;height:100%;background:#46e39b}
    .lab-page ul.kp{padding-left:20px;line-height:1.55}
    .lab-page ul.kp li{margin:0 0 6px}
    .lab-page .acn{border-left:3px solid var(--cyan,#3DE0FF);padding:8px 12px;background:rgba(61,224,255,.06);border-radius:0 10px 10px 0;font-size:14.5px;line-height:1.5}
    .lab-page .q{border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:12px;padding:12px;margin:0 0 10px}
    .lab-page .q p{margin:0 0 8px;font-weight:600}
    .lab-page .q button{display:block;width:100%;text-align:left;margin:6px 0;padding:10px 12px;border-radius:10px;border:1px solid var(--line2,rgba(255,255,255,.18));background:transparent;color:var(--ink,#EAF2FF);cursor:pointer;min-height:44px;font-size:14.5px}
    .lab-page .q button.right{border-color:#46e39b;background:rgba(70,227,155,.10)}
    .lab-page .q button.wrong{border-color:#ff4d6a;background:rgba(255,77,106,.08)}
    .lab-page .q .ex{font-size:13.5px;color:var(--ink2,#9db2ce);margin-top:6px}
    .lab-page .pr .row{display:flex;flex-wrap:wrap;gap:8px;align-items:end}
    .lab-page .pr label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--ink2,#9db2ce);text-transform:none;letter-spacing:normal}
    .lab-page .pr input,.lab-page .pr select{font-size:15px;padding:8px 10px}
    .lab-page .d{margin-top:14px;font-weight:700;color:#ff4d6a;font-size:12.5px}
  `;
  document.head.appendChild(css);
  const DISC = `<p class="d">Training material only. It does not replace instruction from a certificated flight instructor, your school's syllabus, the POH or an official weather briefing. The pilot in command is responsible for every flight.</p>`;

  function listPage(el) {
    const L = lab(), done = LESSONS.filter((l) => L[l.id] && L[l.id].done).length;
    el.innerHTML = `<div class="page lab-page"><h1>Planning lab</h1>
      <p class="lede">Six short lessons on preflight planning, each tied to the Private Pilot ACS, Area I Preflight Preparation. Read the key points, plan a practice flight in the app, then check yourself.</p>
      <div class="small muted">${done} of ${LESSONS.length} complete</div><div class="bar"><i style="width:${Math.round((done / LESSONS.length) * 100)}%"></i></div>
      <div class="lab-list">${LESSONS.map((l, i) => { const r = L[l.id]; return `<a href="#/lab/${l.id}"><span><b>${i + 1}. ${h(l.title)}</b><small>${h(l.acs)} · about ${l.min} minutes</small></span>${r && r.done ? `<span class="done">DONE ${r.score}/3</span>` : `<span class="todo">START</span>`}</a>`; }).join("")}</div>
      ${DISC}</div>`;
  }
  function tails() { let all = {}; try { all = allAircraft(); } catch {} return Object.keys(all); }
  async function practice(l, route, tail) {
    const words = String(route || "").toUpperCase().trim();
    if (!words) { toast("Enter a practice route"); return; }
    const f = newFlight();
    const d = new Date(Date.now() + 864e5); const pad = (n) => String(n).padStart(2, "0");
    f.route = words; f.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; f.time = "10:00"; f.rules = "VFR";
    if (tail) f.tail = tail;
    f.planText = `Planning lab practice: ${l.title}`; f.lab = l.id;
    try { const r = await resolveRoute(words); f.points = r.points || []; f.unresolved = r.unresolved || []; } catch { toast("Could not look up that route. Check your connection."); return; }
    if (f.unresolved.length) toast(`Not found: ${f.unresolved.join(", ")}. Fix it on the Flights page.`);
    f.updated = Date.now(); S.currentId = f.id; save();
    location.hash = l.panel === "asPanel" ? "#/maps" : "#/brief";
    if (l.panel && l.panel !== "asPanel") { let n = 0; const t = setInterval(() => { const p = document.getElementById(l.panel); if (p || ++n > 60) { clearInterval(t); if (p) p.scrollIntoView({ behavior: "smooth", block: "start" }); } }, 250); }
  }
  function lessonPage(el, id) {
    const i = LESSONS.findIndex((x) => x.id === id), l = LESSONS[i];
    if (!l) return listPage(el);
    const L = lab(), ans = (L[l.id] && L[l.id].ans) || [];
    const ts = tails();
    const last = (S.flights || []).find((f) => f.points && f.points.length >= 2 && !f.demo);
    const defRoute = last ? last.route : "KPNS KJKA";
    el.innerHTML = `<div class="page lab-page"><p class="small"><a href="#/lab">Planning lab</a> · Lesson ${i + 1} of ${LESSONS.length}</p>
      <h1>${h(l.title)}</h1><p class="lede">${h(l.acs)}. ${h(l.why)}</p>
      <section class="panel"><h2>Key points</h2><ul class="kp">${l.points.map((p) => `<li>${h(p)}</li>`).join("")}</ul>
        <div class="acn"><b>Cessna 172 and Piper Warrior notes.</b> ${h(l.ac)}</div></section>
      <section class="panel pr"><h2>Practice</h2><p>${h(l.practice)}</p>
        <div class="row"><label>Practice route<input id="lbRoute" value="${h(defRoute)}" autocapitalize="characters" spellcheck="false"></label>
        <label>Airplane<select id="lbTail"><option value="">No airplane yet</option>${ts.map((t) => `<option value="${h(t)}">${h(t)}</option>`).join("")}</select></label>
        <button type="button" class="btn" id="lbGo">Plan it for tomorrow</button></div>
        <p class="small muted">This creates a practice flight for tomorrow at 10:00 and opens the part of the brief this lesson is about.</p></section>
      <section class="panel"><h2>Check yourself</h2>${l.quiz.map((q, qi) => `<div class="q" data-q="${qi}"><p>${qi + 1}. ${h(q[0])}</p>${q[1].map((o, oi) => `<button type="button" data-o="${oi}">${h(o)}</button>`).join("")}<div class="ex" hidden></div></div>`).join("")}
        <p id="lbScore" class="small"></p></section>
      <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">${i > 0 ? `<a class="btn sec" href="#/lab/${LESSONS[i - 1].id}">Previous</a>` : ""}${i < LESSONS.length - 1 ? `<a class="btn sec" href="#/lab/${LESSONS[i + 1].id}">Next lesson</a>` : `<a class="btn sec" href="#/lab">All lessons</a>`}</div>
      ${DISC}</div>`;
    if (ts.length) { const sel = el.querySelector("#lbTail"); const cur = (() => { try { return currentFlight(); } catch { return null; } })(); sel.value = cur && ts.includes(cur.tail) ? cur.tail : ts[0]; }
    el.querySelector("#lbGo").onclick = () => practice(l, el.querySelector("#lbRoute").value, el.querySelector("#lbTail").value);
    const mark = (qi, oi) => {
      const box = el.querySelector(`.q[data-q="${qi}"]`), q = l.quiz[qi];
      box.querySelectorAll("button").forEach((b) => { b.classList.remove("right", "wrong"); if (+b.dataset.o === q[2]) b.classList.add("right"); else if (+b.dataset.o === oi) b.classList.add("wrong"); });
      const ex = box.querySelector(".ex"); ex.hidden = false; ex.textContent = (oi === q[2] ? "Right. " : "Not quite. ") + q[3];
    };
    const score = () => {
      const a = (lab()[l.id] || {}).ans || [];
      if (a.filter((x) => x != null).length < l.quiz.length) { el.querySelector("#lbScore").textContent = ""; return; }
      const s = a.reduce((n, x, qi) => n + (x === l.quiz[qi][2] ? 1 : 0), 0);
      lab()[l.id] = { ...lab()[l.id], done: true, score: s, at: Date.now() };
      save();
      el.querySelector("#lbScore").innerHTML = `<b>${s} of 3.</b> ${s === 3 ? "Lesson complete." : "Lesson complete. Review the explanations, and talk through the ones you missed with your instructor."}`;
    };
    ans.forEach((oi, qi) => { if (oi != null) mark(qi, oi); });
    score();
    el.querySelectorAll(".q").forEach((box) => box.querySelectorAll("button").forEach((b) => (b.onclick = () => {
      const qi = +box.dataset.q, oi = +b.dataset.o;
      const r = (lab()[l.id] = lab()[l.id] || {}); r.ans = r.ans || []; r.ans[qi] = oi; save();
      mark(qi, oi); score();
    })));
  }
  if (typeof ROUTES !== "undefined") ROUTES.lab = (el, arg) => (arg ? lessonPage(el, String(arg)) : listPage(el));
  window.AeroLab = { LESSONS, progress: () => lab() };
})();
