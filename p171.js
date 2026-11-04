"use strict";
/* p171: Pilot mode home for personal minimums and currency (November 3, 2026).
   #/minimums: edit the personal minimums every brief checks (the same S.pmins the brief's minimums panel uses, p32)
   and see currency worked out from the logbook (p24). The Pilot mode hub (p153) links here, and shows a one line
   nudge until the pilot saves minimums of their own. Nothing leaves the device. */
(function () {
  if (typeof ROUTES === "undefined") return;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FIELDS = [["vfrCeil", "Day VFR ceiling", "ft"], ["vfrVis", "Day VFR visibility", "sm"], ["nightCeil", "Night VFR ceiling", "ft"], ["nightVis", "Night VFR visibility", "sm"], ["ifrCeil", "IFR ceiling", "ft"], ["ifrVis", "IFR visibility", "sm"], ["wind", "Max wind or gust", "kt"], ["spread", "Max gust spread", "kt"]];
  const DEF = { vfrCeil: 3000, vfrVis: 5, nightCeil: 5000, nightVis: 5, ifrCeil: 800, ifrVis: 2, wind: 25, spread: 10 };
  const mins = () => { try { if (window.AeroMins && AeroMins.mins) return AeroMins.mins(); } catch (e) {} return Object.assign({}, DEF, S.pmins || {}); };
  const css = document.createElement("style");
  css.textContent = `
    .pmn .pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px 14px}
    .pmn .pm-grid label{display:block;font-size:12.5px;color:var(--ink2,#9db2ce);margin-bottom:4px}
    .pmn .pm-grid input{width:100%;box-sizing:border-box;min-height:40px}
    .pmn .cu-row{display:grid;grid-template-columns:14px minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.1))}
    .pmn .cu-row:first-of-type{border-top:0}
    .pmn .dot{width:10px;height:10px;border-radius:50%;display:inline-block}
    .pmn .dot.cu-ok{background:#3ddc97}.pmn .dot.cu-warn{background:#ffb648}.pmn .dot.cu-bad{background:#ff4d6a}.pmn .dot.cu-na{background:#6b7c93}
    #pmNudge{margin:8px 0 0;font-size:13.5px}
    #pmNudge a{color:var(--cyan,#3DE0FF)}`;
  document.head.appendChild(css);

  function currencyRows() {
    let list = [];
    try { list = window.AeroCurrency && AeroCurrency.computeCurrency ? AeroCurrency.computeCurrency() || [] : []; } catch (e) { list = []; }
    if (!list.length) return `<p class="small" style="margin:0">Log a few flights with landings, approaches and holds and your day, night and instrument currency shows here. <a href="#/logbook">Open the logbook</a>.</p>`;
    const now = Date.now();
    return list.map((c) => {
      const exp = c.exp instanceof Date ? c.exp : c.exp ? new Date(c.exp) : null;
      const days = exp ? Math.ceil((exp - now) / 864e5) : null;
      const cls = "cu-" + (days == null ? "na" : days < 0 ? "bad" : days <= 30 ? "warn" : "ok");
      const txt = days == null ? "Not current" : days < 0 ? `Lapsed ${exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : `Current until ${exp.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
      return `<div class="cu-row"><span class="dot ${cls}"></span><span><b>${h(c.label)}</b><br><span class="small muted">${h(String(c.why || "").replace(/\bbelow\b/, "on the Logbook page"))} (${h(c.reg || "")})</span></span><span class="small">${h(txt)}</span></div>`;
    }).join("");
  }

  ROUTES.minimums = function (el) {
    const m = mins();
    el.innerHTML = `<div class="page pmn">
      <h1>Personal minimums and currency</h1>
      <p class="lede">Every brief checks the weather and winds against these numbers and says NO GO when a forecast is below them.</p>
      <section class="panel"><h2>Your minimums</h2>
        <div class="pm-grid">${FIELDS.map(([k, l, u]) => `<div><label for="pmn_${k}">${h(l)} (${u})</label><input id="pmn_${k}" type="number" inputmode="decimal" min="0" step="any" value="${h(m[k])}"></div>`).join("")}</div>
        <p class="small muted">Starting values are only a template. Set limits that match your experience and the aircraft, as in the FAA's PAVE personal minimums checklist.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" type="button" id="pmnSave">Save my minimums</button><span class="small" id="pmnMsg" role="status"></span></div>
      </section>
      <section class="panel"><h2>Currency</h2><p class="small muted" style="margin-top:0">Worked out from your logbook. Check the regulations and your own records before relying on it.</p>${currencyRows()}
        <p style="margin:12px 0 0"><a class="btn sec sm" href="#/logbook">Open the logbook</a></p></section>
    </div>`;
    el.querySelector("#pmnSave").onclick = () => {
      const out = {};
      for (const [k] of FIELDS) { const v = parseFloat(el.querySelector(`#pmn_${k}`).value); if (isFinite(v) && v >= 0) out[k] = v; }
      S.pmins = Object.assign({}, S.pmins || {}, out); S.pminsSetAt = Date.now();
      try { save(); } catch (e) {}
      const msg = el.querySelector("#pmnMsg"); msg.textContent = "Saved. Your next brief checks against these.";
    };
  };

  // One line nudge in the Pilot mode hub until minimums are set
  function nudge() {
    const hub = document.getElementById("modeHub");
    if (!hub || !window.AeroMode || AeroMode.get() !== "pilot") return;
    if (S.pminsSetAt || (S.pmins && Object.keys(S.pmins).length)) { const n = document.getElementById("pmNudge"); if (n) n.remove(); return; }
    if (hub.querySelector("#pmNudge")) return;
    const p = document.createElement("p"); p.id = "pmNudge";
    p.innerHTML = `First step: <a href="#/minimums">set your personal minimums</a> so every brief checks against your limits, not a template.`;
    hub.appendChild(p);
  }
  let t = 0;
  new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = 0; nudge(); }, 300); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  // The Flight School and instructor tutorials show Flight School mode. A pilot (or military user) who plays one
  // gets their own mode back when it ends.
  const T = window.AeroTutorial;
  if (T && typeof T.start === "function") {
    const base = T.start;
    T.start = function (track) {
      if ((track === "school" || track === "instructor") && S.role && window.AeroMode && AeroMode.get() !== "school") {
        const prev = { role: S.role, modeKind: S.modeKind };
        S.role = "civil"; S.modeKind = "school";
        try { save(); } catch (e) {}
        document.body.classList.add("role-civil", "mode-school"); document.body.classList.remove("mode-pilot", "mode-mil");
        let seen = false;
        const mo = new MutationObserver(() => {
          const on = document.body.classList.contains("tut");
          if (on) { seen = true; return; }
          if (!seen) return;
          mo.disconnect();
          S.role = prev.role; if (prev.modeKind) S.modeKind = prev.modeKind; else delete S.modeKind;
          try { save(); } catch (e) {}
          try { AeroMode.set(AeroMode.get()); } catch (e) {}
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      }
      return base.apply(this, arguments);
    };
  }
  window.AeroPilotHome = { mins };
})();
