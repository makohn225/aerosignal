"use strict";
/* p265: logbook summary first (November 14, 2026). The logbook page ran to almost six phone screens. It now opens
   with one card: whether you are current (from the Currency and expirations section, red and amber first, with
   the next date that lapses), three totals (total time, last 90 days, last flight) and buttons to the sections.
   The first time a pilot with a logbook opens the page, the long sections (time by aircraft, aircraft
   inspections, find flights, totals and currency) start folded with their usual Show switch, and the import box
   moves behind "Import or replace". Recent flights stay open. Any section a pilot opens or folds stays that way. */
(function () {
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const on = () => /^#\/logbook(\/|$|\?)/.test(location.hash || "");
  const flights = () => { try { return (S.logbook && S.logbook.flights) || []; } catch (e) { return []; } };
  const fmt1 = (n) => (Math.round(n * 10) / 10).toLocaleString();
  const day = (d) => { const x = new Date(`${d}T12:00:00`); return isNaN(x) ? d : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

  const st = document.createElement("style");
  st.textContent = `
    #lbSum .ls-st{font:700 20px var(--disp,inherit);margin:0 0 6px}
    #lbSum .ls-st.ok{color:#46e39b}#lbSum .ls-st.warn{color:#ffb648}#lbSum .ls-st.bad{color:#ff4d6a}
    #lbSum ul{margin:4px 0 10px 18px;padding:0}#lbSum li{margin:3px 0}
    #lbSum .ls-ro{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 12px}
    #lbSum .ls-ro div{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:12px;padding:8px 10px}
    #lbSum .ls-ro b{display:block;font:700 20px var(--mono,monospace)}#lbSum .ls-ro span{font-size:12px;opacity:.8}
    #lbSum .ls-go{display:flex;flex-wrap:wrap;gap:8px}
    .page.lb-has .lb-imp:not(.lb-imp-open){display:none !important}`;
  document.head.appendChild(st);

  const secByTitle = (pg, re) => [...pg.querySelectorAll(":scope > section.panel")].find((s) => { const t = s.querySelector(":scope > h2"); return t && re.test(t.firstChild && t.firstChild.nodeType === 3 ? t.firstChild.nodeValue : t.textContent); });
  function go(sec) {
    if (!sec) return;
    if (sec.classList.contains("lb-imp")) sec.classList.add("lb-imp-open");
    try { if (sec.classList.contains("pnl-min") && window.AeroPanels) AeroPanels.setMin(sec, false, true); } catch (e) {}
    sec.style.scrollMarginTop = "80px"; sec.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function apply() {
    if (!on()) return;
    const pg = document.querySelector("#view .page"); if (!pg) return;
    const fl = flights(), has = fl.length > 0;
    pg.classList.toggle("lb-has", has);
    const imp = [...pg.querySelectorAll(":scope > section.panel")].find((s) => /Drop your logbook/i.test(s.textContent.slice(0, 200)));
    if (imp && !imp.classList.contains("lb-imp")) imp.classList.add("lb-imp");
    if (!has) { const s = pg.querySelector("#lbSum"); if (s) s.remove(); return; }
    // Fold the long sections once, the first time
    try {
      S.lbFolded = S.lbFolded || {};
      for (const [k, re] of [["tot", /^Totals/], ["cur", /^Currency/], ["ac", /^Time by aircraft/], ["mx", /^Aircraft inspections/], ["find", /^Find flights/]]) {
        if (S.lbFolded[k]) continue;
        const sec = secByTitle(pg, re);
        if (sec && sec.querySelector(":scope > h2 .pnl-tg") && window.AeroPanels) { AeroPanels.setMin(sec, true, true); S.lbFolded[k] = Date.now(); save(); }
      }
    } catch (e) {}
    // Summary
    const cur = pg.querySelector("#curPanel");
    const items = cur ? [...cur.querySelectorAll(".cur-item")].map((i) => ({ cls: i.classList.contains("bad") ? "bad" : i.classList.contains("warn") ? "warn" : i.classList.contains("ok") ? "ok" : "none", t: (i.querySelector("b") || {}).textContent || "", w: (i.querySelector(".when") || {}).textContent || "" })) : [];
    const bad = items.filter((i) => i.cls === "bad"), warn = items.filter((i) => i.cls === "warn"), ok = items.filter((i) => i.cls === "ok");
    const days = (w) => { const m = /(\d+) days?/.exec(w); return m ? +m[1] : 1e9; };
    const next = ok.slice().sort((a, b) => days(a.w) - days(b.w))[0];
    const stCls = bad.length ? "bad" : warn.length ? "warn" : items.length ? "ok" : "";
    const stTxt = bad.length ? `${bad.length} item${bad.length > 1 ? "s have" : " has"} lapsed` : warn.length ? `${warn.length} item${warn.length > 1 ? "s lapse" : " lapses"} within 30 days` : items.length ? "Current on everything tracked" : "Working out currency…";
    const now = Date.now(), d90 = now - 90 * 864e5;
    const total = fl.reduce((s, f) => s + (+f.total || 0), 0), last90 = fl.filter((f) => new Date(`${f.date}T12:00:00`) >= d90).reduce((s, f) => s + (+f.total || 0), 0);
    // Use the Totals section's own figures when it is on the page, so the two always agree
    const roV = (lbl) => { const r = [...pg.querySelectorAll(".readouts .ro")].find((x) => ((x.querySelector(".l") || {}).textContent || "").trim() === lbl); return r ? (r.querySelector(".v") || {}).textContent : null; };
    const totT = roV("Total time") || fmt1(total), l90T = roV("Last 90 days") || fmt1(last90);
    const last = fl.map((f) => f.date).sort().pop();
    const html = `<h2>Your logbook at a glance</h2>
      <p class="ls-st ${stCls}">${h(stTxt)}</p>
      ${[...bad, ...warn].length ? `<ul>${[...bad, ...warn].map((i) => `<li><b>${h(i.t)}</b>: ${h(i.w)}</li>`).join("")}</ul>` : next ? `<p class="small" style="margin:0 0 6px">Next to lapse: <b>${h(next.t)}</b>, ${h(next.w)}.</p>` : ""}
      <div class="ls-ro"><div><b>${h(totT)}</b><span>Total hours</span></div><div><b>${h(l90T)}</b><span>Last 90 days</span></div><div><b style="font-size:15px">${last ? h(day(last)) : "None"}</b><span>Last flight</span></div></div>
      <div class="ls-go"><button type="button" class="btn sec sm" data-go="cur">Currency</button><button type="button" class="btn sec sm" data-go="tot">All totals</button><button type="button" class="btn sec sm" data-go="find">Find flights</button><button type="button" class="btn sec sm" data-go="ac">By aircraft</button><button type="button" class="btn sec sm" data-go="mx">Inspections</button><button type="button" class="btn sec sm" data-go="imp">Import or replace</button></div>
      <p class="small muted" style="margin:10px 0 0">Worked out from your logged entries. Check the regulations and your own records before relying on these.</p>`;
    let s = pg.querySelector(":scope > #lbSum");
    if (!s) {
      s = document.createElement("section"); s.className = "panel"; s.id = "lbSum";
      const lede = pg.querySelector(":scope > .lede") || pg.querySelector(":scope > h1");
      if (lede) lede.after(s); else pg.prepend(s);
      s.addEventListener("click", (e) => {
        const b = e.target.closest("[data-go]"); if (!b) return;
        const k = b.dataset.go, map = { cur: /^Currency/, tot: /^Totals/, find: /^Find flights/, ac: /^Time by aircraft/, mx: /^Aircraft inspections/ };
        go(k === "imp" ? pg.querySelector(":scope > .lb-imp") : secByTitle(pg, map[k]));
      });
    }
    if (s.dataset.v !== html) { s.dataset.v = html; s.innerHTML = html; }
  }
  let t = 0;
  new MutationObserver((l) => { if (!on()) return; if (l.every((m) => m.target.closest && m.target.closest("#lbSum"))) return; clearTimeout(t); t = setTimeout(apply, 250); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(apply, 100));
})();
