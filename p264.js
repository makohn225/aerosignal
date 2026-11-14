"use strict";
/* p264: the Fly screen shows what you choose (November 14, 2026). The Fly screen had grown to six cards above
   nine readouts and the nearest airports list. Now the pilot picks up to four cards (decision points, descent,
   lightning, density altitude, track recording, saved for offline) and which readouts show, in the order they
   want, under Customize. Everything else is one tap away under "More readouts". Anything that needs attention
   always shows whatever was chosen: a card or readout in its caution or warning state (a decision point now,
   lightning within 20 nm, a high descent rate needed, density altitude over 8,000 ft, terrain ahead) appears
   even if it was turned off. Starting choices come from What you fly most (p263). Saved in S.flyLayout. */
(function () {
  const CARDS = { dpFly: "Decision points", tdFly: "Descent", ltFly: "Lightning", daFly: "Density altitude", recFly: "Track recording", ofFly: "Saved for offline" };
  const TILES = ["Groundspeed", "GPS altitude", "Next", "Destination", "Fuel now (estimate)", "Terrain ahead", "Nearest airports", "Track", "Fuel at destination", "Flight time"];
  const MAXC = 4;
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const keys = () => { try { return window.AeroFlyProfile ? AeroFlyProfile.keys() : []; } catch (e) { return []; } };
  function defaults() {
    const k = keys();
    const cards = k.includes("mountain") ? ["dpFly", "daFly", "tdFly", "ltFly"] : k.includes("helo") ? ["dpFly", "ltFly", "daFly", "recFly"] : ["dpFly", "tdFly", "ltFly", "recFly"];
    const tiles = ["Groundspeed", "GPS altitude", "Next", "Destination", "Fuel now (estimate)", "Terrain ahead", "Nearest airports"];
    if (k.includes("ifr")) tiles.splice(2, 0, "Track");
    return { cards, tiles };
  }
  function layout() { let l = null; try { l = S.flyLayout; } catch (e) {} const d = defaults(); return { cards: (l && l.cards) || d.cards, tiles: (l && l.tiles) || d.tiles, own: !!l }; }
  function saveLayout(l) { try { S.flyLayout = { cards: l.cards, tiles: l.tiles }; save(); } catch (e) {} }
  const tileKey = (t) => { const s = t.querySelector("small, h2"); return s ? s.textContent.split(":")[0].trim() : ""; };
  const urgent = (el) => el.classList.contains("now") || el.classList.contains("warn") || el.classList.contains("bad");

  const st = document.createElement("style");
  st.textContent = `
    #flCards{display:flex;flex-direction:column}
    .page.fly:not(.fly-all) .fl-x{display:none !important}
    #flMore{margin:4px 0 10px}
    #flCust{border:1px solid var(--line2,rgba(255,255,255,.16));border-radius:14px;padding:12px 14px;margin:10px 0}
    #flCust h2{font-size:16px;margin:0 0 4px}
    #flCust ul{list-style:none;margin:6px 0 12px;padding:0}
    #flCust li{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line,rgba(255,255,255,.08))}
    #flCust li:first-child{border-top:0}
    #flCust li label{flex:1;display:flex;align-items:center;gap:10px;min-height:36px;cursor:pointer}
    #flCust li input{width:20px;height:20px}
    #flCust li button{appearance:none;border:1px solid var(--line2,rgba(255,255,255,.2));background:transparent;color:inherit;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px}
    #flCust li button:disabled{opacity:.3}`;
  document.head.appendChild(st);

  function apply() {
    if (!/^#\/fly(\/|$|\?)/.test(location.hash || "")) return;
    const pg = document.querySelector("#view .page.fly"); if (!pg) return;
    const l = layout();
    // Cards: gather into one column in the chosen order
    let box = pg.querySelector(":scope > #flCards");
    const h1 = pg.querySelector(":scope > h1");
    if (!box && h1) { box = document.createElement("div"); box.id = "flCards"; h1.after(box); }
    if (box) {
      for (const id of Object.keys(CARDS)) {
        const el = pg.querySelector(`#${id}`); if (!el) continue;
        if (el.parentElement !== box) box.appendChild(el);
        const i = l.cards.indexOf(id);
        const o = String(i >= 0 ? i : 20); if (el.style.order !== o) el.style.order = o;
        const hide = i < 0 && !urgent(el);
        if (el.classList.contains("fl-x") !== hide) el.classList.toggle("fl-x", hide);
      }
    }
    // Readouts
    const out = pg.querySelector("#flOut");
    let hidden = 0;
    if (out) {
      const grid = out.querySelector(".fl-grid");
      if (grid) for (const t of grid.querySelectorAll(":scope > .fl-t")) {
        const k = tileKey(t), i = l.tiles.indexOf(k);
        const o = String(i >= 0 ? i : 50); if (t.style.order !== o) t.style.order = o;
        const hide = i < 0 && !urgent(t);
        if (t.classList.contains("fl-x") !== hide) t.classList.toggle("fl-x", hide);
        if (hide) hidden++;
      }
      const near = out.querySelector(".fl-near");
      if (near) { const hide = !l.tiles.includes("Nearest airports"); if (near.classList.contains("fl-x") !== hide) near.classList.toggle("fl-x", hide); if (hide) hidden++; }
    }
    if (box) hidden += box.querySelectorAll(":scope > .fl-x").length;
    // More readouts switch and Customize
    let more = pg.querySelector("#flMore");
    if (out && !more) {
      more = document.createElement("div"); more.id = "flMore";
      more.innerHTML = `<button type="button" class="btn sec sm fm-all"></button> <button type="button" class="btn sec sm fm-cust">Customize</button>`;
      more.querySelector(".fm-all").onclick = () => { pg.classList.toggle("fly-all"); apply(); };
      more.querySelector(".fm-cust").onclick = () => custom(pg);
      out.after(more);
    }
    if (more) {
      const b = more.querySelector(".fm-all"), all = pg.classList.contains("fly-all");
      const t = all ? "Show my readouts only" : hidden ? `More readouts (${hidden})` : "More readouts";
      if (b.textContent !== t) b.textContent = t;
      b.hidden = !hidden && !all;
    }
  }

  function custom(pg) {
    let c = pg.querySelector("#flCust");
    if (c) { c.remove(); return; }
    const l = layout();
    const cards = [...l.cards, ...Object.keys(CARDS).filter((k) => !l.cards.includes(k))];
    const tiles = [...l.tiles, ...TILES.filter((k) => !l.tiles.includes(k))];
    c = document.createElement("section"); c.id = "flCust";
    const list = (items, on, label, kind) => `<ul data-kind="${kind}">${items.map((k) => `<li data-k="${h(k)}"><label><input type="checkbox" ${on.includes(k) ? "checked" : ""}>${h(label(k))}</label><button type="button" data-mv="-1" aria-label="Move up">&#8593;</button><button type="button" data-mv="1" aria-label="Move down">&#8595;</button></li>`).join("")}</ul>`;
    c.innerHTML = `<h2>Cards at the top</h2><p class="small muted" style="margin:0">Pick up to ${MAXC}. A card that needs attention still shows if it is off.</p>${list(cards, l.cards, (k) => CARDS[k], "cards")}
      <h2>Readouts</h2><p class="small muted" style="margin:0">The rest stay under More readouts. A readout in caution or warning still shows.</p>${list(tiles, l.tiles, (k) => k, "tiles")}
      <div class="row" style="gap:8px"><button type="button" class="btn sm fc-done">Done</button><button type="button" class="btn sec sm fc-reset">Use my starting choices</button></div>`;
    const read = () => ({ cards: [...c.querySelectorAll('ul[data-kind="cards"] li')].filter((li) => li.querySelector("input").checked).map((li) => li.dataset.k), tiles: [...c.querySelectorAll('ul[data-kind="tiles"] li')].filter((li) => li.querySelector("input").checked).map((li) => li.dataset.k) });
    const limit = () => { const ul = c.querySelector('ul[data-kind="cards"]'); const n = ul.querySelectorAll("input:checked").length; ul.querySelectorAll("input").forEach((i) => { i.disabled = !i.checked && n >= MAXC; }); };
    const commit = () => { saveLayout(read()); apply(); };
    c.querySelectorAll("input").forEach((i) => i.onchange = () => { limit(); commit(); });
    c.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => { const li = b.closest("li"), d = +b.dataset.mv; const sib = d < 0 ? li.previousElementSibling : li.nextElementSibling; if (sib) { d < 0 ? sib.before(li) : sib.after(li); commit(); } });
    c.querySelector(".fc-done").onclick = () => c.remove();
    c.querySelector(".fc-reset").onclick = () => { try { delete S.flyLayout; save(); } catch (e) {} c.remove(); apply(); custom(pg); };
    limit();
    (pg.querySelector("#flMore") || pg.querySelector("#flOut")).after(c);
  }

  let t = 0;
  new MutationObserver((list) => {
    if (!/^#\/fly(\/|$|\?)/.test(location.hash || "")) return;
    if (list.every((m) => m.target.closest && m.target.closest("#flCust,#flMore"))) return;
    clearTimeout(t); t = setTimeout(apply, 30);
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("hashchange", () => setTimeout(apply, 50));
  document.addEventListener("vg-flyprofile", apply);
  window.AeroFlyLayout = { layout, defaults, apply, CARDS, TILES };
})();
