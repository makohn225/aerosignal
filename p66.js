"use strict";
/* p66: a quicker Safety search. One tap searches built from the current flight (near the
   departure, near the destination, this aircraft type, near me), the less used filters fold under
   "More filters", and the first visit runs a search near the departure so the page opens with
   results instead of a blank form. Also hides the welcome box once a pilot has their own data,
   and keeps the narrated tutorial from skipping scenes on some desktop browsers. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #sfQuick{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
    #sfQuick .l{width:100%;font:600 11px var(--disp,inherit);letter-spacing:1.5px;text-transform:uppercase;color:var(--ink2,#9fb0c8)}
    #sfQuick button{appearance:none;font:inherit;font-size:13px;padding:6px 11px;border-radius:999px;border:1px solid rgba(61,224,255,.45);background:rgba(61,224,255,.06);color:var(--ink,#EAF2FF);cursor:pointer}
    #sfQuick button:hover{border-color:#3DE0FF;color:#3DE0FF}
    .sf-more{grid-column:1/-1;border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:0 12px}
    .sf-more>summary{cursor:pointer;padding:10px 0;font-size:14px;list-style:none}
    .sf-more>summary::-webkit-details-marker{display:none}
    .sf-more>summary::before{content:"\\25B8  ";color:#3DE0FF}
    .sf-more[open]>summary::before{content:"\\25BE  "}
    .sf-more>.in{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px 12px;padding-bottom:12px}
    body.has-own #asWelcome{display:none!important}
  `;
  document.head.appendChild(css);
  const onSafety = () => /^#\/safety(\/|$|\?)/.test(location.hash || "");

  function flight() { try { const f = currentFlight(); return f && (f.points || []).length ? f : null; } catch { return null; } }
  function family(f) {
    try { const a = (typeof allAircraft === "function" ? allAircraft() : {})[f.tail] || {}; return a.family || a.typeCode || ""; } catch { return ""; }
  }

  function quick(form) {
    if (document.getElementById("sfQuick")) return;
    const f = flight();
    const b = [];
    if (f && document.getElementById("sfDep")) b.push(["dep", `Near ${f.points[0].ident}`]);
    if (f && document.getElementById("sfDst") && f.points.length > 1) b.push(["dst", `Near ${f.points[f.points.length - 1].ident}`]);
    const fam = f ? family(f) : "";
    if (fam) b.push(["type", `${fam} accidents anywhere`]);
    if (document.getElementById("sfMe")) b.push(["me", "Near me"]);
    if (!b.length) return;
    const d = document.createElement("div");
    d.id = "sfQuick";
    d.innerHTML = `<span class="l">Quick searches</span>${b.map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join("")}`;
    d.querySelectorAll("button").forEach((x) => (x.onclick = () => {
      const k = x.dataset.k;
      const q = document.getElementById("sfQ"), c = document.getElementById("sfC");
      if (k === "dep" || k === "dst") { if (q) q.value = ""; document.getElementById(k === "dep" ? "sfDep" : "sfDst").click(); }
      else if (k === "me") document.getElementById("sfMe").click();
      else if (k === "type") { if (q) q.value = fam; if (c) c.value = ""; document.getElementById("sfGo").click(); }
      const out = document.getElementById("sfOut");
      if (out) setTimeout(() => out.scrollIntoView({ block: "start", behavior: "smooth" }), 400);
    }));
    form.before(d);
  }

  function fold(form) {
    if (form.querySelector(".sf-more")) return;
    const pick = (id) => { let el = document.getElementById(id); while (el && el.parentElement !== form) el = el.parentElement; return el; };
    const parts = ["sfWx", "sfFrom", "sfTo", "sfSort"].map(pick).filter(Boolean);
    if (!parts.length) return;
    const d = document.createElement("details");
    d.className = "sf-more";
    d.innerHTML = `<summary>More filters: weather, years, sort</summary><div class="in"></div>`;
    parts[0].before(d);
    const inner = d.querySelector(".in");
    for (const p of parts) inner.appendChild(p);
  }

  let first = true;
  function apply() {
    try {
      const own = (S.logbook && (S.logbook.flights || []).length && !/^Demo /.test(S.logbook.source || "")) || (S.flights || []).some((f) => !f.demo && (f.points || []).length) || (S.missions || []).some((m) => !/^m_sample_/.test(m.id));
      document.body.classList.toggle("has-own", !!own);
    } catch {}
    if (!onSafety()) return;
    const form = document.getElementById("sfForm");
    if (!form) return;
    quick(form);
    fold(form);
    // First visit with a planned flight: open with what has happened near the departure
    if (first && !S.safetyQ && !document.body.classList.contains("tut") && flight() && document.getElementById("sfDep")) { first = false; document.getElementById("sfDep").click(); }
  }

  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 80); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();

  /* Intro video with the system "Reduce motion" setting on (common on Macs): the drawing
     animations are switched off, which left every graphic in its hidden starting state, so the
     route, mishaps and cards never appeared. Show every graphic in its finished state instead. */
  const rm = document.createElement("style");
  rm.textContent = `@media (prefers-reduced-motion:reduce){#asPromo svg .draw{stroke-dashoffset:0!important}#asPromo svg .pop,#asPromo svg .fade,#asPromo svg .rise,#asPromo svg .drift{opacity:1!important;transform:none!important}#asPromo svg .ring{opacity:.35!important}}`;
  document.head.appendChild(rm);

  /* Tutorial pacing guard. Some desktop browsers report a line as finished the moment it starts
     (speech engines that were just cancelled, voices still loading, or a recording that could not
     play), which made the tutorial race through every scene before the pages could draw. Each
     line now holds its scene for at least the time it takes to read it. */
  const synth = window.speechSynthesis;
  if (synth && typeof synth.speak === "function") {
    const base = synth.speak.bind(synth);
    synth.speak = function (u) {
      try {
        if (u && !u._aero && !u._preview && document.body.classList.contains("tut") && typeof u.onend === "function") {
          const t0 = Date.now(), min = Math.max(3500, String(u.text || "").length * 48), end = u.onend;
          u.onend = function (e) { const left = min - (Date.now() - t0); if (left > 0) setTimeout(() => end.call(u, e), left); else end.call(u, e); };
        }
      } catch {}
      return base(u);
    };
  }
})();
