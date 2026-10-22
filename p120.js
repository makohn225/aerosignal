"use strict";
/* p120: the brief remembers its call. Each time the brief settles, its GO, CAUTION or NO GO verdict
   (p107) and reasons are saved with the flight (f.vd, with the time checked). Opening the brief again
   later compares the two: if the call got worse or the reasons changed, a banner at the top says what
   changed since the last check and when that was. The Today card (p115) uses the saved call and asks
   for a recheck when departure is close and the last check is more than an hour old. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #vdChg{margin:0 0 10px;clear:both;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,181,71,.6);background:rgba(255,181,71,.08);font-size:14px;line-height:1.45}
    #vdChg.worse{border-color:rgba(255,77,106,.7);background:rgba(255,77,106,.09)}
    #vdChg.better{border-color:rgba(70,227,155,.6);background:rgba(70,227,155,.07)}
    #vdChg b{font-family:var(--disp,system-ui);letter-spacing:.5px}
    #vdChg ul{margin:4px 0 0 18px;padding:0;list-style:disc}
    #bfBluf #vdChg li{display:list-item;padding:1px 0;border:0;font-size:14px}
    #bfBluf #vdChg li::before{content:none;display:none}
    #vdChg .x{float:right;appearance:none;border:0;background:transparent;color:var(--ink2,#9db2ce);font-size:18px;line-height:1;cursor:pointer;padding:0 0 0 8px}
  `;
  document.head.appendChild(css);
  const RANK = { go: 0, caution: 1, nogo: 2 }, NAME = { go: "GO", caution: "CAUTION", nogo: "NO GO" };
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ago = (ms) => { const m = Math.round((Date.now() - ms) / 6e4); if (m < 2) return "a minute ago"; if (m < 60) return `${m} minutes ago`; const hr = Math.round(m / 60); if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`; const d = Math.round(hr / 24); return `${d} day${d === 1 ? "" : "s"} ago`; };
  // Reasons can carry live numbers; compare their labels only
  const key = (r) => String(r).split(":")[0].trim();
  let bannerEl = null, seenFor = "", firstAt = 0, lastSig = "", stableAt = 0, prev = null, shown = "";
  function banner(card, f, old, cur) {
    const worse = RANK[cur.k] > RANK[old.k], better = RANK[cur.k] < RANK[old.k];
    const added = cur.r.filter((r) => !old.r.some((o) => key(o) === key(r)));
    if (!worse && !better && !added.length) return;
    const sig = f.id + cur.k + added.join("|");
    if (shown === sig || document.getElementById("vdChg")) return;
    shown = sig;
    const el = document.createElement("div"); el.id = "vdChg"; el.className = worse ? "worse" : better ? "better" : ""; el.setAttribute("role", "status");
    el.innerHTML = `<button type="button" class="x" aria-label="Dismiss">×</button><b>${worse || better ? `Changed since your last check ${h(ago(old.at))}: ${NAME[old.k]} is now ${NAME[cur.k]}.` : `New since your last check ${h(ago(old.at))}:`}</b>${added.length ? `<ul>${added.slice(0, 4).map((r) => `<li>${h(r)}</li>`).join("")}</ul>` : ""}`;
    el.querySelector(".x").onclick = () => { el.remove(); bannerEl = null; };
    bannerEl = el;
    const vd = card.querySelector(":scope > .vd"); if (vd) vd.after(el); else card.prepend(el);
  }
  function apply() {
    if (!/^#\/brief(\/|$|\?)/.test(location.hash || "") || !window.AeroVerdict) return;
    let f = null; try { f = currentFlight(); } catch {}
    const card = document.querySelector("#view .page #bfBluf");
    if (!f || !card || f.missionId || !card.querySelector(".vd")) return;
    if (seenFor !== f.id) { seenFor = f.id; firstAt = Date.now(); lastSig = ""; prev = f.vd || null; shown = ""; bannerEl = null; const old = document.getElementById("vdChg"); if (old) old.remove(); }
    // The card can be rebuilt; keep the banner in it, under the badge
    if (bannerEl && !card.contains(bannerEl)) { const vd = card.querySelector(":scope > .vd"); if (vd) vd.after(bannerEl); else card.prepend(bannerEl); }
    const v = AeroVerdict.get();
    if (!v) return;
    // Weather still loading counts as not settled
    if (v.r.some((r) => /not loaded yet/i.test(r)) && Date.now() - firstAt < 15000) return;
    const sig = v.k + "|" + v.r.join("|");
    if (sig !== lastSig) { lastSig = sig; stableAt = Date.now(); return; }
    if (Date.now() - stableAt < 2500) return;
    const cur = { k: v.k, r: v.r.slice(0, 8), at: Date.now() };
    if (prev && prev.at && Date.now() - prev.at > 10 * 6e4) banner(card, f, prev, cur);
    if (!f.vd || f.vd.k !== cur.k || f.vd.r.join("|") !== cur.r.join("|") || Date.now() - f.vd.at > 5 * 6e4) { f.vd = cur; try { save(); } catch {} }
  }
  // Each visit to the brief compares against the call saved before it
  window.addEventListener("hashchange", () => { seenFor = ""; });
  setInterval(() => { try { apply(); } catch (e) { console.error(e); } }, 1000);
  window.AeroVdMemory = { ago, NAME };
})();
