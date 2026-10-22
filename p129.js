"use strict";
/* p129: ADS-B In groundwork (GDL 90).
   Portable receivers (Stratux, Sentry, Stratus, SkyEcho and others) send traffic and their own GPS
   position over Wi-Fi as GDL 90 messages (UDP port 4000). A web page cannot open a UDP socket, so
   the live feed only works inside the AeroSignal phone and tablet app, through a native UDP plugin
   (window.Capacitor.Plugins.AeroGdl90, see native/README.md). Everything else is here and runs in
   the browser too:
   - a GDL 90 decoder: frame flags, byte unstuffing, the CRC check, and the heartbeat, ownship,
     ownship geometric altitude and traffic report messages (FAA GDL 90 Public ICD, Rev A);
   - a matching encoder, used by the built in simulator and the tests;
   - a traffic layer on every map: each target with its tail number or callsign, relative altitude
     in hundreds of feet, climb or descent arrow and track line, gone after 20 seconds;
   - a "Traffic simulator" in the Tools menu for practice and demonstrations (clearly labeled).
   Traffic shown here is for awareness only. It is not a collision avoidance system. */
(function () {
  /* GDL 90 CRC (CRC CCITT, polynomial 0x1021, initial value 0), table per the ICD */
  const CRC = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i << 8;
    for (let b = 0; b < 8; b++) c = (c << 1) ^ (c & 0x8000 ? 0x1021 : 0);
    CRC[i] = c & 0xffff;
  }
  function crc(bytes) {
    let c = 0;
    for (const b of bytes) c = (CRC[c >> 8] ^ (c << 8) ^ b) & 0xffff;
    return c;
  }

  /* Split a byte stream into messages: 0x7E flags, 0x7D escapes, CRC (low byte first) */
  function frames(buf) {
    const out = [];
    let cur = null, esc = false;
    for (const b of buf) {
      if (b === 0x7e) {
        if (cur && cur.length >= 3) {
          const body = cur.slice(0, -2), got = cur[cur.length - 2] | (cur[cur.length - 1] << 8);
          if (crc(body) === got) out.push(Uint8Array.from(body));
        }
        cur = []; esc = false; continue;
      }
      if (!cur) continue;
      if (esc) { cur.push(b ^ 0x20); esc = false; } else if (b === 0x7d) esc = true; else cur.push(b);
    }
    return out;
  }
  function frame(msg) {
    const c = crc(msg), body = [...msg, c & 0xff, c >> 8], out = [0x7e];
    for (const b of body) { if (b === 0x7e || b === 0x7d) out.push(0x7d, b ^ 0x20); else out.push(b); }
    out.push(0x7e);
    return Uint8Array.from(out);
  }

  const s24 = (a, b, c) => { let v = (a << 16) | (b << 8) | c; if (v & 0x800000) v -= 0x1000000; return v; };
  const s12 = (v) => (v & 0x800 ? v - 0x1000 : v);
  /* Ownship (0x0A) and traffic (0x14) reports share one layout */
  function report(m) {
    const lat = (s24(m[5], m[6], m[7]) * 180) / 0x800000, lon = (s24(m[8], m[9], m[10]) * 180) / 0x800000;
    const altRaw = (m[11] << 4) | (m[12] >> 4), misc = m[12] & 0x0f;
    const hv = (m[14] << 4) | (m[15] >> 4), vvRaw = ((m[15] & 0x0f) << 8) | m[16];
    const cs = String.fromCharCode(...m.slice(19, 27)).replace(/[^ -~]/g, "").trim();
    return {
      addr: ((m[2] << 16) | (m[3] << 8) | m[4]).toString(16).toUpperCase().padStart(6, "0"),
      alert: m[1] >> 4, addrType: m[1] & 0x0f,
      lat, lon,
      alt: altRaw === 0xfff ? null : altRaw * 25 - 1000, // pressure altitude, feet
      airborne: !!(misc & 0x08), trackType: misc & 0x03,
      nic: m[13] >> 4, nacp: m[13] & 0x0f,
      gs: hv === 0xfff ? null : hv, vs: vvRaw === 0x800 ? null : s12(vvRaw) * 64,
      trk: (m[17] * 360) / 256, cat: m[18], cs, emerg: m[27] >> 4,
    };
  }
  function decode(m) {
    switch (m[0]) {
      case 0x00: return { type: "heartbeat", gpsValid: !!(m[1] & 0x80), uat: !!(m[1] & 0x01) };
      case 0x0a: return { type: "ownship", ...report(m) };
      case 0x0b: { let v = (m[1] << 8) | m[2]; if (v & 0x8000) v -= 0x10000; return { type: "geoalt", alt: v * 5 }; }
      case 0x14: return { type: "traffic", ...report(m) };
      default: return { type: "other", id: m[0] };
    }
  }
  function encodeReport(id, t) {
    const m = new Uint8Array(28);
    m[0] = id; m[1] = ((t.alert || 0) << 4) | (t.addrType || 0);
    const a = parseInt(t.addr || "ABCDEF", 16); m[2] = (a >> 16) & 255; m[3] = (a >> 8) & 255; m[4] = a & 255;
    const ll = (v) => { let x = Math.round((v * 0x800000) / 180); if (x < 0) x += 0x1000000; return [(x >> 16) & 255, (x >> 8) & 255, x & 255]; };
    m.set(ll(t.lat), 5); m.set(ll(t.lon), 8);
    const alt = t.alt == null ? 0xfff : Math.max(0, Math.min(0xffe, Math.round((t.alt + 1000) / 25)));
    m[11] = alt >> 4; m[12] = ((alt & 0x0f) << 4) | 0x09; // airborne, true track
    m[13] = 0xa9;
    const hv = t.gs == null ? 0xfff : Math.round(t.gs); let vv = t.vs == null ? 0x800 : Math.round(t.vs / 64); if (vv < 0) vv += 0x1000;
    m[14] = hv >> 4; m[15] = ((hv & 0x0f) << 4) | (vv >> 8); m[16] = vv & 255;
    m[17] = Math.round(((t.trk || 0) % 360) * 256 / 360) & 255; m[18] = t.cat || 1;
    const cs = (t.cs || "").toUpperCase().padEnd(8, " ").slice(0, 8);
    for (let i = 0; i < 8; i++) m[19 + i] = cs.charCodeAt(i);
    return m;
  }

  /* Live state */
  const targets = new Map(); // addr -> { ...report, at }
  let own = null, geoAlt = null, lastBeat = 0;
  const listeners = new Set();
  function feed(bytes) {
    for (const m of frames(bytes)) {
      const d = decode(m), now = Date.now();
      if (d.type === "heartbeat") lastBeat = now;
      else if (d.type === "ownship") own = { ...d, at: now };
      else if (d.type === "geoalt") geoAlt = { alt: d.alt, at: now };
      else if (d.type === "traffic" && isFinite(d.lat) && (d.lat || d.lon)) targets.set(d.addr, { ...d, at: now });
    }
    for (const [k, t] of targets) if (Date.now() - t.at > 20000) targets.delete(k);
    listeners.forEach((f) => { try { f(); } catch { /* one bad map */ } });
  }

  /* Native feed (phone and tablet app only) */
  let nativeOn = false;
  async function connectNative() {
    const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.AeroGdl90;
    if (!P) return false;
    if (nativeOn) return true;
    await P.addListener("data", (e) => feed(Uint8Array.from(atob(e.b64), (c) => c.charCodeAt(0))));
    await P.start({ port: 4000 });
    nativeOn = true;
    return true;
  }

  /* Simulator: three aircraft around the map center, sent through the encoder and decoder */
  let simT = null;
  function simulate(center, on) {
    clearInterval(simT); simT = null;
    if (!on) { targets.clear(); feed(new Uint8Array()); return; }
    const t0 = Date.now(), R = Math.PI / 180;
    const ac = [
      { addr: "A1B2C3", cs: "N172SP", r: 4, w: 1, alt: 3500, vs: 0, gs: 110 },
      { addr: "A4D5E6", cs: "N525AS", r: 7, w: -0.6, alt: 2200, vs: 700, gs: 160 },
      { addr: "ACF001", cs: "N88TRN", r: 2.5, w: 1.8, alt: 4100, vs: -500, gs: 95 },
    ];
    simT = setInterval(() => {
      const s = (Date.now() - t0) / 1000, parts = [frame([0x00, 0x81, 0, 0, 0, 0, 0])];
      for (const a of ac) {
        const ang = a.w * s * 0.02, lat = center.lat + (a.r / 60) * Math.cos(ang), lon = center.lng + (a.r / 60) * Math.sin(ang) / Math.cos(center.lat * R);
        const trk = ((Math.atan2(Math.cos(ang) * a.w, -Math.sin(ang) * a.w) / R) + 360) % 360;
        parts.push(frame(encodeReport(0x14, { ...a, lat, lon, alt: a.alt + (a.vs * s) / 60, trk })));
      }
      const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
      feed(all);
    }, 1000);
  }

  /* Map layer */
  if (typeof L !== "undefined") {
    const css = document.createElement("style");
    css.textContent = `
      .adsb-t{color:#7CF5FF;font:700 11px/1.1 var(--mono,monospace);text-shadow:0 0 3px #000,0 0 2px #000;white-space:nowrap}
      .adsb-t svg{display:block;margin:0 auto}
      .adsb-t.near{color:#FFD23F}.adsb-t.close{color:#ff4d6a}
      .adsb-bar{position:absolute;left:50%;transform:translateX(-50%);top:10px;width:max-content;z-index:1000;background:rgba(5,10,20,.92);border:1px solid rgba(124,245,255,.6);border-radius:10px;padding:6px 9px;color:#EAF2FF;font:12px var(--body,system-ui);max-width:min(240px,calc(100% - 150px))}
      .adsb-bar b{color:#7CF5FF}.adsb-bar .d{color:#ff4d6a;font-weight:700;font-size:10.5px;margin-top:3px}
      .adsb-bar button{margin-top:4px;font:600 12px var(--body,system-ui);background:transparent;color:#7CF5FF;border:1px solid rgba(124,245,255,.5);border-radius:7px;padding:3px 8px}
    `;
    document.head.appendChild(css);
    const R = Math.PI / 180;
    const nm = (a, b) => { const p1 = a.lat * R, p2 = b.lat * R, dp = p2 - p1, dl = (b.lng - a.lng) * R; const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2; return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(x))); };
    L.Map.addInitHook(function () {
      const map = this;
      let layer = null, bar = null, gpsFix = null, sim = false;
      map.on("aerofix", (e) => { gpsFix = e.fix; });
      map.on("aerofixstop", () => { gpsFix = null; });
      const myAlt = () => (own && own.alt != null && Date.now() - own.at < 10000 ? own.alt : gpsFix && gpsFix.alt != null ? gpsFix.alt : null);
      const myPos = () => (own && Date.now() - own.at < 10000 ? L.latLng(own.lat, own.lon) : gpsFix ? gpsFix.ll : null);
      function draw() {
        if (!map._loaded) return;
        if (!targets.size && !sim && !nativeOn) { if (layer) { layer.remove(); layer = null; } if (bar) { bar.remove(); bar = null; } return; }
        if (!layer) layer = L.layerGroup().addTo(map);
        layer.clearLayers();
        const ma = myAlt(), mp = myPos();
        let n = 0;
        for (const t of targets.values()) {
          const ll = L.latLng(t.lat, t.lon);
          const rel = ma != null && t.alt != null ? Math.round((t.alt - ma) / 100) : null;
          const dist = mp ? nm(mp, ll) : null;
          const cls = dist != null && rel != null && dist < 2 && Math.abs(rel) <= 5 ? "close" : dist != null && rel != null && dist < 6 && Math.abs(rel) <= 10 ? "near" : "";
          const arrow = t.vs == null || Math.abs(t.vs) < 300 ? "" : t.vs > 0 ? "↑" : "↓";
          const relTxt = rel == null ? (t.alt != null ? `${Math.round(t.alt / 100)}` : "") : `${rel >= 0 ? "+" : "−"}${String(Math.abs(rel)).padStart(2, "0")}`;
          const html = `<svg width="22" height="22" viewBox="-11 -11 22 22" style="transform:rotate(${t.trk}deg)"><path d="M0,-9 L6,7 L0,3 L-6,7Z" fill="currentColor" stroke="#000" stroke-width="1"/></svg><div style="text-align:center">${relTxt}${arrow}<br>${t.cs || t.addr}</div>`;
          L.marker(ll, { interactive: false, keyboard: false, pane: map.getPane("ownship") ? "ownship" : "markerPane", icon: L.divIcon({ className: "adsb-t " + cls, iconSize: [64, 46], iconAnchor: [32, 11], html }) }).addTo(layer);
          if (t.gs) { const d = (t.gs / 60) * 1 / 60; L.polyline([ll, L.latLng(t.lat + d * Math.cos(t.trk * R), t.lon + (d * Math.sin(t.trk * R)) / Math.cos(t.lat * R))], { color: "#7CF5FF", weight: 2, opacity: 0.7, interactive: false }).addTo(layer); }
          n++;
        }
        if (!bar) { bar = L.DomUtil.create("div", "adsb-bar", map.getContainer()); L.DomEvent.disableClickPropagation(bar); }
        const src = sim ? "<b>SIMULATED</b> traffic" : nativeOn ? (Date.now() - lastBeat < 5000 ? "<b>ADS-B</b> receiver connected" : "<b>ADS-B</b> waiting for receiver") : "<b>ADS-B</b>";
        bar.innerHTML = `${src} · ${n} target${n === 1 ? "" : "s"}${ma == null ? " · relative altitude needs GPS altitude" : ""}<div class="d">Traffic for awareness only. Not collision avoidance. See and avoid.</div>${sim ? '<button type="button">Stop simulator</button>' : ""}`;
        const b = bar.querySelector("button"); if (b) b.onclick = () => { sim = false; map._adsbSimOn = false; simulate(null, false); draw(); };
      }
      const fn = () => draw();
      listeners.add(fn);
      map.on("unload", () => listeners.delete(fn));
      map._adsbSim = (on) => { sim = on; if (on && map.getZoom() < 10) map.setZoom(10); simulate(map.getCenter(), on); draw(); };
    });
    window.AeroMapTools = {
      items: (map) => [
        window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.AeroGdl90 ? ["adsb", "ADS-B traffic", "Connect to your receiver's Wi-Fi first"] : null,
        ["adsbsim", map._adsbSimOn ? "Stop traffic simulator" : "Traffic simulator", "Practice targets around the map center"],
      ].filter(Boolean),
      run: async (t, map) => {
        if (t === "adsbsim") { map._adsbSimOn = !map._adsbSimOn; map._adsbSim(map._adsbSimOn); }
        if (t === "adsb") { try { const ok = await connectNative(); toast(ok ? "Listening for your ADS-B receiver" : "ADS-B needs the AeroSignal app"); listeners.forEach((f) => f()); } catch (e) { toast("Could not start ADS-B: " + (e.message || e)); } }
      },
    };
  }

  window.AeroADSB = { crc, frames, frame, decode, encodeReport, feed, targets, simulate, connectNative, get own() { return own; }, get geoAlt() { return geoAlt; } };
})();
