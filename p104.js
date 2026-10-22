"use strict";
/* p104: role based tabs. A one time question on the Plan page, "What do you fly? Civil, Military or
   Both", sets S.role. Civil pilots do not see the Missions tab or the military mishap narratives on the
   brief; military and both see everything. Pilots who already have missions or a military aircraft are
   set to Both without being asked. "Your flying" in More, Settings changes it at any time. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    body.role-civil .tabs a[data-tab="missions"]{display:none!important}
    body.role-civil #view .page > #mnPanel{display:none!important}
    body.role-civil #bfJump a[data-s="#mnPanel"]{display:none!important}
    #roleAsk{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
    #roleAsk .seg,#roleMore .seg{display:flex;gap:6px;flex-wrap:wrap}
    #roleMore .seg button[aria-pressed=true]{background:var(--cyan-soft);border-color:var(--cyan)}
  `;
  document.head.appendChild(css);
  const LABEL = { civil: "Civil", military: "Military", both: "Both" };
  function guess() {
    try {
      if ((S.missions || []).length) return "both";
      if (window.AeroMilFlight && Object.keys(allAircraft()).some((t) => AeroMilFlight.isMil(t))) return "both";
    } catch {}
    return null;
  }
  if (!S.role) { const g = guess(); if (g) { S.role = g; try { save(); } catch {} } }
  function setRole(r) {
    S.role = r; save();
    applyBody();
    toast(r === "civil" ? "Missions and military sections are hidden. Change this in More, Settings." : "All sections are shown.");
    kick();
  }
  function applyBody() {
    document.body.classList.toggle("role-civil", S.role === "civil");
    if (S.role === "civil" && /^#\/missions/.test(location.hash || "")) { /* still reachable by link */ }
  }
  let busy = false, t = 0;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      applyBody();
      const hash = location.hash || "#/plan";
      const page = document.querySelector("#view .page");
      if (!page) return;
      if (/^#\/plan(\/|$|\?)/.test(hash) || hash === "#/" || hash === "") {
        let q = page.querySelector("#roleAsk");
        if (!S.role && !q && !document.body.classList.contains("tut") && !document.body.classList.contains("touring")) {
          q = document.createElement("section"); q.className = "panel"; q.id = "roleAsk";
          q.innerHTML = `<b>What do you fly?</b><span class="seg"><button type="button" class="btn sm" data-r="civil">Civil</button><button type="button" class="btn sm" data-r="military">Military</button><button type="button" class="btn sec sm" data-r="both">Both</button></span><span class="small muted">This keeps the app to what you need. Change it any time in More.</span>`;
          q.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { q.remove(); setRole(b.dataset.r); }));
          const h1 = page.querySelector(":scope > h1"); if (h1) h1.after(q); else page.prepend(q);
        } else if (S.role && q) q.remove();
      }
      if (/^#\/more(\/|$|\?)/.test(hash) && !page.querySelector("#roleMore")) {
        const s = document.createElement("section"); s.className = "panel"; s.id = "roleMore";
        s.innerHTML = `<h2>Your flying</h2><p class="small" style="margin:0 0 8px">Civil hides the Missions tab and military mishap sections. Military and Both show everything.</p><div class="seg">${Object.entries(LABEL).map(([k, v]) => `<button type="button" class="btn sec sm" data-r="${k}" aria-pressed="${(S.role || "both") === k}">${v}</button>`).join("")}</div>`;
        s.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => { setRole(b.dataset.r); s.querySelectorAll("[data-r]").forEach((x) => x.setAttribute("aria-pressed", x.dataset.r === S.role)); }));
        const first = page.querySelector(":scope > section.panel"); if (first) first.before(s); else page.appendChild(s);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 250); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  applyBody();
  kick();
  window.AeroRole = { set: setRole, get: () => S.role || "both" };
})();
