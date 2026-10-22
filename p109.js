"use strict";
/* p109: plan to brief in one step. "Read and brief" on the Plan page reads the words, builds the
   flight and opens its brief. If something must be answered first (a missing departure time,
   VFR or IFR, a point that was not found), it stops on those questions instead, and a tap on
   Build my plan then goes straight to the brief. */
(function () {
  let want = 0;
  const wait = (fn, ms) => new Promise((res) => { const t0 = Date.now(); const tick = () => { const v = fn(); if (v || Date.now() - t0 > ms) res(v); else setTimeout(tick, 120); }; tick(); });
  function blocking(out) {
    // Questions with an answer box or choice that is not marked optional
    return [...out.querySelectorAll(".qask")].filter((q) => !q.querySelector(".qskip") && (q.querySelector(".qans, .qopt") || /not found/i.test(q.textContent)));
  }
  async function toBrief() {
    want = Date.now();
    const link = await wait(() => { const o = document.getElementById("qOut"); return o && o.querySelector('a[href="#/brief"], a[href$="/brief"]'); }, 20000);
    if (link && Date.now() - want < 21000) { want = 0; location.hash = link.getAttribute("href"); }
  }
  async function run(btn) {
    const ta = document.getElementById("qText"), go = document.getElementById("qGo");
    if (!ta || !go || !ta.value.trim()) { toast("Describe your flight first"); return; }
    btn.disabled = true; const label = btn.textContent; btn.textContent = "Reading…";
    try {
      go.click();
      const out = await wait(() => { const o = document.getElementById("qOut"); return o && o.querySelector(".qread") && document.getElementById("qBuild") ? o : null; }, 15000);
      if (!out) { toast("Could not read the plan. Try Read my plan."); return; }
      const qs = blocking(out);
      if (qs.length) {
        want = Date.now();
        toast(qs.length === 1 ? "One answer needed, then Build my plan opens the brief" : `${qs.length} answers needed, then Build my plan opens the brief`);
        qs[0].scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      btn.textContent = "Building…";
      document.getElementById("qBuild").click();
      await toBrief();
    } finally { btn.disabled = false; btn.textContent = label; }
  }
  // After a one step start that stopped on questions, Build my plan finishes the job
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "qBuild" && want && Date.now() - want < 10 * 60e3) setTimeout(toBrief, 50);
  });
  function add() {
    const go = document.getElementById("qGo");
    if (!go || document.getElementById("qOne")) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.id = "qOne"; b.textContent = "Read and brief";
    b.title = "Read the plan, build the flight and open its brief";
    b.onclick = () => run(b);
    go.classList.add("sec");
    go.before(b);
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { if (/^#\/plan|^#?\/?$/.test(location.hash || "")) add(); }, 200); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
