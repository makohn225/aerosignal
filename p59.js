"use strict";
/* AI assist on the Plan page ("Describe your flight in plain words").
   The built in reader still reads every description first. Only when it cannot find a full route,
   or the pilot used a loose time like "after lunch", does the page ask the planai service (free Groq
   model) to rewrite the description into the reader's own terms: identifiers, 24 hour times, day words.
   The rewritten description goes into the box and the normal reader runs on it, so the pilot sees
   exactly what the AI understood, every follow up question still applies, and one tap restores
   their own words. Only active when the AI assist is switched on (see p58). */
(function () {
  if (typeof fnPost !== "function") return;
  const css = document.createElement("style");
  css.textContent = `
    #qAiNote{scroll-margin-top:96px;margin:10px 0 0;padding:10px 12px;border:1px solid rgba(61,224,255,.45);border-radius:10px;background:rgba(61,224,255,.07);font-size:14px;line-height:1.45;color:#EAF2FF}
    #qAiNote .aiTag{display:inline-block;margin-right:6px;padding:0 6px;border-radius:6px;font:700 10px var(--mono,monospace);letter-spacing:.06em;color:#06101e;background:#3DE0FF;vertical-align:1px}
    #qAiNote code{font-family:var(--mono,monospace);font-size:13px;overflow-wrap:anywhere}
    #qAiNote .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    #qAiNote.warn{border-color:rgba(255,181,71,.6);background:rgba(255,181,71,.07)}
    #qAiNote.thinking{opacity:.8;font-style:italic}
    #qAiCui{margin-top:6px;font-size:12.5px;color:#ff4d6a;font-weight:700}
  `;
  document.head.appendChild(css);
  const h = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const on = () => !!(window.AeroAskAI && window.AeroAskAI.enabled);
  const LOOSE = /\b(early morning|morning|late morning|noon|lunch|after lunch|afternoon|late afternoon|evening|tonight|night time|dinner|sunrise|sunset|dusk|dawn|first thing)\b/i;

  function stuck(text) {
    let p = null;
    try { p = AeroPlan.parsePlan(text); } catch { return true; }
    if (!p || !p.route || p.route.length < 2) return true;
    if (!p.time && LOOSE.test(text)) return true;
    return false;
  }
  function note(html, cls) {
    let n = document.getElementById("qAiNote");
    if (!n) {
      // Sits right above the results, where the page scrolls to after reading the plan
      const out = document.getElementById("qOut"), anchor = out || document.querySelector(".qbar");
      if (!anchor) return null;
      n = document.createElement("div"); n.id = "qAiNote"; n.setAttribute("role", "status");
      anchor.insertAdjacentElement(out ? "beforebegin" : "afterend", n);
    }
    n.className = cls || ""; n.innerHTML = html; n.hidden = !html;
    return n;
  }
  function cuiLine() {
    const anchor = document.querySelector(".qbar");
    if (!anchor || document.getElementById("qAiCui")) return;
    const d = document.createElement("div"); d.id = "qAiCui";
    d.textContent = "AI assist: a description the built in reader cannot read is sent to an outside AI service to be rewritten. Never enter CUI or classified information.";
    anchor.insertAdjacentElement("afterend", d);
  }

  let bypass = false, busy = false;
  function runOriginal() { bypass = true; try { document.getElementById("qGo").click(); } finally { bypass = false; } }

  async function assist(text) {
    busy = true;
    note(`<span class="aiTag">AI</span>Reading your description another way…`, "thinking");
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
      const r = await fnPost("planai", { mode: "plan", text, today, weekday });
      const plan = r && r.plan ? String(r.plan) : "";
      let better = false;
      if (plan) { try { const a = AeroPlan.parsePlan(plan), b = AeroPlan.parsePlan(text); better = (a.route || []).length >= Math.max(2, (b.route || []).length) || (!!a.time && !b.time); } catch {} }
      if (!better) {
        note(`<span class="aiTag">AI</span>${h(r && r.reply ? r.reply : "I could not turn that into a route.")} Try airport IDs like KJYO, or answer the questions below.`, "warn");
        runOriginal();
        return;
      }
      const box = document.getElementById("qText");
      box.value = plan;
      runOriginal();
      const n = note(`<span class="aiTag">AI</span>Read as: <code>${h(plan)}</code><br>${h(r.reply || "")} Check it before you fly.<div class="row"><button type="button" class="btn sec sm" data-a="mine">Use my words instead</button></div>`);
      if (n) setTimeout(() => { try { n.scrollIntoView({ block: "start", behavior: "smooth" }); } catch {} }, 900);
      if (n) n.querySelector('[data-a="mine"]').onclick = () => { const b = document.getElementById("qText"); if (b) b.value = text; note(""); runOriginal(); };
    } catch (e) {
      note(`<span class="aiTag">AI</span>The AI assist is not reachable right now, so the built in reader was used.`, "warn");
      runOriginal();
    } finally { busy = false; cuiLine(); }
  }

  function intercept(e) {
    if (bypass) return;
    if (busy) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    const text = (document.getElementById("qText") || {}).value || "";
    if (!text.trim() || !window.AeroPlan || !on() || !stuck(text)) { note(""); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    assist(text.trim());
  }
  document.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest("#qGo")) intercept(e); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.target && e.target.id === "qText") intercept(e); }, true);

  // Show the note about the outside AI service on the Plan page while the assist is on
  setInterval(() => { if (on() && document.querySelector(".qbar")) cuiLine(); }, 1500);
  window.AeroPlanAI = { stuck, assist };
})();
