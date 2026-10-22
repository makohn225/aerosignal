"use strict";
/* p88: a less cluttered flight brief. The brief opens in an Essentials view that shows the bottom line,
   the lessons and the sections that decide go or no go (weather timing, runway winds, NOTAMs, TFRs,
   advisories, weight and fuel or load, personal minimums, low level card, checklist). After the flight
   and nice to have sections (debrief, flight track, diversions list, takeoff and landing distance,
   preflight packet, winds aloft, and civil military narratives) are folded away; their one line
   summaries stay in the bottom line card. A switch in the section chip bar shows everything, and
   jumping to a folded section (a chip or a Details link) opens just that one. Saved in S.briefAll. */
(function () {
  const ADV = ["#dbPanel", "#trkPanel", "#dvPanel", "#pfPanel", "#pkPanel", "#waPanel"];
  const NAMES = { dbPanel: "Debrief", trkPanel: "Flight track", dvPanel: "Diversions", pfPanel: "Runway length", pkPanel: "Preflight packet", waPanel: "Winds aloft", mnPanel: "Military narratives" };
  const sel = ADV.map((s) => `body.br-ess #view .page > ${s}:not(.br-open)`).join(",") + `,body.br-ess:not(.mil-ac) #view .page > #mnPanel:not(.br-open)`;
  const css = document.createElement("style");
  css.textContent = `
    ${sel}{display:none!important}
    #bfJump .br-tg{appearance:none;border:1px solid var(--line-hi,rgba(125,211,252,.35));background:var(--cyan-soft,rgba(61,224,255,.12));color:var(--ink,#e7f1ff);border-radius:999px;padding:4px 10px;font:600 12px var(--body,system-ui);cursor:pointer;margin-right:4px;white-space:nowrap}
    body.br-ess #bfJump a.br-fold{opacity:.65}
    body.br-ess #bfJump a.br-fold::after{content:" +";}
  `;
  document.head.appendChild(css);

  const isAdv = (el) => el && el.matches && el.matches(`#view .page > :is(${ADV.join(",")}, #mnPanel)`) && (el.id !== "mnPanel" || !document.body.classList.contains("mil-ac"));
  const onBrief = () => /^#\/brief(\/|$|\?)/.test(location.hash || "");

  // Jumping to a folded section opens it
  const orig = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...a) {
    try { if (document.body.classList.contains("br-ess") && isAdv(this)) this.classList.add("br-open"); } catch {}
    return orig.apply(this, a);
  };

  function hiddenCount(page) {
    return [...page.querySelectorAll(`:scope > :is(${ADV.join(",")}, #mnPanel)`)].filter((el) => isAdv(el) && !el.classList.contains("br-open")).length;
  }

  let busy = false, t = 0;
  function apply() {
    if (busy) return;
    const ess = onBrief() && !S.briefAll;
    document.body.classList.toggle("br-ess", ess);
    if (!onBrief()) return;
    const page = document.querySelector("#view .page");
    const j = page && page.querySelector("#bfJump");
    if (!j) return;
    busy = true;
    try {
      let b = j.querySelector(".br-tg");
      if (!b) {
        b = document.createElement("button"); b.type = "button"; b.className = "br-tg";
        b.onclick = (e) => { e.preventDefault(); S.briefAll = !S.briefAll; save(); page.querySelectorAll(".br-open").forEach((x) => x.classList.remove("br-open")); kick(); };
        j.prepend(b);
      }
      const n = hiddenCount(page);
      const txt = S.briefAll ? "Show essentials only" : n ? `Essentials · show ${n} more` : "Essentials";
      if (b.textContent !== txt) b.textContent = txt;
      b.title = S.briefAll ? "Fold the after flight and nice to have sections" : `Folded: ${[...page.querySelectorAll(`:scope > :is(${ADV.join(",")}, #mnPanel)`)].filter((el) => isAdv(el) && !el.classList.contains("br-open")).map((el) => NAMES[el.id]).join(", ")}`;
      for (const a of j.querySelectorAll("a[data-s]")) {
        const el = page.querySelector(a.dataset.s);
        a.classList.toggle("br-fold", !!(el && isAdv(el) && !el.classList.contains("br-open")));
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 200); };
  new MutationObserver((l) => {
    if (busy) return;
    if (l.every((m) => m.target.closest && m.target.closest("#bfJump"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("hashchange", kick);
  document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("#bfJump a[data-s]"); if (a) setTimeout(kick, 50); }, true);
  kick();
})();
