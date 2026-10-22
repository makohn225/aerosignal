"use strict";
/* p87: display themes. The top bar Day button becomes a theme menu with seven looks, saved on this
   device: Signal (the original dark look), Day (the original light mode), Sunlight (Day with higher
   contrast and no glow, for bright cockpits), Sectional (warm chart paper tones), Glass cockpit (black
   with avionics cyan, magenta and green), Tactical (dark olive and dim green) and Night red (the whole
   screen, maps included, in dim red to protect night vision). Light themes build on p21's Day mode;
   dark themes override the CSS color variables. The Display panel on More gets the same choices. */
(function () {
  const KEY = "as_theme";
  const THEMES = [
    { id: "signal", name: "Signal", day: false, note: "The original dark look" },
    { id: "day", name: "Day", day: true, note: "Light background for daylight" },
    { id: "sun", name: "Sunlight", day: true, note: "Highest contrast for a sunny cockpit" },
    { id: "sec", name: "Sectional", day: true, note: "Warm chart paper tones" },
    { id: "glass", name: "Glass cockpit", day: false, note: "Black with avionics colors" },
    { id: "tac", name: "Tactical", day: false, note: "Dark olive and dim green" },
    { id: "red", name: "Night red", day: false, note: "Dim red to protect night vision" },
  ];
  const css = document.createElement("style");
  css.textContent = `
    html.th-sun.day{filter:invert(1) hue-rotate(180deg) contrast(1.25) saturate(1.2)}
    html.th-sun body::before,html.th-sec body::before,html.th-glass body::before,html.th-red body::before{display:none}
    html.th-sun .panel,html.th-sun .card{box-shadow:none!important;border-color:rgba(125,211,252,.45)!important}
    html.th-sec.day{filter:invert(1) hue-rotate(180deg) sepia(.38) saturate(1.15)}
    html.th-glass{--bg:#000;--bg2:#05070a;--glass:rgba(8,10,12,.92);--glass2:rgba(14,17,20,.9);--glass3:rgba(4,6,8,.95);--line:rgba(255,255,255,.16);--line2:rgba(255,255,255,.09);--line-hi:rgba(33,212,253,.5);--ink:#ffffff;--ink2:#b8c2cc;--ink3:#7d8893;--cyan:#21d4fd;--cyan2:#00a8d6;--cyan-soft:rgba(33,212,253,.12);--mag:#ff40ff;--mag2:#d000d0;--mag-soft:rgba(255,64,255,.12);--green:#33ff66;--green-soft:rgba(51,255,102,.1);--amber:#ffd400;--amber-soft:rgba(255,212,0,.12);--glow-c:none;--glow-m:none}
    html.th-glass body{background:#000}
    html.th-tac{--bg:#0a0d08;--bg2:#10140d;--glass:rgba(22,28,18,.86);--glass2:rgba(28,35,23,.78);--glass3:rgba(14,18,11,.9);--line:rgba(163,190,120,.18);--line2:rgba(163,190,120,.1);--line-hi:rgba(163,190,120,.45);--ink:#dfe6d2;--ink2:#a3ad93;--ink3:#76806a;--cyan:#a3d46a;--cyan2:#7fae47;--cyan-soft:rgba(163,212,106,.12);--mag:#d9c26a;--mag2:#b39a3d;--mag-soft:rgba(217,194,106,.13);--blue:#9fc2a0;--green:#8fe07a;--glow-c:none;--glow-m:none}
    html.th-tac body{background:#0a0d08}
    html.th-tac body::before{display:none}
    html.th-tac{filter:hue-rotate(-100deg) saturate(.6) brightness(.95)}
    html.th-tac .leaflet-tile-pane,html.th-tac img,html.th-tac video,html.th-tac canvas,html.th-tac .kbcard{filter:saturate(1.66) hue-rotate(100deg)}
    html.th-red{filter:grayscale(1) sepia(1) saturate(7) hue-rotate(-38deg) brightness(.62) contrast(1.05)}
    html.th-red body{background:#000}
    #thMenu{position:fixed;z-index:10060;min-width:240px;background:var(--glass3,#08101e);border:1px solid var(--line-hi,rgba(125,211,252,.35));border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.5);padding:6px;backdrop-filter:blur(10px)}
    #thMenu button{display:flex;gap:10px;align-items:center;width:100%;text-align:left;background:transparent;border:0;color:var(--ink,#e7f1ff);padding:8px 10px;border-radius:8px;cursor:pointer;font:14px var(--body,system-ui)}
    #thMenu button:hover,#thMenu button[aria-checked=true]{background:var(--cyan-soft,rgba(61,224,255,.12))}
    #thMenu .sw{width:26px;height:18px;border-radius:5px;flex:none;border:1px solid rgba(255,255,255,.25)}
    #thMenu small{display:block;color:var(--ink2,#9db2ce);font-size:11.5px}
    .thgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:6px}
    .thgrid button{display:flex;flex-direction:column;gap:6px;align-items:flex-start;background:transparent;border:1px solid var(--line2);border-radius:10px;padding:8px;color:var(--ink);cursor:pointer;font:13px var(--body,system-ui);text-align:left}
    .thgrid button[aria-pressed=true]{border-color:var(--cyan);box-shadow:0 0 0 1px var(--cyan) inset}
    .thgrid .sw{width:100%;height:26px;border-radius:6px;border:1px solid rgba(255,255,255,.2)}
  `;
  document.head.appendChild(css);
  const SW = {
    signal: "linear-gradient(135deg,#050A14 55%,#3DE0FF 55%,#3DE0FF 75%,#FF4FD8 75%)",
    day: "linear-gradient(135deg,#F4F7FB 55%,#0a7ea4 55%,#0a7ea4 75%,#b0157f 75%)",
    sun: "linear-gradient(135deg,#ffffff 55%,#000 55%,#000 75%,#d10000 75%)",
    sec: "linear-gradient(135deg,#f6ecd6 55%,#2a5d8f 55%,#2a5d8f 75%,#9b2c7a 75%)",
    glass: "linear-gradient(135deg,#000 55%,#21d4fd 55%,#21d4fd 72%,#ff40ff 72%,#ff40ff 86%,#33ff66 86%)",
    tac: "linear-gradient(135deg,#0a0d08 55%,#a3d46a 55%,#a3d46a 75%,#d9c26a 75%)",
    red: "linear-gradient(135deg,#000 55%,#8a1010 55%,#8a1010 75%,#d03030 75%)",
  };
  const get = () => { try { return localStorage.getItem(KEY) || (document.documentElement.classList.contains("day") ? "day" : "signal"); } catch { return "signal"; } };
  let cur = get();

  function setDay(want) {
    const isDay = document.documentElement.classList.contains("day");
    if (isDay === want) return;
    const b = document.getElementById("dayBtn");
    if (b && b._orig) b._orig.call(b);
  }
  function label() {
    const b = document.getElementById("dayBtn");
    const t = THEMES.find((x) => x.id === cur) || THEMES[0];
    const txt = t.name === "Glass cockpit" ? "Glass" : t.name === "Night red" ? "Red" : t.name;
    if (b && b.textContent !== txt) b.textContent = txt;
    if (b) { b.setAttribute("aria-label", `Display theme: ${t.name}. Change theme`); b.title = "Change the display theme"; }
  }
  function apply(id) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    cur = t.id;
    try { localStorage.setItem(KEY, cur); } catch {}
    const r = document.documentElement;
    THEMES.forEach((x) => r.classList.remove("th-" + x.id));
    r.classList.add("th-" + cur);
    setDay(t.day);
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.content = { signal: "#050A14", day: "#F4F7FB", sun: "#ffffff", sec: "#f6ecd6", glass: "#000000", tac: "#0a0d08", red: "#000000" }[cur];
    label();
    document.querySelectorAll(".thgrid button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.th === cur));
  }

  function menu(anchor) {
    let m = document.getElementById("thMenu");
    if (m) { m.remove(); return; }
    m = document.createElement("div");
    m.id = "thMenu"; m.setAttribute("role", "menu");
    m.innerHTML = THEMES.map((t) => `<button type="button" role="menuitemradio" aria-checked="${t.id === cur}" data-th="${t.id}"><span class="sw" style="background:${SW[t.id]}"></span><span>${t.name}<small>${t.note}</small></span></button>`).join("");
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = `${Math.round(r.bottom + 6)}px`;
    m.style.left = `${Math.round(Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.left)))}px`;
    m.onclick = (e) => { const b = e.target.closest("[data-th]"); if (b) { apply(b.dataset.th); m.remove(); } };
    setTimeout(() => document.addEventListener("click", function off(e) { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener("click", off, true); } }, true), 0);
  }

  function hook() {
    const b = document.getElementById("dayBtn");
    if (!b || b._th) return !!b;
    b._th = true;
    b._orig = b.onclick;
    b.onclick = (e) => { e.preventDefault(); menu(b); };
    label();
    return true;
  }
  // The More page Display panel: theme choices under the original Mode switch
  function panel() {
    const s = document.getElementById("dispMore");
    if (!s || s.querySelector(".thgrid")) return;
    const mode = s.querySelector("#dMode");
    if (mode) mode.closest("div").parentElement.style.display = "none";
    const d = document.createElement("div");
    d.innerHTML = `<div class="small muted" style="margin-top:12px">Theme</div><div class="thgrid">${THEMES.map((t) => `<button type="button" data-th="${t.id}" aria-pressed="${t.id === cur}"><span class="sw" style="background:${SW[t.id]}"></span><b>${t.name}</b><span class="small muted">${t.note}</span></button>`).join("")}</div>`;
    d.querySelector(".thgrid").onclick = (e) => { const b = e.target.closest("[data-th]"); if (b) apply(b.dataset.th); };
    const p = s.querySelector("p"); if (p) p.textContent = "Pick a theme for this device. Sunlight is easiest to read in a bright cockpit; Night red keeps your night vision.";
    s.appendChild(d);
    // Keep the text size switch visible
    if (mode) { const ts = s.querySelector("#dText"); if (ts) { const w = document.createElement("div"); w.style.marginTop = "12px"; w.innerHTML = `<div class="small muted" style="margin-bottom:4px">Text size</div>`; w.appendChild(ts); s.appendChild(w); } }
  }

  let tries = 0;
  (function wait() { if (!hook() && ++tries < 40) setTimeout(wait, 250); else apply(cur); })();
  new MutationObserver(() => { hook(); panel(); const b = document.getElementById("dayBtn"); if (b && b._th) label(); }).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.AeroTheme = { apply, list: THEMES.map((t) => t.id), current: () => cur };
})();
