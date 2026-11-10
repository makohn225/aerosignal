"use strict";
/* p195: accidents along this route, in the brief (November 9, 2026). The brief already matches accident reports
   to the flight by theme (p3), and Maps shows accidents near the route. This panel (#rtPanel, after #fsPanel,
   the end of the brief chain) joins the two: the accidents within 10 nm of this route since 2008, a plain
   summary of what they have in common with this flight, and the five most relevant ones first. Relevance is
   simple and shown as tags, never hidden: same aircraft type, at one of your airports, instrument conditions,
   distance from the route, fatal, and how recent. Uses the accidents_near_route function Maps already uses
   (public NTSB data). A one line pointer is also added under the bottom line. Nothing new is stored or sent. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NM = 10, LIM = 250;
  const css = document.createElement("style");
  css.textContent = `
    #rtPanel .rt-i{border-top:1px solid var(--line2,rgba(255,255,255,.1));padding:9px 0}
    #rtPanel .rt-i:first-of-type{border-top:0}
    #rtPanel .rt-h{font-weight:700;font-size:14.5px}
    #rtPanel .rt-t{display:flex;flex-wrap:wrap;gap:5px;margin:5px 0}
    #rtPanel .rt-t span{font-size:11.5px;font-weight:700;letter-spacing:.3px;padding:2px 8px;border-radius:10px;border:1px solid currentColor;opacity:.9}
    #rtPanel .rt-t span.f{color:#ff4d6a}
    #rtPanel .rt-x{font-size:13.5px;margin:4px 0 0;opacity:.9}
    #rtPanel details summary{cursor:pointer;font-size:13px;margin-top:4px}
    #rtPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #bfBluf .rt-line{margin:8px 0 0;font-size:14px}`;
  document.head.appendChild(css);

  const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  function typeOf(f) {
    let a = null; try { a = (allAircraft() || {})[f.tail] || null; } catch (e) {}
    let ki = null; try { ki = window.AeroKnownIssues ? AeroKnownIssues.aircraftOf(f) : null; } catch (e) {}
    let fam = null; try { if (a && typeof familyOf === "function") fam = familyOf(a.typeCode, a.make, a.model) || null; } catch (e) {}
    const label = a ? String(a.typeCode || `${a.make || ""} ${a.model || ""}`).trim() : "";
    return { fam, model: ki ? norm(ki.model) : "", label };
  }
  function sameType(ev, ty) {
    if (ty.fam && ev.family && ev.family === ty.fam) return true;
    if (!ty.model || ty.model.length < 3) return false;
    const m = norm(ev.model).replace(/^C(?=\d{3})/, "");
    return m.startsWith(ty.model);
  }
  const yearOf = (d) => Number(String(d || "").slice(0, 4)) || 0;
  function rank(rows, f, ty) {
    const codes = new Set();
    for (const p of f.points || []) if (!p.kind || p.kind === "airport") { const c = String(p.ident || "").toUpperCase(); codes.add(c); codes.add(c.replace(/^K(?=[A-Z0-9]{3}$)/, "")); }
    const now = new Date().getFullYear();
    return rows.map((r) => {
      const tags = []; let s = 0;
      const st = sameType(r, ty); if (st) { s += 3; tags.push(["Same aircraft type", ""]); }
      const ap = r.airport_code && codes.has(String(r.airport_code).toUpperCase()); if (ap) { s += 2.5; tags.push([`At ${String(r.airport_code).toUpperCase()}`, ""]); }
      const imc = /IMC/i.test(r.weather_condition || ""); if (imc) { s += String(f.rules || "").toUpperCase() === "IFR" ? 2 : 1.2; tags.push(["Instrument conditions", ""]); }
      const fatal = Number(r.fatal) > 0; if (fatal) { s += 1; tags.push(["Fatal", "f"]); }
      const d = Number(r.dist_nm); if (isFinite(d)) { s += Math.max(0, (NM - d) / NM); if (!ap) tags.push([d < 1 ? "On the route" : `${Math.ceil(d)} nm from route`, ""]); }
      const y = yearOf(r.event_date); if (y) s += Math.max(0, 1 - (now - y) / 18);
      return { r, s, tags, st, ap, imc, fatal };
    }).sort((a, b) => b.s - a.s);
  }
  const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
  function summary(R, f, ty, capped) {
    const n = R.length, fatal = R.filter((x) => x.fatal).length, imc = R.filter((x) => x.imc).length, st = R.filter((x) => x.st).length, ap = R.filter((x) => x.ap);
    const parts = [`<b>${capped ? "More than " : ""}${plural(n, "accident", "accidents")}</b> ${n === 1 ? "has" : "have"} happened within ${NM} nm of this route since 2008${fatal ? `, ${fatal === 1 ? "one of them fatal" : `${fatal.toLocaleString("en-US")} of them fatal`}` : ", none of them fatal"}.`];
    if (ap.length) { const by = {}; for (const x of ap) { const c = String(x.r.airport_code).toUpperCase(); by[c] = (by[c] || 0) + 1; } parts.push(`This includes ${Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, k]) => `${k} at ${h(c)}`).join(", ")}.`); }
    if (st && ty.label) parts.push(`${plural(st, "involved", "involved")} the same aircraft type as yours (${h(ty.label)}).`);
    if (imc) parts.push(`${plural(imc, "was", "were")} in instrument conditions${String(f.rules || "").toUpperCase() === "IFR" ? "" : ", often a visual flight that continued into cloud"}.`);
    return parts.join(" ");
  }
  function item(x) {
    const r = x.r, y = yearOf(r.event_date);
    const ex = String(r.excerpt || "").trim();
    const short = ex.length > 230 ? ex.slice(0, ex.lastIndexOf(" ", 230)) + "…" : ex;
    return `<div class="rt-i"><div class="rt-h">${h(r.location || "Location not recorded")}${y ? `, ${y}` : ""}${r.model ? ` · ${h(r.model)}` : ""}</div>
      <div class="rt-t">${x.tags.map(([t, c]) => `<span${c ? ` class="${c}"` : ""}>${h(t)}</span>`).join("")}</div>
      ${short ? `<p class="rt-x">${h(short)}</p>` : ""}${ex.length > short.length ? `<details><summary>Read more of the NTSB summary</summary><p class="rt-x">${h(ex)}…</p></details>` : ""}
      ${r.accident_number ? `<p class="small muted" style="margin:4px 0 0">NTSB ${h(r.accident_number)}</p>` : ""}</div>`;
  }
  const cache = new Map();
  function load(f) {
    const P = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    const k = P.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(";");
    if (!cache.has(k)) cache.set(k, (typeof corridorAccidents === "function" ? corridorAccidents(P, NM) : rpc("accidents_near_route", { lats: P.map((p) => p.lat), lons: P.map((p) => p.lon), corridor_nm: NM, lim: LIM })).catch((e) => { cache.delete(k); throw e; }));
    return cache.get(k);
  }
  const H2 = `<h2>Accidents along this route</h2>`;
  function paint(sec, page, f, rows) {
    const ty = typeOf(f);
    rows = Array.isArray(rows) ? rows : [];
    const bl = page.querySelector("#bfBluf"); const old = bl && bl.querySelector(".rt-line"); if (old) old.remove();
    if (!rows.length) { sec.innerHTML = `${H2}<p class="muted" style="margin:0">No accidents are on record within ${NM} nm of this route since 2008.</p>`; return; }
    const R = rank(rows, f, ty), capped = rows.length >= LIM;
    sec.innerHTML = `${H2}<p style="margin:0 0 8px">${summary(R, f, ty, capped)}</p>
      <p style="margin:0 0 2px"><b class="small">Most relevant to this flight</b></p>
      ${R.slice(0, 5).map(item).join("")}
      <p style="margin:10px 0 0"><a class="btn sec sm" href="#/maps">See all of them on the map</a></p>
      <p class="disc">Past accidents near a route do not predict this flight. Use them to think ahead about where and how things have gone wrong here.</p>
      <p class="small muted" style="margin:6px 0 0">From the public NTSB accident database. Tags show why each one is listed first.</p>`;
    if (bl) {
      const fatal = R.filter((x) => x.fatal).length;
      const p = document.createElement("p"); p.className = "rt-line";
      p.innerHTML = `Along this route: <b>${capped ? "more than " : ""}${plural(rows.length, "accident", "accidents")}</b> within ${NM} nm since 2008${fatal ? `, ${fatal.toLocaleString("en-US")} fatal` : ""}. <a href="#" data-rt>See the most relevant</a>`;
      p.querySelector("[data-rt]").onclick = (e) => { e.preventDefault(); jump(); };
      bl.appendChild(p);
    }
  }
  function jump() { const s = document.getElementById("rtPanel"); if (!s) return; try { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); } catch (e) {} s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); }
  let busy = false, t = 0;
  async function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!page || !f || f.missionId || !page.querySelector("#bfBluf")) return;
    const P = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    let sec = page.querySelector(":scope > #rtPanel");
    if (P.length < 2) { if (sec) sec.remove(); return; }
    busy = true;
    try {
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "rtPanel"; sec.innerHTML = `${H2}<p class="muted">Looking up accidents near this route…</p>`; }
      const anchor = page.querySelector(":scope > #fsPanel") || page.querySelector(":scope > #kiPanel") || page.querySelector(":scope > #gpPanel") || page.querySelector(":scope > #dayPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      const key = `${P.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(";")}|${f.tail || ""}|${f.rules || ""}`;
      if (sec.dataset.k !== key || !page.querySelector("#bfBluf .rt-line") && sec.dataset.n === "1") {
        sec.dataset.k = key;
        try { const rows = await load(f); if (sec.isConnected) { paint(sec, page, f, rows); sec.dataset.n = rows && rows.length ? "1" : "0"; } }
        catch (e) { sec.dataset.k = ""; sec.innerHTML = `${H2}<p class="muted" style="margin:0">Accidents near this route could not load right now.</p>`; }
      }
      const jmp = page.querySelector("#bfJump");
      if (jmp && !jmp.querySelector('[data-s="#rtPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#rtPanel"; a.textContent = "Route accidents";
        a.onclick = (e) => { e.preventDefault(); jump(); };
        jmp.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 520); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#rtPanel, .rt-line"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroRouteAccidents = { rank, sameType };
})();
