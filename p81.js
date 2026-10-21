"use strict";
/* p81: the AeroSignal AI connector on the More page. AeroSignal's public safety data is offered as a
   read only Model Context Protocol (MCP) server, so a pilot can ask Claude, ChatGPT or another
   assistant about accidents along a route, public military mishaps, turbulence and icing advisories
   and airport data. Public data only: the connector never sees the pilot's flights, aircraft,
   logbook or account. This panel gives the address and the steps to add it. */
(function () {
  const URL_ = "https://jcvrcckeprmpcruhxafm.supabase.co/functions/v1/mcp";
  const css = document.createElement("style");
  css.textContent = `
    #aiConn .ac-url{display:flex;gap:8px;align-items:center;margin:8px 0}
    #aiConn .ac-url code{flex:1;min-width:0;overflow-x:auto;white-space:nowrap;font:13px var(--mono,monospace);padding:9px 10px;border:1px solid var(--line2,rgba(255,255,255,.12));border-radius:8px;background:rgba(0,0,0,.25)}
    #aiConn ol{margin:6px 0 0;padding-left:20px}#aiConn li{margin:3px 0;line-height:1.45}
    #aiConn details{margin-top:10px}#aiConn summary{cursor:pointer;font-weight:600}
    #aiConn .tools{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
    #aiConn .tools span{font:12px var(--mono,monospace);padding:2px 8px;border-radius:999px;border:1px solid rgba(61,224,255,.35)}
    #aiConn .disc{color:#ff4d6a;font-weight:700;font-size:12.5px;margin:12px 0 0}
  `;
  document.head.appendChild(css);
  const base = ROUTES.more;
  if (typeof base !== "function") return;
  ROUTES.more = function (el, arg) {
    const r = base(el, arg);
    const page = el.querySelector(".page") || el;
    if (page.querySelector("#aiConn")) return r;
    const sec = document.createElement("section");
    sec.className = "panel"; sec.id = "aiConn";
    sec.innerHTML = `<h2>AeroSignal AI connector</h2>
      <p style="margin-top:0">Ask your AI assistant about your route with AeroSignal's safety data behind it. Add this address as a custom connector (MCP server) in Claude, ChatGPT or any assistant that supports MCP.</p>
      <div class="ac-url"><code>${URL_}</code><button type="button" class="btn sm" id="acCopy">Copy</button></div>
      <details open><summary>Claude</summary><ol>
        <li>Open Settings, then Connectors, and choose Add custom connector.</li>
        <li>Name it AeroSignal and paste the address. No sign in is needed.</li>
        <li>In a chat, turn on AeroSignal and ask, for example: "What accidents happened along KHEF MRB KLYH, and what are the lessons for a night VFR flight?"</li></ol></details>
      <details><summary>ChatGPT</summary><ol>
        <li>Open Settings, then Apps and Connectors, and turn on developer mode under Advanced.</li>
        <li>Choose Create, name it AeroSignal, paste the address and pick No authentication.</li>
        <li>Start a chat, add AeroSignal from the tools menu and ask about your route.</li></ol></details>
      <p class="small muted" style="margin:10px 0 0">What the assistant can look up:</p>
      <div class="tools"><span>NTSB accidents along a route</span><span>Accidents near an airport</span><span>Full NTSB narratives</span><span>Public military mishaps</span><span>Turbulence and icing advisories</span><span>Airport and runway data</span></div>
      <p class="disc">Public data only. The connector never sees your flights, aircraft, logbook or account. Answers are advisory and are not an official weather briefing. Never paste CUI or classified information into an AI assistant.</p>`;
    const about = page.querySelector("#aboutAS");
    if (about) about.before(sec); else page.appendChild(sec);
    sec.querySelector("#acCopy").onclick = async () => {
      try { await navigator.clipboard.writeText(URL_); toast("Connector address copied"); }
      catch { const c = sec.querySelector("code"); const rg = document.createRange(); rg.selectNodeContents(c); const s = getSelection(); s.removeAllRanges(); s.addRange(rg); toast("Press copy to copy the address"); }
    };
    return r;
  };
  if ((location.hash || "").startsWith("#/more")) go();
})();
