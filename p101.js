"use strict";
/* p101: the bottom line card shows problems first. Summary lines that need nothing from the pilot (no
   warning, nothing overdue, nothing to read first) fold into one green "All clear" line that names them
   and opens them with a tap. Lines that need attention, the weather line, the ranked risks and anything
   still to fill in stay in view. */
(function () {
  const FOLD = ["bf-rw", "bf-vn", "bf-dv", "bf-adv", "bf-as", "bf-nt", "bf-pf", "bf-wa", "bf-wbf", "bf-lc"];
  const css = document.createElement("style");
  css.textContent = `
    #bfBluf:not(.bl-open) .bl-fine{display:none!important}
    #bfBluf .bf-clear{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-clear b{color:#46e39b}
    #bfBluf .bf-clear button{appearance:none;background:transparent;border:0;color:var(--cyan,#3DE0FF);text-decoration:underline;cursor:pointer;font:inherit;padding:0}
  `;
  document.head.appendChild(css);
  function attention(el) {
    if (el.querySelector(".bad, .warn, b.bad, b.warn")) return true;
    if (/#ff4d6a|#ffb648|rgb\(255, 77, 106\)|rgb\(255, 182, 72\)/i.test(el.innerHTML)) return true;
    const t = el.textContent;
    if (/tailwind|too short|overdue|CONVECTIVE|route too short|could not/i.test(t)) return true;
    if (el.classList.contains("bf-nt") && /read first/i.test(t) && !/\b0 read first/i.test(t)) return true;
    if (el.classList.contains("bf-wa") && !/is the best altitude/i.test(t)) return true;
    if ((el.classList.contains("bf-wbf") || el.classList.contains("bf-lc")) && /\benter\b|not set|over|exceed/i.test(t)) return true;
    return false;
  }
  const label = (el) => (el.textContent.split(":")[0] || "").trim().replace(/^Runways$/, "runways").toLowerCase();
  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const card = document.querySelector("#view .page #bfBluf");
    if (!card) return;
    busy = true;
    try {
      const fine = [];
      for (const el of card.children) {
        const cls = FOLD.find((c) => el.classList.contains(c));
        if (!cls) continue;
        const ok = !attention(el);
        el.classList.toggle("bl-fine", ok);
        if (ok) fine.push(label(el));
      }
      let c = card.querySelector(":scope > .bf-clear");
      if (!fine.length) { if (c) c.remove(); return; }
      const open = card.classList.contains("bl-open");
      const html = `<b>All clear:</b> ${fine.join(", ")}. <button type="button">${open ? "Hide" : "Show"}</button>`;
      if (!c) { c = document.createElement("div"); c.className = "bf-clear"; }
      if (c.dataset.v !== html) { c.dataset.v = html; c.innerHTML = html; c.querySelector("button").onclick = () => { card.classList.toggle("bl-open"); c.dataset.v = ""; apply(); }; }
      // After the last line still in view, before the ranked list
      const lines = [...card.children].filter((x) => /^bf-/.test(x.className) && !x.classList.contains("bl-fine") && x !== c && !x.classList.contains("bf-share"));
      const after = lines[lines.length - 1] || card.querySelector(":scope > .k");
      if (after && after.nextElementSibling !== c) after.after(c);
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 420); };
  new MutationObserver((l) => { if (busy) return; if (l.every((m) => m.target.closest && m.target.closest("#bfBluf .bf-clear"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
