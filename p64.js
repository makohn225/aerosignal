"use strict";
/* p64: a faster Flights page. The essentials come first: route, aircraft, date, time and flight
   rules, then the flight profile with the Brief button. Purpose, terrain, weather and conditions
   fold under "More options", the long route table folds under its own toggle, and the procedure
   and preferred route panels move below the profile. Nothing is removed; every field keeps its id
   and behavior. Also tidies a raw error message and the tutorial length wording. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    .fl-more{grid-column:1/-1;border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:0 12px}
    .fl-more>summary{cursor:pointer;padding:11px 0;font-size:14px;color:var(--ink,#EAF2FF);list-style:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    .fl-more>summary::-webkit-details-marker{display:none}
    .fl-more>summary::before{content:"\\25B8";color:#3DE0FF;transition:transform .15s}
    .fl-more[open]>summary::before{transform:rotate(90deg)}
    .fl-more>summary .st{font-size:12.5px;color:var(--ink2,#9fb0c8)}
    .fl-more>.fields{padding-bottom:12px}
    .fl-tbl{grid-column:1/-1}
    .fl-tbl>summary{cursor:pointer;font-size:13px;color:var(--ink2,#9fb0c8);padding:4px 0}
  `;
  document.head.appendChild(css);
  const onFlights = () => /^#\/flights(\/|$|\?)/.test(location.hash || "");
  const heading = (sec) => ((sec.querySelector("h2") || {}).textContent || "").trim().toLowerCase();

  function fold(fields) {
    if (fields.querySelector(":scope > details.fl-more")) return;
    // The row that holds a field, as a direct child of the form grid
    const pick = (sel) => { let el = fields.querySelector(sel); while (el && el.parentElement !== fields) el = el.parentElement; return el; };
    const parts = [pick("#purpose"), pick("#terrain"), pick("#wxText"), pick("#mc")].filter(Boolean);
    if (!parts.length) return;
    const d = document.createElement("details");
    d.className = "fl-more";
    const inner = document.createElement("div");
    inner.className = "fields";
    const st = [];
    try {
      const f = currentFlight();
      if (f && f.wxText) st.push(f.wxAutoAt ? "live weather loaded" : "your weather pasted");
      if (f && f.terrain) st.push("mountainous");
      if (f && f.purpose && !/^personal$/i.test(f.purpose)) st.push(String(f.purpose).toLowerCase());
    } catch {}
    d.innerHTML = `<summary>More options: purpose, terrain, weather, conditions${st.length ? ` <span class="st">(${st.join(", ")})</span>` : ""}</summary>`;
    d.appendChild(inner);
    fields.appendChild(d);
    for (const p of parts) inner.appendChild(p);
  }

  function table(fields) {
    const t = fields.querySelector(":scope > .full.scroll");
    if (!t || t.closest("details.fl-tbl")) return;
    const n = t.querySelectorAll("tbody tr").length;
    const d = document.createElement("details");
    d.className = "fl-tbl full";
    d.innerHTML = `<summary>Route table${n ? ` (${n} points)` : ""}: names, types, legs, courses and elevations</summary>`;
    t.before(d);
    d.appendChild(t);
  }

  let busy = false;
  function apply() {
    // Tutorial length wording on the welcome box, on every page
    const w = document.getElementById("asWelcome");
    if (w && !w.dataset.len) {
      w.dataset.len = "1";
      for (const el of w.querySelectorAll("p, a")) el.innerHTML = el.innerHTML.replace("Watch the three minute narrated tutorial", "Watch the short narrated tutorial").replace("Play the 3 minute tutorial", "Play the tutorial");
    }
    const tb = document.getElementById("tutTopBtn");
    if (tb && /3 minute/.test(tb.textContent)) tb.textContent = "▶ Play the narrated tutorial";

    if (!onFlights() || busy) return;
    const page = document.querySelector("#view .page");
    if (!page) return;
    busy = true;
    try {
      const secs = [...page.querySelectorAll("section.panel")];
      const route = secs.find((s) => heading(s) === "route");
      const acft = secs.find((s) => heading(s).startsWith("aircraft, time"));
      const prof = secs.find((s) => heading(s) === "profile");
      const proc = page.querySelector("#procPanel"), pref = page.querySelector("#prPanel");
      if (route && acft && route.parentElement === acft.parentElement) {
        if (route.nextElementSibling !== acft) route.after(acft);
        let at = acft;
        for (const el of [prof, proc, pref]) if (el && el.parentElement === acft.parentElement) { if (at.nextElementSibling !== el) at.after(el); at = el; }
      }
      if (acft) { const f = acft.querySelector(":scope > .fields"); if (f) fold(f); }
      if (route) { const f = route.querySelector(":scope > .fields"); if (f) table(f); }
      // A plain message instead of a raw script error when the FAA route data is unreachable
      if (pref) for (const p of pref.querySelectorAll("p")) if (/Could not reach the FAA route data right now\. ./.test(p.textContent)) p.textContent = "Could not reach the FAA preferred route data right now. Try again in a few minutes.";
    } finally { setTimeout(() => (busy = false), 0); }
  }

  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 60); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroFlightsLayout = { apply };
})();
