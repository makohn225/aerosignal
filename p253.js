"use strict";
/* p253: decision points (November 13, 2026). Many accidents along a route are a decision made too late: pressing on
   toward cloud covered ridges, stretching fuel, or continuing to a destination that went below minimums. Pilots
   are taught to decide those things on the ground, before the pressure of the moment, and then just follow the
   plan. The brief now does that work with the pilot. A Decision points panel (#dpPanel, at the end of the brief
   chain) places up to three pre committed decisions on the route, each at a spot where there is still an easy
   way out:
   1. Ridge check, about 10 nm before the highest ground on the route (only when it is high or close to the
      planned altitude): the cloud base you need to continue, and the airport behind you to turn back to.
   2. Fuel check, at the halfway point (or one hour in): the fuel you should have, the least you can accept, and
      where to land if you have less.
   3. Destination weather, about 25 nm out: get the destination weather, and the alternate to use if it is below
      your minimums.
   The decisions are saved with the flight. On the Fly screen the next decision point shows with its distance,
   and when the aircraft is within 3 nm of it the decision is shown in full (with a vibration where the device
   supports it), so the plan made on the ground is in front of the pilot at the moment it matters.
   Terrain is from public elevation tiles (p189), airports from the diversion list (p84) and FAA data (p192),
   fuel from the nav log figures (p192). The pilot can turn any point off. */
