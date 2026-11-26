"use strict";
/* p271: human factors (November 26, 2026), part of the FAA sources work in p270.
   1. Accident reports show a second level HFACS category (skill based error, decision error, perceptual error,
      violation, and the preconditions such as adverse mental or physiological state) in place of the top level
      "Unsafe Act" label, in the brief and in See in 3D. The labels come from ntsb_narratives.hfacs_l2, assigned
      automatically from the narrative wording (migration 20261126_hfacs_level2.sql). Until that column exists the
      reports simply keep their old label.
   2. A "Human factors for this flight" section in the brief, just before Decision points:
        the hazardous attitude to guard against on this kind of flight, with the FAA antidote (PHAK Chapter 2);
        what the matching accidents show by HFACS category, with a countermeasure for the most common one;
        single pilot resource management checkpoints using the 5Ps (PHAK Chapter 2);
        threats for this flight from the brief's own flagged sections and accident lessons, in the threat and
        error management model (Risk Management Handbook Chapter 6);
        crew coordination for crewed aircraft (AC 120-51E) and high altitude physiology for jets and turboprops
        (AC 61-107B).
      Wording is guidance drawn from those public FAA documents, not an assessment of the pilot. */
(function () {
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const isBrief = () => /^#\/brief(\/|$|\?)/.test(location.hash || "");
  const SHORT = { "Skill-based error": "skill based error", "Decision error": "decision error", "Perceptual error": "perceptual error", "Violation": "violation", "Adverse physiological state": "adverse physiological state", "Adverse mental state": "adverse mental state", "Crew resource management": "crew coordination", "Unsafe supervision": "unsafe supervision", "Mechanical or maintenance": "mechanical or maintenance" };
  const PLURAL = { "Skill-based error": "skill based errors", "Decision error": "decision errors", "Perceptual error": "perceptual errors", "Violation": "violations", "Adverse physiological state": "adverse physiological states", "Adverse mental state": "adverse mental states", "Crew resource management": "crew coordination breakdowns", "Unsafe supervision": "supervision lapses", "Mechanical or maintenance": "mechanical or maintenance causes" };
  const COUNTER = {
    "Skill-based error": "Say each checklist out loud at every phase, and if the maneuvers that show up in these reports have gone stale, fly them with an instructor first.",
    "Decision error": "Set your go, no go and divert points now, on the ground, and write them down. The Decision points section below has a start.",
    "Perceptual error": "When outside cues get poor, at night, in haze or over water, go to the instruments and use vertical guidance to the runway.",
    "Violation": "Confirm your currency, medical and the aircraft's inspections before this flight, and stay inside your own minimums.",
    "Adverse physiological state": "Run IMSAFE honestly, and plan oxygen as 14 CFR 91.211 requires.",
    "Adverse mental state": "Take the time pressure off: tell passengers the flight may wait, and brief a plan B before you start.",
    "Crew resource management": "Brief who flies, who monitors, the callouts, and the positive exchange of controls.",
    "Unsafe supervision": "If you fly for an operator or school, use its risk assessment and ask for a second look when the score is elevated.",
    "Mechanical or maintenance": "Do a thorough preflight and review open squawks and recent maintenance before you accept the aircraft.",
  };
  // The FAA's five hazardous attitudes and antidotes (PHAK Chapter 2)
  const ATT = {
    invul: ["Invulnerability", "“It won't happen to me.”", "It could happen to me."],
    macho: ["Macho", "“I can do it.”", "Taking chances is foolish."],
    anti: ["Antiauthority", "“Don't tell me.”", "Follow the rules. They are usually right."],
    impul: ["Impulsivity", "“Do it quickly.”", "Not so fast. Think first."],
    resig: ["Resignation", "“What's the use?”", "I'm not helpless. I can make a difference."],
  };
  // Why an accident lesson points at an attitude (guidance, not a finding about any pilot)
  const THEME_ATT = {
    vfrimc: ["invul", "pressing on into worsening weather"], fuel: ["invul", "stretching the fuel"], icing: ["invul", "staying in icing conditions"],
    terrain: ["invul", "flying low near terrain"], night: ["invul", "flying at night with few visual cues"], turb: ["invul", "flying into forecast turbulence"],
    wind: ["macho", "landing in strong or gusty wind"], layoff: ["macho", "flying after a long layoff"], lowtype: ["macho", "flying an airplane you have little time in"],
    da: ["macho", "taking off heavy at high density altitude"], wire: ["macho", "maneuvering low near wires"],
    approach: ["impul", "rushing an instrument approach"], unstab: ["impul", "continuing an approach that is not stabilized"], instruct: ["impul", "waiting too long to take the controls"],
    ground: ["impul", "hurrying on the ground"], carb: ["impul", "skipping the carburetor heat"],
    engfail: ["resig", "handling an engine failure"], lte: ["resig", "handling unanticipated yaw"], vmc: ["resig", "handling an engine failure in a twin"],
  };

  const st = document.createElement("style");
  st.textContent = `
    #hfPanel .hf-b{border-top:1px solid var(--line,rgba(255,255,255,.1));padding:10px 0}
    #hfPanel .hf-b:first-of-type{border-top:0;padding-top:0}
    #hfPanel .hf-b h3{font-size:14px;margin:0 0 4px;letter-spacing:.02em}
    #hfPanel .hf-b p{margin:4px 0;font-size:14px}
    #hfPanel .hf-att{font-size:16px}
    #hfPanel ol,#hfPanel ul{margin:4px 0 0 18px;padding:0;font-size:14px}
    #hfPanel li{margin:3px 0}
    #hfPanel .hf-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:6px 0 4px;background:var(--line,rgba(255,255,255,.1))}
    #hfPanel .hf-bar span{display:block;height:100%}
    #hfPanel .hf-key{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--ink2,#9db2ce)}
    #hfPanel .hf-key i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;vertical-align:baseline}
    #hfPanel .hf-jump{appearance:none;background:transparent;border:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit;padding:0;text-align:left}
    .rep .rh .hf2{cursor:help}`;
  document.head.appendChild(st);
  const COLORS = { "Skill-based error": "#3DE0FF", "Decision error": "#ffb648", "Perceptual error": "#b48cff", "Violation": "#ff4d6a", "Adverse physiological state": "#ff8fb1", "Adverse mental state": "#ffd86b", "Crew resource management": "#46e39b", "Unsafe supervision": "#9db2ce", "Mechanical or maintenance": "#6b7d95" };

  // 1. Level 2 labels for reports on screen
  const cache = new Map(); let colMissing = false, pending = null;
  async function labels(ids) {
    const need = ids.filter((id) => !cache.has(id));
    if (need.length && !colMissing) {
      try {
        for (let i = 0; i < need.length; i += 60) {
          const part = need.slice(i, i + 60);
          const r = await fetch(`${SUPA.url}/rest/v1/ntsb_narratives?select=ev_id,hfacs_l2,hfacs_l2_all&ev_id=in.(${part.map((x) => `"${encodeURIComponent(x)}"`).join(",")})`, { headers: HDR });
          if (!r.ok) { if (r.status === 400) colMissing = true; break; }
          const rows = await r.json();
          for (const id of part) cache.set(id, null);
          for (const x of rows) cache.set(x.ev_id, x.hfacs_l2 ? { l2: x.hfacs_l2, all: x.hfacs_l2_all || [x.hfacs_l2] } : null);
        }
      } catch (e) {}
    }
    const out = {}; for (const id of ids) if (cache.get(id)) out[id] = cache.get(id); return out;
  }
  function repIds(root) { return [...new Set([...root.querySelectorAll(".rep [data-rid]")].map((b) => b.dataset.rid).filter(Boolean))]; }
  async function paintReps(root) {
    const ids = repIds(root); if (!ids.length) return {};
    const L = await labels(ids);
    for (const rep of root.querySelectorAll(".rep")) {
      if (rep.dataset.hf2) continue;
      const b = rep.querySelector("[data-rid]"); const lab = b && L[b.dataset.rid]; if (!lab) continue;
      rep.dataset.hf2 = "1";
      const rh = rep.querySelector(".rh"); if (!rh) continue;
      const old = [...rh.querySelectorAll("span")].find((s) => /^HFACS:/.test(s.textContent));
      const sp = old || document.createElement("span");
      sp.className = "hf2";
      sp.textContent = `HFACS: ${SHORT[lab.l2] || lab.l2}`;
      sp.title = `Human factors category, assigned automatically from the narrative wording (HFACS, DOT/FAA/AM-00/7)${lab.all.length > 1 ? `. Also: ${lab.all.slice(1).map((x) => SHORT[x] || x).join(", ")}` : ""}. Not an NTSB finding.`;
      if (!old) { const m = rh.querySelector(".mt"); m ? m.before(sp) : rh.appendChild(sp); }
    }
    return L;
  }
  // See in 3D (p269): add the category under the summary row
  async function paint3D() {
    const box = document.querySelector("#m3 .m3-info"); if (!box || box.dataset.hf2 || !box.querySelector(".m3-row")) return;
    box.dataset.hf2 = "1";
    const num = ((document.querySelector("#m3 .m3-top b") || {}).textContent || "").replace(/^NTSB\s*/, "").trim(); if (!num) return;
    try {
      const ev = await fetch(`${SUPA.url}/rest/v1/ntsb_events?select=ev_id&accident_number=eq.${encodeURIComponent(num)}&limit=1`, { headers: HDR }).then((r) => r.json());
      if (!ev[0]) return;
      const L = await labels([ev[0].ev_id]); const lab = L[ev[0].ev_id]; if (!lab) return;
      const rows = box.querySelectorAll(".m3-row"); const last = rows[rows.length - 1];
      last.insertAdjacentHTML("afterend", `<div class="m3-row"><span>Human factors <b>${h(SHORT[lab.l2] || lab.l2)}</b>${lab.all.length > 1 ? `, also ${h(lab.all.slice(1).map((x) => SHORT[x] || x).join(", "))}` : ""} <span class="small">(HFACS, assigned automatically from the report wording; not an NTSB finding. <a href="#/sources">Sources</a>)</span></span></div>`);
    } catch (e) {}
  }

  // 2. Human factors section
  function themeKeys(pg) {
    const map = new Map(); try { for (const t of THEMES) if (t && typeof t.watch === "string") map.set(t.watch.trim(), t.k); } catch (e) {}
    return [...pg.querySelectorAll("#bbody .item")].map((it) => { const w = it.querySelector(".watch"); return { k: w && map.get(w.textContent.trim()), t: ((it.querySelector("h4") || {}).textContent || "").trim(), low: it.classList.contains("low") }; }).filter((x) => x.k);
  }
  function pickAttitude(themes, L, flight) {
    const score = {}, why = {};
    const add = (a, w, r) => { score[a] = (score[a] || 0) + w; if (!why[a]) why[a] = r; };
    themes.forEach((x, i) => { const m = THEME_ATT[x.k]; if (m && !x.low) add(m[0], 3 - Math.min(2, i * 0.5), m[1]); });
    const vals = Object.values(L);
    const n = (c) => vals.filter((v) => v.all.includes(c)).length;
    if (n("Violation") >= 2) add("anti", 2, "skipping rules and limits, which shows up in several of these reports");
    if (n("Adverse mental state") >= 2) add("impul", 1, "hurrying, which shows up in several of these reports");
    try { const d = window.AeroFRAT && AeroFRAT.score(flight); if (d && d.manual.some((m) => m.k === "press")) add("invul", 2, "flying under time pressure, which you marked on the risk assessment"); } catch (e) {}
    const best = Object.keys(score).sort((a, b) => score[b] - score[a])[0] || "invul";
    return { a: ATT[best], why: why[best] || "any flight where the plan and the conditions start to drift apart" };
  }
  function flagged() { try { return window.AeroQuickBrief ? AeroQuickBrief.flagged() : []; } catch (e) { return []; } }
  function jumpTo(id) { try { if (window.AeroQuickBrief) AeroQuickBrief.apply("full"); } catch (e) {} const s = document.getElementById(id); if (!s) return; try { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); } catch (e) {} s.scrollIntoView({ block: "start", behavior: "smooth" }); }

  let lastSig = "", busy = false;
  async function build() {
    if (busy || !isBrief()) return;
    const pg = document.querySelector("#view .page"); if (!pg || !pg.querySelector(":scope > #bbody .item")) return;
    busy = true;
    try {
      const L = await paintReps(pg);
      let flight = null; try { flight = currentFlight(); } catch (e) {}
      const themes = themeKeys(pg), fl = flagged();
      let cls = null; try { cls = window.AeroAcClass ? AeroAcClass.flightClass() : null; } catch (e) {}
      const sig = JSON.stringify([themes.map((x) => x.k), Object.keys(L).length, fl.map((f) => f.id), cls && cls.cls]);
      let sec = pg.querySelector(":scope > #hfPanel");
      // Decision points can arrive after this section was first placed; keep this one just before it
      const dpNow = pg.querySelector(":scope > #dpPanel");
      if (sec && dpNow && sec.nextElementSibling !== dpNow) dpNow.before(sec);
      if (sec && sig === lastSig) return;
      lastSig = sig;
      const att = pickAttitude(themes, L, flight);
      // HFACS spread among the reports in this brief
      const cnt = {}; Object.values(L).forEach((v) => { cnt[v.l2] = (cnt[v.l2] || 0) + 1; });
      const tot = Object.values(cnt).reduce((a, b) => a + b, 0);
      const order = Object.keys(cnt).filter((k) => k !== "Mechanical or maintenance").sort((a, b) => cnt[b] - cnt[a]);
      const top = order[0];
      const hfBlock = tot >= 3 && top ? `<div class="hf-b"><h3>What the matching accidents show</h3>
          <p>Of ${tot} reports in this brief with a human factors label, the most common is <b>${h(PLURAL[top])}</b> (${cnt[top]}).</p>
          <div class="hf-bar" role="img" aria-label="${h(Object.entries(cnt).map(([k, v]) => `${v} ${PLURAL[k]}`).join(", "))}">${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span style="width:${(100 * v) / tot}%;background:${COLORS[k] || "#888"}"></span>`).join("")}</div>
          <div class="hf-key">${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span><i style="background:${COLORS[k] || "#888"}"></i>${h(PLURAL[k])} ${v}</span>`).join("")}</div>
          <p><b>Countermeasure:</b> ${h(COUNTER[top])}</p>
          <p class="small muted">Categories follow the FAA's Human Factors Analysis and Classification System and are assigned automatically from each narrative's wording, so treat them as a starting point, not NTSB findings.</p></div>` : "";
      // Threats: flagged sections first, then the top accident lessons
      const threats = [...fl.slice(0, 4).map((f) => ({ t: f.t, s: f.sum, id: f.id })), ...themes.filter((x) => !x.low && x.k !== "base").slice(0, 3).map((x) => ({ t: x.t, s: "", id: null }))].slice(0, 6);
      const crewed = cls && /^(airline|jet|turboprop)$/.test(cls.cls) || themes.some((x) => x.k === "instruct");
      const high = cls && /^(airline|jet)$/.test(cls.cls);
      const lead = `Guard against <b class="warn">${h(att.a[0].toLowerCase())}</b> on this flight${top && tot >= 3 ? `, and watch for ${h(PLURAL[top])}, the most common factor in the matching accidents` : ""}.`;
      const html = `<h2>Human factors for this flight</h2>
        <p class="small" style="margin-top:0">${lead}</p>
        <div class="hf-b"><h3>The attitude to guard against</h3>
          <p class="hf-att"><b>${h(att.a[0])}</b> ${h(att.a[1])}</p>
          <p>Why this one: lessons in this brief involve ${h(att.why)}. The FAA's antidote: <b>“${h(att.a[2])}”</b></p></div>
        ${hfBlock}
        <div class="hf-b"><h3>Threats for this flight</h3>
          ${threats.length ? `<ul>${threats.map((x) => `<li>${x.id ? `<button type="button" class="hf-jump" data-id="${h(x.id)}">${h(x.t)}</button>` : h(x.t)}${x.s ? `<span class="small muted">: ${h(x.s)}</span>` : ""}</li>`).join("")}</ul>` : `<p>Nothing in the brief is flagged. Read the full brief before you fly.</p>`}
          <p>For each threat, decide now how you will handle it and where you will change the plan. Threats managed early do not become errors, and errors caught early do not become an unsafe aircraft state.</p></div>
        <div class="hf-b"><h3>Single pilot resource management checkpoints</h3>
          <p>Review the 5Ps: <b>Plan, Plane, Pilot, Passengers, Programming</b></p>
          <ol><li>Before the flight, as part of preflight</li><li>Before takeoff</li><li>Hourly in cruise, or at the midpoint</li><li>Before descent</li><li>Before the final approach fix, or before entering the traffic pattern</li></ol></div>
        ${crewed ? `<div class="hf-b"><h3>Crew coordination</h3><p>Brief who is pilot flying and who is monitoring, the callouts, when either pilot calls for a go around, and the positive exchange of controls.</p></div>` : ""}
        ${high ? `<div class="hf-b"><h3>High altitude</h3><p>At high altitude, useful consciousness after a decompression can be very short. Check the oxygen masks and the quick donning drill before departure.</p></div>` : ""}
        ${window.AeroSources ? AeroSources.cite([["phak", "Ch. 2, hazardous attitudes and SRM"], ["rmh", "Ch. 6, Threat and Error Management"], ["hfacs", ""], ["ac6022", ""], ...(crewed ? [["ac12051", ""]] : []), ...(high ? [["ac61107", ""]] : [])]) : ""}`;
      if (!sec) {
        sec = document.createElement("section"); sec.className = "panel"; sec.id = "hfPanel";
        const dp = pg.querySelector(":scope > #dpPanel"), qm = pg.querySelector(":scope > #qkMore");
        if (dp) dp.before(sec); else if (qm) qm.before(sec); else pg.appendChild(sec);
      }
      const wasMin = sec.classList.contains("pnl-min"), tg = sec.querySelector(":scope > h2 .pnl-tg, :scope > h2 button");
      if (tg) { const h2 = sec.querySelector(":scope > h2"); const keep = [...h2.querySelectorAll("button,.pv-sum")]; sec.innerHTML = html; const nh = sec.querySelector(":scope > h2"); keep.forEach((k) => nh.appendChild(k)); const ps = nh.querySelector(".pv-sum"); if (ps) ps.innerHTML = lead; }
      else sec.innerHTML = html;
      if (wasMin) sec.classList.add("pnl-min");
      sec.querySelectorAll(".hf-jump").forEach((b) => b.onclick = () => jumpTo(b.dataset.id));
    } finally { busy = false; }
  }

  let t = 0;
  new MutationObserver((l) => {
    if (l.every((m) => m.target.closest && m.target.closest("#hfPanel,.src-ln,.hf2"))) return;
    clearTimeout(t); t = setTimeout(() => { if (isBrief()) build(); else { const v = document.querySelector("#view .page"); if (v && v.querySelector(".rep")) paintReps(v); } paint3D(); }, 450);
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { lastSig = ""; });
  window.AeroHumanFactors = { labels, build, ATT, COUNTER };
})();
