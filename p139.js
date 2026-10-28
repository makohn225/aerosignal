"use strict";
/* p139: changes from pilot feedback (October 27, 2026).
   1. Airports page: a Charts and NOTAMs section for the airport shown, with every FAA chart for the
      airport (approaches, airport diagram, departures, arrivals, minimums) opening the FAA PDF, the
      airport's page in the current FAA Chart Supplement, and the current NOTAMs in full.
   2. Approach plate viewer on the map: scrolling or pinching inside the viewer no longer zooms the map
      behind it, and an approach opened full size has an On map button that lays it on the map with
      the FAA georeference.
   3. Safe altitude corridors (the dashed bands around the route) can be hidden: a Show switch on the
      Altitudes tab and a Tools menu item. The choice is remembered.
   4. The AeroSignal logo always goes back to the start of the Plan page, even when already there. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #apCharts .ac-sec{font:700 11px var(--disp,system-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2,#9db2ce);margin:14px 0 4px}
    #apCharts ul{list-style:none;margin:0;padding:0}
    #apCharts li{border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #apCharts li a{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 2px;color:var(--ink,#EAF2FF);text-decoration:none;min-height:24px}
    #apCharts li a span.k{color:var(--cyan,#3DE0FF);font-size:12.5px;white-space:nowrap}
    #apCharts .nt{font:13px/1.45 var(--mono,ui-monospace,monospace);white-space:pre-wrap;padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #apCharts .nt b{font-family:var(--sans,system-ui);color:var(--ink,#EAF2FF)}
    #apCharts .d{margin-top:10px;font-size:12.5px;font-weight:700;color:#ff4d6a}
    .pl-vbar .pl-vom{border-color:#3DE0FF!important;color:#3DE0FF!important;font-weight:700}
  `;
  document.head.appendChild(css);

  /* FAA cycles. AIRAC cycles are 28 days; 2610 began October 1, 2026. Chart Supplements change every
     56 days; the edition that began September 3, 2026 is cycle 2609. */
  const DAY = 864e5, AIRAC0 = Date.UTC(2026, 9, 1, 9), CS0 = Date.UTC(2026, 8, 3, 9);
  function airacName(t) {
    const y = new Date(t).getUTCFullYear();
    let first = AIRAC0 + Math.ceil((Date.UTC(y, 0, 1) - AIRAC0) / (28 * DAY)) * 28 * DAY;
    const n = Math.round((t - first) / (28 * DAY)) + 1;
    return String(y).slice(2) + String(n).padStart(2, "0");
  }
  function csCycle(now = Date.now()) { const k = Math.floor((now - CS0) / (56 * DAY)); return airacName(CS0 + k * 56 * DAY); }
  const csUrl = (id) => `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dafd/search/results/?cycle=${csCycle()}&ident=${encodeURIComponent(id)}`;

  /* 1. Airports page */
  const GROUPS = [["APD", "Airport diagram"], ["IAP", "Approaches"], ["DP", "Departures"], ["ODP", "Obstacle departures"], ["STAR", "Arrivals"], ["MIN", "Minimums"], ["HOT", "Hot spots"], ["LAH", "Land and hold short"]];
  let shown = "";
  async function airport() {
    const box = document.getElementById("apt");
    if (!box) return;
    const head = box.querySelector("section.panel h2");
    const id = head && (head.firstChild && head.firstChild.nodeType === 3 ? head.firstChild.nodeValue : head.textContent).trim().split(/\s+/)[0];
    if (!id || !/^[A-Z0-9]{3,4}$/.test(id)) return;
    if (box.querySelector("#apCharts")) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "apCharts";
    sec.innerHTML = `<h2>Charts and NOTAMs</h2><p class="muted small">Loading FAA charts and NOTAMs for ${h(id)}…</p>`;
    const wx = box.querySelector("section.panel:nth-of-type(2)");
    (wx || box.querySelector("section.panel")).after(sec);
    shown = id;
    const key = id.length === 4 && id[0] === "K" ? id.slice(1) : id;
    const [pl, nt] = await Promise.allSettled([fnGet(`plates?apt=${encodeURIComponent(key)}`), fnGet(`notams?ids=${encodeURIComponent(id)}`)]);
    if (shown !== id || !sec.isConnected) return;
    let html = `<h2>Charts and NOTAMs</h2>`;
    html += `<p style="margin:0 0 6px"><a href="${h(csUrl(id))}" target="_blank" rel="noopener">${h(id)} in the FAA Chart Supplement</a> <span class="muted small">(cycle ${csCycle()})</span></p>`;
    if (pl.status === "fulfilled" && pl.value && pl.value.charts && pl.value.charts.length) {
      const p = pl.value;
      html += `<p class="muted small" style="margin:0">FAA terminal procedures, cycle ${h(p.cycle)}, effective ${h(p.effective || "")}. Each opens the FAA PDF.</p>`;
      for (const [code, label] of GROUPS) {
        const list = p.charts.filter((c) => c.code === code);
        if (!list.length) continue;
        html += `<div class="ac-sec">${label}</div><ul>${list.map((c) => `<li><a href="https://aeronav.faa.gov/d-tpp/${h(p.cycle)}/${h(c.pdf)}" target="_blank" rel="noopener"><span>${h(c.name)}${c.amdt ? ` <span class="muted small">Amdt ${h(c.amdt)}</span>` : ""}</span><span class="k">PDF</span></a></li>`).join("")}</ul>`;
      }
      const other = p.charts.filter((c) => !GROUPS.some(([g]) => g === c.code));
      if (other.length) html += `<div class="ac-sec">Other</div><ul>${other.map((c) => `<li><a href="https://aeronav.faa.gov/d-tpp/${h(p.cycle)}/${h(c.pdf)}" target="_blank" rel="noopener"><span>${h(c.name)}</span><span class="k">PDF</span></a></li>`).join("")}</ul>`;
      if (p.charts.some((c) => c.code === "IAP")) html += `<p class="muted small" style="margin:8px 0 0">To lay an approach on the map, open Maps, then Tools, Approach plates, and choose On map.</p>`;
    } else if (pl.status === "fulfilled") {
      html += `<p class="muted">The FAA publishes no terminal procedures for ${h(id)}.</p>`;
    } else {
      html += `<p class="note">Could not load the FAA charts right now. Check your connection and open the airport again.</p>`;
    }
    html += `<div class="ac-sec">NOTAMs</div>`;
    if (nt.status === "fulfilled" && nt.value && nt.value.notams) {
      const rows = Object.values(nt.value.notams).flat();
      html += rows.length
        ? `<p class="muted small" style="margin:0 0 4px">${rows.length} current NOTAM${rows.length === 1 ? "" : "s"} from FAA NOTAM Search.</p>` + rows.map((n) => `<div class="nt"><b>${h(n.num)} ${h(n.kw)}</b>${n.end ? ` <span class="muted">until ${h(n.end)}</span>` : ""}\n${h(n.text)}</div>`).join("")
        : `<p class="muted">No current NOTAMs for ${h(id)}.</p>`;
    } else {
      html += `<p class="note">Could not reach the FAA NOTAM service right now. Check NOTAMs with Flight Service at 1800wxbrief.com.</p>`;
    }
    html += `<div class="d">For planning only. Use current FAA charts and an official briefing before flight.</div>`;
    sec.innerHTML = html;
  }

  /* 2. Plate viewer */
  function plateViewer() {
    for (const v of document.querySelectorAll(".pl-view:not([data-lp])")) {
      v.dataset.lp = "1";
      for (const ev of ["wheel", "mousewheel", "DOMMouseScroll", "touchstart", "touchmove", "pointerdown", "dblclick"]) v.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
      const name = (v.getAttribute("aria-label") || "").trim();
      const btn = [...document.querySelectorAll(".pl-panel .pl-row")].find((r) => (r.querySelector("span") || {}).textContent === name);
      const ov = btn && btn.querySelector("[data-ov]");
      const bar = v.querySelector(".pl-vbar"), x = v.querySelector(".pl-vx");
      if (ov && bar && x) {
        const b = document.createElement("button"); b.type = "button"; b.className = "pl-vom"; b.textContent = "On map";
        b.onclick = () => { x.click(); ov.click(); };
        x.before(b);
      }
    }
  }

  /* 3. Safe altitude corridors */
  const isCorr = (l) => l && l.options && l.options.dashArray === "6 6" && l.options.color === "#3DE0FF" && l.options.fillOpacity === 0.04;
  function corrApply(map) {
    if (!map) return;
    const hide = !!S.corrHide;
    map.eachLayer((l) => { if (isCorr(l) && l.setStyle) l.setStyle(hide ? { opacity: 0, fillOpacity: 0 } : { opacity: 0.7, fillOpacity: 0.04 }); });
  }
  function corrSet(v) { S.corrHide = !v; try { save(); } catch {} try { corrApply(leafletMap); } catch {} const c = document.getElementById("lpCorr"); if (c) c.checked = v; }
  let hooked = null;
  function corrHook() {
    let m = null; try { m = leafletMap; } catch {}
    if (!m || hooked === m) return;
    hooked = m;
    m.on("layeradd", (e) => { if (S.corrHide && isCorr(e.layer)) setTimeout(() => e.layer.setStyle && e.layer.setStyle({ opacity: 0, fillOpacity: 0 }), 0); });
    corrApply(m);
  }
  function corrSwitch() {
    const out = document.getElementById("altOut");
    if (!out || document.getElementById("lpCorr")) return;
    const lab = document.createElement("label"); lab.className = "chk"; lab.style.cssText = "display:inline-flex;gap:6px;align-items:center;margin:4px 0 6px";
    lab.innerHTML = `<input type="checkbox" id="lpCorr" ${S.corrHide ? "" : "checked"}>Show the safe altitude corridor on the map`;
    out.before(lab);
    lab.querySelector("input").onchange = (e) => corrSet(e.target.checked);
  }
  // Tools menu item (p123 hook, chained)
  const prev = window.AeroMapTools;
  window.AeroMapTools = {
    items(map) { return [...(prev ? prev.items(map) : []), ["corr", S.corrHide ? "Altitude corridor: hidden" : "Altitude corridor: shown", "Show or hide the dashed safe altitude band"]]; },
    run(t, map) { if (t === "corr") { corrSet(!!S.corrHide); try { toast(S.corrHide ? "Altitude corridor hidden" : "Altitude corridor shown"); } catch {} } else if (prev) prev.run(t, map); },
  };

  /* 4. Logo goes home */
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a.brand");
    if (!a) return;
    e.preventDefault();
    if (/^#\/plan\/?$/.test(location.hash || "")) { try { go(); } catch {} }
    else location.hash = "#/plan";
    // Back to the start: the description box stays, the reading of it is cleared
    setTimeout(() => { const o = document.getElementById("qOut"); if (o) o.innerHTML = ""; window.scrollTo(0, 0); }, 120);
  }, true);

  let t = 0, first = 0;
  function apply() {
    try { if (/^#\/airports/.test(location.hash || "")) airport(); } catch (e) { console.error(e); }
    try { plateViewer(); } catch (e) { console.error(e); }
    try { if (/^#\/maps/.test(location.hash || "")) { corrHook(); corrSwitch(); } } catch (e) { console.error(e); }
  }
  const kick = () => { clearTimeout(t); const now = Date.now(); if (!first) first = now; t = setTimeout(() => { first = 0; apply(); }, Math.max(0, Math.min(250, 600 - (now - first)))); };
  new MutationObserver(kick).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroFeedbackFixes = { csCycle, airacName, corrSet };
})();
