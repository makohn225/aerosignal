"use strict";
/* p82: Vercel Web Analytics, approved by the owner on October 21, 2026, with matching privacy wording.
   Vercel Web Analytics counts page views without cookies and without personal data. The app uses
   hash routes (#/brief), so each route change is sent as a page view of its first path segment only
   (never flight ids, routes or other details). The privacy page's short version and its Vercel line
   are updated to say so, and the privacy page's Last updated date moves to that day. */
(function () {
  const DATE = "October 21, 2026";
  const OLD = "We do not sell your data, show advertising or use third party analytics or tracking.";
  const NEW = "We do not sell your data or show advertising. We count page views with Vercel Web Analytics, which uses no cookies and collects no personal data.";
  const VOLD = "Vercel, which hosts the app.";
  const VNEW = "Vercel, which hosts the app and counts anonymous page views.";

  // Analytics script (served by Vercel once Web Analytics is turned on for the project)
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  if (/vercel\.app$/.test(location.hostname)) {
    const s = document.createElement("script");
    s.defer = true; s.src = "/_vercel/insights/script.js"; s.onerror = () => s.remove();
    document.head.appendChild(s);
  }
  let lastRoute = "";
  function track() {
    const seg = ((location.hash || "").replace(/^#\/?/, "").split(/[/?]/)[0] || "plan").replace(/[^a-z0-9-]/gi, "").slice(0, 24);
    const route = "/" + seg;
    if (route === lastRoute) return;
    lastRoute = route;
    try { window.va("pageview", { route, path: route }); } catch {}
  }
  window.addEventListener("hashchange", track);
  setTimeout(track, 0);

  // Privacy page wording
  function apply() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const view = document.getElementById("view");
    if (!view || view.dataset.pv82) return;
    let done = false;
    for (const li of view.querySelectorAll("li")) {
      const t = li.textContent.trim();
      if (t === OLD) { li.textContent = NEW; done = true; }
      else if (t === VOLD) li.textContent = VNEW;
    }
    if (!done) return;
    view.dataset.pv82 = "1";
    const w = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/Last updated October (6|20), 2026/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/October (6|20), 2026/, DATE);
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 120); };
  new MutationObserver(() => { const v = document.getElementById("view"); if (v && !v.querySelector("li")) delete v.dataset.pv82; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { const v = document.getElementById("view"); if (v) delete v.dataset.pv82; kick(); });
  kick();
})();
