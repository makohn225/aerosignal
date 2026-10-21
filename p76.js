"use strict";
/* p76: the flight brief for a military aircraft leads with military lessons.
   The civil accident themes are built from light single NTSB records, so on an MV-22B (or any
   military type) flight the bottom line headline "Most common light single accidents" was the wrong
   lesson. For military aircraft:
   1. That bottom line item is replaced with the most relevant military mishap from the Military
      mishap narratives panel (title and its BLUF), with Details jumping to the panel.
   2. The accident lessons section gets a short note saying its lessons come from civil accidents
      near the route and in these conditions, and the light single type item is hidden there.
   Civil aircraft are not touched. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #bbody .milnote{margin:0 0 12px;padding:10px 12px;border:1px solid rgba(61,224,255,.35);border-radius:10px;font-size:13.5px;line-height:1.5;color:var(--ink2,#9fb0c8)}
    #bbody .milnote b{color:var(--ink,#EAF2FF)}
    body.mil-ac #bbody .item.mil-hide{display:none}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const BASE = /^Most common .*light single.* accidents/i;

  function isMilFlight() {
    try {
      const f = currentFlight();
      if (!f || f.missionId || !(f.points || []).length) return null;
      if (window.AeroMilFlight && AeroMilFlight.isMil(f.tail)) return f;
    } catch {}
    return null;
  }
  function typeName(f) {
    try { const a = allAircraft()[f.tail] || {}; return a.model || a.typeCode || "military aircraft"; } catch { return "military aircraft"; }
  }
  function topMil() {
    const card = document.querySelector("#mnPanel .mn-card");
    if (!card) return null;
    const ttl = (card.querySelector(".ttl") || {}).textContent || "";
    const box = card.querySelector(".bl-box");
    let bl = "";
    if (box) { const c = box.cloneNode(true); c.querySelectorAll(".bl-k, .bl-tag").forEach((x) => x.remove()); bl = c.textContent.trim(); }
    return ttl ? { ttl: ttl.trim(), bl } : null;
  }
  function jump(e) {
    e.preventDefault();
    const s = document.getElementById("mnPanel");
    if (!s) return;
    if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true);
    s.style.scrollMarginTop = "84px";
    s.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function bluf(f) {
    const ol = document.querySelector("#bfBluf ol");
    if (!ol) return;
    const li = [...ol.children].find((x) => x.dataset.mil || BASE.test(((x.querySelector("b") || {}).textContent || "").trim()));
    if (!li) return;
    const m = topMil();
    const sig = m ? m.ttl : "none";
    if (li.dataset.mil === sig) return;
    li.dataset.mil = sig;
    if (m) {
      li.className = "";
      li.innerHTML = `<b>Military mishap: ${h(m.ttl)}</b><span>${h(m.bl || "A past military mishap near this route or in a similar aircraft.")} <a href="#" data-milj="1">Details</a></span>`;
    } else {
      li.innerHTML = `<b>Civil light aircraft accidents along this route</b><span>Lessons from military mishaps for your ${h(typeName(f))} appear in Military mishap narratives. <a href="#" data-milj="1">Open</a></span>`;
    }
    const a = li.querySelector("[data-milj]");
    if (a) a.onclick = jump;
  }

  function lessons(f) {
    const bb = document.getElementById("bbody");
    if (!bb) return;
    for (const it of bb.querySelectorAll(".item")) {
      const t = ((it.querySelector("h4") || {}).textContent || "").trim();
      if (BASE.test(t)) it.classList.add("mil-hide");
    }
    if (bb.querySelector(".milnote")) return;
    const p = document.createElement("p");
    p.className = "milnote";
    p.innerHTML = `<b>Flying the ${h(typeName(f))}.</b> These lessons come from civil accidents near your route and in today's conditions, useful for weather, terrain and airport hazards. Lessons from military mishaps are in <a href="#" data-milj="1">Military mishap narratives</a>.`;
    p.querySelector("[data-milj]").onclick = jump;
    bb.prepend(p);
  }

  let busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const f = isMilFlight();
    if (!f || document.querySelector("#offSnap")) return;
    busy = true;
    try { bluf(f); lessons(f); } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 260); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
