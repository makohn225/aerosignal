"use strict";
/* Maps page: MTRs hidden until added to the route, and a tabbed side panel so
   mishaps and hazards are one tap away instead of below the altitude tables. */
(function () {
  const normMtr = (s) => String(s || "").toUpperCase().replace(/[\s-]/g, "");
  const mtrName = (e) => `${e.prefix || "MTR"} ${e.ident}`;
  const prettyMtr = (q) => {
    const m = normMtr(q).match(/^(IR|VR|SR)(\d{1,4}[A-Z]?)$/);
    return m ? `${m[1]} ${m[2]}` : null;
  };
  const _byIdent = new Map();
  async function mtrRowsByName(name) {
    const k = normMtr(name);
    if (!_byIdent.has(k)) _byIdent.set(k, rpc("mtr_by_ident", { q: k }).catch((err) => { _byIdent.delete(k); throw err; }));
    return _byIdent.get(k);
  }

  function flightMtrs(f) {
    if (!Array.isArray(f.mtrs)) f.mtrs = [];
    return f.mtrs;
  }

  function mtrPopup(name, e) {
    return `<b>${esc(name)}</b>${e.pt_from ? ` <span class="muted">${esc(e.pt_from)} to ${esc(e.pt_to || "")}</span>` : ""}<br>${esc(altLabel(e))}<br>Width ${e.width_left_nm || 0} nm left, ${e.width_right_nm || 0} nm right<br><span class="muted">${e.source === "FAA AIS" ? "FAA AIS, current cycle" : "DoD DISDI data, Feb 2024 cycle, may be outdated"}</span>`;
  }

  function drawMtr(group, name, rows) {
    const col = MTR_COL[(rows[0] || {}).prefix] || MTR_COL.MTR;
    let first = null;
    for (const e of rows) {
      for (const seg of e.coords || []) {
        const ll = seg.map((c) => [c[1], c[0]]);
        if (ll.length < 2) continue;
        first = first || ll[0];
        const poly = offsetLine(ll, e.width_left_nm || 0, e.width_right_nm || 0);
        if (poly) L.polygon(poly, { color: col, weight: 0.8, opacity: 0.6, fillColor: col, fillOpacity: 0.12, interactive: false }).addTo(group);
        L.polyline(ll, { color: col, weight: 2.6, opacity: 0.95 })
          .bindTooltip(esc(name), { sticky: true, className: "oa-tip" })
          .bindPopup(mtrPopup(name, e))
          .addTo(group);
      }
    }
    if (first) {
      L.marker(first, {
        interactive: false,
        icon: L.divIcon({ className: "", iconSize: [0, 0], html: `<div class="mtr-lbl" style="--c:${col}">${esc(name)}</div>` }),
      }).addTo(group);
    }
  }

  function setupMtr(panel, map, f) {
    const oldShow = panel.querySelector("#mtrShow");
    const oldSec = oldShow && oldShow.closest(".altsec");
    if (!oldSec) return;
    oldSec.classList.add("mtr-legacy");
    const sec = document.createElement("div");
    sec.className = "altsec t-air";
    sec.id = "mtrSec";
    sec.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">Military training routes</h3><span class="small muted">Shown on the map only when added</span></div>
      <div id="mtrAdded" class="mtrchips"></div>
      <form id="mtrAddForm" class="mtradd" autocomplete="off"><input id="mtrQ" placeholder="Add by name, e.g. IR218" aria-label="MTR name" maxlength="12">
        <button class="btn sm" type="submit">Add to route</button></form>
      <div id="mtrMsg" class="small" hidden></div>
      <div id="mtrNear" class="loading">Finding MTRs near the route</div>`;
    oldSec.after(sec);

    const group = L.layerGroup().addTo(map);
    const near = new Map();
    const drawn = new Map();

    const msg = (t, bad) => {
      const m = $("#mtrMsg");
      if (!m) return;
      m.hidden = !t;
      m.textContent = t || "";
      m.className = "small " + (bad ? "mtr-bad" : "muted");
    };

    async function rowsFor(name) {
      if (near.has(name)) return near.get(name).rows;
      return mtrRowsByName(name);
    }

    async function redraw() {
      const list = flightMtrs(f);
      for (const [name, g] of drawn) if (!list.includes(name)) { group.removeLayer(g); drawn.delete(name); }
      for (const name of list) {
        if (drawn.has(name)) continue;
        const g = L.featureGroup();
        drawn.set(name, g);
        try {
          const rows = await rowsFor(name);
          if (!document.body.contains(sec)) return;
          drawMtr(g, name, rows || []);
          if (drawn.get(name) === g) g.addTo(group);
        } catch {
          drawn.delete(name);
          msg(`Could not load ${name}. Check the connection and try again.`, true);
        }
      }
      renderChips();
      renderNear();
    }

    function renderChips() {
      const box = $("#mtrAdded");
      if (!box) return;
      const list = flightMtrs(f);
      box.innerHTML = list.length
        ? list.map((n) => `<span class="mtrchip" style="--c:${MTR_COL[n.split(" ")[0]] || MTR_COL.MTR}"><button type="button" class="mtrzoom" data-n="${esc(n)}" title="Zoom to ${esc(n)}">${esc(n)}</button><button type="button" class="mtrdel" data-n="${esc(n)}" aria-label="Remove ${esc(n)} from route">×</button></span>`).join("")
        : `<span class="small muted">No MTRs on this route. Add one below and it will be drawn on the map.</span>`;
    }

    function renderNear() {
      const out = $("#mtrNear");
      if (!out || !out.dataset.done) return;
      const list = flightMtrs(f);
      const rows = [...near.entries()].sort((a, b) => a[1].edge - b[1].edge).slice(0, 30);
      out.className = "";
      out.innerHTML = rows.length
        ? `<div class="small muted" style="margin:10px 0 6px">${rows.length} route${rows.length > 1 ? "s" : ""} with a corridor within ${S.altPrefs.esaW || 10} nm of your route</div>
          <ul class="mtrlist">${rows.map(([name, t]) => {
            const on = list.includes(name);
            return `<li><span class="mtrtag" style="--c:${MTR_COL[t.prefix] || MTR_COL.MTR}">${esc(name)}</span>
              <span class="small" style="flex:1">${t.edge <= 0.05 ? "<b class='f'>Corridor crosses or touches route</b>" : `Corridor ${t.edge.toFixed(1)} nm from route`}<br><span class="muted">${esc([...t.alts].slice(0, 2).join("; "))}${t.src !== "FAA AIS" ? " · DoD 2024 data" : ""}</span></span>
              <button type="button" class="btn sm ${on ? "sec" : ""} mtrtoggle" data-n="${esc(name)}" aria-pressed="${on}">${on ? "Remove" : "Add"}</button></li>`;
          }).join("")}</ul>`
        : `<div class="small muted" style="margin-top:10px">No MTR corridors within ${S.altPrefs.esaW || 10} nm of the route. You can still add one by name.</div>`;
    }

    function toggle(name, on) {
      const list = flightMtrs(f);
      const i = list.indexOf(name);
      if (on && i < 0) list.push(name);
      if (!on && i >= 0) list.splice(i, 1);
      save();
      msg("");
      redraw();
      panel.dispatchEvent(new Event("mtrchange"));
    }

    sec.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-n]");
      if (!b) return;
      const n = b.dataset.n;
      if (b.classList.contains("mtrtoggle")) toggle(n, !flightMtrs(f).includes(n));
      else if (b.classList.contains("mtrdel")) toggle(n, false);
      else if (b.classList.contains("mtrzoom")) {
        const g = drawn.get(n);
        if (g && g.getLayers().length) map.fitBounds(g.getBounds().pad(0.15));
      }
    });

    $("#mtrAddForm").onsubmit = async (ev) => {
      ev.preventDefault();
      const name = prettyMtr($("#mtrQ").value);
      if (!name) return msg("Enter an MTR such as IR218, VR1257 or SR213.", true);
      if (flightMtrs(f).includes(name)) return msg(`${name} is already on this route.`);
      msg(`Looking up ${name}`);
      try {
        const rows = near.has(name) ? near.get(name).rows : await mtrRowsByName(name);
        if (!rows || !rows.length) return msg(`${name} was not found in the MTR data.`, true);
        $("#mtrQ").value = "";
        toggle(name, true);
        msg(`${name} added to the route and drawn on the map.`);
      } catch {
        msg("MTR data unavailable. Check the connection and try again.", true);
      }
    };

    redraw();

    const pts = f.points;
    rpc("mtr_near_route", { lats: pts.map((p) => p.lat), lons: pts.map((p) => p.lon), buffer_nm: 25 })
      .then((res) => {
        if (!document.body.contains(sec)) return;
        const proj = nmProj(pts[0].lat);
        const route = pts.map((p) => proj([p.lat, p.lon]));
        for (const e of res || []) {
          const name = mtrName(e);
          const t = near.get(name) || { rows: [], edge: 1e9, alts: new Set(), prefix: e.prefix, src: e.source };
          t.rows.push(e);
          t.alts.add(altLabel(e));
          const w = Math.max(e.width_left_nm || 0, e.width_right_nm || 0);
          for (const seg of e.coords || []) {
            const ll = seg.map((c) => proj([c[1], c[0]]));
            let d = 1e9;
            for (const q of ll) for (let i = 1; i < route.length; i++) d = Math.min(d, segDistNm(q, route[i - 1], route[i]));
            for (let i = 1; i < route.length; i++) for (let j = 1; j < ll.length; j++) d = Math.min(d, segDistNm(route[i - 1], ll[j - 1], ll[j]), segDistNm(route[i], ll[j - 1], ll[j]));
            t.edge = Math.min(t.edge, Math.max(0, d - w));
          }
          near.set(name, t);
        }
        const lim = +S.altPrefs.esaW || 10;
        for (const [k, t] of near) if (t.edge > lim) near.delete(k);
        $("#mtrNear").dataset.done = "1";
        renderNear();
      })
      .catch(() => {
        const out = $("#mtrNear");
        if (out) { out.className = "note"; out.dataset.done = "1"; out.textContent = "Nearby MTR list unavailable. You can still add one by name."; }
      });
  }

  function setupTabs(panel, map) {
    const head = panel.querySelector(".hzhead");
    const alt = panel.querySelector(".altwrap");
    if (!head || !alt) return;
    const first = alt.querySelector(".altsec");
    if (first) first.classList.add("t-alt");
    const tabs = document.createElement("div");
    tabs.className = "mtabs";
    tabs.setAttribute("role", "tablist");
    tabs.innerHTML = `<button type="button" role="tab" data-t="hz">Mishaps <b id="tabHzN" class="tabn"></b></button><button type="button" role="tab" data-t="alt">Altitudes</button><button type="button" role="tab" data-t="air">MTR &amp; SUA <b id="tabAirN" class="tabn"></b></button>`;
    panel.insertBefore(tabs, panel.firstChild);

    const set = (t, scroll) => {
      panel.dataset.tab = t;
      $$("button", tabs).forEach((b) => {
        const on = b.dataset.t === t;
        b.setAttribute("aria-selected", on);
        b.tabIndex = on ? 0 : -1;
      });
      if (scroll) panel.scrollTop = 0;
    };
    set("hz");
    tabs.onclick = (e) => {
      const b = e.target.closest("button[data-t]");
      if (b) set(b.dataset.t, true);
    };
    tabs.onkeydown = (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const order = ["hz", "alt", "air"];
      const i = order.indexOf(panel.dataset.tab);
      const n = order[(i + (e.key === "ArrowRight" ? 1 : 2)) % 3];
      set(n, true);
      tabs.querySelector(`[data-t="${n}"]`).focus();
    };

    const list = panel.querySelector("#hzlist");
    const fab = document.createElement("button");
    fab.type = "button";
    fab.className = "btn sm mhzfab";
    fab.id = "mhzfab";
    fab.innerHTML = `Mishaps near route <b id="fabN"></b>`;
    const wrap = $("#mwrap");
    if (wrap) wrap.appendChild(fab);
    fab.onclick = () => {
      if (wrap && wrap.classList.contains("collapsed")) $("#mshow") && $("#mshow").click();
      set("hz", true);
    };

    const count = () => {
      const items = list ? list.querySelectorAll(".hzitem") : [];
      const fatal = list ? list.querySelectorAll(".hzitem .hzmark.f").length : 0;
      const n = items.length;
      const tn = $("#tabHzN"), fn = $("#fabN");
      if (tn) { tn.textContent = n ? String(n) : ""; tn.classList.toggle("f", fatal > 0); }
      if (fn) fn.textContent = n ? `${n}${fatal ? `, ${fatal} fatal` : ""}` : "";
      const air = $("#tabAirN");
      if (air) {
        const f = currentFlight();
        const k = f && Array.isArray(f.mtrs) ? f.mtrs.length : 0;
        air.textContent = k ? String(k) : "";
      }
    };
    if (list) {
      new MutationObserver((muts) => {
        count();
        for (const m of muts) {
          if (m.type === "attributes" && m.target.classList && m.target.classList.contains("sel") && panel.dataset.tab !== "hz") {
            set("hz");
            m.target.scrollIntoView({ block: "nearest" });
          }
        }
      }).observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    }
    panel.addEventListener("mtrchange", count);
    count();
  }

  const base = ROUTES.maps;
  ROUTES.maps = function (el, arg) {
    if (S.altPrefs) S.altPrefs.showMtr = false;
    base(el, arg);
    const panel = $("#mctl");
    const f = currentFlight();
    if (!panel || !leafletMap || !f || !f.points || f.points.length < 2) return;
    try { setupMtr(panel, leafletMap, f); } catch (err) { console.error(err); }
    try { setupTabs(panel, leafletMap); } catch (err) { console.error(err); }
  };
  if ((location.hash || "").startsWith("#/maps")) go();
})();
