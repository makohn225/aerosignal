"use strict";
/* p111: aircraft checklists (p95) join account sync (p74). When sync is on, the pilot's checklists
   ride along in the same synced copy: the newer copy of each checklist wins, and a checklist
   deleted on one device is deleted on the others. No new storage: the checklists go in the same
   row as the flights. Inactive until the owner approves the matching privacy page wording; flip
   APPROVED to true together with that wording change. */
(function () {
  const APPROVED = false;
  if (!APPROVED) return;
  const st = () => (S.ckSync = S.ckSync || { known: [], del: {} });
  const list = () => (Array.isArray(S.checklists) ? S.checklists : (S.checklists = []));
  const isSync = (u) => typeof u === "string" && u.includes("/rest/v1/user_sync");

  function noteDeletes() {
    const c = st(), now = new Set(list().map((x) => x.id));
    for (const id of c.known || []) if (!now.has(id)) c.del[id] = Date.now();
    const cut = Date.now() - 90 * 864e5;
    for (const [id, ts] of Object.entries(c.del)) if (ts < cut) delete c.del[id];
  }
  function merge(R) {
    if (!R) return false;
    const c = st();
    let changed = false;
    for (const [id, ts] of Object.entries(R.ckDel || {})) if (!c.del[id] || c.del[id] < ts) c.del[id] = ts;
    const before = list().length;
    S.checklists = list().filter((x) => !(c.del[x.id] && (x.updated || 0) <= c.del[x.id]));
    if (S.checklists.length !== before) changed = true;
    for (const r of R.checklists || []) {
      if (!r || !r.id || !Array.isArray(r.sections) || (c.del[r.id] && (r.updated || 0) <= c.del[r.id])) continue;
      const i = S.checklists.findIndex((x) => x.id === r.id);
      if (i < 0) { S.checklists.push(r); changed = true; }
      else if ((r.updated || 0) > (S.checklists[i].updated || 0)) { S.checklists[i] = r; changed = true; }
    }
    return changed;
  }

  const F = window.fetch;
  window.fetch = async function (input, init) {
    const u = typeof input === "string" ? input : input && input.url;
    if (!isSync(u)) return F.apply(this, arguments);
    const m = ((init && init.method) || "GET").toUpperCase();
    if (m === "POST" && init && typeof init.body === "string") {
      try {
        const b = JSON.parse(init.body);
        if (b && b.data) {
          noteDeletes();
          b.data.checklists = list();
          b.data.ckDel = st().del;
          init = Object.assign({}, init, { body: JSON.stringify(b) });
          const r = await F.call(this, input, init);
          if (r.ok) st().known = list().map((x) => x.id);
          return r;
        }
      } catch (e) { console.error(e); }
      return F.call(this, input, init);
    }
    const r = await F.apply(this, arguments);
    if (m === "GET" && r.ok && /select=data/.test(u)) {
      try {
        const rows = await r.clone().json();
        if (rows && rows[0] && merge(rows[0].data) && /^#\/checklists/.test(location.hash || "")) setTimeout(() => { try { go(); } catch {} }, 0);
      } catch (e) { console.error(e); }
    }
    return r;
  };

  // The Account page list of what syncs
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => {
    const ul = document.querySelector("#syncPanel ul");
    if (ul && !ul.querySelector(".ck-sy")) { const li = document.createElement("li"); li.className = "ck-sy"; li.textContent = "Your aircraft checklists"; ul.appendChild(li); }
  }, 150); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  kick();
})();
