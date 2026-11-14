"use strict";
/* p267: shorter Flights list and risk assessment (November 14, 2026).
   1. Saved flights: flights from today on come first, soonest first. Older ones fold under one line per month ("October 2026,
      5 flights"), one tap to open. The flight you have open always shows.
   2. Risk assessment: the score, what Vigilyn worked out and the questions only you can answer stay as they are.
      Past assessments, the unit summary and operator settings fold under one "Records and settings" switch.
   Also in this pass: newer More panels are placed in their groups (p103). */
(function () {
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const openMonths = new Set();
  const st = document.createElement("style");
  st.textContent = `
    #flist li.fg-x{display:none !important}
    #flist li.fg-h{list-style:none;margin:10px 0 4px}
    #flist li.fg-h button{appearance:none;width:100%;text-align:left;background:transparent;border:0;border-top:1px solid var(--line,rgba(255,255,255,.1));color:inherit;padding:10px 2px;font:600 13px var(--disp,inherit);letter-spacing:1px;text-transform:uppercase;cursor:pointer;display:flex;justify-content:space-between}
    #flist li.fg-h button span{opacity:.75;text-transform:none;letter-spacing:0;font-weight:500}
    .page.fr-short > .fr-x{display:none !important}
    #frMore{margin:6px 0 16px}`;
  document.head.appendChild(st);

  /* 1. Flights list */
  const monthOf = (d) => { const x = new Date(`${d}T12:00:00`); return isNaN(x) ? "Undated" : x.toLocaleDateString("en-US", { month: "long", year: "numeric" }); };
  function flights() {
    const ul = document.getElementById("flist"); if (!ul) return;
    const today = new Date(); const t0 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const items = [...ul.querySelectorAll(":scope > li:not(.fg-h)")];
    if (items.length < 6) { ul.querySelectorAll(":scope > li.fg-h").forEach((x) => x.remove()); items.forEach((li) => li.classList.remove("fg-x")); return; }
    const rows = items.map((li) => { const m = /(\d{4}-\d{2}-\d{2})/.exec(li.textContent); return { li, d: m ? m[1] : "", on: !!li.querySelector(".on") }; });
    const past = rows.filter((r) => r.d && r.d < t0);
    const groups = new Map();
    for (const r of past) { const k = monthOf(r.d); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    const sig = [...groups].map(([k, v]) => k + v.length).join("|") + [...openMonths].join(",");
    if (ul.dataset.fg === sig && ul.querySelector(".fg-h")) return;
    ul.dataset.fg = sig;
    ul.querySelectorAll(":scope > li.fg-h").forEach((x) => x.remove());
    // Upcoming (and undated) first, in their existing order, then each past month newest first
    const upcoming = rows.filter((r) => !past.includes(r)).sort((a, b) => (a.d || "9") < (b.d || "9") ? -1 : (a.d || "9") > (b.d || "9") ? 1 : 0);
    for (const r of upcoming) { r.li.classList.remove("fg-x"); ul.appendChild(r.li); }
    const keys = [...groups.keys()].sort((a, b) => (groups.get(b)[0].d > groups.get(a)[0].d ? 1 : -1));
    for (const k of keys) {
      const rs = groups.get(k).sort((a, b) => (a.d < b.d ? 1 : -1));
      const open = openMonths.has(k);
      const hd = document.createElement("li"); hd.className = "fg-h";
      hd.innerHTML = `<button type="button" aria-expanded="${open}">${h(k)} <span>${rs.length} flight${rs.length > 1 ? "s" : ""} ${open ? "▾" : "▸"}</span></button>`;
      hd.querySelector("button").onclick = () => { open ? openMonths.delete(k) : openMonths.add(k); ul.dataset.fg = ""; flights(); };
      ul.appendChild(hd);
      for (const r of rs) { r.li.classList.toggle("fg-x", !open && !r.on); ul.appendChild(r.li); }
    }
  }

  /* 2. Risk assessment */
  let frOpen = false;
  function frat() {
    const pg = document.querySelector("#view .page"); if (!pg) return;
    const extra = [...pg.querySelectorAll(":scope > section.panel")].filter((s) => s.id === "ruPanel" || /^(Past assessments|Operator settings)/i.test(((s.querySelector("h2") || {}).textContent || "").trim()));
    if (!extra.length) return;
    extra.forEach((s) => s.classList.add("fr-x"));
    pg.classList.toggle("fr-short", !frOpen);
    let b = pg.querySelector(":scope > #frMore");
    if (!b) { b = document.createElement("div"); b.id = "frMore"; b.innerHTML = `<button type="button" class="btn sec sm"></button>`; b.querySelector("button").onclick = () => { frOpen = !frOpen; frat(); }; }
    const first = extra[0];
    if (b.nextElementSibling !== first) first.before(b);
    const t = frOpen ? "Hide records and settings" : `Records and settings (${extra.length})`;
    const btn = b.querySelector("button"); if (btn.textContent !== t) btn.textContent = t;
  }

  let t = 0;
  const run = () => { clearTimeout(t); t = setTimeout(() => { try { const hs = location.hash || ""; if (/^#\/flights(\/|$|\?)/.test(hs)) flights(); if (/^#\/frat(\/|$|\?)/.test(hs)) frat(); } catch (e) { console.error(e); } }, 150); };
  new MutationObserver((l) => { if (l.every((m) => m.target.closest && m.target.closest(".fg-h,#frMore"))) return; run(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", run);
})();
