"use strict";
/* p266: map layer presets (November 14, 2026). The layers button on the map now opens with one tap presets above
   the usual list: VFR basics, IFR, Mountain, Weather, and "Mine", the pilot's own set saved with "Save these as
   mine". A preset only switches the existing chart and overlay choices (and the Lightning button), so each
   layer still remembers itself the way it always has. A pilot who chose IFR or Mountain under What you fly most
   (p263) starts with that preset the first time the map opens; after that the map keeps whatever they last chose.
   Terminal area charts are left alone: they switch with the zoom level on their own (p128). Saved in S.mapPreset. */
(function () {
  if (typeof L === "undefined" || !L.Map) return;
  const PRESETS = {
    vfr: { label: "VFR basics", base: "FAA VFR Sectional", on: ["TFRs (FAA)"], off: ["Turbulence and icing", "Glide reach to airports"], lt: false },
    ifr: { label: "IFR", base: "FAA IFR Enroute Low", on: ["TFRs (FAA)", "Turbulence and icing"], off: ["Glide reach to airports"], lt: true },
    mtn: { label: "Mountain", base: "FAA VFR Sectional", on: ["TFRs (FAA)", "Turbulence and icing", "Glide reach to airports"], off: [], lt: false },
    wx: { label: "Weather", base: "FAA VFR Sectional", on: ["TFRs (FAA)", "Turbulence and icing"], off: ["Glide reach to airports"], lt: true },
  };
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = () => { try { return (S.mapPreset = S.mapPreset || {}); } catch (e) { return {}; } };

  const st = document.createElement("style");
  st.textContent = `
    .mp-pre{padding:2px 0 8px;margin-bottom:6px;border-bottom:1px solid rgba(0,0,0,.15)}
    .mp-pre b{display:block;font-size:12px;margin-bottom:4px}
    .mp-pre .mp-row{display:flex;flex-wrap:wrap;gap:4px;max-width:220px}
    .mp-pre button{appearance:none;border:1px solid rgba(0,0,0,.3);background:#fff;color:#111;border-radius:999px;padding:5px 10px;font:600 12px system-ui,sans-serif;cursor:pointer;min-height:30px}
    .mp-pre button[aria-pressed="true"]{background:#06121F;color:#fff;border-color:#06121F}
    .mp-pre .mp-save{border-style:dashed}`;
  document.head.appendChild(st);

  const labels = (m) => [...m.getContainer().querySelectorAll(".leaflet-control-layers label")].map((l) => ({ l, i: l.querySelector("input"), t: l.textContent.trim() }));
  const ltBtn = (m) => m.getContainer().querySelector('.mnav button[data-n="lt"]');
  function current(m) {
    const ls = labels(m).filter((x) => !/Terminal Area/i.test(x.t));   // switches with zoom on its own (p128)
    return { base: (ls.find((x) => x.i && x.i.type === "radio" && x.i.checked) || {}).t, on: ls.filter((x) => x.i && x.i.type === "checkbox" && x.i.checked).map((x) => x.t), off: ls.filter((x) => x.i && x.i.type === "checkbox" && !x.i.checked).map((x) => x.t), lt: !!(ltBtn(m) && ltBtn(m).getAttribute("aria-pressed") === "true") };
  }
  function applyTo(m, p) {
    // The layer list redraws after each change, so look the inputs up again every time
    const base = labels(m).find((x) => x.i && x.i.type === "radio" && x.t === p.base);
    if (base && !base.i.checked) base.i.click();
    for (const name of [...(p.on || []), ...(p.off || [])]) {
      const want = (p.on || []).includes(name);
      const x = labels(m).find((y) => y.i && y.i.type === "checkbox" && y.t === name);
      if (x && x.i.checked !== want) x.i.click();
    }
    const b = ltBtn(m);
    if (b && typeof p.lt === "boolean" && (b.getAttribute("aria-pressed") === "true") !== p.lt) b.click();
  }
  function paint(m, box) {
    const s = store();
    box.querySelectorAll("[data-p]").forEach((b) => b.setAttribute("aria-pressed", String(s.sel === b.dataset.p)));
    const mine = box.querySelector('[data-p="mine"]'); if (mine) mine.hidden = !s.mine;
  }
  function inject(m) {
    const list = m.getContainer().querySelector(".leaflet-control-layers-list"); if (!list || list.querySelector(".mp-pre")) return !!list;
    const box = document.createElement("div"); box.className = "mp-pre";
    box.innerHTML = `<b>Presets</b><div class="mp-row">${Object.entries(PRESETS).map(([k, p]) => `<button type="button" data-p="${k}">${h(p.label)}</button>`).join("")}<button type="button" data-p="mine">Mine</button><button type="button" class="mp-save">Save these as mine</button></div>`;
    L.DomEvent.disableClickPropagation(box);
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const s = store();
      if (b.classList.contains("mp-save")) { s.mine = current(m); s.sel = "mine"; try { save(); } catch (er) {} toast("Saved as your map preset"); paint(m, box); return; }
      const k = b.dataset.p, p = k === "mine" ? s.mine : PRESETS[k]; if (!p) return;
      // After Leaflet's own tap handling for the control has finished (it blocks layer clicks for one tick)
      s.sel = k; try { save(); } catch (er) {} paint(m, box); setTimeout(() => applyTo(m, p), 60);
    });
    list.prepend(box); paint(m, box);
    // First map after choosing IFR or Mountain under What you fly most
    const s = store();
    if (!s.sel && !s.auto) {
      let tags = []; try { tags = window.AeroFlyProfile ? AeroFlyProfile.tags() : []; } catch (e) {}
      const k = tags.includes("ifr") ? "ifr" : tags.includes("mountain") ? "mtn" : null;
      if (k) { s.auto = Date.now(); s.sel = k; try { save(); } catch (e) {} setTimeout(() => { applyTo(m, PRESETS[k]); paint(m, box); }, 1500); }
    }
    return true;
  }
  L.Map.addInitHook(function () {
    const m = this; let n = 0;
    const tick = () => { if (!m._container || !document.body.contains(m._container)) { if (++n > 40) return; } if (inject(m) && m._container.querySelector(".mp-pre")) return; if (++n < 40) setTimeout(tick, 300); };
    setTimeout(tick, 400);
  });
  window.AeroMapPresets = { PRESETS, current, applyTo };
})();
