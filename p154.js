"use strict";
/* p154: school fleet (October 28, 2026). A Fleet page (#/fleet) where an instructor sets up each
   airplane once: tail, type, planning speed, its weight and balance numbers (the same fields as the
   brief's Weight, balance and fuel panel, p72, saved in S.profiles[tail].wb) and the checklists that go
   with it (p95, S.checklists). The fleet is shared with students as a link or a file; opening it on a
   student's device adds the airplanes and checklists there, so every student plans with the real
   numbers for the tail they fly. Nothing is stored on a server: the link carries the data.
   AeroSignal ships no aircraft limits except the flagged Cessna 172S example (p72); numbers come from
   each airplane's own POH and current weight and balance record. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : null; };
  const TYPES = [["C152", "Cessna 152", 95], ["C172", "Cessna 172", 115], ["C182", "Cessna 182", 135], ["P28A", "Piper Cherokee, Warrior, Archer", 120], ["P28R", "Piper Arrow", 135], ["SR20", "Cirrus SR20", 150], ["SR22", "Cirrus SR22", 175], ["DA40", "Diamond DA40", 130], ["DA20", "Diamond DA20", 100], ["__other", "Other type", 110]];
  const WB = [["empty", "Empty weight (lb)"], ["emptyArm", "Empty weight arm (in)"], ["maxTO", "Max takeoff weight (lb)"], ["maxLdg", "Max landing weight (lb)"], ["fwdLo", "Forward CG limit, light (in)"], ["fwdW", "Up to this weight (lb)"], ["fwdHi", "Forward CG limit at max weight (in)"], ["aft", "Aft CG limit (in)"], ["front", "Front seats arm (in)"], ["rear", "Rear seats arm (in)"], ["bag1", "Baggage 1 arm (in)"], ["bag1Max", "Baggage 1 max (lb)"], ["bag2", "Baggage 2 arm (in)"], ["bag2Max", "Baggage 2 max (lb)"], ["bagMax", "Baggage total max (lb)"], ["fuelArm", "Fuel arm (in)"], ["usable", "Usable fuel (gal)"], ["gph", "Fuel burn (gal per hr)"], ["lbGal", "Fuel weight (lb per gal)"]];
  const NEED = ["empty", "emptyArm", "maxTO", "fwdLo", "aft", "front", "fuelArm", "gph"];
  const css = document.createElement("style");
  css.textContent = `
    .fl-page .fl-ac{border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:14px;padding:12px 14px;margin:0 0 10px}
    .fl-page .fl-ac h3{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 4px;font-size:16px}
    .fl-page .fl-ac h3 span{font-size:12.5px;font-weight:400;color:var(--ink2,#9db2ce)}
    .fl-page .st{font-size:13px}.fl-page .st.ok{color:#46e39b}.fl-page .st.warn{color:#ffb648}
    .fl-page .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 10px;margin:8px 0}
    .fl-page .grid label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--ink2,#9db2ce);text-transform:none;letter-spacing:normal;margin:0}
    .fl-page .grid input,.fl-page .grid select{width:100%;box-sizing:border-box;font-size:15px;padding:8px 10px}
    .fl-page .row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
    .fl-page details summary{cursor:pointer;color:var(--cyan,#3DE0FF);font-size:14px;padding:6px 0}
    .fl-page .ck{font-size:13px;color:var(--ink2,#9db2ce);margin:4px 0}
    .fl-page .share textarea{width:100%;min-height:70px;font:12px var(--mono,monospace);box-sizing:border-box}
    .fl-page .d{margin-top:14px;font-weight:700;color:#ff4d6a;font-size:12.5px}
    .fl-page .ex{color:#ffb648;font-weight:700}
  `;
  document.head.appendChild(css);

  const fleet = () => (S.fleet = S.fleet && typeof S.fleet === "object" ? S.fleet : { name: "", tails: [] });
  const prof = (t) => ((S.profiles = S.profiles || {})[t] = S.profiles[t] || {});
  const checklists = () => (Array.isArray(S.checklists) ? S.checklists : []);
  const ready = (wb) => wb && NEED.every((k) => num(wb[k]) != null);

  // Base64url of UTF-8 JSON, for the share link
  const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));
  function pack() {
    const f = fleet();
    const tails = {};
    for (const t of f.tails) { const p = (S.profiles || {})[t]; if (p) tails[t] = { typeCode: p.typeCode || "", model: p.model || "", tas: p.tas || null, wb: p.wb || null }; }
    const cks = checklists().filter((c) => c.tail && f.tails.includes(c.tail)).map((c) => ({ name: c.name, tail: c.tail, sections: c.sections }));
    return { v: 1, kind: "aerosignal-fleet", school: f.name || "", at: new Date().toISOString().slice(0, 10), tails, checklists: cks };
  }
  function shareUrl() { return `${location.origin}${location.pathname}#/fleet/import/${enc(pack())}`; }
  function download() {
    const blob = new Blob([JSON.stringify(pack(), null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${(fleet().name || "school").replace(/[^A-Za-z0-9]+/g, "_")}_fleet.json`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importData(d, opts = {}) {
    if (!d || d.kind !== "aerosignal-fleet" || !d.tails) throw new Error("This is not an AeroSignal fleet file.");
    const f = fleet();
    if (d.school && !f.name) f.name = String(d.school).slice(0, 80);
    let n = 0, c = 0;
    for (const [t, x] of Object.entries(d.tails)) {
      const tail = String(t).toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 12);
      if (!tail) continue;
      const p = prof(tail);
      p.typeCode = String(x.typeCode || "").slice(0, 8); p.model = String(x.model || "").slice(0, 60);
      if (num(x.tas)) p.tas = num(x.tas);
      if (x.wb && typeof x.wb === "object") { const wb = {}; for (const [k] of WB) if (num(x.wb[k]) != null) wb[k] = num(x.wb[k]); if (x.wb.tpl) wb.tpl = String(x.wb.tpl).slice(0, 10); if (x.wb.emptyEx) wb.emptyEx = true; p.wb = wb; }
      p.fleet = true; if (opts.sample) p.sample = true;
      if (!f.tails.includes(tail)) f.tails.push(tail);
      n++;
    }
    for (const k of d.checklists || []) {
      if (!k || !Array.isArray(k.sections)) continue;
      const list = (S.checklists = checklists());
      const same = list.find((x) => x.tail === k.tail && x.name === k.name);
      const sections = k.sections.slice(0, 40).map((s) => ({ name: String(s.name || "").slice(0, 80), items: (s.items || []).slice(0, 80).map((i) => ({ t: String(i.t || "").slice(0, 100), a: String(i.a || "").slice(0, 60) })) }));
      if (same) { same.sections = sections; same.updated = Date.now(); } else list.push({ id: "ck" + Date.now().toString(36) + c, name: String(k.name || "Checklist").slice(0, 80), tail: k.tail, sections, updated: Date.now(), sample: !!opts.sample });
      c++;
    }
    f.updated = Date.now();
    try { save(); } catch {}
    return { n, c };
  }

  function acCard(t) {
    const p = (S.profiles || {})[t] || {}, wb = p.wb || {};
    const cks = checklists().filter((c) => c.tail === t);
    const st = ready(wb) ? `<span class="st ok">Weight and balance set${wb.emptyEx ? ' <span class="ex">(example empty weight)</span>' : ""}</span>` : `<span class="st warn">Weight and balance numbers needed</span>`;
    return `<div class="fl-ac" data-t="${h(t)}"><h3>${h(t)} <span>${h(p.model || p.typeCode || "")}${p.tas ? ` · ${h(p.tas)} kt` : ""}${p.sample ? " · sample" : ""}</span></h3>${st}
      <div class="ck">Checklists: ${cks.length ? cks.map((c) => `<a href="#/checklists">${h(c.name)}</a>`).join(", ") : 'none yet. <a href="#/checklists">Add one on the Checklists page</a> and pick this tail.'}</div>
      <details><summary>Edit numbers</summary>
        <div class="grid"><label>Planning speed (kt)<input data-k="tas" inputmode="decimal" value="${h(p.tas ?? "")}"></label>
        ${WB.map(([k, l]) => `<label>${h(l)}<input data-wb="${k}" inputmode="decimal" value="${h(wb[k] ?? "")}"></label>`).join("")}</div>
        <div class="row">${(p.typeCode || "").startsWith("C172") || /172/.test(p.model || "") ? `<button type="button" class="btn sec sm" data-a="c172s">Fill with Cessna 172S example numbers</button>` : ""}<button type="button" class="btn sm" data-a="save">Save</button><button type="button" class="btn sec sm" data-a="rm">Remove from fleet</button></div>
        <p class="small muted">Enter this airplane's own numbers from its POH and current weight and balance record. The 172S example is only a starting point and is flagged until you change the empty weight.</p>
      </details></div>`;
  }
  function page(el, arg) {
    const a = String(arg || "");
    // The router passes only the second part of the hash; the fleet data is the third
    if (a === "import" || /^import\//.test(a)) return importPage(el, (location.hash || "").split("/")[3] || a.slice(7));
    const f = fleet();
    el.innerHTML = `<div class="page fl-page"><h1>School fleet</h1>
      <p class="lede">Set up each airplane once: its weight and balance and its checklists. Then share the fleet with your students so they plan with the real numbers for the tail they fly.</p>
      <section class="panel"><h2>School</h2><div class="grid"><label>School name<input id="flName" maxlength="80" value="${h(f.name || "")}" placeholder="Your flight school"></label></div></section>
      <section class="panel"><h2>Airplanes</h2>${f.tails.length ? f.tails.map(acCard).join("") : `<p class="muted">No airplanes yet. Add your first one below.</p>`}
        <div class="grid"><label>Tail number<input id="flTail" maxlength="8" placeholder="N12345" autocapitalize="characters"></label>
        <label>Type<select id="flType">${TYPES.map(([c, n]) => `<option value="${c}">${h(n)}</option>`).join("")}</select></label></div>
        <div class="row"><button type="button" class="btn sm" id="flAdd">Add airplane</button></div></section>
      <section class="panel share"><h2>Share with students</h2>
        <p class="small" style="margin:0 0 8px">Send students this link, or the fleet file. Opening it adds these airplanes and their checklists on their device. The link and file are not stored on a server. Signed in instructors can also save the fleet with their school, so students get it with their invite.</p>
        <div class="row"><button type="button" class="btn sm" id="flCopy" ${f.tails.length ? "" : "disabled"}>Copy share link</button><button type="button" class="btn sec sm" id="flFile" ${f.tails.length ? "" : "disabled"}>Download fleet file</button>
        <label class="btn sec sm" style="cursor:pointer">Import a fleet file<input type="file" id="flIn" accept=".json,application/json" hidden></label></div></section>
      <p class="d">Use each airplane's own POH and current weight and balance record. AeroSignal checks only the numbers you enter, and the pilot in command is responsible for every flight.</p></div>`;
    const q = (s) => el.querySelector(s);
    q("#flName").onchange = (e) => { fleet().name = e.target.value.trim(); save(); };
    q("#flAdd").onclick = () => {
      const tail = q("#flTail").value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      if (!tail) { toast("Enter the tail number"); return; }
      const ty = TYPES.find((x) => x[0] === q("#flType").value) || TYPES[1];
      const p = prof(tail);
      if (ty[0] !== "__other") { p.typeCode = ty[0]; p.model = ty[1]; }
      p.tas = p.tas || ty[2]; p.fleet = true;
      if (!fleet().tails.includes(tail)) fleet().tails.push(tail);
      save(); toast(`${tail} added. Enter its weight and balance numbers.`); page(el, "");
      setTimeout(() => { const d = el.querySelector(`.fl-ac[data-t="${tail}"] details`); if (d) { d.open = true; d.scrollIntoView({ block: "center" }); } }, 50);
    };
    el.querySelectorAll(".fl-ac").forEach((c) => {
      const t = c.dataset.t;
      c.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => {
        const p = prof(t);
        if (b.dataset.a === "save") {
          p.wb = p.wb || {};
          c.querySelectorAll("[data-wb]").forEach((i) => { const v = num(i.value); if (v == null) delete p.wb[i.dataset.wb]; else p.wb[i.dataset.wb] = v; });
          if (p.wb.tpl === "C172S" && window.AeroWB && num(p.wb.empty) !== AeroWB.C172S.empty) delete p.wb.emptyEx;
          const tas = num(c.querySelector('[data-k="tas"]').value); if (tas) p.tas = tas;
          save(); toast(`${t} saved`); page(el, "");
        } else if (b.dataset.a === "c172s" && window.AeroWB) { p.wb = { ...AeroWB.C172S }; save(); page(el, ""); toast("Example numbers filled. Replace the empty weight and arm with this airplane's own."); }
        else if (b.dataset.a === "rm") { if (!confirm(`Remove ${t} from the school fleet? Its numbers stay on this device.`)) return; fleet().tails = fleet().tails.filter((x) => x !== t); save(); page(el, ""); }
      }));
    });
    q("#flCopy").onclick = async () => { const u = shareUrl(); try { await navigator.clipboard.writeText(u); toast("Share link copied"); } catch { prompt("Copy this link", u); } };
    q("#flFile").onclick = download;
    q("#flIn").onchange = async (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      try { const r = importData(JSON.parse(await file.text())); toast(`Added ${r.n} airplane${r.n === 1 ? "" : "s"} and ${r.c} checklist${r.c === 1 ? "" : "s"}`); page(el, ""); } catch (err) { toast(err.message || "Could not read that file"); }
    };
  }
  function importPage(el, data) {
    let d = null; try { d = dec(data); } catch {}
    if (!d || d.kind !== "aerosignal-fleet") { el.innerHTML = `<div class="page fl-page"><h1>School fleet</h1><p class="note">This fleet link is incomplete or damaged. Ask your instructor to send it again, or to send the fleet file.</p></div>`; return; }
    const tails = Object.entries(d.tails || {});
    el.innerHTML = `<div class="page fl-page"><h1>Add ${h(d.school || "your school's")} fleet</h1>
      <p class="lede">This adds ${tails.length} airplane${tails.length === 1 ? "" : "s"} and ${(d.checklists || []).length} checklist${(d.checklists || []).length === 1 ? "" : "s"} to this device, so your briefs use the real numbers for the tail you fly.</p>
      <section class="panel"><ul>${tails.map(([t, x]) => `<li><b>${h(t)}</b> ${h(x.model || x.typeCode || "")}${x.wb ? " · weight and balance included" : ""}</li>`).join("")}</ul>
      <div class="row"><button type="button" class="btn" id="flDo">Add to this device</button><a class="btn sec" href="#/plan">Not now</a></div>
      <p class="small muted">Airplanes with the same tail number on this device are updated to the school's numbers.</p></section></div>`;
    el.querySelector("#flDo").onclick = () => { try { const r = importData(d); toast(`Added ${r.n} airplane${r.n === 1 ? "" : "s"} and ${r.c} checklist${r.c === 1 ? "" : "s"}`); location.replace("#/fleet"); } catch (e) { toast(e.message); } };
  }
  if (typeof ROUTES !== "undefined") ROUTES.fleet = page;
  window.AeroFleet = { pack, importData, shareUrl, enc, dec };
})();
