"use strict";
/* p106: a shorter top of the brief. Each accident lesson shows its title and numbers on one line and
   opens on tap to show why it applies, what to watch for and the matching reports. The currency box
   folds its list to one line when the bottom line card already lists those same items. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #bbody .item:not(.ls-x) > :not(h4):not(.stats){display:none!important}
    #bbody .item > h4{cursor:pointer}
    #bbody .item > h4::after{content:" ▸";color:var(--cyan,#3DE0FF);font-size:.85em}
    #bbody .item.ls-x > h4::after{content:" ▾"}
    #view .page > .cur-alert.cv-fold > ul{display:none}
    #view .page > .cur-alert.cv-fold > b::after{content:": listed in the bottom line above.";font-weight:400;color:var(--ink2,#9db2ce)}
  `;
  document.head.appendChild(css);
  // One listener for every lesson title, so re-rendered lessons need no re-wiring
  document.addEventListener("click", (e) => {
    const h4 = e.target.closest && e.target.closest("#bbody .item > h4");
    if (!h4) return;
    h4.parentElement.classList.toggle("ls-x");
  });
  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    if (!page) return;
    busy = true;
    try {
      const cur = page.querySelector(":scope > .cur-alert"), card = page.querySelector("#bfBluf");
      if (cur && card) {
        const lis = [...cur.querySelectorAll("li")].map((li) => li.textContent.trim().slice(0, 30));
        const all = lis.length && lis.every((x) => card.textContent.includes(x));
        if (cur.classList.contains("cv-fold") !== !!all) cur.classList.toggle("cv-fold", !!all);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 400); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
