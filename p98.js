"use strict";
/* p98: a shorter section chip bar on the flight brief. Only the sections pilots jump to most stay in
   view (When to go, Runway winds, NOTAMs, Airspace, Weight and fuel or Load, Before you go, and Low level
   on military flights); the rest sit behind a "More" chip. Two lookalike chips are renamed: the go or no
   go list becomes "Before you go" and the checklist page link becomes "Aircraft checklists". */
(function () {
  const PRIMARY = ["#wtgPanel", "#rwPanel", "#ntPanel", "#asPanel", "#wbPanel", "#lcPanel", "#goPanel", "#llPanel"];
  const css = document.createElement("style");
  css.textContent = `
    #bfJump:not(.bj-open) .bj-more{display:none!important}
    #bfJump .bj-tg{appearance:none;flex:none;font:600 12.5px var(--body,system-ui);padding:5px 10px;border-radius:999px;border:1px dashed var(--line-hi,rgba(125,211,252,.35));background:transparent;color:var(--ink2,#9db2ce);cursor:pointer;white-space:nowrap}
  `;
  document.head.appendChild(css);
  let open = false, busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const j = document.querySelector("#view .page #bfJump");
    if (!j) return;
    busy = true;
    try {
      j.classList.toggle("bj-open", open);
      let n = 0;
      for (const a of j.querySelectorAll("a")) {
        const s = a.dataset.s || "";
        if (s === "#goPanel" && a.textContent !== "Before you go") a.textContent = "Before you go";
        if (a.classList.contains("ck-chip") && a.textContent !== "Aircraft checklists") a.textContent = "Aircraft checklists";
        const prim = PRIMARY.includes(s) || a.classList.contains("shr-chip");
        a.classList.toggle("bj-more", !prim);
        if (!prim) n++;
      }
      let b = j.querySelector(".bj-tg");
      if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "bj-tg"; b.onclick = () => { open = !open; apply(); }; }
      const txt = open ? "Fewer" : `More (${n})`;
      if (b.textContent !== txt) b.textContent = txt;
      b.hidden = !n;
      const share = j.querySelector(".shr-chip");
      // Keep the toggle just before Share, at the end of the visible chips
      if (share) { if (share.previousElementSibling !== b) share.before(b); }
      else if (j.lastElementChild !== b) j.appendChild(b);
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 380); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { open = false; kick(); });
  kick();
})();
