"use strict";
/* p95: checklists. A Checklists page (#/checklists, linked from More and the brief's chip bar) where the
   pilot builds checklists for each aircraft by pasting text: a line ending in a colon starts a section,
   "Item ... Action" or "Item - Action" lines become items. Run a checklist full screen with big tap
   targets: tap to check, the next unchecked item is highlighted, sections show progress, and Reset
   clears it. AeroSignal ships no aircraft specific checklist: the content comes from the pilot's own
   POH or approved checklist. A generic before takeoff memory aid is offered as an example only.
   Saved on this device in S.checklists. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    .ck-list li{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px 0;border-top:1px solid var(--line2)}
    .ck-list li:first-child{border-top:0}
    .ck-run h2{position:sticky;top:0}
    .ck-sec{margin-top:14px}
    .ck-sec h3{display:flex;justify-content:space-between;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--ink2);margin:0 0 6px}
    .ck-item{display:flex;justify-content:space-between;gap:12px;width:100%;text-align:left;background:transparent;border:1px solid var(--line2);border-radius:12px;color:var(--ink);padding:14px 14px;margin:6px 0;font:600 17px var(--body,system-ui);cursor:pointer;min-height:54px}
    .ck-item .ac{font-family:var(--mono,monospace);font-weight:700;color:var(--cyan);text-align:right}
    .ck-item.done{opacity:.45;text-decoration:line-through}
    .ck-item.next{border-color:var(--cyan);box-shadow:0 0 0 1px var(--cyan) inset}
    .ck-edit textarea{width:100%;min-height:260px;font:14px/1.5 var(--mono,monospace);box-sizing:border-box}
    .ck-disc{color:#ff4d6a;font-weight:700;font-size:12.5px}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const EXAMPLE = `Before takeoff (generic memory aid, replace with your POH):
Controls - Free and correct
Instruments - Set and checked
Gas - Correct tank, pump as required
Attitude - Trim set for takeoff
Run up - Complete per POH
Doors and belts - Secure
Lights and transponder - On, ALT
Takeoff briefing - Complete`;
  const list = () => (S.checklists = Array.isArray(S.checklists) ? S.checklists : []);
  function parse(text) {
    const secs = [];
    let cur = null;
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (/:$/.test(line)) { cur = { name: line.slice(0, -1).trim().slice(0, 80), items: [] }; secs.push(cur); continue; }
      if (!cur) { cur = { name: "Checklist", items: [] }; secs.push(cur); }
      const m = line.match(/^(.*?)\s*(?:\.{2,}|\s[-–]\s|\t|:)\s*(.+)$/);
      cur.items.push(m ? { t: m[1].slice(0, 80), a: m[2].slice(0, 60) } : { t: line.slice(0, 100), a: "" });
    }
    return secs.filter((s) => s.items.length);
  }
  const toText = (c) => c.sections.map((s) => `${s.name}:\n${s.items.map((i) => (i.a ? `${i.t} - ${i.a}` : i.t)).join("\n")}`).join("\n\n");
  const run = { id: null, done: new Set() };

  function page(el, arg) {
    const all = list();
    const [mode, id] = String(arg || "").split(":");
    if (mode === "run") return runner(el, all.find((c) => c.id === id));
    if (mode === "edit" || mode === "new") return editor(el, all.find((c) => c.id === id) || null);
    let tails = []; try { tails = Object.keys(allAircraft()); } catch {}
    el.innerHTML = `<div class="page"><h1>Checklists</h1><p class="lede">Your aircraft checklists, ready to run in the cockpit with big tap targets.</p>
      <section class="panel"><h2>Your checklists</h2>
        ${all.length ? `<ul class="ck-list" style="list-style:none;margin:0;padding:0">${all.map((c) => `<li><span><b>${h(c.name)}</b>${c.tail ? ` <span class="small muted">${h(c.tail)}</span>` : ""}<br><span class="small muted">${c.sections.length} section${c.sections.length === 1 ? "" : "s"}, ${c.sections.reduce((a, s) => a + s.items.length, 0)} items</span></span><span class="row" style="gap:6px"><a class="btn sm" href="#/checklists/run:${h(c.id)}">Run</a><a class="btn sec sm" href="#/checklists/edit:${h(c.id)}">Edit</a></span></li>`).join("")}</ul>` : `<p class="small muted" style="margin:0">No checklists yet. Make one from your POH or your unit's approved checklist.</p>`}
        <div class="row" style="gap:8px;margin-top:10px"><a class="btn sm" href="#/checklists/new">New checklist</a></div></section>
      <p class="ck-disc">Use the checklist approved for your aircraft. AeroSignal stores what you enter and does not check it.</p></div>`;
    void tails;
  }
  function editor(el, c) {
    let tails = []; try { tails = Object.keys(allAircraft()); } catch {}
    el.innerHTML = `<div class="page"><h1>${c ? "Edit checklist" : "New checklist"}</h1>
      <section class="panel ck-edit"><div class="row" style="gap:10px;flex-wrap:wrap"><label style="flex:1;min-width:200px">Name<input id="ckName" value="${h(c ? c.name : "")}" placeholder="C172 normal procedures"></label>
        <label>Aircraft<select id="ckTail"><option value="">Any</option>${tails.map((t) => `<option ${c && c.tail === t ? "selected" : ""}>${h(t)}</option>`).join("")}</select></label></div>
        <p class="small muted">One item per line as "Item - Action". A line ending in a colon starts a section, for example "Before landing:".</p>
        <textarea id="ckText" spellcheck="false">${h(c ? toText(c) : "")}</textarea>
        <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" id="ckSave" type="button">Save</button>${c ? "" : `<button class="btn sec sm" id="ckEx" type="button">Insert generic example</button>`}<a class="btn sec sm" href="#/checklists">Cancel</a>${c ? `<button class="btn sec sm" id="ckDel" type="button">Delete</button>` : ""}</div>
        <p class="ck-disc" style="margin-top:10px">Copy from your aircraft's POH or approved checklist. Never enter CUI or classified information.</p></section></div>`;
    const ex = el.querySelector("#ckEx"); if (ex) ex.onclick = () => { const ta = el.querySelector("#ckText"); ta.value = (ta.value ? ta.value + "\n\n" : "") + EXAMPLE; };
    el.querySelector("#ckSave").onclick = () => {
      const sections = parse(el.querySelector("#ckText").value);
      if (!sections.length) { toast("Add at least one item"); return; }
      const name = el.querySelector("#ckName").value.trim().slice(0, 60) || "Checklist";
      const tail = el.querySelector("#ckTail").value;
      if (c) Object.assign(c, { name, tail, sections, updated: Date.now() });
      else list().push({ id: "ck" + Date.now().toString(36), name, tail, sections, updated: Date.now() });
      save(); toast("Checklist saved"); location.hash = "#/checklists";
    };
    const del = el.querySelector("#ckDel"); if (del) del.onclick = () => { if (!confirm(`Delete the checklist ${c.name}?`)) return; S.checklists = list().filter((x) => x !== c); save(); location.hash = "#/checklists"; };
  }
  function runner(el, c) {
    if (!c) { location.hash = "#/checklists"; return; }
    if (run.id !== c.id) { run.id = c.id; run.done = new Set(); }
    const paint = () => {
      const keys = c.sections.flatMap((s, si) => s.items.map((_, ii) => `${si}.${ii}`));
      const next = keys.find((k) => !run.done.has(k));
      el.innerHTML = `<div class="page ck-run"><h1>${h(c.name)}</h1>
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="small muted">${run.done.size} of ${keys.length} done</span><button class="btn sec sm" id="ckReset" type="button">Reset</button><a class="btn sec sm" href="#/checklists">All checklists</a></div>
        ${c.sections.map((s, si) => `<div class="ck-sec"><h3><span>${h(s.name)}</span><span>${s.items.filter((_, ii) => run.done.has(`${si}.${ii}`)).length}/${s.items.length}</span></h3>
          ${s.items.map((it, ii) => { const k = `${si}.${ii}`; return `<button type="button" class="ck-item ${run.done.has(k) ? "done" : ""} ${k === next ? "next" : ""}" data-k="${k}"><span>${h(it.t)}</span><span class="ac">${h(it.a)}</span></button>`; }).join("")}</div>`).join("")}
        ${next ? "" : `<p style="margin-top:14px;font-weight:700;color:#46e39b">Checklist complete.</p>`}</div>`;
      el.querySelectorAll(".ck-item").forEach((b) => (b.onclick = () => { const k = b.dataset.k; run.done.has(k) ? run.done.delete(k) : run.done.add(k); paint(); const n = el.querySelector(".ck-item.next"); if (n && n.getBoundingClientRect().bottom > innerHeight - 90) n.scrollIntoView({ block: "center", behavior: "smooth" }); }));
      el.querySelector("#ckReset").onclick = () => { run.done = new Set(); paint(); scrollTo(0, 0); };
    };
    paint();
  }
  if (typeof ROUTES !== "undefined") ROUTES.checklists = page;

  // Links: a card on More, and a chip on the brief
  let t = 0, busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      const hash = location.hash || "";
      if (/^#\/more(\/|$)/.test(hash)) {
        const pg = document.querySelector("#view .page");
        if (pg && !pg.querySelector("#ckMore")) {
          const s = document.createElement("section"); s.className = "panel"; s.id = "ckMore";
          s.innerHTML = `<h2>Checklists</h2><p class="small" style="margin:0 0 8px">Build your aircraft checklists from your POH and run them in the cockpit with big tap targets.</p><a class="btn sm" href="#/checklists">Open checklists</a>`;
          const ai = pg.querySelector("#aiConn") || pg.querySelector("#aboutAS"); if (ai) ai.before(s); else pg.appendChild(s);
        }
      }
      if (/^#\/brief(\/|$|\?)/.test(hash)) {
        const j = document.querySelector("#view .page #bfJump");
        if (j && !j.querySelector(".ck-chip")) { const a = document.createElement("a"); a.href = "#/checklists"; a.className = "ck-chip"; a.textContent = "Checklists"; j.appendChild(a); }
      }
    } finally { setTimeout(() => (busy = false), 0); }
  }
  const kick = () => { clearTimeout(t); t = setTimeout(apply, 250); };
  new MutationObserver(() => { if (!busy) kick(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  if (/^#\/checklists/.test(location.hash || "")) setTimeout(() => { try { go(); } catch {} }, 0);
  window.AeroChecklists = { parse };
})();
