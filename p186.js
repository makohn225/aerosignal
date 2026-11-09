"use strict";
/* p186: route points you can see and checkpoints you would pick (November 6, 2026, anticipating tester feedback:
   "I'm not a major fan of how it chooses route points" and "is there a tab that spells out each point?").
   1. Maps gets a fourth sidebar tab, Route: every point in order with its name, the magnetic course and
      distance of each leg, the running total, and a total time at the planned speed when one is set.
   2. Add VFR checkpoints, on that tab and on the Flights page: long direct legs get a checkpoint about every
      20 nm, the way a pilot picks them for pilotage, preferring public airports within 5 nm of the line
      (each one is also a place to divert; private strips and military fields are skipped), then VORs. The result can be undone, and it works together with
      Avoid special use airspace (p184): add checkpoints first, then reroute. Uses the nearfix lookup only. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = Math.PI / 180, NM = 3440.065;
  const css = document.createElement("style");
  css.textContent = `
    #mctl .mtabs{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:4px!important}
    #mctl .mtabs button{min-width:0!important;padding-left:4px!important;padding-right:4px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #ptsSec{display:none;padding:12px 14px}
    .hzpanel[data-tab="pts"] #ptsSec{display:block}
    .hzpanel[data-tab="pts"] > :not(.mtabs):not(#ptsSec):not(.sheetgrip):not(#mpSafety){display:none!important}
    #ptsSec table{width:100%;border-collapse:collapse;font-size:13px}
    #ptsSec th,#ptsSec td{text-align:left;padding:5px 4px;border-top:1px solid var(--line2,rgba(255,255,255,.1));vertical-align:top}
    #ptsSec td.n,#ptsSec th.n{text-align:right;font-family:var(--mono,monospace);white-space:nowrap}
    #ptsSec td small{display:block;color:var(--ink2,#9db2ce);font-size:11.5px}
    .cp-box{margin-top:10px}
    .cp-box .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .cp-box .msg{font-size:13px;margin:6px 0 0}`;
  document.head.appendChild(css);

  function dist(a, b) {
    const p1 = a.lat * R, p2 = b.lat * R, dp = p2 - p1, dl = (b.lon - a.lon) * R;
    const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * NM * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function brg(a, b) {
    const p1 = a.lat * R, p2 = b.lat * R, dl = (b.lon - a.lon) * R;
    return (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / R + 360) % 360;
  }
  const mag = (t, at) => { try { return window.AeroMag ? AeroMag.magOf(t, at.lat, at.lon) : t; } catch (e) { return t; } };
  const deg = (d) => String(Math.round(d) % 360 || 360).padStart(3, "0") + "°";
  const lerp = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
  function xtrack(a, b, p) {
    // cross track and along track distance (nm) of p from leg a to b, flat frame
    const k = Math.cos(((a.lat + b.lat) / 2) * R) * 60;
    const ax = a.lon * k, ay = a.lat * 60, bx = b.lon * k - ax, by = b.lat * 60 - ay, px = p.lon * k - ax, py = p.lat * 60 - ay;
    const L = Math.hypot(bx, by) || 1;
    return { x: Math.abs(bx * py - by * px) / L, along: (bx * px + by * py) / L, len: L };
  }
  const pts = (f) => ((f && f.points) || []).filter((p) => p && isFinite(p.lat) && isFinite(p.lon));

  // ---------- checkpoints ----------
  const near = new Map();
  function lookup(p) {
    const k = `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
    if (!near.has(k)) near.set(k, fnGet(`nearfix?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}&r=9&only=report`).then((j) => (j && Array.isArray(j.rows) ? j.rows : [])).catch(() => (near.delete(k), [])));
    return near.get(k);
  }
  async function suggest(f, every) {
    const P = pts(f); if (P.length < 2) throw new Error("Load a route with at least two points first");
    const step = every || 20, out = [P[0]], used = new Set(P.map((p) => p.ident));
    let added = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], len = dist(a, b);
      const n = Math.round(len / step) - 1;
      // FAA airport data (p192): only public use airports (Nov 8)
      let pub = null;
      if (n > 0 && window.AeroFAA) { try { pub = await AeroFAA.publicSet(Math.min(a.lat, b.lat) - 0.2, Math.min(a.lon, b.lon) - 0.25, Math.max(a.lat, b.lat) + 0.2, Math.max(a.lon, b.lon) + 0.25); if (!pub.size) pub = null; } catch (e) { pub = null; } }
      for (let s = 1; s <= n; s++) {
        const t = s / (n + 1), at = lerp(a, b, t), want = len * t;
        const rows = await lookup(at);
        let best = null, bestScore = Infinity;
        for (const r of rows) {
          if (!r.ident || used.has(r.ident)) continue;
          if (pub && r.kind === "airport" && !pub.has(r.ident)) continue;
          // Four character idents with a digit (2FL5, FD04) are almost always private fields: not a checkpoint to plan on
          if (r.kind === "airport" && /^[A-Z0-9]{4}$/.test(r.ident) && /\d/.test(r.ident) && !/^K/.test(r.ident)) continue;
          // Military fields need prior permission: not a checkpoint or a place to divert for most pilots
          if (r.kind === "airport" && /\b(NAS|NAF|NOLF|OLF|AFB|AAF|AHP|MCAS|MCAF|JRB|ANGB|Naval|Army|Air Force|Air Base|Marine Corps)\b/i.test(r.name || "")) continue;
          const q = { lat: +r.lat, lon: +r.lon }, xt = xtrack(a, b, q);
          if (xt.x > 5 || Math.abs(xt.along - want) > step * 0.45 || xt.along < 4 || xt.along > xt.len - 4) continue;
          const isK = r.kind === "airport" && /^K[A-Z0-9]{3}$/.test(r.ident);
          const score = xt.x + (r.kind === "airport" ? (isK ? 0 : 2) : 1.5) + Math.abs(xt.along - want) * 0.08;
          if (score < bestScore) { bestScore = score; best = { ident: r.ident, name: r.name, kind: r.kind === "airport" ? "airport" : "navaid", lat: +r.lat, lon: +r.lon, elev: null }; }
        }
        if (best) { out.push(best); used.add(best.ident); added++; }
      }
      out.push(b);
    }
    return { points: out, added };
  }
  async function apply(f, res) {
    f._cpPrev = { route: f.route, points: f.points };
    const route = res.points.map((p) => p.ident).join(" ");
    let r = null; try { r = await resolveRoute(route); } catch (e) {}
    f.route = (r && r.route) || route;
    f.points = r && Array.isArray(r.points) && r.points.length >= res.points.length ? r.points : res.points;
    f.updated = Date.now(); save();
  }
  function box() {
    const el = document.createElement("div"); el.className = "cp-box";
    el.innerHTML = `<b>VFR checkpoints</b><p class="small muted" style="margin:2px 0 6px">Adds a checkpoint about every 20 nm on long legs, preferring public airports near the line, then VORs.</p>
      <div class="row"><button type="button" class="btn sm" data-cp>Add VFR checkpoints</button><button type="button" class="btn sec sm" data-un hidden>Undo</button></div><div class="msg" data-m></div>`;
    const m = el.querySelector("[data-m]"), go = el.querySelector("[data-cp]"), un = el.querySelector("[data-un]");
    const f0 = currentFlight(); if (f0 && f0._cpPrev) { un.hidden = false; if (f0._cpMsg) m.textContent = f0._cpMsg; }
    go.onclick = async () => {
      const f = currentFlight(); if (!f) return;
      go.disabled = true; m.textContent = "Looking for checkpoints along the route…";
      try {
        const res = await suggest(f);
        if (!res.added) { m.textContent = "No legs long enough, or no airports or VORs close to the line. No change."; return; }
        await apply(f, res);
        f._cpMsg = `Added ${res.added} checkpoint${res.added === 1 ? "" : "s"}: ${res.points.filter((p, i) => i && i < res.points.length - 1 && !pts({ points: f._cpPrev.points }).some((q) => q.ident === p.ident)).map((p) => p.ident).join(", ")}.`;
        save(); toast("Checkpoints added");
        setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 400);
      } catch (e) { console.error(e); m.textContent = e.message || "Checkpoints could not be found right now."; }
      finally { go.disabled = false; }
    };
    un.onclick = () => {
      const f = currentFlight(); if (!f || !f._cpPrev) return;
      f.route = f._cpPrev.route; f.points = f._cpPrev.points; delete f._cpPrev; delete f._cpMsg; save();
      toast("Original route restored"); window.dispatchEvent(new HashChangeEvent("hashchange"));
    };
    return el;
  }

  // ---------- Route tab on Maps ----------
  function speedOf(f) {
    let kt = null;
    try { const nl = f.nl || {}; kt = Number(nl.tas) || null; } catch (e) {}
    if (!kt) try { const a = (allAircraft() || {})[f.tail]; kt = a && (Number(a.cruiseKt) || Number(a.tas) || Number(a.cruise)) || null; } catch (e) {}
    return kt;
  }
  function table(f) {
    const P = pts(f);
    if (P.length < 2) return `<p class="muted" style="margin:0">Plan a route to see each point here.</p>`;
    let cum = 0; const kt = speedOf(f);
    const rows = P.map((p, i) => {
      let leg = "", d = 0;
      if (i) { d = dist(P[i - 1], p); cum += d; leg = `${deg(mag(brg(P[i - 1], p), P[i - 1]))}M`; }
      const nm = p.name && p.name !== p.ident && p.name !== "User waypoint" ? p.name : p.kind === "user" ? "Coordinate waypoint" : "";
      return `<tr><td class="n">${i + 1}</td><td><b>${h(p.ident)}</b>${nm ? `<small>${h(nm)}</small>` : ""}</td><td class="n">${leg}</td><td class="n">${i ? `${d.toFixed(1)}` : ""}</td><td class="n">${i ? Math.round(cum) : ""}</td></tr>`;
    }).join("");
    const time = kt ? ` · about ${Math.floor(Math.round((cum / kt) * 60) / 60)}:${String(Math.round((cum / kt) * 60) % 60).padStart(2, "0")} at ${kt} kt, no wind` : "";
    return `<p style="margin:0 0 6px"><b>${P.length} points, ${Math.round(cum)} nm</b><span class="small muted">${time}</span></p>
      <table><tr><th class="n">#</th><th>Point</th><th class="n">Course</th><th class="n">Leg nm</th><th class="n">Total</th></tr>${rows}</table>
      <p class="small muted" style="margin:6px 0 0">Courses are magnetic, without wind. The brief's nav log adds wind, headings, times and fuel. To change the route, use Edit route on the map.</p>`;
  }
  function mapsTab() {
    const panel = document.querySelector("#mctl.hzpanel"), tabs = panel && panel.querySelector(".mtabs");
    if (!panel || !tabs) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!tabs.querySelector('[data-t="pts"]')) {
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "tab"); b.dataset.t = "pts"; b.textContent = "Route"; b.setAttribute("aria-selected", "false"); b.tabIndex = -1;
      tabs.appendChild(b);
      // p17 sets the selected state on its own buttons; keep ours in step
      tabs.addEventListener("click", (e) => { const t = e.target.closest("button[data-t]"); if (!t) return; tabs.querySelectorAll("button[data-t]").forEach((x) => x.setAttribute("aria-selected", String(x === t))); }, true);
    }
    let sec = panel.querySelector("#ptsSec");
    if (!sec) { sec = document.createElement("section"); sec.id = "ptsSec"; panel.appendChild(sec); }
    const key = f ? `${f.id}|${(f.points || []).map((p) => p.ident).join(" ")}|${f.tail || ""}` : "";
    if (sec.dataset.k !== key) {
      sec.dataset.k = key;
      sec.innerHTML = `<div data-tbl>${f ? table(f) : `<p class="muted" style="margin:0">Plan a flight first.</p>`}</div>`;
      if (f && pts(f).length >= 2) sec.appendChild(box());
    }
  }
  function scan() {
    const hash = location.hash || "";
    if (/^#\/maps/.test(hash)) mapsTab();
    if (/^#\/(flights|plan)/.test(hash)) {
      const sua = document.querySelector(".sua-av");
      const row = document.querySelector("#xfpl") && document.querySelector("#xfpl").closest(".row");
      const anchor = sua || row;
      if (anchor && !anchor.parentElement.querySelector(".cp-box")) anchor.before(box());
    }
  }
  let t = 0;
  new MutationObserver((list) => {
    if (list.every((m) => m.target.closest && m.target.closest("#ptsSec, .cp-box"))) return;
    clearTimeout(t); t = setTimeout(() => { try { scan(); } catch (e) { console.error(e); } }, 350);
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroCheckpoints = { suggest, table, xtrack };
})();
