"use strict";
/* p260: shared airport comments (November 13, 2026). Approved by the owner with the airport_comments table
   (migration 20261113_airport_comments.sql). A signed in pilot writes a short comment about an airport, such as
   FBO service, the ramp, local procedures or things to know. Every comment waits for admin review in the feedback
   inbox before anyone else sees it, and approved comments show without names. A pilot sees their own comments with
   their review status and can delete them at any time.
   Where it shows: a "Pilot comments" section on the airport page, a #acPanel in the brief (after #ltPanel, only when
   a route airport has approved comments) and a review queue on #/feedback/inbox for admins.
   The owner approved the privacy sentence (PRIV) on November 13, 2026, and COMMENTS_LIVE is on. */
(function () {
  const COMMENTS_LIVE = true;
  const PRIV = "If you post an airport comment, we store the airport, your comment and the time, linked to your account. A comment is shown to other pilots without your name only after we review it, and you can delete your own comments at any time.";
  const h = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const day = (t) => { try { return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; } };
  const signedIn = () => typeof AUTH !== "undefined" && AUTH && AUTH.user;
  const norm = (a) => String(a || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  async function call(name, body, needAuth) {
    const tok = typeof validToken === "function" ? await validToken() : null;
    if (needAuth && !tok) throw new Error("Sign in first.");
    const r = await fetch(`${SUPA.url}/rest/v1/rpc/${name}`, { method: "POST", headers: { ...authHdr(tok || null), Authorization: `Bearer ${tok || SUPA.key}`, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((j && (j.message || j.hint)) || "That did not work. Try again.");
    return j;
  }
  const approved = (a) => call("airport_comments_for", { a }).catch(() => []);
  const mine = (a) => (signedIn() ? call("my_airport_comments", { a }, true).catch(() => []) : Promise.resolve([]));
  const STATUS = { pending: "Waiting for review", approved: "Shown to other pilots", rejected: "Not approved" };

  /* 1. Airport page */
  async function paintAirport(sec, id) {
    const body = sec.querySelector(".ap-body");
    const [list, own] = await Promise.all([approved(id), mine(id)]);
    if (!sec.isConnected) return;
    const ownList = own.length ? `<div class="ac-mine"><p class="small" style="margin:12px 0 6px"><b>Your comments here</b></p>${own.map((c) => `<div class="ac-item"><p class="ac-b">${h(c.body)}</p><p class="small muted ac-m">${h(day(c.created_at))} · <span class="${c.status === "approved" ? "ok" : c.status === "rejected" ? "warn" : ""}">${STATUS[c.status] || h(c.status)}</span> · <a href="#" data-del="${c.id}">Delete</a></p></div>`).join("")}</div>` : "";
    body.innerHTML = `${list.length ? list.map((c) => `<div class="ac-item"><p class="ac-b">${h(c.body)}</p><p class="small muted ac-m">A Vigilyn pilot, ${h(day(c.created_at))}</p></div>`).join("") : `<p class="small muted" style="margin:0">No comments yet for ${h(id)}.</p>`}
      ${ownList}
      ${signedIn() ? `<form class="ac-f" novalidate><label for="acTxt" class="small" style="display:block;margin:14px 0 4px">Add a comment about ${h(id)}</label>
        <textarea id="acTxt" rows="3" maxlength="500" placeholder="FBO service, ramp, fuel, local procedures, things a visiting pilot should know"></textarea>
        <div class="small muted"><span class="ac-n">0</span> of 500 characters</div>
        <p class="small muted" style="margin:8px 0 0">Comments are reviewed before other pilots see them, and they show without your name. Don't include classified or controlled information, or details about a person.</p>
        <p class="small ac-msg" hidden></p>
        <button class="btn sm" type="submit" style="margin-top:8px">Post comment</button></form>`
      : `<p class="small" style="margin:12px 0 0"><a href="#/account" class="ac-in">Sign in</a> to add a comment.</p>`}
      <p class="small muted" style="margin:10px 0 0">Pilot comments are opinions from other pilots, not verified, and never replace the Chart Supplement or NOTAMs.</p>`;
    const inLink = body.querySelector(".ac-in");
    if (inLink) inLink.onclick = () => { try { sessionStorage.setItem("aerosignal.after", location.hash); } catch (e) {} };
    body.querySelectorAll("[data-del]").forEach((a) => a.onclick = async (e) => {
      e.preventDefault(); a.textContent = "Deleting…";
      try { await call("delete_my_airport_comment", { cid: +a.dataset.del }, true); toast("Comment deleted"); paintAirport(sec, id); } catch (err) { toast(err.message); a.textContent = "Delete"; }
    });
    const f = body.querySelector(".ac-f");
    if (f) {
      const ta = f.querySelector("textarea"), n = f.querySelector(".ac-n"), m = f.querySelector(".ac-msg"), b = f.querySelector("button");
      ta.oninput = () => { n.textContent = ta.value.length; };
      f.onsubmit = async (e) => {
        e.preventDefault(); const t = ta.value.trim();
        const say = (s, cls) => { m.textContent = s; m.className = `small ac-msg ${cls || ""}`; m.hidden = false; };
        if (t.length < 3) return say("Write a few words first.", "warn");
        b.disabled = true; b.textContent = "Posting…";
        try { await call("add_airport_comment", { a: id, body: t }, true); toast("Thanks. Your comment shows after review."); paintAirport(sec, id); }
        catch (err) { say(err.message, "warn"); b.disabled = false; b.textContent = "Post comment"; }
      };
    }
  }
  function airportPage() {
    const m = (location.hash || "").match(/^#\/airports\/([^/?#]+)/); if (!m) return;
    const id = norm(decodeURIComponent(m[1]));
    const view = document.getElementById("view"); if (!view || view.querySelector("#apComments")) return;
    const after = view.querySelector("#apPubs") || (document.getElementById("arw") && document.getElementById("arw").closest("section")); if (!after) return;
    const s = document.createElement("section"); s.className = "panel ap139"; s.id = "apComments";
    s.innerHTML = `<h2>Pilot comments</h2><div class="ap-body"><p class="small muted" style="margin:0">Loading comments</p></div>`;
    after.after(s); paintAirport(s, id);
  }

  /* 2. Brief: approved comments for the route airports, only when there are some */
  let briefKey = "";
  // Panels in the chain load at different times, so the panel moves to sit right after the last one present
  const CHAIN = ["#ltPanel", "#rpPanel", "#dpPanel", "#spPanel", "#wcPanel", "#rtPanel"];
  function place(page) {
    const s = page.querySelector(":scope > #acPanel"); if (!s) return;
    for (const sel of CHAIN) { const a = page.querySelector(`:scope > ${sel}`); if (a) { if (a.nextElementSibling !== s) a.after(s); return; } }
  }
  async function brief() {
    if (!/^#\/brief/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page"), f = typeof currentFlight === "function" && currentFlight();
    if (page) place(page);
    if (!page || !f || !(f.points || []).length || !page.querySelector("#bfJump")) return;
    const ids = [...new Set(f.points.filter((p) => p.kind === "airport").map((p) => norm(p.ident)))].slice(0, 6);
    const key = f.id + ids.join(",");
    if (page.querySelector("#acPanel") || briefKey === key + ":busy") return;
    briefKey = key + ":busy";
    const res = await Promise.all(ids.map(async (a) => [a, await approved(a)]));
    briefKey = key;
    const have = res.filter(([, l]) => l.length); if (!have.length || page.querySelector("#acPanel") || !page.isConnected) return;
    const s = document.createElement("section"); s.className = "panel"; s.id = "acPanel";
    s.innerHTML = `<h2>Pilot comments</h2>${have.map(([a, l]) => `<p style="margin:10px 0 4px"><b>${h(a)}</b> <a class="small" href="#/airports/${encodeURIComponent(a)}">All comments</a></p>${l.slice(0, 3).map((c) => `<div class="ac-item"><p class="ac-b">${h(c.body)}</p><p class="small muted ac-m">A Vigilyn pilot, ${h(day(c.created_at))}</p></div>`).join("")}`).join("")}<p class="small muted" style="margin:10px 0 0">Reviewed comments from other pilots, without names. Opinions only; confirm anything that matters in the Chart Supplement and NOTAMs.</p>`;
    page.appendChild(s); place(page);
    const jmp = page.querySelector("#bfJump");
    if (jmp && !jmp.querySelector('[data-s="#acPanel"]')) { const a = document.createElement("a"); a.href = "#"; a.dataset.s = "#acPanel"; a.textContent = "Pilot comments"; a.onclick = (e) => { e.preventDefault(); s.style.scrollMarginTop = "84px"; s.scrollIntoView({ block: "start", behavior: "smooth" }); }; jmp.appendChild(a); }
  }

  /* 3. Admin review queue on the feedback inbox */
  let inboxTried = false;
  async function inbox() {
    if (!/^#\/feedback\/inbox/.test(location.hash || "") || !signedIn() || inboxTried) return;
    const page = document.querySelector("#view .fbinbox"); if (!page || page.querySelector("#acQueue")) return;
    const s = document.createElement("section"); s.className = "panel"; s.id = "acQueue"; s.innerHTML = `<h2>Airport comments waiting for review</h2><div class="acq-b"><p class="small muted">Loading</p></div>`;
    const h1 = page.querySelector("h1"); if (h1) h1.after(s); else page.prepend(s);
    let rows;
    try { rows = await call("pending_airport_comments", {}, true); } catch (e) { s.remove(); return; }
    const b = s.querySelector(".acq-b");
    const paint = () => {
      b.innerHTML = rows.length ? rows.map((c) => `<div class="ac-item" data-id="${c.id}"><p class="ac-b">${h(c.body)}</p><p class="small muted ac-m"><a href="#/airports/${encodeURIComponent(c.airport)}">${h(c.airport)}</a> · ${h(day(c.created_at))}</p><div class="row" style="gap:8px;margin-top:6px"><button class="btn sm" data-ok="1">Approve</button><button class="btn sec sm" data-ok="0">Don't approve</button></div></div>`).join("") : `<p class="small muted" style="margin:0">Nothing waiting.</p>`;
      b.querySelectorAll("[data-ok]").forEach((btn) => btn.onclick = async () => {
        const it = btn.closest("[data-id]"), cid = +it.dataset.id; it.querySelectorAll("button").forEach((x) => x.disabled = true);
        try { await call("review_airport_comment", { cid, ok: btn.dataset.ok === "1" }, true); rows = rows.filter((r) => r.id !== cid); toast(btn.dataset.ok === "1" ? "Approved" : "Not approved"); paint(); }
        catch (e) { toast(e.message); it.querySelectorAll("button").forEach((x) => x.disabled = false); }
      });
    };
    paint();
  }

  /* 4. Privacy page sentence */
  function privacy() {
    if (!/^#\/privacy(\/|$|\?)/.test(location.hash || "")) return;
    const v = document.getElementById("view"), a = v && v.querySelector("#pvReports");
    if (!a || v.querySelector("#pvComments")) return;
    const p = document.createElement("p"); p.id = "pvComments"; p.textContent = PRIV; a.after(p);
  }

  const st = document.createElement("style");
  st.textContent = `.ac-item{padding:8px 0;border-top:1px solid var(--line,#2a3b55)}.ac-item:first-child{border-top:0}.ac-b{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.ac-m{margin:4px 0 0}.ac-f textarea{width:100%;box-sizing:border-box}`;
  document.head.appendChild(st);

  let t = 0;
  const run = () => { inbox(); if (!COMMENTS_LIVE) return; airportPage(); brief(); privacy(); };
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 400); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => { briefKey = ""; inboxTried = false; });
  window.AeroComments = { live: COMMENTS_LIVE, PRIV };
})();
