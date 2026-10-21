"use strict";
/* p63: a quick debrief for civil flights, so each flight teaches the next one, the same way the
   mission debrief does for military crews. Three short answers on the Brief page after the flight.
   When a later flight shares an airport, the airplane type, night or IFR with a debriefed one, the
   lesson shows up in that flight's brief. Stays in the pilot's own data. */
(function () {
  if (typeof ROUTES === "undefined" || typeof ROUTES.brief !== "function") return;
  const css = document.createElement("style");
  css.textContent = `
    #dbPanel textarea{width:100%;box-sizing:border-box;min-height:58px;resize:vertical}
    #dbPanel label{display:block;font-size:13px;color:var(--ink2,#9fb0c8);margin:10px 0 4px}
    #dbPanel .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
    #dbPanel .cui{font-size:12.5px;color:#ff4d6a;font-weight:700;margin:8px 0 0}
    #dbPanel .saved{border-left:3px solid #3DE0FF;padding:6px 10px;margin:6px 0;background:rgba(61,224,255,.05);border-radius:0 8px 8px 0}
    #dbPanel .saved b{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2,#9fb0c8);margin-bottom:2px}
    #dbPast{margin:0;padding:0;list-style:none}
    #dbPast li{padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.1))}
    #dbPast li:first-child{border-top:0}
    #dbPast .m{font-size:12px;color:var(--ink2,#9fb0c8)}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function tags(f) {
    let p = null;
    try { p = profile(f); } catch {}
    const apts = [p && p.dep && p.dep.ident, p && p.dst && p.dst.ident].filter(Boolean);
    const hr = +String(f.time || "12").slice(0, 2);
    return { apts, fam: (p && p.fam) || "", night: !!((p && p.nightArr) || hr >= 21 || hr < 5), ifr: f.rules === "IFR" };
  }
  const when = (f) => { const d = new Date(`${f.date}T${f.time || "12:00"}:00`); return isNaN(d) ? null : d; };
  const done = (f) => { const d = when(f); return !!d && Date.now() - d > 60 * 60e3; };

  // Lessons from other debriefed flights that look like this one
  function past(f) {
    const me = tags(f);
    const out = [];
    for (const g of S.flights || []) {
      if (g === f || !g.debrief || !g.debrief.lesson) continue;
      const t = g.debrief.tags || tags(g);
      let s = 0; const why = [];
      for (const a of me.apts) if ((t.apts || []).includes(a)) { s += 2; why.push(a); }
      if (me.fam && t.fam === me.fam) { s += 1; why.push(me.fam); }
      if (me.night && t.night) { s += 1; why.push("night"); }
      if (me.ifr && t.ifr) { s += 1; why.push("IFR"); }
      if (s >= 2) out.push({ g, s, why });
    }
    return out.sort((a, b) => b.s - a.s || (b.g.debrief.at || 0) - (a.g.debrief.at || 0)).slice(0, 3);
  }

  function panel(page, f) {
    if (page.querySelector("#dbPanel")) return;
    const sec = document.createElement("section");
    sec.className = "panel"; sec.id = "dbPanel";
    const d = f.debrief || {};
    const fin = done(f);
    const draw = (editing) => {
      const have = d.lesson && !editing;
      sec.innerHTML = `<h2>Debrief this flight</h2>
        ${have ? `
          ${d.went ? `<div class="saved"><b>Went as planned</b>${h(d.went)}</div>` : ""}
          ${d.diff ? `<div class="saved"><b>Did not go as planned</b>${h(d.diff)}</div>` : ""}
          <div class="saved"><b>Lesson for next time</b>${h(d.lesson)}</div>
          <p class="small muted" style="margin:6px 0 0">This lesson shows up in the brief of any later flight that shares an airport, this airplane type, night or IFR.</p>
          <div class="row"><button type="button" class="btn sec sm" data-a="edit">Edit</button></div>`
        : `<p style="margin:0">${fin ? "Done flying? Two minutes now, while it is fresh, and the next brief carries the lesson forward." : "After you land, come back here. Two minutes, and the next brief carries the lesson forward."}</p>
          <label for="dbWent">What went as planned</label><textarea id="dbWent" maxlength="600">${h(d.went || "")}</textarea>
          <label for="dbDiff">What did not, and why</label><textarea id="dbDiff" maxlength="600">${h(d.diff || "")}</textarea>
          <label for="dbLesson">One lesson for next time</label><textarea id="dbLesson" maxlength="300" placeholder="Example: Brief the go around point before the night arrival, not on final.">${h(d.lesson || "")}</textarea>
          <p class="cui">Never enter CUI or classified information.</p>
          <div class="row"><button type="button" class="btn sm" data-a="save">Save debrief</button>${d.lesson ? `<button type="button" class="btn sec sm" data-a="cancel">Cancel</button>` : ""}</div>`}`;
      const on = (a, fn) => { const b = sec.querySelector(`[data-a="${a}"]`); if (b) b.onclick = fn; };
      on("edit", () => draw(true));
      on("cancel", () => draw(false));
      on("save", () => {
        const v = (id) => (sec.querySelector(id).value || "").trim();
        const lesson = v("#dbLesson");
        if (!lesson) { toast("Add one lesson for next time"); sec.querySelector("#dbLesson").focus(); return; }
        Object.assign(d, { went: v("#dbWent"), diff: v("#dbDiff"), lesson, at: Date.now(), tags: tags(f) });
        f.debrief = d; f.updated = Date.now(); save();
        toast("Debrief saved");
        draw(false);
      });
    };
    draw(false);
    const bb = page.querySelector("#bbody");
    if (fin && !d.lesson) { const j = page.querySelector("#bfJump") || page.querySelector("h1"); j.after(sec); }
    else if (bb) bb.after(sec); else page.appendChild(sec);
  }

  function lessons(page, f) {
    if (page.querySelector("#dbLessons")) return;
    const list = past(f);
    if (!list.length) return;
    const sec = document.createElement("section");
    sec.className = "panel"; sec.id = "dbLessons";
    sec.innerHTML = `<h2>Lessons from your past flights</h2><ul id="dbPast">${list.map(({ g, why }) => `<li data-lesson="${h(g.debrief.lesson)}"><div>${h(g.debrief.lesson)}</div><div class="m">${h(g.date || "")} · ${h((g.route || "").split(/\s+/).filter(Boolean).slice(0, 1).concat((g.route || "").split(/\s+/).filter(Boolean).slice(-1)).join(" to "))} · same ${h(why.join(", "))}</div></li>`).join("")}</ul>`;
    const bb = page.querySelector("#bbody");
    if (bb) bb.before(sec); else page.appendChild(sec);
  }

  const base = ROUTES.brief;
  ROUTES.brief = function (el, arg) {
    const r = base(el, arg);
    try {
      const f = currentFlight();
      const page = el.querySelector(".page") || el;
      if (f && (f.points || []).length && !f.missionId) { lessons(page, f); panel(page, f); }
    } catch (e) { console.error(e); }
    return r;
  };
  window.AeroCivilDebrief = { past, tags };
  if (((location.hash || "").split("/")[1] || "") === "brief") go();
})();
