"use strict";
/* p91: share a flight by link. "Share this flight" (Flights page and the brief's chip bar) makes a link
   that carries only the plan: route string and resolved points, date, time, rules, cruise altitude,
   alternate, training routes and the aircraft type. Never the tail number, logbook, profile, weather
   text, notes or anything from an account. Opening the link shows the plan and an "Add to my flights"
   button that creates a new flight on that device and opens its brief. The link is the whole plan
   (nothing is stored on a server). */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    .shr-box{max-width:640px}
    .shr-box dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:10px 0}
    .shr-box dt{color:var(--ink2);font-size:13px}.shr-box dd{margin:0;font-family:var(--mono,monospace)}
    .shr-disc{color:#ff4d6a;font-weight:700;font-size:12.5px}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const b64u = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4))));

  function payload(f) {
    let type = "";
    try { const a = allAircraft()[f.tail] || {}; type = a.typeCode || a.model || ""; } catch {}
    return {
      v: 1, r: f.route || "", d: f.date || "", t: f.time || "", ru: f.rules || "VFR", ca: f.cruiseAlt || f.alt || "", al: f.alternate || "", ty: type,
      m: Array.isArray(f.mtrs) ? f.mtrs.slice(0, 6) : [],
      p: (f.points || []).slice(0, 80).map((p) => [p.ident || "", +(+p.lat).toFixed(5), +(+p.lon).toFixed(5), p.kind || "", p.elev ?? null, p.name ? String(p.name).slice(0, 40) : ""]),
    };
  }
  const linkFor = (f) => `${location.origin}/#/share/${b64u(JSON.stringify(payload(f)))}`;

  async function share(f) {
    if (!f || !(f.points || []).length) { toast("Plan a route first"); return; }
    const url = linkFor(f);
    const title = `Flight ${(f.points[0] || {}).ident || ""} to ${(f.points[f.points.length - 1] || {}).ident || ""}`;
    try { if (navigator.share && /Mobi|iPad|Android/i.test(navigator.userAgent)) { await navigator.share({ title, text: `${title} in AeroSignal`, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); toast("Link copied. Anyone with it can open this route and plan."); }
    catch { prompt("Copy this link", url); }
  }

  // The #/share/<data> page
  if (typeof ROUTES !== "undefined") {
    ROUTES.share = function (el, arg) {
      let d = null;
      try { d = JSON.parse(unb64u(String(arg || location.hash.split("/share/")[1] || ""))); } catch {}
      if (!d || d.v !== 1 || !Array.isArray(d.p) || !d.p.length) {
        el.innerHTML = `<div class="page"><h1>Shared flight</h1><section class="panel"><p>This link is not a complete AeroSignal flight. Ask the sender to share it again.</p><a class="btn sm" href="#/plan">Go to Plan</a></section></div>`;
        return;
      }
      const pts = d.p.map((x) => ({ ident: String(x[0] || "").slice(0, 12), lat: +x[1], lon: +x[2], kind: String(x[3] || "").slice(0, 12), elev: x[4] == null ? null : +x[4], name: String(x[5] || "").slice(0, 60) })).filter((p) => isFinite(p.lat) && isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
      const from = pts[0].ident, to = pts[pts.length - 1].ident;
      el.innerHTML = `<div class="page"><h1>Shared flight</h1><section class="panel shr-box"><h2>${h(from)} to ${h(to)}</h2>
        <dl><dt>Route</dt><dd>${h(String(d.r || pts.map((p) => p.ident).join(" ")).slice(0, 400))}</dd><dt>Date and time</dt><dd>${h(d.d)} ${h(d.t)} (local)</dd><dt>Rules</dt><dd>${h(d.ru)}</dd>
        ${d.ca ? `<dt>Cruise</dt><dd>${h(d.ca)}</dd>` : ""}${d.al ? `<dt>Alternate</dt><dd>${h(d.al)}</dd>` : ""}${d.ty ? `<dt>Aircraft type</dt><dd>${h(d.ty)}</dd>` : ""}${(d.m || []).length ? `<dt>Training routes</dt><dd>${h(d.m.join(", "))}</dd>` : ""}</dl>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" id="shrAdd" type="button">Add to my flights and brief it</button><a class="btn sec sm" href="#/plan">Not now</a></div>
        <p class="small muted" style="margin:10px 0 0">The flight is added to this device only. Pick your own aircraft on the Flights page; weather, NOTAMs and risks load fresh for you.</p>
        <p class="shr-disc">Shared links carry the route and plan only. Never put CUI or classified information in a route or remark you share.</p></section></div>`;
      el.querySelector("#shrAdd").onclick = () => {
        const f = newFlight();
        f.route = String(d.r || pts.map((p) => p.ident).join(" ")).slice(0, 600);
        f.points = pts; f.unresolved = [];
        if (/^\d{4}-\d{2}-\d{2}$/.test(d.d || "")) f.date = d.d;
        if (/^\d{2}:\d{2}$/.test(d.t || "")) f.time = d.t;
        if (/^(VFR|IFR)$/.test(d.ru || "")) f.rules = d.ru;
        if (d.ca) f.cruiseAlt = /^FL/i.test(d.ca) ? d.ca : +d.ca || f.cruiseAlt;
        if (d.al) f.alternate = String(d.al).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
        if (Array.isArray(d.m) && d.m.length) f.mtrs = d.m.map((x) => String(x).toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 10)).filter(Boolean);
        f.shared = true; f.updated = Date.now();
        save();
        toast("Flight added");
        location.hash = "#/brief";
      };
    };
  }

  // Buttons: Flights page next to Copy route string, and the brief's chip bar
  let t = 0, busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      const copy = document.getElementById("copyR");
      if (copy && !document.getElementById("shrBtn")) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn sec sm"; b.id = "shrBtn"; b.textContent = "Share this flight";
        b.onclick = () => { let f = null; try { f = currentFlight(); } catch {} share(f); };
        copy.after(b);
      }
      const j = /^#\/brief(\/|$|\?)/.test(location.hash || "") && document.querySelector("#view .page #bfJump");
      let f = null; try { f = currentFlight(); } catch {}
      if (j && f && !f.missionId && !j.querySelector(".shr-chip")) {
        const a = document.createElement("a"); a.href = "#"; a.className = "shr-chip"; a.textContent = "Share flight";
        a.onclick = (e) => { e.preventDefault(); share(currentFlight()); };
        j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 250); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  if (/^#\/share\//.test(location.hash || "")) setTimeout(() => { try { go(); } catch {} }, 0);
  window.AeroShare = { linkFor, payload, share };
})();
