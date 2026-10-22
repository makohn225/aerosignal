"use strict";
/* p128: more FAA chart and procedure data.
   1. Terminal Area Charts (TACs) on every chart map: an overlay from the FAA's own published chart
      service that shows the detailed terminal chart where one exists (zoom 10 and closer) and leaves
      the sectional showing everywhere else. On by default; the choice is remembered (S.tacOff).
   2. Published glidepaths for the approach profile (p127): the FAA's coded instrument procedure
      data (CIFP, through the cifp function) gives each runway's threshold, elevation and threshold
      crossing height, and each instrument approach's glidepath angle. The departure, destination and
      every airport on the route are fetched while the flight is planned and kept on the device, so
      the profile works without a signal in the air. Airports without published approach data keep
      the 3 degree reference path. */
(function () {
  const ARC = "https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/";
  const NAME = "FAA Terminal Area Charts";

  /* 1. Terminal Area Chart overlay */
  if (typeof L !== "undefined") {
    const isChart = (l) => l && typeof l._url === "string" && /VFR_Sectional|IFR_Area|IFR_High/.test(l._url);
    L.Control.Layers.addInitHook(function () {
      const ls = this._layers || [];
      if (!ls.some((x) => !x.overlay && isChart(x.layer)) || ls.some((x) => x.name === NAME)) return;
      const tac = L.tileLayer(ARC + "VFR_Terminal/MapServer/tile/{z}/{y}/{x}", {
        minZoom: 10, maxZoom: 14, minNativeZoom: 10, maxNativeZoom: 12, zIndex: 3,
        attribution: "FAA Terminal Area Charts", errorTileUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
      });
      tac._aeroTac = true;
      this.addOverlay(tac, NAME);
      // Show it with the sectional only; remember if the pilot turns it off
      let busy = false;
      const sync = (map) => {
        const sect = ls.some((x) => !x.overlay && map.hasLayer(x.layer) && /VFR_Sectional/.test(x.layer._url || ""));
        const want = sect && !(typeof S !== "undefined" && S.tacOff);
        busy = true;
        try {
          if (want && !map.hasLayer(tac)) map.addLayer(tac);
          if (!want && map.hasLayer(tac)) map.removeLayer(tac);
        } finally { busy = false; }
      };
      const onAdd = this.onAdd;
      this.onAdd = function (map) {
        const el = onAdd.call(this, map);
        setTimeout(() => sync(map), 0);
        map.on("baselayerchange", () => sync(map));
        map.on("overlayremove", (e) => { if (e.layer === tac && !busy && typeof S !== "undefined") { S.tacOff = true; save(); } });
        map.on("overlayadd", (e) => { if (e.layer === tac && !busy && typeof S !== "undefined") { S.tacOff = false; save(); } });
        return el;
      };
    });
  }

  /* 2. Published glidepaths */
  const icao = (id) => { id = String(id || "").toUpperCase(); return /^[A-Z]{3}$/.test(id) ? "K" + id : id; };
  const store = () => { if (typeof S === "undefined") return {}; S.cifp = S.cifp || {}; return S.cifp; };
  const pending = new Map();
  const FRESH = 7 * 864e5;
  function get(id) {
    id = icao(id);
    if (!/^[A-Z0-9]{4}$/.test(id)) return Promise.resolve(null);
    const c = store()[id];
    if (c && Date.now() - c.at < FRESH) return Promise.resolve(c.d);
    if (pending.has(id)) return pending.get(id);
    const p = fnGet(`cifp?apt=${id}`).then((d) => {
      if (!d || d.error) return c ? c.d : null;
      const s = store();
      s[id] = { at: Date.now(), d: { cycle: d.cycle, runways: d.runways || {}, approaches: d.approaches || [] } };
      // keep the 40 most recent airports
      const ks = Object.keys(s).sort((a, b) => s[b].at - s[a].at);
      for (const k of ks.slice(40)) delete s[k];
      save();
      return s[id].d;
    }).catch(() => (c ? c.d : null)).finally(() => pending.delete(id));
    pending.set(id, p);
    return p;
  }
  const RANK = { ILS: 0, GLS: 0, "RNAV (GPS)": 1, "RNAV (RNP)": 2, LOC: 3, LDA: 4, SDF: 4 };
  function vpath(a) {
    if (!a || !a.ap) return null;
    const id = icao(a.ap), c = store()[id];
    if (!c) { get(id); return null; }
    const rwy = String(a.rwy || "").toUpperCase().replace(/^RW/, "");
    const r = c.d.runways[rwy] || c.d.runways[rwy.replace(/^0/, "")] || c.d.runways[rwy.padStart(2, "0")];
    const aps = c.d.approaches.filter((x) => x.rwy === rwy || x.rwy === rwy.padStart(2, "0")).sort((x, y) => (RANK[x.kind] ?? 9) - (RANK[y.kind] ?? 9));
    if (!r || !aps.length) return null;
    const ap = aps[0];
    const tch = r.tch != null ? r.tch : ap.thrAlt != null && r.elev != null ? ap.thrAlt - r.elev : 50;
    return { gpa: ap.gpa, tch, elev: r.elev, thr: L.latLng(r.lat, r.lon), name: `${ap.kind} RWY ${ap.rwy}`, faf: ap.faf, fafAlt: ap.fafAlt, cycle: c.d.cycle, all: aps };
  }
  window.AeroApproach = Object.assign(window.AeroApproach || {}, { vpath, cifp: get });

  // Fetch the route's airports while planning, so the profile has them offline
  let last = "";
  function prefetch() {
    try {
      const f = typeof currentFlight === "function" && currentFlight();
      if (!f) return;
      const pr = typeof profile === "function" ? profile(f) : null;
      const ids = ((pr && pr.pts) || []).filter((p) => /airport/i.test(p.kind || p.subtype || "") || /^[KP][A-Z0-9]{3}$/.test(p.ident || "")).map((p) => icao(p.ident));
      const key = ids.join(",");
      if (!ids.length || key === last) return;
      last = key;
      ids.slice(0, 8).forEach((id, i) => setTimeout(() => get(id), i * 400));
    } catch { /* planning page not ready */ }
  }
  window.addEventListener("hashchange", () => setTimeout(prefetch, 1500));
  setTimeout(prefetch, 4000);
})();
