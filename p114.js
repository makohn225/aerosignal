"use strict";
/* p114: an animated tutorial. Each tutorial step shows a short animation beside the caption, drawn
   in the style of the intro video (a route drawing itself with mishaps popping up, words typing into
   the planner, the bottom line sliding in and the verdict badge landing, a wind arrow swinging onto
   the runway, a track replaying for the debrief, and so on). A one second chapter card opens each
   section (Plan, Brief, Maps, Fly, Debrief, Logbook, Study), the spotlight glides between features,
   and finishing the tutorial ends on a card with "Plan your first flight". The words, narration and
   order of the steps are unchanged. With reduced motion set on the device, everything holds still. */
(function () {
  const C = "#3DE0FF", A = "#FFB547", R = "#ff4d6a", G = "#46e39b", I = "#EAF2FF", M = "rgba(234,242,255,.35)";
  const css = document.createElement("style");
  css.textContent = `
    #tutRing{transition:left .55s cubic-bezier(.22,1,.36,1),top .55s cubic-bezier(.22,1,.36,1),width .55s cubic-bezier(.22,1,.36,1),height .55s cubic-bezier(.22,1,.36,1),opacity .25s!important}
    #tutBar .ta-row{display:flex;gap:14px;align-items:center}
    #tutBar .ta-row > .tt{flex:1;min-width:0}
    #tutArt{flex:none;width:168px;height:94px;border-radius:12px;background:radial-gradient(120% 120% at 30% 0%,#0b1a33,#050A14);border:1px solid rgba(61,224,255,.28);overflow:hidden}
    #tutArt svg{width:100%;height:100%;display:block}
    @media (max-width:860px){#tutArt{width:96px;height:54px;border-radius:9px}#tutBar .ta-row{gap:10px}}
    @media (max-width:380px){#tutArt{display:none}}
    #tutArt .dr{stroke-dasharray:1;stroke-dashoffset:1;animation:taDraw 2.2s ease forwards}
    #tutArt .po{transform-box:fill-box;transform-origin:center;opacity:0;animation:taPop .5s ease forwards}
    #tutArt .fi{opacity:0;animation:taFade .6s ease forwards}
    #tutArt .sl{opacity:0;transform-box:fill-box;animation:taSlide .55s cubic-bezier(.22,1,.36,1) forwards}
    #tutArt .rg{transform-box:fill-box;transform-origin:center;opacity:0;animation:taRing 2s ease-out infinite}
    #tutArt .sw{transform-box:fill-box;transform-origin:50% 100%;animation:taSwing 2.4s cubic-bezier(.22,1,.36,1) forwards}
    #tutArt .ty{overflow:hidden;white-space:nowrap}
    #tutArt .gl{animation:taGlow 2.2s ease-in-out infinite}
    #tutArt .fl{transform-box:fill-box;transform-origin:center;animation:taFlip .9s cubic-bezier(.22,1,.36,1) both}
    @keyframes taDraw{to{stroke-dashoffset:0}}
    @keyframes taPop{0%{opacity:0;transform:scale(.2)}70%{opacity:1;transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}
    @keyframes taFade{to{opacity:1}}
    @keyframes taSlide{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
    @keyframes taRing{0%{opacity:.9;transform:scale(.4)}100%{opacity:0;transform:scale(2.6)}}
    @keyframes taSwing{from{transform:rotate(-70deg)}to{transform:rotate(0)}}
    @keyframes taGlow{0%,100%{opacity:.5}50%{opacity:1}}
    @keyframes taFlip{0%{transform:rotateX(90deg) scale(.6);opacity:0}100%{transform:none;opacity:1}}
    #tutChap{position:fixed;inset:0;z-index:10001;display:grid;place-items:center;pointer-events:none;background:radial-gradient(60% 50% at 50% 50%,rgba(5,10,20,.82),rgba(5,10,20,0));opacity:0;animation:tcIn 1.25s ease forwards}
    #tutChap div{text-align:center;transform:translateY(8px);animation:tcUp 1.25s cubic-bezier(.22,1,.36,1) forwards}
    #tutChap small{display:block;font:700 11px var(--disp,system-ui);letter-spacing:4px;color:${C};margin-bottom:6px}
    #tutChap b{font:700 clamp(34px,7vw,60px)/1 var(--disp,system-ui);letter-spacing:2px;color:${I};text-shadow:0 0 30px rgba(61,224,255,.45)}
    #tutChap i{display:block;height:3px;margin:12px auto 0;background:${C};border-radius:3px;width:0;animation:tcBar 1s .15s ease forwards}
    @keyframes tcIn{0%{opacity:0}18%{opacity:1}75%{opacity:1}100%{opacity:0}}
    @keyframes tcUp{to{transform:none}}
    @keyframes tcBar{to{width:120px}}
    #tutFin{position:fixed;inset:0;z-index:10002;display:grid;place-items:center;background:rgba(3,8,18,.78);padding:16px}
    #tutFin .fc{width:min(460px,100%);text-align:center;background:radial-gradient(120% 90% at 50% 0%,#0b1a33,#050A14);border:1px solid rgba(61,224,255,.5);border-radius:18px;padding:22px 20px 18px;box-shadow:0 20px 60px rgba(0,0,0,.6);animation:tcUp .5s ease both;transform:translateY(10px)}
    #tutFin svg{width:100%;max-width:300px;height:auto}
    #tutFin h2{margin:6px 0 6px;font:700 24px var(--disp,system-ui);color:${I}}
    #tutFin p{margin:0 0 14px;color:#c4d3e6;font-size:14.5px;line-height:1.5}
    #tutFin .warn{color:${R};font-weight:700;font-size:13px}
    #tutFin .bt{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
    @media (prefers-reduced-motion:reduce){#tutArt *,#tutChap,#tutChap *,#tutFin .fc{animation-duration:.01s!important;animation-iteration-count:1!important;animation-delay:0s!important}#tutChap{display:none}#tutRing{transition:none!important}}
  `;
  document.head.appendChild(css);

  const d = (s) => `style="animation-delay:${s}s"`;
  const grid = () => { let g = ""; for (let x = 0; x <= 160; x += 20) g += `<line x1="${x}" y1="0" x2="${x}" y2="90" stroke="rgba(61,224,255,.07)"/>`; for (let y = 0; y <= 90; y += 20) g += `<line x1="0" y1="${y}" x2="160" y2="${y}" stroke="rgba(61,224,255,.07)"/>`; return g; };
  const plane = (c) => `<path d="M0,-7 L2,-2 L9,1 L9,3 L2,2 L1.5,6 L4,8 L4,9 L0,8 L-4,9 L-4,8 L-1.5,6 L-2,2 L-9,3 L-9,1 L-2,-2 Z" fill="${c}"/>`;
  const dot = (x, y, s, c = R) => `<g transform="translate(${x},${y})"><circle r="6" fill="none" stroke="${c}" class="rg" ${d(s + 0.3)}/><circle r="3.2" fill="${c}" class="po" ${d(s)}/></g>`;
  const svg = (label, body) => `<svg viewBox="0 0 160 90" role="img" aria-label="${label}">${grid()}${body}</svg>`;
  const fly = (path, dur, c = I, sc = 0.9) => `<g><animateMotion dur="${dur}s" begin="0.2s" fill="freeze" rotate="auto" path="${path}"/><g transform="rotate(90) scale(${sc})">${plane(c)}</g></g>`;

  const ART = {
    route: () => { const p = "M12,74 C40,70 46,34 74,38 S112,62 128,36 S146,18 150,16"; return svg("A route drawing itself with mishaps along it", `<path d="${p}" fill="none" stroke="rgba(61,224,255,.18)" stroke-width="10" stroke-linecap="round" class="fi" ${d(1)}/><path d="${p}" pathLength="1" fill="none" stroke="${C}" stroke-width="2" class="dr"/>${dot(36, 64, 1.1)}${dot(70, 39, 1.5, A)}${dot(104, 52, 1.9)}${dot(140, 22, 2.3, A)}${fly(p, 5)}`); },
    type: () => svg("Words typing into the planner and becoming a route", `<rect x="10" y="10" width="140" height="26" rx="6" fill="rgba(10,22,42,.95)" stroke="${M}"/><clipPath id="taC"><rect x="16" y="14" height="18" width="0"><animate attributeName="width" from="0" to="128" dur="1.8s" begin="0.2s" fill="freeze"/></rect></clipPath><text x="17" y="27" font-size="9" fill="${I}" clip-path="url(#taC)">VFR KJYO to KOKV at 0930</text><path d="M24,74 L80,52 L136,68" pathLength="1" fill="none" stroke="${C}" stroke-width="2" class="dr" ${d(2)}/>${["KJYO", "CSN", "KOKV"].map((t, i) => `<g class="po" ${d(2.1 + i * 0.35)}><circle cx="${[24, 80, 136][i]}" cy="${[74, 52, 68][i]}" r="3.5" fill="${I}"/><text x="${[24, 80, 136][i]}" y="${[86, 46, 82][i]}" text-anchor="middle" font-size="7" fill="#c4d3e6">${t}</text></g>`).join("")}`),
    verdict: () => svg("The bottom line items slide in and the verdict badge lands", `${[["Currency current", G], ["Crosswind 9 kt, limit 15", G], ["Night arrival", A]].map(([t, c], i) => `<g class="sl" ${d(0.2 + i * 0.35)}><circle cx="14" cy="${18 + i * 16}" r="4" fill="${c}"/><rect x="24" y="${14 + i * 16}" width="${[70, 84, 56][i]}" height="7" rx="3.5" fill="rgba(234,242,255,.22)"/></g>`).join("")}<g class="fl" ${d(1.4)}><rect x="34" y="62" width="92" height="22" rx="6" fill="rgba(255,181,71,.12)" stroke="${A}" stroke-width="1.6"/><text x="80" y="77.5" text-anchor="middle" font-size="12" font-weight="800" letter-spacing="1.5" fill="${A}">CAUTION</text></g>`),
    bluf: () => svg("A mishap opens with the bottom line first", `<rect x="10" y="8" width="140" height="74" rx="8" fill="rgba(10,22,42,.95)" stroke="${C}" stroke-opacity=".6"/><text x="18" y="22" font-size="8" font-weight="700" fill="${C}" letter-spacing="1">BOTTOM LINE</text>${[0, 1, 2].map((i) => `<g class="sl" ${d(0.3 + i * 0.4)}><circle cx="22" cy="${36 + i * 14}" r="5" fill="${i ? "rgba(61,224,255,.18)" : "rgba(255,181,71,.2)"}"/><text x="22" y="${38.5 + i * 14}" text-anchor="middle" font-size="6.5" font-weight="700" fill="${i ? C : A}">${i + 1}</text><rect x="32" y="${33 + i * 14}" width="${[96, 80, 66][i]}" height="6" rx="3" fill="rgba(234,242,255,.22)"/></g>`).join("")}`),
    frat: () => svg("A risk score gauge settling on low", `<path d="M30,72 A50,50 0 0 1 130,72" fill="none" stroke="rgba(234,242,255,.12)" stroke-width="10"/><path d="M30,72 A50,50 0 0 1 130,72" pathLength="1" fill="none" stroke="${G}" stroke-width="10" class="dr" style="animation-duration:1.6s;stroke-dashoffset:1;stroke-dasharray:.32 1"/><g class="sw" style="transform-origin:80px 72px"><line x1="80" y1="72" x2="56" y2="38" stroke="${I}" stroke-width="2.5" stroke-linecap="round"/></g><circle cx="80" cy="72" r="4" fill="${I}"/><text x="80" y="88" text-anchor="middle" font-size="8" font-weight="700" letter-spacing="1.5" fill="${G}" class="fi" ${d(1.6)}>LOW RISK</text>`),
    tfr: () => svg("A flight restriction circle near the route", `<path d="M10,70 L150,24" pathLength="1" stroke="${C}" stroke-width="2" fill="none" class="dr"/><circle cx="96" cy="58" r="20" fill="rgba(255,77,106,.12)" stroke="${R}" stroke-dasharray="4 3" class="po" ${d(1)}/><text x="96" y="61" text-anchor="middle" font-size="8" font-weight="700" fill="${R}" class="fi" ${d(1.4)}>TFR</text>${fly("M10,70 L150,24", 4.5)}`),
    phases: () => svg("Accident lessons sorted by phase of flight", `${["TAKEOFF", "CRUISE", "APPROACH", "LANDING"].map((t, i) => `<g class="po" ${d(0.2 + i * 0.3)}><rect x="${8 + i * 38}" y="${70 - [22, 12, 40, 30][i]}" width="30" height="${[22, 12, 40, 30][i]}" rx="3" fill="${i === 2 ? "rgba(255,77,106,.45)" : "rgba(61,224,255,.35)"}"/></g><text x="${23 + i * 38}" y="82" text-anchor="middle" font-size="6" fill="#c4d3e6" class="fi" ${d(0.3 + i * 0.3)}>${t}</text>`).join("")}<text x="99" y="22" text-anchor="middle" font-size="7.5" font-weight="700" fill="${R}" class="fi" ${d(1.6)}>most like yours</text>`),
    terrain: () => svg("A safe altitude line above the terrain", `<path d="M0,84 L18,70 L30,76 L48,52 L62,62 L80,38 L96,56 L112,46 L130,64 L146,58 L160,72 L160,90 L0,90Z" fill="rgba(70,227,155,.14)" stroke="rgba(70,227,155,.6)" class="fi"/><path d="M0,26 L160,26" pathLength="1" stroke="${C}" stroke-width="2" stroke-dasharray="1" class="dr" ${d(0.6)}/><text x="152" y="20" text-anchor="end" font-size="8" font-weight="700" fill="${C}" class="fi" ${d(1.6)}>SAFE 5,500 FT</text><line x1="80" y1="38" x2="80" y2="27" stroke="${A}" stroke-dasharray="2 2" class="fi" ${d(1.9)}/>`),
    wind: () => svg("A wind arrow swinging onto the runway", `<g transform="rotate(-25 80 50)"><rect x="70" y="10" width="20" height="74" rx="2" fill="#2a3446" stroke="${M}"/><line x1="80" y1="16" x2="80" y2="78" stroke="${I}" stroke-dasharray="6 5" stroke-width="1.2"/><text x="80" y="80" text-anchor="middle" font-size="7" fill="${I}" font-weight="700">16</text></g><g class="sw" style="transform-origin:34px 46px"><line x1="34" y1="46" x2="34" y2="16" stroke="${A}" stroke-width="3" stroke-linecap="round"/><path d="M28,24 L34,14 L40,24" fill="none" stroke="${A}" stroke-width="3" stroke-linejoin="round"/></g><text x="130" y="30" text-anchor="middle" font-size="8" fill="${G}" font-weight="700" class="fi" ${d(1.8)}>HEAD 7</text><text x="130" y="44" text-anchor="middle" font-size="8" fill="${A}" font-weight="700" class="fi" ${d(2.1)}>CROSS 4</text>`),
    divert: () => svg("Diversion airports within reach along the route", `<path d="M10,46 L150,46" pathLength="1" stroke="${C}" stroke-width="2" fill="none" class="dr"/>${[[40, 26], [74, 66], [118, 30]].map(([x, y], i) => `<g class="po" ${d(0.9 + i * 0.35)}><circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${G}" stroke-opacity=".5"/><circle cx="${x}" cy="${y}" r="3.5" fill="${G}"/></g><line x1="${x}" y1="${y}" x2="${x}" y2="46" stroke="${G}" stroke-dasharray="2 2" class="fi" ${d(1.2 + i * 0.35)}/>`).join("")}${fly("M10,46 L150,46", 5)}`),
    navlog: () => svg("A navlog card filling in leg by leg", `<rect x="10" y="8" width="140" height="74" rx="8" fill="rgba(10,22,42,.95)" stroke="${C}" stroke-opacity=".6"/><text x="18" y="21" font-size="7.5" font-weight="700" fill="${C}" letter-spacing="1">NAVLOG</text>${[0, 1, 2, 3].map((i) => `<g class="sl" ${d(0.3 + i * 0.3)}><text x="18" y="${36 + i * 12}" font-size="7" fill="${I}">${["SP", "ACP 1", "ACP 2", "LZ"][i]}</text><text x="70" y="${36 + i * 12}" font-size="7" fill="#c4d3e6">${["136°", "212°", "174°", "090°"][i]}</text><text x="104" y="${36 + i * 12}" font-size="7" fill="#c4d3e6">${["12 nm", "8 nm", "15 nm", "4 nm"][i]}</text><text x="142" y="${36 + i * 12}" text-anchor="end" font-size="7" fill="${i === 3 ? A : "#c4d3e6"}">${["0:00", "0:06", "0:10", "0:18"][i]}</text></g>`).join("")}`),
    logbook: () => svg("Logbook totals and currency filling in", `${[44, 62, 30, 70, 52, 66].map((h, i) => `<rect x="${12 + i * 16}" y="${80 - h * 0.8}" width="11" height="${h * 0.8}" rx="2" fill="rgba(61,224,255,.4)" class="po" ${d(0.1 + i * 0.15)}/>`).join("")}${["DAY", "NIGHT", "IFR"].map((t, i) => `<g class="sl" ${d(1 + i * 0.3)}><circle cx="122" cy="${26 + i * 18}" r="4" fill="${G}"/><text x="130" y="${29 + i * 18}" font-size="7.5" fill="${I}">${t}</text></g>`).join("")}`),
    oa: () => svg("An objective area diagram with landing zones", `<rect x="40" y="24" width="80" height="48" fill="rgba(255,181,71,.07)" stroke="${A}" stroke-dasharray="4 3" class="fi"/>${[[58, 40], [100, 56]].map(([x, y], i) => `<g class="po" ${d(0.6 + i * 0.4)}><rect x="${x - 7}" y="${y - 5}" width="14" height="10" fill="rgba(128,192,255,.3)" stroke="#80c0ff"/></g>`).join("")}<path d="M8,80 L58,40 L100,56 L154,14" pathLength="1" fill="none" stroke="${C}" stroke-width="2" class="dr" ${d(1)}/><text x="80" y="20" text-anchor="middle" font-size="7" fill="${A}" class="fi" ${d(0.4)}>OBJECTIVE AREA</text>`),
    plate: () => svg("An approach plate laid onto the map", `<path d="M14,78 L146,20" stroke="rgba(61,224,255,.35)" stroke-width="2"/><g class="po" ${d(0.3)}><rect x="48" y="16" width="64" height="62" rx="3" fill="rgba(234,242,255,.92)" transform="rotate(-8 80 47)"/><g transform="rotate(-8 80 47)"><line x1="56" y1="66" x2="104" y2="28" stroke="#203050" stroke-width="1.6"/><circle cx="80" cy="47" r="10" fill="none" stroke="#203050"/><text x="54" y="26" font-size="6" fill="#203050" font-weight="700">ILS 22</text></g></g>`),
    debrief: () => { const p = "M10,70 C40,60 50,30 80,34 S120,70 150,26"; return svg("The flown track replaying beside the plan", `<path d="M10,70 L80,40 L150,26" fill="none" stroke="${M}" stroke-dasharray="3 3"/><path d="${p}" pathLength="1" fill="none" stroke="${C}" stroke-width="2" class="dr"/>${dot(84, 38, 1.6, A)}${fly(p, 4.4)}<text x="150" y="84" text-anchor="end" font-size="7.5" font-weight="700" fill="${A}" class="fi" ${d(2)}>CLOSEST 0.8 NM</text>`); },
    feedback: () => svg("AeroSignal", `<circle cx="80" cy="42" r="30" fill="none" stroke="${C}" stroke-opacity=".3" class="gl"/><g class="po"><rect x="60" y="22" width="40" height="40" rx="10" fill="#050A14" stroke="${C}" stroke-opacity=".6"/><path d="M68,50 L80,35 L92,50" stroke="${C}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="80" cy="55" r="3" fill="#fff"/></g><text x="80" y="82" text-anchor="middle" font-size="10" font-weight="700" fill="${I}" class="fi" ${d(0.6)}>Aero<tspan fill="${C}">Signal</tspan></text>`),
  };
  function pick(text, hash) {
    const t = text || "";
    if (/That's the tour/i.test(t)) return "feedback";
    if (/GO, CAUTION or NO GO/.test(t)) return "verdict";
    if (/risk score/i.test(t)) return "frat";
    if (/flight restrictions/i.test(t)) return "tfr";
    if (/Runway winds/i.test(t)) return "wind";
    if (/Diversion/i.test(t)) return "divert";
    if (/safe altitude|terrain|altitudes tab/i.test(t)) return "terrain";
    if (/plate/i.test(t)) return "plate";
    if (/objective area/i.test(t)) return "oa";
    if (/navlog|kneeboard|Cockpit view|low level card/i.test(t)) return "navlog";
    if (/debrief|RAT\b|track/i.test(t) && !/payoff/i.test(t)) return "debrief";
    if (/logbook|NVG hours|currency/i.test(t)) return "logbook";
    if (/bottom line up front|Lessons you can act on/i.test(t)) return "bluf";
    if (/phase of flight|Hazards are matched|payoff|accidents from flights/i.test(t)) return "phases";
    if (/plain words|route the way|leg takes|file the route/i.test(t)) return "type";
    if (/^#\/brief/.test(hash) || /\/brief$/.test(hash)) return "bluf";
    return "route";
  }
  function chapter(hash) {
    if (/^#\/(flights|plan)/.test(hash) || /\/plan$/.test(hash)) return "Plan";
    if (/\/debrief$/.test(hash)) return "Debrief";
    if (/^#\/brief/.test(hash) || /\/brief$/.test(hash)) return "Brief";
    if (/^#\/kneeboard/.test(hash)) return "Fly";
    if (/^#\/maps/.test(hash)) return "Maps";
    if (/^#\/logbook/.test(hash)) return "Logbook";
    if (/^#\/safety/.test(hash)) return "Study";
    if (/^#\/missions\/?$/.test(hash)) return "Missions";
    return "";
  }

  let lastText = "", lastChap = "", lastN = "", watching = null, chapTimer = 0;
  function showChap(name) {
    const old = document.getElementById("tutChap"); if (old) old.remove();
    if (!name) return;
    const el = document.createElement("div"); el.id = "tutChap"; el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<div><small>AEROSIGNAL</small><b>${name.toUpperCase()}</b><i></i></div>`;
    document.body.appendChild(el);
    clearTimeout(chapTimer); chapTimer = setTimeout(() => el.remove(), 1300);
  }
  function onScene(bar) {
    const tt = bar.querySelector("#tutT");
    if (!tt) return;
    if (!bar.querySelector(".ta-row")) {
      const row = document.createElement("div"); row.className = "ta-row";
      const art = document.createElement("div"); art.id = "tutArt"; art.setAttribute("aria-hidden", "true");
      tt.before(row); row.appendChild(art); row.appendChild(tt);
    }
    const n = (bar.querySelector("#tutN") || {}).textContent || "";
    if (n) lastN = n;
    const text = tt.textContent.trim();
    if (!text || text === lastText) return;
    lastText = text;
    // The step's page is set right after the caption, so read it a moment later
    setTimeout(() => {
      const hash = location.hash || "";
      const art = document.getElementById("tutArt");
      if (art) { const k = pick(text, hash); art.dataset.k = k; art.innerHTML = ART[k](); }
      const ch = chapter(hash);
      if (ch && ch !== lastChap) { lastChap = ch; showChap(ch); }
    }, 380);
  }
  function finish() {
    if (document.getElementById("tutFin")) return;
    const el = document.createElement("div"); el.id = "tutFin"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Tutorial complete");
    const p = "M20,96 C70,90 90,40 140,46 S220,80 280,30";
    el.innerHTML = `<div class="fc"><svg viewBox="0 0 300 120" aria-hidden="true"><path d="${p}" fill="none" stroke="rgba(61,224,255,.18)" stroke-width="16" stroke-linecap="round"/><path d="${p}" pathLength="1" fill="none" stroke="${C}" stroke-width="3" style="stroke-dasharray:1;stroke-dashoffset:1;animation:taDraw 2s ease forwards"/><g><animateMotion dur="2.6s" fill="freeze" rotate="auto" path="${p}"/><g transform="rotate(90) scale(1.5)">${plane(I)}</g></g></svg>
      <h2>You're ready to brief.</h2><p>Plan your first flight in plain words, and AeroSignal puts the lessons from flights like it in front of you before you go.</p>
      <p class="warn">Never enter CUI or classified information.</p>
      <div class="bt"><button type="button" class="btn" id="tfGo">Plan your first flight</button><button type="button" class="btn sec" id="tfX">Close</button></div></div>`;
    document.body.appendChild(el);
    const close = () => el.remove();
    el.querySelector("#tfGo").onclick = () => { close(); location.hash = "#/plan"; };
    el.querySelector("#tfX").onclick = close;
    el.addEventListener("click", (e) => { if (e.target === el) close(); });
    setTimeout(() => { const b = el.querySelector("#tfGo"); if (b) b.focus(); }, 50);
  }
  // Follow the tutorial bar: new captions mean a new step; the bar leaving after the last step means done
  new MutationObserver(() => {
    const bar = document.getElementById("tutBar");
    if (bar && document.body.classList.contains("tut")) {
      if (watching !== bar) {
        watching = bar; lastText = ""; lastChap = "";
        new MutationObserver(() => onScene(bar)).observe(bar, { childList: true, subtree: true, characterData: true });
      }
      onScene(bar);
    } else if (watching && (!bar || !document.body.classList.contains("tut"))) {
      const m = /^(\d+)\s*\/\s*(\d+)$/.exec(lastN.trim());
      const done = m && m[1] === m[2];
      watching = null; lastText = ""; lastChap = ""; lastN = "";
      const ch = document.getElementById("tutChap"); if (ch) ch.remove();
      if (done) setTimeout(finish, 600);
    }
  }).observe(document.body, { childList: true, attributes: true, attributeFilter: ["class"] });
  window.AeroTutArt = { ART, pick, finish };
})();
