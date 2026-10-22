"use strict";
/* p134: Pro plan switch and flight school dashboard (tables approved by the owner on October 22, 2026,
   migration supabase/migrations/20261022_schools_and_pro.sql).

   Pro: reads the signed in user's row in entitlements (own row only, written only by the server).
   ENFORCE is false, so every feature stays free during the preview; the Account page shows the plan.
   window.AeroPro.has(feature) is the single check later modules use once Pro is sold.
   In the iOS app, Pro has to be sold through Apple In-App Purchase.

   Schools: an instructor creates a school and gets a join code; a student joins with the code and can
   share a flight's brief summary (route, departure time, verdict and its reasons, and the approach
   debrief result) with the school, flight by flight. Instructors see the roster and shared briefs at
   #/school/<id>. Leaving a school removes the student's shared rows (database trigger).
   The school UI stays hidden until the privacy page sentence for school sharing is approved:
   set SCHOOLS_LIVE to true and add that sentence in the same change. For testing, set
   window.AERO_SCHOOL_PREVIEW = true before the app loads. */
(function () {
  const ENFORCE = false;
  const SCHOOLS_LIVE = true; // privacy sentence approved October 22, 2026 (p133)
  const schoolsOn = () => SCHOOLS_LIVE || window.AERO_SCHOOL_PREVIEW === true;
  const REST = (p) => `${SUPA.url}/rest/v1/${p}`;
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => { try { return typeof AUTH !== "undefined" && AUTH && AUTH.user && AUTH.user.id ? AUTH.user.id : null; } catch { return null; } };
  async function api(path, opt = {}) {
    const tok = await validToken();
    const r = await fetch(REST(path), { ...opt, headers: { ...authHdr(tok), ...(opt.headers || {}) } });
    const txt = await r.text();
    let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || `Request failed (${r.status})`);
    return j;
  }
  const css = document.createElement("style");
  css.textContent = `
    #proPanel .pr-plan{font:700 15px/1.4 var(--disp,system-ui);margin:4px 0}
    #proPanel .pr-plan b{color:#46e39b}
    #scPanel .sc-list{list-style:none;margin:8px 0;padding:0}
    #scPanel .sc-list li{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.1));font-size:14px}
    #scPanel .sc-list li .nm{flex:1 1 160px;font-weight:600}
    #scPanel .sc-code{font:700 14px/1 ui-monospace,Menlo,monospace;letter-spacing:2px;color:var(--cyan,#3DE0FF)}
    #scPanel .sc-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
    #scPanel .sc-row input{flex:1 1 160px;min-width:0}
    #scShare{margin-top:14px}
    #scShare .sc-st{font-size:13.5px;color:var(--ink2,#9db2ce);margin:6px 0 0}
    .sc-dash table{width:100%;border-collapse:collapse;font-size:14px}
    .sc-dash th,.sc-dash td{text-align:left;vertical-align:top;padding:8px;border-top:1px solid var(--line2,rgba(255,255,255,.1))}
    .sc-dash th{font-size:12px;color:var(--ink2,#9fb0c8);font-weight:600}
    .sc-dash .v{font-weight:800;letter-spacing:1px}
    .sc-dash .v.go{color:#46e39b}.sc-dash .v.caution{color:#ffb547}.sc-dash .v.nogo{color:#ff4d6a}
    .sc-dash .tbl{overflow-x:auto}
    .sc-d{font-size:12.5px;font-weight:700;color:#ff4d6a;margin-top:10px}
  `;
  document.head.appendChild(css);

  /* ---------- Pro ---------- */
  const ent = () => S.plan || null;
  async function refreshPlan() {
    const u = uid();
    if (!u) { if (S.plan) { delete S.plan; try { save(); } catch {} } return null; }
    try {
      const rows = await api(`entitlements?select=plan,source,expires_at&user_id=eq.${u}`);
      const r = rows && rows[0];
      S.plan = r ? { plan: r.plan, source: r.source, expires_at: r.expires_at, at: Date.now() } : { plan: "free", at: Date.now() };
      try { save(); } catch {}
    } catch (e) { console.warn("plan", e); }
    return S.plan;
  }
  function plan() {
    const e = ent();
    if (!e || !e.plan) return "free";
    if (e.expires_at && new Date(e.expires_at) < new Date()) return "free";
    return e.plan;
  }
  const has = () => (ENFORCE ? plan() !== "free" : true);
  function paintPro() {
    const sec = document.getElementById("proPanel");
    if (!sec) return;
    const p = plan(), e = ent();
    const name = { free: "Free", pro: "Pro", school: "School" }[p] || "Free";
    const until = p !== "free" && e && e.expires_at ? ` through ${new Date(e.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : "";
    sec.innerHTML = `<h2>Your plan</h2>
      <p class="pr-plan">Plan: <b>${name}</b>${h(until)}</p>
      <p class="small muted" style="margin:0">${uid() ? "" : "Sign in to see your plan. "}Every feature is free during the preview.</p>`;
  }

  /* ---------- Schools ---------- */
  let mine = null, scStatus = "";
  async function loadMine() {
    const u = uid();
    if (!u) { mine = []; return mine; }
    mine = await api(`school_members?select=school_id,role,display_name,schools(name,owner,join_code)&user_id=eq.${u}&order=joined_at.asc`);
    return mine;
  }
  function paintSchools() {
    const sec = document.getElementById("scPanel");
    if (!sec) return;
    const u = uid();
    if (!u) { sec.innerHTML = `<h2>Flight school</h2><p class="small muted">Sign in to join your flight school or set one up for your students.</p>`; return; }
    const list = (mine || []).map((m) => {
      const s = m.schools || {}, own = s.owner === u, inst = m.role === "instructor";
      return `<li><span class="nm">${h(s.name || "School")}</span><span class="small muted">${inst ? "Instructor" : "Student"}</span>
        ${inst && s.join_code ? `<span class="small">Join code <span class="sc-code">${h(s.join_code)}</span></span>` : ""}
        ${inst ? `<a class="btn sec sm" href="#/school/${h(m.school_id)}">Open dashboard</a>` : ""}
        ${own ? `<button type="button" class="btn sec sm" data-sc="del" data-id="${h(m.school_id)}">Delete school</button>` : `<button type="button" class="btn sec sm" data-sc="leave" data-id="${h(m.school_id)}">Leave</button>`}</li>`;
    }).join("");
    sec.innerHTML = `<h2>Flight school</h2>
      <p class="small" style="margin:0">Students can share a flight's brief summary with their school: the route, departure time, verdict and its reasons, and the approach debrief result. Nothing is shared until you choose Share on a brief, and leaving a school removes what you shared.</p>
      ${mine === null ? `<p class="small muted">Loading...</p>` : list ? `<ul class="sc-list">${list}</ul>` : `<p class="small muted">You are not in a school yet.</p>`}
      <div class="sc-row"><input id="scCode" placeholder="Join code" autocapitalize="characters" maxlength="12"><input id="scName" placeholder="Your name" maxlength="80"><button type="button" class="btn sm" data-sc="join">Join</button></div>
      <div class="sc-row"><input id="scNew" placeholder="New school name" maxlength="80"><button type="button" class="btn sec sm" data-sc="create">Set up a school</button></div>
      ${scStatus ? `<p class="small" style="color:#ffb648">${h(scStatus)}</p>` : ""}`;
    sec.querySelectorAll("[data-sc]").forEach((b) => (b.onclick = () => act(b.dataset.sc, b.dataset.id)));
  }
  async function act(k, id) {
    scStatus = "";
    try {
      if (k === "join") {
        const code = (document.getElementById("scCode").value || "").trim(), nm = (document.getElementById("scName").value || "").trim();
        if (!code) { scStatus = "Enter the join code from your instructor."; return paintSchools(); }
        await api("rpc/join_school", { method: "POST", body: JSON.stringify({ code, p_name: nm || null }) });
        toast("You joined the school");
      } else if (k === "create") {
        const name = (document.getElementById("scNew").value || "").trim();
        if (name.length < 2) { scStatus = "Enter a school name."; return paintSchools(); }
        await api("schools", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name, owner: uid() }) });
        toast("School set up. Share the join code with your students.");
      } else if (k === "leave") {
        if (!confirm("Leave this school? Anything you shared with it is removed.")) return;
        await api(`school_members?school_id=eq.${id}&user_id=eq.${uid()}`, { method: "DELETE" });
        toast("You left the school");
      } else if (k === "del") {
        if (!confirm("Delete this school? Its roster and every shared brief are removed for everyone.")) return;
        await api(`schools?id=eq.${id}`, { method: "DELETE" });
        toast("School deleted");
      }
    } catch (e) { scStatus = /No school/.test(e.message) ? "No school has that join code." : e.message; }
    await loadMine().catch(() => {});
    paintSchools();
  }

  // Brief: share this flight with my school
  async function debriefSummary(f) {
    try {
      if (!f.track || !f.track.pts || f.track.pts.length < 10 || !window.AeroApproachDebrief || !window.AeroApproach) return null;
      const pts = profile(f).pts, last = pts[pts.length - 1];
      let id = String(last && last.ident || "").toUpperCase();
      if (/^[A-Z]{3}$/.test(id)) id = "K" + id;
      const d = await AeroApproach.cifp(id);
      if (!d) return null;
      const a = AeroApproachDebrief.analyze(f.track, d, id);
      if (!a || a.err) return null;
      const g = (x) => (x ? { ok: !!x.ok, why: x.why || [] } : null);
      return { apt: a.apt, approach: a.name, g1000: g(a.g1000), g500: g(a.g500) };
    } catch { return null; }
  }
  async function share(f, schoolIds) {
    const v = window.AeroVerdict && AeroVerdict.get();
    const depAt = (() => { const d = new Date(`${f.date}T${String(f.time || "12:00")}:00`); return isNaN(d) ? null : d.toISOString(); })();
    const deb = await debriefSummary(f);
    const rows = schoolIds.map((sid) => {
      const m = mine.find((x) => x.school_id === sid) || {};
      return { school_id: sid, user_id: uid(), flight_id: f.id, student_name: m.display_name || null,
        route: String(f.route || "").slice(0, 200), dep_at: depAt, verdict: v ? v.b : null, reasons: v ? v.r.slice(0, 8).map((x) => String(x).slice(0, 200)) : [],
        debrief: deb, created_at: new Date().toISOString() };
    });
    await api("school_shares?on_conflict=school_id,user_id,flight_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    S.schoolShared = S.schoolShared || {};
    S.schoolShared[f.id] = Date.now(); try { save(); } catch {}
  }
  async function unshare(f) {
    await api(`school_shares?user_id=eq.${uid()}&flight_id=eq.${encodeURIComponent(f.id)}`, { method: "DELETE" });
    if (S.schoolShared) { delete S.schoolShared[f.id]; try { save(); } catch {} }
  }
  function briefBox() {
    if (!/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.demo || f.missionId || !uid() || !mine) return;
    const studentOf = mine.filter((m) => m.role === "student");
    let box = document.getElementById("scShare");
    if (!studentOf.length) { if (box) box.remove(); return; }
    if (box && box.dataset.f === f.id) return;
    if (!box) {
      box = document.createElement("section"); box.className = "panel"; box.id = "scShare";
      const after = document.getElementById("apdPanel") || document.getElementById("trkPanel");
      if (after) after.after(box); else page.appendChild(box);
    }
    box.dataset.f = f.id;
    const shared = S.schoolShared && S.schoolShared[f.id];
    const names = studentOf.map((m) => (m.schools && m.schools.name) || "your school").join(", ");
    box.innerHTML = `<h2>Share with my school</h2>
      <p class="small" style="margin:0">Sends ${h(names)} this flight's route, departure time, verdict and reasons, and the approach debrief result if there is one. Nothing else from your logbook or brief is sent.</p>
      <div class="sc-row" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px"><button type="button" class="btn sm" data-sh="go">${shared ? "Share again with updates" : "Share this brief"}</button>${shared ? `<button type="button" class="btn sec sm" data-sh="rm">Remove from school</button>` : ""}</div>
      <p class="sc-st">${shared ? `Shared ${new Date(shared).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.` : ""}</p>`;
    box.querySelectorAll("[data-sh]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try {
        if (b.dataset.sh === "go") { await share(f, studentOf.map((m) => m.school_id)); toast("Shared with your school"); }
        else { await unshare(f); toast("Removed from your school"); }
      } catch (e) { toast("Could not share: " + e.message); }
      box.dataset.f = ""; briefBox();
    }));
  }

  // Instructor dashboard at #/school/<id>
  function vcls(v) { return v === "GO" ? "go" : v === "CAUTION" ? "caution" : v === "NO GO" ? "nogo" : ""; }
  function debText(d) {
    if (!d) return "";
    const g = d.g500 || d.g1000;
    if (!g) return `${h(d.apt)} ${h(d.approach)}`;
    return `${h(d.apt)} ${h(d.approach)}: ${g.ok ? "stable" : "not stable"} at ${d.g500 ? "500" : "1,000"} ft${g.ok ? "" : ` (${h(g.why.join(", "))})`}`;
  }
  async function pageSchool(el, arg) {
    const id = String(arg || "").split("?")[0];
    el.innerHTML = `<div class="page sc-dash"><h1>Flight school</h1><p class="lede">Loading...</p></div>`;
    if (!schoolsOn()) { el.querySelector(".lede").textContent = "Flight school dashboards are coming soon."; return; }
    if (!uid()) { el.querySelector(".lede").innerHTML = `<a href="#/account">Sign in</a> to open your school dashboard.`; return; }
    try {
      const [sc] = await api(`schools?select=id,name,join_code,owner&id=eq.${encodeURIComponent(id)}`);
      if (!sc) { el.querySelector(".lede").textContent = "That school was not found, or you are not one of its instructors."; return; }
      const roster = await api(`school_members?select=user_id,role,display_name,joined_at&school_id=eq.${sc.id}&order=role.asc,display_name.asc`);
      const shares = await api(`school_shares?select=user_id,flight_id,student_name,route,dep_at,verdict,reasons,debrief,created_at&school_id=eq.${sc.id}&order=created_at.desc&limit=100`);
      const owner = sc.owner === uid();
      const studs = roster.filter((r) => r.role === "student");
      const last = {}; shares.forEach((s) => { if (!last[s.user_id]) last[s.user_id] = s; });
      const date = (x) => (x ? new Date(x).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
      el.innerHTML = `<div class="page sc-dash">
        <h1>${h(sc.name)}</h1>
        <p class="lede">Join code <span class="sc-code" style="font:700 16px ui-monospace,Menlo,monospace;letter-spacing:2px;color:var(--cyan,#3DE0FF)">${h(sc.join_code)}</span>. Students enter it on their Account page.</p>
        <section class="panel"><h2>Shared briefs</h2>
          ${shares.length ? `<div class="tbl"><table><tr><th>Student</th><th>Flight</th><th>Verdict</th><th>Why</th><th>Approach debrief</th><th>Shared</th></tr>
          ${shares.map((s) => `<tr><td>${h(s.student_name || "Student")}</td><td>${h(s.route || "")}<br><span class="small muted">${h(date(s.dep_at))}</span></td><td class="v ${vcls(s.verdict)}">${h(s.verdict || "")}</td><td class="small">${(s.reasons || []).slice(0, 3).map(h).join("<br>")}</td><td class="small">${debText(s.debrief)}</td><td class="small muted">${h(date(s.created_at))}</td></tr>`).join("")}</table></div>`
          : `<p class="muted">No briefs shared yet. Students share from the bottom of a flight's brief.</p>`}
        </section>
        <section class="panel"><h2>Roster</h2>
          ${roster.length ? `<div class="tbl"><table><tr><th>Name</th><th>Role</th><th>Last shared</th><th></th></tr>
          ${roster.map((r) => `<tr><td>${h(r.display_name || (r.user_id === uid() ? "You" : "Student"))}</td><td>${r.role === "instructor" ? "Instructor" : "Student"}</td><td class="small">${last[r.user_id] ? `${h(last[r.user_id].route || "")} <span class="v ${vcls(last[r.user_id].verdict)}">${h(last[r.user_id].verdict || "")}</span>` : ""}</td>
            <td>${r.user_id !== uid() && r.user_id !== sc.owner ? `${owner ? `<button type="button" class="btn sec sm" data-rl="${h(r.user_id)}" data-to="${r.role === "student" ? "instructor" : "student"}">${r.role === "student" ? "Make instructor" : "Make student"}</button> ` : ""}<button type="button" class="btn sec sm" data-rm="${h(r.user_id)}">Remove</button>` : ""}</td></tr>`).join("")}</table></div>`
          : `<p class="muted">Nobody has joined yet.</p>`}
          <p class="small muted">${studs.length} student${studs.length === 1 ? "" : "s"}. Removing a student also removes what they shared.</p>
        </section>
        <div class="sc-d">A training aid only. Verdicts come from each student's own brief and do not replace the instructor's judgment or authorization of a flight.</div>
      </div>`;
      el.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = async () => {
        if (!confirm("Remove this person from the school?")) return;
        try { await api(`school_members?school_id=eq.${sc.id}&user_id=eq.${b.dataset.rm}`, { method: "DELETE" }); pageSchool(el, id); } catch (e) { toast(e.message); }
      }));
      el.querySelectorAll("[data-rl]").forEach((b) => (b.onclick = async () => {
        try { await api(`school_members?school_id=eq.${sc.id}&user_id=eq.${b.dataset.rl}`, { method: "PATCH", body: JSON.stringify({ role: b.dataset.to }) }); pageSchool(el, id); } catch (e) { toast(e.message); }
      }));
    } catch (e) { el.querySelector(".lede").textContent = "Could not load the school: " + e.message; }
  }
  if (typeof ROUTES !== "undefined") ROUTES.school = pageSchool;

  /* ---------- Account page panels ---------- */
  function panels() {
    if (!/^#\/account\/?$/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page") || document.getElementById("view");
    if (!page) return;
    const anchor = () => document.getElementById("alPanel") || document.getElementById("syncPanel") || page.querySelector("section.panel");
    if (!document.getElementById("proPanel")) {
      const sec = document.createElement("section"); sec.className = "panel"; sec.id = "proPanel";
      const a = anchor(); if (a) a.after(sec); else page.appendChild(sec);
      paintPro();
      refreshPlan().then(paintPro);
    }
    if (schoolsOn() && !document.getElementById("scPanel")) {
      const sec = document.createElement("section"); sec.className = "panel"; sec.id = "scPanel";
      document.getElementById("proPanel").after(sec);
      paintSchools();
      loadMine().then(paintSchools).catch((e) => { scStatus = e.message; mine = []; paintSchools(); });
    }
  }
  let t = 0, loading = false;
  const kick = () => { clearTimeout(t); t = setTimeout(() => {
    try { panels(); } catch (e) { console.error(e); }
    try {
      if (schoolsOn() && uid() && /^#\/brief/.test(location.hash || "")) {
        if (mine === null && !loading) { loading = true; loadMine().catch(() => { mine = []; }).finally(() => { loading = false; briefBox(); }); }
        else briefBox();
      }
    } catch (e) { console.error(e); }
  }, 250); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  setTimeout(() => { if (uid()) refreshPlan(); }, 3000);
  kick();
  window.AeroPro = { plan, has, refresh: refreshPlan, ENFORCE };
  window.AeroSchools = { on: schoolsOn, loadMine, share, unshare, mine: () => mine };
})();
