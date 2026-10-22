"use strict";
/* p119: passenger briefing. The FAA's SAFETY briefing (seat belts, air vents, fire extinguisher, exits,
   traffic and talking, your questions) as a short checklist the pilot can run with passengers before
   engine start. 14 CFR 91.107 requires briefing passengers on seat belts and shoulder harnesses.
   Opens from a "Passengers" chip on the brief and is printed on the kneeboard card (p118). */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #paxDlg{position:fixed;inset:0;z-index:10003;background:rgba(3,8,18,.72);display:grid;place-items:center;padding:12px;overflow:auto}
    #paxDlg .box{width:min(560px,100%);background:var(--panel,#0a1424);border:1px solid var(--line2,rgba(255,255,255,.16));border-radius:16px;padding:16px;max-height:calc(100vh - 24px);overflow:auto}
    .pax-l{list-style:none;margin:8px 0 0;padding:0}
    .pax-l li{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line2,rgba(255,255,255,.1))}
    .pax-l li:first-child{border-top:0}
    .pax-l .ltr{flex:none;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font:800 18px var(--disp,system-ui);color:#041018;background:var(--cyan,#3DE0FF)}
    .pax-l b{display:block;font-size:15px}
    .pax-l span{font-size:13.5px;line-height:1.45;color:var(--ink2,#9db2ce)}
    .pax-l input{width:22px;height:22px;margin:6px 0 0 auto;flex:none;accent-color:#3DE0FF}
  `;
  document.head.appendChild(css);
  const ITEMS = [
    ["S", "Seat belts", "Fastened for taxi, takeoff and landing, with shoulder harnesses. How to fasten and release them. Seats adjusted and locked."],
    ["A", "Air vents", "Where the vents and cabin heat are, and to speak up if they feel unwell or too warm or cold."],
    ["F", "Fire extinguisher", "Where it is and how to use it."],
    ["E", "Exits and emergencies", "How to open and secure the doors, the plan if you have to leave the airplane in a hurry, and where the survival kit and first aid are."],
    ["T", "Traffic and talking", "Point out other aircraft by clock position. Quiet in the cockpit during taxi, takeoff, approach and landing, and when the pilot is talking on the radio."],
    ["Y", "Your questions", "Ask anything now, and tell the pilot right away if anything seems wrong in flight."],
  ];
  function html(checks) {
    return `<ul class="pax-l">${ITEMS.map(([l, t, d], i) => `<li><span class="ltr">${l}</span><div><b>${t}</b><span>${d}</span></div>${checks ? `<input type="checkbox" data-i="${i}" aria-label="${t} briefed">` : ""}</li>`).join("")}</ul>`;
  }
  function open() {
    if (document.getElementById("paxDlg")) return;
    const d = document.createElement("div"); d.id = "paxDlg";
    d.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="Passenger briefing"><h2 style="margin-top:0">Passenger briefing</h2>
      <p class="small muted" style="margin:0">Run it with your passengers before engine start. 14 CFR 91.107 requires a briefing on seat belts and shoulder harnesses.</p>
      ${html(true)}<p class="small" id="paxSt" style="margin:8px 0 0"></p>
      <div class="row" style="gap:8px;margin-top:12px"><button type="button" class="btn sm" id="paxX">Done</button></div></div>`;
    document.body.appendChild(d);
    const st = () => { const n = d.querySelectorAll("input:checked").length; d.querySelector("#paxSt").textContent = n === ITEMS.length ? "Passengers briefed." : `${n} of ${ITEMS.length} covered`; };
    d.querySelectorAll("input").forEach((i) => (i.onchange = st)); st();
    d.onclick = (e) => { if (e.target === d) d.remove(); };
    d.querySelector("#paxX").onclick = () => d.remove();
  }
  let t = 0;
  function chip() {
    if (!/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    let f = null; try { f = currentFlight(); } catch {}
    const j = document.getElementById("bfJump");
    if (!j || !f || f.missionId || j.querySelector(".pax-chip")) return;
    const a = document.createElement("a"); a.href = "#"; a.className = "pax-chip"; a.textContent = "Passengers";
    a.onclick = (e) => { e.preventDefault(); open(); };
    j.appendChild(a);
  }
  const kick = () => { clearTimeout(t); t = setTimeout(chip, 300); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroPax = { ITEMS, html, open };
})();
