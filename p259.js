"use strict";
/* p259: jump links for the newer brief sections (November 13, 2026). The brief has grown long, and the jump bar at
   its top (#bfJump) only listed the older sections. Decision points, Route weather profile, Lightning, See the
   weather yourself and Sport pilot check now each get a link there once they are on the page, and a tap opens a
   folded section before scrolling to it. */
(function () {
  const LINKS = [["#dpPanel", "Decision points"], ["#rpPanel", "Weather profile"], ["#ltPanel", "Lightning"], ["#spPanel", "Sport pilot"], ["#wcPanel", "Weather cameras"]];
  function go(sel) {
    const s = document.querySelector(sel); if (!s) return;
    try { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); } catch (e) {}
    s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function apply() {
    if (!/^#\/brief/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"), jmp = page && page.querySelector("#bfJump"); if (!jmp) return;
    for (const [sel, label] of LINKS) {
      const has = !!page.querySelector(`:scope > ${sel}`), a = jmp.querySelector(`[data-s="${sel}"]`);
      if (has && !a) { const n = document.createElement("a"); n.href = "#"; n.dataset.s = sel; n.textContent = label; n.onclick = (e) => { e.preventDefault(); go(sel); }; jmp.appendChild(n); }
      if (!has && a) a.remove();
    }
  }
  let t = 0;
  new MutationObserver((l) => { if (l.every((m) => m.target.closest && m.target.closest("#bfJump"))) return; clearTimeout(t); t = setTimeout(apply, 600); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
})();
