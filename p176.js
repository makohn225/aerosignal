"use strict";
/* p176: school traffic picture (November 3, 2026). Trajectory based operations, scaled down to a flight school:
   from the flights students already share with the school (route and departure time), the instructor dashboard
   (#/school/<id>) and the sample school show which airports are busy in each hour of the next two days, so an
   instructor can spread lessons out before anyone takes off. A shared flight counts at its departure airport in
   the departure hour and at the other airports on its route in the following hour (training flights are short).
   Reads only what instructors already see; nothing new is collected. Students do not see it yet: that needs a
   server function that returns counts without names (waiting for approval). */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BUSY = 3;
  const css = document.createElement("style");
  css.textContent = `
    #tpPanel .tp-day{margin:10px 0 4px;font-weight:700}
    #tpPanel .tp-wrap{overflow-x:auto}
    #tpPanel table{border-collapse:collapse;min-width:100%}
    #tpPanel th,#tpPanel td{padding:6px 6px;font-size:12.5px;text-align:center;border-top:1px solid var(--line2,rgba(255,255,255,.1));white-space:nowrap}
    #tpPanel th:first-child,#tpPanel td:first-child{text-align:left;position:sticky;left:0;background:var(--bg2,#08111F)}
    #tpPanel td.c1{background:rgba(61,224,255,.12)}#tpPanel td.c2{background:rgba(255,182,72,.22)}#tpPanel td.c3{background:rgba(255,77,106,.3);font-weight:700}
    #tpPanel .tp-tip{font-size:13.5px;margin:8px 0 0}`;
  document.head.appendChild(css);

  const apts = (route) => [...new Set(String(route || "").toUpperCase().split(/[\s,]+/).filter((t) => /^[A-Z0-9]{3,4}$/.test(t) && /[A-Z]/.test(t) && !/^(DCT|V\d+|T\d+)$/.test(t)))];
  function grid(flights, from, hours) {
    // flights: [{ student, route, dep: Date }]
    const cells = new Map(); // airport -> Map(hourIndex -> [student])
    const add = (a, i, s) => { if (i < 0 || i >= hours) return; if (!cells.has(a)) cells.set(a, new Map()); const m = cells.get(a); if (!m.has(i)) m.set(i, []); m.get(i).push(s); };
    for (const f of flights) {
      if (!(f.dep instanceof Date) || isNaN(f.dep)) continue;
      const i = Math.floor((f.dep - from) / 36e5), A = apts(f.route);
      if (!A.length) continue;
      add(A[0], i, f.student);
      for (const a of A.slice(1)) if (a !== A[0]) add(a, i + 1, f.student);
      if (A[A.length - 1] === A[0] && A.length > 1) add(A[0], i + 1, f.student);
    }
    return cells;
  }
  function render(sec, flights) {
    const now = new Date(); now.setMinutes(0, 0, 0);
    const hours = 48, cells = grid(flights, now, hours);
    if (!cells.size) { sec.querySelector(".tp-out").innerHTML = `<p class="muted" style="margin:0">No shared flights in the next two days yet. When students share a brief, their planned airports and times show here.</p>`; return; }
    // Only the hours that have something in them, grouped by day
    const used = [...new Set([...cells.values()].flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
    const byDay = new Map();
    for (const i of used) { const d = new Date(now.getTime() + i * 36e5); const k = d.toDateString(); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(i); }
    const A = [...cells.keys()].sort();
    let worst = null;
    for (const a of A) for (const [i, s] of cells.get(a)) if (!worst || s.length > worst.n) worst = { a, i, n: s.length };
    let html = "";
    for (const [k, idx] of byDay) {
      const d0 = new Date(k);
      html += `<p class="tp-day">${h(d0.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }))}</p><div class="tp-wrap"><table><tr><th>Airport</th>${idx.map((i) => `<th>${h(new Date(now.getTime() + i * 36e5).toLocaleTimeString("en-US", { hour: "numeric" }))}</th>`).join("")}</tr>
        ${A.filter((a) => idx.some((i) => cells.get(a).has(i))).map((a) => `<tr><td>${h(a)}</td>${idx.map((i) => { const s = cells.get(a).get(i) || []; const c = s.length >= BUSY ? "c3" : s.length === 2 ? "c2" : s.length ? "c1" : ""; return `<td class="${c}" title="${h(s.join(", "))}">${s.length || ""}</td>`; }).join("")}</tr>`).join("")}
      </table></div>`;
    }
    const tip = worst && worst.n >= 2 ? `<p class="tp-tip"><b>Busiest:</b> ${h(worst.a)} around ${h(new Date(now.getTime() + worst.i * 36e5).toLocaleString("en-US", { weekday: "short", hour: "numeric" }))} with ${worst.n} school flights (${h(cells.get(worst.a).get(worst.i).join(", "))}). Consider moving one lesson an hour or to a nearby airport.</p>` : `<p class="tp-tip">No airport has more than one school flight in the same hour.</p>`;
    sec.querySelector(".tp-out").innerHTML = html + tip;
  }
  function panel(page, load) {
    if (page.querySelector("#tpPanel")) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "tpPanel";
    sec.innerHTML = `<h2>School traffic picture</h2><p class="small" style="margin:0 0 8px">Shared flights for the next two days by airport and hour, so lessons can be spread out before anyone takes off. Counts include only flights students shared.</p><div class="tp-out"><p class="muted" style="margin:0">Loading…</p></div>`;
    const rv = page.querySelector("#rvPanel");
    if (rv) rv.after(sec); else { const first = page.querySelector("section.panel"); if (first) first.after(sec); else page.appendChild(sec); }
    load().then((fl) => { if (sec.isConnected) render(sec, fl); }).catch((e) => { console.error(e); sec.querySelector(".tp-out").innerHTML = `<p>The traffic picture could not load right now.</p>`; });
  }
  async function api(path) {
    const tok = await validToken();
    const r = await fetch(`${SUPA.url}/rest/v1/${path}`, { headers: { ...authHdr(tok), "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(`Request failed (${r.status})`);
    return r.json();
  }
  function scan() {
    const hash = location.hash || "";
    const page = document.querySelector("#view .sc-dash");
    if (!page || !page.querySelector("section.panel")) return;
    if (/^#\/school\/demo/.test(hash) && window.AeroSampleSchool && AeroSampleSchool.SHARES) {
      panel(page, async () => {
        const base = AeroSampleSchool.SHARES().map((x) => ({ student: x.s, route: x.route, dep: x.dep }));
        // Two more sample lessons the same morning as Alex, so the picture shows a busy hour
        const a = base[0] && base[0].dep ? base[0].dep : new Date(Date.now() + 864e5);
        base.push({ student: "Riley (sample student)", route: "KPNS KJKA", dep: new Date(a) }, { student: "Morgan (sample student)", route: "KPNS KPNS", dep: new Date(a) });
        return base;
      });
      return;
    }
    const m = /^#\/school\/([0-9a-f-]{36})/.exec(hash);
    if (!m || typeof AUTH === "undefined" || !AUTH) return;
    panel(page, async () => {
      const since = new Date(Date.now() - 2 * 36e5).toISOString();
      const rows = (await api(`school_shares?select=student_name,route,dep_at&school_id=eq.${m[1]}&dep_at=gte.${encodeURIComponent(since)}&order=dep_at.asc&limit=500`)) || [];
      return rows.map((r) => ({ student: r.student_name || "Student", route: r.route, dep: new Date(r.dep_at) }));
    });
  }
  let t = 0;
  new MutationObserver(() => { if (t) return; t = setTimeout(() => { t = 0; try { scan(); } catch (e) { console.error(e); } }, 320); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(scan, 450));
  window.AeroTraffic = { grid, apts };
})();
