"use strict";
/* p268: accident lessons for the aircraft you fly (November 14, 2026). Until now the brief and the route accident
   map only used light single piston airplanes, and only five trainers counted as "your type". Now the aircraft's
   type code, make and model place it in a class (airline and large jets, business jets, turboprops, piston twins,
   helicopters) and the brief matches against public NTSB accidents in that class, the pilot's own type first
   (a 747 brief leads with 747 accidents, then other airline jets). Eight accident themes written for those
   aircraft join the existing ones: turbulence injuries, ground and taxi collisions, unstabilized approaches,
   turbine engine failures, bird strikes, wire strikes, loss of tail rotor effectiveness and engine loss in a twin.
   Light single pilots see no change. The route accident map and the brief's route section get an
   "Aircraft like mine / All aircraft" switch (S.mishapScope). Needs the database functions brief_matches_v2,
   theme_stats_v2 and accidents_near_route_v2 (migration 20261114_mishaps_by_aircraft_class.sql, approved). */
(function () {
  if (typeof rpc !== "function" || typeof buildBrief !== "function") return;
  const LABEL = {
    airline: ["airline and large jet", "airline and large jets"], jet: ["business jet", "business jets"], turboprop: ["turboprop", "turboprops"],
    twin: ["piston twin", "piston twins"], helo: ["helicopter", "helicopters"],
  };
  // type designator: [class, NTSB model pattern, name]
  const TYPES = {
    B744: ["airline", "747", "Boeing 747"], B748: ["airline", "747", "Boeing 747"], B742: ["airline", "747", "Boeing 747"], B74F: ["airline", "747", "Boeing 747"],
    B737: ["airline", "737", "Boeing 737"], B738: ["airline", "737", "Boeing 737"], B739: ["airline", "737", "Boeing 737"], B38M: ["airline", "737", "Boeing 737 MAX"], B39M: ["airline", "737", "Boeing 737 MAX"],
    B752: ["airline", "757", "Boeing 757"], B753: ["airline", "757", "Boeing 757"], B762: ["airline", "767", "Boeing 767"], B763: ["airline", "767", "Boeing 767"], B764: ["airline", "767", "Boeing 767"],
    B772: ["airline", "777", "Boeing 777"], B77W: ["airline", "777", "Boeing 777"], B77L: ["airline", "777", "Boeing 777"], B788: ["airline", "787", "Boeing 787"], B789: ["airline", "787", "Boeing 787"], B78X: ["airline", "787", "Boeing 787"],
    B712: ["airline", "717", "Boeing 717"], MD11: ["airline", "MD.?11", "MD 11"], MD88: ["airline", "MD.?8", "MD 80"], MD90: ["airline", "MD.?90", "MD 90"], DC10: ["airline", "DC.?10", "DC 10"],
    A318: ["airline", "A31[89]", "Airbus A320 family"], A319: ["airline", "A3(19|20|21)", "Airbus A320 family"], A320: ["airline", "A3(19|20|21)", "Airbus A320 family"], A321: ["airline", "A3(19|20|21)", "Airbus A320 family"],
    A20N: ["airline", "A3(19|20|21)", "Airbus A320 family"], A21N: ["airline", "A3(19|20|21)", "Airbus A320 family"], A332: ["airline", "A33", "Airbus A330"], A333: ["airline", "A33", "Airbus A330"],
    A339: ["airline", "A33", "Airbus A330"], A359: ["airline", "A35", "Airbus A350"], A35K: ["airline", "A35", "Airbus A350"], A388: ["airline", "A38", "Airbus A380"],
    E170: ["airline", "ERJ.?170|170", "Embraer 170/175"], E75L: ["airline", "ERJ.?170|175", "Embraer 170/175"], E75S: ["airline", "ERJ.?170|175", "Embraer 170/175"], E190: ["airline", "ERJ.?190|190", "Embraer 190"], E195: ["airline", "ERJ.?190|195", "Embraer 190"],
    E145: ["airline", "EMB.?145|ERJ.?145", "Embraer 145"], E135: ["airline", "EMB.?135|ERJ.?135", "Embraer 135"], CRJ2: ["airline", "CL.?600.?2B19|CRJ", "Bombardier CRJ"], CRJ7: ["airline", "CL.?600.?2C10|CRJ", "Bombardier CRJ"], CRJ9: ["airline", "CL.?600.?2D24|CRJ", "Bombardier CRJ"],
    AT72: ["turboprop", "ATR.?72", "ATR 72"], AT76: ["turboprop", "ATR.?72", "ATR 72"], AT45: ["turboprop", "ATR.?42", "ATR 42"], DH8A: ["turboprop", "DHC.?8", "Dash 8"], DH8C: ["turboprop", "DHC.?8", "Dash 8"], DH8D: ["turboprop", "DHC.?8", "Dash 8"],
    BE20: ["turboprop", "B?200|B?100|90|C90|E90|F90", "King Air"], BE9L: ["turboprop", "C?90|E90|F90", "King Air"], B350: ["turboprop", "B300|350", "King Air 350"], BE30: ["turboprop", "B?300|350", "King Air 350"],
    PC12: ["turboprop", "PC.?12", "Pilatus PC 12"], C208: ["turboprop", "208", "Cessna Caravan"], TBM7: ["turboprop", "TBM", "TBM"], TBM8: ["turboprop", "TBM", "TBM"], TBM9: ["turboprop", "TBM", "TBM"],
    KODI: ["turboprop", "KODIAK|100", "Kodiak"], DHC6: ["turboprop", "DHC.?6", "Twin Otter"], P46T: ["turboprop", "PA.?46.?500|M500|M600", "Piper Meridian/M600"], B190: ["turboprop", "1900", "Beech 1900"], SF34: ["turboprop", "SF.?340|340", "Saab 340"],
    C25A: ["jet", "525", "Citation CJ"], C25B: ["jet", "525", "Citation CJ"], C25C: ["jet", "525", "Citation CJ"], C510: ["jet", "510", "Citation Mustang"], C525: ["jet", "525", "Citation CJ"], C550: ["jet", "550|551|S550", "Citation II/V"],
    C560: ["jet", "560", "Citation V/Excel"], C56X: ["jet", "560XL|560", "Citation Excel"], C680: ["jet", "680", "Citation Sovereign/Latitude"], C68A: ["jet", "680", "Citation Latitude"], C700: ["jet", "700", "Citation Longitude"], C750: ["jet", "750", "Citation X"],
    LJ35: ["jet", "35", "Learjet 35"], LJ45: ["jet", "45", "Learjet 45"], LJ60: ["jet", "60", "Learjet 60"], GLF4: ["jet", "G.?IV|G.?1159C|GIV", "Gulfstream IV"], GLF5: ["jet", "G.?V|GV", "Gulfstream V"], GLF6: ["jet", "G.?VI|G650", "Gulfstream 650"],
    GLEX: ["jet", "BD.?700|GLOBAL", "Global Express"], CL30: ["jet", "BD.?100", "Challenger 300"], CL35: ["jet", "BD.?100", "Challenger 350"], CL60: ["jet", "CL.?600.?2B16|600", "Challenger 600"],
    E50P: ["jet", "EMB.?500", "Phenom 100"], E55P: ["jet", "EMB.?505", "Phenom 300"], PC24: ["jet", "PC.?24", "Pilatus PC 24"], HDJT: ["jet", "HA.?420", "HondaJet"], SF50: ["jet", "SF50", "Cirrus Vision Jet"], FA7X: ["jet", "FALCON|7X", "Falcon"], F900: ["jet", "FALCON|900", "Falcon"], F2TH: ["jet", "FALCON|2000", "Falcon"],
    BE55: ["twin", "^55|95.?B55", "Beech Baron"], BE58: ["twin", "^58", "Beech Baron 58"], BE76: ["twin", "76", "Beech Duchess"], PA34: ["twin", "PA.?34", "Piper Seneca"], PA44: ["twin", "PA.?44", "Piper Seminole"], PA31: ["twin", "PA.?31", "Piper Navajo"],
    PA30: ["twin", "PA.?30|PA.?39", "Piper Twin Comanche"], PA23: ["twin", "PA.?23", "Piper Aztec"], C310: ["twin", "310", "Cessna 310"], C340: ["twin", "340", "Cessna 340"], C414: ["twin", "414", "Cessna 414"], C421: ["twin", "421", "Cessna 421"],
    DA42: ["twin", "DA.?42", "Diamond DA42"], DA62: ["twin", "DA.?62", "Diamond DA62"], P68: ["twin", "P.?68", "Partenavia P68"],
    R22: ["helo", "R22", "Robinson R22"], R44: ["helo", "R44", "Robinson R44"], R66: ["helo", "R66", "Robinson R66"], B06: ["helo", "206", "Bell 206"], B407: ["helo", "407", "Bell 407"], B412: ["helo", "412", "Bell 412"],
    B429: ["helo", "429", "Bell 429"], B505: ["helo", "505", "Bell 505"], AS50: ["helo", "AS.?350|H125", "Airbus AS350/H125"], EC30: ["helo", "EC.?130|H130", "Airbus EC130"], EC35: ["helo", "EC.?135|H135", "Airbus EC135"],
    EC45: ["helo", "EC.?145|MBB.?BK|H145", "Airbus EC145"], A109: ["helo", "A.?109|AW.?109", "Leonardo AW109"], A139: ["helo", "AW.?139", "Leonardo AW139"], S76: ["helo", "S.?76", "Sikorsky S 76"], H269: ["helo", "269|S.?300", "Schweizer 300"], EN28: ["helo", "F.?28|280", "Enstrom"], MD50: ["helo", "369|500|MD.?500", "MD 500"],
  };
  const TEXT = [
    [/\b747\b/, "B744"], [/\b737\b/, "B738"], [/\b757\b/, "B752"], [/\b767\b/, "B763"], [/\b777\b/, "B772"], [/\b787\b/, "B788"], [/\bA3(19|20|21)\b/, "A320"], [/\bA33\d\b/, "A332"], [/\bA35\d\b/, "A359"],
    [/KING ?AIR/, "BE20"], [/CARAVAN/, "C208"], [/PC.?12/, "PC12"], [/\bTBM\b/, "TBM9"], [/CITATION/, "C560"], [/LEARJET/, "LJ45"], [/GULFSTREAM/, "GLF4"], [/PHENOM 100/, "E50P"], [/PHENOM/, "E55P"],
    [/BARON/, "BE58"], [/SENECA/, "PA34"], [/SEMINOLE/, "PA44"], [/DUCHESS/, "BE76"], [/\bR22\b/, "R22"], [/\bR44\b/, "R44"], [/\bR66\b/, "R66"], [/JET ?RANGER|BELL 206/, "B06"], [/BELL 407/, "B407"], [/AS.?350|ASTAR|H125/, "AS50"],
  ];
  const acOf = (f) => { try { return (allAircraft() || {})[f.tail] || null; } catch (e) { return null; } };
  function classFor(ac) {
    if (!ac) return null;
    const code = String(ac.typeCode || "").toUpperCase().trim();
    let k = TYPES[code] ? code : null;
    if (!k) { const txt = `${code} ${ac.make || ""} ${ac.model || ""} ${ac.type || ""} ${ac.name || ""}`.toUpperCase(); for (const [re, c] of TEXT) if (re.test(txt)) { k = c; break; } if (!k && /HELICOPTER|ROBINSON|SIKORSKY|EUROCOPTER/.test(txt)) return { cls: "helo", re: "", name: "your helicopter", code: "HELO" }; }
    if (!k) return null;
    const [cls, re, name] = TYPES[k];
    return { cls, re, name, code: k };
  }
  const flightClass = () => { try { const f = currentFlight(); return f && !f.missionId ? classFor(acOf(f)) : null; } catch (e) { return null; } };
  const scope = () => { try { return S.mishapScope === "all" ? "all" : "mine"; } catch (e) { return "mine"; } };

  /* New themes, only for the larger aircraft classes */
  const big = (t, list) => !!(t.acClass && list.includes(t.acClass.cls));
  Object.assign(RX, {
    turb: /turbulence/i, ground: /taxi|wing ?tip|ramp|tug|push.?back|struck (a|the|another) (parked|light pole|hangar|vehicle)/i,
    unstab: /unstabili[sz]ed|go.?around|overr?an|landed long|long landing|excessive (air)?speed|high (rate of )?descent/i, engfail: /engine (failure|failed|fire)|uncontained|shut down the|one engine|inoperative/i,
    bird: /\bbirds?\b|geese|flock/i, wire: /\bwires?\b|power ?lines?|transmission lines?|utility lines?/i, lte: /tail rotor|yaw|spin(ning)?\b/i, vmc: /minimum control|\bVmc\b|engine inoperative|one engine|feather/i,
  });
  THEMES.push(
    { k: "turb", ph: 2, w: 4, need: ["turb"], on: (t) => big(t, ["airline", "jet", "turboprop"]), why: () => ["Cabin injury events lead the record for your class"], title: () => "Turbulence and cabin injuries", watch: "Most of these injured people who were standing or not strapped in. Brief the cabin, keep the seat belt sign on near convective weather and in known turbulence, and get the latest PIREPs before descent." },
    { k: "ground", ph: 1, w: 3, need: ["ground"], on: (t) => big(t, ["airline", "jet"]), why: () => ["Large wingspan on ramps and taxiways"], title: () => "Ground and taxi collisions", watch: "Wingtip and tail strikes on ramps are common and expensive. Know the taxi route and wingspan limits, slow down near other aircraft, and stop and ask when clearance is in doubt." },
    { k: "unstab", ph: 3, w: 5, need: ["unstab"], on: (t) => big(t, ["airline", "jet", "turboprop"]), why: () => ["Approach and landing in a fast, heavy aircraft"], title: () => "Unstabilized approaches and runway overruns", watch: "Overruns usually follow an approach that was fast or high and was continued anyway. Set the stable approach gate in the brief and fly the go around when it is not met." },
    { k: "engfail", ph: 1, w: 4, need: ["engfail"], on: (t) => big(t, ["airline", "jet", "turboprop", "twin"]), why: () => ["Engine failures in your class"], title: () => "Engine failure in climb", watch: "Brief the engine failure plan before takeoff: who flies, the speeds, the return or alternate airport and the first actions. Fly the airplane first." },
    { k: "bird", ph: 1, w: 3, need: ["bird"], on: (t) => big(t, ["airline", "jet", "turboprop"]), why: () => ["Bird strikes cluster in departure and arrival"], title: () => "Bird strikes", watch: "Most strikes happen below 3,000 ft near the airport. Check the airport's wildlife NOTAMs, and be ready for an engine or windshield problem in the climb." },
    { k: "wire", ph: 2, w: 6, need: ["wire"], on: (t) => big(t, ["helo"]), why: () => ["Low altitude helicopter flight"], title: () => "Wire strikes", watch: "Wires are hard to see and often unmarked. Survey the area from altitude first, look for poles and towers rather than the wires, and plan the low work around them." },
    { k: "lte", ph: 3, w: 5, need: ["lte"], on: (t) => big(t, ["helo"]), why: () => ["Low speed flight and wind from behind"], title: () => "Loss of tail rotor effectiveness", watch: "Most of these began at low speed with wind from the left rear. Know the wind, avoid slow right turns downwind, and keep forward speed when you can." },
    { k: "vmc", ph: 1, w: 6, need: ["vmc"], on: (t) => big(t, ["twin"]), why: () => ["Engine loss in a light twin"], title: () => "Engine loss and loss of control in a twin", watch: "Most fatal twin engine failures end in loss of control, not in the failure itself. Brief blue line, identify, verify and feather, and below safe single engine speed, be ready to land straight ahead." },
  );

  /* Brief: carry the class on the flight profile so themes, counts and wording follow it */
  const origBuild = buildBrief;
  buildBrief = async function (t) {
    const c = scope() === "mine" && t && t.f && !t.f.missionId ? classFor(t.ac || acOf(t.f)) : null;
    if (c) { t.acClass = c; t.fam = `X:${c.code}`; FAMNAME[t.fam] = c.name; }
    return origBuild(t);
  };
  const origRpc = rpc;
  rpc = function (name, args) {
    try {
      if ((name === "brief_matches" || name === "theme_stats") && args && /^X:/.test(args.fam || "")) {
        const c = TYPES[args.fam.slice(2)] || (args.fam === "X:HELO" ? ["helo", "", ""] : null);
        if (c) return name === "brief_matches"
          ? origRpc("brief_matches_v2", { theme_keys: args.theme_keys, cls: c[0], type_re: c[1] || null, per_theme: args.per_theme || 3 })
          : origRpc("theme_stats_v2", { theme_keys: args.theme_keys, cls: c[0], type_re: c[1] || null });
      }
      if (name === "accidents_near_route" && args) {
        const c = flightClass(), sc = scope();
        if (sc === "all") return origRpc("accidents_near_route_v2", { ...args, cls: "all" });
        if (c) return origRpc("accidents_near_route_v2", { ...args, cls: c.cls });
      }
    } catch (e) {}
    return origRpc.apply(this, arguments);
  };

  /* Wording and the scope switch */
  function words(root, c) {
    const [one, many] = LABEL[c.cls];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const v = n.nodeValue; if (!/light single/i.test(v)) continue;
      n.nodeValue = v.replace(/light single narratives/gi, `${one} narratives`).replace(/other light singles/gi, `other ${many}`).replace(/light singles/gi, many).replace(/Light single accidents/g, `${one[0].toUpperCase() + one.slice(1)} accidents`).replace(/light single/gi, one);
    }
  }
  function sw(where) {
    if (!where || where.querySelector(".ms-scope")) return;
    const c = flightClass();
    const mine = c ? `${LABEL[c.cls][1][0].toUpperCase()}${LABEL[c.cls][1].slice(1)} like mine` : "Light singles like mine";
    const d = document.createElement("div"); d.className = "ms-scope";
    d.innerHTML = `<button type="button" data-v="mine">${mine}</button><button type="button" data-v="all">All aircraft</button>`;
    d.querySelectorAll("button").forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.v === scope())); b.onclick = () => { if (b.dataset.v === scope()) return; try { S.mishapScope = b.dataset.v; save(); } catch (e) {} toast("Updating accidents"); setTimeout(() => location.reload(), 300); }; });
    where.prepend(d);
  }
  const st = document.createElement("style");
  st.textContent = `.ms-scope{display:inline-flex;border:1px solid var(--line2,rgba(255,255,255,.18));border-radius:999px;padding:2px;margin:0 0 8px}
    .ms-scope button{appearance:none;border:0;background:transparent;color:inherit;font:600 12.5px var(--body,system-ui);padding:6px 12px;border-radius:999px;cursor:pointer;min-height:32px}
    .ms-scope button[aria-pressed="true"]{background:var(--accent,#3DE0FF);color:#06121F}`;
  document.head.appendChild(st);
  function apply() {
    const h = location.hash || "", c = flightClass();
    if (/^#\/brief(\/|$|\?)/.test(h)) {
      const bb = document.getElementById("bbody"); if (bb && c && scope() === "mine") words(bb, c);
      const rt = document.getElementById("rtPanel");
      if (rt) { if (c && scope() === "mine") words(rt, c); const body = rt.querySelector(":scope > h2 + *"); if (body && !rt.querySelector(".ms-scope")) { const box = document.createElement("div"); body.before(box); sw(box); } }
    }
    if (/^#\/maps(\/|$|\?)/.test(h)) {
      const sum = document.getElementById("msum"); if (sum && c && scope() === "mine") words(sum.parentElement || sum, c);
      if (sum && !document.querySelector("#view .ms-scope")) { const box = document.createElement("div"); box.style.margin = "6px 0 0"; sum.after(box); sw(box); }
    }
  }
  let t = 0;
  new MutationObserver((l) => { if (l.every((m) => m.target.closest && m.target.closest(".ms-scope"))) return; clearTimeout(t); t = setTimeout(apply, 200); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroAcClass = { classFor, flightClass, TYPES, LABEL };
})();
