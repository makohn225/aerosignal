"use strict";
/* p135: launch polish from a first run audit as a new civil pilot (October 22, 2026).
   1. "Read and brief" opens the brief. The plan builder now ends on #/plan/done, so p109 never saw a
      brief link and the pilot was left on the summary page.
   2. An aircraft type named in the plan ("in my 172", "a Cherokee", "SR22") becomes the flight's
      aircraft when the pilot has none set, using the same profile shape as Add aircraft (p73).
   3. The bottom line never calls a line "all clear" while it is still loading, could not load or needs
      setting up. NOTAMs and hazard advisories that could not load count toward CAUTION, the same way
      missing weather does. The accident lessons say plainly when they could not load and offer Try
      again, instead of "Reading..." next to a technical error.
   4. Civil pilots no longer see military examples, training route hints or the mission choice on the
      Plan page, and the duplicate "New to AeroSignal?" line hides while the welcome card is shown.
   5. Small screens: the display theme button shows an icon instead of the word Signal, so the header
      fits on a phone.
   6. Wording (departure windows that cross midnight now name both days, in p77): the brief says "Fri, Oct 23 at
      09:30" instead of 2026-10-23 09:30, round trips read "KJYO to KOKV and back", "Enter this
      aircraft's numbers" is no longer capitalized mid sentence, and the Account and Logbook page
      introductions match what the app does today (sync, alerts and flight schools). */
