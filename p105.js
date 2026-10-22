"use strict";
/* p105: a brief that fits on a couple of screens. Every section on the flight brief (except the accident
   lessons) opens folded to its title plus a one line summary: runway winds, NOTAMs, airspace and the
   other sections reuse their bottom line wording, the checklist shows how many items are checked, and
   the rest show their first sentence. Tap the title (or Show) to open a section. A section the pilot has
   opened or folded by hand keeps that choice (p65 remembers it). */
(function () {
  const LINE = { rwPanel: "bf-rw", ntPanel: "bf-nt", advPanel: "bf-adv", asPanel: "bf-as", wbPanel: "bf-wbf", lcPanel: "bf-lc", llPanel: "bf-ll", dvPanel: "bf-dv", pfPanel: "bf-pf" };
  const css = document.createElement("style");
  css.textContent = `
    #view .page > section.panel > h2 .pv-sum{display:none}
    #view .page > section.panel.pnl-min > h2 .pv-sum{display:block;flex-basis:100%;order:9;margin:4px 0 0;font:400 13px/1.4 var(--body,system-ui);letter-spacing:0;text-transform:none;color:var(--ink2,#9db2ce)}
    #view .page > section.panel.pnl-min > h2 .pv-sum .bad,#view .page > section.panel.pnl-min > h2 .pv-sum b.bad{color:#ff4d6a}
    #view .page > section.panel.pnl-min > h2 .pv-sum .warn,#view .page > section.panel.pnl-min > h2 .pv-sum b.warn{color:#ffb648}
    #view .page > section.panel.pnl-min > h2 .pv-sum .ok{color:#46e39b}
    body.pv-on #view .page > section.panel.pnl-min > h2{flex-wrap:wrap;cursor:pointer}
    body.pv-on #view .page > section.panel.pnl-min{padding-top:12px;padding-bottom:12px}
    body.pv-on #bfBluf:not(.pv-all) ol > li.pv-more{display:none}
    #bfBluf .pv-olt{appearance:none;background:transparent;border:0;color:var(--cyan,#3DE0FF);text-decoration:underline;cursor:pointer;font:13px var(--body,system-ui);padding:0;margin:2px 0 6px}
  `;
  document.head.appendChild(css);
  const done = new Set();
  const userSet = (id) => { try { return Object.keys(S.uiMin || {}).some((k) => k.includes(`:${id}:`)); } catch { return false; } };
  const clean = (html) => html.replace(/<a [^>]*>[^<]*<\/a>/g, "").replace(/<button[\s\S]*?<\/button>/g, "").replace(/^\s*[A-Za-z ]+:\s*/, "").replace(/\.\s*$/, "").trim();
  function firstSentence(sec) {
    const p = [...sec.querySelectorAll(":scope > p, :scope > div > p, :scope > .small, :scope p.small")].find((x) => x.textContent.trim().length > 8);
    if (!p) return "";
    const t = p.textContent.trim().replace(/\s+/g, " ");
    const m = t.match(/^(.{20,160}?[.!?])(\s|$)/);
    return (m ? m[1] : t.slice(0, 140) + (t.length > 140 ? "…" : "")).replace(/[<>&]/g, "");
  }
  function summary(sec, card) {
    const id = sec.id;
    if (LINE[id] && card) { const l = card.querySelector("." + LINE[id]); if (l) return clean(l.innerHTML); }
    if (id === "pmPanel") {
      const m = sec.textContent.replace(/\s+/g, " ").match(/(\d+ items? (is|are) outside your personal minimums|Everything checked is within your personal minimums|Once weather is loaded[^.]*)/i);
      if (m) return m[1].replace(/^(\d+ items? (is|are) outside)/i, '<span class="bad">$1</span>');
    }
    if (id === "goPanel") {
      const boxes = sec.querySelectorAll('input[type="checkbox"]');
      if (boxes.length) return `${[...boxes].filter((b) => b.checked).length} of ${boxes.length} items checked`;
    }
    return firstSentence(sec);
  }
  let busy = false, t = 0;
  function apply() {
    const on = /^#\/brief(\/|$|\?)/.test(location.hash || "");
    document.body.classList.toggle("pv-on", on);
    if (busy || !on || !window.AeroPanels) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId) return;
    busy = true;
    try {
      const card = page.querySelector("#bfBluf");
      // Bottom line ranked items: the top three, the rest one tap away
      const ol = card && card.querySelector(":scope > ol");
      if (ol) {
        const lis = [...ol.children];
        lis.forEach((li, i) => li.classList.toggle("pv-more", i >= 3));
        let b = card.querySelector(":scope > .pv-olt");
        if (lis.length > 3) {
          if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "pv-olt"; b.onclick = () => { card.classList.toggle("pv-all"); b.dataset.v = ""; kick(); }; }
          if (ol.nextElementSibling !== b) ol.after(b);
          const txt = card.classList.contains("pv-all") ? "Show the top 3" : `${lis.length - 3} more item${lis.length - 3 === 1 ? "" : "s"}`;
          if (b.textContent !== txt) b.textContent = txt;
        } else if (b) b.remove();
      }
      for (const sec of page.querySelectorAll(":scope > section.panel")) {
        const h2 = sec.querySelector(":scope > h2");
        if (!sec.id || sec.id === "bbody" || !h2 || !h2.querySelector(".pnl-tg")) continue;
        const key = `${f.id}|${sec.id}`;
        if (!done.has(key)) {
          done.add(key);
          if (!userSet(sec.id) && !sec.classList.contains("br-open") && !sec.classList.contains("pnl-min")) AeroPanels.setMin(sec, true, false);
        }
        if (!h2.dataset.pv) {
          h2.dataset.pv = "1";
          h2.addEventListener("click", (e) => { if (e.target.closest(".pnl-tg, a, button")) return; if (sec.classList.contains("pnl-min")) { const b = h2.querySelector(".pnl-tg"); if (b) b.click(); } });
        }
        let s = h2.querySelector(".pv-sum");
        const html = summary(sec, card);
        if (!html) { if (s) s.remove(); continue; }
        if (!s) { s = document.createElement("span"); s.className = "pv-sum"; h2.appendChild(s); }
        if (s.dataset.v !== html) { s.dataset.v = html; s.innerHTML = html; }
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  let first = 0;
  // Debounce, but never wait more than 1.5 s while the page keeps changing
  const kick = () => { clearTimeout(t); const now = Date.now(); if (!first) first = now; const wait = Math.max(0, Math.min(450, 1500 - (now - first))); t = setTimeout(() => { first = 0; apply(); }, wait); };
  new MutationObserver((l) => { if (busy) return; if (l.every((m) => m.target.closest && m.target.closest("h2 .pv-sum, #bfBluf .pv-olt"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
