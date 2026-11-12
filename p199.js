"use strict";
/* p199: a loading screen instead of a page that builds itself in front of you (November 11, 2026, from Mario's
   testing: "the brief page and some other pages take too long to load and it looks glitchy"). Pages such as the
   brief are assembled from many sections that each fetch their own data, so sections used to pop in, push each
   other down and reorder for several seconds. Now, when you open a page, its content is kept invisible behind a
   short "Building your brief" style message until the page has settled: no data requests in flight and no more
   sections being added. Then the whole page appears at once.
   Rules: heavy pages (brief, maps, airports, safety search, missions) wait for about a second of quiet; light
   pages appear as soon as they are quiet for a moment, so they do not feel slower. Nothing waits more than
   8 seconds: after that the page is shown as it is. The Fly screen, the 3D preview and the guided tour are left
   alone because they update continuously or are timed. The content is only made invisible (not removed), so maps
   and sections still measure and lay out correctly while hidden. */
(function () {
  const view = document.getElementById("view"); if (!view || !window.fetch) return;
  const css = document.createElement("style");
  css.textContent = `
    #view.vg-loading > *{opacity:0!important;pointer-events:none!important}
    #view.vg-ready > *{animation:vgIn .22s ease-out}
    @keyframes vgIn{from{opacity:0}to{opacity:1}}
    #vgLoad{position:fixed;left:0;right:0;top:38%;z-index:20;display:none;flex-direction:column;align-items:center;gap:14px;pointer-events:none;text-align:center;padding:0 24px;color:var(--ink,#EAF2FF);font:600 16px var(--body,system-ui,sans-serif)}
    #vgLoad.on{display:flex}
    #vgLoad i{width:38px;height:38px;border-radius:50%;border:3px solid rgba(127,127,127,.3);border-top-color:#3DE0FF;animation:vgSpin .8s linear infinite}
    #vgLoad small{font-weight:400;font-size:13.5px;opacity:.75}
    @keyframes vgSpin{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){#vgLoad i{animation-duration:2.4s}#view.vg-ready > *{animation:none}}`;
  document.head.appendChild(css);
  const box = document.createElement("div"); box.id = "vgLoad"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite");
  box.innerHTML = `<i></i><span data-t></span><small data-s></small>`;
  document.body.appendChild(box);

  // Count data requests in flight
  let inflight = 0, lastNet = Date.now();
  const of = window.fetch;
  window.fetch = function (input) {
    let u = ""; try { u = typeof input === "string" ? input : (input && input.url) || ""; } catch (e) {}
    const skip = /\/_vercel\/|insights|\.png(\?|$)|\.jpg(\?|$)|\/tile\//i.test(u);
    if (skip) return of.apply(this, arguments);
    inflight++; lastNet = Date.now();
    const done = () => { inflight = Math.max(0, inflight - 1); lastNet = Date.now(); };
    let p; try { p = of.apply(this, arguments); } catch (e) { done(); throw e; }
    p.then(done, done);
    return p;
  };
  let lastMut = Date.now();
  new MutationObserver(() => { lastMut = Date.now(); }).observe(view, { childList: true, subtree: true });

  const HEAVY = /^#\/(brief|maps|airports|safety|missions|school|currency)/;
  const SKIP = /^#\/(fly|preview|demo|welcome|tutorial)/;
  const TEXT = [[/^#\/brief/, "Building your brief", "Weather, airspace, NOTAMs and accident records"], [/^#\/maps/, "Loading the map", "Charts and accidents along your route"], [/^#\/airports/, "Loading the airport", ""], [/^#\/safety/, "Searching the accident record", ""], [/^#\/missions/, "Loading the mission", ""]];
  const pageOf = () => String(location.hash || "#/").split("?")[0];
  let run = 0, cur = null;
  function reveal() {
    run++; cur = null;
    box.classList.remove("on");
    if (view.classList.contains("vg-loading")) { view.classList.remove("vg-loading"); view.classList.add("vg-ready"); setTimeout(() => view.classList.remove("vg-ready"), 400); }
  }
  function start() {
    const hash = location.hash || "#/", pg = pageOf();
    if (pg === cur) return;                       // same page (a tab or a filter inside it): leave it alone
    if (SKIP.test(hash) || document.body.classList.contains("touring") || document.body.classList.contains("tut") || document.body.classList.contains("map-fs")) { reveal(); cur = pg; return; }
    const id = ++run; cur = pg;
    const heavy = HEAVY.test(hash), t0 = Date.now(), quiet = heavy ? 950 : 260, minShow = heavy ? 500 : 0;
    view.classList.remove("vg-ready"); view.classList.add("vg-loading");
    const tx = TEXT.find(([re]) => re.test(hash));
    box.querySelector("[data-t]").textContent = tx ? tx[1] : "Loading"; box.querySelector("[data-s]").textContent = tx ? tx[2] : "";
    lastMut = Date.now(); lastNet = Date.now();
    setTimeout(() => { if (run === id) box.classList.add("on"); }, heavy ? 120 : 350);
    const tick = () => {
      if (run !== id) return;
      const now = Date.now(), el = now - t0;
      const settled = inflight === 0 && now - lastNet >= quiet && now - lastMut >= Math.min(quiet, 450) && el >= minShow;
      if (settled || el > 8000) { reveal(); cur = pg; return; }
      setTimeout(tick, 90);
    };
    setTimeout(tick, 90);
  }
  window.addEventListener("hashchange", start);
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
  start();
  window.AeroLoading = { reveal, busy: () => view.classList.contains("vg-loading") };
})();
