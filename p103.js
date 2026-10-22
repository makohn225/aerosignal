"use strict";
/* p103: the More page in four short groups: Settings, Learn, Tools, and Help and legal. Each panel shows
   just its title until tapped, so the page reads like a menu. Panel wording (including About and the
   privacy text) is unchanged. Panels not listed go under Help and legal. */
(function () {
  const GROUPS = [
    ["Settings", [/^Your flying/i, /^Display/i, /^AeroSignal AI connector/i, /^Account/i]],
    ["Learn", [/^Tutorial/i, /^Demo tour/i]],
    ["Tools", [/^Airports/i, /^Flight risk assessment/i, /^Checklists/i]],
    ["Help and legal", [/^Feedback/i, /^Working with/i, /^Data sources/i, /^Privacy/i, /^About AeroSignal/i]],
  ];
  const css = document.createElement("style");
  css.textContent = `
    .mg-h{font:700 12px var(--disp,system-ui);letter-spacing:2px;text-transform:uppercase;color:var(--ink2,#9db2ce);margin:22px 0 8px}
    .mg-h:first-of-type{margin-top:6px}
    #view .page > section.panel.mg-col{padding:10px 16px;margin-bottom:8px}
    #view .page > section.panel.mg-col:not(.mg-open) > :not(h2){display:none!important}
    #view .page > section.panel.mg-col > h2{cursor:pointer;margin:0;display:flex;justify-content:flex-start;align-items:center;font-size:13px;text-align:left}
    #view .page > section.panel.mg-col > h2::after{content:"+";font:700 18px var(--mono,monospace);color:var(--cyan,#3DE0FF);margin-left:auto;padding-left:10px}
    #view .page > section.panel.mg-col.mg-open > h2{margin-bottom:10px}
    #view .page > section.panel.mg-col.mg-open > h2::after{content:"−"}
    #view .page.mg-page > .cols{display:contents}
  `;
  document.head.appendChild(css);
  const open = new Set();
  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/more(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    if (!page) return;
    busy = true;
    try {
      page.classList.add("mg-page");
      const panels = [...page.querySelectorAll("section.panel")].filter((s) => s.querySelector(":scope > h2"));
      const title = (s) => (s.querySelector(":scope > h2").textContent || "").replace(/[+−]$/, "").trim();
      const used = new Set();
      const order = [];
      for (const [g, pats] of GROUPS) {
        const mine = [];
        for (const p of pats) for (const s of panels) if (!used.has(s) && p.test(title(s))) { used.add(s); mine.push(s); }
        if (g === "Help and legal") for (const s of panels) if (!used.has(s)) { used.add(s); mine.push(s); }
        if (mine.length) order.push([g, mine]);
      }
      // Place the group headings and panels in order at the end of the page, once each pass
      let at = page.querySelector(":scope > h1");
      const lede = page.querySelector(":scope > p.lede"); if (lede) at = lede;
      for (const [g, mine] of order) {
        let hd = page.querySelector(`:scope > .mg-h[data-g="${g}"]`);
        if (!hd) { hd = document.createElement("div"); hd.className = "mg-h"; hd.dataset.g = g; hd.textContent = g; }
        if (at.nextElementSibling !== hd) at.after(hd);
        at = hd;
        for (const s of mine) {
          if (at.nextElementSibling !== s) at.after(s);
          at = s;
          if (!s.classList.contains("mg-col")) {
            s.classList.add("mg-col");
            s.querySelector(":scope > h2").addEventListener("click", () => { const k = title(s); s.classList.toggle("mg-open"); s.classList.contains("mg-open") ? open.add(k) : open.delete(k); });
          }
          s.classList.toggle("mg-open", open.has(title(s)));
        }
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 200); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroMoreGroups = { open: (title) => { open.add(title); kick(); } };
})();
