"use strict";
/* p113: privacy page wording for checklist sync (p111), approved by the owner on October 21, 2026.
   Adds "checklists" to the account sync paragraph from p75. The Last updated date is already
   October 21, 2026 (p82). Nothing else in the policy changes. */
(function () {
  const TEXT = "If you turn on account sync, your flights, aircraft numbers, checklists and imported logbook are also stored with your account so you can use them on your other devices. Missions and objective area files are never synced. You can turn sync off or delete your synced copy at any time from the Account page.";
  function apply() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const p = document.getElementById("pvSync");
    if (!p || p.dataset.ck) return;
    p.dataset.ck = "1";
    p.innerHTML = TEXT.replace("the Account page", '<a href="#/account">the Account page</a>');
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 120); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
