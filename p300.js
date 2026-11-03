"use strict";
/* p300: fixes "Your flying" not opening in More. p153 rewrites the panel's heading after p103 has attached its
   tap handler, so the new heading had none. When that happens, drop the collapsed marker and nudge the page
   so p103 binds the new heading again. Loads last so it sees both modules' work. */
(function () {
  let t = 0, busy = false;
  function fix() {
    if (busy) return;
    const s = document.getElementById("roleMore");
    const h = s && s.querySelector(":scope > h2");
    if (!h || h.dataset.mgBound) return;
    busy = true;
    try {
      h.dataset.mgBound = "1";
      if (s.classList.contains("mg-col")) {
        s.classList.remove("mg-col");
        const n = document.createElement("span"); n.hidden = true; s.appendChild(n); n.remove();
      }
    } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(fix, 450); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
