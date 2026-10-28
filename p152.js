"use strict";
/* p152: Go to an airport (October 28, 2026). Built in this chat after the regular chat's p140 version
   could not be recovered; p140 stays unused.
   1. A Go to button in the top bar, and the keys / or Ctrl K (Cmd K on a Mac), open a search box. Type
      an identifier, name or city; the arrow keys and Enter pick a result.
   2. Each result offers Airport page (#/airports/<id>: weather, runways, charts and NOTAMs, accident
      history) and Show on map (opens Maps centered on the field with a marker).
   3. The map Tools menu has Go to an airport too.
   4. Wide screens get Airports in the side menu. Phones keep the five item bottom bar; Go to in the
      top bar covers it there.
   Search uses the existing search_airports lookup. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #gtBtn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line2,rgba(255,255,255,.18));background:transparent;color:var(--ink,#EAF2FF);font:600 13px var(--sans,system-ui);cursor:pointer;flex:0 0 auto}
    #gtBtn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}
    #gtBtn kbd{font:600 11px var(--mono,monospace);color:var(--ink2,#9db2ce);border:1px solid var(--line2,rgba(255,255,255,.18));border-radius:5px;padding:0 5px}
    @media (max-width:700px){#gtBtn span,#gtBtn kbd{display:none}#gtBtn{width:40px;height:40px;padding:0;justify-content:center}}
    #gtBg{position:fixed;inset:0;z-index:5000;background:rgba(2,6,12,.72);display:flex;align-items:flex-start;justify-content:center;padding:max(10vh,60px) 12px 12px}
    #gtBox{width:min(560px,100%);background:var(--bg2,#0b1626);border:1px solid var(--line2,rgba(255,255,255,.15));border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.6);overflow:hidden}
    #gtBox input{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--line2,rgba(255,255,255,.12));background:transparent;color:var(--ink,#EAF2FF);font:500 18px var(--sans,system-ui);padding:16px 18px;outline:none;border-radius:0}
    #gtBox ul{list-style:none;margin:0;padding:6px;max-height:min(60vh,420px);overflow:auto}
    #gtBox li{display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:10px}
    #gtBox li.on{background:rgba(61,224,255,.10)}
    #gtBox li .id{font:700 15px var(--mono,monospace);color:var(--cyan,#3DE0FF);min-width:52px}
    #gtBox li .nm{flex:1;min-width:0;font-size:14px;line-height:1.35}
    #gtBox li .nm small{display:block;color:var(--ink2,#9db2ce)}
    #gtBox li button{min-height:36px;padding:0 10px;border-radius:8px;border:1px solid var(--line2,rgba(255,255,255,.25));background:transparent;color:var(--ink,#EAF2FF);font-size:12.5px;cursor:pointer;white-space:nowrap}
    #gtBox li button.map{border-color:var(--cyan,#3DE0FF);color:var(--cyan,#3DE0FF);font-weight:700}
    #gtBox .gt-st{padding:12px 18px;color:var(--ink2,#9db2ce);font-size:13.5px}
    #gtBox .gt-ft{padding:8px 18px 12px;color:var(--ink2,#9db2ce);font-size:12px;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    @media (max-width:520px){#gtBox li{flex-wrap:wrap}#gtBox li .nm{flex-basis:60%}}
    @media (pointer:coarse){#gtBox .gt-ft{display:none}}
    .tabs a[data-tab="airports"]{display:none}
    @media (min-width:901px){.tabs a[data-tab="airports"]{display:flex}}
  `;
  document.head.appendChild(css);

  let box = null, sel = 0, rows = [], timer = 0, seq = 0;
  function close() { if (box) { box.remove(); box = null; } }
  function render(status) {
    const ul = box.querySelector("ul"), st = box.querySelector(".gt-st");
    st.textContent = status || ""; st.hidden = !status;
    ul.innerHTML = rows.map((r, i) => `<li data-i="${i}" class="${i === sel ? "on" : ""}"><span class="id">${h(r.ident)}</span><span class="nm">${h(r.name)}<small>${h([r.municipality, String(r.iso_region || "").replace(/^US-/, "")].filter(Boolean).join(", "))}</small></span><button type="button" class="map" data-a="map">Show on map</button><button type="button" data-a="page">Airport page</button></li>`).join("");
    ul.querySelectorAll("li").forEach((li) => {
      li.onmouseenter = () => { sel = +li.dataset.i; ul.querySelectorAll("li").forEach((x) => x.classList.toggle("on", x === li)); };
      li.querySelectorAll("button").forEach((b) => (b.onclick = () => pick(rows[+li.dataset.i], b.dataset.a)));
    });
  }
  async function search(q) {
    const my = ++seq;
    if (q.length < 2) { rows = []; render(q ? "Keep typing" : "Type an airport identifier, name or city"); return; }
    render("Searching…");
    try {
      const r = await rpc("search_airports", { q, lim: 8 });
      if (my !== seq || !box) return;
      rows = r || []; sel = 0;
      render(rows.length ? "" : `No airport matches ${q}`);
    } catch { if (my === seq && box) { rows = []; render("Airport search is not available right now. Check your connection."); } }
  }
  function pick(r, how) {
    if (!r) return;
    close();
    if (how === "page") { location.hash = `#/airports/${encodeURIComponent(r.ident)}`; return; }
    showOnMap(r);
  }
  function showOnMap(r) {
    const go2 = () => {
      let m = null; try { m = leafletMap; } catch {}
      if (!m || !isFinite(r.lat)) return false;
      m.setView([r.lat, r.lon], Math.max(m.getZoom(), 11));
      try {
        if (window.__gtMk) window.__gtMk.remove();
        window.__gtMk = L.circleMarker([r.lat, r.lon], { radius: 10, color: "#3DE0FF", weight: 3, fillOpacity: 0.15 }).addTo(m).bindTooltip(`${r.ident} ${r.name}`, { permanent: true, direction: "top", offset: [0, -10] });
      } catch {}
      return true;
    };
    if (/^#\/maps/.test(location.hash || "") && go2()) return;
    location.hash = "#/maps";
    let n = 0;
    const t = setInterval(() => { if (go2() || ++n > 40) clearInterval(t); }, 150);
  }
  function open(prefill) {
    if (box) { box.querySelector("input").focus(); return; }
    box = document.createElement("div"); box.id = "gtBg";
    box.innerHTML = `<div id="gtBox" role="dialog" aria-label="Go to an airport"><input type="search" placeholder="Go to an airport: KJYO, Leesburg, Richmond" aria-label="Airport identifier, name or city" autocomplete="off" autocapitalize="characters" spellcheck="false"><div class="gt-st"></div><ul></ul><div class="gt-ft">Enter shows it on the map. Shift Enter opens the airport page. Esc closes.</div></div>`;
    document.body.appendChild(box);
    const inp = box.querySelector("input");
    box.addEventListener("mousedown", (e) => { if (e.target === box) close(); });
    inp.oninput = () => { clearTimeout(timer); timer = setTimeout(() => search(inp.value.trim()), 200); };
    inp.onkeydown = (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); if (rows.length) { sel = (sel + 1) % rows.length; render(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (rows.length) { sel = (sel - 1 + rows.length) % rows.length; render(); } }
      else if (e.key === "Enter") { e.preventDefault(); if (rows[sel]) pick(rows[sel], e.shiftKey ? "page" : "map"); else search(inp.value.trim()); }
    };
    rows = []; sel = 0; render("Type an airport identifier, name or city");
    if (prefill) { inp.value = prefill; search(prefill); }
    setTimeout(() => inp.focus(), 0);
  }

  // Keyboard: / or Ctrl K / Cmd K, but not while typing in a field
  document.addEventListener("keydown", (e) => {
    const typing = e.target && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
    if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); open(); }
    else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
  });

  function mount() {
    const chip = document.getElementById("flightChip");
    if (chip && !document.getElementById("gtBtn")) {
      const b = document.createElement("button"); b.id = "gtBtn"; b.type = "button"; b.title = "Go to an airport (/ or Ctrl K)"; b.setAttribute("aria-label", "Go to an airport");
      b.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span>Go to</span><kbd>/</kbd>`;
      b.onclick = () => open();
      chip.before(b);
    }
    const tabs = document.querySelector(".tabs"), more = tabs && tabs.querySelector('a[data-tab="more"]');
    if (more && !tabs.querySelector('a[data-tab="airports"]')) {
      const a = document.createElement("a"); a.href = "#/airports"; a.dataset.tab = "airports";
      a.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2v20 M4 13l8-3 8 3 M8 20l4-2 4 2"/></svg><span>Airports</span>`;
      more.before(a);
      if (/^#\/airports/.test(location.hash || "")) a.classList.add("on");
    }
  }
  mount();
  new MutationObserver(() => { if (!document.getElementById("gtBtn") || !document.querySelector('.tabs a[data-tab="airports"]')) mount(); }).observe(document.body, { childList: true, subtree: false });
  window.addEventListener("hashchange", () => { const a = document.querySelector('.tabs a[data-tab="airports"]'); if (a) a.classList.toggle("on", /^#\/airports/.test(location.hash || "")); });
  // Map Tools menu item (p123 hook, chained)
  const prev = window.AeroMapTools;
  window.AeroMapTools = {
    items(map) { return [...(prev ? prev.items(map) : []), ["goto", "Go to an airport", "Search and center the map on a field"]]; },
    run(t, map) { if (t === "goto") open(); else if (prev) prev.run(t, map); },
  };
  window.AeroGoTo = { open, showOnMap };
})();
