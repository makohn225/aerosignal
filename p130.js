"use strict";
/* p130: spoken callouts while following your aircraft (p126). Short voice calls so the pilot can
   keep looking outside:
   - Traffic (from an ADS-B receiver or the simulator, p129): "Traffic, two o'clock, three miles,
     five hundred above", for targets within 3 nm and 1,000 ft. Each target is called at most once
     every 45 seconds, sooner if it closes inside 1 nm.
   - TFRs (FAA list, p46): "TFR ahead, four miles. Check the altitudes and times", when the next
     5 nm along your track enters a TFR; "Inside a TFR" if you are in one. Each TFR once every 5 min.
   - Approach (p127): "Glidepath, three hundred feet low" when more than 200 ft off the published
     or reference path inside 6 nm and below 2,000 ft above the field; once every 20 seconds.
   Uses the device's built in speech (no network). Callouts are on by default and switch off from the
   Tools menu (S.calloutsOff). They are an aid to awareness, never a warning system: the red
   disclaimer on the follow display applies. */
(function () {
  if (typeof L === "undefined") return;
  const R = Math.PI / 180;
  const nm = (a, b) => { const p1 = a.lat * R, p2 = b.lat * R, dp = p2 - p1, dl = (b.lng - a.lng) * R; const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(x))); };
  const brg = (a, b) => { const p1 = a.lat * R, p2 = b.lat * R, dl = (b.lng - a.lng) * R; return (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / R + 360) % 360; };
  const move = (p, crs, d) => { const k = d / 3440.065, la = p.lat * R, lo = p.lng * R, c = crs * R; const la2 = Math.asin(Math.sin(la) * Math.cos(k) + Math.cos(la) * Math.sin(k) * Math.cos(c)); return L.latLng(la2 / R, (lo + Math.atan2(Math.sin(c) * Math.sin(k) * Math.cos(la), Math.cos(k) - Math.sin(la) * Math.sin(la2))) / R); };
  const WORD = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];
  const hundreds = (ft) => { const n = Math.round(Math.abs(ft) / 100); return n ? `${(n * 100).toLocaleString("en-US")} ${ft > 0 ? "above" : "below"}` : "same altitude"; };
  const on = () => !(typeof S !== "undefined" && S.calloutsOff);

  /* Speech queue: one call at a time, newest of a kind replaces an older waiting one */
  const queue = [];
  let speaking = false, lastText = "", lastAt = 0;
  function say(text, kind) {
    if (!on() || !("speechSynthesis" in window)) return false;
    if (text === lastText && Date.now() - lastAt < 8000) return false;
    const i = queue.findIndex((q) => q.kind === kind); if (i >= 0) queue.splice(i, 1);
    queue.push({ text, kind });
    pump();
    return true;
  }
  function pump() {
    if (speaking || !queue.length) return;
    const q = queue.shift();
    speaking = true; lastText = q.text; lastAt = Date.now();
    window.AeroCallouts.log.push({ t: Date.now(), text: q.text, kind: q.kind });
    if (window.AeroCallouts.log.length > 50) window.AeroCallouts.log.shift();
    try {
      const u = new SpeechSynthesisUtterance(q.text);
      u.rate = 1.05; u.pitch = 1; u.lang = "en-US";
      u.onend = u.onerror = () => { speaking = false; setTimeout(pump, 250); };
      speechSynthesis.speak(u);
      setTimeout(() => { if (speaking) { speaking = false; pump(); } }, 6000); // some browsers never fire onend
    } catch { speaking = false; }
  }

  /* Point in a TFR ring of [lon, lat] */
  function inside(ll, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > ll.lat) !== (yj > ll.lat) && ll.lng < ((xj - xi) * (ll.lat - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  L.Map.addInitHook(function () {
    const map = this;
    const lastTraffic = new Map(), lastTfr = new Map();
    let lastGp = 0, tfrs = null, tfrAt = 0, fixN = 0, prev = null;
    map.on("aerofix", (e) => {
      const fix = e.fix, ll = fix.ll, trk = e.trk;
      if (!on()) return;
      fixN++;
      if (fixN === 1 && !(typeof S !== "undefined" && S.calloutsToldAt)) {
        toast("Spoken callouts are on: traffic, TFRs and glidepath. Turn them off in Tools.");
        if (typeof S !== "undefined") { S.calloutsToldAt = Date.now(); save(); }
      }
      /* Traffic */
      if (window.AeroADSB && trk != null) {
        for (const t of AeroADSB.targets.values()) {
          const tl = L.latLng(t.lat, t.lon), d = nm(ll, tl);
          const rel = fix.alt != null && t.alt != null ? t.alt - fix.alt : null;
          if (d > 3 || (rel != null && Math.abs(rel) > 1000)) continue;
          const was = lastTraffic.get(t.addr), gap = d < 1 ? 15000 : 45000;
          if (was && Date.now() - was.at < gap && !(d < 1 && was.d >= 1)) continue;
          const clock = Math.round(((((brg(ll, tl) - trk) % 360) + 360) % 360) / 30) % 12;
          const miles = d < 1 ? "less than a mile" : `${Math.round(d)} mile${Math.round(d) === 1 ? "" : "s"}`;
          if (say(`Traffic, ${WORD[clock]} o'clock, ${miles}${rel != null ? ", " + hundreds(rel) : ""}`, "traffic:" + t.addr)) lastTraffic.set(t.addr, { at: Date.now(), d });
        }
      }
      /* TFRs, checked every 5th fix */
      if (window.AeroTFR && trk != null && fixN % 5 === 1) {
        if (!tfrs || Date.now() - tfrAt > 10 * 6e4) { tfrAt = Date.now(); AeroTFR.getList().then((r) => { tfrs = r; }).catch(() => {}); }
        if (tfrs) {
          const ahead = [0, 1, 2, 3, 4, 5].map((k) => (k ? move(ll, trk, k) : ll));
          for (const t of tfrs) {
            const rings = t.rings || [];
            const hitAt = ahead.findIndex((p) => rings.some((r) => r.length > 2 && inside(p, r)));
            if (hitAt < 0) continue;
            const was = lastTfr.get(t.id);
            if (was && Date.now() - was < 5 * 6e4) continue;
            const txt = hitAt === 0 ? "Inside a TFR. Check the altitudes and times." : `TFR ahead, ${hitAt} mile${hitAt === 1 ? "" : "s"}. Check the altitudes and times.`;
            if (say(txt, "tfr")) lastTfr.set(t.id, Date.now());
          }
        }
      }
      prev = fix;
    });
    /* Approach path */
    map.on("aeroapproach", (e) => {
      if (e.off || e.dev == null || !on()) return;
      if (e.along > 6 || e.along < 0.3 || e.agl == null || e.agl > 2000) return;
      if (Math.abs(e.dev) <= 200 || Date.now() - lastGp < 20000) return;
      const ft = Math.round(Math.abs(e.dev) / 100) * 100;
      if (say(`Glidepath, ${ft} feet ${e.dev > 0 ? "high" : "low"}`, "gp")) lastGp = Date.now();
    });
    map.on("aerofixstop", () => { fixN = 0; prev = null; queue.length = 0; try { speechSynthesis.cancel(); } catch { /* none */ } });
    void prev;
  });

  /* Tools menu switch (p123 AeroMapTools hook, shared with p129) */
  const prevTools = window.AeroMapTools;
  window.AeroMapTools = {
    items: (map) => [...(prevTools ? prevTools.items(map) : []), ["callouts", on() ? "Spoken callouts: on" : "Spoken callouts: off", on() ? "Traffic, TFR and glidepath calls while following" : "Tap to turn on"]],
    run: (t, map) => {
      if (t === "callouts") { if (typeof S !== "undefined") { S.calloutsOff = on(); save(); } toast(on() ? "Spoken callouts on" : "Spoken callouts off"); if (on()) say("Callouts on", "test"); return; }
      if (prevTools) prevTools.run(t, map);
    },
  };
  window.AeroCallouts = { say, log: [], hundreds, inside };
})();
