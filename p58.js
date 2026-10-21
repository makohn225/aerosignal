"use strict";
/* Plan helper AI assist.
   The built in rules still read every request first and apply what they understand.
   Only when they cannot read a request (or part of one) does the helper send that text to the
   AeroSignal planai service, which asks a free Groq hosted model to restate it as the plain commands
   the rules already know. Those commands then run through the same rules, so the AI can only make
   changes the helper could already make, and every change keeps its undo.
   Switches itself on once the service reports a key is set; until then nothing changes. */
(function () {
  if (typeof fnGet !== "function" || typeof fnPost !== "function") return;
  let enabled = false, checkedAt = 0;
  async function check(force) {
    if (!force && Date.now() - checkedAt < 10 * 60e3) return enabled;
    checkedAt = Date.now();
    try { const r = await fnGet("planai"); enabled = !!(r && r.enabled); } catch { enabled = false; }
    paintNote();
    return enabled;
  }

  const css = document.createElement("style");
  css.textContent = `
    #askPanel .aiNote{padding:0 14px 10px;font-size:11.5px;line-height:1.35;color:#ff4d6a;font-weight:700}
    #askPanel .aiNote[hidden]{display:none}
    #askLog .m.a .aiTag{display:inline-block;margin-right:6px;padding:0 6px;border-radius:6px;font:700 10px var(--mono,monospace);letter-spacing:.06em;color:#06101e;background:#3DE0FF;vertical-align:1px}
    #askLog .m.a.thinking{opacity:.75;font-style:italic}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function paintNote() {
    const pan = document.getElementById("askPanel");
    if (!pan) return;
    let n = pan.querySelector(".aiNote");
    if (!n) {
      n = document.createElement("div");
      n.className = "aiNote";
      n.textContent = "AI assist reads requests the built in rules could not. What you type here is sent to an outside AI service. Never enter CUI or classified information.";
      pan.appendChild(n);
    }
    n.hidden = !enabled;
  }

  function context() {
    const hash = location.hash || "";
    const mm = hash.match(/^#\/(?:missions|kneeboard)\/([^/]+)/);
    const m = mm && typeof getMission === "function" ? getMission(mm[1]) : null;
    if (m) {
      const legs = m.legs || [];
      const chain = legs.length ? [legs[0].from, ...legs.map((l) => l.to)].filter(Boolean) : [];
      return { kind: "mission", route: chain.join(" "), time: m.launch || "" };
    }
    const f = typeof currentFlight === "function" ? currentFlight() : null;
    return { kind: "flight", route: (f && f.route) || "", time: (f && f.time) || "" };
  }

  function bubble(html, warn, thinking) {
    const log = document.getElementById("askLog");
    if (!log) return null;
    const d = document.createElement("div");
    d.className = `m a${warn ? " warn" : ""}${thinking ? " thinking" : ""}`;
    d.dataset.ai = "1";
    d.innerHTML = html;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
    return d;
  }

  function rerender() {
    let view = null;
    try { if (typeof leafletMap !== "undefined" && leafletMap && /^#\/maps/.test(location.hash)) view = { c: leafletMap.getCenter(), z: leafletMap.getZoom() }; } catch {}
    try { go(); } catch {}
    if (view) setTimeout(() => { try { leafletMap.setView(view.c, view.z, { animate: false }); } catch {} }, 450);
    setTimeout(() => window.dispatchEvent(new HashChangeEvent("hashchange")), 300);
  }

  let busy = false;
  async function assist(text) {
    if (busy || !window.AeroAsk) return;
    busy = true;
    const c = context();
    const wait = bubble(`<span class="aiTag">AI</span>Reading that another way…`, false, true);
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const r = await fnPost("planai", { text, kind: c.kind, route: c.route, time: c.time, today });
      if (wait) wait.remove();
      if (r && r.enabled === false) { enabled = false; paintNote(); return; }
      const cmds = (r && r.commands) || [];
      if (!cmds.length) { bubble(`<span class="aiTag">AI</span>${h(r && r.reply ? r.reply : "I still could not work out a change from that.")}`, true); return; }
      const res = await AeroAsk.run(cmds.join(". "));
      const said = (res && res.said) || [], warn = (res && res.warn) || [];
      const route = res && res.touched && res.route ? `<br>Route: <code>${h(res.route)}</code>` : "";
      if (said.length) bubble(`<span class="aiTag">AI</span>${h(r.reply || "")} ${said.map(h).join(" ")}${route}`);
      if (warn.length) bubble(`<span class="aiTag">AI</span>${warn.map(h).join(" ")}`, true);
      if (!said.length && !warn.length) bubble(`<span class="aiTag">AI</span>${h(r.reply || "Nothing to change.")}`);
      if (res && res.touched) {
        const u = document.querySelector('#askPanel [data-a="undo"]'); if (u) u.disabled = false;
        rerender();
      }
    } catch (e) {
      if (wait) wait.remove();
      bubble(`<span class="aiTag">AI</span>${h(/429|Too many/.test(String(e && e.message)) ? "Too many requests right now. Try again in a minute." : "The AI assist is not reachable right now. Nothing was changed.")}`, true);
    } finally { busy = false; }
  }

  /* Watch the helper's conversation: after each request, see whether the rules understood it. */
  let batch = null, timer = 0;
  function settle() {
    const b = batch; batch = null;
    if (!b || !enabled) return;
    if (/^\s*(undo|undo that|go back|revert|help|what can you do|\?)\s*[.!]?\s*$/i.test(b.text)) return;
    const missed = [];
    let noFlight = false;
    for (const w of b.warns) {
      for (const m of w.matchAll(/did not understand "([^"]+)"/g)) missed.push(m[1]);
      if (/There is no flight yet/.test(w)) noFlight = true;
    }
    if (!missed.length && !noFlight) return;
    // The AI answers next, so the rules' "did not understand" note is set aside
    b.nodes.forEach((n) => { if (/did not understand|There is no flight yet/.test(n.textContent || "") && !/did not plot|could not find|legs do not join/.test(n.textContent || "")) n.remove(); });
    assist(b.ok && missed.length ? missed.join(". ") : b.text);
  }
  function watch(log) {
    if (log.dataset.aiWatch) return;
    log.dataset.aiWatch = "1";
    new MutationObserver((list) => {
      for (const rec of list) for (const n of rec.addedNodes) {
        if (!(n instanceof HTMLElement) || n.dataset.ai) continue;
        if (n.classList.contains("u")) { batch = { text: n.textContent || "", ok: false, warns: [], nodes: [] }; continue; }
        if (!batch || !n.classList.contains("a")) continue;
        if (n.classList.contains("warn")) { batch.warns.push(n.textContent || ""); batch.nodes.push(n); } else batch.ok = true;
      }
      clearTimeout(timer);
      timer = setTimeout(settle, 120);
    }).observe(log, { childList: true });
  }
  const hook = setInterval(() => {
    const log = document.getElementById("askLog");
    if (!log) return;
    watch(log); paintNote();
    const fab = document.getElementById("askFab");
    if (fab && !fab.dataset.aiHook) { fab.dataset.aiHook = "1"; fab.addEventListener("click", () => check(!enabled)); }
  }, 1000);
  setTimeout(() => check(true), 2500);
  window.AeroAskAI = { check, assist, get enabled() { return enabled; }, _hook: hook };
})();