(function () {
  const on = (re) => re.test(location.hash || "");
  const css = document.createElement("style");
  css.textContent = `
    body.role-civil .qp .qex button[data-i="2"],body.role-civil .mtr-hint,body.role-civil .lp-mil{display:none!important}
    .lp-hide{display:none!important}
    @media (max-width:480px){
      #dayBtn{font-size:0!important;min-width:38px;padding-left:0!important;padding-right:0!important;justify-content:center}
      #dayBtn > *{font-size:0!important}
      #dayBtn::before{content:"\\25D0";font-size:18px;line-height:1}
    }
    .lp-retry{margin-left:6px}
  `;
  document.head.appendChild(css);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function textNodes(root, fn) {
    if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const list = []; for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
    for (const n of list) { const v = fn(n.nodeValue, n); if (v != null && v !== n.nodeValue) n.nodeValue = v; }
  }

  /* 1. Read and brief */
  let armed = 0;
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("button");
    if (!b) return;
    if (b.id === "qOne") armed = Date.now();
    else if (b.id === "qGo" && e.isTrusted) armed = 0; // p109 clicks Read my plan itself
  }, true);
  function afterBuild() {
    if (!armed || Date.now() - armed > 15 * 60e3) return false;
    if (!on(/^#\/plan\/done/)) return false;
    armed = 0;
    location.replace("#/brief");
    return true;
  }

  /* 2. Aircraft from the plan words */
  const TYPES = [
    [/\b(?:cessna\s*|c-?|(?:my|a|an|the|our|in|club|school)\s+)152\b/i, "C152", "Cessna 152", 95],
    [/\b(?:cessna\s*|c-?|(?:my|a|an|the|our|in|club|school)\s+)172\b|\bskyhawk\b/i, "C172", "Cessna 172", 115],
    [/\b(?:cessna\s*|c-?|(?:my|a|an|the|our|in|club|school)\s+)182\b|\bskylane\b/i, "C182", "Cessna 182", 135],
    [/\b(?:cessna\s*|c-?|(?:my|a|an|the|our|in|club|school)\s+)206\b|\bstationair\b/i, "C206", "Cessna 206", 140],
    [/\b(?:cessna\s*|c-?|(?:my|a|an|the|our|in|club|school)\s+)210\b|\bcenturion\b/i, "C210", "Cessna 210", 165],
    [/\barrow\b|\bpa-?28r\b|\bp28r\b/i, "P28R", "Piper Arrow", 135],
    [/\bcherokee\b|\bwarrior\b|\barcher\b|\bpa-?28\b|\bp28a\b/i, "P28A", "Piper Cherokee, Warrior, Archer", 120],
    [/\bsaratoga\b|\blance\b|\bpa-?32\b/i, "PA32", "Piper Saratoga, Lance", 150],
    [/\bsr-?20\b/i, "SR20", "Cirrus SR20", 150],
    [/\bsr-?22t?\b|\bcirrus\b/i, "SR22", "Cirrus SR22", 175],
    [/\bda-?40\b/i, "DA40", "Diamond DA40", 130],
    [/\bda-?42\b/i, "DA42", "Diamond DA42", 160],
    [/\bmooney\b|\bm-?20[a-z]?\b/i, "M20P", "Mooney M20", 145],
    [/\bbonanza\b|\ba36\b/i, "BE36", "Beechcraft Bonanza A36", 165],
    [/\bbaron\b/i, "BE58", "Beechcraft Baron 58", 195],
    [/\bpc-?12\b/i, "PC12", "Pilatus PC 12", 270],
  ];
  const done = new Map();
  function aircraftFromPlan() {
    let f = null; try { f = currentFlight(); } catch {}
    if (!f || f.demo || f.missionId || !f.planText) return;
    // The plan builder can save its own copy of the flight after this runs, so remember the result
    // per flight and words, and put it back if the tail comes back empty (never over a pilot's choice)
    const key = f.id + "|" + f.planText;
    if (done.has(key)) { const t = done.get(key); if (t && !f.tail) { f.tail = t; try { save(); updateChip(); } catch {} if (on(/^#\/brief/)) setTimeout(() => { try { go(); } catch {} }, 0); } return; }
    done.set(key, null);
    const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Ignore the route itself so identifiers and airways are not read as a type
    const words = String(f.planText).replace(/\b[KP][A-Z0-9]{3}\b|\b[VJTQ]\d{1,3}\b/g, " ");
    const hit = TYPES.find(([re]) => re.test(words));
    if (!hit) { try { save(); } catch {} return; }
    const [, code, name, tas] = hit;
    // A new flight starts with the pilot's first aircraft; the words win when they name another type
    let cur = null; try { cur = f.tail ? allAircraft()[f.tail] : null; } catch {}
    if (cur && norm(cur.typeCode) === norm(code)) { try { save(); } catch {} return; }
    S.profiles = S.profiles || {};
    let tail = null;
    try { const all = allAircraft(); tail = Object.keys(all).find((k) => norm(all[k].typeCode) === norm(code)) || null; } catch {}
    if (!tail) { tail = code; S.profiles[tail] = { typeCode: code, model: name, tas: f.gs || tas }; }
    f.tail = tail; f.updated = Date.now(); done.set(key, tail);
    try { save(); } catch {}
    try { if (typeof updateChip === "function") updateChip(); } catch {}
    try { toast(`Using a ${name} for this flight. Add the tail number and its numbers on the Flights page.`); } catch {}
    // The brief was drawn for the old aircraft; draw it again
    if (on(/^#\/brief/)) setTimeout(() => { try { go(); } catch {} }, 0);
  }

  /* 3. Honest bottom line */
  const FOLD = ["bf-rw", "bf-vn", "bf-dv", "bf-adv", "bf-as", "bf-nt", "bf-pf", "bf-wa", "bf-wbf", "bf-lc"];
  const PENDING = /\bloading\b|set up|not loaded|unavailable|could not|try again|no data|not reach/i;
  function bottomLine() {
    const card = document.querySelector("#view .page #bfBluf");
    if (!card) return;
    // NOTAM line stuck on "loading" after the NOTAM panel failed
    const nt = card.querySelector(":scope > .bf-nt"), ntp = document.getElementById("ntPanel");
    if (nt && ntp && /could not reach|could not load|did not respond/i.test(ntp.textContent) && !nt.querySelector(".lp-nt")) {
      nt.innerHTML = `NOTAMs: <span class="warn lp-nt">could not load</span>. Check NOTAMs with Flight Service before you fly.`;
    }
    const adv = card.querySelector(":scope > .bf-adv");
    if (adv && /could not load/i.test(adv.textContent) && !adv.querySelector(".lp-warn")) {
      const s = document.createElement("span"); s.className = "warn lp-warn"; s.hidden = true; adv.appendChild(s);
    }
    for (const el of card.children) {
      if (!FOLD.some((c) => el.classList.contains(c))) continue;
      const pending = PENDING.test(el.textContent);
      const m = el.querySelector(":scope > .lp-hold");
      if (pending && !m) { const s = document.createElement("span"); s.className = "lp-hold"; s.hidden = true; s.style.color = "#ffb648"; el.appendChild(s); }
      else if (!pending && m) m.remove();
    }
    // Accident lessons that could not load
    const body = document.getElementById("bbody");
    const err = body && [...body.querySelectorAll(".note")].find((n) => /accident database did not respond/i.test(n.textContent) && !n.dataset.lp);
    if (err) {
      err.dataset.lp = "1";
      err.innerHTML = `Accident lessons could not load. Check your connection, then <button type="button" class="btn sec sm lp-retry">Try again</button>`;
      err.querySelector("button").onclick = () => { try { go(); } catch { location.reload(); } };
    }
    if (body && body.querySelector('.note[data-lp="1"]')) {
      for (const p of card.querySelectorAll("p.ok")) if (/Reading the accident record/i.test(p.textContent)) p.textContent = "Accident lessons could not load right now.";
    }
  }

  /* 4. Plan page for civil pilots */
  function planPage() {
    const qp = document.querySelector("#view .qp");
    if (!qp) return;
    const civil = document.body.classList.contains("role-civil");
    if (civil) {
      textNodes(qp, (v) => v
        .replace(/ and, for military flights, the mission and kneeboard cards\./, " and the map.")
        .replace(/, the map and the map\./, " and the map.")
        .replace(/, MGRS grids, or named points like LZ SPARROW\./, " or VOR and fix names.")
        .replace(/Use notional names and points\./, ""));
      for (const q of qp.querySelectorAll(".qask")) if (/^\s*Plan type/i.test(q.textContent) && /Military mission/i.test(q.textContent)) q.classList.add("lp-mil");
    }
    // The "New to AeroSignal?" line under the box repeats the welcome card
    const welcome = document.getElementById("asWelcome");
    for (const p of document.querySelectorAll("#view p.small.muted")) {
      if (!/^New to AeroSignal\?/.test(p.textContent)) continue;
      p.classList.toggle("lp-hide", !!(welcome && welcome.offsetParent));
      const a = p.querySelector('a[href="#/missions"]');
      if (a && civil && !a.dataset.lp) {
        a.dataset.lp = "1";
        const prev = a.previousSibling;
        if (prev && prev.nodeType === 3) prev.nodeValue = prev.nodeValue.replace(/ or\s*$/, "");
        a.classList.add("lp-mil");
        const next = a.nextSibling; if (next && next.nodeType === 3 && /^\./.test(next.nodeValue) && prev) prev.nodeValue = prev.nodeValue.replace(/\s*$/, "");
      }
    }
    for (const q of document.querySelectorAll("#qOut .qask")) if (civil && /^\s*Plan type/i.test(q.textContent) && /Military mission/i.test(q.textContent)) q.classList.add("lp-mil");
  }

  /* 6. Wording */
  function dayName(d) { return DAYS[d.getDay()]; }
  function wording() {
    const view = document.getElementById("view");
    if (!view) return;
    if (on(/^#\/brief/)) {
      textNodes(view.querySelector(".page > .lede") || view.querySelector(".lede"), (v) => v.replace(/departing (\d{4})-(\d\d)-(\d\d) (\d\d:\d\d) local/, (m, y, mo, d, t) => {
        const dt = new Date(+y, +mo - 1, +d); return isNaN(dt) ? m : `departing ${dayName(dt)}, ${MON[dt.getMonth()]} ${+d} at ${t} local`;
      }));
      const h1 = view.querySelector(".page > h1");
      const sp = h1 && h1.querySelector("span.muted");
      if (sp) { const m = sp.textContent.trim().match(/^(\S+)\s+(\S+)$/); if (m && m[1] === m[2]) sp.textContent = m[1]; }
      let f = null; try { f = currentFlight(); } catch {}
      if (h1 && f && f.points && f.points.length > 2) {
        const p = f.points, a = p[0].ident, z = p[p.length - 1].ident;
        if (a === z) { const far = p.slice(1, -1).find((x) => x.kind === "airport") || p[1]; textNodes(h1, (v) => v.replace(new RegExp(`^${a} to ${a}\\b`), `${a} to ${far.ident} and back`)); }
      }
    }
    textNodes(view, (v) => (/Enter This aircraft's/.test(v) ? v.replace("Enter This aircraft's", "Enter this aircraft's") : v));
    // Approved by the owner on October 22, 2026: no trademark claim until the name is cleared
    for (const n of view.querySelectorAll(".own-note")) if (/ AeroSignal™ is a trademark\./.test(n.textContent)) n.textContent = n.textContent.replace(" AeroSignal™ is a trademark.", "");
    if (on(/^#\/account/)) textNodes(view, (v) => v.replace("Accounts keep your profile for future features like syncing across devices and sharing with your squadron. Your logbook and missions stay on this device for now.", "An account lets you sync your flights across devices, get flight alerts before departure and join a flight school. Without an account, everything stays on this device."));
    if (on(/^#\/logbook/)) textNodes(view, (v) => v.replace("Your logbook stays in this browser; it is never uploaded.", "Your logbook stays in this browser unless you turn on account sync."));
  }
  function chip() {
    const c = document.getElementById("flightChip");
    let f = null; try { f = currentFlight(); } catch {}
    if (!c || !f || !f.points || f.points.length < 3) return;
    const p = f.points, a = p[0].ident, z = p[p.length - 1].ident;
    if (a !== z) return;
    const far = p.slice(1, -1).find((x) => x.kind === "airport") || p[1];
    const want = `${a} → ${far.ident} → ${z}`;
    if (c.textContent.startsWith(`${a} → ${z}`)) c.textContent = c.textContent.replace(`${a} → ${z}`, want);
  }
  if (typeof updateChip === "function") {
    const base = updateChip;
    updateChip = function () { const r = base.apply(this, arguments); try { chip(); } catch {} return r; };
  }

  let busy = false, t = 0;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      if (afterBuild()) return;
      if (on(/^#\/(plan\/done|brief)/)) aircraftFromPlan();
      if (on(/^#\/brief/)) bottomLine();
      if (on(/^#\/plan/)) planPage();
      wording();
      chip();
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  let first = 0;
  // Debounce, but never wait more than 0.6 s while the page keeps changing
  const kick = () => { clearTimeout(t); const now = Date.now(); if (!first) first = now; t = setTimeout(() => { first = 0; apply(); }, Math.max(0, Math.min(250, 600 - (now - first)))); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true, characterData: true });
  window.addEventListener("hashchange", () => { if (afterBuild()) return; kick(); });
  kick();
  window.AeroPolish = { aircraftFromPlan, TYPES };
})();
