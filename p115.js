"use strict";
/* p115: a Today card at the top of the Plan page, the page the app opens on. It shows your next
   flight (or the one in progress): route, aircraft, departure time with a countdown, and the last
   GO, CAUTION or NO GO call from its brief (p120) with how long ago it was checked. When departure is
   within 6 hours and that check is more than an hour old, it asks for a recheck. Buttons: Brief,
   Kneeboard card (p118), Add to calendar and Fly again (p117). Missions and sample flights are left
   out. Nothing shows when there is no upcoming flight. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #tdCard{border:1px solid rgba(61,224,255,.5);background:linear-gradient(180deg,rgba(61,224,255,.08),rgba(61,224,255,.02));border-radius:16px;padding:14px 16px;margin:0 0 14px}
    #tdCard .td-k{font:700 11px var(--disp,system-ui);letter-spacing:2px;text-transform:uppercase;color:var(--cyan,#3DE0FF);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    #tdCard .td-cd{color:var(--ink,#EAF2FF);letter-spacing:1px}
    #tdCard .td-r{font:700 clamp(20px,4.6vw,28px)/1.2 var(--mono,monospace);margin:6px 0 2px;word-break:break-word}
    #tdCard .td-m{font-size:14px;color:var(--ink2,#9db2ce)}
    #tdCard .td-v{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:10px 0 2px;font-size:14px}
    #tdCard .td-b{font:800 14px var(--disp,system-ui);letter-spacing:1.5px;padding:4px 10px;border-radius:8px;border:2px solid currentColor}
    #tdCard .td-b.go{color:#46e39b}#tdCard .td-b.caution{color:#ffb547}#tdCard .td-b.nogo{color:#ff4d6a}#tdCard .td-b.none{color:var(--ink2,#9db2ce)}
    #tdCard .td-re{color:#ffb547;font-weight:700}
    #tdCard .td-bt{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const depAt = (f) => { const d = new Date(`${f.date}T${String(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`); return isNaN(d) ? null : d; };
  function arrAt(f) { try { const p = profile(f); if (p.arrLocal && !isNaN(new Date(p.arrLocal))) return new Date(p.arrLocal); } catch {} const d = depAt(f); return d ? new Date(+d + 36e5) : null; }
  function next() {
    const now = Date.now();
    const list = (S.flights || []).filter((f) => f && !f.demo && !f.missionId && (f.points || []).length >= 2 && depAt(f)).filter((f) => { const a = arrAt(f) || depAt(f); return +a > now; });
    list.sort((a, b) => depAt(a) - depAt(b));
    return list[0] || null;
  }
  function countdown(f) {
    const d = depAt(f), a = arrAt(f), now = Date.now();
    if (d <= now && a > now) return "In progress";
    const m = Math.round((d - now) / 6e4);
    if (m < 60) return `Departs in ${m} min`;
    const hr = Math.floor(m / 60), mm = m % 60;
    if (hr < 24) return `Departs in ${hr} h ${String(mm).padStart(2, "0")} min`;
    const days = Math.round(hr / 24);
    return `Departs in ${days} day${days === 1 ? "" : "s"}`;
  }
  function html(f) {
    const d = depAt(f), mins = (d - Date.now()) / 6e4;
    const vd = f.vd, NAME = { go: "GO", caution: "CAUTION", nogo: "NO GO" };
    const ago = window.AeroVdMemory ? AeroVdMemory.ago : () => "";
    const stale = vd && mins < 360 && Date.now() - vd.at > 60 * 6e4;
    const when = d.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    return `<div class="td-k">Next flight <span class="td-cd">${h(countdown(f))}</span></div>
      <div class="td-r">${h(f.route)}</div>
      <div class="td-m">${h(when)}${f.tail ? " · " + h(f.tail) : ""}${f.rules ? " · " + h(f.rules) : ""}${f.alternate ? " · alternate " + h(f.alternate) : ""}</div>
      <div class="td-v">${vd ? `<span class="td-b ${vd.k}">${NAME[vd.k] || ""}</span><span>Last brief ${h(ago(vd.at))}${vd.r && vd.r[0] ? `: ${h(vd.r[0])}` : ""}</span>${stale ? `<span class="td-re">Weather may have changed. Recheck the brief.</span>` : ""}` : `<span class="td-b none">NOT BRIEFED</span><span>Open the brief to get the call for this flight.</span>`}</div>
      <div class="td-bt"><button type="button" class="btn sm" data-a="brief">${vd ? "Recheck the brief" : "Brief this flight"}</button><button type="button" class="btn sec sm" data-a="card">Kneeboard card</button><button type="button" class="btn sec sm" data-a="cal">Add to calendar</button><button type="button" class="btn sec sm" data-a="again">Fly again</button></div>`;
  }
  let t = 0, busy = false, tick = 0;
  function apply() {
    if (busy) return;
    const hash = location.hash || "";
    if (!(/^#\/plan(\/|$|\?)/.test(hash) || hash === "" || hash === "#/")) return;
    const page = document.querySelector("#view .page.qp");
    if (!page || page.classList.contains("qdone")) return;
    busy = true;
    try {
      const f = next();
      let c = page.querySelector("#tdCard");
      if (!f) { if (c) c.remove(); return; }
      const out = html(f);
      if (!c) { c = document.createElement("section"); c.id = "tdCard"; c.setAttribute("aria-label", "Next flight"); page.prepend(c); }
      if (c.dataset.v === out && c.dataset.f === f.id) return;
      c.dataset.v = out; c.dataset.f = f.id; c.innerHTML = out;
      c.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
        const a = b.dataset.a;
        S.currentId = f.id; try { save(); } catch {}
        if (a === "brief") location.hash = "#/brief";
        else if (a === "card") location.hash = "#/card";
        else if (a === "cal" && window.AeroFlyTools) AeroFlyTools.calendar(f);
        else if (a === "again" && window.AeroFlyTools) AeroFlyTools.again(f);
      }));
    } catch (e) { console.error(e); } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 200); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  // Keep the countdown current
  clearInterval(tick); tick = setInterval(kick, 60000);
  kick();
  window.AeroToday = { next, depAt, arrAt };
})();
