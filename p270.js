"use strict";
/* p270: FAA sources (November 26, 2026). Mario asked that the safety guidance rest on the FAA's own regulations,
   handbooks, advisory circulars and human factors research, and that a pilot can see where each piece comes from.
   This module holds one list of the public documents the app draws on (every edition and status was checked on
   faa.gov, ecfr.gov and the DOT repository on November 26, 2026), and uses it to:
     1. add a "Sources" line under each accident lesson in the brief, and under the risk assessment and personal
        minimums tools;
     2. turn every "14 CFR 91.155" style reference on screen into a link to the current regulation on eCFR;
     3. add a Sources page (#/sources) listing each document, its edition, what the app uses it for, and a link,
        reached from the brief, the More page and the Human factors section (p271).
   Only public, unclassified documents are listed. Nothing here changes how any section works. */
(function () {
  const AC = (id) => `https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/document.information/documentID/${id}`;
  const AIMS = (c, s) => `https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap${c}_section_${s}.html`;
  const CHECKED = "November 26, 2026";
  // id: [short name, full title, number and edition, link, what the app uses it for, group]
  const DOCS = {
    cfr: ["14 CFR", "Title 14, Code of Federal Regulations (Aeronautics and Space)", "Current eCFR text", "https://www.ecfr.gov/current/title-14", "Fuel reserves, VFR weather minimums, alternates, oxygen, inspections, currency and preflight action. Every regulation reference on screen links to the current text.", "Regulations"],
    aim: ["AIM", "Aeronautical Information Manual", "Basic with Changes 1 to 3, effective July 9, 2026", "https://www.faa.gov/air_traffic/publications/atpubs/aim_html/", "Airport operations (4‑3), meteorology (7‑1), bird hazards (7‑5), potential flight hazards and mountain flying (7‑6), and medical facts for pilots (8‑1).", "Regulations"],
    phak: ["PHAK", "Pilot's Handbook of Aeronautical Knowledge", "FAA‑H‑8083‑25C", "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak", "Aeronautical decision making, hazardous attitudes and antidotes, single pilot resource management, IMSAFE, PAVE, the 5Ps, 3P and DECIDE (Chapter 2); aircraft systems, performance, airport operations and aeromedical factors.", "Handbooks"],
    afh: ["AFH", "Airplane Flying Handbook", "FAA‑H‑8083‑3C", "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook", "Positive exchange of controls, takeoffs, traffic patterns, approaches and landings, stabilized approaches, night operations, multiengine and turbine transition, and emergency procedures.", "Handbooks"],
    rmh: ["RMH", "Risk Management Handbook", "FAA‑H‑8083‑2A", "https://www.faa.gov/sites/faa.gov/files/2022-06/risk_management_handbook_2A.pdf", "Personal minimums (Chapter 2), identifying hazards (3), assessing risk (4), mitigating risk (5), threat and error management (6), and decision making in flight (8).", "Handbooks"],
    awh: ["AWH", "Aviation Weather Handbook", "FAA‑H‑8083‑28B", "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation", "Icing, turbulence and weather hazard background. It replaced Advisory Circulars 00‑6 and 00‑45.", "Handbooks"],
    hfh: ["HFH", "Helicopter Flying Handbook", "FAA‑H‑8083‑21B", "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/helicopter_flying_handbook", "Helicopter emergencies and hazards, including loss of tail rotor effectiveness (Chapter 11), night operations (12) and decision making (13).", "Handbooks"],
    ac6022: ["AC 60‑22", "Aeronautical Decision Making", "Advisory Circular 60‑22, active", AC(22624), "The FAA's decision making model and the hazardous attitudes it describes.", "Advisory Circulars"],
    ac12051: ["AC 120‑51E", "Crew Resource Management Training", "Advisory Circular 120‑51E, active", AC(22879), "Crew coordination prompts for two pilot and instructional flights.", "Advisory Circulars"],
    ac9174: ["AC 91‑74B", "Pilot Guide: Flight in Icing Conditions", "Advisory Circular 91‑74B, active", AC(1028388), "Icing lessons in the brief.", "Advisory Circulars"],
    ac9048: ["AC 90‑48E", "Pilots' Role in Collision Avoidance", "Advisory Circular 90‑48E, active", AC(1041368), "See and avoid and traffic awareness prompts.", "Advisory Circulars"],
    ac61134: ["AC 61‑134", "General Aviation Controlled Flight into Terrain Awareness", "Advisory Circular 61‑134, active", AC(22907), "Terrain lessons in the brief.", "Advisory Circulars"],
    ac9095: ["AC 90‑95", "Unanticipated Right Yaw in Helicopters", "Advisory Circular 90‑95, active", AC(23136), "Loss of tail rotor effectiveness lessons for helicopter pilots.", "Advisory Circulars"],
    ac12088: ["AC 120‑88A", "Preventing Injuries Caused by Turbulence", "Advisory Circular 120‑88A, active", AC(99831), "Turbulence lessons in the brief.", "Advisory Circulars"],
    ac12074: ["AC 120‑74B", "Parts 91, 121, 125, and 135 Flightcrew Procedures During Taxi Operations", "Advisory Circular 120‑74B, active", AC(1020233), "Ground and taxi lessons for crewed aircraft.", "Advisory Circulars"],
    ac9173: ["AC 91‑73B", "Parts 91 and 135 Single Pilot, Flight School Procedures During Taxi Operations", "Advisory Circular 91‑73B, active", AC(1020226), "Ground and taxi lessons for single pilots and flight schools.", "Advisory Circulars"],
    ac61107: ["AC 61‑107B", "Aircraft Operations at Altitudes Above 25,000 Feet MSL and/or Mach Numbers (Mmo) Greater Than .75", "Advisory Circular 61‑107B with Change 1, active", AC(1020859), "High altitude physiology and oxygen prompts for jet and turboprop flights.", "Advisory Circulars"],
    hfacs: ["HFACS", "The Human Factors Analysis and Classification System (HFACS)", "DOT/FAA/AM‑00/7, Shappell and Wiegmann, February 2000", "https://rosap.ntl.bts.gov/view/dot/15397", "The categories used to label accident narratives: skill based, decision and perceptual errors, violations, and the preconditions for unsafe acts.", "Human factors research"],
    ntsb: ["NTSB", "NTSB aviation accident reports and narratives", "Public NTSB data, updated weekly in the app", "https://data.ntsb.gov/carol-main-public/basic-search", "Every accident report, narrative and probable cause shown in the app.", "Accident data"],
  };
  // Accident lessons (THEMES keys) to [doc id, where in it]
  const THEME_CITES = {
    base: [["phak", "Ch. 2, Aeronautical Decision‑Making"], ["rmh", "Ch. 3, Identifying Hazards"]],
    airport: [["phak", "Ch. 14, Airport Operations"], ["aim", "4‑3, Airport Operations", AIMS(4, 3)]],
    approach: [["afh", "Ch. 9, Approaches and Landings"], ["afh", "Ch. 8, Airport Traffic Patterns"]],
    carb: [["phak", "Ch. 7, Aircraft Systems"]],
    da: [["phak", "Ch. 11, Aircraft Performance"], ["afh", "Ch. 6, Takeoffs and Departure Climbs"]],
    fuel: [["cfr", "91.151 and 91.167, fuel requirements", "https://www.ecfr.gov/current/title-14/section-91.151"], ["cfr", "91.103, preflight action", "https://www.ecfr.gov/current/title-14/section-91.103"]],
    icing: [["ac9174", ""], ["awh", ""], ["aim", "7‑1, Meteorology", AIMS(7, 1)]],
    instruct: [["afh", "Ch. 1, positive exchange of flight controls"], ["ac12051", ""]],
    layoff: [["cfr", "61.57, recent flight experience", "https://www.ecfr.gov/current/title-14/section-61.57"], ["rmh", "Ch. 2, Personal Minimums"]],
    lowtype: [["rmh", "Ch. 2, Personal Minimums"], ["phak", "Ch. 2, Aeronautical Decision‑Making"]],
    night: [["afh", "Ch. 11, Night Operations"], ["phak", "Ch. 17, Aeromedical Factors"], ["aim", "8‑1, Medical Facts for Pilots", AIMS(8, 1)]],
    terrain: [["ac61134", ""], ["aim", "7‑6‑7, Mountain Flying", AIMS(7, 6)]],
    vfrimc: [["phak", "Ch. 17, spatial disorientation"], ["aim", "8‑1‑5, Illusions in Flight", AIMS(8, 1)], ["cfr", "91.155, VFR weather minimums", "https://www.ecfr.gov/current/title-14/section-91.155"]],
    wind: [["afh", "Ch. 9, crosswind approach and landing"], ["afh", "Ch. 6, crosswind takeoff"]],
    turb: [["ac12088", ""], ["aim", "7‑1, Meteorology", AIMS(7, 1)]],
    ground: [["ac12074", ""], ["ac9173", ""], ["aim", "4‑3, Airport Operations", AIMS(4, 3)]],
    unstab: [["afh", "Ch. 9, stabilized approach"], ["afh", "Ch. 16, Transition to Jet‑Powered Airplanes"]],
    engfail: [["afh", "Ch. 18, Emergency Procedures"], ["afh", "Ch. 13, Transition to Multiengine Airplanes"]],
    bird: [["aim", "7‑5, Bird Hazards", AIMS(7, 5)]],
    wire: [["aim", "7‑6‑4, Obstructions to Flight", AIMS(7, 6)], ["hfh", "Ch. 11, Emergencies and Hazards"]],
    lte: [["ac9095", ""], ["hfh", "Ch. 11, Emergencies and Hazards"]],
    vmc: [["afh", "Ch. 13, Transition to Multiengine Airplanes"]],
  };
  const TOOL_CITES = {
    frat: [["rmh", "Ch. 4, Assessing Risk"], ["rmh", "Ch. 5, Mitigating Risk"], ["phak", "Ch. 2, IMSAFE and PAVE"]],
    mins: [["rmh", "Ch. 2, Personal Minimums"], ["phak", "Ch. 2, PAVE"], ["cfr", "61.57, recent flight experience", "https://www.ecfr.gov/current/title-14/section-61.57"]],
  };
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function cite(list) {
    const parts = (list || []).map(([id, where, url]) => {
      const d = DOCS[id]; if (!d) return "";
      const label = d[0] + (where ? `, ${where}` : "");
      return `<a href="${h(url || d[3])}" target="_blank" rel="noopener" title="${h(d[1] + ", " + d[2])}">${h(label)}</a>`;
    }).filter(Boolean);
    if (!parts.length) return "";
    return `<p class="src-ln">Sources: ${parts.join("; ")}. <a href="#/sources">All sources</a></p>`;
  }

  const st = document.createElement("style");
  st.textContent = `
    .src-ln{font-size:12.5px;line-height:1.45;color:var(--ink2,#9db2ce);margin:6px 0 0}
    .src-ln a{color:inherit;text-decoration:underline;text-underline-offset:2px}
    .src-ln a:hover{color:var(--cyan,#3DE0FF)}
    a.cfr-ln{color:inherit;text-decoration:underline dotted;text-underline-offset:2px}
    .srcpg .src-doc{border-top:1px solid var(--line,rgba(255,255,255,.1));padding:12px 0}
    .srcpg .src-doc:first-of-type{border-top:0}
    .srcpg .src-doc b{display:block;font-size:15px}
    .srcpg .src-doc .ed{font-size:13px;color:var(--ink2,#9db2ce);margin-top:2px}
    .srcpg .src-doc p{margin:6px 0 0;font-size:14px}
    .page.qk #bbody .src-ln{display:none}`;
  document.head.appendChild(st);

  // 1. Brief accident lessons: match each item's watch text to its theme
  function themeByWatch() {
    const m = new Map();
    try { for (const t of THEMES) if (t && t.k && typeof t.watch === "string") m.set(t.watch.trim(), t.k); } catch (e) {}
    return m;
  }
  function citeBrief(pg) {
    const items = pg.querySelectorAll("#bbody .item");
    if (!items.length) return;
    const map = themeByWatch();
    for (const it of items) {
      if (it.querySelector(":scope > .src-ln")) continue;
      const w = it.querySelector(":scope > .watch, :scope p.watch");
      if (!w) continue;
      const k = map.get(w.textContent.trim()) || it.dataset.theme;
      const html = k && cite(THEME_CITES[k]);
      if (html) w.insertAdjacentHTML("afterend", html);
    }
    const bh = pg.querySelector(":scope > .bhead");
    if (bh && !pg.querySelector("#srcBhead")) bh.insertAdjacentHTML("afterend", `<p class="src-ln" id="srcBhead">Each lesson lists the FAA documents behind it. Accident data from the NTSB. <a href="#/sources">See every source</a></p>`);
  }
  // Tools: the risk assessment page, the personal minimums panel on the brief and the minimums page
  function citeTools() {
    const v = document.getElementById("view"); if (!v) return;
    const hash = location.hash || "";
    if (/^#\/frat/.test(hash)) { const pg = v.querySelector(".page"); if (pg && !pg.querySelector(":scope > .src-ln")) pg.insertAdjacentHTML("beforeend", cite(TOOL_CITES.frat)); }
    if (/^#\/minimums/.test(hash)) { const p = v.querySelector(".page .panel"); if (p && !p.querySelector(".src-ln")) p.insertAdjacentHTML("beforeend", cite(TOOL_CITES.mins)); }
    const pm = v.querySelector("#pmPanel"); if (pm && !pm.querySelector(".src-ln")) pm.insertAdjacentHTML("beforeend", cite(TOOL_CITES.mins));
  }
  // 2. "14 CFR 91.155" anywhere in the main view becomes a link to the current regulation
  const CFR = /\b14 CFR (?:§\s*|Part )?(\d{1,3})\.(\d{1,4})\b/g;
  function linkCFR(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.indexOf("14 CFR") >= 0 && !(n.parentElement && n.parentElement.closest("a,button,textarea,input,select,script,style,[contenteditable]")) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const todo = []; let n; while ((n = w.nextNode())) todo.push(n);
    for (const t of todo.slice(0, 200)) {
      const s = t.nodeValue; CFR.lastIndex = 0; if (!CFR.test(s)) continue; CFR.lastIndex = 0;
      const f = document.createDocumentFragment(); let last = 0, m;
      while ((m = CFR.exec(s))) {
        if (m.index > last) f.appendChild(document.createTextNode(s.slice(last, m.index)));
        const a = document.createElement("a"); a.className = "cfr-ln"; a.target = "_blank"; a.rel = "noopener";
        a.href = `https://www.ecfr.gov/current/title-14/section-${m[1]}.${m[2]}`; a.textContent = m[0]; a.title = "Current regulation on eCFR";
        f.appendChild(a); last = m.index + m[0].length;
      }
      if (last < s.length) f.appendChild(document.createTextNode(s.slice(last)));
      t.parentNode.replaceChild(f, t);
    }
  }

  // 3. Sources page
  ROUTES.sources = function (el) {
    const groups = {};
    for (const [id, d] of Object.entries(DOCS)) (groups[d[5]] = groups[d[5]] || []).push([id, d]);
    el.innerHTML = `<div class="page srcpg">
      <h1>Sources</h1>
      <p class="lede">The safety guidance in Vigilyn comes from public FAA regulations, handbooks and advisory circulars, FAA human factors research, and NTSB accident reports. Each lesson in the brief lists the documents behind it.</p>
      <p style="color:#ff4d6a;font-weight:700">Planning aid only. Not for navigation. Pilots must verify everything against official sources.</p>
      ${Object.entries(groups).map(([g, list]) => `<section class="panel"><h2>${h(g)}</h2>${list.map(([id, d]) => `<div class="src-doc" id="src-${h(id)}"><b><a href="${h(d[3])}" target="_blank" rel="noopener">${h(d[1])}</a></b><div class="ed">${h(d[2])}</div><p>${h(d[4])}</p></div>`).join("")}</section>`).join("")}
      <section class="panel"><h2>How these are kept current</h2>
        <p style="margin-top:0">Each edition and status above was checked on faa.gov, ecfr.gov and the Department of Transportation repository on ${CHECKED}. Regulation links always open the current text on eCFR. When the FAA revises a handbook or cancels an advisory circular, the lesson that cites it is reviewed.</p>
        <p>Human factors labels on accident reports are assigned automatically from the wording of each NTSB narrative, using the HFACS categories. They are not NTSB findings. Open the full NTSB report for the official probable cause.</p>
      </section>
    </div>`;
  };
  // A Sources panel on the More page
  const more = ROUTES.more;
  if (typeof more === "function") ROUTES.more = function (el, a) {
    more(el, a);
    const pg = el.querySelector(".page") || el;
    if (pg.querySelector("#srcMore")) return;
    const s = document.createElement("section"); s.className = "panel"; s.id = "srcMore";
    s.innerHTML = `<h2>Sources</h2><p style="margin-top:0">The FAA regulations, handbooks, advisory circulars and human factors research behind the safety guidance, with editions and links.</p><a class="btn sec" href="#/sources">See sources</a>`;
    pg.appendChild(s);
  };

  let t = 0;
  function run() {
    const v = document.getElementById("view"); if (!v) return;
    const pg = v.querySelector(".page");
    if (pg && /^#\/brief/.test(location.hash || "")) citeBrief(pg);
    citeTools();
    linkCFR(v);
  }
  new MutationObserver((l) => {
    if (l.every((m) => m.target.closest && m.target.closest(".src-ln,a.cfr-ln"))) return;
    clearTimeout(t); t = setTimeout(run, 300);
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(run, 400));
  if ((location.hash || "").startsWith("#/sources")) try { go(); } catch (e) {}
  window.AeroSources = { DOCS, THEME_CITES, TOOL_CITES, cite, CHECKED };
})();
