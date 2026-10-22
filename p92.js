"use strict";
/* p92: airspace along the route. Before flight, the brief checks the planned route and altitude profile
   (climb to cruise, cruise, descent, from p90) against FAA Class B, C and D airspace and special use
   airspace (restricted, prohibited, warning, MOA, alert) from the FAA's public ADDS data, and lists
   each one the route enters, where along the route, at what planned altitude, its floor and ceiling,
   and what it needs: a clearance for Class B, two way radio contact for C and D, an activity check for
   restricted and MOA. One line goes in the bottom line card. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #asPanel ul{list-style:none;margin:6px 0 0;padding:0}
    #asPanel li{padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08));font-size:14px;line-height:1.45}
    #asPanel li:first-child{border-top:0}
    #asPanel .tg{display:inline-block;font:700 10.5px var(--mono,monospace);padding:1px 7px;border-radius:999px;border:1px solid currentColor;margin-right:6px;vertical-align:1px}
    #asPanel .c-b{color:#5aa9ff}#asPanel .c-c{color:#ff4fd8}#asPanel .c-d{color:#7cc4ff}#asPanel .c-r{color:#ff4d6a}#asPanel .c-m{color:#ffb648}
    #asPanel .need{display:block;font-size:13px;color:var(--ink2)}
    #asPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #bfBluf .bf-as{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-as .bad{color:#ff4d6a;font-weight:700}#bfBluf .bf-as .warn{color:#ffb648;font-weight:700}#bfBluf .bf-as .ok{color:#46e39b;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const FAA = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services";

  async function query(svc, env, where, fields) {
    const u = new URL(`${FAA}/${svc}/FeatureServer/0/query`);
    const p = { where, geometry: `${env[1]},${env[0]},${env[3]},${env[2]}`, geometryType: "esriGeometryEnvelope", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: fields, outSR: "4326", maxAllowableOffset: "0.002", resultRecordCount: "300", f: "geojson" };
    for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
    const r = await fetch(u);
    if (!r.ok) throw new Error("FAA airspace service error");
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || "FAA airspace query failed");
    return j.features || [];
  }
  function rings(g) {
    if (!g) return [];
    if (g.type === "Polygon") return [g.coordinates];
    if (g.type === "MultiPolygon") return g.coordinates;
    return [];
  }
  function inside(poly, lat, lon) {
    // poly: [outer, holes...] in [lon, lat]
    const inRing = (ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c; } return c; };
    if (!poly.length || !inRing(poly[0])) return false;
    for (let k = 1; k < poly.length; k++) if (inRing(poly[k])) return false;
    return true;
  }
  const ft = (val, uom, code) => {
    if (val == null || val === "") return null;
    let v = +val; if (!isFinite(v)) return null;
    if (/FL/i.test(uom || "")) v *= 100;
    return { ft: v, agl: /SFC|AGL|HEI/i.test(code || "") };
  };
  const altTxt = (a, desc) => { if (desc && /SFC|SURFACE/i.test(desc)) return "surface"; if (!a) return desc || "?"; if (a.ft === 0) return "surface"; return a.ft >= 18000 ? `FL${Math.round(a.ft / 100)}` : `${fmt(a.ft)} ft${a.agl ? " AGL" : ""}`; };

  function profileAlt(f, x, vn) {
    if (!vn) return null;
    const climb = vn.e0 + (x / Math.max(0.1, vn.tocNm)) * (vn.alt - vn.e0);
    const desc = vn.e1 + 1000 + ((vn.total - x) / Math.max(0.1, vn.todNm)) * (vn.alt - vn.e1 - 1000);
    return Math.max(Math.min(vn.alt, climb, desc), Math.min(vn.e0, vn.e1));
  }

  async function load(f) {
    const pts = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    if (pts.length < 2) return null;
    const vn = window.AeroVnav ? AeroVnav.vnav(f) : null;
    let a = 90, b = 180, c = -90, d = -180;
    for (const p of pts) { a = Math.min(a, p.lat); b = Math.min(b, p.lon); c = Math.max(c, p.lat); d = Math.max(d, p.lon); }
    const env = [a - 0.15, b - 0.15, c + 0.15, d + 0.15];
    const [cls, sua] = await Promise.all([
      query("Class_Airspace", env, "CLASS IN ('B','C','D')", "NAME,CLASS,LOCAL_TYPE,IDENT,UPPER_DESC,UPPER_VAL,UPPER_UOM,UPPER_CODE,LOWER_DESC,LOWER_VAL,LOWER_UOM,LOWER_CODE").catch(() => null),
      query("Special_Use_Airspace", env, "1=1", "NAME,TYPE_CODE,UPPER_DESC,UPPER_VAL,UPPER_UOM,UPPER_CODE,LOWER_DESC,LOWER_VAL,LOWER_UOM,LOWER_CODE,TIMESOFUSE,CONT_AGENT").catch(() => null),
    ]);
    if (!cls && !sua) return { error: true };
    // Route samples every 1 nm with along distance and planned altitude
    const S2 = [];
    let at = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const dd = 60 * Math.hypot(q.lat - p.lat, (q.lon - p.lon) * Math.cos(((p.lat + q.lat) / 2) * R));
      const n = Math.max(1, Math.ceil(dd));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) { const x = at + (dd * k) / n; S2.push({ lat: p.lat + ((q.lat - p.lat) * k) / n, lon: p.lon + ((q.lon - p.lon) * k) / n, x, alt: profileAlt(f, x, vn) }); }
      at += dd;
    }
    const hits = [];
    const check = (feat, kind) => {
      const pr = feat.properties || {};
      const lo = ft(pr.LOWER_VAL, pr.LOWER_UOM, pr.LOWER_CODE), hi = ft(pr.UPPER_VAL, pr.UPPER_UOM, pr.UPPER_CODE);
      const polys = rings(feat.geometry);
      let from = null, to = null, minA = Infinity, maxA = -Infinity, inAlt = false;
      for (const s of S2) {
        if (!polys.some((pl) => inside(pl, s.lat, s.lon))) continue;
        if (from == null) from = s.x; to = s.x;
        if (s.alt != null) {
          minA = Math.min(minA, s.alt); maxA = Math.max(maxA, s.alt);
          // AGL limits are compared roughly against field elevation of the nearer end
          const ref = Math.min(vn ? vn.e0 : 0, vn ? vn.e1 : 0);
          const floor = lo ? lo.ft + (lo.agl && lo.ft ? ref : 0) : 0, ceil = hi ? hi.ft + (hi.agl ? ref : 0) : 99999;
          if (s.alt >= floor - 100 && s.alt <= ceil + 100) inAlt = true;
        } else inAlt = true;
      }
      if (from == null) return;
      hits.push({ kind, name: pr.NAME || pr.IDENT || "", cls: pr.CLASS || pr.TYPE_CODE || "", from, to, minA, maxA, inAlt, lo: altTxt(lo, pr.LOWER_DESC), hi: altTxt(hi, pr.UPPER_DESC), times: pr.TIMESOFUSE || "", agency: pr.CONT_AGENT || "" });
    };
    for (const ft_ of cls || []) check(ft_, "class");
    for (const ft_ of sua || []) check(ft_, "sua");
    // Merge pieces of the same airspace (shelves of one Class B share a name)
    const byKey = new Map();
    for (const x of hits) {
      const k = `${x.kind}|${x.cls}|${x.name}`;
      const c0 = byKey.get(k);
      if (!c0) { byKey.set(k, { ...x, shelves: [x] }); continue; }
      c0.from = Math.min(c0.from, x.from); c0.to = Math.max(c0.to, x.to); c0.inAlt = c0.inAlt || x.inAlt; c0.minA = Math.min(c0.minA, x.minA); c0.maxA = Math.max(c0.maxA, x.maxA); c0.shelves.push(x);
    }
    const rank = (x) => (x.kind === "sua" ? ({ P: 0, R: 1, W: 3, MOA: 4, M: 4, A: 5 }[x.cls] ?? 6) : { B: 0.5, C: 2, D: 2.5 }[x.cls] ?? 6);
    const list = [...byKey.values()].sort((p, q) => (q.inAlt - p.inAlt) || rank(p) - rank(q) || p.from - q.from);
    return { list, vn, partial: !cls || !sua };
  }

  function need(x) {
    if (x.kind === "class") return x.cls === "B" ? "Needs an ATC clearance to enter. A 30 nm Mode C veil surrounds it." : x.cls === "C" ? "Two way radio contact with ATC before entering." : "Two way radio contact with the tower before entering, while it is open.";
    return { P: "Prohibited. Do not enter.", R: "Restricted. Do not enter while active without permission from the controlling agency.", W: "Warning area. Hazardous activity offshore; check status.", MOA: "Military Operations Area. Check whether it is active and use caution.", M: "Military Operations Area. Check whether it is active and use caution.", A: "Alert area. High volume training; extra vigilance." }[x.cls] || "Check its status before flight.";
  }
  const tagCls = (x) => (x.kind === "class" ? { B: "c-b", C: "c-c", D: "c-d" }[x.cls] : /^(R|P|W)$/.test(x.cls) ? "c-r" : "c-m");
  const tagTxt = (x) => (x.kind === "class" ? `CLASS ${x.cls}` : { R: "RESTRICTED", P: "PROHIBITED", W: "WARNING", MOA: "MOA", M: "MOA", A: "ALERT" }[x.cls] || x.cls);

  function paint(sec, r) {
    if (!r) { sec.innerHTML = `<h2>Airspace</h2><p class="small muted" style="margin:0">Checking airspace along your route…</p>`; return; }
    if (r.error) { sec.innerHTML = `<h2>Airspace</h2><p class="small muted" style="margin:0">Could not reach the FAA airspace service right now. Check the chart.</p>`; return; }
    const inA = r.list.filter((x) => x.inAlt), out = r.list.filter((x) => !x.inAlt);
    const li = (x) => `<li><span class="tg ${tagCls(x)}">${h(tagTxt(x))}</span><b>${h(x.name)}</b>${x.shelves.length > 1 ? ` <span class="small muted">(${x.shelves.length} parts)</span>` : ""}<span class="need">Route nm ${fmt(Math.floor(x.from))} to ${fmt(Math.ceil(x.to))}${isFinite(x.minA) ? `, planned ${fmt(Math.floor(x.minA / 100) * 100)}${x.maxA - x.minA > 100 ? ` to ${fmt(Math.ceil(x.maxA / 100) * 100)}` : ""} ft` : ""}. ${x.shelves.length > 1 ? "Floors and ceilings vary by part" : `Floor ${h(x.lo)}, ceiling ${h(x.hi)}`}.${x.times ? ` Times: ${h(String(x.times).slice(0, 120))}.` : ""}${x.agency ? ` Controlling agency: ${h(x.agency)}.` : ""}</span><span class="need"><b>${h(need(x))}</b></span></li>`;
    sec.innerHTML = `<h2>Airspace</h2>
      <p class="small" style="margin:0">${inA.length ? `Your route and planned altitudes enter ${inA.length} airspace${inA.length === 1 ? "" : "s"} that need${inA.length === 1 ? "s" : ""} action.` : "Your route and planned altitudes stay clear of Class B, C and D and special use airspace."}${r.vn ? "" : " Altitudes are not known, so every airspace under the route is listed."}${r.partial ? " Part of the FAA data did not load." : ""}</p>
      ${inA.length ? `<ul>${inA.map(li).join("")}</ul>` : ""}
      ${out.length ? `<details style="margin-top:8px"><summary class="small">${out.length} more above or below your planned altitude</summary><ul>${out.map(li).join("")}</ul></details>` : ""}
      <p class="disc">From FAA airspace data for planning, using your planned climb and descent. Check the current chart, NOTAMs and special use airspace status, and follow ATC.</p>`;
  }
  function bluf(page, r) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    let el = card.querySelector(".bf-as");
    if (!r || r.error) { if (el) el.remove(); return; }
    const inA = r.list.filter((x) => x.inAlt);
    const bad = inA.filter((x) => (x.kind === "class" && x.cls === "B") || (x.kind === "sua" && /^(P|R)$/.test(x.cls)));
    const html = inA.length ? `Airspace: ${inA.slice(0, 3).map((x) => `<span class="${bad.includes(x) ? "bad" : "warn"}">${h(tagTxt(x).replace("CLASS ", "Class "))}</span> ${h(x.name)}`).join("; ")}${inA.length > 3 ? ` and ${inA.length - 3} more` : ""}. <a href="#" data-as="1">Details</a>` : `Airspace: <span class="ok">CLEAR</span> of Class B, C, D and special use at your planned altitudes.`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-as"; const after = card.querySelector(".bf-adv") || card.querySelector(".bf-wx"); if (after) after.after(el); else card.appendChild(el); }
    el.dataset.v = html; el.innerHTML = html;
    const a = el.querySelector("[data-as]"); if (a) a.onclick = jump;
  }
  function jump(e) {
    e.preventDefault();
    const s = document.getElementById("asPanel");
    if (!s) return;
    if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true);
    s.style.scrollMarginTop = "84px";
    s.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  let busy = false, t = 0;
  const st = { key: "", r: null };
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId || (f.points || []).length < 2 || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${f.cruiseAlt || f.alt || ""}|${f.rules}|${JSON.stringify(S.vnav || {})}`;
      let sec = page.querySelector(":scope > #asPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "asPanel"; }
      if (st.key !== key) {
        st.key = key; st.r = null; sec.dataset.k = "";
        load(f).then((r) => { if (st.key === key) { st.r = r; sec.dataset.k = ""; kick(); } }).catch(() => { if (st.key === key) { st.r = { error: true }; kick(); } });
      }
      const stamp = `${key}|${st.r ? 1 : 0}`;
      if (sec.dataset.k !== stamp) { sec.dataset.k = stamp; paint(sec, st.r); }
      bluf(page, st.r);
      // Just after Turbulence and icing (p79), which nothing else positions itself against
      const anchor = page.querySelector(":scope > #advPanel") || page.querySelector(":scope > #ntPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) { const g = page.querySelector(":scope > #goPanel"); if (g) g.after(sec); else page.appendChild(sec); }
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#asPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#asPanel"; a.textContent = "Airspace"; a.onclick = jump;
        const w = j.querySelector('[data-s="#advPanel"]'); if (w) w.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 330); };
  new MutationObserver((l) => {
    if (busy) return;
    if (l.every((m) => m.target.closest && m.target.closest("#asPanel, #bfBluf .bf-as"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroAirspace = { load, inside };
})();
