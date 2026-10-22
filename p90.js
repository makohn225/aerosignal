"use strict";
/* p90: vertical planning and glide reach.
   1. Top of climb and top of descent: from the pilot's climb and descent rates and speeds (saved in
      S.vnav; light single defaults, flagged to replace with POH figures) and the cruise altitude, the
      brief gets a line with where the climb ends and where to start down, and the Maps page marks both
      points on the route.
   2. Best altitude for wind: the Winds aloft panel (p36) already rates altitudes; its best choice is
      lifted into the bottom line card so it is seen even when that panel is folded.
   3. Glide reach: a Maps overlay draws, around every runway along the route (p84 list plus departure
      and destination), the distance the aircraft can glide from cruise altitude at the pilot's glide
      ratio. Route outside every circle is where an engine failure means an off airport landing.
      A "From my position" button draws the same circle around the device's GPS position in flight. */
(function () {
  const R = Math.PI / 180;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const V = () => Object.assign({ climbFpm: 700, climbKt: 75, descFpm: 500, descKt: 0, glide: 9 }, S.vnav || {});
  const css = document.createElement("style");
  css.textContent = `
    #bfBluf .bf-vn,#bfBluf .bf-wa{margin:2px 0;font-size:13.5px;line-height:1.45}
    .leaflet-marker-icon .vn-lbl{display:inline-block;font:700 11px var(--mono,monospace)!important;color:#04121f!important;background:#3DE0FF!important;border-radius:6px;padding:1px 6px;white-space:nowrap;transform:translate(-50%,-160%)}
    .leaflet-marker-icon .vn-lbl.d{background:#FF4FD8!important}
    #vnDlg{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
    #vnDlg .box{background:var(--bg2,#08111f);border:1px solid var(--line-hi);border-radius:14px;max-width:440px;width:100%;padding:16px}
    #vnDlg .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px}
    #vnDlg label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--ink2)}
    #vnDlg input{width:100%;box-sizing:border-box;font:14px var(--mono,monospace)}
    .gl-btn a{width:auto!important;padding:0 10px;font:700 12px/30px var(--body,system-ui);white-space:nowrap}
  `;
  document.head.appendChild(css);

  function cruise(f) {
    const a = String(f.cruiseAlt || f.alt || "").replace(/[\s,]/g, "");
    const m = /^FL(\d+)/i.exec(a);
    if (m) return +m[1] * 100;
    return +a || (f.rules === "IFR" ? 7000 : 5500);
  }
  function legsOf(pts) {
    const out = []; let at = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = 60 * Math.hypot(b.lat - a.lat, (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * R));
      out.push({ a, b, d, at }); at += d;
    }
    return { legs: out, total: at };
  }
  function pointAt(legs, x) {
    for (const L of legs) if (x <= L.at + L.d || L === legs[legs.length - 1]) { const t = L.d ? Math.max(0, Math.min(1, (x - L.at) / L.d)) : 0; return [L.a.lat + (L.b.lat - L.a.lat) * t, L.a.lon + (L.b.lon - L.a.lon) * t]; }
    return null;
  }
  function vnav(f) {
    const pts = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    if (pts.length < 2) return null;
    const v = V(), alt = cruise(f);
    let tas = 120; try { tas = (window.AeroWinds && AeroWinds.tasOf(f)) || (profile(f).ac || {}).tas || 120; } catch {}
    const e0 = +pts[0].elev || 0, e1 = +pts[pts.length - 1].elev || 0;
    const { legs, total } = legsOf(pts);
    const tocNm = Math.max(0, ((alt - e0) / v.climbFpm) * (v.climbKt / 60));
    const descKt = v.descKt || tas;
    const todNm = Math.max(0, ((alt - e1 - 1000) / v.descFpm) * (descKt / 60)); // to pattern altitude
    const ok = tocNm + todNm <= total;
    return { alt, tocNm, todNm, total, ok, toc: pointAt(legs, tocNm), tod: pointAt(legs, total - todNm), v, e0, e1, dst: pts[pts.length - 1].ident };
  }

  function editDlg(after) {
    const v = V();
    const d = document.createElement("div");
    d.id = "vnDlg";
    d.innerHTML = `<div class="box" role="dialog" aria-modal="true"><h2 style="margin-top:0">Climb, descent and glide</h2>
      <p class="small muted" style="margin-top:0">Starting values suit a light single. Replace them with your aircraft's POH figures.</p>
      <div class="grid"><label>Climb rate (fpm)<input data-k="climbFpm" type="number" min="100" max="6000" value="${v.climbFpm}"></label><label>Climb speed (kt)<input data-k="climbKt" type="number" min="40" max="400" value="${v.climbKt}"></label>
      <label>Descent rate (fpm)<input data-k="descFpm" type="number" min="100" max="6000" value="${v.descFpm}"></label><label>Descent speed (kt, blank for cruise)<input data-k="descKt" type="number" min="0" max="450" value="${v.descKt || ""}"></label>
      <label>Glide ratio (to 1)<input data-k="glide" type="number" min="2" max="40" step="0.5" value="${v.glide}"></label></div>
      <div class="row" style="gap:8px;margin-top:12px"><button type="button" class="btn sm" data-a="s">Save</button><button type="button" class="btn sec sm" data-a="c">Cancel</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector("[data-a=c]").onclick = () => d.remove();
    d.onclick = (e) => { if (e.target === d) d.remove(); };
    d.querySelector("[data-a=s]").onclick = () => {
      const n = {}; d.querySelectorAll("input[data-k]").forEach((i) => { n[i.dataset.k] = +i.value || 0; });
      S.vnav = Object.assign(V(), n); save(); d.remove(); if (after) after(); kick();
    };
  }

  /* ---------- bottom line lines ---------- */
  function bluf() {
    if (!/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const card = document.querySelector("#view .page #bfBluf");
    let f = null; try { f = currentFlight(); } catch {}
    if (!card || !f || f.missionId) return;
    const r = vnav(f);
    let el = card.querySelector(".bf-vn");
    if (r) {
      const html = `Climb and descent: top of climb ${Math.ceil(r.tocNm)} nm after departure, start down ${Math.ceil(r.todNm)} nm before ${h(r.dst)} at ${fmt(r.v.descFpm)} fpm${r.ok ? "" : ` <b style="color:#ffb648">(route too short to reach ${fmt(r.alt)} ft)</b>`}. <a href="#" data-vn="1">Rates</a>`;
      if (!el) { el = document.createElement("div"); el.className = "bf-vn"; const after = card.querySelector(".bf-rw") || card.querySelector(".bf-wx"); if (after) after.after(el); else card.appendChild(el); }
      if (el.dataset.v !== html) { el.dataset.v = html; el.innerHTML = html; el.querySelector("[data-vn]").onclick = (e) => { e.preventDefault(); editDlg(); }; }
    } else if (el) el.remove();
    // Best altitude for wind, from the Winds aloft panel
    const best = document.querySelector("#waPanel .wa-adv button.best"), on = document.querySelector("#waPanel .wa-adv button.on");
    let w = card.querySelector(".bf-wa");
    if (best) {
      const same = on === best || (on && on.dataset.a === best.dataset.a);
      const html = same ? `Altitude: your ${fmt(+best.dataset.a)} ft is the best altitude for today's winds.` : `Altitude: <b style="color:#3ddc97">${fmt(+best.dataset.a)} ft</b> is best for today's winds (${h(best.textContent.replace(/^\S+\s*/, ""))})${on ? `, you planned ${fmt(+on.dataset.a)} ft` : ""}. <a href="#" data-wa="${best.dataset.a}">Use it</a>`;
      if (!w) { w = document.createElement("div"); w.className = "bf-wa"; (card.querySelector(".bf-vn") || card.querySelector(".bf-wx") || card.lastElementChild).after(w); }
      if (w.dataset.v !== html) { w.dataset.v = html; w.innerHTML = html; const a = w.querySelector("[data-wa]"); if (a) a.onclick = (e) => { e.preventDefault(); f.cruiseAlt = +a.dataset.wa; save(); go(); }; }
    } else if (w) w.remove();
  }

  /* ---------- map: top of climb and descent, glide reach ---------- */
  let ctl = null;
  L.Control.Layers.addInitHook(function () { ctl = this; });
  L.Map.addInitHook(function () {
    const map = this;
    let tries = 0;
    const init = () => {
      if (map._vnInit) return;
      if (!(map._loaded && map._container && map._container.isConnected)) { if (++tries < 30) setTimeout(init, 400); return; }
      if (!/^#\/maps/.test(location.hash || "")) return;
      map._vnInit = true;
      const vn = L.layerGroup().addTo(map), gl = L.layerGroup(), me = L.layerGroup().addTo(map);
      const drawVn = () => {
        vn.clearLayers();
        let f = null; try { f = currentFlight(); } catch {}
        const r = f && vnav(f);
        if (!r || !r.toc || !r.tod) return;
        L.marker(r.toc, { interactive: false, icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="vn-lbl">TOC ${Math.ceil(r.tocNm)} nm</div>` }) }).addTo(vn);
        L.circleMarker(r.toc, { radius: 4, color: "#3DE0FF", weight: 2, fillOpacity: 1 }).addTo(vn);
        L.marker(r.tod, { interactive: false, icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="vn-lbl d">TOD ${Math.ceil(r.todNm)} nm</div>` }) }).addTo(vn);
        L.circleMarker(r.tod, { radius: 4, color: "#FF4FD8", weight: 2, fillOpacity: 1 }).addTo(vn);
      };
      const drawGl = async () => {
        gl.clearLayers();
        let f = null; try { f = currentFlight(); } catch {}
        if (!f || (f.points || []).length < 2) return;
        const v = V(), alt = cruise(f);
        const aps = [];
        const ends = [f.points[0], f.points[f.points.length - 1]].filter((p) => p && p.kind === "airport");
        for (const p of ends) aps.push({ ident: p.ident, lat: p.lat, lon: p.lon, elev_ft: +p.elev || 0 });
        try { const d = window.AeroDivert && (await AeroDivert.load(f)); if (d && d.aps) aps.push(...d.aps); } catch {}
        for (const a of aps) {
          const nm = Math.max(0, ((alt - (+a.elev_ft || 0) - 1000) * v.glide) / 6076);
          if (!nm) continue;
          L.circle([a.lat, a.lon], { radius: nm * 1852, color: "#3ddc97", weight: 1, opacity: 0.7, fillColor: "#3ddc97", fillOpacity: 0.07, interactive: false }).addTo(gl);
        }
      };
      drawVn();
      const c = ctl && ctl._map === map ? ctl : null;
      if (c) { c.addOverlay(gl, "Glide reach to airports"); }
      if (S.glideOn) { gl.addTo(map); drawGl(); }
      map.on("overlayadd", (e) => { if (e.layer === gl) { S.glideOn = true; save(); drawGl(); } });
      map.on("overlayremove", (e) => { if (e.layer === gl) { S.glideOn = false; save(); } });
      // From my position (GPS) control
      const Btn = L.Control.extend({
        options: { position: "topleft" },
        onAdd() {
          const box = L.DomUtil.create("div", "leaflet-bar gl-btn");
          box.innerHTML = `<a href="#" role="button" title="Glide circle from my GPS position">Glide from me</a><a href="#" role="button" title="Climb, descent and glide settings">⚙</a>`;
          L.DomEvent.disableClickPropagation(box);
          const [go1, set] = box.querySelectorAll("a");
          set.onclick = (e) => { e.preventDefault(); editDlg(() => { drawVn(); if (map.hasLayer(gl)) drawGl(); }); };
          go1.onclick = (e) => {
            e.preventDefault();
            if (!navigator.geolocation) { toast("This device cannot share its position"); return; }
            navigator.geolocation.getCurrentPosition((p) => {
              me.clearLayers();
              let f = null; try { f = currentFlight(); } catch {}
              const gpsFt = p.coords.altitude != null ? p.coords.altitude * 3.28084 : null;
              const alt = gpsFt != null ? gpsFt : f ? cruise(f) : 5500;
              const nm = Math.max(0, ((alt - 1000) * V().glide) / 6076);
              const ll = [p.coords.latitude, p.coords.longitude];
              L.circle(ll, { radius: nm * 1852, color: "#ffb648", weight: 2, fillOpacity: 0.05 }).addTo(me);
              L.circleMarker(ll, { radius: 6, color: "#fff", weight: 2, fillColor: "#ffb648", fillOpacity: 1 }).addTo(me)
                .bindPopup(`Glide reach about ${Math.floor(nm)} nm from ${fmt(alt)} ft${gpsFt != null ? " (GPS altitude)" : " (planned cruise; no GPS altitude)"}, ${V().glide} to 1, keeping 1,000 ft for the landing.`).openPopup();
              map.setView(ll, Math.max(map.getZoom(), 9));
            }, () => toast("Could not get your position"), { enableHighAccuracy: true, timeout: 10000 });
          };
          return box;
        },
      });
      map.addControl(new Btn());
      window.addEventListener("hashchange", () => setTimeout(drawVn, 600));
    };
    setTimeout(init, 800);
  });

  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(bluf, 350); };
  new MutationObserver((l) => { if (l.every((m) => m.target.closest && m.target.closest("#bfBluf .bf-vn, #bfBluf .bf-wa"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroVnav = { vnav, cruise };
})();
