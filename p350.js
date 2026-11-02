"use strict";
/* p350: Daylight and night on the flight brief. For the planned departure and arrival times it works
   out sunrise, sunset and the start and end of civil twilight at the departure and the destination,
   how much of the flight falls after sunset (position lights) and after the end of civil twilight
   (night under the regulations), and whether the landing is inside the one hour after sunset window
   that the night passenger currency rules use. Sun position is the NOAA approximation, computed on
   the device with no network call and no stored data. Shown as a panel after Turbulence and icing
   (#advPanel) with one line in the bottom line card and a chip in the jump bar. Loads at the end of
   the list; nothing here needs to load early. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #dayPanel .dy-big{display:flex;flex-wrap:wrap;gap:6px 20px;margin:8px 0 6px;font-size:14px}
    #dayPanel .dy-big b{font-family:var(--mono,monospace)}
    #dayPanel table{border-collapse:collapse;width:100%;min-width:320px;font:12.5px var(--mono,monospace);margin-top:6px}
    #dayPanel .dy-tw{overflow-x:auto}
    #dayPanel th,#dayPanel td{padding:4px 6px;text-align:right;border-bottom:1px solid var(--line2,rgba(255,255,255,.07));white-space:nowrap}
    #dayPanel th:first-child,#dayPanel td:first-child{text-align:left}
    #dayPanel th{color:var(--ink2,#9fb0c8);font-weight:600;font-size:11px}
    #dayPanel .ok{color:#46e39b}#dayPanel .warn{color:#ffb648}#dayPanel .bad{color:#ff4d6a}
    #dayPanel ul{margin:8px 0 0;padding-left:18px;font-size:13.5px;line-height:1.5}
    #dayPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #bfBluf .bf-day{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-day .warn{color:#ffb648;font-weight:700}#bfBluf .bf-day .bad{color:#ff4d6a;font-weight:700}#bfBluf .bf-day .ok{color:#46e39b;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const R = Math.PI / 180;
  const p2 = (n) => String(n).padStart(2, "0");
  const hhmm = (d) => (d ? `${p2(d.getHours())}${p2(d.getMinutes())}` : "none");
  const hhmmZ = (d) => (d ? `${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}Z` : "none");

  // Solar elevation in degrees (NOAA approximation)
  function sunEl(ms, lat, lon) {
    const d = ms / 864e5 + 2440587.5 - 2451545.0;
    const g = (357.529 + 0.98560028 * d) * R, q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * R;
    const e = (23.439 - 0.00000036 * d) * R;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
    const ha = ((gmst * 15 + lon) * R) - ra;
    return Math.asin(Math.sin(lat * R) * Math.sin(dec) + Math.cos(lat * R) * Math.cos(dec) * Math.cos(ha)) / R;
  }
  // Next crossing of a given elevation after ms (rising or setting); null if none within 30 hours
  function cross(ms, lat, lon, deg, rising, back) {
    const step = 120e3, dir = back ? -1 : 1;
    let prev = sunEl(ms, lat, lon);
    for (let i = 1; i <= 900; i++) {
      const t = ms + dir * i * step, e = sunEl(t, lat, lon);
      const hit = rising ? (back ? prev >= deg && e < deg : prev < deg && e >= deg) : (back ? prev <= deg && e > deg : prev > deg && e <= deg);
      if (hit) return new Date(t);
      prev = e;
    }
    return null;
  }
  const depAt = (f) => { const d = new Date(`${f.date}T${String(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`); return isNaN(d) ? null : d; };
  function arrAt(f, dep) { try { const p = profile(f); if (p.arrLocal && !isNaN(new Date(p.arrLocal))) return new Date(p.arrLocal); } catch {} return dep ? new Date(+dep + 36e5) : null; }

  // The day around a time at a place: the sun events that bracket it
  function dayAt(when, pt) {
    const ms = +when, la = pt.lat, lo = pt.lon, el = sunEl(ms, la, lo);
    return {
      el,
      sunrise: cross(ms - 12 * 36e5, la, lo, -0.833, true), sunset: cross(ms - 12 * 36e5, la, lo, -0.833, false),
      dawn: cross(ms - 12 * 36e5, la, lo, -6, true), dusk: cross(ms - 12 * 36e5, la, lo, -6, false),
    };
  }
  // The sunset and civil twilight end that apply to a time (next after it, or the one just before)
  function evening(when, pt) {
    const ms = +when;
    return { sunset: cross(ms - 6 * 36e5, pt.lat, pt.lon, -0.833, false), dusk: cross(ms - 6 * 36e5, pt.lat, pt.lon, -6, false) };
  }
  function morning(when, pt) {
    const ms = +when;
    return { sunrise: cross(ms - 6 * 36e5, pt.lat, pt.lon, -0.833, true), dawn: cross(ms - 6 * 36e5, pt.lat, pt.lon, -6, true) };
  }

  function build(f) {
    const pts = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    if (pts.length < 1) return null;
    const dep = depAt(f); if (!dep) return null;
    let arr = arrAt(f, dep); if (!arr || arr <= dep) arr = new Date(+dep + 36e5);
    const A = pts[0], B = pts[pts.length - 1];
    // Cumulative distance along the route so each sample gets a position and a time
    const seg = [0];
    for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i].lat - pts[i - 1].lat, (pts[i].lon - pts[i - 1].lon) * Math.cos(((pts[i].lat + pts[i - 1].lat) / 2) * R)));
    const tot = seg[seg.length - 1];
    const at = (fr) => {
      if (!tot || pts.length < 2) return { lat: A.lat, lon: A.lon };
      const d = fr * tot; let i = 1; while (i < seg.length - 1 && seg[i] < d) i++;
      const w = seg[i] === seg[i - 1] ? 0 : (d - seg[i - 1]) / (seg[i] - seg[i - 1]);
      return { lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * w, lon: pts[i - 1].lon + (pts[i].lon - pts[i - 1].lon) * w };
    };
    const N = Math.max(12, Math.min(240, Math.round((arr - dep) / 6e4 / 2)));
    let lights = 0, night = 0;
    for (let i = 0; i < N; i++) {
      const fr = (i + 0.5) / N, t = +dep + fr * (arr - dep), p = at(fr), e = sunEl(t, p.lat, p.lon), dt = (arr - dep) / N / 6e4;
      if (e < -0.833) lights += dt;
      if (e < -6) night += dt;
    }
    const total = (arr - dep) / 6e4;
    const dd = { ...dayAt(dep, A), when: dep }, da = { ...dayAt(arr, B), when: arr };
    const eve = evening(arr, B), mor = morning(dep, A);
    const ev = sunEl(+arr, B.lat, B.lon), sd = sunEl(+dep, A.lat, A.lon);
    // Landing after sunset: minutes after the sunset that precedes it; position lights from sunset
    const sunsetBefore = cross(+arr, B.lat, B.lon, -0.833, false, true);
    const afterSunset = ev < -0.833 && sunsetBefore ? Math.ceil((arr - sunsetBefore) / 6e4) : 0;
    const beforeSunriseDep = sd < -0.833;
    // One hour after sunset window used by the passenger night currency rule
    const sunriseNext = cross(+arr, B.lat, B.lon, -0.833, true);
    const inNightCur = ev < -0.833 && sunsetBefore && (arr - sunsetBefore) / 6e4 >= 60 ? true : false;
    // Daylight left at arrival time if still daytime
    const toSunset = ev >= -0.833 ? (cross(+arr, B.lat, B.lon, -0.833, false) ? Math.floor((cross(+arr, B.lat, B.lon, -0.833, false) - arr) / 6e4) : null) : null;
    return {
      A, B, dep, arr, total, lights: Math.ceil(lights), night: Math.ceil(night), dd, da, eve, mor,
      afterSunset, toSunset, inNightCur, beforeSunriseDep, ev, sd, sunriseNext,
      fromId: A.ident || "departure", toId: B.ident || "destination", rules: f.rules || "VFR",
    };
  }

  const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

  function summary(r) {
    // [class, text] for the bottom line card
    if (r.night > 0) return r.rules === "IFR"
      ? ["warn", `<b class="warn">NIGHT</b> ${dur(r.night)} of the flight is after the end of civil twilight; position lights are required after sunset.`]
      : ["warn", `<b class="warn">NIGHT</b> ${dur(r.night)} of the flight is after the end of civil twilight. Night VFR needs 45 minutes of fuel reserve and lights on from sunset.`];
    if (r.lights > 0) return ["warn", `<b class="warn">LIGHTS</b> ${dur(r.lights)} of the flight is after sunset; turn position lights on. Civil twilight has not ended yet.`];
    if (r.toSunset != null && r.toSunset <= 60) return ["warn", `<b class="warn">DAYLIGHT</b> only ${r.toSunset} min between landing and sunset at ${h(r.toId)}.`];
    return ["ok", `<b class="ok">DAYLIGHT</b> the whole flight${r.toSunset != null ? `, landing ${dur(r.toSunset)} before sunset at ${h(r.toId)}` : ""}.`];
  }

  function paint(sec, r) {
    if (!r) { sec.innerHTML = `<h2>Daylight and night</h2><p class="small muted" style="margin:0">Add a departure date, time and route to see sunrise, sunset and how much of the flight is in the dark.</p>`; return; }
    const [cls, txt] = summary(r);
    const row = (id, d, when) => `<tr><td>${h(id)}</td><td>${hhmm(d.sunrise)}</td><td>${hhmm(d.dawn)}</td><td>${hhmm(d.dusk)}</td><td>${hhmm(d.sunset)}</td></tr>`;
    const tipsA = [];
    if (r.night > 0 && r.rules !== "IFR") tipsA.push("Night VFR: carry 45 minutes of fuel reserve at normal cruise instead of 30, and check that the lights and the flashlight work.");
    if (r.lights > 0) tipsA.push("Position lights are required from sunset to sunrise, and anti collision lights when the aircraft has them.");
    if (r.inNightCur) tipsA.push(`The landing is more than one hour after sunset at ${h(r.toId)}, so it counts toward the night currency needed to carry passengers at night (3 takeoffs and landings to a full stop within 90 days).`);
    else if (r.afterSunset > 0) tipsA.push(`The landing is ${r.afterSunset} min after sunset at ${h(r.toId)}, less than one hour, so it does not count toward night passenger currency.`);
    if (r.night === 0 && r.lights === 0 && r.toSunset != null && r.toSunset <= 90) tipsA.push(`If the flight runs late, the sun sets at ${hhmm(r.da.sunset)} local (${hhmmZ(r.da.sunset)}) at ${h(r.toId)}.`);
    if (r.beforeSunriseDep) tipsA.push(`Departure is before sunrise at ${h(r.fromId)} (${hhmm(r.mor.sunrise)} local). Allow for dark ramp and taxi conditions.`);
    sec.innerHTML = `<h2>Daylight and night</h2>
      <p class="small" style="margin:0"><span class="${cls}">${txt}</span></p>
      <div class="dy-big"><span>Flight time <b>${dur(Math.ceil(r.total))}</b></span><span>After sunset <b>${dur(r.lights)}</b></span><span>Night (after civil twilight) <b>${dur(r.night)}</b></span></div>
      <div class="dy-tw"><table><tr><th>Local time</th><th>Sunrise</th><th>Dawn</th><th>Dusk</th><th>Sunset</th></tr>
        ${row(r.fromId, r.dd)}${r.fromId !== r.toId ? row(r.toId, r.da) : ""}</table></div>
      <p class="small muted" style="margin:6px 0 0">Dawn and dusk are the start and end of civil twilight (sun 6 degrees below the horizon). Times are the clock of the device, as entered for the flight. Zulu: sunset ${h(r.fromId)} ${hhmmZ(r.dd.sunset)}${r.fromId !== r.toId ? `, ${h(r.toId)} ${hhmmZ(r.da.sunset)}` : ""}.</p>
      ${tipsA.length ? `<ul>${tipsA.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
      <p class="disc">Computed from the sun position for planning. Check official sunrise and sunset tables, and the rules that apply to your flight.</p>`;
  }

  function bluf(page, r) {
    const card = page.querySelector("#bfBluf"); if (!card) return;
    const html = r ? `Daylight: ${summary(r)[1]}` : "";
    let el = card.querySelector(".bf-day");
    if (!html) { if (el) el.remove(); return; }
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-day"; const after = card.querySelector(".bf-adv") || card.querySelector(".bf-wx") || card.querySelector(".k"); if (after) after.after(el); else card.prepend(el); }
    el.dataset.v = html; el.innerHTML = html;
  }

  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId || !(f.points || []).length || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${f.date}|${f.time}|${f.rules}`;
      let sec = page.querySelector("#dayPanel");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "dayPanel"; sec.dataset.k = ""; }
      if (sec.dataset.k !== key) {
        sec.dataset.k = key;
        let r = null; try { r = build(f); } catch (e) { console.error(e); }
        sec._r = r; paint(sec, r);
      }
      bluf(page, sec._r || null);
      // After Turbulence and icing, else after the checklist, else at the end of the page
      const anchor = page.querySelector(":scope > #advPanel") || page.querySelector(":scope > #ntPanel") || page.querySelector(":scope > #goPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) page.appendChild(sec);
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#dayPanel"]')) {
        const a = document.createElement("a");
        a.href = "#"; a.dataset.s = "#dayPanel"; a.textContent = "Daylight";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("dayPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
        const nc = j.querySelector('[data-s="#advPanel"]') || j.querySelector('[data-s="#ntPanel"]'); if (nc) nc.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 350); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#dayPanel, #bfBluf .bf-day"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroDaylight = { build, sunEl };

  // Demo tour and narrated tutorial (Mario can ask for the new narration line to be recorded)
  try {
    if (typeof TOURS !== "undefined") {
      for (const k of ["civil", "military"]) {
        const st = TOURS[k] && TOURS[k].steps;
        if (!Array.isArray(st) || st._p350) continue;
        st._p350 = true;
        const i = st.findIndex((s) => s[0] === "#/brief");
        if (i >= 0) st[i] = [st[i][0], st[i][1], `${st[i][2]} Daylight and night shows sunrise, sunset and civil twilight at both ends, and how much of the flight falls after dark.`];
      }
    }
  } catch {}
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    for (const k of ["civil", "military"]) {
      const sc = T && T[k] && T[k].scenes;
      if (!sc || sc._p350) continue;
      sc._p350 = true;
      let at = sc.findIndex((s) => s.hash === "#/feedback");
      if (at < 0) at = sc.length - 1;
      sc.splice(at, 0, { hash: "#/brief", sel: "#dayPanel", wait: "#dayPanel", text: "Daylight and night shows sunrise, sunset and the end of civil twilight at your departure and destination, and tells you when lights are needed or the flight turns into a night flight." });
    }
  } catch (e) { console.error(e); }
})();
