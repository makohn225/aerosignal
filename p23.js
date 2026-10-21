"use strict";
/* Plan page helpers: recent plans to reuse, and a one tap "it misread my words" report so
   tester phrasing comes back to the feedback list and the reading rules can be tuned. */
(function () {
  const KEY = "aerosignal.recentPlans";
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  const store = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(0, 8))); } catch {} };

  const css = document.createElement("style");
  css.textContent = `
    .qp .qrecent{margin-top:12px}
    .qp .qrecent .lbl{font-size:12px;color:var(--ink2);margin:0 0 6px}
    .qp .qrecent .chips{display:flex;flex-wrap:wrap;gap:6px}
    .qp .qrecent button{appearance:none;border:1px solid var(--line2);background:rgba(61,224,255,.06);color:var(--ink);border-radius:999px;padding:5px 11px;font-size:12.5px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
    .qp .qrecent button:hover{border-color:var(--cyan)}
    .qp .qrecent .clr{border:0;background:transparent;color:var(--ink2);text-decoration:underline;padding:5px 4px}
    .qp .qmis{margin-top:12px;border-top:1px solid var(--line2);padding-top:10px}
    .qp .qmis textarea{width:100%;box-sizing:border-box;min-height:70px;margin-top:6px}
    .qp .qmis .linkish{appearance:none;border:0;background:transparent;color:var(--cyan);text-decoration:underline;cursor:pointer;padding:0;font-size:13px}
  `;
  document.head.appendChild(css);

  function remember(text) {
    text = String(text || "").replace(/\s+/g, " ").trim();
    if (text.length < 6) return;
    store([text, ...load().filter((t) => t !== text)]);
  }

  function addRecent(page) {
    if (page.querySelector(".qrecent")) return;
    const list = load();
    const ex = page.querySelector(".qex");
    if (!list.length || !ex) return;
    const box = document.createElement("div");
    box.className = "qrecent";
    box.innerHTML = `<p class="lbl">Your recent plans. Tap one to reuse it, then change the date or time.</p><div class="chips">${list.map((t, i) => `<button type="button" data-i="${i}" title="${esc(t)}">${esc(t.length > 70 ? t.slice(0, 68) + "…" : t)}</button>`).join("")}<button type="button" class="clr">Clear</button></div>`;
    ex.after(box);
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.classList.contains("clr")) { store([]); box.remove(); return; }
      const ta = document.getElementById("qText");
      const go = document.getElementById("qGo");
      if (ta && go) { ta.value = list[+b.dataset.i]; go.click(); }
    });
  }

  function addMisread(out) {
    const panel = out.querySelector("section.panel");
    if (!panel || panel.querySelector(".qmis") || !document.getElementById("qBuild")) return;
    const d = document.createElement("div");
    d.className = "qmis";
    d.innerHTML = `<button type="button" class="linkish" id="qMisBtn">Did I read something wrong? Tell me</button>
      <div id="qMisForm" hidden>
        <label for="qMisMsg" class="small muted">What should it have read? Your words and my reading are sent with this so the reading rules can be fixed. Do not include CUI or classified information.</label>
        <textarea id="qMisMsg" maxlength="1500" placeholder="Example: LZ HAWK should be the destination, not a stop along the way"></textarea>
        <div class="row" style="gap:8px;margin-top:6px"><button type="button" class="btn sm" id="qMisSend">Send</button><span class="small muted" id="qMisNote"></span></div>
      </div>`;
    panel.appendChild(d);
    d.querySelector("#qMisBtn").onclick = () => { const f = d.querySelector("#qMisForm"); f.hidden = !f.hidden; if (!f.hidden) d.querySelector("#qMisMsg").focus(); };
    d.querySelector("#qMisSend").onclick = async () => {
      const note = d.querySelector("#qMisNote");
      const what = d.querySelector("#qMisMsg").value.trim();
      const words = (document.getElementById("qText") || {}).value || "";
      const read = ((panel.querySelector(".qread") || {}).textContent || "").split(" Check it,")[0];
      if (what.length < 3) { note.textContent = "Write a few words about what was wrong."; return; }
      const btn = d.querySelector("#qMisSend");
      btn.disabled = true;
      note.textContent = "Sending…";
      const message = `PLAN READER MISREAD\nWords: ${words.trim()}\nRead as: ${read.trim()}\nShould be: ${what}`.slice(0, 4000);
      try {
        await restFetch("feedback", { method: "POST", prefer: "return=minimal", body: { kind: "BUG", area: "plan", rating: null, message, email: null, page: "#/plan", user_agent: navigator.userAgent.slice(0, 400), app_version: typeof APP_VERSION !== "undefined" ? String(APP_VERSION).slice(0, 40) : null } });
        d.querySelector("#qMisForm").innerHTML = `<p class="small" style="margin:6px 0 0">Thank you. That goes straight to the list used to tune the plan reader. You can still fix the fields above and build the plan.</p>`;
      } catch (e) {
        btn.disabled = false;
        note.textContent = "Could not send right now. Check your connection and try again.";
      }
    };
  }

  // Save the words whenever a plan is built
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "qBuild") { const ta = document.getElementById("qText"); if (ta) remember(ta.value); }
  }, true);

  const base = ROUTES.plan;
  if (typeof base === "function") {
    ROUTES.plan = function (el, arg) {
      base(el, arg);
      const page = el.querySelector(".page.qp");
      if (!page || page.classList.contains("qdone")) return;
      addRecent(page);
      const out = page.querySelector("#qOut");
      if (out) {
        addMisread(out);
        new MutationObserver(() => addMisread(out)).observe(out, { childList: true });
      }
    };
    if ((location.hash || "").startsWith("#/plan")) go();
  }
})();
