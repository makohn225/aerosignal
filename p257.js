"use strict";
/* p257: density altitude in flight (November 13, 2026, from pilots asking for density altitude en route and not
   only at the departure). On the Fly screen, once airborne, a line estimates the density altitude where the
   aircraft is: pressure altitude taken as the GPS altitude, and the outside temperature from the winds aloft
   forecast at that altitude (p36; below its lowest temperature level, carried down at the standard 2 °C per
   1,000 ft). It shows only when it matters: density altitude above 5,000 ft or more than 1,000 ft above the
   actual altitude, amber above 8,000 ft. It is an estimate and says so; the aircraft's OAT gauge and altimeter
   setting are better when you have them. */
(function () {
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const css = document.createElement("style");
  css.textContent = `#daFly{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:14px;padding:8px 14px;margin:0 0 14px;font-size:14.5px}#daFly.warn{border-color:#e0a100;background:rgba(224,161,0,.1)}#daFly b{font:700 18px var(--mono,monospace)}`;
  document.head.appendChild(css);
  let W = null, wKey = "";
  async function winds(f) {
    const k = `${f.id}|${f.date}|${f.time}`; if (k === wKey) return W;
    wKey = k; W = null; try { W = window.AeroWinds ? await AeroWinds.fetchWinds(f) : null; } catch (e) { W = null; } return W;
  }
  function tempAt(W, pos, alt) {
    if (!W || !W.stations || !W.stations.length) return null;
    const w = AeroWinds.windAt(W, pos, alt); if (w && w.temp != null) return w.temp;
    for (let a = Math.ceil(alt / 1000) * 1000; a <= 12000; a += 1000) { const x = AeroWinds.windAt(W, pos, a); if (x && x.temp != null) return x.temp + ((a - alt) / 1000) * 2; }
    return null;
  }
  const da = (pa, oat) => pa + 120 * (oat - (15 - (2 * pa) / 1000));
  async function draw() {
    if (!/^#\/fly/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"); if (!page) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    const st = window.AeroFly && AeroFly.state, pos = st && st.pos;
    let el = page.querySelector("#daFly");
    if (!f || !pos || pos.altFt == null || (pos.kt || 0) < 40) { if (el) el.remove(); return; }
    const Wd = await winds(f), t = tempAt(Wd, pos, pos.altFt);
    if (t == null) { if (el) el.remove(); return; }
    const d = da(pos.altFt, t);
    if (!(d > 5000 || d - pos.altFt > 1000)) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "daFly"; const a = page.querySelector("#tdFly") || page.querySelector("#recFly") || page.querySelector("#dpFly") || page.querySelector("h1"); if (a) a.after(el); else page.prepend(el); }
    el.className = d > 8000 ? "warn" : "";
    const html = `Density altitude about <b>${fmt(Math.round(d / 100) * 100)} ft</b> <span class="small">(${Math.round(t)} °C forecast at ${fmt(Math.round(pos.altFt / 100) * 100)} ft GPS altitude; an estimate, check your OAT)</span>${d > 8000 ? `<br><span class="small"><b>Climb and engine performance are well below sea level book figures.</b></span>` : ""}`;
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  setInterval(() => { draw().catch(() => {}); }, 4000);
  window.AeroFlyDA = { da, tempAt };
})();
