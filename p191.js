"use strict";
/* p191: "Your feedback" (November 8, 2026, approved with the feedback.client_token and feedback.reply columns and
   the my_feedback function). Testers leave feedback without an email, so they never heard back.
   1. Sending feedback now also sends a random id made on this device and keeps it here. Only a device holding
      that id can look the feedback up; nothing else about the tester is stored.
   2. More has a Your feedback section: each item this device sent, its status, and the reply when there is one.
   3. When a reply or a status change arrives, a small card on the Plan page says so once.
   4. The admin inbox gets a Reply to tester box per item, saved to feedback.reply (admin_note stays internal). */
(function () {
  const KEY = "vg_fb_tokens", SEEN = "vg_fb_seen";
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LABEL = { NEW: "Received", REVIEWING: "Being looked at", PLANNED: "Planned", DONE: "Done", CLOSED: "Closed" };
  const css = document.createElement("style");
  css.textContent = `
    #yfSec .yf{border-top:1px solid var(--line2,rgba(255,255,255,.1));padding:8px 0}
    #yfSec .yf:first-of-type{border-top:0}
    #yfSec .yf .st{font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:2px 8px;border-radius:10px;border:1px solid currentColor;margin-right:6px}
    #yfSec .yf .yf-msg{font-size:13.5px;opacity:.85;margin:4px 0}
    #yfSec .yf .yf-rep{font-size:14px;margin:4px 0 0;padding:8px 10px;border-left:3px solid currentColor;background:rgba(127,127,127,.08)}
    #yfNote{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:14px;padding:10px 14px;margin:0 0 14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .fbitem .fbrep{margin-top:8px}.fbitem .fbrep textarea{width:100%;min-height:54px;box-sizing:border-box}`;
  document.head.appendChild(css);

  const tokens = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

  // 1. Tag new feedback with this device's id
  if (typeof restFetch === "function") {
    const orig = restFetch;
    const tagged = async function (path, opts) {
      const o = opts || {};
      if (path === "feedback" && String(o.method || "GET").toUpperCase() === "POST" && o.body && typeof o.body === "object" && !o.body.client_token) {
        const t = uuid();
        const res = await orig(path, { ...o, body: { ...o.body, client_token: t } });
        try { const list = tokens(); list.unshift(t); localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50))); } catch (e) {}
        setTimeout(thanks, 50);
        return res;
      }
      return orig(path, o);
    };
    try { window.restFetch = tagged; } catch (e) {}
    try { restFetch = tagged; } catch (e) {}
  }
  function thanks() {
    const ok = document.querySelector("#fbf .ok");
    if (ok && !ok.querySelector("[data-yf]")) ok.querySelector("p")?.insertAdjacentHTML("afterend", `<p data-yf class="small">You can check its status and any reply under More, Your feedback.</p>`);
  }

  // 2. Your feedback on More
  let cache = null, at = 0;
  async function load(force) {
    const t = tokens(); if (!t.length) return [];
    if (!force && cache && Date.now() - at < 60000) return cache;
    const rows = await rpc("my_feedback", { tokens: t });
    cache = Array.isArray(rows) ? rows : []; at = Date.now();
    return cache;
  }
  const stamp = (r) => `${r.id}:${r.status}:${r.reply ? r.reply.length : 0}`;
  function seen() { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || "[]")); } catch (e) { return new Set(); } }
  function markSeen(rows) { try { localStorage.setItem(SEEN, JSON.stringify(rows.map(stamp))); } catch (e) {} }
  function item(r) {
    const d = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `<div class="yf"><span class="st">${h(LABEL[r.status] || r.status)}</span><span class="small muted">${h(d)}</span>
      <p class="yf-msg">${h(r.message)}${r.message && r.message.length >= 240 ? "…" : ""}</p>
      ${r.reply ? `<p class="yf-rep"><b>Reply:</b> ${h(r.reply)}</p>` : ""}</div>`;
  }
  async function moreSection(page) {
    if (!tokens().length || page.querySelector("#yfSec")) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "yfSec";
    sec.innerHTML = `<h2>Your feedback</h2><p class="muted" style="margin:0">Loading…</p>`;
    const anchor = page.querySelector("[data-wn]") || page.querySelector("h1");
    if (anchor) anchor.after(sec); else page.prepend(sec);
    try {
      const rows = await load(true);
      sec.innerHTML = `<h2>Your feedback</h2>${rows.length ? rows.map(item).join("") : `<p class="muted" style="margin:0">Nothing yet.</p>`}
        <p class="small muted" style="margin:8px 0 0">Feedback sent from this device. <a href="#/feedback">Send more</a></p>`;
      markSeen(rows);
      // The panel system folds panels by default; open this one, and bring it into view when the pilot came from the note
      setTimeout(() => {
        try { if (window.AeroPanels) AeroPanels.setMin(sec, false, true); } catch (e) {}
        // More groups its sections into folded rows (p103); open ours the same way a tap would
        try { if (sec.classList.contains("mg-col") && !sec.classList.contains("mg-open")) sec.querySelector(":scope > h2").click(); } catch (e) {}
        let go = false; try { go = sessionStorage.getItem("vg_fb_go") === "1"; sessionStorage.removeItem("vg_fb_go"); } catch (e) {}
        if (go || rows.some((r) => r.reply)) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 700);
    } catch (e) { sec.innerHTML = `<h2>Your feedback</h2><p class="muted" style="margin:0">Could not load right now.</p>`; }
  }
  // 3. One time note on Plan when something changed
  let noted = false;
  async function planNote(page) {
    if (noted || !tokens().length || page.querySelector("#yfNote")) return;
    noted = true;
    try {
      const rows = await load(false), s = seen();
      const fresh = rows.filter((r) => !s.has(stamp(r)) && (r.reply || r.status !== "NEW"));
      if (!fresh.length || !page.isConnected) return;
      const n = document.createElement("div"); n.id = "yfNote";
      n.innerHTML = `<span><b>${fresh.some((r) => r.reply) ? "You have a reply to your feedback." : "Your feedback has an update."}</b></span><span style="display:flex;gap:8px"><a class="btn sm" href="#/more">See it</a><button type="button" class="btn sec sm">Dismiss</button></span>`;
      n.querySelector("button").onclick = () => { markSeen(rows); n.remove(); };
      n.querySelector("a").addEventListener("click", () => { try { sessionStorage.setItem("vg_fb_go", "1"); } catch (e) {} });
      const h1 = page.querySelector("h1"); if (h1) h1.before(n); else page.prepend(n);
    } catch (e) {}
  }
  // 4. Admin inbox: reply to tester
  function inbox() {
    document.querySelectorAll(".fbinbox .fbitem[data-id]").forEach((it) => {
      if (it.querySelector(".fbrep")) return;
      const id = it.dataset.id;
      const box = document.createElement("div"); box.className = "fbrep";
      box.innerHTML = `<label class="small muted">Reply to tester (shown in their app if they sent it after November 8)</label><textarea maxlength="1000"></textarea><button type="button" class="btn sec sm">Save reply</button> <span class="small muted" data-s></span>`;
      it.appendChild(box);
      const ta = box.querySelector("textarea"), s = box.querySelector("[data-s]");
      restFetch(`feedback?select=reply,client_token&id=eq.${encodeURIComponent(id)}`).then((r) => { const x = r && r[0]; if (x) { ta.value = x.reply || ""; if (!x.client_token) s.textContent = "Sent before replies existed: the tester will not see this."; } }).catch(() => {});
      box.querySelector("button").onclick = async () => {
        try { await restFetch(`feedback?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", prefer: "return=minimal", body: { reply: ta.value.trim() || null, updated_at: new Date().toISOString() } }); s.textContent = "Saved"; }
        catch (e) { s.textContent = "Could not save: " + e.message; }
      };
    });
  }
  function scan() {
    const hash = location.hash || "#/", page = document.querySelector("#view .page");
    if (!page) return;
    if (/^#\/more/.test(hash)) moreSection(page);
    if (/^#\/(plan)?$/.test(hash)) planNote(page);
    if (/^#\/feedback\/inbox/.test(hash)) inbox();
    if (/^#\/feedback/.test(hash)) thanks();
  }
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { try { scan(); } catch (e) { console.error(e); } }, 400); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroYourFeedback = { tokens, load };
})();
