"use strict";
/* p197: easier map navigation (November 10, 2026, from Mario's phone testing: moving around the map felt hard).
   On the Maps page:
   1. Full map. A button on the map makes it fill the whole screen, over the top bar and the list, so there is
      room to pan and zoom on a phone. The same button, or Esc, brings the page back.
   2. Route. A button that brings the whole route back into view after wandering off.
   3. On phones, tapping an accident in the list tucks the list down to its smallest height and centers the
      map on that accident, so the tap shows the place and not more list.
   Buttons are a normal map control under the zoom buttons, fingertip sized on touch screens. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    .mnav{display:flex;flex-direction:column;gap:6px}
    .mnav button{appearance:none;display:flex;align-items:center;gap:6px;height:34px;padding:0 10px;border-radius:9px;border:1px solid rgba(255,255,255,.28);background:rgba(8,16,30,.92);color:#fff;font:700 12.5px var(--body,system-ui,sans-serif);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}
    .mnav button svg{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .mnav button[aria-pressed="true"]{border-color:#3DE0FF;color:#3DE0FF}
    @media (pointer:coarse){.mnav button{height:44px;padding:0 12px;font-size:13.5px}}
    #map.vg-full{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;height:100dvh!important;z-index:1500!important;margin:0!important;border-radius:0!important}
    body.vg-fullmap{overflow:hidden}
    body.vg-fullmap #fbFab,body.vg-fullmap #askFab{display:none!important}`;
  document.head.appendChild(css);
  const map = () => { try { return typeof leafletMap !== "undefined" && leafletMap ? leafletMap : null; } catch (e) { return null; } };
  const phone = () => matchMedia("(max-width:860px)").matches;
  const ICON = {
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    route: '<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 17l10-10"/></svg>',
  };
  function setFull(on) {
    const m = map(), el = document.getElementById("map"); if (!m || !el) return;
    el.classList.toggle("vg-full", on); document.body.classList.toggle("vg-fullmap", on);
    const b = el.querySelector(".mnav [data-n='full']");
    if (b) { b.setAttribute("aria-pressed", on ? "true" : "false"); b.innerHTML = on ? `${ICON.back}<span>Exit full map</span>` : `${ICON.full}<span>Full map</span>`; }
    const c = m.getCenter();
    setTimeout(() => { try { m.invalidateSize({ animate: false }); m.setView(c, m.getZoom(), { animate: false }); } catch (e) {} }, 60);
  }
  const isFull = () => document.body.classList.contains("vg-fullmap");
  function routePts() { let f = null; try { f = currentFlight(); } catch (e) {} return ((f && f.points) || []).filter((p) => isFinite(p.lat) && isFinite(p.lon)); }
  function fitRoute() {
    const m = map(), P = routePts(); if (!m) return;
    if (P.length < 2) { try { toast("Load a route on the Flights page first"); } catch (e) {} return; }
    try { m.closePopup(); m.fitBounds(L.latLngBounds(P.map((p) => [p.lat, p.lon])), { padding: [36, 36], maxZoom: 11 }); } catch (e) {}
  }
  let ctl = null, ctlMap = null;
  function ensure() {
    const m = map();
    if (!/^#\/maps/.test(location.hash || "") || !m || !window.L) return;
    if (ctl && ctlMap === m && m.getContainer().querySelector(".mnav")) return;
    ctlMap = m;
    ctl = L.control({ position: "topleft" });
    ctl.onAdd = () => {
      const d = L.DomUtil.create("div", "mnav leaflet-control");
      d.innerHTML = `<button type="button" data-n="full" aria-pressed="false" title="Make the map fill the screen">${ICON.full}<span>Full map</span></button><button type="button" data-n="route" title="Bring the whole route back into view">${ICON.route}<span>Route</span></button>`;
      L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
      d.querySelector("[data-n='full']").onclick = () => setFull(!isFull());
      d.querySelector("[data-n='route']").onclick = fitRoute;
      return d;
    };
    try { ctl.addTo(m); } catch (e) { ctl = null; }
  }
  // Leaving the Maps page, or Esc, always ends full map
  function leave() { if (isFull() && !/^#\/maps/.test(location.hash || "")) { document.body.classList.remove("vg-fullmap"); const el = document.getElementById("map"); if (el) el.classList.remove("vg-full"); } }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isFull()) setFull(false); });
  // 3. phones: a tap on an accident in the list shows the place
  document.addEventListener("click", (e) => {
    const it = e.target.closest && e.target.closest(".hzitem"); if (!it || !phone()) return;
    const wrap = document.getElementById("mwrap"), m = map(); if (!wrap || !m || wrap.classList.contains("collapsed")) return;
    wrap.style.setProperty("grid-template-rows", "minmax(0,1fr) 24%", "important");
    setTimeout(() => {
      try {
        m.invalidateSize({ animate: false });
        const pop = m._popup && m._popup.isOpen && m._popup.isOpen() ? m._popup.getLatLng() : null;
        if (pop) m.panTo(pop, { animate: true });
        const top = document.getElementById("map").getBoundingClientRect().top + scrollY - 70; if (scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      } catch (err) {}
    }, 420);
  }, true);
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { leave(); ensure(); } catch (e) { console.error(e); } }, 400); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: false });
  window.addEventListener("hashchange", kick);
  kick(); setInterval(() => { try { ensure(); } catch (e) {} }, 2500);
  window.AeroMapNav = { setFull, fitRoute };
})();
