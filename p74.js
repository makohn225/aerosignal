"use strict";
/* p74: account sync, off until the pilot turns it on.
   With sync on and signed in, the pilot's flights (with their checklists, weight and fuel and load
   computations), aircraft numbers and imported logbook are saved to their own row in
   public.user_sync, so they appear on any device where they sign in. Missions, objective area files
   and sample data never sync. Each account can only read and write its own row (row level
   security). Changes merge both ways: the newer copy of each flight wins, a flight deleted on one
   device is deleted on the others, and aircraft numbers and the logbook take whichever side changed
   since the last sync. The switch, last sync time, Sync now and Delete my synced copy live on the
   Account page. */
(function () {
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #syncPanel .sy-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 4px}
    #syncPanel .sy-st{font-size:13.5px;color:var(--ink2,#9fb0c8);margin:8px 0 0}
    #syncPanel .sy-st b{color:#46e39b}
    #syncPanel .sy-st .err{color:#ffb648}
    #syncPanel .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:10px 0 0}
    #syncPanel ul{margin:6px 0 4px 18px;padding:0;font-size:14px;line-height:1.55}
  `;
  document.head.appendChild(css);

  const cfg = () => (S.syncCfg = S.syncCfg || { on: false, at: null, known: [], del: {}, snap: {} });
  const authed = () => { try { return typeof AUTH !== "undefined" && AUTH && AUTH.user && AUTH.user.id ? AUTH : null; } catch { return null; } };
  const fnv = (s) => { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(16); };
  const hash = (o) => (o == null ? "" : fnv(JSON.stringify(o)));
  const demoLog = () => !S.logbook || /^Demo /.test(S.logbook.source || "") || !(S.logbook.flights || []).length;
  const syncable = (f) => f && !f.demo && !f.missionId && ((f.points || []).length || (f.route || "").trim());

  function payload() {
    const c = cfg();
    return {
      v: 1,
      flights: (S.flights || []).filter(syncable),
      profiles: S.profiles || {},
      logbook: demoLog() ? null : S.logbook,
      del: c.del || {},
    };
  }

  // Merge the account copy into this device. Returns true when anything here changed.
  function merge(R) {
    if (!R || typeof R !== "object") return false;
    const c = cfg();
    let changed = false;
    // Deletions made on other devices
    const del = { ...(c.del || {}) };
    for (const [id, ts] of Object.entries(R.del || {})) if (!del[id] || del[id] < ts) del[id] = ts;
    const cut = Date.now() - 90 * 864e5;
    for (const [id, ts] of Object.entries(del)) if (ts < cut) delete del[id];
    c.del = del;
    S.flights = S.flights || [];
    const before = S.flights.length;
    S.flights = S.flights.filter((f) => !(del[f.id] && (f.updated || 0) <= del[f.id]));
    if (S.flights.length !== before) changed = true;
    // Flights: the newer copy wins
    for (const r of R.flights || []) {
      if (!r || !r.id || (del[r.id] && (r.updated || 0) <= del[r.id])) continue;
      const i = S.flights.findIndex((f) => f.id === r.id);
      if (i < 0) { S.flights.push(r); changed = true; }
      else if ((r.updated || 0) > (S.flights[i].updated || 0)) { S.flights[i] = r; changed = true; }
    }
    if (S.currentId && !S.flights.some((f) => f.id === S.currentId)) S.currentId = (S.flights[0] || {}).id || null;
    // Aircraft numbers and the logbook: take the side that changed since the last sync
    const snap = c.snap || {};
    const sp = snap.p || {};
    S.profiles = S.profiles || {};
    for (const tail of new Set([...Object.keys(S.profiles), ...Object.keys(R.profiles || {})])) {
      const L = S.profiles[tail], Rm = (R.profiles || {})[tail];
      if (Rm == null) continue;
      if (L == null) { S.profiles[tail] = Rm; changed = true; continue; }
      const lh = hash(L), rh = hash(Rm);
      if (lh !== rh && lh === sp[tail]) { S.profiles[tail] = Rm; changed = true; }
    }
    if (R.logbook && (R.logbook.flights || []).length) {
      const lh = demoLog() ? "" : hash(S.logbook), rh = hash(R.logbook);
      // First sync on this device: keep the larger logbook rather than overwrite either side
      const first = !snap.lb && !demoLog() && (R.logbook.flights || []).length > (S.logbook.flights || []).length;
      if (lh !== rh && (demoLog() || lh === snap.lb || first)) { S.logbook = R.logbook; changed = true; }
    }
    return changed;
  }

  function remember() {
    const c = cfg();
    c.known = (S.flights || []).filter(syncable).map((f) => f.id);
    const p = {};
    for (const [k, v] of Object.entries(S.profiles || {})) p[k] = hash(v);
    c.snap = { p, lb: demoLog() ? "" : hash(S.logbook) };
  }

  // Flights that were synced before and are gone now were deleted on this device
  function noteDeletes() {
    const c = cfg();
    const now = new Set((S.flights || []).map((f) => f.id));
    for (const id of c.known || []) if (!now.has(id)) c.del[id] = Date.now();
  }

  let status = "", running = null, again = false;
  const url = () => `${SUPA.url}/rest/v1/user_sync`;
  async function syncNow(manual) {
    if (running) { again = true; return running; }
    running = (async () => {
      const A = authed(), c = cfg();
      if (!A || !c.on) return;
      if (!navigator.onLine) { status = "Waiting for a connection."; paint(); return; }
      try {
        const tok = await validToken();
        if (!tok) { status = "Sign in again to keep syncing."; paint(); return; }
        noteDeletes();
        const r = await fetch(`${url()}?select=data,updated_at&user_id=eq.${encodeURIComponent(A.user.id)}`, { headers: authHdr(tok) });
        if (!r.ok) throw new Error(`read ${r.status}`);
        const rows = await r.json();
        const changed = rows[0] ? merge(rows[0].data) : false;
        const w = await fetch(`${url()}?on_conflict=user_id`, {
          method: "POST",
          headers: { ...authHdr(tok), Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ user_id: A.user.id, data: payload() }),
        });
        if (!w.ok) throw new Error(`write ${w.status}`);
        remember();
        c.at = Date.now();
        status = "";
        baseSave();
        if (changed) { try { go(); } catch {} }
        if (manual) { try { toast(changed ? "Synced. Changes from your other devices are in." : "Synced"); } catch {} }
      } catch (e) {
        console.error(e);
        status = "Could not sync just now. It will try again.";
      } finally { paint(); }
    })();
    try { await running; } finally {
      running = null;
      if (again) { again = false; setTimeout(() => syncNow(), 500); }
    }
  }

  // Every save on this device schedules a sync a few seconds later
  const baseSave = save;
  let tm = 0;
  save = function () {
    const r = baseSave.apply(this, arguments);
    try { if (cfg().on && authed()) { clearTimeout(tm); tm = setTimeout(() => syncNow(), 4000); } } catch {}
    return r;
  };

  async function deleteCopy() {
    const A = authed();
    if (!A) return;
    if (!confirm("Delete the copy of your flights, aircraft numbers and logbook saved to your account? Everything on this device stays.")) return;
    try {
      const tok = await validToken();
      const r = await fetch(`${url()}?user_id=eq.${encodeURIComponent(A.user.id)}`, { method: "DELETE", headers: authHdr(tok) });
      if (!r.ok) throw new Error(String(r.status));
      const c = cfg(); c.on = false; c.at = null; c.known = []; c.snap = {}; c.del = {};
      baseSave();
      try { toast("Synced copy deleted. Sync is off."); } catch {}
    } catch { try { toast("Could not delete the synced copy right now"); } catch {} }
    paint();
  }

  function when(t) { try { return new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; } }
  function paint() {
    const sec = document.getElementById("syncPanel");
    if (!sec) return;
    const c = cfg(), A = authed();
    const n = (S.flights || []).filter(syncable).length;
    sec.innerHTML = `<h2>Sync across your devices</h2>
      <p class="small" style="margin:0">${c.on ? "Sync is on." : "Sync is off. Everything stays in this browser on this device."} When it is on, these are saved to your AeroSignal account and appear on any phone, tablet or computer where you sign in:</p>
      <ul><li>Your flights, with their checklists, weight and fuel and load computations${n ? ` (${n} now)` : ""}</li><li>Aircraft numbers</li><li>Your imported logbook</li></ul>
      <p class="small muted" style="margin:0">Missions, objective area files and sample data never leave this device.</p>
      <div class="sy-row">${c.on
        ? `<button type="button" class="btn sm" data-s="now">Sync now</button><button type="button" class="btn sec sm" data-s="off">Turn off sync</button>`
        : `<button type="button" class="btn sm" data-s="on"${A ? "" : " disabled"}>Turn on sync</button>`}
        <button type="button" class="btn sec sm" data-s="del"${A ? "" : " disabled"}>Delete my synced copy</button></div>
      <p class="sy-st">${!A ? "Sign in to use sync." : c.on ? (status ? `<span class="err">${h(status)}</span>` : c.at ? `<b>Synced</b> ${h(when(c.at))}.` : "Syncing…") : c.at ? `Last synced ${h(when(c.at))}. Your account copy stays until you delete it.` : ""}</p>
      <p class="disc">Do not enter CUI or classified information. Synced data is stored with your account so you can use it on your other devices.</p>`;
    sec.querySelectorAll("button[data-s]").forEach((b) => (b.onclick = () => {
      const k = b.dataset.s, c2 = cfg();
      if (k === "on") { c2.on = true; baseSave(); paint(); syncNow(true); }
      else if (k === "off") { c2.on = false; baseSave(); paint(); try { toast("Sync is off. Nothing more is sent from this device."); } catch {} }
      else if (k === "now") syncNow(true);
      else if (k === "del") deleteCopy();
    }));
  }
  function panel() {
    if (!/^#\/account\/?$/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page") || document.getElementById("view");
    if (!page || document.getElementById("syncPanel") || !authed()) return;
    const sec = document.createElement("section");
    sec.className = "panel"; sec.id = "syncPanel";
    const first = page.querySelector("section.panel");
    if (first) first.after(sec); else page.appendChild(sec);
    paint();
  }

  // Keep the logbook help honest when sync is on
  function notes() {
    if (!cfg().on) return;
    for (const p of document.querySelectorAll("#lbHow .nt")) if (/never uploaded/.test(p.textContent)) p.textContent = "With account sync on, your logbook is also saved to your account so it appears on your other devices.";
  }

  let t = 0, lastUser = null;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { panel(); notes(); } catch (e) { console.error(e); } }, 150); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(); });
  window.addEventListener("online", () => syncNow());
  // Sign in, sign out or a different account on this device
  setInterval(() => {
    const A = authed(), id = A ? A.user.id : null;
    if (id === lastUser) return;
    const prev = lastUser;
    lastUser = id;
    const c = cfg();
    if (prev && id && prev !== id) { c.on = false; c.at = null; c.known = []; c.snap = {}; c.del = {}; baseSave(); }
    if (id) syncNow();
    paint();
  }, 3000);
  setTimeout(() => { lastUser = (authed() || { user: {} }).user.id || null; syncNow(); }, 1500);
  kick();
  window.AeroSync = { syncNow, merge, payload, cfg };
})();
