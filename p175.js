"use strict";
/* p175: Airport traffic and delays on the brief (November 3, 2026), the first step toward "Waze for pilots".
   1. FAA status for each airport on the route, from the FAA's public NAS Status feed (nasstatus edge function):
      ground stops, ground delay programs, arrival and departure delays, closures and notices, and the runway
      configuration and arrival rate in use. Anything listed adds an "FAA airport status" line to the bottom
      line card, which the verdict (p107) counts as CAUTION. The FAA lists mostly large airports.
   2. Pilot reports (busy pattern, runway in use, birds, fuel out, and so on) that expire after 90 minutes.
      REPORTS_LIVE stays false until the owner approves the airport_reports table and its privacy sentence
      (migration 20261104_airport_reports.sql, not applied). Until then the demo flight shows sample reports.
   Panel position: after #dayPanel, the last panel in the brief chain (see COORDINATION.md). */
(function () {
  const REPORTS_LIVE = false;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KINDS = [["busy", "Pattern busy"], ["runway", "Runway in use"], ["birds", "Birds"], ["fuel", "Fuel unavailable"], ["taxi", "Taxi delay"], ["other", "Other"]];
  const KL = Object.fromEntries(KINDS);
  const id3 = (s) => { const u = String(s || "").toUpperCase(); return u.length === 4 && u[0] === "K" ? u.slice(1) : u; };
  const mins = (n) => { if (n == null) return ""; n = Math.ceil(n); const hr = Math.floor(n / 60), m = n % 60; return hr ? `${hr} hr${m ? ` ${m} min` : ""}` : `${m} min`; };
  const tm = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
  const ago = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 6e4)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`; };
  const css = document.createElement("style");
  css.textContent = `
    #nsPanel .ns-apt{border-top:1px solid var(--line2,rgba(255,255,255,.1));padding:10px 0}
    #nsPanel .ns-apt:first-of-type{border-top:0}
    #nsPanel .ns-apt h3{margin:0 0 4px;font-size:15px}
    #nsPanel .ns-l{font-size:13.5px;margin:3px 0}
    #nsPanel .ns-l b.warn{color:#ffb648}#nsPanel .ns-l b.bad{color:#ff4d6a}#nsPanel .ns-l b.ok{color:#3ddc97}
    #nsPanel .ns-rp{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
    #nsPanel .ns-rp span{font-size:12.5px;padding:4px 9px;border-radius:999px;border:1px solid rgba(61,224,255,.4)}
    #nsPanel .ns-add{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    #nsPanel .ns-add button{min-height:40px}
    #nsPanel .ns-sample{font:700 11px var(--mono,monospace);color:#ffb648;letter-spacing:.5px}`;
  document.head.appendChild(css);

  let cache = { key: "", at: 0, data: null, busy: false };
  async function load(ids) {
    const key = ids.join(",");
    if (cache.key === key && cache.data && Date.now() - cache.at < 120000) return cache.data;
    const j = await fnGet(`nasstatus?ids=${encodeURIComponent(key)}`);
    cache = { key, at: Date.now(), data: j, busy: false };
    return j;
  }
  function sampleReports(ids) {
    const now = Date.now(), a = ids[0], b = ids[ids.length - 1];
    return [
      { airport: a, kind: "busy", detail: "4 in the pattern, 2 waiting to depart", runway: null, created_at: new Date(now - 18 * 6e4).toISOString() },
      { airport: a, kind: "runway", detail: null, runway: "17", created_at: new Date(now - 25 * 6e4).toISOString() },
      { airport: b, kind: "birds", detail: "Flock of gulls off the departure end", runway: null, created_at: new Date(now - 40 * 6e4).toISOString() },
    ];
  }
  function faaLines(x) {
    const L = [];
    if (x.groundStop) L.push(`<b class="bad">Ground stop</b>${x.groundStop.reason ? ` for ${h(x.groundStop.reason)}` : ""}${x.groundStop.end ? `, until about ${h(tm(x.groundStop.end))}` : ""}`);
    if (x.groundDelay) L.push(`<b class="warn">Ground delay program</b>${x.groundDelay.reason ? ` for ${h(x.groundDelay.reason)}` : ""}: average ${h(mins(x.groundDelay.avg))}${x.groundDelay.max ? `, up to ${h(mins(x.groundDelay.max))}` : ""}`);
    for (const [k, n] of [["arrivalDelay", "Arrival delays"], ["departureDelay", "Departure delays"]]) { const d = x[k]; if (d) L.push(`<b class="warn">${n}</b> ${h([d.min, d.max].filter(Boolean).join(" to "))}${d.trend ? `, ${h(String(d.trend).toLowerCase())}` : ""}${d.reason ? ` (${h(d.reason)})` : ""}`); }
    if (x.closure) L.push(`<b class="warn">Closure</b> ${h(x.closure.text || "")}`);
    if (x.notice) L.push(`<b class="warn">Notice</b> ${h(x.notice.text || "")}`);
    if (x.deicing) L.push(`<b class="warn">Deicing</b> in progress`);
    if (x.config && (x.config.arr || x.config.dep)) L.push(`<b>Runways in use</b> arriving ${h(x.config.arr || "?")}, departing ${h(x.config.dep || "?")}${x.config.rate ? `, ${h(x.config.rate)} arrivals an hour` : ""}`);
    return L;
  }
  function eventful(x) { return !!(x && (x.groundStop || x.groundDelay || x.arrivalDelay || x.departureDelay || x.closure || x.notice)); }

  function paint(sec, f, ids, data, reports, sample) {
    const by = new Map((data && data.airports ? data.airports : []).map((x) => [id3(x.id), x]));
    const rp = (a) => reports.filter((r) => id3(r.airport) === id3(a));
    sec.innerHTML = `<h2>Airport traffic and delays</h2>
      ${ids.map((a) => {
        const x = by.get(id3(a)), L = x ? faaLines(x) : [], R = rp(a);
        return `<div class="ns-apt"><h3>${h(a)}${x && x.name ? ` <span class="small muted">${h(x.name)}</span>` : ""}</h3>
          ${L.length ? L.map((l) => `<p class="ns-l">${l}</p>`).join("") : `<p class="ns-l"><b class="ok">No FAA delays or programs</b> reported right now</p>`}
          ${R.length ? `<div class="ns-rp">${sample ? `<span class="ns-sample">SAMPLE</span>` : ""}${R.map((r) => `<span>${h(KL[r.kind] || r.kind)}${r.runway ? ` ${h(r.runway)}` : ""}${r.detail ? `: ${h(r.detail)}` : ""} · ${h(ago(r.created_at))}</span>`).join("")}</div>` : ""}
          ${REPORTS_LIVE ? `<div class="ns-add" data-a="${h(a)}">${KINDS.map(([k, t]) => `<button type="button" class="btn sec sm" data-k="${k}">${h(t)}</button>`).join("")}</div>` : ""}
        </div>`;
      }).join("")}
      <p class="small muted" style="margin:10px 0 0">FAA status from the FAA's NAS Status page${data && data.fetched ? `, checked ${h(tm(data.fetched))}` : ""}. The FAA lists mostly larger airports. ${sample ? "Pilot reports shown are samples of a feature coming soon. " : REPORTS_LIVE ? "Pilot reports are from other Vigilyn pilots, expire after 90 minutes and are not verified. " : ""}Advisory only, never for traffic separation.</p>`;
  }
  function cardLine(page, ids, data) {
    const card = page.querySelector("#bfBluf"); if (!card) return;
    const ev = (data && data.airports ? data.airports : []).filter((x) => ids.some((a) => id3(a) === id3(x.id)) && eventful(x));
    let el = card.querySelector(".bf-ns");
    if (!ev.length) { if (el) el.remove(); return; }
    const txt = ev.map((x) => `${x.id} ${x.groundStop ? "ground stop" : x.groundDelay ? `ground delay average ${mins(x.groundDelay.avg)}` : x.closure ? "closure notice" : x.arrivalDelay || x.departureDelay ? "delays" : "notice"}`).join(", ");
    const html = `FAA airport status: <span class="warn">${h(txt)}</span>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-ns"; const after = card.querySelector(".bf-day") || card.querySelector(".bf-adv") || card.querySelector(".bf-wx") || card.querySelector(".k"); if (after) after.after(el); else card.prepend(el); }
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
      let sec = page.querySelector("#nsPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "nsPanel"; sec.innerHTML = `<h2>Airport traffic and delays</h2><p class="muted">Checking FAA airport status…</p>`; }
      const anchor = page.querySelector(":scope > #dayPanel") || page.querySelector(":scope > #asPanel") || page.querySelector(":scope > #advPanel") || page.querySelector(":scope > #ntPanel") || page.querySelector(":scope > #goPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      const key = ids.join(",") + (f.demo ? "|demo" : "");
      if (sec.dataset.k !== key || Date.now() - (Number(sec.dataset.at) || 0) > 120000) {
        sec.dataset.k = key; sec.dataset.at = String(Date.now());
        let data = null;
        try { data = await load(ids); } catch (e) { data = null; }
        const sample = !!f.demo && !REPORTS_LIVE;
        const reports = sample ? sampleReports(ids) : [];
        if (sec.isConnected) {
          paint(sec, f, ids, data, reports, sample);
          if (!data) sec.querySelector("h2").insertAdjacentHTML("afterend", `<p class="small muted">FAA status could not load right now.</p>`);
          sec._data = data;
        }
      }
      cardLine(page, ids, sec._data);
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#nsPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#nsPanel"; a.textContent = "Delays";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("nsPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
        const nc = j.querySelector('[data-s="#dayPanel"]'); if (nc) nc.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 380); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#nsPanel, #bfBluf .bf-ns"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroAirportStatus = { REPORTS_LIVE, faaLines };
})();
