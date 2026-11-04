"use strict";
/* p177: GPS and approaches check on the brief (November 3, 2026). Satellite based routes and approaches only help
   when GPS works, so the brief now:
   1. Picks out NOTAMs at the route airports that say GPS is unreliable or out of service, that WAAS, LPV or LP
      minimums may not be available, or that an RNAV (GPS) approach is not authorized, in plain words. Any of these
      (LPV only on IFR flights) adds a "GPS" line to the bottom line card, which the verdict (p107) counts as CAUTION.
   2. On IFR flights, lists the destination's and alternate's instrument approaches as GPS based or ground based,
      and notes when every approach there needs GPS.
   Public FAA data only (the NOTAM and d-TPP relays the brief already uses). Center wide GPS interference tests
   are not included; the footnote says to check them in an official briefing.
   Panel position: after #nsPanel, the end of the brief chain (see COORDINATION.md). */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const P = String.raw`(?:\s*\([^)]*\))*`;
  const R_GPS = new RegExp(String.raw`\bGPS\b${P}\s*(?:SIGNAL\s+)?(?:IS\s+)?(?:UNREL(?:IABLE)?|U\/S|UNUSABLE|MAY NOT BE AVBL|NOT AVBL|OUT OF SERVICE)\b`, "i");
  const R_WAAS = new RegExp(String.raw`\bWAAS\b${P}[A-Z ,\/]{0,40}?\b(?:MAY NOT BE AVBL|NOT AVBL|UNAVBL|UNREL|U\/S)\b`, "i");
  const R_LPV = /\b(?:LPV|LP)\b(?:\s+(?:MNM|MINIMUMS))?\s+(?:NA|NOT AVBL)\b/i;
  const GPS_RE = { test: (t) => R_GPS.test(t) || R_WAAS.test(t) || R_LPV.test(t) };
  const GROUND = /\b(ILS|LOC|VOR|NDB|LDA|SDF|TACAN|ASR|PAR|GLS)\b/i, SAT = /\b(RNAV|GPS|RNP)\b/i;
  const css = document.createElement("style");
  css.textContent = `
    #gpPanel .gp-l{font-size:13.5px;margin:4px 0}
    #gpPanel b.warn{color:#ffb648}#gpPanel b.ok{color:#3ddc97}
    #gpPanel .gp-apt{border-top:1px solid var(--line2,rgba(255,255,255,.1));padding:8px 0}
    #gpPanel .gp-apt:first-of-type{border-top:0}
    #gpPanel .gp-n{font-family:var(--mono,monospace);font-size:12px;color:var(--ink2,#9db2ce);display:block;margin-top:2px}`;
  document.head.appendChild(css);

  function plain(t) {
    const s = String(t || "").toUpperCase().replace(/\s+/g, " ");
    const ap = (s.match(/RNAV \(GPS\)(?: [A-Z])? RWY ?\d{1,2}[LCR]?/) || [])[0];
    if (R_GPS.test(s)) return "GPS may be unreliable or unavailable";
    if (R_WAAS.test(s)) return "WAAS, LPV or LP minimums may not be available";
    if (R_LPV.test(s)) return `LPV minimums are not available${ap ? ` on the ${ap}` : ""}`;
    return "GPS notice";
  }
  const cache = new Map();
  async function cached(key, fn, ms) { const c = cache.get(key); if (c && Date.now() - c.at < ms) return c.v; const v = await fn(); cache.set(key, { at: Date.now(), v }); return v; }

  async function build(f, ids) {
    const out = { notams: [], appr: [] };
    try {
      const j = await cached(`n|${ids.join(",")}`, () => fnGet(`notams?ids=${encodeURIComponent(ids.join(","))}`), 6e5);
      for (const [loc, list] of Object.entries((j && j.notams) || {})) for (const n of list || []) if (GPS_RE.test(n.text || "")) out.notams.push({ loc, num: n.num, what: plain(n.text), kind: R_GPS.test(n.text) ? "gps" : R_WAAS.test(n.text) ? "waas" : "lpv", text: n.text, end: n.end });
    } catch (e) { out.notamErr = true; }
    if ((f.rules || "VFR") === "IFR") {
      const dest = ids[ids.length - 1], alt = f.alternate ? String(f.alternate).toUpperCase().trim() : null;
      for (const [role, a] of [["Destination", dest], ["Alternate", alt]]) {
        if (!a) continue;
        try {
          const p = await cached(`p|${a}`, () => fnGet(`plates?apt=${encodeURIComponent(a.length === 4 && a[0] === "K" ? a.slice(1) : a)}`), 36e5);
          const iap = ((p && p.charts) || []).filter((c) => c.code === "IAP" && !/CONT\.?\s*\d*$/i.test(c.name)).map((c) => c.name);
          const names = [...new Set(iap)];
          out.appr.push({ role, a, gps: names.filter((n) => SAT.test(n) && !GROUND.test(n)), ground: names.filter((n) => GROUND.test(n)) });
        } catch (e) { out.appr.push({ role, a, err: true }); }
      }
    }
    return out;
  }
  function paint(sec, f, r) {
    const N = r.notams, A = r.appr;
    const ifr = (f.rules || "VFR") === "IFR";
    sec.innerHTML = `<h2>GPS and approaches</h2>
      ${N.length ? N.map((n) => `<p class="gp-l"><b class="warn">${h(n.loc)}: ${h(n.what)}</b><span class="gp-n">NOTAM ${h(n.num)}${n.end ? `, until ${h(n.end)}` : ""}: ${h(String(n.text).slice(0, 220))}</span></p>`).join("") : `<p class="gp-l"><b class="ok">No GPS or WAAS NOTAMs</b> at the airports on this route${r.notamErr ? " (NOTAMs could not load; check them in your briefing)" : ""}</p>`}
      ${ifr ? A.map((x) => {
        if (x.err) return `<div class="gp-apt"><p class="gp-l"><b>${h(x.role)} ${h(x.a)}</b>: approaches could not load</p></div>`;
        const all = x.gps.length + x.ground.length;
        if (!all) return `<div class="gp-apt"><p class="gp-l"><b>${h(x.role)} ${h(x.a)}</b>: no published instrument approaches</p></div>`;
        const only = !x.ground.length;
        return `<div class="gp-apt"><p class="gp-l"><b>${h(x.role)} ${h(x.a)}</b>: ${all} approach${all === 1 ? "" : "es"}, ${x.ground.length} that do not need GPS</p>
          ${x.ground.length ? `<p class="gp-l small">Without GPS: ${h(x.ground.join(", "))}</p>` : ""}
          ${x.gps.length ? `<p class="gp-l small">GPS based: ${h(x.gps.join(", "))}</p>` : ""}
          ${only ? `<p class="gp-l"><b class="warn">Every approach here needs GPS.</b> If GPS is unreliable, have a plan that does not depend on it${x.role === "Destination" ? ", such as an alternate with an ILS, LOC or VOR approach" : ""}. Check the alternate rules that apply to your GPS equipment.</p>` : ""}</div>`;
      }).join("") : ""}
      <p class="small muted" style="margin:10px 0 0">From the FAA NOTAM search and d-TPP charts for the airports on this route. GPS interference tests are announced by center NOTAMs over wide areas and are not included here; check them in your official briefing.</p>`;
  }
  function cardLine(page, r, f) {
    const card = page.querySelector("#bfBluf"); if (!card) return;
    let el = card.querySelector(".bf-gps");
    // LPV not available on one approach matters only on an IFR flight
    const n = (r ? r.notams : []).filter((x) => x.kind !== "lpv" || (f && f.rules === "IFR"));
    if (!n.length) { if (el) el.remove(); return; }
    const html = `GPS: <span class="warn">${h([...new Set(n.map((x) => `${x.loc}: ${x.what}`))].join("; "))}</span>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-gps"; const after = card.querySelector(".bf-ns") || card.querySelector(".bf-day") || card.querySelector(".bf-adv") || card.querySelector(".bf-wx") || card.querySelector(".k"); if (after) after.after(el); else card.prepend(el); }
    el.dataset.v = html; el.innerHTML = html;
  }

  let busy = false, t = 0;
  async function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!page || !f || f.missionId || !page.querySelector("#bfBluf")) return;
    const ids = [...new Set((f.points || []).filter((p) => p.kind === "airport" && p.ident).map((p) => p.ident))].slice(0, 8);
    if (!ids.length) return;
    busy = true;
    try {
      let sec = page.querySelector("#gpPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "gpPanel"; sec.innerHTML = `<h2>GPS and approaches</h2><p class="muted">Checking GPS NOTAMs${(f.rules || "") === "IFR" ? " and approaches" : ""}…</p>`; }
      const anchor = page.querySelector(":scope > #nsPanel") || page.querySelector(":scope > #dayPanel") || page.querySelector(":scope > #asPanel") || page.querySelector(":scope > #advPanel") || page.querySelector(":scope > #ntPanel") || page.querySelector(":scope > #goPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      const key = `${ids.join(",")}|${f.rules}|${f.alternate || ""}`;
      if (sec.dataset.k !== key) {
        sec.dataset.k = key;
        const r = await build(f, ids);
        sec._r = r;
        if (sec.isConnected) paint(sec, f, r);
      }
      cardLine(page, sec._r, f);
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#gpPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#gpPanel"; a.textContent = "GPS";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("gpPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
        const nc = j.querySelector('[data-s="#nsPanel"]'); if (nc) nc.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 420); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#gpPanel, #bfBluf .bf-gps"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroGpsCheck = { GPS_RE, plain };
})();
