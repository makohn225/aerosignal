"use strict";
/* p183: Known issues for your aircraft type (November 4, 2026). A brief panel (#kiPanel, after #gpPanel, the
   end of the brief chain) from FAA Service Difficulty Reports: problems mechanics and operators reported on
   the same make and model over the last five years, by aircraft system (JASC chapter) and by part, with the
   latest reports in their words. Read through the sdr_summary function (public FAA data loaded by the
   sdrsync edge function). Counts are reports, not failure rates. Nothing about the pilot is sent beyond the
   aircraft make and model. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const JASC = { "21": "Air conditioning and heat", "22": "Autopilot", "23": "Communications", "24": "Electrical power", "25": "Cabin and equipment", "26": "Fire protection", "27": "Flight controls", "28": "Fuel system", "29": "Hydraulics", "30": "Ice and rain protection", "31": "Instruments", "32": "Landing gear and brakes", "33": "Lights", "34": "Navigation and pitot static", "35": "Oxygen", "37": "Vacuum", "39": "Electrical panels", "51": "Structures", "52": "Doors", "53": "Fuselage", "54": "Engine nacelles", "55": "Stabilizers", "56": "Windows", "57": "Wings", "61": "Propeller", "62": "Main rotor", "63": "Rotor drive", "64": "Tail rotor", "65": "Tail rotor drive", "67": "Rotor flight controls", "71": "Powerplant", "72": "Engine", "73": "Engine fuel and control", "74": "Ignition", "76": "Engine controls", "77": "Engine indicating", "78": "Exhaust", "79": "Engine oil", "80": "Starting", "81": "Turbocharging", "85": "Engine cylinders and internals" };
  // ICAO type designator to the SDR make and model prefix, for aircraft saved with only a type code
  const TYPE = { C150: ["CESSNA", "150"], C152: ["CESSNA", "152"], C162: ["CESSNA", "162"], C170: ["CESSNA", "170"], C172: ["CESSNA", "172"], C177: ["CESSNA", "177"], C182: ["CESSNA", "182"], C185: ["CESSNA", "185"], C206: ["CESSNA", "206"], C210: ["CESSNA", "210"], C310: ["CESSNA", "310"], P28A: ["PIPER", "PA28"], P28B: ["PIPER", "PA28"], P28R: ["PIPER", "PA28R"], P28T: ["PIPER", "PA28R"], PA32: ["PIPER", "PA32"], P32R: ["PIPER", "PA32R"], PA34: ["PIPER", "PA34"], PA44: ["PIPER", "PA44"], PA46: ["PIPER", "PA46"], PA18: ["PIPER", "PA18"], SR20: ["CIRRUS", "SR20"], SR22: ["CIRRUS", "SR22"], S22T: ["CIRRUS", "SR22T"], DA40: ["DIAMOND", "DA40"], DA42: ["DIAMOND", "DA42"], DV20: ["DIAMOND", "DA20"], DA20: ["DIAMOND", "DA20"], BE36: ["BEECH", "A36"], BE58: ["BEECH", "58"], BE76: ["BEECH", "76"], M20P: ["MOONEY", "M20"], M20T: ["MOONEY", "M20"], R22: ["ROBINSON", "R22"], R44: ["ROBINSON", "R44"], R66: ["ROBINSON", "R66"], AA5: ["GRUMMAN", "AA5"], C208: ["CESSNA", "208"] };
  const css = document.createElement("style");
  css.textContent = `
    #kiPanel table{width:100%;border-collapse:collapse;margin:6px 0}
    #kiPanel td{padding:5px 4px;border-top:1px solid var(--line2,rgba(255,255,255,.1));font-size:13.5px;vertical-align:top}
    #kiPanel td.n{text-align:right;font-family:var(--mono,monospace);white-space:nowrap}
    #kiPanel .ki-r{font-size:13px;margin:6px 0;padding:8px 10px;border-left:3px solid var(--line2,rgba(255,255,255,.2));background:rgba(0,0,0,.08)}
    #kiPanel .ki-r small{display:block;color:var(--ink2,#9db2ce)}
    #kiPanel .cols2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
    @media (max-width:640px){#kiPanel .cols2{grid-template-columns:minmax(0,1fr)}}`;
  document.head.appendChild(css);

  function aircraftOf(f) {
    let a = null; try { a = (allAircraft() || {})[f.tail] || null; } catch (e) {}
    if (!a) return null;
    const tc = String(a.typeCode || "").toUpperCase();
    if (TYPE[tc]) return { make: TYPE[tc][0], model: TYPE[tc][1], label: tc };
    const mk = String(a.make || "").toUpperCase().split(/\s+/)[0];
    let md = String(a.model || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!mk || !md) return null;
    if (mk === "CESSNA") md = md.replace(/^C/, "").replace(/^(\d{3}).*$/, "$1");
    if (mk === "PIPER") md = md.replace(/^(PA\d{2}R?).*$/, "$1");
    return { make: mk, model: md, label: `${a.make} ${a.model}`.trim() };
  }
  // FAA reports are in capitals; show them in sentence case
  const sentence = (t) => String(t || "").toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const day = (d) => { const x = new Date(d + "T12:00:00"); return isNaN(x) ? String(d || "") : x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
  const cache = new Map();
  async function load(ac) {
    const k = `${ac.make}|${ac.model}`;
    if (!cache.has(k)) cache.set(k, rpc("sdr_summary", { mk: ac.make, md: ac.model, yrs: 5 }).catch((e) => { cache.delete(k); throw e; }));
    return cache.get(k);
  }
  function paint(sec, ac, j) {
    const yr = j && j.since ? new Date(j.since).getFullYear() : null;
    if (!j || !j.total) {
      sec.innerHTML = `<h2>Known issues for this aircraft type</h2><p class="muted" style="margin:0">No FAA Service Difficulty Reports found for ${h(ac.label)} in the last five years. Few reports are filed for some types, so this does not mean there are none.</p>`;
      return;
    }
    const sys = (j.systems || []).map((x) => `<tr><td>${h(JASC[x.ch] || `System ${x.ch}`)}</td><td class="n">${x.n}</td></tr>`).join("");
    const parts = (j.parts || []).map((x) => `<tr><td>${h(x.part)}${x.cond ? ` <span class="small muted">(${h(String(x.cond).toLowerCase())})</span>` : ""}</td><td class="n">${x.n}</td></tr>`).join("");
    const rec = (j.recent || []).slice(0, 3).map((x) => `<div class="ki-r"><small>${h(day(x.d))} · ${h(x.model || "")}${x.part ? ` · ${h(x.part)}` : ""}</small>${h(sentence(x.text))}</div>`).join("");
    sec.innerHTML = `<h2>Known issues for this aircraft type</h2>
      <p style="margin:0 0 6px"><b>${Number(j.total).toLocaleString("en-US")}</b> FAA Service Difficulty Reports on ${h(ac.label)} aircraft since ${yr || "the last five years"}. Worth a closer look on your preflight:</p>
      <div class="cols2"><div><b class="small">By system</b><table>${sys}</table></div><div><b class="small">Parts reported most</b><table>${parts}</table></div></div>
      ${rec ? `<p style="margin:10px 0 4px"><b class="small">Latest reports, in the mechanic's words</b></p>${rec}` : ""}
      <p class="small muted" style="margin:8px 0 0">Reports filed by repair stations and operators with the FAA. Counts are reports, not failure rates, and fleets that report more show up more. Check your own aircraft's logbooks and airworthiness directives.</p>`;
  }
  let busy = false, t = 0;
  async function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!page || !f || f.missionId || !page.querySelector("#bfBluf")) return;
    const ac = aircraftOf(f);
    let sec = page.querySelector(":scope > #kiPanel");
    if (!ac) { if (sec) sec.remove(); return; }
    busy = true;
    try {
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "kiPanel"; sec.innerHTML = `<h2>Known issues for this aircraft type</h2><p class="muted">Looking up FAA Service Difficulty Reports…</p>`; }
      const anchor = page.querySelector(":scope > #gpPanel") || page.querySelector(":scope > #nsPanel") || page.querySelector(":scope > #dayPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); } else if (!sec.isConnected) page.appendChild(sec);
      const key = `${ac.make}|${ac.model}`;
      if (sec.dataset.k !== key) {
        sec.dataset.k = key;
        try { const j = await load(ac); if (sec.isConnected) paint(sec, ac, j); }
        catch (e) { sec.dataset.k = ""; sec.innerHTML = `<h2>Known issues for this aircraft type</h2><p class="muted" style="margin:0">FAA Service Difficulty Reports could not load right now.</p>`; }
      }
      const jmp = page.querySelector("#bfJump");
      if (jmp && !jmp.querySelector('[data-s="#kiPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#kiPanel"; a.textContent = "Known issues";
        a.onclick = (e) => { e.preventDefault(); const s = document.getElementById("kiPanel"); if (s) { if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); } };
        const g = jmp.querySelector('[data-s="#gpPanel"]'); if (g) g.after(a); else jmp.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 480); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#kiPanel"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroKnownIssues = { aircraftOf, JASC, TYPE };
})();
