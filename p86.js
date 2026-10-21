"use strict";
/* p86: takeoff and landing distance check on the civil flight brief. AeroSignal does not hold
   performance charts, so the pilot reads the takeoff and landing distances over a 50 ft obstacle from
   the aircraft's POH for today's conditions; the panel gives the pressure altitude, temperature,
   density altitude and headwind to read the chart with (from p83 Runway winds), then compares the
   distances, plus a safety margin the pilot sets (50% by default), with the best runway at the
   departure and destination. Saved per flight in flight.pf; margin in S.pfPrefs. Hidden on military
   aircraft (their performance data comes from restricted manuals and is not entered here). */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #pfPanel .pf-ap{padding:10px 0;border-top:1px solid var(--line2,rgba(255,255,255,.08))}
    #pfPanel .pf-ap:first-of-type{border-top:0;padding-top:4px}
    #pfPanel .pf-cond{font:12.5px var(--mono,monospace);color:var(--ink2,#9fb0c8);margin:4px 0}
    #pfPanel .pf-in{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px 12px;margin:8px 0}
    #pfPanel .pf-in label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;letter-spacing:.4px;color:var(--ink2,#9fb0c8)}
    #pfPanel .pf-in input{width:100%;box-sizing:border-box;font:14px var(--mono,monospace)}
    #pfPanel .pf-res{font-size:14px;line-height:1.5;margin:4px 0}
    #pfPanel .pf-res b{font-family:var(--mono,monospace)}
    #pfPanel .ok{color:#46e39b}#pfPanel .warn{color:#ffb648}#pfPanel .bad{color:#ff4d6a}
    #pfPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #bfBluf .bf-pf{margin:2px 0;font-size:13.5px;line-height:1.45}
    #bfBluf .bf-pf .ok{color:#46e39b;font-weight:700}#bfBluf .bf-pf .bad{color:#ff4d6a;font-weight:700}#bfBluf .bf-pf .warn{color:#ffb648;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const margin = () => { const m = +((S.pfPrefs || {}).margin); return isFinite(m) && m >= 0 ? m : 50; };

  function isMil(f) { try { return !!(window.AeroMilFlight && AeroMilFlight.isMil(f.tail)); } catch { return false; } }

  function check(need, avail, m) {
    if (!need || !avail) return null;
    const req = need * (1 + m / 100);
    return { req, spare: avail - req, cls: req <= avail ? (avail - req < 500 ? "warn" : "ok") : "bad" };
  }

  function block(a, f, m) {
    const role = /Departure/.test(a.role) ? "to" : "ld";
    const both = a.role === "Departure and return";
    const pf = f.pf || {};
    const key = `${a.ident || a.code}`;
    const v = pf[key] || {};
    const b = a.best;
    const pa = a.c && a.c.alt ? a.elev + (29.92 - a.c.alt) * 1000 : null;
    const cond = a.c
      ? `Pressure altitude ${pa != null ? fmt(Math.ceil(pa / 100) * 100) + " ft" : "unknown"} · temperature ${a.c.temp != null ? a.c.temp + "°C" : "unknown"}${a.da != null ? ` · density altitude ${fmt(Math.ceil(a.da / 100) * 100)} ft` : ""}${b ? ` · runway ${h(b.id)} ${b.head >= 0 ? "headwind " + Math.floor(b.head) : "tailwind " + Math.ceil(-b.head)} kt` : ""}`
      : "Load weather on this page for the conditions to read your chart with.";
    const fields = [];
    if (role === "to" || both) fields.push(["to50", "Takeoff distance over 50 ft (ft)"]);
    if (role === "ld" || both) fields.push(["ld50", "Landing distance over 50 ft (ft)"]);
    const res = fields.map(([k, label]) => {
      const r = check(+v[k], b ? b.len : a.longest, m);
      if (!r) return "";
      const what = k === "to50" ? "Takeoff" : "Landing";
      return `<div class="pf-res">${what}: <b>${fmt(+v[k])} ft</b> plus ${m}% is <b>${fmt(Math.ceil(r.req))} ft</b> against <b>${fmt(b ? b.len : a.longest)} ft</b>${b ? ` on runway ${h(b.id)}` : ""}. <span class="${r.cls}">${r.spare >= 0 ? `${fmt(Math.floor(r.spare))} ft to spare` : `${fmt(Math.ceil(-r.spare))} ft short`}</span>.</div>`;
    }).join("");
    return { html: `<div class="pf-ap" data-ap="${h(key)}"><div><b style="font-family:var(--mono,monospace)">${h(a.ident || a.code)}</b> <span class="small muted">${h(a.role)}</span></div>
      <div class="pf-cond">${cond}</div>
      <div class="pf-in">${fields.map(([k, label]) => `<label>${label}<input type="number" inputmode="numeric" min="0" max="20000" step="10" data-k="${k}" value="${v[k] || ""}" placeholder="From your POH chart"></label>`).join("")}</div>${res}</div>`,
      worst: fields.map(([k]) => check(+v[k], b ? b.len : a.longest, m)).filter(Boolean) };
  }

  let busy = false, t = 0;
  const st = { key: "", r: null, checks: [] };
  function paint(sec, f, r) {
    const m = margin();
    if (!r) { sec.innerHTML = `<h2>Takeoff and landing distance</h2><p class="small muted" style="margin:0">Getting runway lengths and conditions…</p>`; return []; }
    const aps = r.res.filter((a) => !a.missing && a.role !== "Alternate");
    const blocks = aps.map((a) => block(a, f, m));
    sec.innerHTML = `<h2>Takeoff and landing distance</h2>
      <p class="small" style="margin:0 0 4px">Read the distances over a 50 ft obstacle from your POH for today's weight and the conditions shown, then enter them here to compare with the runway.</p>
      ${blocks.map((x) => x.html).join("") || `<p class="small muted">Add a departure and destination airport.</p>`}
      <div class="pf-in" style="max-width:260px"><label>Safety margin (%)<input type="number" min="0" max="200" step="5" id="pfMargin" value="${m}"></label></div>
      <p class="disc">The aircraft's POH governs. Correct for weight, runway slope and surface, and wet or contaminated runways as the POH directs. A common practice is to add at least 50%.</p>`;
    sec.querySelectorAll(".pf-ap input[data-k]").forEach((inp) => (inp.onchange = () => {
      const ap = inp.closest(".pf-ap").dataset.ap;
      f.pf = f.pf || {}; f.pf[ap] = f.pf[ap] || {};
      const n = Math.max(0, Math.min(20000, Math.round(+inp.value || 0)));
      if (n) f.pf[ap][inp.dataset.k] = n; else delete f.pf[ap][inp.dataset.k];
      f.updated = Date.now(); save(); st.key = ""; kick();
    }));
    const mi = sec.querySelector("#pfMargin");
    mi.onchange = () => { S.pfPrefs = S.pfPrefs || {}; S.pfPrefs.margin = Math.max(0, Math.min(200, Math.round(+mi.value || 0))); save(); st.key = ""; kick(); };
    return blocks.flatMap((x) => x.worst);
  }
  function bluf(page, checks) {
    const card = page.querySelector("#bfBluf");
    if (!card) return;
    let el = card.querySelector(".bf-pf");
    if (!checks.length) { if (el) el.remove(); return; }
    const bad = checks.filter((c) => c.cls === "bad").length, warn = checks.filter((c) => c.cls === "warn").length;
    const html = `Runway length: ${bad ? `<span class="bad">${bad} too short</span> with your margin` : warn ? `<span class="warn">less than 500 ft to spare</span>` : `<span class="ok">OK</span> with your ${margin()}% margin`}. <a href="#" data-pf="1">Details</a>`;
    if (el && el.dataset.v === html) return;
    if (!el) { el = document.createElement("div"); el.className = "bf-pf"; const after = card.querySelector(".bf-dv") || card.querySelector(".bf-rw") || card.querySelector(".bf-wx"); if (after) after.after(el); else card.appendChild(el); }
    el.dataset.v = html; el.innerHTML = html;
    el.querySelector("[data-pf]").onclick = jump;
  }
  function jump(e) {
    e.preventDefault();
    const s = document.getElementById("pfPanel");
    if (!s) return;
    if (window.AeroPanels && s.classList.contains("pnl-min")) AeroPanels.setMin(s, false, true);
    s.style.scrollMarginTop = "84px";
    s.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function apply() {
    if (busy || !/^#\/brief(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    let f = null; try { f = currentFlight(); } catch {}
    if (!page || !page.querySelector(":scope > h1") || page.querySelector("#offSnap")) return;
    let sec = page.querySelector(":scope > #pfPanel");
    if (!f || f.missionId || !(f.points || []).length || isMil(f) || !window.AeroRunways) { if (sec) sec.remove(); const b = page.querySelector("#bfBluf .bf-pf"); if (b) b.remove(); return; }
    busy = true;
    try {
      const key = `${f.id}|${(f.points || []).map((p) => p.ident).join(",")}|${f.alternate || ""}|${(f.wxText || "").length}|${f.date}|${f.time}|${JSON.stringify(f.pf || {})}|${margin()}`;
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "pfPanel"; }
      if (st.key !== key) {
        st.key = key; sec.dataset.k = "";
        AeroRunways.load(f).then((r) => { if (st.key === key) { st.r = r; sec.dataset.k = ""; kick(); } }).catch(() => {});
      }
      const stamp = `${key}|${st.r ? 1 : 0}`;
      if (sec.dataset.k !== stamp) { sec.dataset.k = stamp; st.checks = paint(sec, f, st.r); }
      bluf(page, st.checks);
      // Just after Diversion airports (p84), which nothing else positions itself against
      const anchor = page.querySelector(":scope > #dvPanel") || page.querySelector(":scope > #rwPanel");
      if (anchor) { if (anchor.nextElementSibling !== sec) anchor.after(sec); }
      else if (!sec.isConnected) page.appendChild(sec);
      const j = page.querySelector("#bfJump");
      if (j && !j.querySelector('[data-s="#pfPanel"]')) {
        const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#pfPanel"; a.textContent = "Runway length"; a.onclick = jump;
        const w = j.querySelector('[data-s="#dvPanel"]'); if (w) w.after(a); else j.appendChild(a);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 340); };
  new MutationObserver((l) => {
    if (busy) return;
    if (l.every((m) => m.target.closest && m.target.closest("#pfPanel, #bfBluf .bf-pf"))) return;
    kick();
  }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
