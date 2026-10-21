"use strict";
/* p71: currency reminders from the logbook. Uses the existing currency rules (window.AeroCurrency,
   14 CFR 61.56, 61.57 and 61.23) in two places:
   1. A heads up card on the Plan page when something has lapsed or lapses within 30 days, so the
      pilot hears about it before planning, not at the brief. It can be dismissed for the day.
   2. Under "Pilot current and fit to fly" in the Before you go checklist, the status of each currency
      on the date of this flight: lapsed, lapsing soon, or current until a date. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #curHead{margin:0 0 14px;padding:12px 14px;border-radius:12px;border:1px solid #ffb648;background:rgba(255,182,72,.07);font-size:14px;line-height:1.45}
    #curHead .hd{display:flex;align-items:center;gap:8px;font:600 12px var(--disp,inherit);letter-spacing:1.5px;text-transform:uppercase;color:#ffb648;margin-bottom:4px}
    #curHead .hd button{margin-left:auto;appearance:none;background:none;border:0;color:var(--ink2,#9fb0c8);font-size:18px;line-height:1;cursor:pointer;padding:0 2px}
    #curHead ul{margin:2px 0 6px 18px;padding:0}
    #curHead .bad{color:#ff4d6a;font-weight:700}
    #goPanel .curst{display:flex;flex-wrap:wrap;gap:4px 6px;margin-top:5px}
    #goPanel .curst span{font-size:12px;line-height:1.3;padding:2px 8px;border-radius:999px;border:1px solid currentColor;text-transform:none;letter-spacing:normal}
    #goPanel .curst .ok{color:#46e39b}#goPanel .curst .soon{color:#ffb648}#goPanel .curst .bad{color:#ff4d6a}#goPanel .curst .none{color:var(--ink2,#9fb0c8)}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const on = (re) => re.test(location.hash || "");
  const day = (d) => new Date(d).toLocaleDateString([], { month: "short", day: "numeric", year: new Date(d).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
  const SHORT = { day: "Day passengers", night: "Night passengers", ifr: "Instrument", review: "Flight review", medical: "Medical" };
  function items() {
    try {
      if (!window.AeroCurrency || !AeroCurrency.computeCurrency) return [];
      if (!(S.logbook && (S.logbook.flights || []).length)) return [];
      return AeroCurrency.computeCurrency() || [];
    } catch { return []; }
  }

  /* 1. Heads up on the Plan page */
  function head(page) {
    const today = new Date().toISOString().slice(0, 10);
    const old = page.querySelector("#curHead");
    if (document.body.classList.contains("tut") || (S.curHeadOff === today)) { if (old) old.remove(); return; }
    const list = items().filter((c) => !c.manual && c.exp && (c.status === "bad" || (c.days != null && c.days <= 30))).sort((a, b) => a.days - b.days);
    if (!list.length) { if (old) old.remove(); return; }
    const line = (c) => c.days < 0
      ? `<li><span class="bad">${h(c.label)} lapsed ${day(c.exp)}.</span>${c.grace && new Date(c.grace) > new Date() ? ` You can still regain it with a safety pilot or examiner until ${day(c.grace)}; after that you need an instrument proficiency check.` : ""}</li>`
      : `<li>${h(c.label)} lapses ${day(c.exp)}, in ${Math.ceil(c.days)} day${Math.ceil(c.days) === 1 ? "" : "s"}.</li>`;
    const html = `<div class="hd">Currency heads up<button type="button" aria-label="Hide until tomorrow" title="Hide until tomorrow">×</button></div><ul>${list.map(line).join("")}</ul><a href="#/logbook">See your currency on the Logbook page</a>`;
    if (old && old.dataset.v === html) return;
    const el = old || document.createElement("div");
    el.id = "curHead"; el.dataset.v = html; el.innerHTML = html;
    el.querySelector("button").onclick = () => { S.curHeadOff = today; try { save(); } catch {} el.remove(); };
    if (!old) { const h1 = page.querySelector(":scope > h1"); if (h1) h1.after(el); else page.prepend(el); }
  }

  /* 2. Currency status in the checklist, on the date of the flight */
  function status(f) {
    const at = new Date(`${f.date}T${f.time || "12:00"}:00`), when = isNaN(at) ? new Date() : at;
    const ifr = /IFR/i.test(f.rules || "");
    return items().filter((c) => c.key !== "ifr" || ifr).map((c) => {
      const name = SHORT[c.key] || c.label;
      if (c.manual && !c.exp) return { k: "none", t: `${name}: add the date on the Logbook page` };
      if (!c.exp) return { k: "bad", t: `${name}: not current` };
      const left = (new Date(c.exp) - when) / 864e5;
      if (left < 0) return { k: "bad", t: `${name}: lapsed ${day(c.exp)}` };
      if (left <= 30) return { k: "soon", t: `${name}: current, lapses ${day(c.exp)}` };
      return { k: "ok", t: `${name}: current until ${day(c.exp)}` };
    });
  }
  function check(f) {
    const lab = document.querySelector('#goPanel label[for="go_cur"]');
    if (!lab) return;
    const st = status(f);
    const html = st.length ? st.map((s) => `<span class="${s.k}">${h(s.t)}</span>`).join("") : `<span class="none">Import your logbook to check your currency automatically</span>`;
    let el = lab.querySelector(".curst");
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("span"); el.className = "curst"; lab.appendChild(el); }
    el.dataset.v = html; el.innerHTML = html;
  }

  let busy = false, t = 0;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      const page = document.querySelector("#view .page");
      if (page && on(/^#\/plan(\/|$|\?)/)) head(page);
      if (page && on(/^#\/brief(\/|$|\?)/)) { const f = (() => { try { return currentFlight(); } catch { return null; } })(); if (f) check(f); }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 170); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroCurrencyUI = { status };
})();
