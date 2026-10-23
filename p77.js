"use strict";
/* p77: When to go. A flight category timeline on the flight brief built from the TAFs already
   loaded for the flight: one strip per airport, hour by hour from now to the end of its forecast,
   colored VFR, MVFR, IFR or LIFR, with a mark where TEMPO or PROB groups could be worse. The
   planned departure and arrival hours are marked, and the app suggests departure windows when both
   ends meet the flight's rules (VFR flights: VFR at both ends with nothing worse than MVFR in a
   TEMPO; IFR flights: nothing LIFR). Tap an hour to read that hour's forecast. A planning aid
   built from the TAF text; get an official briefing before flight. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #wtgPanel .wt-row{margin:10px 0 2px}
    #wtgPanel .wt-lab{display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink2,#9fb0c8);margin-bottom:4px}
    #wtgPanel .wt-lab b{color:var(--ink,#EAF2FF);font:700 12.5px var(--mono,monospace)}
    #wtgPanel .wt-strip{display:flex;gap:2px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
    #wtgPanel .wt-c{flex:0 0 26px;height:34px;border-radius:5px;position:relative;cursor:pointer;border:0;padding:0;font:600 9.5px var(--mono,monospace);color:rgba(4,18,31,.85)}
    #wtgPanel .wt-c.VFR{background:#46e39b}#wtgPanel .wt-c.MVFR{background:#5aa9ff}#wtgPanel .wt-c.IFR{background:#ff4d6a}#wtgPanel .wt-c.LIFR{background:#e05cff}
    #wtgPanel .wt-c.tmp::after{content:"";position:absolute;left:0;right:0;top:0;height:7px;border-radius:5px 5px 0 0;background:repeating-linear-gradient(135deg,rgba(0,0,0,.55) 0 3px,transparent 3px 6px)}
    #wtgPanel .wt-c.plan{outline:2px solid #fff;outline-offset:1px}
    #wtgPanel .wt-c.sel{outline:2px solid #3DE0FF;outline-offset:1px}
    #wtgPanel .wt-c span{position:absolute;bottom:2px;left:0;right:0;text-align:center}
    #wtgPanel .wt-key{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px;color:var(--ink2,#9fb0c8);margin:8px 0 0}
    #wtgPanel .wt-key i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:4px}
    #wtgPanel .wt-win{font-size:14.5px;line-height:1.5;margin:4px 0 6px}
    #wtgPanel .wt-win b.ok{color:#46e39b}#wtgPanel .wt-win b.bad{color:#ff4d6a}
    #wtgPanel .wt-det{font-size:13.5px;margin:8px 0 0;min-height:1.4em;color:var(--ink,#EAF2FF)}
    #wtgPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const RANK = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };
  const pad = (n) => String(n).padStart(2, "0");
  const hhmm = (d) => `${pad(d.getHours())}${pad(d.getMinutes())}`;
  const day = (d) => d.toLocaleDateString([], { weekday: "short" });

  function tafs(f) {
    const out = {};
    try {
      for (const r of splitReports(f.wxText || "")) {
        if (r.kind !== "TAF") continue;
        const t = parseTaf(r.text, new Date());
        if (t && t.station && (!out[t.station] || out[t.station].from < t.from)) out[t.station] = t;
      }
    } catch {}
    return out;
  }
  function at(taf, t) {
    try {
      const r = tafAt(taf, t);
      if (!r || !r.prev) return null;
      const worst = (r.temps || []).reduce((w, x) => (RANK[x.cat] > RANK[w] ? x.cat : w), r.prev.cat);
      return { cat: r.prev.cat, worst, c: r.prev, temps: r.temps || [] };
    } catch { return null; }
  }
  function okFor(rules, x) {
    if (!x) return null;
    if (rules === "IFR") return x.worst !== "LIFR";
    return x.cat === "VFR" && RANK[x.worst] <= 1;
  }
  function describe(x) {
    if (!x) return "No forecast for this hour.";
    let s = `${x.cat}`;
    try { s += `: ${fmtCond(x.c)}`; } catch {}
    for (const t of x.temps) { try { s += `. ${t.type} ${t.cat}: ${fmtCond(t)}`; } catch {} }
    return s + ".";
  }

  function build(sec, f) {
    const T = tafs(f);
    const pts = f.points || [];
    const dep = pts[0] && pts[0].ident, dst = pts[pts.length - 1] && pts[pts.length - 1].ident;
    const find = (id) => id && (T[id] || T["K" + id] || T[id.replace(/^K/, "")]);
    const rows = [];
    const seen = new Set();
    for (const [label, id] of [["Departure", dep], ["Destination", dst]]) {
      const taf = find(id);
      if (taf && !seen.has(taf.station)) { seen.add(taf.station); rows.push({ label, taf }); }
    }
    let p = null; try { p = profile(f); } catch {}
    const depT = p && p.depLocal ? new Date(p.depLocal) : null, arrT = p && p.arrLocal ? new Date(p.arrLocal) : null;
    const ete = p && isFinite(p.ete) ? p.ete : 1;
    if (!rows.length) {
      sec.innerHTML = `<h2>When to go</h2><p class="small muted" style="margin:0">No TAF is loaded for ${h(dep || "the departure")} or ${h(dst || "the destination")} yet. Many small fields have none; the timeline appears when a forecast is available within 30 hours of departure.</p>`;
      return;
    }
    const now = new Date(); now.setMinutes(0, 0, 0);
    const end = new Date(Math.min(Math.max(...rows.map((r) => +r.taf.to)), +now + 36 * 36e5));
    const hours = [];
    for (let t = +now; t < +end; t += 36e5) hours.push(new Date(t));
    // Departure windows: both ends acceptable for the flight's rules
    const depTaf = find(dep), dstTaf = find(dst);
    const good = hours.map((t) => {
      const a = depTaf ? okFor(f.rules, at(depTaf, t)) : true;
      const b = dstTaf ? okFor(f.rules, at(dstTaf, new Date(+t + ete * 36e5))) : true;
      if (a === null || b === null) return null;
      return a && b;
    });
    const wins = [];
    let s = null;
    good.forEach((g, i) => { if (g && s == null) s = i; if ((!g || i === good.length - 1) && s != null) { const e = g ? i : i - 1; wins.push([hours[s], new Date(+hours[e] + 36e5)]); s = null; } });
    const planIdx = depT ? hours.findIndex((t) => +t <= +depT && +depT < +t + 36e5) : -1;
    const planOk = planIdx >= 0 ? good[planIdx] : null;
    const rule = f.rules === "IFR" ? "IFR: nothing LIFR at either end" : "VFR at both ends, nothing worse than MVFR in a TEMPO";
    const winTxt = wins.length
      ? wins.slice(0, 3).map(([a, b]) => `${day(a)} ${hhmm(a)} to ${day(b) !== day(a) ? day(b) + " " : ""}${hhmm(b)}`).join(", ")
      : "none in the forecast period";
    const planTxt = planIdx < 0 ? "Your planned departure is outside the forecast period."
      : planOk ? `Your planned departure at ${hhmm(depT)} <b class="ok">fits</b>.`
      : `Your planned departure at ${hhmm(depT)} <b class="bad">does not fit</b>.`;
    const strip = (row, mark) => hours.map((t, i) => {
      const x = at(row.taf, t);
      if (!x) return `<button type="button" class="wt-c" style="background:rgba(255,255,255,.08)" data-r="${h(row.taf.station)}" data-i="${i}" aria-label="${hhmm(t)} no forecast"></button>`;
      const pl = mark && +t <= +mark && +mark < +t + 36e5;
      return `<button type="button" class="wt-c ${x.cat}${RANK[x.worst] > RANK[x.cat] ? " tmp" : ""}${pl ? " plan" : ""}" data-r="${h(row.taf.station)}" data-i="${i}" aria-label="${hhmm(t)} ${x.cat}"><span>${pad(t.getHours())}</span></button>`;
    }).join("");
    sec.innerHTML = `<h2>When to go</h2>
      <p class="wt-win">Departure windows (${h(rule)}): <b class="${wins.length ? "ok" : "bad"}">${h(winTxt)}</b>. ${planTxt}</p>
      ${rows.map((r) => `<div class="wt-row"><div class="wt-lab"><span>${h(r.label)} <b>${h(r.taf.station)}</b></span><span>${r.label === "Destination" ? "at arrival time" : "at departure time"}</span></div><div class="wt-strip">${strip(r, r.label === "Destination" ? arrT : depT)}</div></div>`).join("")}
      <div class="wt-key"><span><i style="background:#46e39b"></i>VFR</span><span><i style="background:#5aa9ff"></i>MVFR</span><span><i style="background:#ff4d6a"></i>IFR</span><span><i style="background:#e05cff"></i>LIFR</span><span><i style="background:repeating-linear-gradient(135deg,#333 0 3px,#888 3px 6px)"></i>TEMPO or PROB could be worse</span><span><i style="outline:2px solid #fff;background:transparent"></i>your planned time</span></div>
      <p class="wt-det" aria-live="polite">Tap an hour to read its forecast. Hours are local time.</p>
      <p class="disc">Built from the TAF text for planning. Get an official weather briefing before flight.</p>`;
    sec.querySelectorAll(".wt-c").forEach((b) => (b.onclick = () => {
      sec.querySelectorAll(".wt-c.sel").forEach((x) => x.classList.remove("sel"));
      b.classList.add("sel");
      const row = rows.find((r) => r.taf.station === b.dataset.r), t = hours[+b.dataset.i];
      sec.querySelector(".wt-det").textContent = `${row.taf.station} ${day(t)} ${hhmm(t)}: ${describe(at(row.taf, t))}`;
    }));
    // Start the strips at the planned departure
    if (planIdx > 3) setTimeout(() => sec.querySelectorAll(".wt-strip").forEach((s) => { s.scrollLeft = Math.max(0, (planIdx - 3) * 28); }), 0);
  }

  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !f || f.missionId || !(f.points || []).length || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    busy = true;
    try {
      let sec = page.querySelector("#wtgPanel");
      const sig = `${f.id}|${f.rules}|${f.date}|${f.time}|${(f.wxText || "").length}|${f.tail}|${new Date().getHours()}`;
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "wtgPanel"; }
      if (sec.dataset.sig !== sig) { sec.dataset.sig = sig; build(sec, f); }
      // Right after the debrief (which another module keeps right after the accident lessons)
      const anchor = page.querySelector(":scope > #dbPanel") || page.querySelector(":scope > #bbody");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) page.appendChild(sec);
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#wtgPanel"]')) {
        const a = document.createElement("a");
        a.href = "#"; a.dataset.s = "#wtgPanel"; a.textContent = "When to go";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("wtgPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
        j.insertBefore(a, j.children[1] || null);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 240); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#wtgPanel"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroWhenToGo = { tafs, at, okFor };
})();
