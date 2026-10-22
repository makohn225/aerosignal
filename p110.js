"use strict";
/* p110: automatic offline save. When you open the brief for a flight that departs within the next
   12 hours, and it is not saved yet, the brief and the charts along the route save for offline
   on their own once the page has finished loading (the same save as the "Save for offline" button,
   which then keeps the copy fresh on later visits). Each flight is saved automatically once, so
   removing the copy sticks. Turn it off in the save bar; the choice is kept in S.offAuto. */
(function () {
  const css = document.createElement("style");
  css.textContent = `#offBar .oa{flex-basis:100%;font-size:12.5px;color:var(--ink2,#9fb0c8)}#offBar .oa a{color:var(--cyan,#3DE0FF)}`;
  document.head.appendChild(css);
  const HOURS = 12;
  const dep = (f) => { const d = new Date(`${f.date || ""}T${String(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`); return isNaN(d) ? null : +d; };
  const soon = (f) => { const d = dep(f); if (d == null) return false; const h = (d - Date.now()) / 36e5; return h <= HOURS && h > -2; };
  const done = () => S.offAutoDone || (S.offAutoDone = {});
  let timer = 0, firstSeen = 0, forId = "";
  function note(bar, f, saved) {
    let n = bar.querySelector(".oa");
    const html = S.offAuto === false
      ? `Automatic offline save is off. <a href="#" data-oa="on">Turn on</a>`
      : saved && done()[f.id] ? `Saved automatically because this flight departs within ${HOURS} hours. <a href="#" data-oa="off">Turn off automatic saving</a>`
      : `Briefs for flights departing within ${HOURS} hours save for offline automatically. <a href="#" data-oa="off">Turn off</a>`;
    if (n && n.dataset.v === html) return;
    if (!n) { n = document.createElement("span"); n.className = "oa"; bar.appendChild(n); }
    n.dataset.v = html; n.innerHTML = html;
    n.querySelector("a").onclick = (e) => { e.preventDefault(); S.offAuto = e.target.dataset.oa === "on"; try { save(); } catch {} toast(S.offAuto ? "Automatic offline save is on" : "Automatic offline save is off"); n.dataset.v = ""; kick(); };
  }
  function apply() {
    if (!/^#\/brief(\/|$|\?)/.test(location.hash || "") || !window.AeroOffline) return;
    let f = null; try { f = currentFlight(); } catch {}
    const page = document.querySelector("#view .page"), bar = page && page.querySelector("#offBar");
    if (!f || !bar || !(f.points || []).length) return;
    const saved = !!AeroOffline.saved(f);
    if (soon(f)) note(bar, f, saved);
    if (S.offAuto === false || saved || done()[f.id] || !navigator.onLine || !soon(f)) return;
    // Wait for the brief to settle: weather in the card and no changes for a few seconds
    if (forId !== f.id) { forId = f.id; firstSeen = Date.now(); }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const p = document.querySelector("#view .page"), b = p && p.querySelector('#offBar button[data-a="save"]');
      let g = null; try { g = currentFlight(); } catch {}
      if (!b || !g || g.id !== f.id || AeroOffline.saved(g) || done()[g.id]) return;
      done()[g.id] = Date.now(); try { save(); } catch {}
      b.click();
    }, Date.now() - firstSeen > 15000 ? 0 : Math.max(2500, 6000 - (Date.now() - firstSeen)));
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 300); };
  new MutationObserver((l) => { if (l.every((m) => m.target.closest && m.target.closest("#offBar"))) { if (!document.querySelector("#offBar .oa")) kick(); return; } kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { clearTimeout(timer); kick(); });
  kick();
})();
