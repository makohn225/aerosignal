"use strict";
/* p197: easier map navigation (November 10, 2026, from Mario's phone testing: moving around the map felt hard).
   On the Maps page:
   1. Full map. The map already had a full screen control (p42), but it was a small unlabeled icon and easy to
      miss. It is now a labeled Full map button (it drives p42's own full screen, so there is still only one
      implementation), and the icon is hidden where the labeled button is shown.
   2. Route. A button that brings the whole route back into view after wandering off.
   3. On phones, tapping an accident in the list tucks the list down to its smallest height and centers the
      map on that accident with its detail card, so the tap shows the place and not more list.
   Buttons are a normal map control under the zoom buttons, fingertip sized on touch screens. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    .mnav{display:flex;flex-direction:column;gap:6px}
    .mnav button{appearance:none;display:flex;align-items:center;gap:6px;height:34px;padding:0 10px;border-radius:9px;border:1px solid rgba(255,255,255,.28);background:rgba(8,16,30,.92);color:#fff;font:700 12.5px var(--body,system-ui,sans-serif);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35)}
    .mnav button svg{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .mnav button[aria-pressed="true"]{border-color:#3DE0FF;color:#3DE0FF}
    @media (pointer:coarse){.mnav button{height:44px;padding:0 12px;font-size:13.5px}}
    .leaflet-container:has(.mnav) .fs-ctl{display:none!important}`;
  document.head.appendChild(css);
  const map = () => { try { return typeof leafletMap !== "undefined" && leafletMap ? leafletMap : null; } catch (e) { return null; } };
  const phone = () => matchMedia("(max-width:860px)").matches;
  const ICON = {
    full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
    route: '<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 17l10-10"/></svg>',
  };
  const isFull = () => document.body.classList.contains("map-fs");
  // Going in or out of full map keeps the same place in the middle (p42 keeps the top left corner instead)
  let last = null, lockUntil = 0, wasFull = false;
  function keepCenter() {
    const m = map(), on = isFull(); if (on === wasFull) return; wasFull = on;
    if (!m || !last) return; const v = last; lockUntil = Date.now() + 1000;
    setTimeout(() => { try { m.setView(v.c, v.z, { animate: false }); } catch (e) {} }, 700);
  }
  function label() {
    keepCenter();
    const b = document.querySelector(".mnav [data-n='full']"); if (!b) return;
    const on = isFull(); if (b.getAttribute("aria-pressed") === String(on) && b.dataset.l) return;
    b.dataset.l = "1"; b.setAttribute("aria-pressed", String(on)); b.innerHTML = on ? `${ICON.back}<span>Exit full map</span>` : `${ICON.full}<span>Full map</span>`;
  }
  function setFull(on) {
    const m = map(); if (!m || isFull() === !!on) return;
    const fs = m._aeroFsBtn || (m.getContainer().querySelector(".fs-ctl a")); if (!fs) return;
    fs.click(); setTimeout(label, 80);
  }
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
    if (ctl && ctlMap === m && m.getContainer().querySelector(".mnav")) { label(); return; }
    ctlMap = m; last = { c: m.getCenter(), z: m.getZoom() }; wasFull = isFull();
    m.on("moveend", () => { if (Date.now() > lockUntil) { try { last = { c: m.getCenter(), z: m.getZoom() }; } catch (e) {} } });
    ctl = L.control({ position: "topleft" });
    ctl.onAdd = () => {
      const d = L.DomUtil.create("div", "mnav leaflet-control");
      d.innerHTML = `<button type="button" data-n="full" aria-pressed="false" title="Make the map fill the screen">${ICON.full}<span>Full map</span></button><button type="button" data-n="route" title="Bring the whole route back into view">${ICON.route}<span>Route</span></button>`;
      L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
      const fb = d.querySelector("[data-n='full']"); fb.onclick = () => setFull(!isFull());
      if (!(m._aeroFsBtn || m.getContainer().querySelector(".fs-ctl a"))) fb.hidden = true; // no full screen support on this map
      d.querySelector("[data-n='route']").onclick = fitRoute;
      return d;
    };
    try { ctl.addTo(m); } catch (e) { ctl = null; }
  }
  new MutationObserver(label).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  // 3. phones: a tap on an accident in the list shows the place
  document.addEventListener("click", (e) => {
    const it = e.target.closest && e.target.closest(".hzitem"); if (!it || !phone()) return;
    const wrap = document.getElementById("mwrap"), m = map(); if (!wrap || !m || wrap.classList.contains("collapsed")) return;
    wrap.style.setProperty("grid-template-rows", "minmax(0,1fr) 24%", "important");
    setTimeout(() => {
      try {
        m.invalidateSize({ animate: false });
        // The list tap skips the popup on phones because the list used to cover the map; with the list tucked there is room, so open it
        const sel = document.querySelector("#map .hz.sel"), ic = sel && sel.closest(".leaflet-marker-icon");
        if (ic) ic.click();
        const top = document.getElementById("map").getBoundingClientRect().top + scrollY - 70; if (scrollY > top) window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      } catch (err) {}
    }, 760);
  }, true);
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { ensure(); } catch (e) { console.error(e); } }, 400); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: false });
  window.addEventListener("hashchange", kick);
  kick(); setInterval(() => { try { ensure(); } catch (e) {} }, 2500);
  window.AeroMapNav = { setFull, fitRoute };
})();
