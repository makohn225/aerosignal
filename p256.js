"use strict";
/* p256: descent cue on the Fly screen (November 13, 2026). Pilots asking for EFB features keep wanting help
   starting down on time: a top of descent point, a cue when to begin, and the descent rate needed to arrive at
   pattern altitude. The plan already works out the top of descent (p90). On the Fly screen a descent card now:
   - from 20 nm before the top of descent: "Start down in X nm" with the planned rate;
   - from the top of descent to the destination: the rate needed right now, from the GPS altitude, groundspeed
     and the distance left, to reach pattern altitude (1,000 ft above the destination) about 3 nm out;
   - warns when the needed rate is over 1,000 fpm (too high: plan a wider descent or a circle down);
   - inside 5 nm, shows how far above pattern altitude the aircraft is instead of a rate.
   It vibrates once at the top of descent where the device supports it. Uses the GPS altitude, which can differ
   from the altimeter. */
(function () {
  const R = Math.PI / 180;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #tdFly{border:2px solid rgba(61,224,255,.45);border-radius:14px;padding:10px 14px;margin:0 0 14px;font-size:15px;line-height:1.45}
    #tdFly.now{border-color:#3DE0FF;background:rgba(61,224,255,.08)}
    #tdFly.warn{border-color:#e0a100;background:rgba(224,161,0,.12)}
    #tdFly .td-h{font-weight:700;font-size:13px;letter-spacing:.5px;text-transform:uppercase;opacity:.85;margin-bottom:2px}
    #tdFly .td-n{font:700 26px var(--mono,monospace)}`;
  document.head.appendChild(css);
  const pts = (f) => ((f && f.points) || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
  let buzzed = "";
  function draw() {
    if (!/^#\/fly/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"); if (!page) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    let el = page.querySelector("#tdFly");
    const st = window.AeroFly && AeroFly.state, pos = st && st.pos;
    let v = null; try { v = f && window.AeroVnav ? AeroVnav.vnav(f) : null; } catch (e) {}
    const P = pts(f);
    if (!f || !v || P.length < 2 || !pos || !window.AeroDecision) { if (el) el.remove(); return; }
    const g = AeroDecision.along(P, pos); if (!g || g.x > 15) { if (el) el.remove(); return; }
    const toGo = Math.max(0, v.total - g.s), tod = v.total - v.todNm, toTod = tod - g.s;
    const target = v.e1 + 1000, alt = pos.altFt, gs = Math.max(40, pos.kt || 0);
    if (!el) { el = document.createElement("div"); el.id = "tdFly"; const a = page.querySelector("#recFly") || page.querySelector("#dpFly") || page.querySelector("h1"); if (a) a.after(el); else page.prepend(el); }
    let cls = "", html = "";
    if (toTod > 20 || alt == null || alt < target + 200 && toTod > 0) { el.remove(); return; }
    if (toTod > 0.5) {
      cls = ""; html = `<div class="td-h">Descent</div>Start down in <span class="td-n">${fmt(toTod)} nm</span><br><span class="small">Planned about ${fmt(v.v.descFpm)} fpm to ${fmt(target)} ft, pattern altitude at ${h(v.dst)}.</span>`;
    } else if (alt > target + 100 && toGo > 1 && toGo <= 5) {
      // Close in, a rate stops being useful: say how high above pattern altitude the aircraft is
      const over = alt - target; cls = over > 600 ? "warn" : "now";
      html = `<div class="td-h">Arrival</div><span class="td-n">${fmt(Math.round(over / 50) * 50)} ft</span> above pattern altitude, ${fmt(toGo)} nm from ${h(v.dst)}.${over > 600 ? `<br><b>High.</b> Consider extending, a 360 well clear of traffic, or a go around.` : ""}`;
    } else if (alt > target + 100 && toGo > 5) {
      const nm = Math.max(0.5, toGo - 3), need = ((alt - target) / ((nm / gs) * 60));
      cls = need > 1000 ? "warn" : "now";
      if (buzzed !== f.id) { buzzed = f.id; try { if (navigator.vibrate) navigator.vibrate([150, 100, 150]); } catch (e) {} }
      html = `<div class="td-h">${toTod > -1 ? "Start descent now" : "Descent"}</div><span class="td-n">${need > 2000 ? "over 2,000" : fmt(Math.ceil(need / 50) * 50)} fpm</span> needed to reach ${fmt(target)} ft about 3 nm from ${h(v.dst)}.${need > 1000 ? `<br><b>That is steep.</b> Start down now, or plan a wider descent.` : ""}`;
    } else { el.remove(); return; }
    el.className = cls; if (el.innerHTML !== html) el.innerHTML = html;
  }
  setInterval(() => { try { draw(); } catch (e) { console.error(e); } }, 2000);
  window.AeroDescentCue = { draw };
})();
