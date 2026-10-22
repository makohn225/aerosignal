"use strict";
/* p112: the narrated tutorial shows the GO, CAUTION or NO GO badge (p107), and the recorded voice
   reads the newer tutorial lines (runway winds, diversion airports, the low level card and the
   verdict badge) instead of the device voice. */
(function () {
  try {
    const T = window.AeroTutorial && AeroTutorial.scripts;
    for (const k of ["civil", "military"]) {
      const sc = T && T[k] && T[k].scenes;
      if (!sc || sc._p112) continue;
      sc._p112 = true;
      let at = sc.findIndex((s) => s.sel === "#rwPanel");
      if (at < 0) at = sc.findIndex((s) => s.hash === "#/feedback");
      if (at < 0) at = sc.length - 1;
      if (k === "civil") sc.splice(at, 0, { hash: "#/brief", sel: "#bfBluf .vd, #bfBluf", wait: "#bfBluf .vd", text: "At the top of the brief, a GO, CAUTION or NO GO badge sums up the limits and minimums it checked, with the reasons. The decision is always yours as pilot in command." });
    }
  } catch (e) { console.error(e); }
  try { if (window.AeroNarration && AeroNarration.manifest) Object.assign(AeroNarration.manifest, {"e9934314":["e9934314m",10.4],"921e035f":["921e035fm",7.9],"bc800629":["bc800629m",11.1],"a08ac871":["a08ac871m",10.8]}); } catch (e) { console.error(e); }
})();
