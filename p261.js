"use strict";
/* p261: Quick brief (November 14, 2026). The brief has grown to more than 30 sections, which is a lot to take in
   for a new pilot or a quick look before a local flight. The brief now opens in a Quick view: the bottom line, the
   accident lessons for each phase of flight, a "Needs a look" list of any section whose one line summary flags
   something, and the decision points. Every other section is still built, and the Full brief is one tap away on the
   switch at the top, or from any flagged item, which opens the full brief at that section. The choice is
   remembered on this device. Nothing about how any section works changes; Quick only hides what is not flagged.
   This switch replaces p88's Essentials switch in the jump bar: Full now shows every section (S.briefAll). */
(function () {
  const KEY = "vg_brief_mode";
  const mode = () => { try { return localStorage.getItem(KEY) || "quick"; } catch (e) { return "quick"; } };
  const setMode = (m) => { try { localStorage.setItem(KEY, m); } catch (e) {} };
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const FLAG = ".warn,.bad,.nogo,.red,.amber,.caution,.crit,.IFR,.LIFR,.MVFR,.no,.over";
  // scShare and rvMine: a student's Share with my school box and the instructor's review (p134, p165) stay in Quick
  const KEEP = ["qkBar", "qkFlags", "qkMore", "qkDisc", "bfBluf", "dpPanel", "bbody", "sbNote", "scShare", "rvMine", "fpAsk"];

  const st = document.createElement("style");
  st.textContent = `
    #qkBar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0 14px}
    #qkBar .qk-seg{display:inline-flex;border:1px solid var(--line2,rgba(255,255,255,.18));border-radius:999px;padding:3px}
    #qkBar .qk-seg button{appearance:none;border:0;background:transparent;color:inherit;font:600 14px var(--body,system-ui);padding:8px 16px;border-radius:999px;cursor:pointer;min-height:36px}
    #qkBar .qk-seg button[aria-pressed="true"]{background:var(--accent,#3DE0FF);color:#06121F}
    #qkBar .qk-n{font-size:13px;opacity:.75}
    #qkFlags .qk-row{display:block;width:100%;text-align:left;appearance:none;background:transparent;color:inherit;border:0;border-top:1px solid var(--line,rgba(255,255,255,.1));padding:10px 0;cursor:pointer;font:inherit}
    #qkFlags .qk-row:first-of-type{border-top:0}
    #qkFlags .qk-row b{display:block;font-size:15px}
    #qkFlags .qk-row span{display:block;font-size:14px;opacity:.9;margin-top:2px}
    #qkFlags .qk-row:after{content:"Open in full brief \\203A";display:block;font-size:12px;opacity:.65;margin-top:3px}
    #bfJump .br-tg{display:none !important}
    #qkDisc{color:#ff4d6a;font-weight:700;font-size:14px;margin:6px 0 14px}
    .page.qk > *:not(h1):not(#${KEEP.join("):not(#")}):not(.frat-chip):not(.lede):not(.strip):not(.bhead):not(.qk-pin-on){display:none !important}
    .page.qk > .qk-pin-on{order:12}.page.qk > #fpAsk{order:6}
    .page.qk #bbody > details,.page.qk #bbody .item.low,.page.qk #bbody .item .why{display:none !important}
    .page.qk{display:flex;flex-direction:column}
    .page.qk > h1{order:1}.page.qk > #sbNote{order:2}.page.qk > #bfBluf{order:3}.page.qk > #qkBar{order:4}.page.qk > #qkDisc{order:5}.page.qk > #qkFlags{order:6}
    .page.qk > .frat-chip{order:7;align-self:flex-start}.page.qk > .lede{order:8}.page.qk > .strip{order:9}.page.qk > .bhead{order:10}.page.qk > #bbody{order:11}.page.qk > #dpPanel{order:12}.page.qk > #scShare{order:13}.page.qk > #rvMine{order:14}.page.qk > #qkMore{order:15}
    .page:not(.qk) #qkFlags,.page:not(.qk) #qkMore,.page:not(.qk) #qkDisc{display:none !important}`;
  document.head.appendChild(st);

  const isBrief = () => /^#\/brief(\/|$|\?)/.test(location.hash || "");
  const page = () => document.querySelector("#view .page");
  const titleOf = (s) => { const t = s.querySelector("h2"); if (!t) return ""; const c = t.cloneNode(true); c.querySelectorAll("button,.pv-sum").forEach((x) => x.remove()); return c.textContent.trim(); };

  function flagged(pg) {
    const out = [];
    for (const s of pg.querySelectorAll(":scope > section.panel")) {
      if (KEEP.includes(s.id) || !s.id || s.classList.contains("qk-pin-on")) continue;   // pinned ones (p263) already show
      const sum = s.querySelector(".pv-sum");
      if (sum && sum.querySelector(FLAG)) out.push({ id: s.id, t: titleOf(s), sum: sum.textContent.trim() });
    }
    return out;
  }
  function jump(id) {
    const pg = page(); if (!pg) return;
    apply("full");
    const s = document.getElementById(id); if (!s) return;
    try { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); } catch (e) {}
    s.style.scrollMarginTop = "84px";
    requestAnimationFrame(() => s.scrollIntoView({ block: "start", behavior: "smooth" }));
  }
  function apply(m) {
    setMode(m);
    // Full means every section: p88's older Essentials fold (and its switch in the jump bar) is replaced by this switch
    if (m === "full") try { if (!S.briefAll) { S.briefAll = true; save(); } } catch (e) {}
    const pg = page(); if (!pg) return;
    pg.classList.toggle("qk", m === "quick");
    pg.querySelectorAll("#qkBar [data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
    if (m === "quick") { const dp = pg.querySelector(":scope > #dpPanel"); if (dp && dp.classList.contains("pnl-min") && window.AeroPanels) try { AeroPanels.setMin(dp, false, true); } catch (e) {} }
    paint();
  }
  let lastSig = "";
  function paint() {
    const pg = page(); if (!pg || !isBrief()) return;
    const bl = pg.querySelector(":scope > #bfBluf"); if (!bl) return;
    let bar = pg.querySelector(":scope > #qkBar");
    if (!bar) {
      bar = document.createElement("div"); bar.id = "qkBar";
      bar.innerHTML = `<div class="qk-seg" role="group" aria-label="Brief view"><button type="button" data-m="quick">Quick brief</button><button type="button" data-m="full">Full brief</button></div><span class="qk-n"></span>`;
      bar.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => { apply(b.dataset.m); if (b.dataset.m === "full") bl.scrollIntoView({ block: "start" }); });
      (pg.querySelector(":scope > #bfJump") || bl).after(bar);
      const d = document.createElement("p"); d.id = "qkDisc"; d.textContent = "Planning aid only. Not for navigation. Pilots must verify everything against official sources.";
      bar.after(d);
      pg.classList.toggle("qk", mode() === "quick");
      // p88's Essentials fold is superseded by Quick (and would hide pinned sections), so it is always off now
      try { if (!S.briefAll) { S.briefAll = true; save(); } } catch (e) {}
      bar.querySelectorAll("[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === mode())));
      if (mode() === "quick") setTimeout(() => { const dp = pg.querySelector(":scope > #dpPanel"); if (dp && dp.classList.contains("pnl-min") && window.AeroPanels) try { AeroPanels.setMin(dp, false, true); } catch (e) {} }, 0);
    }
    const dp = pg.querySelector(":scope > #dpPanel");
    if (dp && pg.classList.contains("qk") && !dp.dataset.qk && dp.querySelector(".pnl-tg")) { dp.dataset.qk = "1"; if (dp.classList.contains("pnl-min") && window.AeroPanels) try { AeroPanels.setMin(dp, false, true); } catch (e) {} }
    const total = pg.querySelectorAll(":scope > section.panel:not(#qkFlags)").length;
    const fl = flagged(pg);
    const sig = fl.map((f) => f.id + f.sum).join("|") + total;
    const n = bar.querySelector(".qk-n"), nt = pg.classList.contains("qk") ? `Showing the essentials. ${total} sections in the full brief.` : "";
    if (n.textContent !== nt) n.textContent = nt;
    let box = pg.querySelector(":scope > #qkFlags");
    if (!box) { box = document.createElement("section"); box.className = "panel"; box.id = "qkFlags"; (pg.querySelector(":scope > #qkDisc") || bar).after(box); lastSig = ""; }
    if (sig !== lastSig) {
      lastSig = sig;
      box.innerHTML = `<div><h2>Needs a look</h2>${fl.length ? fl.map((f) => `<button type="button" class="qk-row" data-id="${h(f.id)}"><b>${h(f.t)}</b><span>${h(f.sum)}</span></button>`).join("") : `<p class="small muted" style="margin:0">Nothing is flagged in the other sections. Open the full brief to read them all before you fly.</p>`}</div>`;
      box.querySelectorAll(".qk-row").forEach((b) => b.onclick = () => jump(b.dataset.id));
    }
    let more = pg.querySelector(":scope > #qkMore");
    if (!more) { more = document.createElement("div"); more.id = "qkMore"; more.style.cssText = "margin:18px 0 8px"; more.innerHTML = `<button type="button" class="btn sec">Show the full brief</button>`; more.querySelector("button").onclick = () => { apply("full"); bl.scrollIntoView({ block: "start" }); }; }
    if (!more.isConnected) pg.appendChild(more);
    const lbl = `Show the full brief (${total} sections)`, mb = more.querySelector("button");
    if (mb.textContent !== lbl) mb.textContent = lbl;
  }
  let t = 0;
  new MutationObserver((l) => {
    if (!isBrief()) return;
    if (l.every((m) => m.target.closest && m.target.closest("#qkFlags,#qkBar,#qkMore,.qk-pin"))) return;
    clearTimeout(t); t = setTimeout(paint, 250);
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("hashchange", () => { lastSig = ""; });
  window.AeroQuickBrief = { mode, apply, refresh: () => { lastSig = ""; paint(); }, flagged: () => (page() ? flagged(page()) : []) };
})();
