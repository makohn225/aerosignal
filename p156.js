"use strict";
/* p156: sample flight school (October 28, 2026). #/school/demo shows what an instructor sees, with a
   made up school on the Gulf Coast: a roster of sample students, their shared briefs (route, verdict
   and reasons, approach debrief), and a sample fleet of three Cessna 172s. Everything is labeled as a
   sample and no account is needed. Two buttons let a visitor try it hands on: add the sample fleet to
   this device (Cessna 172S example numbers, flagged as examples) and plan a sample student flight from
   Pensacola to Gulf Shores. The school, students and tails are fictional. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SCHOOL = "Gulf Coast Flight Academy (sample)";
  const day = (n, hh) => { const d = new Date(Date.now() + n * 864e5); d.setHours(hh, 0, 0, 0); return d; };
  const fmt = (d) => d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const SHARES = () => [
    { s: "Alex (sample student)", route: "KPNS KJKA", dep: day(1, 9), v: "GO", why: ["Nothing in this brief exceeds a limit or your minimums"], deb: null, at: day(0, 8) },
    { s: "Jordan (sample student)", route: "KJKA KCEW KJKA", dep: day(1, 14), v: "CAUTION", why: ["Gusts forecast at KCEW near your crosswind limit", "Weight and fuel: rear seat and full fuel leave 12 lb under max"], deb: null, at: day(0, 7) },
    { s: "Sam (sample student)", route: "KPNS KBFM", dep: day(2, 8), v: "NO GO", why: ["Marginal VFR forecast at arrival, below your personal minimums"], deb: null, at: day(-1, 19) },
    { s: "Taylor (sample student)", route: "KPNS KPNS", dep: day(-1, 10), v: "GO", why: ["Pattern work, local area"], deb: "Approach at KPNS: stable by 500 ft, 120 ft high at 1,000 ft", at: day(-1, 13) },
  ];
  const LAB = [["Alex (sample student)", [3, 3, 2, 3, null, null]], ["Jordan (sample student)", [2, 3, null, null, null, null]], ["Taylor (sample student)", [3, 3, 3, 3, 3, 2]]];
  const FLEET = { DEMO1: "Cessna 172 (sample)", DEMO2: "Cessna 172 (sample)", DEMO3: "Cessna 172 (sample)" };
  const vcls = (v) => (v === "GO" ? "go" : v === "CAUTION" ? "caution" : "nogo");
  function sampleFleet() {
    const wb = window.AeroWB ? { ...AeroWB.C172S } : null;
    const tails = {};
    for (const [t, m] of Object.entries(FLEET)) tails[t] = { typeCode: "C172", model: m, tas: 110, wb };
    return { v: 1, kind: "aerosignal-fleet", school: SCHOOL, tails, checklists: [] };
  }
  function render(el) {
    const sh = SHARES();
    el.innerHTML = `<div class="page sc-dash"><p class="small"><b style="color:#ffb648">SAMPLE.</b> A made up school so you can see what instructors and students get. No account needed.</p>
      <h1>${h(SCHOOL)}</h1>
      <p class="lede">Students plan each lesson in AeroSignal and share the brief with the school. Instructors see every verdict and its reasons before the student arrives, so the preflight review starts from what matters.</p>
      <section class="panel"><h2>Shared briefs</h2><div class="tbl"><table><tr><th>Student</th><th>Flight</th><th>Verdict</th><th>Why</th><th>Approach debrief</th><th>Shared</th></tr>
        ${sh.map((x) => `<tr><td>${h(x.s)}</td><td>${h(x.route)}<br><span class="small muted">${h(fmt(x.dep))}</span></td><td class="v ${vcls(x.v)}">${h(x.v)}</td><td class="small">${x.why.map(h).join("<br>")}</td><td class="small">${h(x.deb || "")}</td><td class="small muted">${h(fmt(x.at))}</td></tr>`).join("")}
      </table></div></section>
      <section class="panel"><h2>Planning lab progress</h2><div class="tbl"><table><tr><th>Student</th><th>Lessons</th><th>Scores</th></tr>
        ${LAB.map(([s, sc]) => `<tr><td>${h(s)}</td><td>${sc.filter((x) => x != null).length} of 6</td><td class="small">${sc.map((x, i) => `${["Weather", "Perf", "W&B", "Fuel", "Airspace", "Risk"][i]} ${x == null ? "not yet" : x + "/3"}`).join(" · ")}</td></tr>`).join("")}
      </table></div><p class="small muted" style="margin:6px 0 0">Students choose whether to share their lesson progress.</p></section>
      <section class="panel"><h2>Roster</h2><div class="tbl"><table><tr><th>Name</th><th>Role</th><th>Last shared</th></tr>
        <tr><td>Chief instructor (sample)</td><td>Instructor</td><td></td></tr>
        ${sh.map((x) => `<tr><td>${h(x.s)}</td><td>Student</td><td class="small">${h(x.route)} <span class="v ${vcls(x.v)}">${h(x.v)}</span></td></tr>`).join("")}
      </table></div></section>
      <section class="panel"><h2>Fleet</h2><p class="small" style="margin:0 0 8px">Each airplane's weight and balance and checklists are set up once on the Fleet page and shared with students by link.</p>
        <ul>${Object.entries(FLEET).map(([t, m]) => `<li><b>${h(t)}</b> ${h(m)}</li>`).join("")}</ul></section>
      <section class="panel"><h2>Try it yourself</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" class="btn" id="sdFleet">Add the sample fleet to this device</button><button type="button" class="btn sec" id="sdFly">Plan a sample student flight</button><a class="btn sec" href="#/lab">Open the planning lab</a></div>
        <p class="small muted">The sample fleet uses the Cessna 172S example numbers, flagged as examples. Real schools enter each airplane's own numbers. Set up a real school from the Account page.</p></section>
      <p class="sc-d" style="font-size:12.5px;font-weight:700;color:#ff4d6a">A training aid only. Verdicts come from each student's own brief and do not replace the instructor's judgment or authorization of a flight.</p></div>`;
    el.querySelector("#sdFleet").onclick = () => { try { const r = AeroFleet.importData(sampleFleet(), { sample: true }); toast(`Added ${r.n} sample airplanes. See them on the Fleet page.`); } catch (e) { toast(e.message); } };
    el.querySelector("#sdFly").onclick = async () => {
      try { if (!(S.profiles || {}).DEMO1) AeroFleet.importData(sampleFleet(), { sample: true }); } catch {}
      const f = newFlight(); const d = day(1, 9); const pad = (n) => String(n).padStart(2, "0");
      f.route = "KPNS KJKA"; f.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; f.time = "09:00"; f.rules = "VFR"; f.tail = "DEMO1"; f.planText = "Sample student flight: Pensacola to Gulf Shores in a 172";
      try { const r = await resolveRoute(f.route); f.points = r.points || []; f.unresolved = r.unresolved || []; } catch { toast("Could not look up the route. Check your connection."); return; }
      f.updated = Date.now(); S.currentId = f.id; save(); location.hash = "#/brief";
    };
  }
  if (typeof ROUTES !== "undefined" && typeof ROUTES.school === "function") {
    const base = ROUTES.school;
    ROUTES.school = function (el, arg) { if (String(arg || "").split("?")[0] === "demo") return render(el); return base.apply(this, arguments); };
  }
  window.AeroSampleSchool = { sampleFleet, SCHOOL };
})();
