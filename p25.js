"use strict";
/* Plan page: understand aircraft nicknames pilots actually write ("two Ospreys", "my Skyhawk")
   and fill the aircraft type, or pick the matching logbook aircraft, on the review card. */
(function () {
  const MIL = [
    [/\bospreys?\b/i, "MV-22B"], [/\bsuper hornets?\b/i, "F/A-18E"], [/\bhornets?\b/i, "F/A-18C"],
    [/\bharriers?\b/i, "AV-8B"], [/\bvipers?\b/i, "AH-1Z"], [/\bcobras?\b/i, "AH-1W"], [/\bvenoms?\b/i, "UH-1Y"],
    [/\bhueys?\b/i, "UH-1Y"], [/\bking stallions?\b/i, "CH-53K"], [/\bsuper stallions?\b/i, "CH-53E"],
    [/\bblack ?hawks?\b/i, "UH-60M"], [/\bseahawks?\b/i, "MH-60R"], [/\bapaches?\b/i, "AH-64E"],
    [/\bchinooks?\b/i, "CH-47F"], [/\bherc(ule)?s\b|\bhercules\b/i, "C-130J"], [/\bgrowlers?\b/i, "EA-18G"],
    [/\blightning\b|\bf-?35s?\b/i, "F-35B"], [/\breapers?\b/i, "MQ-9A"], [/\bpave hawks?\b/i, "HH-60W"],
  ];
  const CIV = [
    [/\bskyhawk\b/i, ["C172", "172"]], [/\bskylane\b/i, ["C182", "182"]], [/\bcherokee\b|\barcher\b|\bwarrior\b/i, ["PA28", "P28A", "PA-28"]],
    [/\barrow\b/i, ["P28R", "PA28R"]], [/\bbonanza\b/i, ["BE35", "BE36", "A36"]], [/\bbaron\b/i, ["BE55", "BE58"]],
    [/\bcirrus\b|\bsr ?22\b/i, ["SR22", "S22T"]], [/\bsr ?20\b/i, ["SR20"]], [/\bmooney\b/i, ["M20P", "M20J", "M20"]],
    [/\bdiamond\b|\bda ?40\b/i, ["DA40"]], [/\bseminole\b/i, ["PA44", "PA-44"]], [/\bcub\b/i, ["J3", "PA18"]],
  ];

  let switchedFor = null;
  function fill(out) {
    const panel = out.querySelector("section.panel");
    if (!panel || panel.dataset.nick || !document.getElementById("qBuild")) return;
    panel.dataset.nick = "1";
    const text = (document.getElementById("qText") || {}).value || "";
    const mil = MIL.find(([re]) => re.test(text));
    const kindMission = document.querySelector('#qKind [data-v="mission"][aria-pressed="true"]');
    if (mil && !kindMission && switchedFor !== text) {
      switchedFor = text;
      // a named military aircraft means a mission: switch the plan type, then fill on the next render
      const btn = document.querySelector('#qKind [data-v="mission"]');
      if (btn) { btn.click(); return; }
    }
    const type = document.getElementById("qType");
    if (mil && type && !type.value.trim()) {
      type.value = mil[1];
      const m = text.match(/\b(one|two|three|four|five|six|\d)\s+(?:\w+\s+){0,2}?(ospreys?|hornets?|super hornets?|harriers?|vipers?|cobras?|venoms?|hueys?|stallions?|king stallions?|black ?hawks?|seahawks?|apaches?|chinooks?|hercs?|hercules|growlers?|reapers?)/i);
      const n = m ? ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[m[1].toLowerCase()] || +m[1]) : 0;
      const cnt = document.getElementById("qCount");
      if (cnt && n > 1 && +cnt.value <= 1) cnt.value = n;
      const note = document.createElement("p");
      note.className = "small muted";
      note.style.margin = "4px 0 0";
      note.textContent = `Read "${(text.match(mil[0]) || [""])[0]}" as ${mil[1]}. Change it if that is wrong.`;
      type.after(note);
    }
    const tailSel = document.getElementById("qTail");
    const civ = CIV.find(([re]) => re.test(text));
    if (civ && tailSel && tailSel.tagName === "SELECT") {
      let ac = {};
      try { ac = allAircraft(); } catch {}
      const hit = Object.entries(ac).find(([, a]) => civ[1].some((k) => String(a.typeCode || "").toUpperCase() === k || String(a.model || "").toUpperCase().replace(/^C(?=\d)/, "") === k.replace(/^C(?=\d)/, "")));
      if (hit) tailSel.value = hit[0];
    }
  }

  const base = ROUTES.plan;
  if (typeof base === "function") {
    ROUTES.plan = function (el, arg) {
      base(el, arg);
      const out = el.querySelector("#qOut");
      if (out) { fill(out); new MutationObserver(() => fill(out)).observe(out, { childList: true }); }
    };
    if ((location.hash || "").startsWith("#/plan")) go();
  }
})();
