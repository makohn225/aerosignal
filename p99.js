"use strict";
/* p99: accident lessons capped at three. The brief's lessons list shows the first three lessons (they are
   already ordered by relevance) with a button to show the rest. Phase headings with no lesson left in
   view are hidden too. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #bbody:not(.ls-open) .item.ls-more{display:none}
    #bbody:not(.ls-open) section.phase.ls-empty{display:none}
    #bbody .ls-tg{margin:8px 0 2px}
  `;
  document.head.appendChild(css);
  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const bb = document.querySelector("#view .page #bbody");
    if (!bb) return;
    busy = true;
    try {
      const items = [...bb.querySelectorAll(".item")].filter((x) => !x.classList.contains("mil-hide"));
      items.forEach((x, i) => x.classList.toggle("ls-more", i >= 3));
      for (const ph of bb.querySelectorAll("section.phase")) ph.classList.toggle("ls-empty", ![...ph.querySelectorAll(".item")].some((x) => !x.classList.contains("ls-more") && !x.classList.contains("mil-hide")));
      const extra = items.length - 3;
      let b = bb.querySelector(":scope > .ls-tg");
      if (extra > 0) {
        if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "btn sec sm ls-tg"; b.onclick = () => { bb.classList.toggle("ls-open"); apply(); }; bb.appendChild(b); }
        else if (bb.lastElementChild !== b) bb.appendChild(b);
        const txt = bb.classList.contains("ls-open") ? "Show the top 3 only" : `Show all ${items.length} lessons`;
        if (b.textContent !== txt) b.textContent = txt;
      } else if (b) b.remove();
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 300); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
