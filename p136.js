"use strict";
/* p136: Frequently asked questions at #/faq (asked for by the owner on October 22, 2026). A search box
   filters the questions; each answer opens on tap and links to the page it talks about. Reached from
   More (Help and legal), the Plan page welcome card and the public welcome page. Answers describe the
   app as built; the privacy policy and terms remain the governing text. */
(function () {
  const Q = [
    ["Getting started", [
      ["What is AeroSignal?", `A preflight safety brief for pilots. Describe a flight in plain words and AeroSignal builds the route, checks the weather, NOTAMs, TFRs, diversion airports, your currency and your aircraft numbers, and shows what past accidents in flights like yours have in common, with what to do about each one.`],
      ["Is it free?", `Yes. Every feature is free during the preview.`],
      ["Do I need an account?", `No. Everything works without one and stays on this device. An account adds sync across your devices, flight alerts before departure and flight school sharing. <a href="#/account">Account page</a>`],
      ["How do I plan my first flight?", `On the <a href="#/plan">Plan page</a>, write something like "Tomorrow 9:30 am, VFR from KJYO to KCHO in my 172" and tap Read and brief. If anything is missing, such as a departure time, AeroSignal asks before it opens the brief. You can also fill in a form on the <a href="#/flights">Flights page</a>, or <a href="#/demo">try the demo</a> with a sample pilot first.`],
      ["Can I use it on my phone or tablet?", `Yes. It runs in the browser on any phone, tablet or computer. On iPhone, open it in Safari, tap Share, then Add to Home Screen so it opens like an app and can send flight alerts. Versions for the Apple App Store and Google Play are in the works.`],
    ]],
    ["The brief", [
      ["How is GO, CAUTION or NO GO decided?", `From what AeroSignal knows about the flight: the weather against your flight rules and personal minimums, your currency, hazards and TFRs near the route, NOTAMs, weight and fuel, and your risk assessment. Each reason is listed under the verdict. Weather, NOTAMs or hazard advisories that could not be loaded count as CAUTION, never as all clear. The decision is always yours as pilot in command.`],
      ["Where do the accident lessons come from?", `From more than 10,000 light single accident narratives published by the National Transportation Safety Board. AeroSignal matches them to your aircraft type, route, phase of flight and conditions, then turns the patterns into short things to watch for. Military narratives come only from public sources. Charts, airspace and procedures come from the FAA.`],
      ["Does this replace an official weather briefing?", `No. AeroSignal is a planning and safety awareness aid. Get an official briefing from Flight Service (1800wxbrief.com or 1 800 WX BRIEF) and check NOTAMs before every flight.`],
      ["Why does it say weather is not loaded yet?", `Forecasts reach about 30 hours ahead, so weather fills in when the departure is within that window. Open the brief again closer to departure, or turn on flight alerts to get a check about 2 hours before you go.`],
      ["Why does weight and fuel say to set up the aircraft?", `Weight and balance needs your aircraft's numbers from its POH and current weight and balance record. Enter them once under Weight, balance and fuel on the brief and they are saved for every flight in that aircraft.`],
    ]],
    ["Maps and flying", [
      ["Which charts are included?", `FAA VFR sectional and terminal area charts and IFR enroute low and high charts, with airways, airspace, approach plates and accident locations on the <a href="#/maps">map</a>.`],
      ["Does it work without a signal?", `Yes, if you save first. On the brief, tap Save for offline to keep the brief and the charts along your route. On the map, Tools, Save charts for this area keeps a wider region. Saved charts follow the FAA 56 day chart cycle, so update them when a new cycle starts.`],
      ["Can I see my position and get callouts in flight?", `Yes. On the map, Follow my aircraft shows your GPS position, and spoken callouts announce nearby traffic, TFRs ahead and glidepath deviation on approach. Keep your eyes outside and use them only as a backup.`],
      ["Does it show ADS-B traffic?", `Live traffic from a portable ADS-B receiver is coming with the phone and tablet apps. You can see how the traffic display works now from the map, Tools, Traffic simulator.`],
      ["What is the approach debrief?", `After a flight recorded with Follow my aircraft, the brief compares your final approach with the published FAA glidepath and shows whether you were stable at 1,000 and 500 feet. It uses GPS altitude, which can be off by 100 feet or more.`],
    ]],
    ["Logbook and other apps", [
      ["Can I import my logbook?", `Yes. Export a CSV from ForeFlight, MyFlightbook, LogTen or Garmin Pilot, or any spreadsheet with Date, Aircraft, From, To and Total columns, and drop it on the <a href="#/logbook">Logbook page</a>. AeroSignal works out your currency from it.`],
      ["Does it work with ForeFlight or Garmin Pilot?", `Yes, alongside them. Import a route as an .fpl or .gpx file on the <a href="#/flights">Flights page</a>, and export a route back as .fpl or KML. More is under More, Working with ForeFlight.`],
    ]],
    ["Flight schools", [
      ["How does a flight school use AeroSignal?", `An instructor signs in and sets up a school on the <a href="#/account">Account page</a>, then gives students the join code. Students share a brief and approach debrief with one tap, and instructors see their students' recent verdicts and debriefs on one dashboard.`],
      ["What are Flight School mode and Military Planning mode?", `Flight School mode is for student pilots and instructors in training aircraft, and hides military tools. Military Planning mode adds missions, training routes, load computation and military mishap lessons. Switch any time at the top of the <a href="#/plan">Plan page</a> or in More.`],
      ["What is the planning lab?", `Six short lessons on preflight planning, tied to the Private Pilot ACS preflight preparation tasks: weather, performance, weight and balance, fuel, airspace and risk. Each has key points, a practice flight that opens the right part of the brief, and three check questions. <a href="#/lab">Open the planning lab</a>`],
      ["How does a school share its airplanes with students?", `On the <a href="#/fleet">Fleet page</a>, an instructor enters each airplane's weight and balance numbers and picks its checklists once, then sends students the share link or fleet file. Opening it adds those airplanes on the student's device, so every brief uses the real numbers for the tail they fly. A signed in instructor can also save the fleet with the school, and students get it when they join and whenever it changes.`],
      ["How do I invite students to my school?", `On the Account page or your school dashboard, choose Invite students. You get one link and a QR code to print or show. Students who open it are set up in Flight School mode, join your school after signing in, and get the school fleet.`],
      ["Can my instructor see my planning lab progress?", `Only if you turn it on. On the <a href="#/lab">Planning lab</a> page, choose Share lesson progress with your school. Your instructors then see which lessons you finished and your check question scores. Turn it off, or leave the school, and it is removed.`],
      ["Can I print the lessons for ground school?", `Yes. Each lesson in the <a href="#/lab">Planning lab</a> has Print instructor sheet: the key points, aircraft notes, practice task and the check questions with an answer key. The lesson list prints all six.`],
      ["What does a student share?", `Only what the student chooses, flight by flight: the route, departure time, verdict and its reasons, and the approach debrief result. Nothing else from the logbook or brief. Leaving the school removes everything shared with it.`],
    ]],
    ["Your data and account", [
      ["Where is my data kept?", `On this device. If you turn on account sync, your flights, aircraft numbers, checklists and logbook are also kept with your account so they appear on your other devices. AeroSignal never sells your data and shows no advertising. <a href="#/privacy">Privacy policy</a>`],
      ["How do I delete my data or account?", `The <a href="#/data">Your data page</a> lets you export or erase what is on this device and request deletion of your account.`],
      ["I forgot my password.", `On the <a href="#/account">Account page</a>, tap Forgot password and follow the email link.`],
      ["Can I enter military or sensitive information?", `<b style="color:#ff4d6a">Never enter CUI or classified information.</b> Use notional names and points for military planning.`],
      ["How do I report a problem or suggest a feature?", `Use the <a href="#/feedback">Feedback page</a>. Every message is read, and it helps to say what you tapped and what you expected.`],
    ]],
  ];
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    .faq .fq-s{width:100%;box-sizing:border-box;font-size:16px;padding:12px 14px;border-radius:12px;margin:4px 0 6px}
    .faq h2{margin:22px 0 8px}
    .faq details{border:1px solid var(--line2,rgba(255,255,255,.1));border-radius:12px;margin:0 0 8px;background:rgba(255,255,255,.02)}
    .faq summary{cursor:pointer;padding:13px 40px 13px 14px;font-weight:600;font-size:15.5px;line-height:1.35;list-style:none;position:relative}
    .faq summary::-webkit-details-marker{display:none}
    .faq summary::after{content:"+";position:absolute;right:14px;top:10px;font:700 20px var(--mono,monospace);color:var(--cyan,#3DE0FF)}
    .faq details[open] summary::after{content:"\\2212"}
    .faq details > div{padding:0 14px 14px;font-size:15px;line-height:1.55;color:var(--ink,#EAF2FF)}
    .faq details a{color:var(--cyan,#3DE0FF)}
    .faq .fq-none{margin:10px 2px}
    .faq .fq-d{margin-top:22px;font-weight:700;color:#ff4d6a;font-size:14px}
    #asWelcome .fq-l{display:inline-block;margin-top:8px;font-size:14px;color:var(--cyan,#3DE0FF)}
  `;
  document.head.appendChild(css);

  function pageFaq(el) {
    el.innerHTML = `<div class="page faq">
      <h1>Questions and answers</h1>
      <p class="lede">Short answers to what pilots ask most. Can't find yours? Ask on the <a href="#/feedback">Feedback page</a>.</p>
      <input class="fq-s" type="search" placeholder="Search the questions" aria-label="Search the questions" autocomplete="off">
      <div class="fq-list">${Q.map(([g, items]) => `<section data-g><h2>${h(g)}</h2>${items.map(([q, a]) => `<details><summary>${h(q)}</summary><div>${a}</div></details>`).join("")}</section>`).join("")}</div>
      <p class="fq-none muted" hidden>No question matches. Try another word, or ask on the <a href="#/feedback">Feedback page</a>.</p>
      <p class="fq-d">AeroSignal is not for navigation and does not replace official charts, briefings or your aircraft manual. The pilot in command is responsible for every flight. Never enter CUI or classified information.</p>
    </div>`;
    const s = el.querySelector(".fq-s"), none = el.querySelector(".fq-none");
    s.oninput = () => {
      const words = s.value.toLowerCase().split(/\s+/).filter(Boolean);
      let any = 0;
      for (const sec of el.querySelectorAll("section[data-g]")) {
        let n = 0;
        for (const d of sec.querySelectorAll("details")) {
          const t = d.textContent.toLowerCase();
          const hit = words.every((w) => t.includes(w));
          d.hidden = !hit; if (hit) n++;
          d.open = !!words.length && hit && words.some((w) => w.length > 2);
        }
        sec.hidden = !n; any += n;
      }
      none.hidden = !!any;
    };
    // #/faq/<word> opens with that search
    const q = decodeURIComponent((location.hash.split("/")[2] || "").split("?")[0]);
    if (q) { s.value = q.replace(/[-_+]/g, " "); s.oninput(); }
  }
  if (typeof ROUTES !== "undefined") ROUTES.faq = pageFaq;

  // Entry points: More (Help and legal) and the Plan page welcome card
  function links() {
    if (/^#\/more(\/|$|\?)/.test(location.hash || "")) {
      const page = document.querySelector("#view .page");
      if (page && !document.getElementById("fqMore")) {
        const sec = document.createElement("section"); sec.className = "panel"; sec.id = "fqMore";
        sec.innerHTML = `<h2>Questions and answers</h2><p>Short answers to what pilots ask most: the verdict, offline use, logbook import, flight schools and your data.</p><p><a class="btn sec sm" href="#/faq">Open questions and answers</a></p>`;
        const fb = [...page.querySelectorAll("section.panel")].find((x) => /^Feedback/i.test((x.querySelector("h2") || {}).textContent || ""));
        if (fb) fb.before(sec); else page.appendChild(sec);
      }
    }
    const w = document.getElementById("asWelcome");
    if (w) w.classList.toggle("lp-hide", /^#\/faq/.test(location.hash || ""));
    if (w && !w.querySelector(".fq-l")) {
      const a = document.createElement("a"); a.className = "fq-l"; a.href = "#/faq"; a.textContent = "Questions? Read the answers";
      const row = w.querySelector(".aw-btns, .row") || w;
      row.after ? (row === w ? w.appendChild(a) : row.after(a)) : w.appendChild(a);
    }
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { links(); } catch (e) { console.error(e); } }, 250); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroFaq = { Q };
})();
