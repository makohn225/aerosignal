"use strict";
/* p168: for instructors (November 3, 2026).
   1. An Instructor tutorial track on the Tutorial page (p157 lists it): setting up the school, the
      fleet, saving it with the school and inviting students, reviewing and approving shared plans,
      lesson progress, editing a lesson (only while school lesson editing, p167, is switched on) and
      printing lesson sheets. Runs on the sample school and sample fleet; nothing real changes.
      New lines use the device voice until recordings are made.
   2. A Getting started checklist at the top of a school's dashboard for its instructors: airplanes on
      the Fleet page, fleet saved with the school, students joined, a first shared brief, a first plan
      reviewed. Items tick off as they happen; Hide puts it away for that school on this device. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => { try { return typeof AUTH !== "undefined" && AUTH && AUTH.user && AUTH.user.id ? AUTH.user.id : null; } catch { return null; } };
  async function api(path) {
    const tok = await validToken();
    const r = await fetch(`${SUPA.url}/rest/v1/${path}`, { headers: { ...authHdr(tok) } });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && j.message) || `Request failed (${r.status})`);
    return j;
  }

  /* ---------- 1. Instructor tutorial ---------- */
  const T = window.AeroTutorial;
  if (T && T.scripts) {
    const edit = () => !!(window.AeroLabEdit && AeroLabEdit.on());
    const scenes = [
      { hash: "#/account", sel: "#scPanel, @h:Flight school", wait: "#view .page", text: "Here's how to run your flight school in AeroSignal. Start on the Account page: name your school, and AeroSignal gives you a join code and an instructor dashboard." },
      { hash: "#/fleet", sel: ".fl-ac, @h:Airplanes", wait: ".fl-page", text: "On the Fleet page, add each airplane once: its weight and balance numbers from its own records, and its checklists. These are sample airplanes." },
      { hash: "#/fleet", sel: ".fl-page .share, @h:Share with students", wait: ".fl-page", text: "Save the fleet with your school, and every student gets the real numbers for the tail they fly, with updates when you change them." },
      { hash: "#/school/demo", sel: ".sc-dash h1, .sc-dash .lede", wait: ".sc-dash", text: "Your dashboard has Invite students: one link, or a QR code to print for the front desk. Students who scan it are set up in Flight School mode and join your school." },
      { hash: "#/school/demo", sel: "@h:Shared briefs", wait: ".sc-dash table", text: "Students share each lesson's brief with the school. You see the verdict and its reasons before they arrive, and you approve the plan or return it with a comment." },
      { hash: "#/school/demo", sel: "@h:Planning lab progress", wait: ".sc-dash table", text: "Students who turn it on share their planning lab progress, so you can see who finished the weather or weight and balance lessons before you brief them." },
    ];
    if (edit()) scenes.push({ hash: "#/lab/wb", sel: "@h:Check yourself", wait: ".lab-page .q", text: "On any lesson, Edit this lesson lets you write your school's own check questions and add a school note. Every other school keeps the standard version." });
    scenes.push(
      { hash: "#/lab", sel: ".ls-btns, .lab-list", wait: ".lab-list", text: "Print the instructor sheets for ground school: the key points, the practice task and the check questions with an answer key." },
      { hash: "#/feedback", sel: "#fbf, .page", text: "That's the instructor tour. AeroSignal supports your judgment and never replaces your authorization of a flight. Send feedback from any page. Every note gets read." },
    );
    T.scripts.instructor = { label: "Flight School instructor", scenes };
    const base = T.start;
    T.start = async function (track, statusEl) {
      if (track !== "instructor") return base.apply(this, arguments);
      if (!S.role) { S.role = "civil"; try { save(); } catch {} }
      await base.call(this, track, statusEl);
      try { if (window.AeroSampleSchool && window.AeroFleet && !(S.profiles || {}).DEMO1) AeroFleet.importData(AeroSampleSchool.sampleFleet(), { sample: true }); } catch (e) { console.error(e); }
    };
  }

  /* ---------- 2. Getting started checklist ---------- */
  const css = document.createElement("style");
  css.textContent = `
    #gsPanel ol{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:6px}
    #gsPanel li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px}
    #gsPanel li .ck{flex:none;width:22px;height:22px;border-radius:50%;border:2px solid var(--line-hi,rgba(125,211,252,.35));display:grid;place-items:center;font:700 13px var(--body,system-ui)}
    #gsPanel li.done .ck{background:#46e39b;border-color:#46e39b;color:#04121f}
    #gsPanel li.done .tx{color:var(--ink2,#9db2ce)}
    #gsPanel .gs-top{display:flex;justify-content:space-between;gap:8px;align-items:center}
    #gsPanel .bar{height:6px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;margin:8px 0 4px}
    #gsPanel .bar i{display:block;height:100%;background:#46e39b}
  `;
  document.head.appendChild(css);
  async function checklist() {
    const m = /^#\/school\/([0-9a-f-]{36})/.exec(location.hash || "");
    if (!m || !uid()) return;
    const page = document.querySelector("#view .sc-dash");
    if (!page || page.dataset.p168 || !page.querySelector("section.panel")) return;
    page.dataset.p168 = "1";
    const id = m[1];
    if ((S.gsHide || {})[id]) return;
    let sc, studs, shares;
    try {
      [sc] = await api(`schools?select=id,name,join_code,fleet_at&id=eq.${id}`);
      studs = (await api(`school_members?select=user_id&school_id=eq.${id}&role=eq.student&limit=1`)) || [];
      shares = (await api(`school_shares?select=status&school_id=eq.${id}&limit=200`)) || [];
    } catch (e) { console.error(e); return; }
    if (!sc || !document.body.contains(page)) return;
    const fleetLocal = !!(S.fleet && (S.fleet.tails || []).length);
    const items = [
      [true, "Set up your school", ""],
      [fleetLocal, "Add your airplanes on the Fleet page", `<a href="#/fleet">Open the Fleet page</a>`],
      [!!sc.fleet_at, "Save the fleet with your school", "Use Save this device's fleet to the school below."],
      [studs.length > 0, "Invite your students", `Tap Invite students above, or give them join code <b>${h(sc.join_code)}</b>.`],
      [shares.length > 0, "Get a first shared brief", "Students tap Share this brief at the bottom of a flight's brief."],
      [shares.some((s) => s.status && s.status !== "submitted"), "Review a first plan", "Approve it or return it with a comment in Plans to review."],
    ];
    const done = items.filter((x) => x[0]).length;
    if (done === items.length) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "gsPanel";
    sec.innerHTML = `<div class="gs-top"><h2 style="margin:0">Getting started</h2><button type="button" class="btn sec sm" id="gsHide">Hide</button></div>
      <div class="bar"><i style="width:${Math.round((done / items.length) * 100)}%"></i></div><div class="small muted">${done} of ${items.length} done. <a href="#/tutorial">Play the instructor tutorial</a></div>
      <ol>${items.map(([ok, t, how]) => `<li class="${ok ? "done" : ""}"><span class="ck">${ok ? "✓" : ""}</span><span class="tx"><b>${h(t)}</b>${!ok && how ? `<br><span class="small">${how}</span>` : ""}</span></li>`).join("")}</ol>`;
    page.querySelector("section.panel").before(sec);
    sec.querySelector("#gsHide").onclick = () => { S.gsHide = S.gsHide || {}; S.gsHide[id] = Date.now(); try { save(); } catch {} sec.remove(); toast("Getting started is hidden. The instructor tutorial stays on the Tutorial page."); };
  }
  let t = 0;
  const kick = () => { if (t) return; t = setTimeout(() => { t = 0; checklist().catch((e) => console.error(e)); }, 450); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
