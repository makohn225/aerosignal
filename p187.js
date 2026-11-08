"use strict";
/* p187: floating buttons out of the way (November 6, 2026). The Ask and Feedback buttons in the bottom right
   corner covered text and buttons on long pages (for example the airspace disclaimer on Flights). They are
   now round icon buttons that show their label on hover or keyboard focus, sit a little apart, and every
   page gets room at the bottom so its last lines can scroll clear of them. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #askFab,#fbFab{font-size:0!important;letter-spacing:0!important;width:44px!important;height:44px!important;min-width:0!important;padding:0!important;border-radius:50%!important;display:inline-flex!important;align-items:center;justify-content:center;gap:0!important;overflow:hidden;opacity:.9;transition:width .15s ease,opacity .15s ease}
    #askFab svg,#fbFab svg{width:18px!important;height:18px!important;flex:none;margin:0!important}
    #askFab:hover,#askFab:focus-visible,#fbFab:hover,#fbFab:focus-visible{font-size:13px!important;width:auto!important;padding:0 14px!important;border-radius:22px!important;gap:6px!important;opacity:1}
    #askFab{bottom:76px!important}
    #view .page{padding-bottom:120px}`;
  document.head.appendChild(css);
  const label = () => {
    const a = document.getElementById("askFab"), f = document.getElementById("fbFab");
    if (a && !a.title) { a.title = "Ask Vigilyn"; a.setAttribute("aria-label", "Ask Vigilyn"); }
    if (f && !f.title) { f.title = "Send feedback"; f.setAttribute("aria-label", "Send feedback"); }
  };
  label(); setTimeout(label, 1500); setTimeout(label, 5000);
  // Keep Ask stacked above Feedback on every page and screen size (Nov 8: on phones and tablets the Feedback button
  // sits higher, above the tab bar, and the two overlapped on More, Airports, Logbook and other pages)
  function stack() {
    const a = document.getElementById("askFab"), f = document.getElementById("fbFab");
    if (!a) return;
    a.style.removeProperty("bottom");
    if (!f) return;
    const fs = getComputedStyle(f); if (fs.display === "none" || fs.visibility === "hidden") return;
    const A = a.getBoundingClientRect(), F = f.getBoundingClientRect();
    if (!A.width || !F.width) return;
    const overlap = !(A.right <= F.left || F.right <= A.left || A.bottom <= F.top - 6 || F.bottom <= A.top);
    if (overlap) a.style.setProperty("bottom", `${Math.round(window.innerHeight - F.top + 10)}px`, "important");
  }
  let st = 0; const kick = () => { clearTimeout(st); st = setTimeout(stack, 120); };
  window.addEventListener("resize", kick); window.addEventListener("hashchange", () => setTimeout(stack, 500));
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ["class"] });
  setTimeout(stack, 800); setTimeout(stack, 3000);
})();
