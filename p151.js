"use strict";
/* p151: Flight plan sheet. A card on the flight brief that lays the flight out in the order of the
   FAA domestic flight plan form (items 1 to 13): flight rules, aircraft, type, true airspeed, departure
   point and proposed time in Zulu, cruise altitude, route, destination, time en route, remarks and
   alternate. One tap copies it as plain text to paste into Flight Service (1800wxbrief.com) or your
   filing app. AeroSignal does not file anything. Added at the end of the brief (no other module
   positions itself against it). Civil flights only; mission flights are not shown. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #fpPanel .fp-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:0;border:1px solid var(--line2,rgba(255,255,255,.15));border-radius:10px;overflow:hidden;margin:10px 0}
    #fpPanel .fp-grid>div{padding:7px 10px;border-bottom:1px solid var(--line2,rgba(255,255,255,.15));font-size:13.5px;overflow-wrap:anywhere}
    #fpPanel .fp-grid>div:nth-last-child(-n+2){border-bottom:0}
    #fpPanel .fp-k{color:var(--ink2,#9fb0c8);font-size:12.5px}
    #fpPanel .fp-v{font:600 13px var(--mono,monospace)}
    #fpPanel .fp-v.todo{color:var(--amber,#ffb020);font-weight:500}
    #fpPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const p2 = (n) => String(n).padStart(2, "0");

  function cruiseAlt(f) {
    const a = String(f.cruiseAlt || f.alt || "").replace(/[\s,]/g, "").toUpperCase();
    if (!a) return "";
    if (/^FL\d+$/.test(a)) return a;
    const n = +a;
    if (!n) return "";
    return n >= 18000 ? "FL" + Math.round(n / 100) : n % 500 === 0 && n >= 1000 ? String(n) : String(n);
  }
  function rows(f) {
    const p = profile(f);
    if (!p || !p.dep || !p.dst) return null;
    const ident = (x) => String(x.ident || "").toUpperCase();
    const toks = String(f.route || "").toUpperCase().replace(/[,;]/g, " ").split(/\s+/).filter(Boolean);
    while (toks.length && toks[0] === ident(p.dep)) toks.shift();
    while (toks.length && toks[toks.length - 1] === ident(p.dst)) toks.pop();
    const route = toks.join(" ") || "DIRECT";
    const dz = p.depLocal && !isNaN(p.depLocal) ? `${p2(p.depLocal.getUTCHours())}${p2(p.depLocal.getUTCMinutes())}Z` : "";
    const mins = Math.max(1, Math.round(p.ete * 60));
    const ete = `${p2(Math.floor(mins / 60))}${p2(mins % 60)}`;
    const alt = cruiseAlt(f);
    const ifr = f.rules === "IFR";
    return [
      ["1 Flight rules", ifr ? "IFR" : "VFR"],
      ["2 Aircraft identification", f.tail || "", "Enter your tail number"],
      ["3 Aircraft type", (p.ac && p.ac.typeCode) || "", "Enter the type code"],
      ["3 Equipment suffix", "", "From your aircraft equipment, for example /G"],
      ["4 True airspeed", p.ac && p.ac.tas ? `${Math.round(p.ac.tas)} kt` : ""],
      ["5 Departure point", ident(p.dep)],
      ["6 Proposed departure", dz, "Set the date and time"],
      ["7 Cruise altitude", alt, "Set a cruise altitude"],
      ["8 Route", route],
      ["9 Destination", ident(p.dst)],
      ["10 Time en route", `${ete} (hours and minutes)`],
      ["11 Remarks", f.purpose === "give" ? "Instructional flight" : "", "None needed for most flights"],
      ["12 Fuel on board", "", "Hours and minutes of fuel, from Weight, balance and fuel"],
      ["13 Alternate", String(f.alternate || "").toUpperCase(), ifr ? "Needed when the forecast requires one" : "Not needed for VFR"],
    ];
  }
  function asText(f, r) {
    return `FLIGHT PLAN (planning copy from AeroSignal, not filed)\n` + r.map(([k, v, todo]) => `${k}: ${v || `(${todo})`}`).join("\n");
  }
  function build(page, f) {
    const r = rows(f);
    let sec = page.querySelector(":scope > #fpPanel");
    if (!r) { if (sec) sec.remove(); return; }
    const key = JSON.stringify([f.id, r]);
    if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "fpPanel"; }
    if (sec.dataset.key !== key) {
      sec.dataset.key = key;
      sec.innerHTML = `<h2>Flight plan sheet</h2>
        <p class="small muted" style="margin:0">Your flight in the order of the FAA flight plan form. Copy it, then paste it into Flight Service or your filing app. Amber items still need you.</p>
        <div class="fp-grid">${r.map(([k, v, todo]) => `<div class="fp-k">${h(k)}</div><div class="fp-v${v ? "" : " todo"}">${v ? h(v) : h(todo)}</div>`).join("")}</div>
        <button class="btn sec sm" id="fpCopy">Copy flight plan</button>
        <p class="disc">AeroSignal does not file flight plans. Check every item and file with Flight Service or your own app. Planning aid only.</p>`;
      sec.querySelector("#fpCopy").onclick = () => {
        const txt = asText(f, r);
        const done = () => toast("Flight plan copied");
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => toast("Could not copy. Select and copy the items instead"));
        else toast("Could not copy. Select and copy the items instead");
      };
    }
    if (sec.parentNode !== page) page.appendChild(sec);
  }

  let busy = false, t = 0;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      const page = document.querySelector("#view .page");
      if (/^#\/brief(\/|$|\?)/.test(location.hash || "") && page && page.querySelector(":scope > h1") && !page.querySelector("#offSnap")) {
        const f = currentFlight();
        if (f && !f.missionId && (f.points || []).length > 1) build(page, f);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 260); };
  new MutationObserver((list) => {
    if (busy) return;
    if (list.every((m) => m.target.closest && m.target.closest("#fpPanel"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();

  // Demo tour and narrated tutorial
  try {
    if (typeof TOURS !== "undefined") {
      const st = TOURS.civil && TOURS.civil.steps;
      if (Array.isArray(st) && !st._p151) {
        st._p151 = true;
        const i = st.findIndex((s) => s[0] === "#/brief");
        if (i >= 0) st[i] = [st[i][0], st[i][1], `${st[i][2]} The Flight plan sheet lays the flight out in the order of the FAA flight plan form, ready to copy into Flight Service.`];
      }
    }
  } catch (e) { console.error(e); }
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    const sc = T && T.civil && T.civil.scenes;
    if (sc && !sc._p151) {
      sc._p151 = true;
      let at = sc.findIndex((x) => x.hash === "#/feedback");
      if (at < 0) at = sc.length;
      sc.splice(at, 0, { hash: "#/brief", sel: "#fpPanel", wait: "#fpPanel", text: "The Flight plan sheet lists your flight in the order of the FAA flight plan form: rules, aircraft, airspeed, departure time in Zulu, altitude, route, destination, time en route and alternate. Copy it and paste it into Flight Service. AeroSignal does not file the plan for you." });
    }
  } catch (e) { console.error(e); }
})();
