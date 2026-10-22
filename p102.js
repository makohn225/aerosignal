"use strict";
/* p102: a shorter Logbook page. Recent flights is folded into Find flights (one list, the latest ten
   shown until "Show more"), Aircraft inspections shows one summary line per aircraft (what is due or
   overdue) with an Edit button for the full form, and Time by aircraft starts folded. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #view .page > section.panel.lb-recent{display:none}
    #lbFind:not(.lf-all) tbody tr:nth-child(n+11){display:none}
    #lbFind:not(.lf-all) [data-more]{display:none}
    #lbFind .lf-showall{margin-top:8px}
    #mxPanel .mx-ac:not(.mx-open) .mx-grid,#mxPanel .mx-ac:not(.mx-open) > .row{display:none}
    #mxPanel .mx-sum{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap;font-size:13.5px;margin-top:2px}
    #mxPanel .mx-sum .ok{color:#46e39b;font-weight:700}#mxPanel .mx-sum .warn{color:#ffb648;font-weight:700}#mxPanel .mx-sum .bad{color:#ff4d6a;font-weight:700}
    #mxPanel:not(.mx-any-open) > p.small:first-of-type{display:none}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const openTails = new Set();
  let foldedOnce = false, busy = false, t = 0;
  function apply() {
    if (busy || !/^#\/logbook(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    if (!page) return;
    busy = true;
    try {
      const panels = [...page.querySelectorAll(":scope > section.panel")];
      const title = (s) => ((s.querySelector("h2") || {}).textContent || "").replace(/Hide|Show/g, "").trim();
      const recent = panels.find((s) => /^Recent flights/i.test(title(s)));
      const find = page.querySelector("#lbFind");
      if (recent && find) recent.classList.add("lb-recent");
      if (find) {
        const rows = find.querySelectorAll("tbody tr").length;
        let b = find.querySelector(".lf-showall");
        if (rows > 10 && !find.classList.contains("lf-all")) {
          if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "btn sec sm lf-showall"; b.onclick = () => { find.classList.add("lf-all"); b.remove(); }; const sc = find.querySelector(".scroll"); if (sc) sc.after(b); }
          b.textContent = "Show more";
        } else if (b) b.remove();
      }
      const tba = panels.find((s) => /^Time by aircraft/i.test(title(s)));
      if (tba && !foldedOnce && window.AeroPanels && tba.querySelector(":scope > h2")) { foldedOnce = true; if (!tba.classList.contains("pnl-min")) AeroPanels.setMin(tba, true, false); }
      const mx = page.querySelector("#mxPanel");
      if (mx && window.AeroMx) {
        let any = false;
        for (const box of mx.querySelectorAll(".mx-ac")) {
          const tail = box.dataset.t;
          const open = openTails.has(tail);
          box.classList.toggle("mx-open", open);
          any = any || open;
          const st = AeroMx.status(tail, null, true);
          const due = st.filter((s) => s.cls !== "ok");
          const txt = (s) => (s.hours != null ? (s.hours < 0 ? "overdue" : `${Math.floor(s.hours)} hours left`) : s.days < 0 ? "overdue" : `due in ${s.days} day${s.days === 1 ? "" : "s"}`);
          const sum = !st.length ? `<span class="small muted">No dates entered yet</span>` : due.length ? due.map((s) => `<span class="${s.cls}">${h(s.n)}</span> ${h(txt(s))}`).join("; ") : `<span class="ok">All current</span> <span class="small muted">(${st.length} item${st.length === 1 ? "" : "s"} tracked)</span>`;
          const html = `<span>${sum}</span><button type="button" class="btn sec sm">${open ? "Done" : "Edit"}</button>`;
          let s = box.querySelector(":scope > .mx-sum");
          if (!s) { s = document.createElement("div"); s.className = "mx-sum"; const b = box.querySelector(":scope > b"); if (b) b.after(s); else box.prepend(s); }
          if (s.dataset.v !== html) { s.dataset.v = html; s.innerHTML = html; s.querySelector("button").onclick = () => { openTails.has(tail) ? openTails.delete(tail) : openTails.add(tail); apply(); }; }
        }
        mx.classList.toggle("mx-any-open", any);
      }
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 330); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { foldedOnce = false; kick(); });
  kick();
})();