(function () {
  const R = Math.PI / 180;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #dpPanel ol{margin:6px 0 0;padding:0;list-style:none;counter-reset:dp}
    #dpPanel li{position:relative;padding:10px 0 10px 44px;border-top:1px solid var(--line2,rgba(255,255,255,.08));font-size:14.5px;line-height:1.5}
    #dpPanel li:first-child{border-top:0}
    #dpPanel li::before{counter-increment:dp;content:counter(dp);position:absolute;left:0;top:10px;width:30px;height:30px;border-radius:50%;border:2px solid #3DE0FF;color:#3DE0FF;font:700 15px var(--body,system-ui);display:flex;align-items:center;justify-content:center}
    #dpPanel li.off{opacity:.5}
    #dpPanel .dp-t{font-weight:700}
    #dpPanel .dp-w{font-size:12.5px;opacity:.75}
    #dpPanel .dp-x{appearance:none;border:0;background:transparent;color:inherit;text-decoration:underline;font-size:12.5px;padding:4px 0;cursor:pointer;opacity:.8}
    #dpFly{border:2px solid rgba(61,224,255,.5);border-radius:14px;padding:10px 14px;margin:0 0 14px;font-size:15px;line-height:1.45}
    #dpFly.now{border-color:#e0a100;background:rgba(224,161,0,.12)}
    #dpFly .dp-h{font-weight:700;font-size:13px;letter-spacing:.5px;text-transform:uppercase;opacity:.85;margin-bottom:4px}
    #dpFly.now .dp-h{color:#e0a100;opacity:1}
    #dpFly b{font-size:16px}`;
  document.head.appendChild(css);
  const dist = (a, b) => { const p1 = a.lat * R, p2 = b.lat * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2; return 3440.065 * 2 * Math.asin(Math.min(1, Math.sqrt(x))); };
  const pts = (f) => ((f && f.points) || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
  const up100 = (x) => Math.ceil(x / 100) * 100;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  // Samples every 1 nm with along route distance
  function samples(P) {
    const out = [{ lat: P[0].lat, lon: P[0].lon, at: 0 }]; let at = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], d = dist(a, b), n = Math.max(1, Math.ceil(d));
      for (let k = 1; k <= n; k++) out.push({ lat: a.lat + ((b.lat - a.lat) * k) / n, lon: a.lon + ((b.lon - a.lon) * k) / n, at: at + (d * k) / n });
      at += d;
    }
    return out;
  }
  async function terrain(S2) {
    const E = window.AeroPreview && AeroPreview.elev; if (!E) return null;
    let got = [];
    for (let tries = 0; tries < 30; tries++) {
      got = S2.map((s) => E(s.lat, s.lon));
      const have = got.filter((v) => v != null).length;
      if (have >= S2.length * 0.95) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const ok = got.filter((v) => v != null).length;
    if (ok < S2.length * 0.8) return null;
    let best = null;
    S2.forEach((s, i) => { const m = got[i]; if (m == null) return; const ft = m * 3.28084; if (!best || ft > best.ft) best = { ft, at: s.at, lat: s.lat, lon: s.lon }; });
    return best;
  }
  async function airports(f, P, total) {
    let list = [];
    try { const d = window.AeroDivert ? await AeroDivert.load(f) : null; if (d && d.aps) list = d.aps.map((a) => ({ ident: a.ident, name: a.name, lat: a.lat, lon: a.lon, at: a.along, off: a.off, fuel: a.fuel })); } catch (e) {}
    const dep = P[0], dst = P[P.length - 1];
    list.push({ ident: dep.ident, name: dep.name || "", lat: dep.lat, lon: dep.lon, at: 0, off: 0, dep: true });
    list.push({ ident: dst.ident, name: dst.name || "", lat: dst.lat, lon: dst.lon, at: total, off: 0, dst: true });
    return list.filter((a) => a.ident);
  }
  const fuelTxt = (a) => (a.fuel ? ` (${h(window.AeroFAA ? AeroFAA.fuelText(a.fuel) : a.fuel)})` : "");
  async function build(f) {
    const P = pts(f); if (P.length < 2) return [];
    const S2 = samples(P), total = S2[S2.length - 1].at;
    let alt = 0; try { alt = window.AeroVnav ? AeroVnav.cruise(f) : 0; } catch (e) {}
    const aps = await airports(f, P, total);
    const out = [];
    // 1. Ridge check
    const hi = await terrain(S2);
    if (hi && total > 25 && (hi.ft >= 2500 || (alt && alt - hi.ft < 2500)) && hi.at > 12 && hi.at < total - 5) {
      const at = Math.max(5, hi.at - 10);
      const behind = aps.filter((a) => a.at <= at - 2 && (a.off || 0) <= 10 && !a.dst).sort((a, b) => b.at - a.at)[0] || aps.find((a) => a.dep);
      const base = up100(hi.ft + 1000);
      out.push({ k: "ridge", at, title: "Ridge check", short: `Continue only with cloud bases above ${fmt(base)} ft and the ridgeline in sight. Otherwise turn back to ${behind.ident}.`, text: `Highest ground on the route is about ${fmt(up100(hi.ft))} ft at ${fmt(hi.at)} nm. Before you reach it, decide: if the cloud bases ahead look lower than ${fmt(base)} ft, or you cannot see the ridgeline clearly, turn back to <b>${h(behind.ident)}</b>${behind.at != null ? `, about ${fmt(Math.max(1, at - behind.at))} nm behind you` : ""}.`, why: "Continuing visual flight into cloud over high ground is one of the deadliest accident patterns in the NTSB record." });
    }
    // 2. Fuel check
    let fp = null; try { fp = window.AeroFAA ? await AeroFAA.plan(f, "100LL", 45) : null; } catch (e) {}
    const I = fp && fp.I;
    if (I && I.fuel && I.gph && I.tas && total > 40) {
      const at = Math.min(total / 2, I.tas); // halfway, or about one hour in
      const hrs = at / I.tas, have = I.fuel - I.taxi - I.gph * hrs;
      const need = I.gph * ((total - at) / I.tas) + (I.gph * 45) / 60;
      const near = aps.filter((a) => !a.dep && Math.abs(a.at - at) <= 25 && (a.off || 0) <= 12).sort((a, b) => (b.fuel ? 1 : 0) - (a.fuel ? 1 : 0) || Math.abs(a.at - at) - Math.abs(b.at - at))[0];
      const mins = Math.round(hrs * 60), hh = Math.floor(mins / 60), mm = String(mins % 60).padStart(2, "0");
      out.push({ k: "fuel", at, title: "Fuel check", short: `You should have about ${fmt(Math.max(0, have))} gal. Less than ${fmt(Math.ceil(need))} gal: land at ${near ? near.ident : "the nearest airport with fuel"}.`, text: `At ${fmt(at)} nm (about ${hh}:${mm} after takeoff) you should have about ${fmt(Math.max(0, have))} gal. If you have less than ${fmt(Math.ceil(need))} gal (enough to reach the destination plus 45 minutes), ${near ? `land at <b>${h(near.ident)}</b>${fuelTxt(near)}` : "land at the nearest airport with fuel"}.`, why: "Fuel exhaustion with fuel available on the ground is one of the most preventable accident causes." });
    }
    else if (total > 40) out.push({ k: "fuelhint", at: -1, hint: true });
    // 3. Destination weather
    if (total > 35) {
      const at = Math.max(total - 25, total * 0.6);
      const dst = P[P.length - 1];
      const alts = aps.filter((a) => !a.dst && !a.dep && dist(a, dst) <= 40).sort((a, b) => (b.fuel ? 1 : 0) - (a.fuel ? 1 : 0) || dist(a, dst) - dist(b, dst));
      const alt1 = alts[0];
      out.push({ k: "wx", at, title: "Destination weather", short: `Get the ${dst.ident} weather now. Below your minimums: divert to ${alt1 ? alt1.ident : "your alternate"}.`, text: `About ${fmt(total - at)} nm out, get the ${h(dst.ident)} weather (ATIS, AWOS or ASOS). If it is below your personal minimums, do not try an approach or a scud run: divert to <b>${alt1 ? h(alt1.ident) : "your alternate"}</b>${alt1 ? `${fuelTxt(alt1)}, ${fmt(dist(alt1, dst))} nm from ${h(dst.ident)}` : ""}.`, why: "Deciding the alternate before you are tired and close to home takes the pressure off pressing on." });
    }
    return out.sort((a, b) => a.at - b.at);
  }
  const real = (L) => (L || []).filter((d) => !d.hint);
  const keyOf = (f) => { const nl = f.nl || {}; return `${pts(f).map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(";")}|${f.tail || ""}|${f.alt || ""}|${nl.fuel || (f.wb || {}).fuel || ""}|${nl.gph || ""}|${nl.tas || ""}`; };
  function paint(sec, f) {
    const L = real(f.dps), off = new Set(f.dpOff || []), hint = (f.dps || []).some((d) => d.hint);
    if (!L.length) { sec.innerHTML = `<h2>Decision points</h2><p class="muted" style="margin:0">This route is short and low enough that no decision points are needed.</p>${hint ? `<p class="small" style="margin:6px 0 0">Add start fuel and fuel burn in the nav log to get a fuel check.</p>` : ""}`; return; }
    sec.innerHTML = `<h2>Decision points</h2><p style="margin:0 0 4px">Decide these now, on the ground, and follow the plan in the air. ${L.length === 1 ? "It shows" : "They show"} on the Fly screen as you get close.</p>
      <ol>${L.map((d) => `<li class="${off.has(d.k) ? "off" : ""}"><div class="dp-t">${h(d.title)} <span class="dp-w">at ${fmt(d.at)} nm</span></div><div>${d.text}</div><div class="dp-w">${h(d.why)}</div><button type="button" class="dp-x" data-k="${h(d.k)}">${off.has(d.k) ? "Turn back on" : "Turn off"}</button></li>`).join("")}</ol>
      ${hint ? `<p class="small" style="margin:8px 0 0">Add start fuel and fuel burn in the nav log to get a fuel check too.</p>` : ""}
      <p class="small muted" style="margin:8px 0 0">Distances are along the route from the departure. Terrain from public elevation data, airports and fuel from FAA data. Planning aid only.</p>`;
    sec.querySelectorAll(".dp-x").forEach((b) => (b.onclick = () => { const s = new Set(f.dpOff || []); s.has(b.dataset.k) ? s.delete(b.dataset.k) : s.add(b.dataset.k); f.dpOff = [...s]; try { save(); } catch (e) {} paint(sec, f); }));
  }
  // Fly screen: next decision point
  function along(P, pos) {
    let best = null, at = 0;
    for (let i = 1; i < P.length; i++) {
      const a = P[i - 1], b = P[i], L = dist(a, b), k = Math.cos(((a.lat + b.lat) / 2) * R);
      const ax = 0, ay = 0, bx = (b.lon - a.lon) * k * 60, by = (b.lat - a.lat) * 60, px = (pos.lon - a.lon) * k * 60, py = (pos.lat - a.lat) * 60;
      const L2 = bx * bx + by * by || 1e-9, t = Math.max(0, Math.min(1, (px * bx + py * by) / L2));
      const x = Math.hypot(px - (ax + t * bx), py - (ay + t * by));
      if (!best || x < best.x) best = { x, s: at + t * L };
      at += L;
    }
    return best;
  }
  let lastBuzz = "";
  function flyCard(page, f) {
    const L = real(f.dps).filter((d) => !(f.dpOff || []).includes(d.k)); let el = page.querySelector("#dpFly");
    if (!L.length) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "dpFly"; const anchor = page.querySelector("#ofFly") || page.querySelector("h1"); if (anchor) anchor.after(el); else page.prepend(el); }
    const pos = window.AeroFly && AeroFly.state && AeroFly.state.pos;
    const g = pos ? along(pts(f), pos) : null;
    const s = g && g.x < 25 ? g.s : null;
    const next = L.find((d) => s == null || d.at >= s - 1);
    if (!next) { el.className = ""; el.innerHTML = `<div class="dp-h">Decision points</div>All decision points are behind you.`; return; }
    const to = s == null ? null : next.at - s, now = to != null && to <= 3;
    el.className = now ? "now" : "";
    const html = `<div class="dp-h">${now ? "Decision point now" : "Next decision point"}${to != null && !now ? ` in ${fmt(Math.max(0, to))} nm` : to == null ? ` at ${fmt(next.at)} nm` : ""}</div><b>${h(next.title)}.</b> ${h(next.short || "")}`;
    if (el.innerHTML !== html) el.innerHTML = html;
    if (now && lastBuzz !== next.k) { lastBuzz = next.k; try { if (navigator.vibrate) navigator.vibrate([200, 120, 200]); } catch (e) {} }
  }
  let busy = false, t = 0;
  async function apply() {
    if (busy) return;
    const hash = location.hash || "", page = document.querySelector("#view .page"); if (!page) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!f || f.missionId || pts(f).length < 2) return;
    if (/^#\/fly/.test(hash)) { flyCard(page, f); return; }
    if (!/^#\/brief(\/|$|\?)/.test(hash) || !page.querySelector("#bfBluf")) return;
    busy = true;
    try {
      let sec = page.querySelector(":scope > #dpPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "dpPanel"; sec.innerHTML = `<h2>Decision points</h2><p class="muted">Working out where to decide…</p>`; }
      const anchor = page.querySelector(":scope > #spPanel") || page.querySelector(":scope > #wcPanel") || page.querySelector(":scope > #rtPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      const key = keyOf(f);
      if (sec.dataset.k !== key) {
        sec.dataset.k = key;
        if (f.dpKey !== key || !Array.isArray(f.dps)) { f.dps = await build(f); f.dpKey = key; try { save(); } catch (e) {} }
        if (sec.isConnected) paint(sec, f);
      }
    } catch (e) { console.error(e); } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 600); };
  new MutationObserver((l) => { if (busy || l.every((m) => m.target.closest && m.target.closest("#dpPanel, #dpFly"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick); kick();
  setInterval(() => { if (/^#\/fly/.test(location.hash || "")) kick(); }, 3000);
  window.AeroDecision = { build, along };
})();
