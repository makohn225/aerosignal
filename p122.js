"use strict";
/* p122: privacy page wording for flight alerts (p121), approved by the owner on October 22, 2026.
   Adds one paragraph after the account sync paragraph and moves the Last updated date to that day.
   Nothing else in the policy changes. */
(function () {
  const TEXT = "If you turn on flight alerts, the route, departure time and alternate of each upcoming flight, and a notification address for your device, are stored with your account so AeroSignal can recheck the weather, TFRs and NOTAMs before departure and alert you if they change. They are deleted after the flight. You can turn alerts off at any time from the Account page.";
  const DATE = "October 22, 2026";
  function apply() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const view = document.getElementById("view");
    if (!view) return;
    if (!view.querySelector("#pvAlerts")) {
      const anchor = view.querySelector("#pvSync");
      if (!anchor) return;
      const p = document.createElement("p"); p.id = "pvAlerts";
      p.innerHTML = TEXT.replace("the Account page", '<a href="#/account">the Account page</a>');
      anchor.after(p);
    }
    const w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/Last updated October (6|20|21), 2026/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/October (6|20|21), 2026/, DATE);
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 150); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
