"use strict";
/* p150: launch polish, round 3 (October 27, 2026; first shipped as p138, restored under this name on
   October 28 after p138 and p139 were reused for runway closures and pilot feedback). Loaded early
   (before p54) on purpose. Files from this chat are numbered p150 and up; see COORDINATION.md.
   1. Data use: the tutorial and promo narration set their audio source as the app starts, with
      preload "auto", so every first visit (and the first tap) downloaded the 1.5 MB intro music and a narration clip even
      if the pilot never played them. Narration audio now waits until it is actually played.
   2. Touch targets: small controls (inline Show and List links on the brief, checklist boxes, panel
      Hide toggles, delete buttons, header buttons, the map sheet grip and Filters) get larger hit areas
      on touch screens, without changing the layout.
   4. A full browser storage no longer fails quietly: if AeroSignal cannot save, a banner stays up
      saying changes are not being saved, with a link to Your data to export or clear space.
   5. The risk assessment shows "Wed, Oct 28 at 09:30" instead of 2026-10-28 at 09:30.
   3. Screen readers: the floating Feedback button has a name on phones (its label is hidden there). */
(function () {
  /* 1 */
  try {
    const NARR = /\/storage\/v1\/object\/public\/narration\//;
    const P = HTMLMediaElement.prototype;
    const src = Object.getOwnPropertyDescriptor(P, "src");
    const pre = Object.getOwnPropertyDescriptor(P, "preload");
    if (src && src.set && pre && pre.set) {
      Object.defineProperty(P, "src", {
        configurable: true, enumerable: src.enumerable, get: src.get,
        set(v) { try { if (NARR.test(String(v))) pre.set.call(this, "none"); } catch {} return src.set.call(this, v); },
      });
      Object.defineProperty(P, "preload", {
        configurable: true, enumerable: pre.enumerable, get: pre.get,
        set(v) { try { if (v === "auto" && !this.__lpPlaying && NARR.test(String(src.get.call(this) || ""))) v = "none"; } catch {} return pre.set.call(this, v); },
      });
      const play = P.play;
      // Playing loads the current source; a later source change waits again until it is played
      P.play = function () { try { this.__lpPlaying = true; if (pre.get.call(this) === "none") pre.set.call(this, "auto"); this.__lpPlaying = false; } catch {} return play.apply(this, arguments); };
    }
  } catch (e) { console.warn(e); }

  /* 4 */
  let full = false;
  try {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      try { const r = set.call(this, k, v); if (full && k === "aerosignal.v1") { full = false; banner(); } return r; }
      catch (e) { if (k === "aerosignal.v1" && /quota/i.test(e.name + e.message)) { full = true; setTimeout(banner, 0); } throw e; }
    };
  } catch {}
  function banner() {
    let b = document.getElementById("lpFull");
    if (!full) { if (b) b.remove(); return; }
    if (b) return;
    b = document.createElement("div"); b.id = "lpFull"; b.setAttribute("role", "alert");
    b.style.cssText = "position:fixed;left:12px;right:12px;top:70px;z-index:3000;background:#2a1020;border:2px solid #ff4d6a;color:#fff;border-radius:12px;padding:12px 14px;font-size:14.5px;line-height:1.45;box-shadow:0 8px 30px rgba(0,0,0,.5)";
    b.innerHTML = `<b style="color:#ff4d6a">This browser is out of space for AeroSignal, so your changes are not being saved.</b> Export your flights and logbook on <a href="#/data" style="color:#3DE0FF">Your data</a>, then remove what you no longer need. <button type="button" style="margin-left:6px" class="btn sec sm">OK</button>`;
    b.querySelector("button").onclick = () => b.remove();
    document.body.appendChild(b);
  }

  /* 2 and 3 */
  const css = document.createElement("style");
  css.textContent = `
    @media (pointer:coarse){
      #bfBluf a:not(.lvl),#bfBluf .bf-clear button{display:inline-block;padding:10px 4px;margin:-10px -4px}
      #view input[type=checkbox]{width:26px;height:26px}
      #view .pnl-tg{min-height:36px;padding-left:12px;padding-right:12px}
      #view .fl-del{min-width:44px;min-height:44px}
      #dayBtn,#asTutTop,#acctBtn,#flightChip{min-height:40px}
      #asTutTop{min-width:40px}
      .sheetgrip{min-height:32px}
      .ms-filt{min-height:40px}
      #view .wt-c{min-height:40px}
      #view summary{padding-top:8px;padding-bottom:8px}
    }
  `;
  document.head.appendChild(css);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fratDate() {
    if (!/^#\/frat/.test(location.hash || "")) return;
    const view = document.getElementById("view"); if (!view) return;
    const w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const m = n.nodeValue.match(/^(\s*)(\d{4})-(\d\d)-(\d\d) at (\d\d:\d\d)/);
      if (m) { const d = new Date(+m[2], +m[3] - 1, +m[4]); if (!isNaN(d)) n.nodeValue = n.nodeValue.replace(m[0], `${m[1]}${DAYS[d.getDay()]}, ${MON[d.getMonth()]} ${+m[4]} at ${m[5]}`); }
    }
  }
  function a11y() {
    fratDate();
    const fab = document.getElementById("fbFab");
    if (fab && !fab.getAttribute("aria-label")) fab.setAttribute("aria-label", "Feedback");
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { a11y(); } catch {} }, 300); };
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
  kick();
})();
