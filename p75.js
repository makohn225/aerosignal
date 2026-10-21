"use strict";
/* p75: privacy page wording for account sync (p74), approved by the owner on October 20, 2026.
   Adds one paragraph after "Information stored on your device" and moves the privacy page's
   Last updated date to that day. Nothing else in the policy changes. */
(function () {
  const TEXT = "If you turn on account sync, your flights, aircraft numbers and imported logbook are also stored with your account so you can use them on your other devices. Missions and objective area files are never synced. You can turn sync off or delete your synced copy at any time from the Account page.";
  const DATE = "October 20, 2026";
  function apply() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const view = document.getElementById("view");
    if (!view || view.querySelector("#pvSync")) return;
    const h2 = [...view.querySelectorAll("h2")].find((x) => /^Information stored on your device$/i.test(x.textContent.trim()));
    if (!h2) return;
    const p = document.createElement("p");
    p.id = "pvSync";
    p.innerHTML = TEXT.replace("the Account page", '<a href="#/account">the Account page</a>');
    let after = h2.nextElementSibling && h2.nextElementSibling.tagName === "P" ? h2.nextElementSibling : h2;
    after.after(p);
    const w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/Last updated October 6, 2026/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace("October 6, 2026", DATE);
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 60); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
