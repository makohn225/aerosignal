"use strict";
/* p153: two operating modes (October 28, 2026).
   Flight School mode is for student pilots and instructors in general aviation trainers; Military
   Planning mode adds missions, training routes, load computation and military mishap lessons. The
   mode is the existing role setting (p104, S.role): Flight School is "civil", Military Planning is
   "military" (a pilot who chose "both" before is treated as Military Planning, which shows everything).
   1. The first run question asks which mode, in plain words.
   2. A mode hub at the top of the Plan page: Flight School shows the planning lab, a training flight,
      the school fleet, your flight school and the sample school; Military Planning shows missions, a
      training route flight, military mishap lessons, the kneeboard and the risk assessment.
   3. A switch in the top bar on wide screens, in the hub on every screen, and in More (Your flying).
   4. body.mode-school or body.mode-mil for modules that style by mode. window.AeroMode. */
(function () {
  const MODES = {
    school: { label: "Flight School", role: "civil", sub: "Student pilots and instructors in training aircraft" },
    mil: { label: "Military Planning", role: "military", sub: "Missions, training routes, load computation and military mishap lessons" },
  };
  const get = () => (S.role === "civil" ? "school" : S.role ? "mil" : null);
  function set(m) {
    const r = MODES[m] ? MODES[m].role : null;
    if (!r) return;
    try { if (window.AeroRole) AeroRole.set(r); else { S.role = r; save(); } } catch { S.role = r; try { save(); } catch {} }
    try { toast(m === "school" ? "Flight School mode. Military tools are hidden; switch any time from the top of Plan or More." : "Military Planning mode. Every tool is shown, including missions and training routes."); } catch {}
    body(); paint();
  }
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #modeHub{margin:10px 0 14px;padding:14px 16px;border-radius:16px;border:1px solid var(--line2,rgba(255,255,255,.14));background:rgba(255,255,255,.03)}
    #modeHub .mh-top{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between}
    #modeHub .mh-top b{font:700 12px var(--disp,system-ui);letter-spacing:2px;text-transform:uppercase;color:var(--cyan,#3DE0FF)}
    #modeHub .mh-sub{font-size:13.5px;color:var(--ink2,#9db2ce);margin:2px 0 10px}
    #modeHub .mh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
    #modeHub .mh-grid a{display:flex;flex-direction:column;gap:3px;padding:12px;border-radius:12px;border:1px solid var(--line2,rgba(255,255,255,.12));background:rgba(0,0,0,.18);color:var(--ink,#EAF2FF);text-decoration:none;min-height:44px}
    #modeHub .mh-grid a b{font-size:14.5px}
    #modeHub .mh-grid a span{font-size:12.5px;color:var(--ink2,#9db2ce);line-height:1.35}
    #modeHub .mh-grid a:hover{border-color:var(--cyan,#3DE0FF)}
    .mode-seg{display:inline-flex;border:1px solid var(--line2,rgba(255,255,255,.18));border-radius:999px;padding:2px;gap:2px}
    .mode-seg button{border:0;background:transparent;color:var(--ink2,#9db2ce);font:600 12.5px var(--sans,system-ui);padding:6px 12px;border-radius:999px;cursor:pointer;min-height:32px}
    .mode-seg button[aria-pressed=true]{background:rgba(61,224,255,.16);color:var(--cyan,#3DE0FF)}
    #modeTop{flex:0 0 auto}
    @media (max-width:1100px){#modeTop{display:none}}
    body.mode-focus #asWelcome{display:none!important}
    #roleAsk .mode-q{display:flex;flex-direction:column;gap:8px;width:100%}
    #roleAsk .mode-q button{text-align:left;padding:12px 14px;border-radius:12px;border:1px solid var(--line2,rgba(255,255,255,.18));background:rgba(0,0,0,.18);color:var(--ink,#EAF2FF);cursor:pointer}
    #roleAsk .mode-q button b{display:block;font-size:15px}
    #roleAsk .mode-q button span{font-size:13px;color:var(--ink2,#9db2ce)}
  `;
  document.head.appendChild(css);
  const seg = (id) => `<span class="mode-seg" ${id ? `id="${id}"` : ""} role="group" aria-label="Mode"><button type="button" data-mode="school" aria-pressed="${get() === "school"}">Flight School</button><button type="button" data-mode="mil" aria-pressed="${get() === "mil"}">Military</button></span>`;
  const wire = (root) => root.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => set(b.dataset.mode)));

  const TILES = {
    school: [
      ["#/lab", "Planning lab", "Short lessons on weather, performance, weight and balance, fuel, airspace and risk, each with a practice flight"],
      ["#plan-box", "Plan a training flight", "Describe tomorrow's flight in plain words and get the brief"],
      ["#/fleet", "School fleet", "Each airplane's weight and balance and checklists, set up once and shared with students"],
      ["#/account/school", "My flight school", "Join with a code, share briefs with your instructor, or open the instructor dashboard"],
      ["#/school/demo", "Sample school", "See a Gulf Coast training school with students, fleet and shared briefs"],
    ],
    mil: [
      ["#/missions", "Missions", "Plan a mission with the objective area, kneeboard cards and the mission brief"],
      ["#plan-box", "Training route flight", "A local sortie with a training route, like KNCA VR084 B-F 13NC KNCA"],
      ["#/safety", "Military mishap lessons", "Search public military mishap narratives and NTSB records"],
      ["#/frat", "Risk assessment", "Score and sign the flight risk assessment"],
      ["#/checklists", "Checklists", "Your own approved checklists, ready to run"],
    ],
  };
  function hub(page) {
    const m = get();
    let el = page.querySelector("#modeHub");
    if (!m) { if (el) el.remove(); return; }
    const sig = m + "|" + S.role;
    if (el && el.dataset.sig === sig) return;
    if (!el) {
      el = document.createElement("section"); el.id = "modeHub";
      const w = page.querySelector("#asWelcome"), h1 = page.querySelector(":scope > h1, :scope > .kicker, :scope > p.kicker");
      if (w) w.after(el); else if (h1) h1.before(el); else page.prepend(el);
    }
    el.dataset.sig = sig;
    el.innerHTML = `<div class="mh-top"><b>${h(MODES[m].label)} mode</b>${seg()}</div><p class="mh-sub">${h(MODES[m].sub)}</p>
      <div class="mh-grid">${TILES[m].map(([href, t, s]) => `<a href="${href}"><b>${h(t)}</b><span>${h(s)}</span></a>`).join("")}</div>`;
    wire(el);
    el.querySelectorAll('a[href="#plan-box"]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); const ta = document.querySelector("#view textarea"); if (ta) { ta.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => ta.focus(), 300); } }));
    el.querySelectorAll('a[href="#/account/school"]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); location.hash = "#/account"; let n = 0; const t = setInterval(() => { const p = document.getElementById("scPanel"); if (p || ++n > 30) { clearInterval(t); if (p) p.scrollIntoView({ behavior: "smooth", block: "start" }); } }, 150); }));
  }
  function firstRun(page) {
    const q = page.querySelector("#roleAsk");
    if (!q || q.dataset.lp) return;
    q.dataset.lp = "1";
    q.innerHTML = `<b>How will you use AeroSignal?</b><div class="mode-q">
      <button type="button" data-mode="school"><b>Flight School</b><span>${h(MODES.school.sub)}</span></button>
      <button type="button" data-mode="mil"><b>Military Planning</b><span>${h(MODES.mil.sub)}</span></button></div>
      <span class="small muted">You can switch any time from the top of this page or in More.</span>`;
    q.querySelectorAll("[data-mode]").forEach((b) => (b.onclick = () => { q.remove(); set(b.dataset.mode); }));
  }
  function more(page) {
    const s = page.querySelector("#roleMore");
    if (!s || s.dataset.lp === get()) return;
    s.dataset.lp = get() || "";
    s.innerHTML = `<h2>Your flying</h2><p class="small" style="margin:0 0 8px">Flight School mode is for student pilots and instructors and hides military tools. Military Planning mode shows everything, including missions, training routes and load computation.</p>${seg()}`;
    wire(s);
  }
  function top() {
    const chip = document.getElementById("gtBtn") || document.getElementById("flightChip");
    let t = document.getElementById("modeTop");
    if (!get()) { if (t) t.remove(); return; }
    if (!t && chip) { const w = document.createElement("span"); w.innerHTML = seg("modeTop"); t = w.firstElementChild; chip.before(t); }
    if (t) { t.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === get())); wire(t); }
  }
  function body() {
    document.body.classList.toggle("mode-school", get() === "school");
    document.body.classList.toggle("mode-mil", get() === "mil");
  }
  function paint() {
    body(); top();
    // Lesson, fleet and school pages are focused work; the welcome card stays on Plan
    document.body.classList.toggle("mode-focus", /^#\/(lab|fleet|school)/.test(location.hash || ""));
    const page = document.querySelector("#view .page");
    if (!page) return;
    const hash = location.hash || "#/plan";
    if (/^#\/plan\/?$/.test(hash) || hash === "#/" || hash === "") { firstRun(page); hub(page); }
    if (/^#\/more/.test(hash)) more(page);
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { paint(); } catch (e) { console.error(e); } }, 260); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroMode = { get, set, MODES };
})();
