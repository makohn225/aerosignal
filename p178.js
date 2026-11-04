"use strict";
/* p178: clearance practice (November 4, 2026). #/clearance builds the IFR clearance a pilot would likely hear for
   the current flight, in the CRAFT order (Clearance limit, Route, Altitude, Frequency, Transponder), from public
   data the app already uses: the FAA preferred route database (prefroutes), the departure frequency (freq) and the
   flight's own route and altitude. The pilot can read it, hear it read at ATC pace on the device voice, or copy it
   blind into five boxes and get each item checked, then see the readback. Practice only: the real clearance may
   differ. Nothing is stored or sent beyond the lookups. */
(function () {
  if (typeof ROUTES === "undefined") return;
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DIG = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "niner"];
  const digits = (s) => String(s).split("").map((c) => (c === "." ? "point" : /\d/.test(c) ? DIG[+c] : c)).join(" ");
  function altWords(ft) {
    const th = Math.floor(ft / 1000), hu = Math.round((ft % 1000) / 100);
    const t = th >= 10 ? `${digits(String(th))} thousand` : th ? `${DIG[th] === "niner" ? "niner" : DIG[th]} thousand` : "";
    return `${t}${hu ? `${t ? " " : ""}${DIG[hu]} hundred` : ""}`.trim();
  }
  function squawk() {
    for (;;) { const s = Array.from({ length: 4 }, () => Math.floor(Math.random() * 8)).join(""); if (!/^(1200|7500|7600|7700|0000)$/.test(s)) return s; }
  }
  const css = document.createElement("style");
  css.textContent = `
    .clr .crf{display:grid;grid-template-columns:28px minmax(0,1fr);gap:4px 10px;align-items:baseline;margin:6px 0}
    .clr .crf b{font:700 18px var(--disp,system-ui);color:var(--cyan,#3DE0FF)}
    .clr .crf label{display:block;font-size:12.5px;color:var(--ink2,#9db2ce)}
    .clr .crf input{width:100%;box-sizing:border-box;min-height:40px}
    .clr .say{font-family:var(--mono,monospace);font-size:14px;line-height:1.55;background:rgba(0,0,0,.2);border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:12px;padding:12px 14px}
    .clr .row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
    .clr .ok{color:#3ddc97}.clr .bad{color:#ff4d6a}
    .clr .res p{margin:4px 0;font-size:14px}`;
  document.head.appendChild(css);

  async function build(f) {
    const pts = (f.points || []).filter((p) => p.ident);
    const apts = pts.filter((p) => p.kind === "airport");
    const dep = apts[0], dest = apts[apts.length - 1];
    if (!dep || !dest || dep.ident === dest.ident) return null;
    const call = String(f.tail || "N12345").toUpperCase();
    let alt = 0; try { alt = window.AeroWinds && AeroWinds.altOf ? Number(AeroWinds.altOf(f)) || 0 : 0; } catch (e) {}
    if (!alt) alt = 6000;
    alt = Math.round(alt / 1000) * 1000 || 6000;
    const initial = Math.min(alt, alt > 5000 ? 5000 : alt);
    let route = null;
    try {
      const j = await fnGet(`prefroutes?o=${encodeURIComponent(dep.ident)}&d=${encodeURIComponent(dest.ident)}`);
      const r = (j && j.exact || [])[0];
      if (r && r.route) route = r.route.replace(/^\S+\s+/, "").replace(/\s+\S+$/, "").trim() || null;
    } catch (e) {}
    const mid = pts.slice(1, -1).map((p) => p.ident).filter((x) => x && x !== dest.ident);
    const routeText = route ? `via ${route}, then direct` : mid.length ? `via radar vectors ${mid[0]}, then as filed` : "via radar vectors, then direct";
    let freq = null;
    try {
      const j = await fnGet(`freq?ids=${encodeURIComponent(dep.ident)}`);
      const L = (j && j.rows && (j.rows[dep.ident] || j.rows[Object.keys(j.rows)[0]])) || [];
      const d = L.find((x) => /DEP/i.test(x.desc || "") || x.type === "A/D") || L.find((x) => /APP/i.test(x.desc || ""));
      if (d) freq = String(d.mhz).replace(/(\.\d{2})0$/, "$1");
    } catch (e) {}
    const sq = squawk();
    const destName = (dest.name || dest.ident).replace(/\s+(Rgnl|Regional|Intl|International|Muni|Municipal|Airport|Arpt|Fld|Field)\b.*$/i, "");
    const C = { k: "C", label: "Clearance limit", text: `${dest.ident} (${dest.name || dest.ident})`, say: `cleared to the ${destName} airport`, key: [dest.ident.replace(/^K/, "")] };
    const R = { k: "R", label: "Route", text: route ? `${route}, then direct` : mid.length ? `Radar vectors ${mid[0]}, then as filed` : "Radar vectors, then direct", say: routeText, key: route ? route.split(/\s+/).slice(0, 3) : mid.length ? [mid[0]] : ["vectors"] };
    const A = { k: "A", label: "Altitude", text: `${initial.toLocaleString()} ft, expect ${alt.toLocaleString()} ft 10 minutes after departure`, say: `climb and maintain ${altWords(initial)}, expect ${altWords(alt)} one zero minutes after departure`, key: [String(initial / 1000), String(alt / 1000)] };
    const F = { k: "F", label: "Frequency", text: freq ? `Departure ${freq}` : "No published departure frequency found; ask clearance delivery", say: freq ? `departure frequency ${digits(freq)}` : "", key: freq ? [freq] : [] };
    const T = { k: "T", label: "Transponder", text: `Squawk ${sq}`, say: `squawk ${digits(sq)}`, key: [sq] };
    const items = [C, R, A, F, T];
    const ICAO = { A: "Alfa", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot", G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima", M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo", S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey", X: "X ray", Y: "Yankee", Z: "Zulu" };
    const spokenCall = call.replace(/[^A-Z0-9]/g, "").split("").map((c) => (/\d/.test(c) ? DIG[+c] : ICAO[c] || c)).join(" ");
    const say = `${spokenCall}, ${items.filter((x) => x.say).map((x) => x.say).join(", ")}.`;
    const readback = `${items.filter((x) => x.say).map((x) => x.say.replace(/^cleared to the/, "Cleared to the")).join(", ")}, ${call}.`;
    return { dep, dest, call, items, say, readback, prefUsed: !!route };
  }
  function speak(text, btn) {
    const ss = window.speechSynthesis;
    if (!ss || typeof SpeechSynthesisUtterance === "undefined") return false;
    try { ss.cancel(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(text); u.rate = 1.15; u._aero = true;
    if (btn) { btn.disabled = true; u.onend = u.onerror = () => (btn.disabled = false); }
    ss.speak(u); return true;
  }
  const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9.]/g, "");
  function check(item, val) {
    const v = norm(val);
    if (!item.key.length) return true;
    if (item.k === "A") return item.key.every((k) => new RegExp(`(^|\\D)${k}(000|K|\\D|$)`).test(String(val).toUpperCase().replace(/,/g, "")));
    if (item.k === "R" && item.key[0] === "vectors") return /VECTOR|RV/.test(v);
    return item.key.every((k) => v.includes(norm(k)) || v.includes(norm(k).replace(/^K/, "")));
  }

  ROUTES.clearance = function (el) {
    let f = null; try { f = currentFlight(); } catch (e) {}
    el.innerHTML = `<div class="page clr"><h1>Clearance practice</h1>
      <p class="lede">The IFR clearance you would likely hear for this flight, in CRAFT order. Read it, listen to it, or copy it blind and check yourself.</p>
      <div id="clOut"><p class="muted">${f && (f.points || []).length ? "Building the clearance…" : "Plan a flight with a departure and destination airport first."}</p></div>
      <p class="small muted">Practice only. Built from the FAA preferred route database, published frequencies and your plan; the clearance ATC gives you may differ.</p></div>`;
    const out = el.querySelector("#clOut");
    if (!f || !(f.points || []).length) { out.innerHTML += `<p><a class="btn" href="#/plan">Plan a flight</a></p>`; return; }
    build(f).then((c) => {
      if (!el.isConnected) return;
      if (!c) { out.innerHTML = `<p>Clearance practice needs a flight between two different airports.</p><p><a class="btn" href="#/plan">Plan a flight</a></p>`; return; }
      out.innerHTML = `<section class="panel"><h2>${h(c.call)}: ${h(c.dep.ident)} to ${h(c.dest.ident)}</h2>
          <div class="row"><button type="button" class="btn" id="clListen">Listen</button><button type="button" class="btn sec" id="clShow">Show the clearance</button><button type="button" class="btn sec" id="clNew">New squawk</button></div>
          <p class="small muted" style="margin:0">Copy it blind below first, then check. ${c.prefUsed ? "The route comes from the FAA preferred route for this pair." : "No published preferred route for this pair, so the route is vectors and as filed."}</p>
          <div id="clText" hidden><p class="say">${h(c.say)}</p>${c.items.map((x) => `<p class="small" style="margin:2px 0"><b>${x.k}</b> ${h(x.label)}: ${h(x.text)}</p>`).join("")}</div></section>
        <section class="panel"><h2>Copy</h2>${c.items.map((x) => `<div class="crf"><b>${x.k}</b><div><label for="cl_${x.k}">${h(x.label)}</label><input id="cl_${x.k}" autocomplete="off" autocapitalize="characters"></div></div>`).join("")}
          <div class="row"><button type="button" class="btn mag" id="clCheck">Check my copy</button></div><div class="res" id="clRes"></div></section>`;
      out.querySelector("#clListen").onclick = (e) => { if (!speak(c.say, e.target)) { out.querySelector("#clText").hidden = false; } };
      out.querySelector("#clShow").onclick = () => { const t = out.querySelector("#clText"); t.hidden = !t.hidden; };
      out.querySelector("#clNew").onclick = () => ROUTES.clearance(el);
      out.querySelector("#clCheck").onclick = () => {
        let n = 0;
        const rows = c.items.map((x) => { const ok = check(x, out.querySelector(`#cl_${x.k}`).value); if (ok) n++; return `<p><b class="${ok ? "ok" : "bad"}">${ok ? "Got it" : "Check"}</b> ${x.k}, ${h(x.label)}: ${h(x.text)}</p>`; });
        out.querySelector("#clRes").innerHTML = `<p><b>${n} of ${c.items.length}</b> copied.</p>${rows.join("")}<p style="margin-top:10px"><b>Readback:</b> ${h(c.readback)}</p>`;
      };
    }).catch((e) => { console.error(e); out.innerHTML = `<p>The clearance could not be built right now.</p>`; });
  };
  window.AeroClearance = { build, altWords, digits, check };
})();
