"use strict";
/* p107: a GO, CAUTION or NO GO verdict at the top of the bottom line card, with the top reasons.
   It reads only what the brief already shows: the weather, load, runway, distance, inspection and
   hazard lines in the card, the currency box, personal minimums and the risk assessment level.
   NO GO: a hard limit is exceeded (VFR flight into IFR weather, weight, balance or fuel short,
   crosswind or runway length over your limit, convective weather, an overdue inspection, lapsed
   currency, weather outside your minimums, a HIGH risk score).
   CAUTION: anything flagged amber, Class B or restricted airspace to coordinate, TFRs, or weather
   not loaded yet. GO otherwise. The pilot in command makes the decision; the badge says so. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #bfBluf .vd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:0 0 10px;padding:0 0 10px;border-bottom:1px solid rgba(255,255,255,.08)}
    #bfBluf .vd .vd-b{font:800 18px/1 var(--disp,system-ui);letter-spacing:2px;padding:8px 14px;border-radius:10px;border:2px solid currentColor}
    #bfBluf .vd.go .vd-b{color:#46e39b;background:rgba(70,227,155,.10)}
    #bfBluf .vd.caution .vd-b{color:#ffb547;background:rgba(255,181,71,.10)}
    #bfBluf .vd.nogo .vd-b{color:#ff4d6a;background:rgba(255,77,106,.12)}
    #bfBluf .vd ul{flex:1 1 220px;margin:0;padding:0 0 0 16px;font-size:13.5px;line-height:1.45;color:var(--ink,#EAF2FF)}
    #bfBluf .vd .vd-d{flex-basis:100%;font-size:12px;font-weight:700;color:#ff4d6a}
  `;
  document.head.appendChild(css);
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const LABEL = { "bf-wbf": "Weight and fuel", "bf-lc": "Load", "bf-rw": "Runway winds", "bf-pf": "Takeoff and landing distance", "bf-mx": "Aircraft inspections", "bf-adv": "Hazards", "bf-as": "Airspace", "bf-nt": "NOTAMs", "bf-dv": "Diversions", "bf-ll": "Low level", "bf-vn": "Descent", "bf-wa": "Altitude" };
  const short = (s) => { s = s.replace(/\s*Details\s*$/i, "").replace(/\.\s*$/, ""); return s.length > 90 ? s.slice(0, 88).replace(/\s+\S*$/, "") + "…" : s; };

  function verdict(page, card, f) {
    const no = [], cau = [];
    // Weather against the flight rules
    const wx = card.querySelector(".bf-wx");
    if (!wx || /No weather loaded|loads here within/i.test(txt(wx))) cau.push("Weather is not loaded yet");
    else {
      const cats = [...wx.querySelectorAll("b")].map((b) => b.className);
      const vfr = (f.rules || "VFR") !== "IFR";
      if (vfr && cats.some((c) => c === "IFR" || c === "LIFR")) no.push("IFR weather on a VFR flight");
      else if (vfr && cats.includes("MVFR")) cau.push("Marginal VFR weather");
      else if (!vfr && cats.includes("LIFR")) cau.push("Low IFR weather");
    }
    // Lines other sections add to the card
    for (const [cls, name] of Object.entries(LABEL)) {
      const el = card.querySelector("." + cls);
      if (!el) continue;
      const cl = el.cloneNode(true); cl.querySelectorAll("a, button").forEach((x) => x.remove());
      const line = short(txt(cl).replace(/^[^:]{2,40}:\s*/, ""));
      if (el.querySelector(".bad")) (cls === "bf-as" ? cau : no).push(`${name}: ${line}`);
      else if (el.querySelector(".warn") && !/example empty weight/i.test(txt(el))) cau.push(`${name}: ${line}`);
    }
    // Currency, minimums, restrictions and the risk assessment
    const cur = page.querySelector(":scope > .cur-alert");
    if (cur) (cur.classList.contains("soon") ? cau : no).push(cur.classList.contains("soon") ? "Currency lapses soon" : "Currency has lapsed before this flight");
    for (const li of card.querySelectorAll("ol > li")) {
      const t = txt(li.querySelector("b"));
      if (/outside your personal minimums/i.test(t)) no.push("Weather is outside your personal minimums");
      else if (/flight restrictions/i.test(t)) cau.push("TFRs near your route");
    }
    const lvl = card.querySelector(".k .lvl");
    if (lvl && lvl.classList.contains("high")) no.push("Risk assessment is HIGH");
    else if (lvl && (lvl.classList.contains("med") || lvl.classList.contains("medium"))) cau.push("Risk assessment is MEDIUM");
    if (no.length) return { k: "nogo", b: "NO GO", r: no.concat(cau) };
    if (cau.length) return { k: "caution", b: "CAUTION", r: cau };
    return { k: "go", b: "GO", r: ["Nothing in this brief exceeds a limit or your minimums"] };
  }

  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    const card = page && page.querySelector("#bfBluf");
    let f = null; try { f = currentFlight(); } catch {}
    if (!card || !f || f.missionId) return;
    busy = true;
    try {
      const v = verdict(page, card, f);
      const html = `<span class="vd-b" role="status">${v.b}</span><ul>${v.r.slice(0, 3).map((x) => `<li>${h(x)}</li>`).join("")}${v.r.length > 3 ? `<li>and ${v.r.length - 3} more below</li>` : ""}</ul><span class="vd-d">A decision aid only. The go or no go decision is yours as pilot in command.</span>`;
      let el = card.querySelector(":scope > .vd");
      if (!el) { el = document.createElement("div"); card.prepend(el); }
      else if (card.firstElementChild !== el) card.prepend(el);
      if (el.className !== "vd " + v.k) el.className = "vd " + v.k;
      if (el.dataset.v !== html) { el.dataset.v = html; el.innerHTML = html; }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 300); };
  new MutationObserver((l) => { if (busy) return; if (l.every((m) => m.target.closest && m.target.closest("#bfBluf > .vd"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroVerdict = { get: () => { const p = document.querySelector("#view .page"), c = p && p.querySelector("#bfBluf"); try { return c ? verdict(p, c, currentFlight()) : null; } catch { return null; } } };
})();
