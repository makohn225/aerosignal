"use strict";
/* p65: a faster first minute for new pilots. An empty Maps page offers a way in instead of a
   blank chart, and the plan reader's summary reads "An IFR flight". */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #mpEmpty{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
  `;
  document.head.appendChild(css);
  const on = (h) => (location.hash || "").startsWith(h);

  function maps() {
    if (document.getElementById("mpEmpty")) return;
    const msg = [...document.querySelectorAll("#view .hzempty, #view p, #view div")].find((e) => e.children.length < 3 && /^No route loaded\./.test((e.textContent || "").trim()));
    if (!msg) return;
    const d = document.createElement("div");
    d.id = "mpEmpty";
    d.innerHTML = `<a class="btn sm" href="#/plan">Plan a flight</a><a class="btn sec sm" href="#/demo">Load the sample pilot</a>`;
    if (msg.tagName === "LI") msg.appendChild(d); else msg.after(d);
  }

  // Grammar in the plan reader's summary
  function grammar() {
    const out = document.getElementById("qOut");
    if (!out) return;
    const w = document.createTreeWalker(out, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/\bA (IFR|MVFR)\b/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/\bA (IFR|MVFR)\b/g, "An $1");
  }

  let t = 0;
  const run = () => { clearTimeout(t); t = setTimeout(() => { try { if (on("#/plan")) grammar(); if (on("#/maps")) maps(); } catch (e) { console.error(e); } }, 80); };
  new MutationObserver(run).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", run);
  run();

  /* One floating button on phones. Where the Ask button shows, the Feedback button steps aside
     and the Ask panel carries a feedback link instead, so the two never stack over the page. */
  const css2 = document.createElement("style");
  css2.textContent = `
    @media (max-width:860px){body.ask-on #fbFab{display:none!important}}
    #askPanel .af a.fbl{margin-left:auto;margin-right:10px;font-size:12.5px;color:#3DE0FF;white-space:nowrap}
  `;
  document.head.appendChild(css2);
  function fabs() {
    const fab = document.getElementById("askFab"), pan = document.getElementById("askPanel");
    document.body.classList.toggle("ask-on", !!((fab && !fab.hidden) || (pan && !pan.hidden)));
    const af = pan && pan.querySelector(".af");
    if (af && !af.querySelector("a.fbl")) {
      const a = document.createElement("a");
      a.className = "fbl"; a.href = "#/feedback"; a.textContent = "Send feedback";
      a.onclick = () => { pan.hidden = true; };
      af.insertBefore(a, af.querySelector('[data-a="undo"]'));
    }
  }
  new MutationObserver(fabs).observe(document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true, childList: true });
  window.addEventListener("hashchange", () => setTimeout(fabs, 50));
  fabs();

  /* Hide any section the pilot does not need. Each panel heading gets a Hide or Show switch,
     remembered per page and section. The debrief starts hidden until the flight is flown.
     A jump from the bottom line or the section chips opens a hidden section, and the narrated
     tutorial always shows everything. */
  const css3 = document.createElement("style");
  css3.textContent = `
    .pnl-h{display:flex;align-items:center;gap:8px}
    .pnl-tg{margin-left:auto;flex:none;appearance:none;border:1px solid var(--line2,rgba(255,255,255,.16));background:transparent;color:var(--ink2,#9fb0c8);font:600 11px var(--disp,inherit);letter-spacing:1px;text-transform:uppercase;border-radius:999px;padding:3px 9px;cursor:pointer}
    .pnl-tg:hover{color:#3DE0FF;border-color:#3DE0FF}
    .pnl-tg::after{content:" ▾"}
    body:not(.tut) section.pnl-min > :not(h2){display:none!important}
    body:not(.tut) section.pnl-min{padding-bottom:12px}
    section.pnl-min .pnl-tg::after{content:" ▸"}
    body.tut .pnl-tg{display:none}
  `;
  document.head.appendChild(css3);
  const PAGES = /^#\/(brief|flights|logbook|missions)(\/|$)/;
  const pageKey = () => ((location.hash || "").split("/")[1] || "");
  const keyOf = (sec, h2) => `${pageKey()}:${sec.id || ""}:${(h2.firstChild && h2.firstChild.nodeType === 3 ? h2.firstChild.nodeValue : h2.textContent).trim().toLowerCase().slice(0, 40)}`;
  const store = () => { try { return (S.uiMin = S.uiMin || {}); } catch { return {}; } };
  function flown() { try { const f = currentFlight(); const d = new Date(`${f.date}T${f.time || "12:00"}:00`); return !isNaN(d) && Date.now() - d > 60 * 60e3; } catch { return true; } }
  function setMin(sec, on, keep) {
    sec.classList.toggle("pnl-min", on);
    const b = sec.querySelector(":scope > h2 .pnl-tg");
    if (b) { b.textContent = on ? "Show" : "Hide"; b.setAttribute("aria-expanded", String(!on)); }
    if (keep) { const h2 = sec.querySelector(":scope > h2"); store()[keyOf(sec, h2)] = on; try { save(); } catch {} }
  }
  function panels() {
    if (!PAGES.test(location.hash || "")) return;
    for (const sec of document.querySelectorAll("#view section.panel")) {
      const h2 = sec.querySelector(":scope > h2");
      if (!h2 || h2.querySelector(".pnl-tg") || sec.id === "asWelcome") continue;
      h2.classList.add("pnl-h");
      const b = document.createElement("button");
      b.type = "button"; b.className = "pnl-tg";
      b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setMin(sec, !sec.classList.contains("pnl-min"), true); };
      h2.appendChild(b);
      const saved = store()[keyOf(sec, h2)];
      const def = sec.id === "dbPanel" && !flown() && !(sec.querySelector(".saved"));
      setMin(sec, saved === undefined ? def : !!saved, false);
    }
  }
  // A jump from the bottom line or a section chip opens the section it points at
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target;
      if (!el.classList || !el.classList.contains("bf-flash")) continue;
      const sec = el.closest("section.pnl-min");
      if (sec) setMin(sec, false, true);
    }
  }).observe(document.getElementById("view") || document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
  let t3 = 0;
  const kick3 = () => { clearTimeout(t3); t3 = setTimeout(() => { try { panels(); } catch (e) { console.error(e); } }, 90); };
  new MutationObserver(kick3).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick3);
  kick3();
  window.AeroPanels = { setMin };
})();
