"use strict";
/* p165: instructor review of shared briefs (November 2, 2026). Needs migration
   20261102_school_share_reviews.sql (applied) and its privacy sentence, both approved November 2, 2026.
   1. School dashboard (#/school/<id>): "Plans to review" lists briefs waiting for review first, each
      with Approve and Return with a comment, then recently reviewed ones (rpc review_share).
   2. Student's brief: the Share with my school box shows the review result and the instructor's
      comment for this flight. Sharing a changed plan again sends it back for review (the database
      does this and records it in school_reviews).
   3. Account page: "Instructor reviews" lists the student's shared briefs and their status. */
(function () {
  const LIVE = true; // migration and privacy sentence approved by the owner on November 2, 2026
  const on = () => LIVE || window.AERO_REVIEW_PREVIEW === true;
  const PRIV = "When an instructor reviews a brief you shared, the result (approved or returned), the instructor's comments and the time are stored with it. You and the school's instructors can see them, and leaving the school removes them.";
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const uid = () => { try { return typeof AUTH !== "undefined" && AUTH && AUTH.user && AUTH.user.id ? AUTH.user.id : null; } catch { return null; } };
  async function api(path, opt = {}) {
    const tok = await validToken();
    const r = await fetch(`${SUPA.url}/rest/v1/${path}`, { ...opt, headers: { ...authHdr(tok), "Content-Type": "application/json", ...(opt.headers || {}) } });
    const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || `Request failed (${r.status})`);
    return j;
  }
  const when = (x) => (x ? new Date(x).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  const LBL = { submitted: "Waiting for review", approved: "Approved", returned: "Returned for changes" };
  const vcls = (v) => (v === "GO" ? "go" : v === "CAUTION" ? "caution" : v === "NO GO" ? "nogo" : "");
  const css = document.createElement("style");
  css.textContent = `
    .rv-chip{display:inline-block;font:700 11px var(--mono,monospace);letter-spacing:.5px;padding:3px 8px;border-radius:999px;border:1px solid var(--line2)}
    .rv-chip.approved{color:#46e39b;border-color:rgba(70,227,155,.6)}.rv-chip.returned{color:#ffb648;border-color:rgba(255,182,72,.6)}.rv-chip.submitted{color:var(--cyan,#3DE0FF);border-color:rgba(61,224,255,.5)}
    #rvPanel .rv-item{border-top:1px solid var(--line2);padding:10px 0;display:grid;gap:6px}
    #rvPanel .rv-top{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}
    #rvPanel .rv-top b{font-size:15px}
    #rvPanel textarea{width:100%;min-height:54px;box-sizing:border-box;font:14px var(--body,system-ui)}
    #rvPanel .rv-act{display:flex;gap:8px;flex-wrap:wrap}
    .rv-note{font-size:13.5px;margin:4px 0 0;padding:6px 10px;border-left:3px solid var(--line-hi,rgba(125,211,252,.35));background:rgba(0,0,0,.15);border-radius:0 8px 8px 0}
  `;
  document.head.appendChild(css);

  /* ---------- 1. Dashboard ---------- */
  async function dashboard() {
    const m = /^#\/school\/([0-9a-f-]{36})/.exec(location.hash || "");
    if (!m || !uid()) return;
    const page = document.querySelector("#view .sc-dash");
    if (!page || page.dataset.p165 || !page.querySelector("section.panel")) return;
    page.dataset.p165 = "1";
    let rows = [];
    try { rows = (await api(`school_shares?select=id,student_name,route,dep_at,verdict,reasons,status,review_note,reviewed_at,created_at&school_id=eq.${m[1]}&order=created_at.desc&limit=100`)) || []; } catch (e) { console.error(e); return; }
    if (!document.body.contains(page)) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "rvPanel";
    const waiting = rows.filter((r) => r.status === "submitted"), done = rows.filter((r) => r.status !== "submitted").slice(0, 10);
    const item = (r, act) => `<div class="rv-item" data-id="${h(r.id)}"><div class="rv-top"><b>${h(r.student_name || "Student")}</b><span>${h(r.route || "")}</span><span class="small muted">${h(when(r.dep_at))}</span><span class="v ${vcls(r.verdict)}">${h(r.verdict || "")}</span><span class="rv-chip ${h(r.status)}">${h(LBL[r.status] || r.status)}</span></div>
      ${(r.reasons || []).length ? `<div class="small">${(r.reasons || []).slice(0, 3).map(h).join("<br>")}</div>` : ""}
      ${r.review_note ? `<div class="rv-note">${h(r.review_note)}</div>` : ""}
      ${act ? `<textarea placeholder="Comment for the student (optional)" maxlength="1000"></textarea><div class="rv-act"><button type="button" class="btn sm" data-rv="approved">Approve</button><button type="button" class="btn sec sm" data-rv="returned">Return for changes</button></div>` : `<div class="small muted">${h(LBL[r.status])} ${h(when(r.reviewed_at))}</div>`}</div>`;
    sec.innerHTML = `<h2>Plans to review</h2>
      ${waiting.length ? waiting.map((r) => item(r, true)).join("") : `<p class="muted" style="margin:0">Nothing waiting. Briefs students share show up here for you to approve or return.</p>`}
      ${done.length ? `<h3 style="margin:14px 0 0">Recently reviewed</h3>${done.map((r) => item(r, false)).join("")}` : ""}
      <p class="small muted" style="margin:10px 0 0">Approval is your review of the student's planning in AeroSignal. It does not replace your authorization of the flight.</p>`;
    page.querySelector("section.panel").before(sec);
    sec.querySelectorAll("[data-rv]").forEach((b) => (b.onclick = async () => {
      const it = b.closest(".rv-item"), note = it.querySelector("textarea").value.trim();
      if (b.dataset.rv === "returned" && !note) { toast("Add a comment so the student knows what to change"); it.querySelector("textarea").focus(); return; }
      it.querySelectorAll("button").forEach((x) => (x.disabled = true));
      try {
        await api("rpc/review_share", { method: "POST", body: JSON.stringify({ p_share: +it.dataset.id, p_status: b.dataset.rv, p_note: note || null }) });
        toast(b.dataset.rv === "approved" ? "Approved" : "Returned to the student");
        sec.remove(); page.dataset.p165 = ""; dashboard();
      } catch (e) { toast(e.message); it.querySelectorAll("button").forEach((x) => (x.disabled = false)); }
    }));
  }

  /* ---------- 2. Student's brief ---------- */
  let briefFor = "";
  async function brief() {
    if (!/^#\/brief/.test(location.hash || "")) return;
    const box = document.getElementById("scShare");
    if (!box || !uid()) return;
    let f = null; try { f = currentFlight(); } catch {}
    if (!f) return;
    const key = `${f.id}|${box.dataset.f}|${(S.schoolShared || {})[f.id] || ""}`;
    if (box.querySelector(".rv-st") && briefFor === key) return;
    briefFor = key;
    let rows = [];
    try { rows = (await api(`school_shares?select=status,review_note,reviewed_at,school_id,schools(name)&user_id=eq.${uid()}&flight_id=eq.${encodeURIComponent(f.id)}`)) || []; } catch { return; }
    if (!document.body.contains(box)) return;
    let el = box.querySelector(".rv-st"); if (!el) { el = document.createElement("div"); el.className = "rv-st"; box.appendChild(el); }
    el.innerHTML = rows.map((r) => `<div style="margin-top:8px"><span class="rv-chip ${h(r.status)}">${h(LBL[r.status] || r.status)}</span>${rows.length > 1 ? ` <span class="small muted">${h((r.schools || {}).name || "")}</span>` : ""}${r.reviewed_at ? ` <span class="small muted">${h(when(r.reviewed_at))}</span>` : ""}${r.review_note ? `<div class="rv-note">${h(r.review_note)}</div>` : ""}</div>`).join("")
      + (rows.some((r) => r.status === "approved") ? `<p class="small muted" style="margin:6px 0 0">If you change the plan and share it again, it goes back to your instructor for review.</p>` : "");
  }

  /* ---------- 3. Account list ---------- */
  async function account() {
    if (!/^#\/account\/?$/.test(location.hash || "") || !uid()) return;
    const sc = document.getElementById("scPanel");
    if (!sc || document.getElementById("rvMine")) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "rvMine"; sc.after(sec);
    let rows = [];
    try { rows = (await api(`school_shares?select=flight_id,route,dep_at,status,review_note,reviewed_at&user_id=eq.${uid()}&order=created_at.desc&limit=20`)) || []; } catch { sec.remove(); return; }
    if (!rows.length) { sec.remove(); return; }
    sec.innerHTML = `<h2>Instructor reviews</h2>${rows.map((r) => `<div style="border-top:1px solid var(--line2);padding:8px 0"><div style="display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center"><b>${h(r.route || "")}</b><span class="small muted">${h(when(r.dep_at))}</span><span class="rv-chip ${h(r.status)}">${h(LBL[r.status] || r.status)}</span>${(S.flights || []).some((x) => x.id === r.flight_id) ? `<a class="small" href="#/brief" data-open="${h(r.flight_id)}">Open</a>` : ""}</div>${r.review_note ? `<div class="rv-note">${h(r.review_note)}</div>` : ""}</div>`).join("")}`;
    sec.querySelectorAll("[data-open]").forEach((a) => (a.onclick = () => { S.currentId = a.dataset.open; save(); }));
  }

  /* ---------- Privacy page ---------- */
  function privacy() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const v = document.getElementById("view"), a = v && (v.querySelector("#pvSchool2") || v.querySelector("#pvSchool"));
    if (!a || v.querySelector("#pvReview")) return;
    const p = document.createElement("p"); p.id = "pvReview"; p.textContent = PRIV; a.after(p);
    const w = document.createTreeWalker(v, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (/Last updated (October (6|20|21|22|28)), 2026/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/October (6|20|21|22|28), 2026/, "November 2, 2026");
  }

  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => {
    if (!on()) return;
    for (const fn of [dashboard, brief, account, privacy]) { try { const r = fn(); if (r && r.catch) r.catch((e) => console.error(e)); } catch (e) { console.error(e); } }
  }, 450); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  kick();
  window.AeroReview = { on, LIVE };
})();
