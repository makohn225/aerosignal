"use strict";
/* p62: the brief opens with the bottom line. A short card at the top lists the few things worth
   briefing for this flight (currency gaps, the top accident patterns for this pilot and airplane,
   conditions like a night arrival, active TFRs), each with a jump to the detail. The matched
   accident lessons move up under the risk score, a row of chips jumps to each section, and long
   lists of military narratives fold to the most relevant one. Everything is read from what the
   brief page already shows, so nothing new is fetched and nothing leaves the browser. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #bfBluf{margin:12px 0 14px;padding:14px 16px 12px;border-radius:14px;border:1px solid rgba(61,224,255,.45);background:linear-gradient(180deg,rgba(61,224,255,.08),rgba(61,224,255,.02))}
    #bfBluf .k{font:700 11px var(--disp,inherit);letter-spacing:2px;text-transform:uppercase;color:#3DE0FF;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    #bfBluf .lvl{font:700 11px var(--mono,monospace);letter-spacing:.06em;padding:2px 8px;border-radius:999px;border:1px solid currentColor}
    #bfBluf .lvl.low{color:#46e39b}#bfBluf .lvl.med,#bfBluf .lvl.medium{color:#ffb547}#bfBluf .lvl.high{color:#ff4d6a}
    #bfBluf ol{margin:10px 0 4px;padding:0;list-style:none;counter-reset:b}
    #bfBluf li{counter-increment:b;display:grid;grid-template-columns:26px 1fr;gap:2px 8px;padding:8px 0;border-top:1px solid rgba(255,255,255,.07)}
    #bfBluf li:first-child{border-top:0}
    #bfBluf li::before{content:counter(b);grid-row:span 2;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 12px var(--mono,monospace);background:rgba(61,224,255,.14);color:#3DE0FF;margin-top:1px}
    #bfBluf li.warn::before{background:rgba(255,181,71,.16);color:#ffb547}
    #bfBluf li.crit::before{background:rgba(255,77,106,.16);color:#ff4d6a}
    #bfBluf li b{font-size:15px;line-height:1.35}
    #bfBluf li span{font-size:13.5px;line-height:1.45;color:var(--ink2,#9fb0c8)}
    #bfBluf li a{color:#3DE0FF;white-space:nowrap}
    #bfBluf .ok{font-size:14px;color:var(--ink2,#9fb0c8);margin:8px 0 2px}
    #bfBluf .ft{font-size:11.5px;color:var(--ink2,#9fb0c8);margin-top:6px}
    #bfJump{display:flex;gap:6px;overflow-x:auto;margin:0 0 12px;padding-bottom:2px;scrollbar-width:none}
    #bfJump::-webkit-scrollbar{display:none}
    #bfJump a{flex:none;font-size:12.5px;padding:5px 10px;border-radius:999px;border:1px solid var(--line2,rgba(255,255,255,.16));color:var(--ink,#EAF2FF);text-decoration:none;white-space:nowrap}
    #bfJump a:hover{border-color:#3DE0FF;color:#3DE0FF}
    .bf-anchor{scroll-margin-top:84px}
    .bf-flash{animation:bfFlash 1.6s ease-out 1}
    @keyframes bfFlash{0%{box-shadow:0 0 0 3px rgba(61,224,255,.8)}100%{box-shadow:0 0 0 3px rgba(61,224,255,0)}}
    .mn-more{margin-top:8px}
  `;
  document.head.appendChild(css);

  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const first = (s) => { const m = String(s || "").match(/^.*?[.!?](\s|$)/); return (m ? m[0] : String(s || "")).trim(); };
  const onBrief = () => /^#\/brief(\/|$|\?)/.test(location.hash || "");

  function jump(el) {
    if (!el) return;
    const d = el.closest("details"); if (d) d.open = true;
    el.classList.add("bf-anchor");
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.classList.remove("bf-flash"); void el.offsetWidth; el.classList.add("bf-flash");
  }

  function items(page) {
    const out = [];
    // Currency gaps come first: they can make the flight illegal, not just riskier
    const cur = page.querySelector(".cur-alert");
    if (cur) for (const li of cur.querySelectorAll("li")) out.push({ cls: "crit", t: txt(li), s: "Sort this out before you go.", el: cur });
    // A lesson the pilot wrote after an earlier flight like this one
    const mine = page.querySelector("#dbPast li");
    if (mine) out.push({ cls: "", t: "Your own lesson: " + (mine.dataset.lesson || txt(mine.firstElementChild)), s: txt(mine.querySelector(".m")) + ".", el: page.querySelector("#dbLessons") });
    // The top accident patterns matched to this pilot, airplane and route
    const its = [...page.querySelectorAll("#bbody .item")].filter((x) => x.querySelector("h4"));
    its.sort((a, b) => (b.querySelector(".stats strong") ? 1 : 0) - (a.querySelector(".stats strong") ? 1 : 0));
    for (const it of its.slice(0, 2)) {
      const phase = txt(it.closest(".phase") && it.closest(".phase").querySelector("h3"));
      const why = txt(it.querySelector(".why"));
      out.push({ cls: it.querySelector(".stats strong") ? "warn" : "", t: txt(it.querySelector("h4")) + (phase ? ` (${phase.toLowerCase()})` : ""), s: first(txt(it.querySelector(".watch"))) + (/\b(hrs?|hours?|days?|landings?|approaches|months?|flights?)\b/i.test(why) ? ` Your numbers: ${why}.` : ""), el: it });
    }
    // Conditions the brief flagged for this flight, such as a night arrival
    const pills = [...page.querySelectorAll(".bhead .pill")].map(txt).filter(Boolean);
    if (pills.length) out.push({ cls: "warn", t: pills.join(", "), s: "Flagged from your departure time, route and conditions.", el: page.querySelector(".bhead") });
    // Active restrictions near the route
    const tfr = page.querySelector("#tfrPanel");
    if (tfr && !/No TFRs found/i.test(txt(tfr)) && tfr.querySelector("li, .tfr, tr")) out.push({ cls: "crit", t: "Temporary flight restrictions near your route", s: "Check the times and altitudes against your plan.", el: tfr });
    // Personal minimums, once weather is loaded
    const pm = page.querySelector("#pmPanel");
    if (pm && /below|outside|exceed|not met/i.test(txt(pm)) && !/No weather loaded/i.test(txt(pm))) out.push({ cls: "crit", t: "Weather is outside your personal minimums", s: "Look at the details before you commit.", el: pm });
    // The flight is over and not debriefed yet
    const db = page.querySelector("#dbPanel");
    if (db && db.querySelector("#dbLesson") && /Done flying/.test(txt(db))) out.push({ cls: "", t: "Debrief this flight while it is fresh", s: "Two minutes, and the next brief carries the lesson forward.", el: db });
    return out.slice(0, 5);
  }

  function risk(page) {
    const chip = page.querySelector("a.frat-chip");
    if (!chip) return "";
    const n = txt(chip.querySelector("b"));
    const lvl = (txt(chip).match(/\b(LOW|MEDIUM|MED|HIGH)\b/) || [])[1] || "";
    return lvl ? `<a class="lvl ${lvl.toLowerCase()}" href="#/frat" title="Open the risk assessment">Risk ${h(n)} ${h(lvl)}</a>` : "";
  }

  function card(page) {
    let c = page.querySelector("#bfBluf");
    const list = items(page);
    const sig = JSON.stringify(list.map((x) => x.t)) + risk(page);
    if (c && c.dataset.sig === sig) return c;
    if (!c) { c = document.createElement("section"); c.id = "bfBluf"; c.setAttribute("aria-label", "Bottom line for this flight"); }
    c.dataset.sig = sig;
    const loading = !page.querySelector("#bbody .item, #bbody .phase") && !/Matches come from/.test(txt(page.querySelector("#bbody")));
    c.innerHTML = `<div class="k">Bottom line for this flight ${risk(page)}</div>
      ${list.length ? `<ol>${list.map((x, i) => `<li class="${x.cls}"><b>${h(x.t)}</b><span>${h(x.s)} <a href="#" data-i="${i}">Details</a></span></li>`).join("")}</ol>`
        : `<p class="ok">${loading ? "Reading the accident record for this flight…" : "Nothing stands out for this flight from your logbook and the accident record. Still get a full official briefing."}</p>`}
      <div class="ft">A decision aid built from your data and public records. Not an official briefing.</div>`;
    c.querySelectorAll("a[data-i]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); jump(list[+a.dataset.i].el); }));
    return c;
  }

  function jumps(page) {
    const want = [["#bbody", "Accident lessons"], ["#dbLessons", "Your lessons"], ["#dbPanel", "Debrief"], ["#tfrPanel", "TFRs"], ["#pmPanel", "Minimums"], ["#waPanel", "Winds"], ["#mnPanel", "Military mishaps"], ["#pkPanel", "Print"]];
    const have = want.filter(([s]) => page.querySelector(s));
    let j = page.querySelector("#bfJump");
    const sig = have.map((x) => x[0]).join();
    if (j && j.dataset.sig === sig) return j;
    if (!j) { j = document.createElement("nav"); j.id = "bfJump"; j.setAttribute("aria-label", "Brief sections"); }
    j.dataset.sig = sig;
    j.innerHTML = have.map(([s, l]) => `<a href="#" data-s="${s}">${l}</a>`).join("");
    j.querySelectorAll("a").forEach((a) => (a.onclick = (e) => { e.preventDefault(); jump(page.querySelector(a.dataset.s)); }));
    return j;
  }

  // Fold a long list of military narratives to the most relevant one
  function fold(page) {
    const list = page.querySelector("#mnPanel .mn-list");
    if (!list || list.dataset.bfFold) return;
    const cards = [...list.querySelectorAll(":scope > .mn-card")];
    if (cards.length < 2) return;
    list.dataset.bfFold = "1";
    cards.slice(1).forEach((c) => (c.hidden = true));
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn sec sm mn-more";
    b.textContent = `Show ${cards.length - 1} more`;
    b.onclick = () => { cards.forEach((c) => (c.hidden = false)); b.remove(); };
    list.after(b);
  }

  let busy = false;
  function apply() {
    if (!onBrief() || busy) return;
    const page = document.querySelector("#view .page");
    const h1 = page && page.querySelector(":scope > h1");
    if (!h1) return;
    busy = true;
    try {
      const military = (() => { try { const f = currentFlight(); return !!(f && f.missionId); } catch { return false; } })();
      const c = card(page), j = jumps(page);
      if (h1.nextElementSibling !== c) h1.after(c);
      if (c.nextElementSibling !== j) c.after(j);
      // Risk score and currency right under the bottom line, then the accident lessons
      const chip = page.querySelector(":scope > a.frat-chip"), cur = page.querySelector(":scope > .cur-alert");
      let at = j;
      for (const el of [chip, cur]) if (el) { if (at.nextElementSibling !== el) at.after(el); at = el; }
      const block = [page.querySelector(":scope > #dbLessons"), page.querySelector(":scope > p.lede"), page.querySelector(":scope > .strip"), page.querySelector(":scope > .bhead"), page.querySelector(":scope > #bbody"), page.querySelector(":scope > #dbPanel")].filter(Boolean);
      if (page.querySelector(":scope > #bbody")) {
        for (const el of block) { if (at.nextElementSibling !== el) at.after(el); at = el; }
      }
      // For a civil flight the military narratives go last; for a mission they stay near the top
      const mn = page.querySelector(":scope > #mnPanel");
      if (mn && !military && page.lastElementChild !== mn) page.appendChild(mn);
      fold(page);
    } finally { setTimeout(() => (busy = false), 0); }
  }

  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 120); };
  new MutationObserver(() => { if (onBrief() && !busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroBriefBluf = { apply };
})();
