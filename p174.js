"use strict";
/* p174: school safety summary (November 3, 2026).
   On the instructor dashboard (#/school/<id>) and the sample school (#/school/demo), a Safety summary panel
   builds a one page report for a period: flights briefed and shared, the GO, CAUTION and NO GO mix, NO GO
   calls made on the ground, the most common risk reasons, reviews, and planning lab progress. It reads only
   what the dashboard already shows (briefs students chose to share, and lab progress they chose to share);
   nothing new is collected or stored. Print it or save it as a PDF for the owner. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const REASONS = [
    ["Weather and minimums", /VFR|IFR|ceiling|visib|weather|minimum|thunder|convect|icing|fog|marginal/i],
    ["Wind and crosswind", /gust|wind|crosswind/i],
    ["Weight, balance and fuel", /weight|balance|fuel|\bCG\b|center of gravity/i],
    ["Runway and NOTAMs", /runway|NOTAM|closed/i],
    ["Currency and medical", /current|currency|flight review|medical/i],
    ["Airspace and TFRs", /TFR|airspace|restricted/i],
    ["Night and daylight", /night|daylight|sunset|twilight/i],
    ["Risk assessment score", /risk|score/i],
  ];
  const css = document.createElement("style");
  css.textContent = `
    #ssPanel .ss-ctl{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    #ssPanel select{min-height:40px}
    #ssReport{margin-top:12px}
    #ssReport .ss-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:10px 0}
    #ssReport .ss-k{border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:12px;padding:10px 12px}
    #ssReport .ss-k b{display:block;font-size:24px;line-height:1.1}
    #ssReport .ss-k span{font-size:12.5px;color:var(--ink2,#9db2ce)}
    #ssReport .ss-bar{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:6px 0 4px;background:rgba(255,255,255,.06)}
    #ssReport .ss-bar i{display:block;height:100%}
    #ssReport .go{background:#3ddc97}#ssReport .ca{background:#ffb648}#ssReport .ng{background:#ff4d6a}
    #ssReport table{width:100%;border-collapse:collapse}#ssReport td,#ssReport th{text-align:left;padding:6px 4px;border-top:1px solid var(--line2,rgba(255,255,255,.1));font-size:13.5px}
    @media print{
      body.ss-print .topbar,body.ss-print .tabs,body.ss-print #view .page > :not(#ssPanel),body.ss-print #ssPanel .ss-ctl,body.ss-print #ssPanel > h2,body.ss-print #ssPanel > p{display:none!important}
      body.ss-print #ssPanel{border:0!important;background:none!important}
      body.ss-print #ssReport .ss-k{border-color:#999}
    }`;
  document.head.appendChild(css);

  const norm = {
    real: (r) => ({ student: r.student_name || "Student", verdict: r.verdict || "", reasons: r.reasons || [], status: r.status || "submitted", at: new Date(r.created_at || r.dep_at || Date.now()) }),
    sample: (x) => ({ student: x.s, verdict: x.v, reasons: x.why || [], status: /^Approved/.test(x.rv || "") ? "approved" : /^Returned/.test(x.rv || "") ? "returned" : "submitted", at: new Date(x.at || x.dep || Date.now()) }),
  };
  function labStats(entries) {
    // entries: [{ name, scores: [[score, of] | null] }]
    const sharing = entries.length;
    let done = 0, got = 0, of = 0;
    for (const e of entries) for (const s of e.scores) if (s) { done++; got += s[0] || 0; of += s[1] || 3; }
    return { sharing, done, pct: of ? Math.round((got / of) * 100) : null };
  }
  function period(sel) {
    const now = new Date();
    if (sel === "this") return [new Date(now.getFullYear(), now.getMonth(), 1), now, now.toLocaleDateString("en-US", { month: "long", year: "numeric" })];
    if (sel === "last") { const a = new Date(now.getFullYear(), now.getMonth() - 1, 1), b = new Date(now.getFullYear(), now.getMonth(), 1); return [a, b, a.toLocaleDateString("en-US", { month: "long", year: "numeric" })]; }
    if (sel === "all") return [new Date(0), now, "All shared briefs"];
    return [new Date(Date.now() - 30 * 864e5), now, "Last 30 days"];
  }
  function report(name, rows, lab, sel, sample) {
    const [a, b, label] = period(sel);
    const r = rows.filter((x) => x.at >= a && x.at <= b);
    const n = r.length, go = r.filter((x) => x.verdict === "GO").length, ca = r.filter((x) => x.verdict === "CAUTION").length, ng = r.filter((x) => x.verdict === "NO GO").length;
    const students = new Set(r.map((x) => x.student)).size;
    const appr = r.filter((x) => x.status === "approved").length, ret = r.filter((x) => x.status === "returned").length, wait = r.filter((x) => x.status === "submitted").length;
    const flagged = r.filter((x) => x.verdict !== "GO");
    const counts = REASONS.map(([t, re]) => [t, flagged.filter((x) => x.reasons.some((s) => re.test(s))).length]).filter(([, c]) => c > 0).sort((p, q) => q[1] - p[1]);
    const pc = (v) => (n ? (v / n) * 100 : 0);
    const L = labStats(lab);
    return `<div id="ssReport">
      <h2 style="margin:0">${h(name)}: safety summary</h2>
      <p class="small muted" style="margin:2px 0 0">${h(label)} · prepared ${h(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}${sample ? " · SAMPLE DATA" : ""}</p>
      <div class="ss-kpis">
        <div class="ss-k"><b>${n}</b><span>flights briefed and shared</span></div>
        <div class="ss-k"><b>${students}</b><span>students who shared</span></div>
        <div class="ss-k"><b>${ng}</b><span>NO GO calls made on the ground</span></div>
        <div class="ss-k"><b>${appr}</b><span>plans approved by an instructor</span></div>
      </div>
      ${n ? `<p style="margin:10px 0 0"><b>Verdicts</b></p><div class="ss-bar" role="img" aria-label="${go} GO, ${ca} CAUTION, ${ng} NO GO"><i class="go" style="width:${pc(go)}%"></i><i class="ca" style="width:${pc(ca)}%"></i><i class="ng" style="width:${pc(ng)}%"></i></div>
      <p class="small" style="margin:0">GO ${go} · CAUTION ${ca} · NO GO ${ng}</p>` : `<p>No shared briefs in this period.</p>`}
      ${counts.length ? `<p style="margin:14px 0 4px"><b>Most common reasons for CAUTION or NO GO</b></p><table>${counts.map(([t, c]) => `<tr><td>${h(t)}</td><td style="text-align:right">${c}</td></tr>`).join("")}</table>` : ""}
      <p style="margin:14px 0 4px"><b>Instructor review</b></p><p class="small" style="margin:0">Approved ${appr} · returned for changes ${ret} · waiting ${wait}</p>
      <p style="margin:14px 0 4px"><b>Planning lab</b></p><p class="small" style="margin:0">${L.sharing ? `${L.sharing} student${L.sharing === 1 ? "" : "s"} sharing progress · ${L.done} lessons finished${L.pct != null ? ` · ${L.pct}% of check questions right` : ""}` : "No students are sharing lab progress yet."}</p>
      <p class="small muted" style="margin:14px 0 0">Built only from briefs and lesson progress your students chose to share. A training aid summary; it does not replace the school's safety records or the instructor's authorization of each flight.</p>
    </div>`;
  }
  function panel(page, load, sample) {
    if (page.querySelector("#ssPanel")) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "ssPanel";
    sec.innerHTML = `<h2>Safety summary</h2><p class="small" style="margin:0 0 8px">A one page report for the owner or chief instructor: verdicts, NO GO calls, common risk reasons, reviews and lab progress.</p>
      <div class="ss-ctl"><select id="ssSel" aria-label="Period"><option value="30">Last 30 days</option><option value="this">This month</option><option value="last">Last month</option><option value="all">All shared briefs</option></select>
      <button type="button" class="btn sm" id="ssGo">Build the summary</button><button type="button" class="btn sec sm" id="ssPrint" hidden>Print or save as PDF</button></div><div id="ssOut"></div>`;
    page.appendChild(sec);
    let data = null;
    const out = sec.querySelector("#ssOut"), pr = sec.querySelector("#ssPrint");
    sec.querySelector("#ssGo").onclick = async (e) => {
      e.target.disabled = true; out.innerHTML = `<p class="muted">Building…</p>`;
      try { data = data || (await load()); out.innerHTML = report(data.name, data.rows, data.lab, sec.querySelector("#ssSel").value, sample); pr.hidden = false; }
      catch (err) { console.error(err); out.innerHTML = `<p>The summary could not load right now. Try again in a moment.</p>`; }
      finally { e.target.disabled = false; }
    };
    sec.querySelector("#ssSel").onchange = () => { if (data) out.innerHTML = report(data.name, data.rows, data.lab, sec.querySelector("#ssSel").value, sample); };
    pr.onclick = () => { document.body.classList.add("ss-print"); setTimeout(() => { window.print(); document.body.classList.remove("ss-print"); }, 50); };
  }
  async function api(path) {
    const tok = await validToken();
    const r = await fetch(`${SUPA.url}/rest/v1/${path}`, { headers: { ...authHdr(tok), "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(`Request failed (${r.status})`);
    return r.json();
  }
  function scan() {
    const hash = location.hash || "";
    const page = document.querySelector("#view .sc-dash");
    if (!page || !page.querySelector("section.panel")) return;
    if (/^#\/school\/demo/.test(hash) && window.AeroSampleSchool && AeroSampleSchool.SHARES) {
      panel(page, async () => ({ name: AeroSampleSchool.SCHOOL, rows: AeroSampleSchool.SHARES().map(norm.sample), lab: (AeroSampleSchool.LAB || []).map(([name, scores]) => ({ name, scores: scores.map((x) => (x == null ? null : [x, 3])) })) }), true);
      return;
    }
    const m = /^#\/school\/([0-9a-f-]{36})/.exec(hash);
    if (!m) return;
    panel(page, async () => {
      const id = m[1];
      const [sc] = await api(`schools?select=name&id=eq.${id}`);
      const rows = (await api(`school_shares?select=student_name,verdict,reasons,status,created_at,dep_at&school_id=eq.${id}&order=created_at.desc&limit=1000`)) || [];
      let roster = [];
      try { roster = (await api(`school_members?select=display_name,lab&school_id=eq.${id}&role=eq.student`)) || []; } catch (e) {}
      const ids = window.AeroLab ? AeroLab.LESSONS.map((l) => l.id) : [];
      const lab = roster.filter((r) => r.lab && r.lab.lessons).map((r) => ({ name: r.display_name, scores: ids.map((k) => { const l = r.lab.lessons[k]; return l ? [Number(l.score) || 0, Number(l.of) || 3] : null; }) }));
      return { name: (sc && sc.name) || "Your school", rows: rows.map(norm.real), lab };
    }, false);
  }
  let t = 0;
  new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = 0; try { scan(); } catch (e) { console.error(e); } }, 300); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(scan, 400));
  window.AeroSafetySummary = { report, REASONS };
})();
