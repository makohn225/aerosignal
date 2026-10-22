"use strict";
/* p108: fewer tabs. Plan and Flights become one Plan tab: the Plan page lists your saved flights
   with Brief and Edit buttons, and the Flights page (the form planner) stays one tap away from it.
   Safety search moves into Maps as a button at the top of the map panel. Both pages keep their
   links (#/flights, #/safety), and the Plan or Maps tab stays lit while you are on them. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    nav.tabs a[data-tab="flights"],nav.tabs a[data-tab="safety"]{display:none!important}
    #plFlights .pf-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 0;border-top:1px solid var(--line2,rgba(255,255,255,.1))}
    #plFlights .pf-row:first-of-type{border-top:0}
    #plFlights .pf-r{flex:1 1 180px;min-width:0}
    #plFlights .pf-r b{font-family:var(--mono,monospace);font-size:14px;word-break:break-word}
    #plFlights .pf-r .small{display:block;color:var(--ink2,#9db2ce)}
    #plFlights .pf-cur b{color:var(--cyan,#3DE0FF)}
    #mpSafety{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tab = () => ((location.hash || "#/plan").split("/")[1] || "plan").split("?")[0];
  function lit() {
    const t = tab(), as = t === "flights" ? "plan" : t === "safety" ? "maps" : null;
    if (!as) return;
    document.querySelectorAll("nav.tabs a[data-tab]").forEach((a) => { const on = a.dataset.tab === as; if (a.classList.contains("on") !== on) a.classList.toggle("on", on); });
  }
  const when = (f) => { const d = new Date(`${f.date || "2000-01-01"}T${(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`); return isNaN(d) ? 0 : +d; };
  function flights() {
    const all = (S.flights || []).filter((f) => f && f.route && !f.missionId);
    const now = Date.now() - 6 * 36e5;
    const up = all.filter((f) => when(f) >= now).sort((a, b) => when(a) - when(b));
    const past = all.filter((f) => when(f) < now).sort((a, b) => when(b) - when(a));
    return { list: up.concat(past).slice(0, 5), n: all.length };
  }
  function plan(page) {
    if (page.querySelector("#plFlights")) return;
    const { list, n } = flights();
    const s = document.createElement("section"); s.className = "panel"; s.id = "plFlights";
    s.innerHTML = `<h2>Your flights</h2>${list.length ? list.map((f) => `<div class="pf-row${f.id === S.currentId ? " pf-cur" : ""}"><div class="pf-r"><b>${h(f.route)}</b><span class="small">${h(f.date || "")} ${h(f.time || "")}${f.tail ? " · " + h(f.tail) : ""}${f.rules ? " · " + h(f.rules) : ""}</span></div><button type="button" class="btn sm" data-b="${h(f.id)}">Brief</button><button type="button" class="btn sec sm" data-e="${h(f.id)}">Edit</button></div>`).join("") : `<p class="small muted" style="margin:0">Flights you plan show up here.</p>`}
      <p class="small" style="margin:10px 0 0"><a href="#/flights">${n > list.length ? `All ${n} flights and` : "Open"} the form planner</a></p>`;
    s.querySelectorAll("[data-b],[data-e]").forEach((b) => (b.onclick = () => { S.currentId = b.dataset.b || b.dataset.e; try { save(); } catch {} location.hash = b.dataset.b ? "#/brief" : "#/flights"; }));
    page.appendChild(s);
  }
  function maps(page) {
    const ctl = page.querySelector("#mctl") || page;
    if (ctl.querySelector("#mpSafety")) return;
    const d = document.createElement("div"); d.id = "mpSafety";
    d.innerHTML = `<a class="btn sec sm" href="#/safety">Safety search</a><span class="small muted">Past mishaps by aircraft, place or hazard.</span>`;
    const grip = ctl.querySelector(":scope > .sheetgrip");
    if (grip) grip.after(d); else ctl.prepend(d);
  }
  let busy = false, t = 0;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      lit();
      const page = document.querySelector("#view .page") || document.querySelector("#view");
      if (!page) return;
      const t = tab();
      if (t === "plan" || t === "") { const qp = document.querySelector("#view .page.qp"); if (qp && !qp.classList.contains("qdone")) plan(qp); }
      if (t === "maps" && document.querySelector("#view #mctl")) maps(document.querySelector("#view"));
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 200); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { lit(); kick(); });
  kick();
})();
