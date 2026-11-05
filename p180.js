"use strict";
/* p180: student progress on the instructor dashboard (November 4, 2026). One row per student from what the school
   already sees: briefs shared in the last 30 days and their GO, CAUTION and NO GO mix, plans returned for changes,
   planning lab lessons finished and the check question score, and the last time the student shared. Each row opens
   a one page report the instructor can print or save as a PDF for a stage check or a checkride recommendation.
   Works on #/school/<id> (real data) and #/school/demo (sample data). Nothing new is collected. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LN = ["Weather", "Performance", "Weight and balance", "Fuel", "Airspace", "Risk"];
  const css = document.createElement("style");
  css.textContent = `
    #spPanel table{width:100%;border-collapse:collapse}
    #spPanel th,#spPanel td{text-align:left;padding:7px 5px;border-top:1px solid var(--line2,rgba(255,255,255,.1));font-size:13px;vertical-align:top}
    #spPanel td button{min-height:36px}
    #spPanel .go{color:#3ddc97}#spPanel .ca{color:#ffb648}#spPanel .ng{color:#ff4d6a}
    #spReport{margin-top:12px;border-top:1px solid var(--line2,rgba(255,255,255,.12));padding-top:12px}
    #spReport h3{margin:0 0 2px}
    #spReport table{margin-top:6px}
    @media print{
      body.sp-print .topbar,body.sp-print .tabs,body.sp-print #view .page > :not(#spPanel),body.sp-print #spPanel > :not(#spReport),body.sp-print #spReport .sp-noprint{display:none!important}
      body.sp-print #spPanel{border:0!important;background:none!important}
    }`;
  document.head.appendChild(css);

  const days30 = () => Date.now() - 30 * 864e5;
  function summarize(students) {
    // students: [{ name, shares: [{ verdict, status, at: Date, route }], lab: [score|null] x6 with of }]
    return students.map((s) => {
      const recent = s.shares.filter((x) => x.at.getTime() >= days30());
      const c = (v) => recent.filter((x) => x.verdict === v).length;
      const done = s.lab.filter((x) => x != null);
      const got = done.reduce((a, x) => a + x[0], 0), of = done.reduce((a, x) => a + x[1], 0);
      const last = s.shares.reduce((m, x) => (!m || x.at > m ? x.at : m), null);
      return { ...s, n: recent.length, go: c("GO"), ca: c("CAUTION"), ng: c("NO GO"), ret: s.shares.filter((x) => x.status === "returned").length, appr: s.shares.filter((x) => x.status === "approved").length, labDone: done.length, labPct: of ? Math.round((got / of) * 100) : null, last };
    }).sort((a, b) => (b.last || 0) - (a.last || 0) || a.name.localeCompare(b.name));
  }
  const fmt = (d) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "never");
  function table(rows) {
    if (!rows.length) return `<p class="muted" style="margin:0">No students yet. Invite students and their shared briefs and lesson progress show here.</p>`;
    return `<div style="overflow-x:auto"><table><tr><th>Student</th><th>Briefs (30 days)</th><th>Reviews</th><th>Planning lab</th><th>Last shared</th><th></th></tr>
      ${rows.map((r, i) => `<tr><td>${h(r.name)}</td><td>${r.n}${r.n ? `<br><span class="small"><span class="go">${r.go} GO</span> · <span class="ca">${r.ca} CAUTION</span> · <span class="ng">${r.ng} NO GO</span></span>` : ""}</td><td class="small">${r.appr} approved<br>${r.ret} returned</td><td class="small">${r.labDone} of ${LN.length}${r.labPct != null ? `<br>${r.labPct}% right` : ""}</td><td class="small">${h(fmt(r.last))}</td><td><button type="button" class="btn sec sm" data-sp="${i}">Report</button></td></tr>`).join("")}
    </table></div>`;
  }
  function report(school, r, sample) {
    const lab = r.lab.map((x, i) => `<tr><td>${h(LN[i])}</td><td>${x ? `${x[0]} of ${x[1]}` : "Not yet"}</td></tr>`).join("");
    const recent = r.shares.slice().sort((a, b) => b.at - a.at).slice(0, 8);
    const notes = [];
    if (r.labDone < LN.length) notes.push(`${LN.length - r.labDone} planning lab lesson${LN.length - r.labDone === 1 ? "" : "s"} left: ${LN.filter((_, i) => !r.lab[i]).join(", ")}.`);
    if (r.labPct != null && r.labPct < 80) notes.push("Check question score under 80%; review the reasoning together.");
    if (r.ret > r.appr) notes.push("More plans returned than approved; spend time on planning before the next lesson.");
    if (r.ng) notes.push(`Made ${r.ng} NO GO call${r.ng === 1 ? "" : "s"} on the ground in the last 30 days.`);
    if (!r.n) notes.push("No briefs shared in the last 30 days.");
    return `<div id="spReport">
      <h3>${h(r.name)}: student progress</h3>
      <p class="small muted" style="margin:0">${h(school)} · prepared ${h(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}${sample ? " · SAMPLE DATA" : ""}</p>
      <p style="margin:10px 0 0"><b>Planning briefs, last 30 days:</b> ${r.n} shared (GO ${r.go}, CAUTION ${r.ca}, NO GO ${r.ng}); ${r.appr} approved, ${r.ret} returned for changes overall.</p>
      ${recent.length ? `<table><tr><th>Shared</th><th>Route</th><th>Verdict</th><th>Review</th></tr>${recent.map((x) => `<tr><td>${h(fmt(x.at))}</td><td>${h(x.route || "")}</td><td>${h(x.verdict || "")}</td><td>${h(x.status === "approved" ? "Approved" : x.status === "returned" ? "Returned" : "Waiting")}</td></tr>`).join("")}</table>` : ""}
      <p style="margin:12px 0 0"><b>Planning lab:</b> ${r.labDone} of ${LN.length} lessons${r.labPct != null ? `, ${r.labPct}% of check questions right` : ""}</p>
      <table>${lab}</table>
      ${notes.length ? `<p style="margin:12px 0 4px"><b>Notes for the next lesson</b></p><ul style="margin:0 0 0 18px">${notes.map((n) => `<li>${h(n)}</li>`).join("")}</ul>` : ""}
      <p class="small muted" style="margin:12px 0 0">Built from the briefs and lesson progress this student chose to share. A training aid summary; it does not replace the training record or an instructor's endorsement.</p>
      <div class="sp-noprint" style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn sm" id="spPrint">Print or save as PDF</button><button type="button" class="btn sec sm" id="spClose">Close</button></div>
    </div>`;
  }
  function panel(page, load, sample) {
    if (page.querySelector("#spPanel")) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "spPanel";
    sec.innerHTML = `<h2>Student progress</h2><div class="sp-out"><p class="muted" style="margin:0">Loading…</p></div>`;
    const anchor = page.querySelector("#tpPanel") || page.querySelector("#rvPanel");
    if (anchor) anchor.after(sec); else page.appendChild(sec);
    load().then(({ school, students }) => {
      if (!sec.isConnected) return;
      const rows = summarize(students);
      const out = sec.querySelector(".sp-out");
      out.innerHTML = table(rows);
      out.querySelectorAll("[data-sp]").forEach((b) => (b.onclick = () => {
        sec.querySelector("#spReport")?.remove();
        sec.insertAdjacentHTML("beforeend", report(school, rows[+b.dataset.sp], sample));
        const r = sec.querySelector("#spReport");
        r.scrollIntoView({ behavior: "smooth", block: "start" });
        r.querySelector("#spClose").onclick = () => r.remove();
        r.querySelector("#spPrint").onclick = () => { document.body.classList.add("sp-print"); setTimeout(() => { window.print(); document.body.classList.remove("sp-print"); }, 50); };
      }));
    }).catch((e) => { console.error(e); sec.querySelector(".sp-out").innerHTML = `<p>Student progress could not load right now.</p>`; });
  }
  async function api(path) {
    const tok = await validToken();
    const r = await fetch(`${SUPA.url}/rest/v1/${path}`, { headers: { ...authHdr(tok), "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(`Request failed (${r.status})`);
    return r.json();
  }
  const ids = () => (window.AeroLab ? AeroLab.LESSONS.map((l) => l.id) : []);
  function scan() {
    const hash = location.hash || "";
    const page = document.querySelector("#view .sc-dash");
    if (!page || !page.querySelector("section.panel")) return;
    if (/^#\/school\/demo/.test(hash) && window.AeroSampleSchool && AeroSampleSchool.SHARES) {
      panel(page, async () => {
        const sh = AeroSampleSchool.SHARES(), labs = new Map((AeroSampleSchool.LAB || []).map(([n, sc]) => [n, sc]));
        const names = [...new Set([...sh.map((x) => x.s), ...labs.keys()])];
        const st = (rv) => (/^Approved/.test(rv || "") ? "approved" : /^Returned/.test(rv || "") ? "returned" : "submitted");
        return { school: AeroSampleSchool.SCHOOL, students: names.map((n) => ({ name: n, shares: sh.filter((x) => x.s === n).map((x) => ({ verdict: x.v, status: st(x.rv), at: new Date(x.at || x.dep), route: x.route })), lab: (labs.get(n) || [null, null, null, null, null, null]).map((x) => (x == null ? null : [x, 3])) })) };
      }, true);
      return;
    }
    const m = /^#\/school\/([0-9a-f-]{36})/.exec(hash);
    if (!m || typeof AUTH === "undefined" || !AUTH) return;
    panel(page, async () => {
      const id = m[1];
      const [sc] = (await api(`schools?select=name&id=eq.${id}`)) || [];
      const roster = (await api(`school_members?select=user_id,display_name,lab&school_id=eq.${id}&role=eq.student&order=display_name.asc`)) || [];
      const shares = (await api(`school_shares?select=user_id,student_name,route,verdict,status,created_at&school_id=eq.${id}&order=created_at.desc&limit=1000`)) || [];
      const L = ids();
      const students = roster.map((r) => ({
        name: r.display_name || "Student",
        shares: shares.filter((x) => x.user_id === r.user_id).map((x) => ({ verdict: x.verdict, status: x.status || "submitted", at: new Date(x.created_at), route: x.route })),
        lab: L.map((k) => { const l = r.lab && r.lab.lessons && r.lab.lessons[k]; return l ? [Number(l.score) || 0, Number(l.of) || 3] : null; }),
      }));
      return { school: (sc && sc.name) || "Your school", students };
    }, false);
  }
  let t = 0;
  new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = 0; try { scan(); } catch (e) { console.error(e); } }, 340); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(scan, 460));
  window.AeroStudentProgress = { summarize };
})();
