"use strict";
/* p89: find the flights that count. A Find flights panel on the Logbook page filters the imported
   logbook by kind (cross country, night, instrument, approaches, PIC, dual received, flight review or
   IPC), by time window (including the 90 day landing and 6 month instrument windows), by aircraft and
   by text (airport, route or remarks), with totals for what is shown. Tap a flight to open it on its
   own to read, edit, print or delete it, and print the filtered list. Edits stay in S.logbook. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #lbFind .lf-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
    #lbFind .lf-chips button{appearance:none;border:1px solid var(--line2);background:transparent;color:var(--ink);border-radius:999px;padding:5px 11px;font:13px var(--body,system-ui);cursor:pointer}
    #lbFind .lf-chips button[aria-pressed=true]{background:var(--cyan-soft);border-color:var(--cyan);color:var(--ink)}
    #lbFind .lf-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}
    #lbFind .lf-row select,#lbFind .lf-row input{min-height:38px;font-size:14px}
    #lbFind .lf-row input[type=search]{flex:1;min-width:160px}
    #lbFind .lf-tot{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin:10px 0}
    #lbFind .lf-tot div{border:1px solid var(--line2);border-radius:10px;padding:6px 10px}
    #lbFind .lf-tot b{display:block;font:700 16px var(--mono,monospace)}
    #lbFind .lf-tot span{font-size:11.5px;color:var(--ink2);letter-spacing:.4px}
    #lbFind table{width:100%;border-collapse:collapse;font-size:13.5px}
    #lbFind td,#lbFind th{padding:6px;border-bottom:1px solid var(--line2);text-align:left;vertical-align:top}
    #lbFind th{font-size:11.5px;color:var(--ink2);font-weight:600}
    #lbFind td.n,#lbFind th.n{text-align:right;font-family:var(--mono,monospace)}
    #lbFind tr[data-i]{cursor:pointer}
    #lbFind tr[data-i]:hover td{background:var(--cyan-soft)}
    #lfDlg{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}
    #lfDlg .box{background:var(--bg2,#08111f);border:1px solid var(--line-hi);border-radius:14px;max-width:560px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:16px}
    #lfDlg .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px 12px}
    #lfDlg label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:var(--ink2);letter-spacing:.3px}
    #lfDlg input,#lfDlg textarea{width:100%;box-sizing:border-box;font-size:14px}
    #lfDlg textarea{min-height:70px}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const r1 = (n) => Math.round((+n || 0) * 10) / 10;
  const KINDS = [
    ["all", "All"], ["xc", "Cross country"], ["night", "Night"], ["inst", "Instrument"], ["appr", "Approaches"], ["pic", "PIC"], ["dual", "Dual received"], ["rev", "Review or IPC"],
  ];
  const WINDOWS = [["all", "All time"], ["30", "Last 30 days"], ["90", "Last 90 days (landing currency)"], ["182", "Last 6 months (instrument currency)"], ["365", "Last 12 months"], ["730", "Last 24 months (flight review)"]];
  const st = { kind: "all", win: "all", tail: "", q: "", page: 1 };
  const ldg = (f) => +f.allLdg || (+f.dayLdg || 0) + (+f.nightLdg || 0);
  const inst = (f) => (+f.act || 0) + (+f.sim || 0);

  function filtered() {
    const all = ((S.logbook && S.logbook.flights) || []).map((f, i) => ({ f, i }));
    const cut = st.win === "all" ? null : new Date(Date.now() - +st.win * 864e5).toISOString().slice(0, 10);
    const q = st.q.trim().toUpperCase();
    return all.filter(({ f }) => {
      if (cut && String(f.date) < cut) return false;
      if (st.tail && f.tail !== st.tail) return false;
      if (q && ![f.from, f.to, f.route, f.remarks, f.tail].join(" ").toUpperCase().includes(q)) return false;
      switch (st.kind) {
        case "xc": return +f.xc > 0;
        case "night": return +f.night > 0 || +f.nightLdg > 0;
        case "inst": return inst(f) > 0;
        case "appr": return +f.appr > 0 || +f.holds > 0;
        case "pic": return +f.pic > 0;
        case "dual": return +f.dualRcvd > 0;
        case "rev": return !!(f.review || f.ipc);
        default: return true;
      }
    }).sort((a, b) => String(b.f.date).localeCompare(String(a.f.date)));
  }
  function totals(rows) {
    const s = (k) => r1(rows.reduce((a, { f }) => a + (typeof k === "function" ? k(f) : +f[k] || 0), 0));
    return [["Flights", rows.length], ["Total hours", s("total")], ["PIC", s("pic")], ["Cross country", s("xc")], ["Night", s("night")], ["Instrument", s(inst)], ["Approaches", s((f) => +f.appr || 0)], ["Landings", s(ldg)], ["Night full stop", s((f) => +f.nightLdg || 0)]];
  }

  function paint(sec) {
    const lb = S.logbook || { flights: [] };
    const tails = [...new Set((lb.flights || []).map((f) => f.tail).filter(Boolean))].sort();
    const rows = filtered();
    const shown = rows.slice(0, st.page * 50);
    sec.innerHTML = `<h2>Find flights</h2>
      <div class="lf-chips" role="group" aria-label="Kind of flight">${KINDS.map(([k, n]) => `<button type="button" data-kind="${k}" aria-pressed="${st.kind === k}">${n}</button>`).join("")}</div>
      <div class="lf-row"><select data-f="win" aria-label="Time window">${WINDOWS.map(([k, n]) => `<option value="${k}" ${st.win === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select data-f="tail" aria-label="Aircraft"><option value="">All aircraft</option>${tails.map((t) => `<option ${st.tail === t ? "selected" : ""}>${h(t)}</option>`).join("")}</select>
        <input type="search" data-f="q" placeholder="Airport, route or remarks" value="${h(st.q)}"></div>
      <div class="lf-tot">${totals(rows).map(([l, v]) => `<div><b>${(+v).toLocaleString("en-US")}</b><span>${l}</span></div>`).join("")}</div>
      ${rows.length ? `<div class="scroll"><table><thead><tr><th>Date</th><th>Aircraft</th><th>Route</th><th class="n">Total</th><th class="n">Night</th><th class="n">Inst</th><th class="n">Ldg</th><th class="n">Appr</th></tr></thead><tbody>
        ${shown.map(({ f, i }) => `<tr data-i="${i}" tabindex="0"><td>${h(f.date)}</td><td>${h(f.tail)}</td><td>${h([f.from, f.route, f.to].filter(Boolean).join(" "))}</td><td class="n">${r1(f.total)}</td><td class="n">${+f.night ? r1(f.night) : ""}</td><td class="n">${inst(f) ? r1(inst(f)) : ""}</td><td class="n">${ldg(f) || ""}</td><td class="n">${+f.appr || ""}</td></tr>`).join("")}</tbody></table></div>
        ${rows.length > shown.length ? `<button type="button" class="btn sec sm" data-more="1" style="margin-top:8px">Show ${Math.min(50, rows.length - shown.length)} more</button>` : ""}` : `<p class="small muted">No flights match these filters.</p>`}
      <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn sec sm" data-print="1" ${rows.length ? "" : "disabled"}>Print these ${rows.length} flights</button><span class="small muted">Tap a flight to open, edit or print it.</span></div>`;
    sec.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => { st.kind = b.dataset.kind; st.page = 1; paint(sec); }));
    sec.querySelectorAll("select[data-f]").forEach((s) => (s.onchange = () => { st[s.dataset.f] = s.value; st.page = 1; paint(sec); }));
    const q = sec.querySelector("input[data-f=q]");
    let tq = 0;
    q.oninput = () => { clearTimeout(tq); tq = setTimeout(() => { st.q = q.value; st.page = 1; const pos = q.selectionStart; paint(sec); const n = sec.querySelector("input[data-f=q]"); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} }, 250); };
    const m = sec.querySelector("[data-more]"); if (m) m.onclick = () => { st.page++; paint(sec); };
    sec.querySelectorAll("tr[data-i]").forEach((tr) => { tr.onclick = () => open(+tr.dataset.i, sec); tr.onkeydown = (e) => { if (e.key === "Enter") open(+tr.dataset.i, sec); }; });
    sec.querySelector("[data-print]").onclick = () => printList(rows);
  }

  const FIELDS = [["date", "Date", "date"], ["tail", "Aircraft", "text"], ["from", "From", "text"], ["to", "To", "text"], ["route", "Route", "text"], ["total", "Total", "num"], ["pic", "PIC", "num"], ["xc", "Cross country", "num"], ["night", "Night", "num"], ["act", "Actual instrument", "num"], ["sim", "Simulated instrument", "num"], ["dayLdg", "Day landings full stop", "int"], ["nightLdg", "Night landings full stop", "int"], ["allLdg", "All landings", "int"], ["appr", "Approaches", "int"], ["holds", "Holds", "int"], ["dualRcvd", "Dual received", "num"], ["dualGiven", "Dual given", "num"]];
  function open(i, sec) {
    const f = S.logbook.flights[i];
    if (!f) return;
    const d = document.createElement("div");
    d.id = "lfDlg";
    d.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="Logbook entry"><h2 style="margin-top:0">Flight on ${h(f.date)}</h2>
      <div class="grid">${FIELDS.map(([k, l, t]) => `<label>${l}<input data-k="${k}" type="${t === "date" ? "date" : t === "text" ? "text" : "number"}" ${t === "num" ? 'step="0.1" min="0"' : t === "int" ? 'step="1" min="0"' : ""} value="${h(f[k] ?? "")}"></label>`).join("")}</div>
      <div class="row" style="gap:14px;margin-top:8px"><label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" data-k="review" ${f.review ? "checked" : ""} style="width:auto"> Flight review</label><label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" data-k="ipc" ${f.ipc ? "checked" : ""} style="width:auto"> IPC</label></div>
      <label style="margin-top:8px">Remarks<textarea data-k="remarks">${h(f.remarks || "")}</textarea></label>
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button type="button" class="btn sm" data-a="save">Save</button><button type="button" class="btn sec sm" data-a="print">Print</button><button type="button" class="btn sec sm" data-a="del">Delete</button><button type="button" class="btn sec sm" data-a="close">Close</button></div></div>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    d.onclick = (e) => { if (e.target === d) close(); };
    d.querySelector("[data-a=close]").onclick = close;
    d.querySelector("[data-a=print]").onclick = () => printList([{ f, i }], true);
    d.querySelector("[data-a=del]").onclick = () => { if (!confirm("Delete this flight from your logbook on this device?")) return; S.logbook.flights.splice(i, 1); save(); close(); toast("Flight deleted"); paint(sec); };
    d.querySelector("[data-a=save]").onclick = () => {
      for (const [k, , t] of FIELDS) { const v = d.querySelector(`[data-k="${k}"]`).value; f[k] = t === "num" ? r1(v) : t === "int" ? Math.max(0, Math.round(+v || 0)) : k === "tail" ? v.toUpperCase().trim() : v.trim(); }
      f.review = d.querySelector('[data-k="review"]').checked; f.ipc = d.querySelector('[data-k="ipc"]').checked;
      f.remarks = d.querySelector('[data-k="remarks"]').value;
      S.logbook.edited = Date.now();
      save(); close(); toast("Flight saved"); paint(sec);
    };
    d.querySelector("input").focus();
  }

  function printList(rows, one) {
    const w = window.open("", "_blank");
    if (!w) { toast("Allow pop ups to print"); return; }
    const body = one
      ? `<h1>Logbook entry, ${h(rows[0].f.date)}</h1><table>${FIELDS.map(([k, l]) => `<tr><th>${l}</th><td>${h(rows[0].f[k] ?? "")}</td></tr>`).join("")}<tr><th>Flight review</th><td>${rows[0].f.review ? "Yes" : ""}</td></tr><tr><th>IPC</th><td>${rows[0].f.ipc ? "Yes" : ""}</td></tr><tr><th>Remarks</th><td>${h(rows[0].f.remarks || "")}</td></tr></table>`
      : `<h1>Logbook, ${rows.length} flights</h1><p>${h(KINDS.find((k) => k[0] === st.kind)[1])} · ${h(WINDOWS.find((k) => k[0] === st.win)[1])}${st.tail ? " · " + h(st.tail) : ""}${st.q ? " · " + h(st.q) : ""}</p>
        <p>${totals(rows).map(([l, v]) => `${l}: <b>${(+v).toLocaleString("en-US")}</b>`).join(" · ")}</p>
        <table><tr><th>Date</th><th>Aircraft</th><th>Route</th><th>Total</th><th>PIC</th><th>XC</th><th>Night</th><th>Inst</th><th>Ldg</th><th>Appr</th><th>Remarks</th></tr>${rows.map(({ f }) => `<tr><td>${h(f.date)}</td><td>${h(f.tail)}</td><td>${h([f.from, f.route, f.to].filter(Boolean).join(" "))}</td><td>${r1(f.total)}</td><td>${r1(f.pic) || ""}</td><td>${r1(f.xc) || ""}</td><td>${r1(f.night) || ""}</td><td>${r1(inst(f)) || ""}</td><td>${ldg(f) || ""}</td><td>${+f.appr || ""}</td><td>${h(String(f.remarks || "").slice(0, 120))}</td></tr>`).join("")}</table>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Logbook</title><style>body{font:12px system-ui,sans-serif;color:#111;margin:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eee}button{position:fixed;top:8px;right:8px}@media print{button{display:none}}</style></head><body><button onclick="print()">Print</button>${body}<p style="color:#555;margin-top:12px">From AeroSignal on ${new Date().toLocaleString()}. Check against your official records.</p></body></html>`);
    w.document.close();
  }

  let t = 0, busy = false;
  function apply() {
    if (busy || !/^#\/logbook(\/|$|\?)/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page");
    if (!page || !(S.logbook && (S.logbook.flights || []).length)) return;
    busy = true;
    try {
      let sec = page.querySelector(":scope > #lbFind");
      if (!sec) { sec = document.createElement("section"); sec.className = "panel"; sec.id = "lbFind"; paint(sec); }
      const recent = [...page.querySelectorAll(":scope > section.panel")].find((s) => /^Recent flights/i.test(((s.querySelector("h2") || {}).textContent || "").trim()));
      if (recent) { if (recent.previousElementSibling !== sec) recent.before(sec); }
      else if (!sec.isConnected) page.appendChild(sec);
    } catch (e) { console.error(e); }
    finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 250); };
  new MutationObserver((l) => { if (busy) return; if (l.every((m) => m.target.closest && m.target.closest("#lbFind"))) return; kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
})();
