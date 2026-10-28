"use strict";
/* p158: school invite, school fleet on the server, and planning lab progress (October 28, 2026).
   Database change and privacy sentence approved by the owner on October 28, 2026
   (migration 20261028_school_fleet_and_lab_progress.sql).
   1. Invite: instructors get one link and a QR code (#/join/<code>) from the Account page, the school
      dashboard and the Fleet page. Opening it picks Flight School mode, asks for the student's name,
      signs them in if needed, joins the school and loads the school fleet. The QR library is loaded
      only when an invite is opened (vendor/qrcode-1.4.4.min.js, MIT).
   2. School fleet: an instructor saves this device's fleet (p154) with the school (set_school_fleet).
      Students get it when they join, and updates when they open the app.
   3. Lesson progress: a student can turn on Share lesson progress on the Planning lab page; lessons
      finished and check question scores go to the school's instructors (share_lab_progress), shown
      on the dashboard. Turning it off or leaving the school removes them.
   4. The privacy page gets the approved sentence, and its Last updated date moves to October 28, 2026. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => { try { return typeof AUTH !== "undefined" && AUTH && AUTH.user && AUTH.user.id ? AUTH.user.id : null; } catch { return null; } };
  async function api(path, opt = {}) {
    const tok = await validToken();
    const r = await fetch(`${SUPA.url}/rest/v1/${path}`, { ...opt, headers: { ...authHdr(tok), "Content-Type": "application/json", ...(opt.headers || {}) } });
    const txt = await r.text();
    let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || `Request failed (${r.status})`);
    return j;
  }
  const rpcCall = (fn, body) => api(`rpc/${fn}`, { method: "POST", body: JSON.stringify(body) });
  const inviteUrl = (code) => `${location.origin}/#/join/${encodeURIComponent(code)}`;

  const css = document.createElement("style");
  css.textContent = `
    #ivBox{position:fixed;inset:0;z-index:10050;background:rgba(3,8,18,.72);display:grid;place-items:center;padding:16px}
    #ivBox .iv{width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--glass3,#08101e);border:1px solid var(--line-hi,rgba(125,211,252,.35));border-radius:16px;padding:18px;color:var(--ink)}
    #ivBox h2{margin:0 0 6px;font-size:19px}
    #ivBox .qr{background:#fff;border-radius:12px;padding:12px;width:min(260px,100%);margin:12px auto;display:block}
    #ivBox .qr svg{display:block;width:100%;height:auto}
    #ivBox .url{font:13px var(--mono,monospace);word-break:break-all;background:rgba(0,0,0,.25);border:1px solid var(--line2);border-radius:8px;padding:8px}
    #ivBox .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    #ivPrint{display:none}
    @media print{html.day:has(body.iv-print){filter:none!important}body.iv-print > *:not(#ivPrint){display:none!important}body.iv-print{background:#fff!important}body.iv-print #ivPrint,body.iv-print #ivPrint *{visibility:visible!important}body.iv-print::before{display:none!important}body.iv-print #ivPrint{display:block!important;text-align:center;font:16px Georgia,serif;color:#000;padding:40px}#ivPrint svg{width:360px;height:360px}}
    .sc-x{margin:10px 0}.sc-x .lp{display:flex;flex-wrap:wrap;gap:4px}.sc-x .lp span{font-size:12px;padding:2px 7px;border-radius:999px;border:1px solid var(--line2)}
    .sc-x .lp span.ok{border-color:rgba(70,227,155,.6);color:#46e39b}.sc-x .lp span.mid{border-color:rgba(255,182,72,.6);color:#ffb648}
    #lbShare label{display:flex;gap:10px;align-items:center;min-height:44px;cursor:pointer}
    #lbShare input{width:22px;height:22px}
    .jn-page .panel input{width:100%}
    body.jn-focus #asWelcome{display:none!important}
  `;
  document.head.appendChild(css);

  /* ---------- 1. Invite dialog ---------- */
  let qrLib = null;
  function loadQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrLib) return qrLib;
    qrLib = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/vendor/qrcode-1.4.4.min.js"; s.onload = () => res(window.qrcode); s.onerror = () => { qrLib = null; rej(new Error("QR code could not load")); }; document.head.appendChild(s); });
    return qrLib;
  }
  async function qrSvg(text) {
    const q = (await loadQr())(0, "M"); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  async function openInvite(sc) {
    const url = inviteUrl(sc.join_code);
    let box = document.getElementById("ivBox"); if (box) box.remove();
    box = document.createElement("div"); box.id = "ivBox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Invite students");
    box.innerHTML = `<div class="iv"><h2>Invite students to ${h(sc.name || "your school")}</h2>
      <p class="small" style="margin:0">Students scan the code or open the link. It sets up Flight School mode, joins your school${sc.fleet_at ? " and loads the school fleet" : ""}. Join code <b>${h(sc.join_code)}</b>.</p>
      <div class="qr" id="ivQr"><p class="small muted" style="color:#333;margin:0">Making the QR code...</p></div>
      <div class="url">${h(url)}</div>
      <div class="row"><button type="button" class="btn sm" id="ivCopy">Copy link</button>${navigator.share ? `<button type="button" class="btn sec sm" id="ivShare">Share</button>` : ""}<button type="button" class="btn sec sm" id="ivPrintB">Print the QR code</button><button type="button" class="btn sec sm" id="ivX">Close</button></div>
      ${sc.fleet_at ? "" : `<p class="small muted">Tip: save your fleet with the school on its dashboard so students get every airplane's numbers when they join.</p>`}</div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    box.querySelector("#ivX").onclick = close;
    box.querySelector("#ivCopy").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Invite link copied"); } catch { toast("Copy did not work. Press and hold the link to copy it."); } };
    const sh = box.querySelector("#ivShare"); if (sh) sh.onclick = () => navigator.share({ title: `Join ${sc.name || "our flight school"} in AeroSignal`, url }).catch(() => {});
    let svg = "";
    try { svg = await qrSvg(url); box.querySelector("#ivQr").innerHTML = svg; } catch (e) { box.querySelector("#ivQr").innerHTML = `<p class="small" style="color:#333;margin:0">${h(e.message)}. The link still works.</p>`; }
    box.querySelector("#ivPrintB").onclick = () => {
      let p = document.getElementById("ivPrint"); if (!p) { p = document.createElement("div"); p.id = "ivPrint"; document.body.appendChild(p); }
      p.innerHTML = `<h1 style="font-weight:400">${h(sc.name || "Our flight school")}</h1><p>Scan to join us in AeroSignal</p>${svg}<p>Or open ${h(url)}</p><p>Join code ${h(sc.join_code)}</p>`;
      document.body.classList.add("iv-print");
      const done = () => { document.body.classList.remove("iv-print"); window.removeEventListener("afterprint", done); };
      window.addEventListener("afterprint", done);
      setTimeout(() => { try { window.print(); } catch {} setTimeout(done, 1500); }, 60);
    };
  }

  /* ---------- 2. Join page and pending join ---------- */
  function setSchoolMode() { try { if (!S.role || S.role !== "civil") { if (window.AeroMode && !S.role) { S.role = "civil"; save(); } } } catch {} }
  function pageJoin(el, arg) {
    const code = decodeURIComponent(String(arg || "").split("?")[0]).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
    setSchoolMode();
    const signed = !!uid();
    el.innerHTML = `<div class="page jn-page"><p class="small muted" style="letter-spacing:2px;margin:0">FLIGHT SCHOOL INVITE</p><h1>Join your flight school</h1>
      <p class="lede">Your instructor invited you to their flight school in AeroSignal. Joining lets you share a flight's brief with your instructors, and loads the school's airplanes so your weight and balance uses the real numbers.</p>
      <section class="panel"><h2>Join code ${h(code || "missing")}</h2>
        <label class="small">Your name, as your instructor knows you<input id="jnName" maxlength="80" value="${h((S.pendingJoin && S.pendingJoin.name) || (S.profile && S.profile.name) || "")}" autocomplete="name"></label>
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn" id="jnGo" ${code ? "" : "disabled"}>${signed ? "Join the school" : "Sign in and join"}</button><a class="btn sec" href="#/plan">Not now</a></div>
        <p class="small muted">${signed ? "You are signed in." : "You need a free account so your instructor can see what you share. Once you sign in, the app finishes joining by itself."} You choose what to share, and leaving the school removes it.</p>
        <p id="jnSt" class="small"></p></section></div>`;
    el.querySelector("#jnGo").onclick = async () => {
      const name = el.querySelector("#jnName").value.trim();
      if (!name) { el.querySelector("#jnSt").textContent = "Enter your name so your instructor knows who joined."; return; }
      S.pendingJoin = { code, name, at: Date.now() }; save();
      if (!uid()) { toast("Sign in or create your account, then the app finishes joining."); location.hash = "#/account"; return; }
      el.querySelector("#jnSt").textContent = "Joining...";
      await finishJoin(el.querySelector("#jnSt"));
    };
  }
  let joining = false;
  async function finishJoin(stEl) {
    const pj = S.pendingJoin;
    if (!pj || !uid() || joining) return;
    if (Date.now() - (pj.at || 0) > 7 * 864e5) { delete S.pendingJoin; save(); return; }
    joining = true;
    try {
      const id = await rpcCall("join_school", { code: pj.code, p_name: pj.name || null });
      delete S.pendingJoin; save();
      const [sc] = await api(`schools?select=id,name,fleet,fleet_at&id=eq.${id}`);
      let msg = `You joined ${sc ? sc.name : "the school"}.`;
      if (sc && sc.fleet) { const r = importFleet(sc); if (r) msg += ` Added ${r.n} airplane${r.n === 1 ? "" : "s"}.`; }
      toast(msg);
      try { if (window.AeroSchools) AeroSchools.loadMine(); } catch {}
      location.hash = "#/lab";
    } catch (e) {
      const m = /No school/.test(e.message) ? "No school has that join code. Check it with your instructor." : e.message;
      if (stEl) stEl.textContent = m; else toast(m);
      if (/No school/.test(e.message)) { delete S.pendingJoin; save(); }
    } finally { joining = false; }
  }
  if (typeof ROUTES !== "undefined") ROUTES.join = pageJoin;

  /* ---------- 3. School fleet on the server ---------- */
  function importFleet(sc) {
    if (!sc || !sc.fleet || !window.AeroFleet) return null;
    try {
      const r = AeroFleet.importData(sc.fleet);
      S.schoolFleetAt = S.schoolFleetAt || {}; S.schoolFleetAt[sc.id] = sc.fleet_at; save();
      return r;
    } catch (e) { console.error(e); return null; }
  }
  let synced = false;
  async function syncStudentFleets() {
    if (synced || !uid()) return;
    synced = true;
    try {
      const rows = await api(`school_members?select=school_id,role,schools(id,name,fleet_at)&user_id=eq.${uid()}`);
      for (const m of rows || []) {
        const sc = m.schools; if (!sc || !sc.fleet_at || m.role !== "student") continue;
        if ((S.schoolFleetAt || {})[sc.id] === sc.fleet_at) continue;
        const [full] = await api(`schools?select=id,name,fleet,fleet_at&id=eq.${sc.id}`);
        const r = importFleet(full);
        if (r) toast(`${sc.name} updated its fleet: ${r.n} airplane${r.n === 1 ? "" : "s"} on this device.`);
      }
    } catch (e) { console.error(e); }
  }
  async function saveFleet(id, btn) {
    const f = window.AeroFleet && AeroFleet.pack();
    if (!f || !Object.keys(f.tails || {}).length) { toast("Add your airplanes on the Fleet page first."); location.hash = "#/fleet"; return; }
    if (btn) btn.disabled = true;
    try { await rpcCall("set_school_fleet", { s: id, f }); toast(`Saved ${Object.keys(f.tails).length} airplane${Object.keys(f.tails).length === 1 ? "" : "s"} with the school. Students get them when they join or next open the app.`); }
    catch (e) { toast(e.message); }
    if (btn) btn.disabled = false;
  }

  /* ---------- 4. Lesson progress ---------- */
  const LESSONS = () => (window.AeroLab ? AeroLab.LESSONS : []);
  function summary() {
    const L = (window.AeroLab && AeroLab.progress()) || {}, out = {};
    for (const l of LESSONS()) { const r = L[l.id]; if (r && r.done) out[l.id] = { score: r.score, at: r.at || null }; }
    return { v: 1, n: LESSONS().length, lessons: out };
  }
  let studentSchools = null;
  async function myStudentSchools() {
    if (!uid()) return [];
    if (studentSchools) return studentSchools;
    const rows = await api(`school_members?select=school_id,role,lab_at,schools(name)&user_id=eq.${uid()}&role=eq.student`);
    studentSchools = (rows || []).map((r) => ({ id: r.school_id, name: (r.schools || {}).name || "School", shared: !!r.lab_at }));
    return studentSchools;
  }
  let pushT = 0;
  function pushProgress(force) {
    clearTimeout(pushT);
    pushT = setTimeout(async () => {
      const on = S.labShare || {}; const ids = Object.keys(on).filter((k) => on[k]);
      if (!ids.length || !uid()) return;
      const sum = summary(), sig = JSON.stringify(sum);
      for (const id of ids) {
        if (!force && (S.labSent || {})[id] === sig) continue;
        try { await rpcCall("share_lab_progress", { s: id, p: sum }); S.labSent = S.labSent || {}; S.labSent[id] = sig; save(); } catch (e) { console.error(e); }
      }
    }, force ? 50 : 1200);
  }
  async function labPanel() {
    if (!/^#\/lab\/?$/.test(location.hash || "")) return;
    const page = document.querySelector("#view .lab-page");
    if (!page || page.querySelector("#lbShare")) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "lbShare";
    const d = page.querySelector("p.d"); if (d) d.before(sec); else page.appendChild(sec);
    if (!uid()) { sec.innerHTML = `<h2>Share with your school</h2><p class="small" style="margin:0">Joined a flight school? <a href="#/account">Sign in</a> to share your lesson progress with your instructors.</p>`; return; }
    let list = [];
    try { list = await myStudentSchools(); } catch { sec.remove(); return; }
    if (!list.length) { sec.innerHTML = `<h2>Share with your school</h2><p class="small" style="margin:0">When you join your flight school (from your instructor's invite or the Account page), you can share your lesson progress with your instructors here.</p>`; return; }
    S.labShare = S.labShare || {};
    sec.innerHTML = `<h2>Share with your school</h2><p class="small" style="margin:0 0 6px">Your instructors see which lessons you finished and your check question scores. Nothing else from your lessons is shared, and you can turn it off at any time.</p>
      ${list.map((s) => `<label><input type="checkbox" data-s="${h(s.id)}" ${S.labShare[s.id] ? "checked" : ""}> Share lesson progress with ${h(s.name)}</label>`).join("")}`;
    sec.querySelectorAll("input[data-s]").forEach((cb) => (cb.onchange = async () => {
      const id = cb.dataset.s;
      S.labShare[id] = cb.checked; save();
      if (cb.checked) { pushProgress(true); toast("Your lesson progress is shared with your school."); }
      else { try { await rpcCall("share_lab_progress", { s: id, p: null }); if (S.labSent) delete S.labSent[id]; save(); toast("Stopped sharing. Your school no longer sees your lesson progress."); } catch (e) { toast(e.message); cb.checked = true; S.labShare[id] = true; save(); } }
    }));
  }

  /* ---------- 5. Dashboard, Account and Fleet page additions ---------- */
  function labCells(lab) {
    const L = LESSONS(), got = (lab && lab.lessons) || {};
    const n = L.filter((l) => got[l.id]).length;
    return { n, chips: L.map((l, i) => { const r = got[l.id]; return `<span class="${r ? (r.score === 3 ? "ok" : "mid") : ""}" title="${h(l.title)}">${i + 1}. ${h(l.id === "wb" ? "W&B" : l.id === "perf" ? "Perf" : l.id === "air" ? "Airspace" : l.id === "wx" ? "Weather" : l.id === "fuel" ? "Fuel" : "Risk")} ${r ? `${r.score}/3` : "not yet"}</span>`; }).join("") };
  }
  async function dashboard() {
    const m = /^#\/school\/([0-9a-f-]{36})/.exec(location.hash || "");
    if (!m || !uid()) return;
    const page = document.querySelector("#view .sc-dash");
    if (!page || page.dataset.p158 || !page.querySelector("section.panel")) return;
    page.dataset.p158 = "1";
    const id = m[1];
    let sc, roster;
    try {
      [sc] = await api(`schools?select=id,name,join_code,owner,fleet_at,fleet&id=eq.${id}`);
      roster = await api(`school_members?select=user_id,role,display_name,lab,lab_at&school_id=eq.${id}&role=eq.student&order=display_name.asc`);
    } catch (e) { console.error(e); return; }
    if (!sc || !document.body.contains(page)) return;
    const lede = page.querySelector(".lede");
    if (lede && !lede.querySelector("#scInv")) { lede.insertAdjacentHTML("beforeend", ` <button type="button" class="btn sm" id="scInv">Invite students</button>`); lede.querySelector("#scInv").onclick = () => openInvite(sc); }
    const tails = sc.fleet ? Object.keys(sc.fleet.tails || {}) : [];
    const local = window.AeroFleet ? Object.keys(AeroFleet.pack().tails || {}) : [];
    const fl = document.createElement("section"); fl.className = "panel sc-x"; fl.id = "scFleet";
    fl.innerHTML = `<h2>School fleet</h2>
      <p class="small" style="margin:0 0 8px">${tails.length ? `${tails.length} airplane${tails.length === 1 ? "" : "s"} saved with the school (${h(tails.join(", "))}), updated ${h(new Date(sc.fleet_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}. Students get them when they join and when they next open the app.` : "No fleet saved with the school yet. Set up your airplanes on the Fleet page, then save them here so every student gets them."}</p>
      <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" id="scFlSave" ${local.length ? "" : "disabled"}>Save this device's fleet to the school${local.length ? ` (${local.length})` : ""}</button><a class="btn sec sm" href="#/fleet">Open the Fleet page</a></div>`;
    const lp = document.createElement("section"); lp.className = "panel sc-x"; lp.id = "scLab";
    const shared = (roster || []).filter((r) => r.lab);
    lp.innerHTML = `<h2>Planning lab progress</h2>
      ${shared.length ? `<div class="tbl"><table><tr><th>Student</th><th>Lessons</th><th>Scores</th><th>Updated</th></tr>${shared.map((r) => { const c = labCells(r.lab); return `<tr><td>${h(r.display_name || "Student")}</td><td>${c.n} of ${LESSONS().length}</td><td><div class="lp">${c.chips}</div></td><td class="small muted">${h(new Date(r.lab_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }))}</td></tr>`; }).join("")}</table></div>` : `<p class="muted" style="margin:0">No student has shared lesson progress yet. Students turn it on from the Planning lab page.</p>`}
      ${(roster || []).length > shared.length && shared.length ? `<p class="small muted">${(roster || []).length - shared.length} student${(roster || []).length - shared.length === 1 ? " has" : "s have"} not turned on sharing.</p>` : ""}`;
    const first = page.querySelector("section.panel");
    first.after(lp); lp.after(fl);
    fl.querySelector("#scFlSave").onclick = (e) => saveFleet(id, e.target).then(() => { page.dataset.p158 = ""; page.querySelectorAll(".sc-x").forEach((x) => x.remove()); const b = page.querySelector("#scInv"); if (b) b.remove(); dashboard(); });
  }
  function accountRows() {
    const sec = document.getElementById("scPanel");
    if (!sec) return;
    sec.querySelectorAll(".sc-list li").forEach((li) => {
      const dash = li.querySelector('a[href^="#/school/"]'), code = li.querySelector(".sc-code");
      if (!dash || !code || li.querySelector(".sc-inv")) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "btn sm sc-inv"; b.textContent = "Invite students";
      b.onclick = async () => { const id = dash.getAttribute("href").split("/")[2]; let fa = null; try { [{ fleet_at: fa } = {}] = await api(`schools?select=fleet_at&id=eq.${id}`); } catch {} openInvite({ id, name: (li.querySelector(".nm") || {}).textContent, join_code: code.textContent, fleet_at: fa }); };
      dash.before(b);
    });
  }
  async function fleetPage() {
    if (!/^#\/fleet\/?$/.test(location.hash || "") || !uid()) return;
    const share = document.querySelector("#view .fl-page .share");
    if (!share || share.querySelector(".fl-sc")) return;
    const box = document.createElement("div"); box.className = "fl-sc"; share.appendChild(box);
    let mine = [];
    try { mine = (await api(`school_members?select=school_id,role,schools(name,join_code,fleet_at)&user_id=eq.${uid()}&role=eq.instructor`)) || []; } catch { return; }
    if (!mine.length) return;
    box.innerHTML = `<p class="small" style="margin:12px 0 6px"><b>Your schools.</b> Save the fleet with a school and students get it with their invite.</p>${mine.map((m) => `<div class="row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><span style="flex:1 1 140px">${h((m.schools || {}).name || "School")}</span><button type="button" class="btn sm" data-sv="${h(m.school_id)}">Save to school</button><button type="button" class="btn sec sm" data-iv="${h(m.school_id)}">Invite students</button></div>`).join("")}`;
    box.querySelectorAll("[data-sv]").forEach((b) => (b.onclick = () => saveFleet(b.dataset.sv, b)));
    box.querySelectorAll("[data-iv]").forEach((b) => (b.onclick = () => { const m = mine.find((x) => x.school_id === b.dataset.iv); const s = m.schools || {}; openInvite({ id: m.school_id, name: s.name, join_code: s.join_code, fleet_at: s.fleet_at }); }));
  }

  /* ---------- 6. Privacy page ---------- */
  const PRIV = "A school's instructors can save the school fleet, meaning each airplane's weight and balance numbers and checklists, with the school so every member sees it. If you turn on Share lesson progress, the planning lab lessons you finished and your check question scores are sent to the school's instructors. Turning it off or leaving the school removes them.";
  function privacy() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const view = document.getElementById("view");
    const s = view && view.querySelector("#pvSchool");
    if (s && !view.querySelector("#pvSchool2")) { const p = document.createElement("p"); p.id = "pvSchool2"; p.textContent = PRIV; s.after(p); }
    if (view && view.querySelector("#pvSchool2")) {
      const w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (/Last updated October (6|20|21|22), 2026/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/October (6|20|21|22), 2026/, "October 28, 2026");
    }
  }

  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => {
    document.body.classList.toggle("jn-focus", /^#\/join/.test(location.hash || ""));
    for (const f of [privacy, accountRows, labPanel, dashboard, fleetPage]) { try { const r = f(); if (r && r.catch) r.catch((e) => console.error(e)); } catch (e) { console.error(e); } }
    try { if (S.pendingJoin && uid() && !/^#\/join/.test(location.hash || "")) finishJoin(); } catch (e) { console.error(e); }
    try { if (/^#\/lab/.test(location.hash || "")) pushProgress(false); } catch {}
    if (uid()) syncStudentFleets();
  }, 250); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroInvite = { open: openInvite, url: inviteUrl, finishJoin, pushProgress, summary };
  if ((location.hash || "").startsWith("#/join")) { try { go(); } catch {} }
})();
