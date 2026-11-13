"use strict";
/* p254: the Fly screen records the flight (November 13, 2026). The track debrief (p78), the accident sites the
   track passed close to, and "Add to logbook" from the track (p94) all needed a track log imported from another
   app. A pilot flying with Vigilyn's own Fly screen now gets one automatically:
   - while the Fly screen has GPS, a point is kept about every 15 seconds or 0.05 nm (precise fixes only),
     saved to the flight every 30 seconds so a closed tab or a dead battery loses little;
   - after landing (slower than 30 kt for a minute after flying faster than 40 kt) or when the pilot stops the
     Fly screen, the recording becomes the flight's track, unless a track was already imported, which is kept;
   - the Fly screen shows the recording, then "Debrief this flight" when it is done.
   Decision points (p253) then show in the brief when each one was reached. Stays on this device like the
   flight, and is synced with the flight when account sync is on. */
(function () {
  const R = Math.PI / 180;
  const dist = (a, b) => { const p1 = a[0] * R, p2 = b[0] * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b[1] - a[1]) * R) / 2) ** 2; return 3440.065 * 2 * Math.asin(Math.min(1, Math.sqrt(x))); };
  const css = document.createElement("style");
  css.textContent = `
    #recFly{display:flex;gap:8px 12px;align-items:center;justify-content:space-between;flex-wrap:wrap;border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:14px;padding:8px 14px;margin:0 0 14px;font-size:14px}
    #recFly .dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff4d6a;margin-right:6px;animation:recB 1.4s infinite}
    #recFly.done .dot{background:#2fbf71;animation:none}
    @keyframes recB{50%{opacity:.25}}
    @media (prefers-reduced-motion:reduce){#recFly .dot{animation:none}}`;
  document.head.appendChild(css);
  let rec = null, lastSave = 0, slowSince = 0;
  const flightOf = (id) => (S.flights || []).find((x) => x.id === id) || null;
  function finish(reason) {
    if (!rec) return;
    const f = flightOf(rec.fid), pts = rec.pts; rec.done = true;
    if (f && pts.length >= 10) {
      const tr = { name: "Recorded on the Fly screen", pts, at: Date.now(), source: "fly" };
      if (!f.track || !(f.track.pts || []).length || f.track.source === "fly") f.track = tr; else f.trackFly = tr;
      delete f.trackLive; f.updated = Date.now();
      try { save(); } catch (e) { try { toast("Not enough storage on this device to keep the recorded track"); } catch (er) {} }
    } else if (f) { delete f.trackLive; try { save(); } catch (e) {} }
    rec.reason = reason;
  }
  function tick() {
    const st = window.AeroFly && AeroFly.state; if (!st) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    const live = st.watch != null;
    if (!live) { if (rec && !rec.done) finish("stopped"); return; }
    if (!f) return;
    if (!rec || rec.fid !== f.id || rec.done && rec.reason === "stopped") {
      if (rec && !rec.done) finish("switched");
      const prev = Array.isArray(f.trackLive) ? f.trackLive : [];
      rec = { fid: f.id, pts: prev.slice(), done: false, flew: prev.length > 0 };
      slowSince = 0;
    }
    if (rec.done) return;
    const p = st.pos; if (!p || !isFinite(p.lat) || !isFinite(p.lon)) return;
    if (p.acc != null && p.acc > 50) return;
    const now = p.at || Date.now(), last = rec.pts[rec.pts.length - 1];
    const pt = [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lon * 1e5) / 1e5, p.altFt != null ? Math.round(p.altFt) : null, now];
    if (!last || now - last[3] >= 15000 || dist(last, pt) >= 0.05) { if (!last || now !== last[3]) rec.pts.push(pt); }
    const kt = p.kt || 0;
    if (kt > 40) { rec.flew = true; slowSince = 0; }
    else if (rec.flew && kt < 30) { slowSince = slowSince || Date.now(); if (Date.now() - slowSince > 60000) finish("landed"); }
    if (!rec.done && Date.now() - lastSave > 30000) { lastSave = Date.now(); f.trackLive = rec.pts; try { save(); } catch (e) {} }
  }
  function card() {
    if (!/^#\/fly/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"); if (!page) return;
    let el = page.querySelector("#recFly");
    if (!rec || !rec.pts.length) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "recFly"; const a = page.querySelector("#dpFly") || page.querySelector("#ofFly") || page.querySelector("h1"); if (a) a.after(el); else page.prepend(el); }
    const P = rec.pts; let nm = 0; for (let i = 1; i < P.length; i++) nm += dist(P[i - 1], P[i]);
    const min = Math.round((P[P.length - 1][3] - P[0][3]) / 60000);
    const html = rec.done && P.length >= 10
      ? `<span><span class="dot"></span><b>Flight recorded</b>: ${min} min, ${Math.round(nm)} nm.</span><a class="btn sm" href="#/brief">Debrief this flight</a>`
      : `<span><span class="dot"></span><b>Recording your track</b>: ${min} min, ${Math.round(nm)} nm.</span><span class="small muted">For the debrief and your logbook.</span>`;
    el.className = rec.done ? "done" : "";
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  setInterval(() => { try { tick(); card(); } catch (e) { console.error(e); } }, 2000);
  window.addEventListener("pagehide", () => { try { if (rec && !rec.done) { const f = flightOf(rec.fid); if (f) { f.trackLive = rec.pts; save(); } } } catch (e) {} });
  window.AeroFlyRec = { state: () => rec, finish };
})();
