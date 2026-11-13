"use strict";
/* p252: sport pilot check under MOSAIC (November 12, 2026). The FAA's MOSAIC rule (published July 24, 2025;
   the sport pilot changes took effect October 22, 2025, the aircraft certification changes July 24, 2026)
   lets sport pilots fly more aircraft. A pilot who flies as a sport pilot can say so under More, Your
   certificate. The brief then adds a Sport pilot check (#spPanel, after #wcPanel) for the flight:
   - VFR only (no IFR or instrument rating for sport pilots)
   - the aircraft's clean stall speed (VS1, flaps up) at or below 59 knots CAS for airplanes, from its POH,
     entered once per aircraft; up to 4 seats in airplanes but never more than the pilot and one passenger
   - night (from the planned departure, the route and sunset): needs the night endorsement plus BasicMed or a
     third class medical, since a driver's license alone covers day only
   - retractable gear or a controllable pitch propeller: needs the training and endorsement
   - Class B, C or D airspace the route enters (from the airspace check, p92): needs the endorsement
   Items the app cannot know are shown as questions for the pilot. Sources: the FAA MOSAIC fact sheet and
   14 CFR part 61 subpart J. It is a reminder, not a legal determination. Stored on this device. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #spPanel ul{list-style:none;margin:6px 0 0;padding:0}
    #spPanel li{display:grid;grid-template-columns:92px 1fr;gap:10px;padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08));font-size:14px;line-height:1.45}
    #spPanel li:first-child{border-top:0}
    #spPanel .st{font:700 11px var(--mono,monospace);letter-spacing:.4px;padding:2px 0;text-align:center;border-radius:999px;border:1px solid currentColor;align-self:start}
    #spPanel .ok{color:#2fbf71}#spPanel .no{color:#ff4d6a}#spPanel .ask{color:#e0a100}#spPanel .na{opacity:.6}
    #spPanel input[type=number]{width:84px;font:inherit;font-size:16px;padding:4px 6px;border-radius:8px;border:1px solid var(--line2,rgba(255,255,255,.2));background:transparent;color:inherit}
    #spPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #spSec label{display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:normal;font-size:15px;margin:6px 0}`;
  document.head.appendChild(css);
  const on = () => !!(S.sport && S.sport.on);
  const acRec = (tail) => { S.sport = S.sport || {}; S.sport.ac = S.sport.ac || {}; return (S.sport.ac[tail] = S.sport.ac[tail] || {}); };
  async function night(f) {
    try {
      const P = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon)); if (P.length < 2 || !f.date || !f.time || !(window.AeroLogTrack && AeroLogTrack.sunEl)) return null;
      // The planned time is local at the departure airport (p192), not on this device
      let dep = null; try { if (window.AeroFAA && AeroFAA.depMs) dep = await AeroFAA.depMs(f); } catch (e) {}
      if (dep == null) dep = new Date(`${f.date}T${f.time}`).getTime(); if (!isFinite(dep)) return null;
      let nm = 0; for (let i = 1; i < P.length; i++) nm += (window.AeroFly ? AeroFly.dist(P[i - 1], P[i]) : 0);
      let tas = 100; try { const a = (allAircraft() || {})[f.tail]; if (a && a.tas) tas = a.tas; } catch (e) {}
      const arr = dep + (nm / tas) * 36e5;
      // Night for this check: sun more than 6 degrees below the horizon (end of evening civil twilight)
      const n1 = AeroLogTrack.sunEl(dep, P[0].lat, P[0].lon) < -6, n2 = AeroLogTrack.sunEl(arr, P[P.length - 1].lat, P[P.length - 1].lon) < -6;
      return n1 || n2;
    } catch (e) { return null; }
  }
  async function items(f) {
    const L = [];
    let a = null; try { a = (allAircraft() || {})[f.tail] || null; } catch (e) {}
    const r = acRec(f.tail || "?");
    const ifr = String(f.rules || "").toUpperCase() === "IFR";
    L.push(ifr ? ["no", "Flight rules", "This flight is filed IFR. Sport pilots fly VFR only."] : ["ok", "Flight rules", "VFR."]);
    const vs1 = Number(r.vs1);
    L.push([!vs1 ? "ask" : vs1 <= 59 ? "ok" : "no", "Stall speed", `Clean stall speed (VS1, flaps up) must be 59 knots CAS or less for an airplane. From the POH for ${h((a && (a.typeCode || a.model)) || f.tail || "this aircraft")}: <input type="number" min="20" max="200" step="1" data-vs1 value="${vs1 || ""}" aria-label="VS1 in knots CAS"> knots CAS.${vs1 > 59 ? " <b>Above the limit: not a sport pilot aircraft.</b>" : ""}`]);
    L.push(["ask", "People on board", "Up to 4 seat airplanes are allowed, but only you and one passenger."]);
    const nt = await night(f);
    L.push(nt == null ? ["ask", "Night", "Set a departure date and time to check for night. Night needs the night endorsement plus BasicMed or a third class medical; a driver's license covers day only."] : nt ? ["ask", "Night", "Part of this flight is after dark. You need the night endorsement plus BasicMed or a third class medical; a driver's license covers day only."] : ["ok", "Night", "Daylight for the planned times."]);
    L.push([r.cplx === "no" ? "ok" : r.cplx === "yes" ? "ask" : "ask", "Gear and propeller", `Does ${h(f.tail || "this aircraft")} have retractable gear or a controllable pitch propeller? <label style="display:inline-flex;gap:4px;margin-left:6px"><input type="radio" name="spc" value="yes"${r.cplx === "yes" ? " checked" : ""}>Yes</label> <label style="display:inline-flex;gap:4px"><input type="radio" name="spc" value="no"${r.cplx === "no" ? " checked" : ""}>No</label>${r.cplx === "yes" ? " You need the training and an instructor endorsement for each." : ""}`]);
    let as = null; try { as = window.AeroAirspace ? await AeroAirspace.load(f) : null; } catch (e) {}
    const cls = as && as.list ? as.list.filter((x) => x.kind === "class" && x.inAlt && /^[BCD]$/.test(x.cls)) : null;
    if (cls == null) L.push(["ask", "Airspace", "Class B, C and D airspace each need an endorsement. The airspace check could not run for this route."]);
    else if (!cls.length) L.push(["ok", "Airspace", "The route at your planned altitudes stays out of Class B, C and D airspace."]);
    else L.push(["ask", "Airspace", `The route enters ${cls.slice(0, 4).map((x) => `Class ${h(x.cls)} (${h(x.name)})`).join(", ")}. Each class needs its endorsement, and Class B also needs a clearance.`]);
    L.push(["na", "Instruments", "No instrument flight and no instrument rating under sport pilot privileges."]);
    return L;
  }
  const LBL = { ok: "OK", no: "NOT OK", ask: "CHECK", na: "NOTE" };
  let busy = false, t = 0;
  async function apply() {
    if (busy) return; busy = true;
    try {
      const hash = location.hash || "", page = document.querySelector("#view .page"); if (!page) return;
      if (/^#\/more/.test(hash) && !page.querySelector("#spSec")) {
        const sec = document.createElement("section"); sec.className = "panel"; sec.id = "spSec";
        sec.innerHTML = `<h2>Your certificate</h2><label><input type="checkbox" data-sp${on() ? " checked" : ""}> I fly as a sport pilot</label><p class="small muted" style="margin:4px 0 0">Adds a Sport pilot check to each brief, using the MOSAIC privileges in effect since October 22, 2025. Saved on this device.</p>`;
        sec.querySelector("[data-sp]").onchange = (e) => { S.sport = S.sport || {}; S.sport.on = e.target.checked; try { save(); toast(e.target.checked ? "Sport pilot check added to the brief" : "Sport pilot check removed"); } catch (er) {} };
        const yf = page.querySelector("#yfSec"); if (yf) yf.after(sec); else page.appendChild(sec);
      }
      if (/^#\/brief(\/|$|\?)/.test(hash)) {
        let f = null; try { f = currentFlight(); } catch (e) {}
        let sec = page.querySelector(":scope > #spPanel");
        if (!on() || !f || f.missionId || !page.querySelector("#bfBluf")) { if (sec) sec.remove(); return; }
        if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "spPanel"; }
        const anchor = page.querySelector(":scope > #wcPanel") || page.querySelector(":scope > #rtPanel");
        if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
        const r = acRec(f.tail || "?");
        const key = `${f.id}|${f.tail}|${f.rules}|${f.date}|${f.time}|${(f.points || []).map((p) => p.ident).join(" ")}|${r.vs1 || ""}|${r.cplx || ""}`;
        if (sec.dataset.k === key) return;
        sec.dataset.k = key;
        if (!sec.innerHTML) sec.innerHTML = `<h2>Sport pilot check</h2><p class="muted">Checking…</p>`;
        const L = await items(f);
        if (!sec.isConnected || sec.dataset.k !== key) return;
        const bad = L.filter((x) => x[0] === "no").length, ask = L.filter((x) => x[0] === "ask").length;
        sec.innerHTML = `<h2>Sport pilot check</h2><p style="margin:0 0 4px"><b>${bad ? `${bad} item${bad === 1 ? "" : "s"} outside sport pilot privileges.` : ask ? `No problems found. ${ask} item${ask === 1 ? "" : "s"} to confirm.` : "Within sport pilot privileges."}</b></p>
          <ul>${L.map(([s, t2, d]) => `<li><span class="st ${s}">${LBL[s]}</span><span><b>${h(t2)}.</b> ${d}</span></li>`).join("")}</ul>
          <p class="disc">A reminder of the MOSAIC sport pilot privileges, not a legal determination. Check 14 CFR part 61 subpart J and your endorsements.</p>
          <p class="small muted" style="margin:6px 0 0">Source: FAA MOSAIC fact sheet; sport pilot changes in effect since October 22, 2025.</p>`;
        const v = sec.querySelector("[data-vs1]"); if (v) v.onchange = () => { const n = Math.round(Number(v.value)); acRec(f.tail || "?").vs1 = n > 0 ? n : null; try { save(); } catch (e) {} kick(); };
        sec.querySelectorAll("input[name=spc]").forEach((x) => (x.onchange = () => { acRec(f.tail || "?").cplx = x.value; try { save(); } catch (e) {} kick(); }));
      }
    } catch (e) { console.error(e); } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 550); };
  new MutationObserver((l) => { if (busy || l.every((m) => m.target.closest && m.target.closest("#spPanel, #spSec"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick); kick();
  window.AeroSportPilot = { items, night };
})();
