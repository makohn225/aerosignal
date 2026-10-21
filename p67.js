"use strict";
/* p67: share the bottom line. A Share button on the brief's bottom line card turns the route,
   aircraft, time, risk score and the listed items into a short plain text summary for an
   instructor or a flying partner. Uses the phone's share sheet when there is one, otherwise copies
   the text. Nothing is sent anywhere unless the pilot picks where it goes. Also lays out the
   logbook's recent flights as cards on phones, and gives the mission brief its own bottom line. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #bfBluf .bf-share{display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}
    #bfBluf .bf-share button{appearance:none;font:600 12px var(--disp,inherit);letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:999px;border:1px solid rgba(61,224,255,.6);background:rgba(61,224,255,.1);color:#EAF2FF;cursor:pointer}
    #bfBluf .bf-share button:hover{border-color:#3DE0FF;color:#3DE0FF}
    #bfBluf .bf-share span{font-size:12px;color:var(--ink2,#9fb0c8)}
  `;
  document.head.appendChild(css);
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

  function summary() {
    const page = document.querySelector("#view .page");
    const card = document.getElementById("bfBluf");
    if (!page || !card) return "";
    const lines = [];
    let head = txt(page.querySelector(":scope > h1"));
    try {
      const f = currentFlight();
      if (f) {
        const bits = [f.rules, f.date && `${f.date}${f.time ? " " + f.time : ""} local`].filter(Boolean);
        if (bits.length) head += `, ${bits.join(", ")}`;
        if (f.route) lines.push(`Route: ${f.route}`);
      }
    } catch {}
    lines.unshift(`AeroSignal brief: ${head}`);
    const lvl = txt(card.querySelector(".lvl"));
    if (lvl) lines.push(lvl.replace(/^Risk/, "Risk score"));
    const items = [...card.querySelectorAll("ol > li")].map((li, i) => `${i + 1}. ${txt(li.querySelector("b"))}`);
    if (items.length) lines.push("", "Bottom line:", ...items);
    else lines.push("", txt(card.querySelector(".ok")));
    lines.push("", "A decision aid built from public records, not an official briefing.");
    return lines.join("\n");
  }

  async function share(btn, note) {
    const text = summary();
    if (!text) return;
    try {
      if (navigator.share && matchMedia("(pointer:coarse)").matches) { await navigator.share({ title: "AeroSignal brief", text }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); note.textContent = "Copied. Paste it into a text or email."; }
    catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); note.textContent = "Copied. Paste it into a text or email."; } catch { note.textContent = "Could not copy on this device."; }
      ta.remove();
    }
    setTimeout(() => { note.textContent = ""; }, 4000);
  }

  function add() {
    if (!/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const card = document.getElementById("bfBluf");
    if (!card || card.querySelector(".bf-share") || !card.querySelector("ol, .ok")) return;
    const d = document.createElement("div");
    d.className = "bf-share";
    d.innerHTML = `<button type="button">Share bottom line</button><span role="status"></span>`;
    d.querySelector("button").onclick = () => share(d.querySelector("button"), d.querySelector("span"));
    const ft = card.querySelector(".ft");
    if (ft) ft.before(d); else card.appendChild(d);
  }
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(add, 150); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroShareBrief = { summary };

  /* Logbook on phones: each recent flight becomes a compact card (date, aircraft and route on top,
     then the times that were logged) instead of a wide table that runs off the screen. */
  const lcss = document.createElement("style");
  lcss.textContent = `
    @media (max-width:640px){
      table.lb-cards thead,table.lb-cards tr.lb-h{display:none}
      table.lb-cards,table.lb-cards tbody{display:block;width:100%}
      table.lb-cards tr{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px 10px;padding:10px 2px;border-bottom:1px solid var(--line2,rgba(255,255,255,.1))}
      table.lb-cards td{display:block;padding:0!important;border:0!important;min-width:0;white-space:normal!important}
      table.lb-cards td.lb-top{grid-column:1/-1;font-size:0!important}
      table.lb-cards td.lb-top::before{content:attr(data-top);font-weight:700;font-size:14.5px;color:var(--ink,#EAF2FF)}
      table.lb-cards td.lb-n::before{content:attr(data-l);display:block;font:600 10px var(--disp,inherit);letter-spacing:1px;text-transform:uppercase;color:var(--ink2,#9fb0c8)}
      table.lb-cards td.lb-n{font-family:var(--mono,monospace);font-size:13.5px}
      table.lb-cards td.lb-rem{grid-column:1/-1;font-size:13px;color:var(--ink2,#9fb0c8)}
      table.lb-cards td.lb-empty{display:none}
      .scroll:has(> table.lb-cards){overflow:visible}
    }
  `;
  document.head.appendChild(lcss);
  function cards() {
    if (!/^#\/logbook(\/|$|\?)/.test(location.hash || "")) return;
    for (const sec of document.querySelectorAll("#view section.panel")) {
      if (!/recent flights/i.test(txt(sec.querySelector("h2")))) continue;
      const t = sec.querySelector("table");
      if (!t || t.classList.contains("lb-cards")) continue;
      const hr = t.querySelector("thead tr") || [...t.querySelectorAll("tr")].find((r) => r.querySelector("th"));
      if (!hr) continue;
      hr.classList.add("lb-h");
      const heads = [...hr.children].map((c) => txt(c));
      const idx = (re) => heads.findIndex((x) => re.test(x));
      const iDate = idx(/^date/i), iAc = idx(/aircraft/i), iRoute = idx(/route/i), iRem = idx(/remark/i);
      for (const tr of t.querySelectorAll("tr")) {
        if (tr === hr) continue;
        const cells = [...tr.children];
        if (cells.length < 3) continue;
        // One line on top: date, aircraft and route together
        const top = [iDate, iAc, iRoute].filter((i) => i >= 0 && cells[i]).map((i) => txt(cells[i])).filter(Boolean).join("  ·  ");
        cells.forEach((c, i) => {
          if (i === iDate) { c.classList.add("lb-top"); c.dataset.top = top; }
          else if (i === iAc || i === iRoute) c.classList.add("lb-empty");
          else if (i === iRem) { c.classList.add("lb-rem"); if (!txt(c)) c.classList.add("lb-empty"); }
          else { c.classList.add("lb-n"); c.dataset.l = heads[i] || ""; if (!txt(c) || txt(c) === "0") c.classList.add("lb-empty"); }
        });
      }
      t.classList.add("lb-cards");
    }
  }
  let t2 = 0;
  const kick2 = () => { clearTimeout(t2); t2 = setTimeout(cards, 150); };
  new MutationObserver(kick2).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick2);
  kick2();

  /* Mission brief: the same bottom line card the flight brief has. It pulls the lessons from past
     debriefs, the nearest military mishap, the hazards for the mission types, active TFRs and any
     route that did not resolve to the top, with a jump to each, plus a row of section chips. */
  const mcss = document.createElement("style");
  mcss.textContent = `
    #mbBluf{margin:12px 0 12px;padding:14px 16px 12px;border-radius:14px;border:1px solid rgba(61,224,255,.45);background:linear-gradient(180deg,rgba(61,224,255,.08),rgba(61,224,255,.02))}
    #mbBluf .k{font:700 11px var(--disp,inherit);letter-spacing:2px;text-transform:uppercase;color:#3DE0FF;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    #mbBluf .lvl{font:700 11px var(--mono,monospace);letter-spacing:.06em;padding:2px 8px;border-radius:999px;border:1px solid currentColor;text-decoration:none}
    #mbBluf .lvl.low{color:#46e39b}#mbBluf .lvl.medium,#mbBluf .lvl.med{color:#ffb547}#mbBluf .lvl.high{color:#ff4d6a}
    #mbBluf ol{margin:10px 0 4px;padding:0;list-style:none;counter-reset:b}
    #mbBluf li{counter-increment:b;display:grid;grid-template-columns:26px 1fr;gap:2px 8px;padding:8px 0;border-top:1px solid rgba(255,255,255,.07)}
    #mbBluf li:first-child{border-top:0}
    #mbBluf li::before{content:counter(b);grid-row:span 2;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:700 12px var(--mono,monospace);background:rgba(61,224,255,.14);color:#3DE0FF;margin-top:1px}
    #mbBluf li.warn::before{background:rgba(255,181,71,.16);color:#ffb547}
    #mbBluf li.crit::before{background:rgba(255,77,106,.16);color:#ff4d6a}
    #mbBluf li b{font-size:15px;line-height:1.35}
    #mbBluf li span{font-size:13.5px;line-height:1.45;color:var(--ink2,#9fb0c8)}
    #mbBluf li a{color:#3DE0FF;white-space:nowrap}
    #mbBluf .ft{font-size:11.5px;color:var(--ink2,#9fb0c8);margin-top:6px}
    #mbJump{display:flex;gap:6px;overflow-x:auto;margin:0 0 12px;padding-bottom:2px;scrollbar-width:none}
    #mbJump::-webkit-scrollbar{display:none}
    #mbJump a{flex:none;font-size:12.5px;padding:5px 10px;border-radius:999px;border:1px solid var(--line2,rgba(255,255,255,.16));color:var(--ink,#EAF2FF);text-decoration:none;white-space:nowrap}
    #mbJump a:hover{border-color:#3DE0FF;color:#3DE0FF}
  `;
  document.head.appendChild(mcss);
  const esc2 = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const panelBy = (page, re) => [...page.querySelectorAll("section.panel")].find((p) => re.test(txt(p.querySelector("h2"))));
  function go2(el) {
    if (!el) return;
    const sec = el.closest("section.pnl-min");
    if (sec && window.AeroPanels) AeroPanels.setMin(sec, false, true);
    el.style.scrollMarginTop = "84px";
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.classList.remove("bf-flash"); void el.offsetWidth; el.classList.add("bf-flash");
  }
  function mItems(page) {
    const out = [];
    const rc = page.querySelector("#routecheck");
    if (rc && /Not enough points resolved|could not be resolved/i.test(txt(rc))) out.push({ cls: "crit", t: "Part of the route did not resolve", s: "Fix the legs on the Plan tab so the route check, mishaps and airspace cover the whole route.", el: rc });
    const ls = [...page.querySelectorAll(".lesson")];
    for (const l of ls.slice(0, 2)) {
      const fix = [...l.querySelectorAll("div")].map(txt).find((x) => /^Fix:/.test(x)) || "";
      out.push({ cls: "warn", t: "Your lesson: " + txt(l.querySelector("b")), s: fix || "From a past debrief of a similar mission.", el: l });
    }
    const mn = page.querySelector("#mnPanel .mn-card");
    if (mn) out.push({ cls: /fatal/i.test(txt(mn.querySelector(".meta"))) ? "crit" : "", t: txt(mn.querySelector(".ttl")) + (txt(mn.querySelector(".mn-near")) ? ` (${txt(mn.querySelector(".mn-near"))})` : ""), s: txt(mn.querySelector(".bl-box")).replace(/^BLUF\s*/, "").replace(/(Cause unclear|Lesson|Wildlife|Traffic)$/i, "").trim() || "Military mishap near this route.", el: mn });
    const hz = [...page.querySelectorAll(".hzcard b")].map(txt).filter(Boolean);
    if (hz.length) out.push({ cls: "", t: `Hazards to brief: ${hz.slice(0, 3).join(", ")}${hz.length > 3 ? ` and ${hz.length - 3} more` : ""}`, s: "Matched to the mission types on your legs.", el: page.querySelector(".hzgrid") });
    const tfr = page.querySelector("#tfrPanel");
    if (tfr && !/No TFRs found/i.test(txt(tfr)) && tfr.querySelector("li, .tfr, tr")) out.push({ cls: "crit", t: "Temporary flight restrictions near the route", s: "Check the times and altitudes against the plan.", el: tfr });
    return out.slice(0, 5);
  }
  function mBrief() {
    if (!/^#\/missions\/[^/]+\/brief/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    const chip = page && page.querySelector("a.frat-chip");
    if (!page || !chip) return;
    const list = mItems(page);
    const n = txt(chip.querySelector("b")), lvl = (txt(chip).match(/\b(LOW|MEDIUM|MED|HIGH)\b/) || [])[1] || "";
    const sig = JSON.stringify(list.map((x) => x.t)) + n + lvl;
    let c = page.querySelector("#mbBluf");
    if (!c || c.dataset.sig !== sig) {
      if (!c) { c = document.createElement("section"); c.id = "mbBluf"; c.setAttribute("aria-label", "Bottom line for this mission"); }
      c.dataset.sig = sig;
      c.innerHTML = `<div class="k">Bottom line for this mission ${lvl ? `<a class="lvl ${lvl.toLowerCase()}" href="${esc2(chip.getAttribute("href") || "#")}">Risk ${esc2(n)} ${esc2(lvl)}</a>` : ""}</div>
        ${list.length ? `<ol>${list.map((x, i) => `<li class="${x.cls}"><b>${esc2(x.t)}</b><span>${esc2(x.s)} <a href="#" data-i="${i}">Details</a></span></li>`).join("")}</ol>` : `<p class="small muted" style="margin:8px 0 2px">Nothing stands out yet. Add legs and mission types on the Plan tab.</p>`}
        <div class="ft">A decision aid built from your plan and public reporting. Not an official brief. <b style="color:#ff4d6a">Never enter CUI or classified information.</b></div>`;
      c.querySelectorAll("a[data-i]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); go2(list[+a.dataset.i].el); }));
    }
    if (chip.previousElementSibling !== c) chip.before(c);
    const want = [["#mnPanel", "Mishaps"], [".oapanel", "Objective area"], ["#routecheck", "Route check"], ["#tfrPanel", "TFRs"], [".hzgrid", "Hazards"], [".lesson", "Lessons"], [".bsec", "Brief"]];
    const have = want.filter(([q]) => page.querySelector(q));
    let j = page.querySelector("#mbJump");
    const js = have.map((x) => x[0]).join();
    if (!j || j.dataset.sig !== js) {
      if (!j) { j = document.createElement("nav"); j.id = "mbJump"; j.setAttribute("aria-label", "Mission brief sections"); }
      j.dataset.sig = js;
      j.innerHTML = have.map(([q, l]) => `<a href="#" data-q="${q}">${l}</a>`).join("");
      j.querySelectorAll("a").forEach((a) => (a.onclick = (e) => { e.preventDefault(); go2(page.querySelector(a.dataset.q)); }));
    }
    if (c.nextElementSibling !== j) c.after(j);
    // Long lists of military narratives fold to the most relevant one
    const ml = page.querySelector("#mnPanel .mn-list");
    if (ml && !ml.dataset.bfFold) {
      const cs = [...ml.querySelectorAll(":scope > .mn-card")];
      if (cs.length > 1) {
        ml.dataset.bfFold = "1";
        cs.slice(1).forEach((x) => (x.hidden = true));
        const b = document.createElement("button");
        b.type = "button"; b.className = "btn sec sm mn-more"; b.style.marginTop = "8px";
        b.textContent = `Show ${cs.length - 1} more`;
        b.onclick = () => { cs.forEach((x) => (x.hidden = false)); b.remove(); };
        ml.after(b);
      }
    }
  }
  let t3 = 0, busy3 = false;
  const kick3 = () => { if (busy3) return; clearTimeout(t3); t3 = setTimeout(() => { busy3 = true; try { mBrief(); } catch (e) { console.error(e); } finally { setTimeout(() => (busy3 = false), 0); } }, 150); };
  new MutationObserver(kick3).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick3);
  kick3();
})();
