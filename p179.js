"use strict";
/* p179: three display themes, Gold by default (November 4, 2026, at the owner's request).
   The theme menu (top bar) and the More page Display panel now offer only Gold (p161, light gray, white and
   gold), Dark (p87's original "Signal" look) and Tactical (p87's dark olive). Gold is the default: the first
   time this runs on a device it switches to Gold, unless the pilot had chosen Tactical or Night red, which go
   to Tactical. The other p87 themes stay in the code but are no longer offered. Saved on this device only. */
(function () {
  const DONE = "vg_theme_v1", KEEP = ["gold", "signal", "tac"];
  const NAMES = { gold: ["Gold", "Light gray, white and gold. The default"], signal: ["Dark", "Dark blue with cyan, easy on the eyes at night"], tac: ["Tactical", "Dark olive and dim green for low light"] };
  const css = document.createElement("style");
  css.textContent = `
    #thMenu [data-th]:not([data-th="gold"]):not([data-th="signal"]):not([data-th="tac"]),
    .thgrid [data-th]:not([data-th="gold"]):not([data-th="signal"]):not([data-th="tac"]){display:none!important}
    html.th-signal:not(.th-gold) #dayBtn{font-size:0!important}
    html.th-signal:not(.th-gold) #dayBtn::after{content:"Dark";font-size:12px}
    html.day #thMenu .sw,html.day .thgrid .sw{filter:invert(1) hue-rotate(180deg)}`;
  document.head.appendChild(css);

  function first() {
    let done = null; try { done = localStorage.getItem(DONE); } catch (e) {}
    if (done || !window.AeroTheme) return !!done;
    let cur = "signal"; try { cur = localStorage.getItem("as_theme") || "signal"; } catch (e) {}
    try { localStorage.setItem(DONE, "1"); } catch (e) {}
    if (cur === "tac" || cur === "red") { try { localStorage.removeItem("as_theme_x"); } catch (e) {} AeroTheme.apply("tac"); }
    else if (window.AeroGoldTheme) AeroGoldTheme.pick();
    return true;
  }
  function tidy(root) {
    if (!root) return;
    for (const id of KEEP) {
      const b = root.querySelector(`[data-th="${id}"]`); if (!b || b.dataset.vg) continue;
      b.dataset.vg = "1";
      const [name, note] = NAMES[id];
      const sm = b.querySelector("small") || b.querySelector("span.small"); if (sm) sm.textContent = note;
      // Menu rows hold "<span>Name<small>"; grid buttons hold "<b>Name</b><small>"
      const nb = b.querySelector("b");
      if (nb) nb.textContent = name;
      else { const sp = [...b.querySelectorAll("span")].find((s) => s.querySelector("small")); if (sp && sp.firstChild && sp.firstChild.nodeType === 3) sp.firstChild.nodeValue = name; }
    }
    // Gold first, then Dark, then Tactical
    const g = root.querySelector('[data-th="gold"]'), d = root.querySelector('[data-th="signal"]'), t = root.querySelector('[data-th="tac"]');
    if (g && root.firstElementChild !== g) root.prepend(g);
    if (g && d && g.nextElementSibling !== d) g.after(d);
    if (d && t && d.nextElementSibling !== t) d.after(t);
  }
  function scan() {
    tidy(document.getElementById("thMenu"));
    document.querySelectorAll(".thgrid").forEach(tidy);
    const s = document.getElementById("dispMore"), p = s && s.querySelector("p");
    if (p && !p.dataset.vg) { p.dataset.vg = "1"; p.textContent = "Pick a theme for this device: Gold for daytime, Dark for evening, Tactical for low light."; }
  }
  let n = 0;
  (function wait() { if (!first() && ++n < 40) setTimeout(wait, 250); })();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
  window.AeroThemes3 = { KEEP };
})();
