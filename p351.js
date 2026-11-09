"use strict";
/* p351: Oxygen and altitude check on the flight brief (November 9, 2026, scheduled competitive upgrade).
   For a planned cruise altitude of 10,000 feet or higher it estimates how long the flight spends above
   12,500 and above 14,000 feet from a climb and descent rate you can change, compares that with the
   supplemental oxygen rules in 14 CFR 91.211 for aircraft without pressurization, gives the AIM time of
   useful consciousness for the altitude, and for pressurized aircraft lists the mask checks. Everything is
   computed on the device from the flight already in the app; nothing is stored beyond the two climb and
   descent settings in the flight itself. Shown as a panel after Fuel stops (#fsPanel, the last panel in the
   brief chain), with a line in the bottom line card (.bf-o2) and a chip in the jump bar. Loads at the end of
   the list; nothing here needs to load early. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #o2Panel .o2-ctl{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;margin:6px 0 8px;font-size:13.5px}
    #o2Panel .o2-ctl label{display:flex;align-items:center;gap:6px}
    #o2Panel .o2-ctl select{background:transparent;color:inherit;border:1px solid var(--line2,rgba(255,255,255,.2));border-radius:6px;padding:3px 6px;font:inherit}
    #o2Panel table{border-collapse:collapse;width:100%;font:12.5px var(--mono,monospace);margin-top:6px}
    #o2Panel th,#o2Panel td{padding:4px 6px;text-align:right;border-bottom:1px solid var(--line2,rgba(255,255,255,.07))}
    #o2Panel th:first-child,#o2Panel td:first-child{text-align:left}
    #o2Panel th{color:var(--ink2,#9fb0c8);font-weight:600;font-size:11px}
    #o2Panel .ok{color:#46e39b}#o2Panel .warn{color:#ffb648}#o2Panel .bad{color:#ff4d6a}
    #o2Panel ul{margin:8px 0 0;padding-left:18px;font-size:13.5px;line-height:1.5}
    #o2Panel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #bfBluf .bf-o2{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-o2 .warn{color:#ffb648;font-weight:700}#bfBluf .bf-o2 .bad{color:#ff4d6a;font-weight:700}#bfBluf .bf-o2 .ok{color:#46e39b;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => Math.round(n).toLocaleString("en-US");
  const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

  function cruise(f) {
    const a = String(f.cruiseAlt || f.alt || "").replace(/[\s,]/g, "");
    const m = /^FL(\d+)/i.exec(a);
    if (m) return +m[1] * 100;
    return +a || 0;
  }
  function minutes(f) {
    try {
      const dep = new Date(`${f.date}T${String(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`);
      const p = profile(f);
      if (p && p.arrLocal && !isNaN(dep)) { const m = (new Date(p.arrLocal) - dep) / 6e4; if (m > 0 && m < 1500) return m; }
      if (p && p.totalMin > 0) return p.totalMin;
    } catch {}
    return 0;
  }
  const elev = (p) => { const e = +(p && (p.elev ?? p.elevation)); return isFinite(e) && e > 0 ? e : 0; };

  // Time of useful consciousness, FAA AIM 8-1-2 (ranges as published, rounded up)
  const TUC = [[18000, "20 to 30 minutes"], [22000, "10 minutes"], [25000, "5 minutes"], [28000, "3 minutes"], [30000, "2 minutes"], [35000, "1 minute"], [40000, "20 seconds"]];
  const tucFor = (alt) => { let r = null; for (const t of TUC) if (alt >= t[0]) r = t; return r; };

  function build(f) {
    const alt = cruise(f);
    if (alt < 10000) return null;
    const pts = f.points || [];
    const o = f.o2 || {};
    const up = Math.max(200, +o.climb || 500), dn = Math.max(200, +o.desc || 500);
    const total = Math.ceil(minutes(f)) || 0;
    const eA = elev(pts[0]), eB = elev(pts[pts.length - 1]);
    const cruiseMin = Math.max(0, total - (alt - eA) / up - (alt - eB) / dn);
    const above = (th) => alt <= th ? 0 : Math.ceil(Math.min(total || Infinity, cruiseMin + (alt - th) / up + (alt - th) / dn));
    const a125 = above(12500), a140 = above(14000), a150 = above(15000);
    return { alt, up, dn, total, a125, a140, a150, press: !!o.press, tuc: tucFor(alt), unknown: !total };
  }

  function verdict(r) {
    if (r.press) {
      if (r.alt >= 41000) return ["bad", `<b class="bad">PRESSURIZED</b> FL${Math.round(r.alt / 100)}: quick donning mask rules and a cabin altitude check apply. Brief the oxygen system.`];
      if (r.alt >= 25000) return ["warn", `<b class="warn">PRESSURIZED</b> FL${Math.round(r.alt / 100)}: oxygen mask rules apply when a pilot is at the controls. Check cabin altitude and the mask.`];
      return ["ok", `<b class="ok">OXYGEN</b> pressurized at ${num(r.alt)} ft: confirm cabin altitude stays below 12,500 ft.`];
    }
    if (r.alt > 15000) return ["bad", `<b class="bad">OXYGEN REQUIRED</b> at ${num(r.alt)} ft: crew the whole time above 14,000 ft, and oxygen must be offered to every passenger above 15,000 ft.`];
    if (r.alt > 14000) return ["bad", `<b class="bad">OXYGEN REQUIRED</b> for the crew the whole time above 14,000 ft${r.unknown ? "" : ` (about ${dur(r.a140)})`}.`];
    if (r.alt > 12500) {
      if (r.unknown) return ["warn", `<b class="warn">OXYGEN</b> required for the crew after 30 minutes above 12,500 ft. Add departure and arrival times for an estimate.`];
      return r.a125 > 30
        ? ["bad", `<b class="bad">OXYGEN REQUIRED</b> for the crew: about ${dur(r.a125)} above 12,500 ft, more than the 30 minute limit.`]
        : ["warn", `<b class="warn">OXYGEN</b> about ${dur(r.a125)} above 12,500 ft; the rule applies after 30 minutes.`];
    }
    return ["warn", `<b class="warn">OXYGEN</b> ${num(r.alt)} ft is below the 12,500 ft rule, but the FAA advises considering oxygen from 10,000 ft by day and lower at night.`];
  }

  function paint(sec, r, f) {
    if (!r) return;
    const v = verdict(r);
    const sel = (cur, arr) => arr.map((x) => `<option value="${x}"${x === cur ? " selected" : ""}>${x} ft per min</option>`).join("");
    const tips = [];
    if (!r.press) {
      tips.push("Crew rule (14 CFR 91.211): above 12,500 ft up to and including 14,000 ft, the required crew uses oxygen for the time beyond 30 minutes. Above 14,000 ft, the crew uses it the whole time. Above 15,000 ft, each passenger must be offered oxygen.");
      if (r.alt >= 10000) tips.push("A fingertip pulse oximeter is a cheap check. Hypoxia can feel pleasant; it is the sign to descend, not to wait.");
      tips.push("Check the oxygen quantity for the real time above your limit, plus the climb and descent, and for every person aboard. Check the mask, flow and the regulator before takeoff.");
    } else {
      tips.push("Pressurized aircraft: check cabin altitude on climb, know the emergency descent procedure and keep the mask within reach. Above FL250 the rules require oxygen use by a pilot at the controls in some cases; check 91.211 for yours.");
    }
    if (r.tuc) tips.push(`Time of useful consciousness without oxygen at ${num(r.alt)} ft is about ${r.tuc[1]} (FAA AIM), less after a rapid decompression.`);
    tips.push("Winds, icing and the minimum en route altitude may also decide your altitude. See Turbulence and icing and the best altitude suggestion.");
    sec.innerHTML = `<h2>Oxygen and altitude</h2>
      <div class="o2-v">${v[1]}</div>
      <div class="o2-ctl">
        <label>Climb <select data-k="climb">${sel(r.up, [300, 500, 700, 1000])}</select></label>
        <label>Descent <select data-k="desc">${sel(r.dn, [300, 500, 700, 1000, 1500])}</select></label>
        <label><input type="checkbox" data-k="press"${r.press ? " checked" : ""}> Pressurized</label>
      </div>
      <table><thead><tr><th>Above</th><th>Time</th><th>Rule for unpressurized</th></tr></thead><tbody>
        <tr><td>12,500 ft</td><td>${r.unknown ? "unknown" : dur(r.a125)}</td><td>crew after 30 min</td></tr>
        <tr><td>14,000 ft</td><td>${r.unknown ? "unknown" : dur(r.a140)}</td><td>crew always</td></tr>
        <tr><td>15,000 ft</td><td>${r.unknown ? "unknown" : dur(r.a150)}</td><td>offer passengers</td></tr>
      </tbody></table>
      <ul>${tips.map((x) => `<li>${h(x)}</li>`).join("")}</ul>
      <p class="disc">An estimate from the cruise altitude, flight time and the climb and descent rates above, ignoring terrain and cabin pressure differences. Check 14 CFR 91.211 and your aircraft manual. Cabin altitude, not the flight level, decides the rule.</p>`;
    sec.querySelectorAll("select,input[data-k]").forEach((el) => {
      el.onchange = () => {
        f.o2 = f.o2 || {};
        const k = el.dataset.k;
        if (k === "press") f.o2.press = el.checked; else f.o2[k] = +el.value;
        save(); sec.dataset.k = ""; kick();
      };
    });
  }

  function bluf(page, r) {
    const card = page.querySelector("#bfBluf"); if (!card) return;
    const html = r ? verdict(r)[1] : "";
    let el = card.querySelector(".bf-o2");
    if (!html) { if (el) el.remove(); return; }
    if (el && el.dataset.v === html) return;
    if (!el) {
      el = document.createElement("div"); el.className = "bf-o2";
      const after = card.querySelector(".bf-day") || card.querySelector(".bf-adv") || card.querySelector(".bf-wx") || card.querySelector(".k");
      if (after) after.after(el); else card.appendChild(el);
    }
    el.dataset.v = html; el.innerHTML = html;
  }

  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      let mil = !!f.missionId;
      try { if (window.AeroMilFlight && AeroMilFlight.isMil(f.tail)) mil = true; } catch {}
      let r = null;
      if (!mil && (f.points || []).length) { try { r = build(f); } catch (e) { console.error(e); } }
      let sec = page.querySelector("#o2Panel");
      if (!r) { if (sec) sec.remove(); bluf(page, null); const c = page.querySelector('#bfJump [data-s="#o2Panel"]'); if (c) c.remove(); return; }
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "o2Panel"; sec.dataset.k = ""; }
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${f.date}|${f.time}|${f.cruiseAlt || f.alt}|${JSON.stringify(f.o2 || {})}|${f.tail}`;
      if (sec.dataset.k !== key) { sec.dataset.k = key; paint(sec, r, f); }
      bluf(page, r);
      // Last panel in the brief chain (#fsPanel, p192); the fallbacks are the earlier ones in that chain.
      const anchor = ["#fsPanel", "#kiPanel", "#gpPanel", "#nsPanel", "#dayPanel", "#asPanel", "#advPanel", "#ntPanel", "#goPanel"].map((s) => page.querySelector(":scope > " + s)).find(Boolean);
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) page.appendChild(sec);
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#o2Panel"]')) {
        const a = document.createElement("a");
        a.href = "#"; a.dataset.s = "#o2Panel"; a.textContent = "Oxygen";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("o2Panel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.scrollIntoView({ behavior: "smooth", block: "start" }); } };
        j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 400); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#o2Panel, #bfBluf .bf-o2"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroOxygen = { build, verdict };

  // Demo tour and narrated tutorial (Mario can ask for the new narration line to be recorded)
  try {
    if (typeof TOURS !== "undefined") {
      for (const k of ["civil"]) {
        const st = TOURS[k] && TOURS[k].steps;
        if (!Array.isArray(st) || st._p351) continue;
        st._p351 = true;
        const i = st.findIndex((s) => s[0] === "#/brief");
        if (i >= 0) st[i] = [st[i][0], st[i][1], `${st[i][2]} For a high cruise altitude, Oxygen and altitude estimates the time above 12,500 and 14,000 feet.`, ...st[i].slice(3)];
      }
    }
  } catch {}
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    const sc = T && T.civil && T.civil.scenes;
    if (sc && !sc._p351) {
      sc._p351 = true;
      let at = sc.findIndex((s) => s.hash === "#/feedback");
      if (at < 0) at = sc.length - 1;
      sc.splice(at, 0, { hash: "#/brief", sel: "#o2Panel, #bfBluf", wait: "#bfBluf", text: "When your cruise altitude is 10,000 feet or higher, Oxygen and altitude estimates how long you spend above 12,500 and 14,000 feet and compares it with the oxygen rules." });
    }
  } catch (e) { console.error(e); }
})();
