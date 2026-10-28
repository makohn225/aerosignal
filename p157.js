"use strict";
/* p157: tutorial and demo for the two modes (October 28, 2026).
   1. A Flight School track for the narrated tutorial (p19): the mode hub, the planning lab and a lesson,
      a practice flight from Pensacola to Gulf Shores in a sample 172, the verdict and weight and balance
      in the brief, the school fleet and invite, and the instructor dashboard of the sample school.
      New lines use the device voice until recordings are made.
   2. The Tutorial page offers Flight School, Military Planning and the instrument pilot tour, with the
      current mode first. Starting the Flight School tutorial on a first visit picks Flight School mode.
   3. The demo page (#/demo, #/welcome) gets a Flight school card that opens the sample school.
   4. In Flight School mode the Start here card describes the Flight School tabs instead of Missions. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const T = window.AeroTutorial;
  if (!T || !T.scripts) return;

  T.scripts.school = {
    label: "Flight School",
    scenes: [
      { hash: "#/plan", sel: "#modeHub", wait: "#modeHub", text: "This is Flight School mode, built for student pilots and their instructors. The planning lab, a training flight, the school fleet and your flight school all start right here." },
      { hash: "#/lab", sel: ".lab-list", wait: ".lab-list", text: "The planning lab has six short lessons tied to the preflight preparation tasks in the Private Pilot ACS: weather, performance, weight and balance, fuel, airspace and risk." },
      { hash: "#/lab/wb", sel: "@h:Key points", wait: ".lab-page .kp", text: "Each lesson starts with the key points, plus notes for the Cessna 172 and the Piper Warrior. About six minutes each." },
      { hash: "#/lab/wb", sel: ".lab-page .panel.pr", wait: ".lab-page .panel.pr", text: "Then plan a practice flight in the app. It opens right on the part of the brief the lesson is about." },
      { hash: "#/lab/wb", sel: "@h:Check yourself", wait: ".lab-page .q", text: "Three check questions close out the lesson, with the reasoning for each answer. Talk through any you miss with your instructor." },
      { hash: "#/brief", sel: "#bfBluf .vd, #bfBluf", wait: "#bfBluf", text: "Here's a practice flight from Pensacola to Gulf Shores. The GO, CAUTION or NO GO badge sums up what the brief checked, with the reasons. The decision stays with the pilot and the instructor." },
      { hash: "#/brief", sel: "#wbPanel, @h:Weight and balance", wait: "#wbPanel", text: "Weight and balance uses the numbers for the exact airplane on the schedule, straight from the school fleet." },
      { hash: "#/fleet", sel: ".fl-ac, @h:Airplanes", wait: ".fl-page", text: "Instructors set up each airplane once on the Fleet page: its weight and balance numbers and its checklists." },
      { hash: "#/fleet", sel: ".fl-page .share, @h:Share with students", wait: ".fl-page", text: "Then one invite link or QR code brings each student into the school with the whole fleet loaded." },
      { hash: "#/school/demo", sel: "@h:Shared briefs", wait: ".sc-dash table", text: "Students share their brief with the school. Instructors see every verdict and its reasons on one dashboard, before the student shows up for the lesson." },
      { hash: "#/school/demo", sel: "@h:Planning lab progress, @h:Roster", wait: ".sc-dash table", text: "When a student turns it on, their planning lab progress shows up here too, so ground work and flight work stay in one place." },
      { hash: "#/feedback", sel: "#fbf, .page", text: "That's the tour. AeroSignal is a training aid, so your instructor, your syllabus and the POH always come first. Send feedback from any page. Every note gets read." },
    ],
  };

  // The Flight School tutorial plans its practice flight in a sample 172 from the sample school
  async function setupSchool() {
    // The sample instrument pilot's logbook (loaded by p19) is not this student's; a lapsed flight
    // review from it would turn the practice brief into NO GO
    if (S.logbook && /^Demo /.test(S.logbook.source || "")) S.logbook = { aircraft: {}, flights: [], importedAt: null, source: null };
    try { if (window.AeroSampleSchool && window.AeroFleet && !(S.profiles || {}).DEMO1) AeroFleet.importData(AeroSampleSchool.sampleFleet(), { sample: true }); } catch (e) { console.error(e); }
    let f = (S.flights || []).find((x) => x.demo);
    if (!f) { f = newFlight(); f.demo = true; }
    const d = new Date(Date.now() + 864e5); const pad = (n) => String(n).padStart(2, "0");
    f.route = "KPNS KJKA"; f.rules = "VFR"; f.tail = "DEMO1"; f.missionId = undefined;
    f.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; f.time = "10:00";
    f.planText = "Sample student flight: Pensacola to Gulf Shores in a 172";
    try { const r = await resolveRoute(f.route); f.points = r.points || []; f.unresolved = r.unresolved || []; } catch { f.points = f.points || []; }
    f.updated = Date.now(); S.currentId = f.id;
    try { save(); } catch {}
  }
  const baseStart = T.start;
  T.start = async function (track, statusEl) {
    if (track === "school") {
      if (!S.role) { S.role = "civil"; try { save(); } catch {} document.body.classList.add("mode-school"); }
      // Plan before the tutorial starts, so the brief scenes find the practice flight
      const gate = baseStart.call(this, track, statusEl);
      await gate;
      await setupSchool();
      return;
    }
    return baseStart.apply(this, arguments);
  };
  // The sample data loader inside p19 runs before setupSchool; make the first scene wait for it
  T.scripts.school.scenes[0].wait = "#modeHub";

  // Tutorial page: three tracks, the current mode first
  const CARDS = {
    school: ["✈", "Flight School", "The planning lab, a practice flight in a sample 172, the brief and its verdict, the school fleet and the instructor dashboard.", "Play the Flight School tutorial"],
    military: ["★", "Military Planning", "Mission plan, objective area diagram, the brief, the RAT debrief, kneeboard cards, mishaps and training routes, and the logbook.", "Play the military tutorial"],
    civil: ["◆", "Instrument pilot", "An IFR flight in Virginia: route entry, the risk brief, accidents on the map, safe altitudes, plates and the logbook.", "Play the instrument pilot tutorial"],
  };
  function pageTutorial(el) {
    const m = window.AeroMode ? AeroMode.get() : null;
    const order = m === "mil" ? ["military", "school", "civil"] : ["school", "military", "civil"];
    el.innerHTML = `<div class="page welcome">
      <p class="wk">AEROSIGNAL TUTORIAL</p>
      <h1>Pick a guided tutorial.</h1>
      <p class="lede">It plays by itself and reads each step aloud. Pause, go back or skip at any time. Sample data loads first, and if you already have your own data it is put back when the tutorial ends.</p>
      <div class="wchoice tut3">${order.map((k) => { const [ic, t, d, go] = CARDS[k]; return `<button class="wcard${k === "military" ? " mil" : ""}" data-p="${k}"><span class="wic">${ic}</span><span class="wt">${h(t)}</span><span class="wd">${h(d)}</span><span class="wgo">${h(go)}</span></button>`; }).join("")}</div>
      <p id="tutStatus" class="small muted" style="min-height:22px;margin-top:14px"></p>
      <p class="small muted">Tip: to make a video for new users, start a screen recording, then play the tutorial.</p>
    </div>`;
    el.querySelectorAll(".wcard").forEach((b) => (b.onclick = () => T.start(b.dataset.p, el.querySelector("#tutStatus"))));
    // The intro video note from p53, which this page replaces
    if (window.AeroPromo && AeroPromo.play) {
      const n = document.createElement("p"); n.id = "pvNote"; n.className = "small muted";
      n.innerHTML = `It opens with a one minute intro video you can skip. <a href="#" id="pvOnly">Watch only the intro</a>`;
      el.querySelector(".lede").after(n);
      n.querySelector("#pvOnly").onclick = (e) => { e.preventDefault(); AeroPromo.play().then(() => document.body.classList.remove("tut")); };
    }
  }
  if (typeof ROUTES !== "undefined") ROUTES.tutorial = pageTutorial;

  const css = document.createElement("style");
  css.textContent = `
    .wchoice.tut3{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
    .wchoice a.wcard{text-decoration:none;color:inherit}
    .wchoice .wcard.sch .wic{color:#46e39b}
  `;
  document.head.appendChild(css);

  // Demo page: a Flight school card first
  function demoCard() {
    const hash = location.hash || "";
    if (!/^#\/(demo|welcome)/.test(hash)) return;
    const box = document.querySelector("#view .wchoice");
    if (!box || box.querySelector(".sch")) return;
    const a = document.createElement("a");
    a.className = "wcard sch"; a.href = "#/school/demo";
    a.innerHTML = `<span class="wic">✈</span><span class="wt">Flight school</span><span class="wd">A sample Gulf Coast school: student briefs and verdicts on the instructor dashboard, the school fleet, and the planning lab.</span><span class="wgo">Open the sample school</span>`;
    box.prepend(a);
    box.classList.add("tut3");
  }

  // Start here card: Flight School tabs in Flight School mode
  function welcome() {
    const w = document.getElementById("asWelcome");
    if (!w || !window.AeroMode || AeroMode.get() !== "school") return;
    const tabs = w.querySelector(".aw-tabs");
    if (!tabs || tabs.dataset.p157) return;
    tabs.dataset.p157 = "1";
    tabs.innerHTML = `<span><b>Plan</b> a training flight in plain words</span><span><b>Lab</b> six planning lessons</span><span><b>Brief</b> GO, CAUTION or NO GO and why</span><span><b>Fleet</b> your school's airplanes</span><span><b>Maps</b> route, airspace, plates</span><span><b>Logbook</b> your hours and currency</span>`;
    tabs.querySelectorAll("b").forEach((b) => {
      const to = { Lab: "#/lab", Fleet: "#/fleet" }[b.textContent];
      if (to) { const a = document.createElement("a"); a.href = to; a.style.color = "inherit"; b.replaceWith(a); a.appendChild(b); }
    });
  }

  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { demoCard(); welcome(); } catch (e) { console.error(e); } }, 200); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  if ((location.hash || "").startsWith("#/tutorial")) { try { go(); } catch {} }
})();
