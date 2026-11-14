"use strict";
/* p263: your flying, and pins for the Quick brief (November 14, 2026).
   1. "What do you fly most?" (VFR cross country, IFR, mountain or backcountry, night, helicopter, sport pilot) sits
      with the mode switch in More, Your flying, and is offered once on the Quick brief. It only sets starting
      points: which sections are pinned to the Quick brief (here), which Fly screen readouts show (p264) and which
      map layers start on (p266). The mode (Pilot, Flight School, Military Planning, p153) adds its own: a student
      gets the checklist, personal minimums and weight and balance; military gets the military mishap narratives.
      Sport pilot also turns on the sport pilot check (p252).
   2. Every brief section gets a Pin switch. A pinned section shows in the Quick brief (folded to its one line
      summary, one tap to open). A pin the pilot sets always wins over the starting points.
   Saved in S.flyProfile and S.qkPins with the rest of the pilot's data on this device (and in sync, p74). */
(function () {
  const TAGS = [["vfr", "VFR cross country"], ["ifr", "IFR"], ["mountain", "Mountain or backcountry"], ["night", "Night"], ["helo", "Helicopter"], ["sport", "Sport pilot"]];
  const PIN_BY = {
    ifr: ["wtgPanel", "gpPanel", "advPanel", "waPanel"], mountain: ["rpPanel", "dvPanel", "pfPanel", "waPanel"], night: ["dayPanel"],
    helo: ["wcPanel", "advPanel"], sport: ["spPanel"], vfr: ["tfrPanel", "asPanel"], school: ["goPanel", "pmPanel", "wbPanel"], mil: ["mnPanel"],
  };
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const prof = () => { try { return S.flyProfile || {}; } catch (e) { return {}; } };
  const tags = () => (prof().tags || []).slice();
  function modeKind() { try { return window.AeroMode && AeroMode.get ? AeroMode.get() : S.role === "military" || S.role === "both" ? "mil" : S.modeKind === "pilot" ? "pilot" : S.role === "civil" ? "school" : null; } catch (e) { return null; } }
  const keys = () => { const k = tags(); const m = modeKind(); if (m === "school" || m === "mil") k.push(m); return k; };
  const defaultPins = () => [...new Set(keys().flatMap((k) => PIN_BY[k] || []))];
  function pinned(id) { try { const p = S.qkPins || {}; if (id in p) return !!p[id]; } catch (e) {} return defaultPins().includes(id); }
  function setPin(id, on) { try { S.qkPins = S.qkPins || {}; S.qkPins[id] = !!on; save(); } catch (e) {} }
  function setTags(list) {
    try {
      S.flyProfile = { tags: list, set: Date.now() };
      if (list.includes("sport")) { S.sport = S.sport || {}; S.sport.on = true; }
      save();
    } catch (e) {}
    document.dispatchEvent(new CustomEvent("vg-flyprofile"));
  }

  const st = document.createElement("style");
  st.textContent = `
    .pnl-h .qk-pin{margin-left:auto;flex:none;appearance:none;border:1px solid var(--line2,rgba(255,255,255,.16));background:transparent;color:var(--ink2,#9fb0c8);border-radius:999px;width:30px;height:26px;padding:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
    .pnl-h .qk-pin svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round}
    .pnl-h .qk-pin[aria-pressed="true"] svg{fill:currentColor}
    .pnl-h .qk-pin[aria-pressed="true"]{color:#06121F;background:var(--accent,#3DE0FF);border-color:var(--accent,#3DE0FF)}
    .pnl-h .qk-pin + .pnl-tg{margin-left:6px}
    body.tut .qk-pin{display:none}
    .fp-chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
    .fp-chips button{appearance:none;border:1px solid var(--line2,rgba(255,255,255,.2));background:transparent;color:inherit;border-radius:999px;padding:8px 14px;font:600 14px var(--body,system-ui);cursor:pointer;min-height:40px}
    .fp-chips button[aria-pressed="true"]{background:var(--accent,#3DE0FF);color:#06121F;border-color:var(--accent,#3DE0FF)}
    #fpAsk .fp-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}`;
  document.head.appendChild(st);

  function chips(sel) { return `<div class="fp-chips" role="group" aria-label="What you fly">${TAGS.map(([k, l]) => `<button type="button" data-t="${k}" aria-pressed="${sel.includes(k)}">${h(l)}</button>`).join("")}</div>`; }
  function wire(box, onSave) {
    box.querySelectorAll(".fp-chips button").forEach((b) => b.onclick = () => { b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); if (!onSave) save2(); });
    const save2 = () => setTags([...box.querySelectorAll('.fp-chips button[aria-pressed="true"]')].map((b) => b.dataset.t));
    return save2;
  }

  /* Brief: pins, and the one time question */
  function brief() {
    if (!/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const pg = document.querySelector("#view .page"); if (!pg) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!f || f.missionId) return;
    for (const sec of pg.querySelectorAll(":scope > section.panel")) {
      if (!sec.id || /^(qkFlags|bbody|bfBluf|dpPanel|scShare|rvMine|fpAsk)$/.test(sec.id)) continue;
      const h2 = sec.querySelector(":scope > h2"), tg = h2 && h2.querySelector(":scope > .pnl-tg");
      if (!tg) continue;
      let b = h2.querySelector(":scope > .qk-pin");
      if (!b) {
        b = document.createElement("button"); b.type = "button"; b.className = "qk-pin";
        b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setPin(sec.id, !pinned(sec.id)); paintPins(pg); if (window.AeroQuickBrief && AeroQuickBrief.refresh) AeroQuickBrief.refresh(); };
        tg.before(b);
      }
    }
    paintPins(pg);
    ask(pg);
  }
  function paintPins(pg) {
    for (const b of pg.querySelectorAll(":scope > section.panel > h2 > .qk-pin")) {
      const sec = b.closest("section"), on = pinned(sec.id);
      if (b.getAttribute("aria-pressed") !== String(on)) b.setAttribute("aria-pressed", String(on));
      const t = on ? "Pinned to the Quick brief. Tap to unpin." : "Pin to the Quick brief";
      if (b.title !== t) { b.title = t; b.setAttribute("aria-label", t); }
      if (!b.firstChild) b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4z"/><path d="M12 13v8"/></svg>';
      sec.classList.toggle("qk-pin-on", on);
    }
  }
  function ask(pg) {
    const p = prof();
    let box = pg.querySelector(":scope > #fpAsk");
    if (p.set || p.later) { if (box) box.remove(); return; }
    if (box || !pg.classList.contains("qk")) return;
    const anchor = pg.querySelector(":scope > #qkFlags"); if (!anchor) return;
    box = document.createElement("section"); box.className = "panel"; box.id = "fpAsk";
    box.innerHTML = `<div><h2>Make the Quick brief yours</h2><p class="small" style="margin:0">What do you fly most? Pick any that fit. This chooses which sections show here, the Fly screen readouts and the map layers you start with. You can pin or change anything later.</p>${chips(tags())}<div class="fp-row"><button type="button" class="btn sm fp-save">Save</button><button type="button" class="btn sec sm fp-later">Not now</button></div></div>`;
    const save2 = wire(box, true);
    box.querySelector(".fp-save").onclick = () => { save2(); box.remove(); toast("Saved. Change it any time in More, Your flying."); brief(); if (window.AeroQuickBrief && AeroQuickBrief.refresh) AeroQuickBrief.refresh(); };
    box.querySelector(".fp-later").onclick = () => { try { S.flyProfile = Object.assign({}, prof(), { later: Date.now() }); save(); } catch (e) {} box.remove(); };
    anchor.after(box);
  }

  /* More: Your flying */
  function more() {
    if (!/^#\/more(\/|$|\?)/.test(location.hash || "")) return;
    const pg = document.querySelector("#view .page"); if (!pg) return;
    const role = pg.querySelector("#roleMore"); if (!role) return;
    let box = pg.querySelector("#fpMore");
    if (!box) { box = document.createElement("section"); box.className = "panel"; box.id = "fpMore"; role.after(box); box.dataset.v = ""; }
    const v = tags().join(",");
    if (box.dataset.v === v && box.innerHTML) return;
    box.dataset.v = v;
    box.innerHTML = `<h2>What you fly most</h2><p class="small" style="margin:0">Starting points for the Quick brief, the Fly screen readouts and the map layers. Pins and choices you make yourself always win.</p>${chips(tags())}`;
    wire(box, false);
  }

  let t = 0;
  const run = () => { clearTimeout(t); t = setTimeout(() => { try { brief(); more(); } catch (e) { console.error(e); } }, 300); };
  new MutationObserver((l) => { if (l.every((m) => m.target.closest && m.target.closest(".qk-pin,#fpAsk,#fpMore"))) return; run(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", run);
  document.addEventListener("vg-flyprofile", run);
  run();
  window.AeroFlyProfile = { tags, keys, modeKind, pinned, setPin, defaultPins, setTags, TAGS };
})();
