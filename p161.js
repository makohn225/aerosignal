"use strict";
/* p161: Gold display theme (October 28, 2026). A light theme in pewter gray, white and gold with serif
   headings, for flight schools and contractors whose own materials use that look. It builds on the Day
   mode (p21, an inverted page), so the colors below are the dark values that the inversion turns into
   the light ones: page #F1F3F3, panels white, text #221F20, gold #BAA457 (darker #7D6A2C for text).
   p87 keeps only its own seven themes, so this choice is saved under its own key with Day underneath,
   and picking any other theme clears it. Uses no names or logos. */
(function () {
  const KEY = "as_theme_x", ID = "gold";
  const css = document.createElement("style");
  css.textContent = `
    html.th-gold.day{--bg:#0b0d0d;--bg2:#0b0d0d;--glass:rgba(0,0,0,.94);--glass2:rgba(0,0,0,.9);--glass3:rgba(0,0,0,.97);--line:rgba(226,223,224,.16);--line2:rgba(226,223,224,.1);--line-hi:rgba(115,93,16,.75);--ink:#e2dfe0;--ink2:#b2adac;--ink3:#8d8886;--cyan:#a99658;--cyan2:#735d10;--cyan-soft:rgba(115,93,16,.28);--mag:#735d10;--mag2:#907a34;--mag-soft:rgba(115,93,16,.24);--glow-c:none;--glow-m:none;--sh:0 1px 2px rgba(255,255,255,.05);--disp:"Times New Roman",Times,Georgia,serif}
    html.th-gold.day body{background:#0b0d0d}
    html.th-gold.day body::before{display:block;background:#0b0d0d!important;-webkit-mask-image:none;mask-image:none}
    html.th-gold.day h1,html.th-gold.day h2,html.th-gold.day .panel>h2,html.th-gold.day .brand{font-family:"Times New Roman",Times,Georgia,serif!important;letter-spacing:.5px;text-shadow:none!important}
    html.th-gold.day h1{font-weight:400;text-transform:uppercase;letter-spacing:1px}
    html.th-gold.day .panel,html.th-gold.day .card,html.th-gold.day section.panel{box-shadow:none!important;border-color:rgba(226,223,224,.16)!important}
    html.th-gold.day .tabs a,html.th-gold.day .rail a{font-family:"Times New Roman",Times,Georgia,serif;text-transform:uppercase;letter-spacing:.5px}
    html.th-gold.day .tabs a.on,html.th-gold.day .tabs a[aria-current],html.th-gold.day .rail a.on{color:#4b3b00!important;box-shadow:inset 0 -3px 0 #735d10}
    html.th-gold.day .btn:not(.sec),html.th-gold.day .btn.mag{background:#735d10!important;border-color:#735d10!important;color:#e2dfe0!important;box-shadow:none!important}
    html.th-gold.day .btn.sec{border-color:#735d10!important;color:#a99658!important;background:transparent!important}
    html.th-gold.day a{color:#a99658}
    html.th-gold.day #dayBtn{font-size:0!important}
    html.th-gold.day #dayBtn::after{content:"Gold";font-size:12px}
    .thgrid .sw.gold,#thMenu .sw.gold{background:linear-gradient(135deg,#F1F3F3 55%,#BAA457 55%,#BAA457 75%,#221F20 75%)!important}
  `;
  document.head.appendChild(css);
  const on = () => { try { return localStorage.getItem(KEY) === ID; } catch { return false; } };
  function paint() {
    const g = on() && document.documentElement.classList.contains("day");
    document.documentElement.classList.toggle("th-gold", g);
    const tc = document.querySelector('meta[name="theme-color"]'); if (g && tc) tc.content = "#F1F3F3";
    document.querySelectorAll('#thMenu [data-th]').forEach((b) => b.setAttribute("aria-checked", g ? b.dataset.th === ID : b.getAttribute("aria-checked")));
    document.querySelectorAll('.thgrid [data-th]').forEach((b) => { if (g) b.setAttribute("aria-pressed", b.dataset.th === ID); });
  }
  function pick() {
    try { localStorage.setItem(KEY, ID); } catch {}
    if (window.AeroTheme) AeroTheme.apply("day");
    paint();
  }
  function clear() { try { localStorage.removeItem(KEY); } catch {} paint(); }
  const item = (menu) => menu
    ? `<button type="button" role="menuitemradio" aria-checked="false" data-th="${ID}"><span class="sw gold"></span><span>Gold<small>Light gray, white and gold with serif headings</small></span></button>`
    : `<button type="button" data-th="${ID}" aria-pressed="false"><span class="sw gold"></span><b>Gold</b><small>Light gray, white and gold</small></button>`;
  function add() {
    const m = document.getElementById("thMenu");
    if (m && !m.querySelector(`[data-th="${ID}"]`)) {
      m.insertAdjacentHTML("beforeend", item(true));
      // Our choice is handled before p87 sees the click; any other choice clears ours
      m.addEventListener("click", (e) => { const b = e.target.closest("[data-th]"); if (!b) return; if (b.dataset.th === ID) { e.stopPropagation(); pick(); m.remove(); } else clear(); }, true);
      paint();
    }
    const g = document.querySelector(".thgrid");
    if (g && !g.querySelector(`[data-th="${ID}"]`)) {
      g.insertAdjacentHTML("beforeend", item(false));
      g.addEventListener("click", (e) => { const b = e.target.closest("[data-th]"); if (!b) return; if (b.dataset.th === ID) { e.stopPropagation(); pick(); } else setTimeout(clear, 0); }, true);
      paint();
    }
  }
  new MutationObserver(add).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  // On load p87 restores Day; once it has, put the gold look back on top
  let n = 0; (function wait() { paint(); if (++n < 20) setTimeout(wait, 250); })();
  window.AeroGoldTheme = { pick, clear, on };
})();
