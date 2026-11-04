"use strict";
/* p167: schools edit the planning lab (November 3, 2026). A school's instructors can change a lesson's
   check questions (question, two to four choices, the right answer and its explanation, one to ten
   questions) and add a school note to the key points. Edits are saved with the school (schools.lab,
   rpc set_school_lab) and shown only to that school's members, labeled "From <school>"; everyone else
   keeps the standard lessons, and "Restore the standard version" removes a school's edit.
   If a lesson's questions change, the student's saved answers to the old ones are cleared.
   Needs migration 20261103_school_lab_edits.sql and its privacy sentence: LIVE stays false until the
   owner approves both (window.AERO_LABEDIT_PREVIEW = true shows it for testing). */
(function () {
  const LIVE = false;
  const on = () => LIVE || window.AERO_LABEDIT_PREVIEW === true;
  const PRIV = "A school's instructors can edit the planning lab check questions and add school notes to the lessons. Those edits are stored with the school and shown only to its members.";
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => { try { return typeof AUTH !== "undefined" && AUTH && AUTH.user && AUTH.user.id ? AUTH.user.id : null; } catch { return null; } };
  async function api(path, opt = {}) {
    const tok = await validToken();
    const r = await fetch(`${SUPA.url}/rest/v1/${path}`, { ...opt, headers: { ...authHdr(tok), "Content-Type": "application/json", ...(opt.headers || {}) } });
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || `Request failed (${r.status})`);
    return j;
  }
  const L = () => (window.AeroLab ? AeroLab.LESSONS : []);
  // The standard lessons, kept so a school's edit can always be undone on this device
  const BASE = {};
  for (const l of L()) BASE[l.id] = { quiz: JSON.parse(JSON.stringify(l.quiz)) };
  const sigOf = (quiz) => JSON.stringify(quiz.map((q) => [q[0], q[1], q[2]]));

  const css = document.createElement("style");
  css.textContent = `
    .sl-note{margin:10px 0 0;padding:8px 12px;border-left:3px solid #46e39b;background:rgba(70,227,155,.07);border-radius:0 8px 8px 0;font-size:14px}
    .sl-from{font-size:12.5px;color:#46e39b;margin:0 0 6px}
    #slEdit .q-ed{border-top:1px solid var(--line2);padding:10px 0;display:grid;gap:6px}
    #slEdit textarea,#slEdit input[type=text]{width:100%;box-sizing:border-box;font:14px var(--body,system-ui)}
    #slEdit textarea{min-height:48px}
    #slEdit .opt{display:flex;gap:8px;align-items:center}
    #slEdit .opt input[type=radio]{width:20px;height:20px;flex:none}
    #slEdit .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    #slEdit .err{color:#ffb648;font-size:13px}
    #slEdit label.t{font-size:12px;color:var(--ink2)}
  `;
  document.head.appendChild(css);

  let mem = null; // { id, name, inst, lab, at }
  function apply() {
    const sc = mem || S.schoolLab || null;
    const lab = sc && sc.lab && sc.lab.lessons ? sc.lab.lessons : {};
    S.lab = S.lab && typeof S.lab === "object" ? S.lab : {};
    let changed = false;
    for (const l of L()) {
      const o = lab[l.id];
      const quiz = o && Array.isArray(o.quiz) && o.quiz.length ? o.quiz : BASE[l.id].quiz;
      l.quiz = quiz; l.schoolNote = (o && o.note) || ""; l.school = o && (o.quiz || o.note) ? sc.name : null;
      const r = S.lab[l.id], sig = sigOf(quiz);
      if (r) {
        const was = r.sig || sigOf(BASE[l.id].quiz);
        if (was !== sig && r.ans) { r.ans = []; changed = true; }
        if (r.sig !== sig) { r.sig = sig; changed = true; }
      }
    }
    if (changed) { try { save(); } catch {} }
  }
  let loading = null;
  async function load(force) {
    if (!uid()) { mem = null; return null; }
    if (loading && !force) return loading;
    loading = (async () => {
      const rows = (await api(`school_members?select=school_id,role,schools(id,name,owner,lab,lab_at)&user_id=eq.${uid()}&order=joined_at.asc`)) || [];
      const pick = rows.find((r) => r.schools && r.schools.lab) || rows[0];
      mem = pick && pick.schools ? { id: pick.school_id, name: pick.schools.name || "your school", inst: pick.role === "instructor" || pick.schools.owner === uid(), lab: pick.schools.lab || null, at: pick.schools.lab_at || null } : null;
      S.schoolLab = mem ? { id: mem.id, name: mem.name, lab: mem.lab, at: mem.at } : null;
      try { save(); } catch {}
      return mem;
    })().catch((e) => { console.error(e); loading = null; return null; });
    return loading;
  }

  function lessonOf() { const m = /^#\/lab\/([a-z]+)/.exec(location.hash || ""); return m && L().find((x) => x.id === m[1]); }
  function decorate() {
    const l = lessonOf(), page = document.querySelector("#view .lab-page");
    if (!l || !page || page.dataset.p167) return;
    page.dataset.p167 = "1";
    const kp = page.querySelector(".kp");
    if (l.schoolNote && kp) kp.parentElement.insertAdjacentHTML("beforeend", `<div class="sl-note"><b>From ${h(l.school || (mem && mem.name) || "your school")}:</b> ${h(l.schoolNote)}</div>`);
    const qs = [...page.querySelectorAll("section.panel")].find((s) => s.querySelector(".q"));
    if (qs && l.school && l.quiz !== BASE[l.id].quiz) qs.querySelector("h2").insertAdjacentHTML("afterend", `<p class="sl-from">These questions are from ${h(l.school)}.</p>`);
    if (mem && mem.inst && qs) {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn sec sm"; b.id = "slEditB";
      b.textContent = `Edit this lesson for ${mem.name}`; b.style.marginTop = "10px";
      b.onclick = () => editor(l, page, qs);
      qs.appendChild(b);
    }
  }
  function editor(l, page, qs) {
    if (page.querySelector("#slEdit")) return;
    const quiz = JSON.parse(JSON.stringify(l.quiz));
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "slEdit";
    qs.after(sec);
    const qHtml = (q, i) => `<div class="q-ed" data-i="${i}"><label class="t">Question ${i + 1}</label><textarea data-f="q" maxlength="400">${h(q[0])}</textarea>
      ${[0, 1, 2, 3].map((o) => `<div class="opt"><input type="radio" name="c${i}" value="${o}" ${q[2] === o ? "checked" : ""} aria-label="Correct answer"><input type="text" data-f="o${o}" maxlength="200" placeholder="${o < 2 ? "Choice" : "Choice (optional)"}" value="${h((q[1] || [])[o] || "")}"></div>`).join("")}
      <label class="t">Why the right answer is right</label><textarea data-f="x" maxlength="600">${h(q[3] || "")}</textarea>
      <div><button type="button" class="btn sec sm" data-rm="${i}">Remove this question</button></div></div>`;
    const paint = () => {
      sec.innerHTML = `<h2>Edit for ${h(mem.name)}</h2>
        <p class="small" style="margin:0 0 8px">Your students see this version; every other school keeps the standard one. Pick the right answer with the round button beside it.</p>
        <label class="t">School note under the key points (optional)</label><textarea data-f="note" maxlength="800">${h(l.schoolNote || "")}</textarea>
        <div id="slQs">${quiz.map(qHtml).join("")}</div>
        <div class="row"><button type="button" class="btn sec sm" id="slAdd" ${quiz.length >= 10 ? "disabled" : ""}>Add a question</button></div>
        <p class="err" id="slErr"></p>
        <div class="row"><button type="button" class="btn sm" id="slSave">Save for ${h(mem.name)}</button><button type="button" class="btn sec sm" id="slStd" ${l.school ? "" : "disabled"}>Restore the standard version</button><button type="button" class="btn sec sm" id="slX">Cancel</button></div>
        <p class="small muted" style="margin:8px 0 0">Your questions are your school's content. Check them against current regulations and your syllabus.</p>`;
      sec.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { read(); quiz.splice(+b.dataset.rm, 1); paint(); }));
      sec.querySelector("#slAdd").onclick = () => { read(); quiz.push(["", ["", "", "", ""], 0, ""]); paint(); };
      sec.querySelector("#slX").onclick = () => sec.remove();
      sec.querySelector("#slSave").onclick = () => save1(false);
      sec.querySelector("#slStd").onclick = () => { if (confirm("Go back to the standard questions for this lesson? Your school's version is removed.")) save1(true); };
    };
    const read = () => {
      sec.querySelectorAll(".q-ed").forEach((d) => {
        const i = +d.dataset.i, v = (f) => (d.querySelector(`[data-f="${f}"]`).value || "").trim();
        const c = d.querySelector(`input[name="c${i}"]:checked`);
        quiz[i] = [v("q"), [v("o0"), v("o1"), v("o2"), v("o3")], c ? +c.value : -1, v("x")];
      });
    };
    const clean = () => {
      read();
      const out = [];
      for (const [i, q] of quiz.entries()) {
        const opts = q[1].map((o, k) => [o, k]).filter(([o]) => o);
        const correct = opts.findIndex(([, k]) => k === q[2]);
        if (!q[0]) return `Question ${i + 1} needs its question.`;
        if (opts.length < 2) return `Question ${i + 1} needs at least two choices.`;
        if (correct < 0) return `Question ${i + 1}: pick the right answer next to a filled in choice.`;
        if (!q[3]) return `Question ${i + 1} needs the reason the right answer is right.`;
        out.push([q[0].slice(0, 400), opts.map(([o]) => o.slice(0, 200)), correct, q[3].slice(0, 600)]);
      }
      if (!out.length) return "Keep at least one question, or restore the standard version.";
      return out;
    };
    async function save1(std) {
      const err = sec.querySelector("#slErr"); err.textContent = "";
      const note = (sec.querySelector('[data-f="note"]').value || "").trim().slice(0, 800);
      let entry = null;
      if (!std) { const q = clean(); if (typeof q === "string") { err.textContent = q; return; } entry = { quiz: q, note: note || undefined }; if (sigOf(q) === sigOf(BASE[l.id].quiz)) delete entry.quiz; if (!entry.quiz && !entry.note) entry = null; }
      const cur = (mem.lab && mem.lab.lessons) ? JSON.parse(JSON.stringify(mem.lab)) : { v: 1, lessons: {} };
      if (entry) cur.lessons[l.id] = entry; else delete cur.lessons[l.id];
      const body = Object.keys(cur.lessons).length ? cur : null;
      sec.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await api("rpc/set_school_lab", { method: "POST", body: JSON.stringify({ s: mem.id, l: body }) });
        mem.lab = body; S.schoolLab = { id: mem.id, name: mem.name, lab: body, at: new Date().toISOString() }; save();
        apply(); toast(std ? "Standard questions restored for your school" : `Saved for ${mem.name}`);
        go();
      } catch (e) { err.textContent = e.message; sec.querySelectorAll("button").forEach((b) => (b.disabled = false)); }
    }
    paint();
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function privacy() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const v = document.getElementById("view"), a = v && (v.querySelector("#pvReview") || v.querySelector("#pvSchool2") || v.querySelector("#pvSchool"));
    if (!a || v.querySelector("#pvLabEdit")) return;
    const p = document.createElement("p"); p.id = "pvLabEdit"; p.textContent = PRIV; a.after(p);
    const w = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/Last updated (October (6|20|21|22|28)|November 2), 2026/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/(October (6|20|21|22|28)|November 2), 2026/, "November 3, 2026");
  }

  let t = 0, started = false;
  const kick = () => { if (t) return; t = setTimeout(() => {
    t = 0;
    if (!on()) return;
    if (!started && /^#\/lab/.test(location.hash || "")) {
      started = true;
      // Show the saved school version right away, then refresh it from the server
      apply();
      load().then(() => { apply(); const p = document.querySelector("#view .lab-page"); if (p && /^#\/lab/.test(location.hash || "")) go(); });
    }
    try { decorate(); privacy(); } catch (e) { console.error(e); }
  }, 300); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroLabEdit = { on, LIVE, apply, load, BASE };
})();
