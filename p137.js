"use strict";
/* p137: launch polish, round 2 (October 22, 2026).
   1. Opening the Flights page with no flights made an empty "New flight" that stayed in the saved list.
      Empty flights (no route, no points, no plan words) are removed when the pilot leaves the page.
   2. A pilot with no aircraft yet could not add one from the Flights page: the only choice in the
      Aircraft list was "Add aircraft or type…", already selected, so choosing it did nothing. The list
      now starts on "Choose an aircraft", so picking Add aircraft opens the form.
   3. Currency that the logbook shows as not met (fewer than 3 night landings, not enough approaches)
      reads "Not current in this logbook" instead of "Not tracked".
   4. Civil pilots: the welcome card no longer lists Missions, and the sign up form skips the military
      Service and Callsign fields.
   5. "Route table (1 points)" reads "(1 point)". */
(function () {
  const on = (re) => re.test(location.hash || "");
  const css = document.createElement("style");
  css.textContent = `
    body.role-civil #af div:has(> #aSvc),body.role-civil #af div:has(> #aCall),body.role-civil #af label:has(> #aSvc),body.role-civil #af label:has(> #aCall){display:none!important}
    body.role-civil #asWelcome .lp-mis{display:none!important}
  `;
  document.head.appendChild(css);

  /* 1. Empty flights */
  let last = location.hash || "";
  function sweep() {
    try {
      const empty = (f) => f && !f.demo && !f.missionId && !String(f.route || "").trim() && !(f.points || []).length && !f.planText && !f.track;
      const before = (S.flights || []).length;
      S.flights = (S.flights || []).filter((f) => !empty(f));
      if (S.flights.length !== before) {
        if (S.currentId && !S.flights.some((f) => f.id === S.currentId)) S.currentId = S.flights[0] ? S.flights[0].id : null;
        save();
        try { updateChip(); } catch {}
      }
    } catch (e) { console.error(e); }
  }
  window.addEventListener("hashchange", () => {
    const was = last; last = location.hash || "";
    if (/^#\/flights/.test(was) && !/^#\/flights/.test(last)) sweep();
  });

  function apply() {
    const view = document.getElementById("view");
    if (!view) return;
    /* 2. Aircraft list */
    if (on(/^#\/flights/)) {
      const s = document.getElementById("tail");
      if (s && s.value === "__new" && !s.querySelector('option[value=""]')) {
        const o = document.createElement("option"); o.value = ""; o.textContent = "Choose an aircraft"; o.disabled = true;
        s.prepend(o); s.value = "";
      }
      for (const el of view.querySelectorAll("summary")) {
        const n = el.firstChild && el.firstChild.nodeType === 3 ? el.firstChild : null;
        if (n && /\(1 points\)/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace("(1 points)", "(1 point)");
      }
      const w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) if (/\(1 points\)/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace("(1 points)", "(1 point)");
    }
    /* 3. Currency wording */
    if (on(/^#\/logbook/) || on(/^#\/brief/)) {
      for (const it of view.querySelectorAll(".cur-item")) {
        const when = it.querySelector(".when"), why = it.querySelector(".why");
        if (when && why && when.textContent === "Not tracked" && /^(Fewer than|Not enough)/.test(why.textContent)) when.textContent = "Not current in this logbook";
      }
    }
    /* 4. Welcome card for civil pilots */
    const wc = document.getElementById("asWelcome");
    if (wc) for (const b of wc.querySelectorAll("b")) if (b.textContent.trim() === "Missions") { const box = b.parentElement; if (box && box !== wc) box.classList.add("lp-mis"); }
  }
  let t = 0, first = 0;
  const kick = () => { clearTimeout(t); const now = Date.now(); if (!first) first = now; t = setTimeout(() => { first = 0; try { apply(); } catch (e) { console.error(e); } }, Math.max(0, Math.min(250, 600 - (now - first)))); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroPolish2 = { sweep };
})();
