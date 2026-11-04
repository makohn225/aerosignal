"use strict";
/* p170: move a pilot's data from the old link (aerosignal-app.vercel.app) to the new one (flyvigilyn.vercel.app).
   Browsers keep each address's data separately, so the old link shows a short note with a Move my data button.
   The button opens the new link, the two pages confirm each other's exact address, and the data on this device is
   handed over window to window (never through a server or a URL). The pilot confirms on the new link before anything
   is written there. Offline chart areas and automatic backups stay on the old link and rebuild on the new one. */
(function () {
  const OLD = window.__vgOld || "https://aerosignal-app.vercel.app";
  const NEW = window.__vgNew || "https://flyvigilyn.vercel.app";
  const here = location.origin;
  const h = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #vgMove{position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:2500;max-width:560px;margin:0 auto;
      background:var(--glass3,#0B1626);border:1px solid var(--line-hi,#3DE0FF66);border-radius:14px;padding:12px 14px;color:var(--ink,#EAF2FF);
      box-shadow:0 10px 30px rgba(0,0,0,.45);font-size:14px;line-height:1.45}
    #vgMove b{color:#fff}#vgMove .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    #vgMove button,#vgMove a.btn{min-height:40px}
    #vgMove .x{position:absolute;top:6px;right:8px;background:none;border:0;color:inherit;font-size:20px;min-height:0;cursor:pointer}
    @media (min-width:900px){#vgMove{bottom:20px}}
    .vgmv .panel p{margin:0 0 10px}`;
  document.head.appendChild(css);

  function snapshot() {
    const d = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k != null) d[k] = localStorage.getItem(k); }
    return d;
  }

  /* ---------- Old link: offer the move ---------- */
  if (here === OLD) {
    let shown = false;
    try { shown = sessionStorage.getItem("vg_move_hide") === "1"; } catch (e) {}
    const banner = () => {
      if (shown || document.getElementById("vgMove")) return;
      const b = document.createElement("div");
      b.id = "vgMove"; b.setAttribute("role", "region"); b.setAttribute("aria-label", "New address");
      b.innerHTML = `<button class="x" type="button" aria-label="Close">&times;</button>
        <div><b>We have a new name and a new link: Vigilyn.</b> Your flights, logbook and settings are saved on this device under this old link.
        Move them to <b>flyvigilyn.vercel.app</b> in one tap, then use the new link from now on.</div>
        <div class="row"><button class="btn mag" type="button" id="vgGo">Move my data</button><a class="btn sec" href="${NEW}/" id="vgOpen">Open the new link</a></div>
        <div class="small" id="vgMsg" style="margin-top:8px" hidden></div>`;
      document.body.appendChild(b);
      b.querySelector(".x").onclick = () => { b.remove(); shown = true; try { sessionStorage.setItem("vg_move_hide", "1"); } catch (e) {} };
      const msg = (t) => { const m = b.querySelector("#vgMsg"); m.hidden = !t; m.textContent = t; };
      b.querySelector("#vgGo").onclick = () => {
        const w = window.open(`${NEW}/#/move`, "_blank");
        if (!w) { msg("Your browser blocked the new tab. Allow pop ups for this site, then tap Move my data again."); return; }
        msg("Opening the new link. Confirm the move there.");
        const onMsg = (e) => {
          if (e.origin !== NEW || e.source !== w || !e.data || typeof e.data !== "object") return;
          if (e.data.t === "vg-ready") w.postMessage({ t: "vg-data", data: snapshot(), at: Date.now() }, NEW);
          else if (e.data.t === "vg-done") { msg(`Moved ${Number(e.data.n) || 0} saved items. Use flyvigilyn.vercel.app from now on. Your data is still here too, so nothing is lost.`); window.removeEventListener("message", onMsg); }
          else if (e.data.t === "vg-cancel") { msg("The move was cancelled. Nothing changed on either link."); window.removeEventListener("message", onMsg); }
        };
        window.addEventListener("message", onMsg);
      };
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner); else banner();
    return;
  }

  /* ---------- New link: receive the move ---------- */
  if (typeof ROUTES === "undefined") return;
  ROUTES.move = function (el) {
    el.innerHTML = `<div class="page vgmv"><h1>Move your data</h1><section class="panel" id="vgBox"><p>Waiting for the old link…</p></section></div>`;
    const box = el.querySelector("#vgBox");
    const op = window.opener;
    if (!op) {
      box.innerHTML = `<p>To bring your flights and logbook over, open your old link, <b>aerosignal-app.vercel.app</b>, on this same device and browser, and tap <b>Move my data</b>.</p>
        <p class="small muted">Nothing on this device has changed.</p><a class="btn" href="#/plan">Go to Vigilyn</a>`;
      return;
    }
    let got = false;
    const onMsg = (e) => {
      if (e.origin !== OLD || e.source !== op || !e.data || e.data.t !== "vg-data" || got) return;
      got = true;
      const data = e.data.data && typeof e.data.data === "object" ? e.data.data : {};
      const keys = Object.keys(data).filter((k) => typeof data[k] === "string");
      const mine = snapshot();
      let hasMine = false;
      try { const st = JSON.parse(mine["aerosignal.v1"] || "{}"); hasMine = ((st.flights || []).length + ((st.logbook || {}).flights || []).length + (st.missions || []).length) > 0; } catch (e2) {}
      if (!keys.length) { box.innerHTML = `<p>The old link has no saved data on this device, so there is nothing to move.</p><a class="btn" href="#/plan">Go to Vigilyn</a>`; op.postMessage({ t: "vg-done", n: 0 }, OLD); return; }
      box.innerHTML = `<p>Found <b>${keys.length}</b> saved items from the old link on this device: your flights, logbook, missions, settings and sign in.</p>
        ${hasMine ? `<p><b>This link already has data on this device.</b> Moving replaces it with the data from the old link.</p>` : ""}
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn mag" type="button" id="vgYes">Move my data here</button><button class="btn sec" type="button" id="vgNo">Cancel</button></div>
        <p class="small muted" style="margin-top:10px">The old link keeps its copy, so nothing is lost either way.</p>`;
      box.querySelector("#vgNo").onclick = () => { op.postMessage({ t: "vg-cancel" }, OLD); box.innerHTML = `<p>Cancelled. Nothing changed.</p><a class="btn" href="#/plan">Go to Vigilyn</a>`; };
      box.querySelector("#vgYes").onclick = () => {
        let n = 0;
        try { window.save = function () {}; } catch (e3) {} // keep this page's older copy from being written back before the reload
        try {
          for (const k of Object.keys(mine)) localStorage.removeItem(k);
          for (const k of keys) { localStorage.setItem(k, data[k]); n++; }
        } catch (err) {
          for (const k of Object.keys(mine)) { try { localStorage.setItem(k, mine[k]); } catch (e2) {} }
          box.innerHTML = `<p>The move could not finish because this browser's storage is full. Nothing was changed here.</p>`;
          return;
        }
        op.postMessage({ t: "vg-done", n }, OLD);
        box.innerHTML = `<p><b>Done.</b> Moved ${n} saved items. Opening Vigilyn…</p>`;
        setTimeout(() => { location.replace("/#/plan"); location.reload(); }, 400);
      };
    };
    window.addEventListener("message", onMsg);
    try { op.postMessage({ t: "vg-ready" }, OLD); } catch (e) {}
    setTimeout(() => { if (!got) box.innerHTML = `<p>The old link did not answer. Go back to the old link's tab and tap <b>Move my data</b> again.</p><p class="small muted">Nothing on this device has changed.</p>`; }, 8000);
  };
  window.AeroMove = { OLD, NEW };
})();
