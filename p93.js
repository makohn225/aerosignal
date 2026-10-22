"use strict";
/* p93: aircraft due dates. On the Logbook page, an "Aircraft inspections" panel keeps, for each civil
   aircraft, the dates of the last annual (14 CFR 91.409), ELT inspection (91.207), transponder check
   (91.413), altimeter and static system check for IFR (91.411) and VOR check for IFR (91.171), plus the
   100 hour inspection by tach time and the pilot's own items. Calendar month items fall due at the end
   of the month. The flight brief shows a line when the flight's aircraft has an item overdue or due
   within 30 days (VOR and static checks only count for IFR flights). Saved in S.profiles[tail].mx,
   which syncs with the aircraft when account sync is on. Military aircraft are left out. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #mxPanel .mx-ac{padding:10px 0;border-top:1px solid var(--line2)}
    #mxPanel .mx-ac:first-of-type{border-top:0}
    #mxPanel .mx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px 12px;margin-top:6px}
    #mxPanel label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--ink2);letter-spacing:.3px}
    #mxPanel input{width:100%;box-sizing:border-box;font-size:14px}
    #mxPanel .due{font-size:12px;font-weight:700}
    #mxPanel .ok{color:#46e39b}#mxPanel .warn{color:#ffb648}#mxPanel .bad{color:#ff4d6a}#mxPanel .na{color:var(--ink3,#6a7f9c);font-weight:400}
    #bfBluf .bf-mx{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-mx .warn{color:#ffb648;font-weight:700}#bfBluf .bf-mx .bad{color:#ff4d6a;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ITEMS = [
    { k: "annual", n: "Annual inspection", m: 12, reg: "91.409" },
    { k: "elt", n: "ELT inspection", m: 12, reg: "91.207" },
    { k: "xpdr", n: "Transponder check", m: 24, reg: "91.413" },
    { k: "pitot", n: "Altimeter and static check (IFR)", m: 24, reg: "91.411", ifr: true },
    { k: "vor", n: "VOR check (IFR)", d: 30, reg: "91.171", ifr: true },
  ];
  const isMil = (tail) => { try { return !!(window.AeroMilFlight && AeroMilFlight.isMil(tail)); } catch { return false; } };
  function dueDate(it, last) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(last || "")) return null;
    const d = new Date(last + "T12:00:00");
    if (it.d) return new Date(+d + it.d * 864e5);
    return new Date(d.getFullYear(), d.getMonth() + it.m + 1, 0, 23, 59); // end of the calendar month
  }
  function status(tail, flightDate, ifr) {
    const mx = ((S.profiles || {})[tail] || {}).mx || {};
    const when = flightDate ? new Date(flightDate + "T12:00:00") : new Date();
    const out = [];
    for (const it of ITEMS) {
      if (it.ifr && !ifr) continue;
      const due = dueDate(it, mx[it.k]);
      if (!due) continue;
      const days = Math.floor((due - when) / 864e5);
      out.push({ n: it.n, due, days, cls: days < 0 ? "bad" : days <= 30 ? "warn" : "ok" });
    }
    if (mx.h100Last != null && mx.tachNow != null && +mx.h100Last > 0) {
      const left = +mx.h100Last + 100 - +mx.tachNow;
      out.push({ n: "100 hour inspection", hours: left, cls: left < 0 ? "bad" : left <= 10 ? "warn" : "ok" });
    }
    for (const c of mx.custom || []) {
      if (!c || !c.name || !/^\d{4}-\d{2}-\d{2}$/.test(c.due || "")) continue;
      const days = Math.floor((new Date(c.due + "T23:59:00") - when) / 864e5);
      out.push({ n: c.name, due: new Date(c.due + "T12:00:00"), days, cls: days < 0 ? "bad" : days <= 30 ? "warn" : "ok" });
    }
    return out;
  }
  const fmtD = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const txt = (s) => s.hours != null ? (s.hours < 0 ? `${Math.ceil(-s.hours)} hours overdue` : `${Math.floor(s.hours)} hours left`) : s.days < 0 ? `overdue since ${fmtD(s.due)}` : `due ${fmtD(s.due)}${s.days <= 30 ? ` (${s.days} day${s.days === 1 ? "" : "s"})` : ""}`;

  function paint(sec) {
    let tails = [];
    try { tails = Object.keys(allAircraft()).filter((t) => t && !isMil(t)); } catch {}
    if (!tails.length) { sec.innerHTML = `<h2>Aircraft inspections</h2><p class="small muted" style="margin:0">Add an aircraft on the Flights page to track its inspections.</p>`; return; }
    sec.innerHTML = `<h2>Aircraft inspections</h2>
      <p class="small" style="margin:0 0 4px">Enter the date each item was last done. AeroSignal works out when it is due and warns you on the brief when a flight's aircraft is due within 30 days.</p>
      ${tails.map((t) => {
        const mx = ((S.profiles || {})[t] || {}).mx || {};
        const st = status(t, null, true);
        const sOf = (n) => st.find((x) => x.n === n);
        return `<div class="mx-ac" data-t="${h(t)}"><b style="font-family:var(--mono,monospace)">${h(t)}</b>
          <div class="mx-grid">${ITEMS.map((it) => { const s = sOf(it.n); return `<label>${it.n} <span class="small">14 CFR ${it.reg}</span><input type="date" data-k="${it.k}" value="${h(mx[it.k] || "")}"><span class="due ${s ? s.cls : "na"}">${s ? txt(s) : "Last done date not entered"}</span></label>`; }).join("")}
            <label>100 hour: tach at last inspection<input type="number" step="0.1" min="0" data-k="h100Last" value="${mx.h100Last ?? ""}" placeholder="If flown for hire"></label>
            <label>Tach now<input type="number" step="0.1" min="0" data-k="tachNow" value="${mx.tachNow ?? ""}">${(() => { const s = sOf("100 hour inspection"); return s ? `<span class="due ${s.cls}">${txt(s)}</span>` : ""; })()}</label>
            ${(mx.custom || []).map((c, i) => `<label>${h(c.name)}<input type="date" data-c="${i}" value="${h(c.due || "")}"><span class="due ${(sOf(c.name) || {}).cls || "na"}">${sOf(c.name) ? txt(sOf(c.name)) : "Due date not set"}</span><button type="button" class="linkbtn" data-rm="${i}" style="align-self:flex-start;font-size:12px">Remove</button></label>`).join("")}
          </div>
          <div class="row" style="gap:6px;margin-top:6px"><input type="text" placeholder="Add your own item, for example Oil change" data-new="1" style="flex:1;min-width:180px;max-width:320px"><button type="button" class="btn sec sm" data-add="1">Add</button></div></div>`;
      }).join("")}
      <p class="small muted" style="margin:8px 0 0">A planning reminder only. The aircraft's maintenance records and the regulations govern airworthiness.</p>`;
    sec.querySelectorAll(".mx-ac").forEach((box) => {
      const t = box.dataset.t;
      const mx = () => { S.profiles = S.profiles || {}; const p = (S.profiles[t] = S.profiles[t] || {}); return (p.mx = p.mx || {}); };
      box.querySelectorAll("input[data-k]").forEach((i) => (i.onchange = () => { const k = i.dataset.k; const m = mx(); if (i.value === "") delete m[k]; else m[k] = i.type === "number" ? +i.value : i.value; save(); paint(sec); }));
      box.querySelectorAll("input[data-c]").forEach((i) => (i.onchange = () => { const m = mx(); (m.custom[+i.dataset.c] || {}).due = i.value; save(); paint(sec); }));
      box.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { const m = mx(); m.custom.splice(+b.dataset.rm, 1); save(); paint(sec); }));
      const nw = box.querySelector("[data-new]");
      box.querySelector("[data-add]").onclick = () => { const v = nw.value.trim().slice(0, 40); if (!v) return; const m = mx(); (m.custom = m.custom || []).push({ name: v, due: "" }); save(); paint(sec); };
    });
  }

  function bluf() {
    const card = document.querySelector("#view .page #bfBluf");
    let f = null; try { f = currentFlight(); } catch {}
    if (!card || !f || f.missionId || !f.tail || isMil(f.tail)) return;
    const st = status(f.tail, f.date, f.rules === "IFR").filter((s) => s.cls !== "ok");
    let el = card.querySelector(".bf-mx");
    if (!st.length) { if (el) el.remove(); return; }
    const html = `Aircraft ${h(f.tail)}: ${st.map((s) => `<span class="${s.cls}">${h(s.n)}</span> ${h(txt(s))}`).join("; ")}. <a href="#/logbook">Update</a>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-mx"; const a = card.querySelector(".bf-wbf") || card.querySelector(".bf-wx"); if (a) a.after(el); else card.appendChild(el); }
    el.dataset.v = html; el.innerHTML = html;
  }

  let t = 0, busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      if (/^#\/brief(\/|$|\?)/.test(location.hash || "")) bluf();
      if (/^#\/logbook(\/|$|\?)/.test(location.hash || "")) {
        const page = document.querySelector("#view .page");
        if (page) {
          let sec = page.querySelector(":scope > #mxPanel");
          if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "mxPanel"; paint(sec); }
          const tba = [...page.querySelectorAll(":scope > section.panel")].find((s) => /^Time by aircraft/i.test(((s.querySelector("h2") || {}).textContent || "").trim()));
          if (tba) { if (tba.nextElementSibling !== sec) tba.after(sec); }
          else if (!sec.isConnected) { const c = page.querySelector(":scope > #curPanel"); if (c) c.after(sec); else page.appendChild(sec); }
        }
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 260); };
  new MutationObserver((l) => { if (busy) return; if (l.every((m) => m.target.closest && m.target.closest("#mxPanel, #bfBluf .bf-mx"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroMx = { status, dueDate };
})();
