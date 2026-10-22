"use strict";
/* p121: flight alerts (approved October 22, 2026). With alerts on (signed in, notifications allowed),
   each upcoming flight on this device is listed with the server: route, departure and arrival time,
   flight rules, the departure, destination and alternate airports, the route points and this
   device's notification address (table flight_alerts, own rows only). Every 15 minutes the
   alertcheck function rechecks the weather, TFRs and closure NOTAMs for flights departing within
   4 hours. About 2 hours before departure it sends a short check, and if the weather gets worse, a
   new TFR appears near the route or a runway or airport closes, it sends an alert. Tapping one
   opens that flight's brief (#/alert/<flight id>). Rows are deleted after the flight, when a flight
   is deleted here, or when alerts are turned off. On iPhone, alerts need the app on the Home Screen. */
(function () {
  const FN = () => `${SUPA.url}/functions/v1/alertcheck`;
  const REST = () => `${SUPA.url}/rest/v1/flight_alerts`;
  const cfg = () => (S.alerts = S.alerts || { on: false, endpoint: "", sig: "" });
  const css = document.createElement("style");
  css.textContent = `
    #alPanel .al-st{font-size:13.5px;color:var(--ink2,#9db2ce);margin:8px 0 0}
    #alPanel .al-st b{color:#46e39b}
    #alPanel .al-st .err{color:#ffb648}
    #alPanel ul{margin:6px 0 4px 18px;padding:0;font-size:14px;line-height:1.55}
    #tdCard .td-al{font-size:12.5px;color:var(--ink2,#9db2ce);margin-top:8px}
    #tdCard .td-al a{color:var(--cyan,#3DE0FF)}
  `;
  document.head.appendChild(css);
  const authed = () => { try { return typeof AUTH !== "undefined" && AUTH && AUTH.user && AUTH.user.id ? AUTH : null; } catch { return null; } };
  const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent || "");
  const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const unb64u = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
  const depAt = (f) => { const d = new Date(`${f.date}T${String(f.time || "12:00").replace(/^(\d\d)(\d\d)$/, "$1:$2")}:00`); return isNaN(d) ? null : d; };
  function arrAt(f) { try { const p = profile(f); if (p.arrLocal && !isNaN(new Date(p.arrLocal))) return new Date(p.arrLocal); } catch {} const d = depAt(f); return d ? new Date(+d + 36e5) : null; }
  const icao = (id) => { id = String(id || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return /^[A-Z]{3}$/.test(id) ? "K" + id : id; };
  let status = "";

  function flights() {
    const now = Date.now();
    return (S.flights || []).filter((f) => f && !f.demo && (f.points || []).length >= 2 && depAt(f)).filter((f) => { const d = +depAt(f), a = +(arrAt(f) || d); return a > now && d < now + 7 * 864e5; });
  }
  function rowFor(f, sub, uid) {
    const pts = (f.points || []).filter((p) => isFinite(p.lat) && isFinite(p.lon));
    const ap = pts.filter((p) => p.kind === "airport");
    const dep = ap[0] || pts[0], dst = ap[ap.length - 1] || pts[pts.length - 1];
    const step = Math.max(1, Math.ceil(pts.length / 60));
    return {
      user_id: uid, flight_id: f.id, endpoint: sub.endpoint, sub,
      route: String(f.route || "").slice(0, 200), dep_at: depAt(f).toISOString(), arr_at: (arrAt(f) || depAt(f)).toISOString(), rules: f.rules || "VFR",
      idents: [icao(dep && dep.ident), icao(dst && dst.ident), icao(f.alternate)].map((x) => x || ""),
      pts: pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => [Math.round(p.lat * 1e4) / 1e4, Math.round(p.lon * 1e4) / 1e4]),
      updated_at: new Date().toISOString(),
    };
  }
  async function subscription() {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const r = await fetch(`${FN()}?pub=1`);
      const { pub } = await r.json();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(pub) });
    }
    return sub.toJSON();
  }
  let syncing = false, again = false;
  async function sync(force) {
    const c = cfg(), A = authed();
    if (!c.on || !A || !supported() || Notification.permission !== "granted") return;
    if (syncing) { again = true; return; }
    syncing = true;
    try {
      const sub = await subscription();
      const tok = await validToken();
      if (!tok) { status = "Sign in again to keep alerts working."; paint(); return; }
      const rows = flights().map((f) => rowFor(f, sub, A.user.id));
      const sig = JSON.stringify(rows.map((r) => [r.flight_id, r.dep_at, r.arr_at, r.route, r.idents, r.rules])) + sub.endpoint;
      if (!force && sig === c.sig) return;
      const H = { ...authHdr(tok) };
      if (rows.length) {
        const r = await fetch(`${REST()}?on_conflict=user_id,flight_id,endpoint`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
        if (!r.ok) throw new Error("save " + r.status);
      }
      // Flights no longer upcoming on this device leave the server
      const keep = rows.map((r) => `"${r.flight_id.replace(/"/g, "")}"`).join(",");
      const q = `endpoint=eq.${encodeURIComponent(sub.endpoint)}${rows.length ? `&flight_id=not.in.(${encodeURIComponent(keep)})` : ""}`;
      await fetch(`${REST()}?${q}`, { method: "DELETE", headers: H });
      c.endpoint = sub.endpoint; c.sig = sig; c.at = Date.now(); status = "";
      baseSave();
    } catch (e) { console.error(e); status = "Could not update alerts just now. It will try again."; }
    finally { syncing = false; paint(); if (again) { again = false; setTimeout(() => sync(), 1500); } }
  }
  async function turnOn() {
    if (!authed()) { toast("Sign in first to turn on flight alerts"); location.hash = "#/account"; return; }
    if (!supported()) { toast(ios() && !standalone() ? "On iPhone, add AeroSignal to your Home Screen first (Share, Add to Home Screen), then turn on alerts there." : "This browser cannot show alerts."); return; }
    if (ios() && !standalone()) { toast("On iPhone, add AeroSignal to your Home Screen first (Share, Add to Home Screen), then turn on alerts there."); return; }
    const p = await Notification.requestPermission();
    if (p !== "granted") { toast("Notifications are blocked. Allow them for AeroSignal in your browser settings, then try again."); return; }
    const c = cfg(); c.on = true; c.sig = ""; baseSave();
    await sync(true);
    try {
      const tok = await validToken(), sub = await subscription();
      await fetch(`${FN()}?test=1`, { method: "POST", headers: { ...authHdr(tok) }, body: JSON.stringify({ sub }) });
    } catch {}
    toast("Flight alerts are on. A test alert is on its way.");
    kick();
  }
  async function turnOff() {
    const c = cfg(); c.on = false; c.sig = ""; baseSave();
    try {
      const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
      const tok = await validToken();
      if (sub && tok) await fetch(`${REST()}?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, { method: "DELETE", headers: authHdr(tok) });
      if (sub) await sub.unsubscribe();
    } catch (e) { console.error(e); }
    toast("Flight alerts are off. Your flights were removed from the alert list.");
    paint(); kick();
  }

  function paint() {
    const sec = document.getElementById("alPanel");
    if (!sec) return;
    const c = cfg(), A = authed(), n = flights().length;
    sec.innerHTML = `<h2>Flight alerts</h2>
      <p class="small" style="margin:0">${c.on ? "Alerts are on for this device." : "Get a check about 2 hours before each departure, and an alert if things change."} AeroSignal rechecks every 15 minutes, starting 4 hours before departure:</p>
      <ul><li>Weather at the departure, destination and alternate</li><li>TFRs near the route</li><li>Runway and airport closure NOTAMs</li></ul>
      <p class="small muted" style="margin:0">To do this, each upcoming flight's route, departure time and alternate, and this device's notification address, are stored with your account until the flight is over.${ios() ? " On iPhone, add AeroSignal to your Home Screen first." : ""}</p>
      <div class="sy-row" style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px">${c.on ? `<button type="button" class="btn sec sm" data-al="off">Turn off alerts</button><button type="button" class="btn sec sm" data-al="test">Send a test alert</button>` : `<button type="button" class="btn sm" data-al="on"${A ? "" : " disabled"}>Turn on alerts</button>`}</div>
      <p class="al-st">${!A ? "Sign in to use flight alerts." : c.on ? (status ? `<span class="err">${status}</span>` : `<b>On</b> for ${n} upcoming flight${n === 1 ? "" : "s"}.`) : ""}</p>`;
    sec.querySelectorAll("[data-al]").forEach((b) => (b.onclick = async () => {
      const k = b.dataset.al;
      if (k === "on") turnOn(); else if (k === "off") turnOff();
      else if (k === "test") { try { const tok = await validToken(), sub = await subscription(); const r = await fetch(`${FN()}?test=1`, { method: "POST", headers: authHdr(tok), body: JSON.stringify({ sub }) }); toast(r.ok ? "Test alert sent" : "Could not send a test alert"); } catch { toast("Could not send a test alert"); } }
    }));
  }
  function panel() {
    if (!/^#\/account\/?$/.test(location.hash || "")) return;
    const page = document.querySelector("#view .page") || document.getElementById("view");
    if (!page || document.getElementById("alPanel")) return;
    const sec = document.createElement("section"); sec.className = "panel"; sec.id = "alPanel";
    const sy = document.getElementById("syncPanel");
    if (sy) sy.after(sec); else { const first = page.querySelector("section.panel"); if (first) first.after(sec); else page.appendChild(sec); }
    paint();
  }
  function today() {
    const c = document.getElementById("tdCard");
    if (!c) return;
    const on = cfg().on && supported() && Notification.permission === "granted";
    const html = on ? "Flight alerts are on for this flight." : `<a href="#" data-al="1">Turn on flight alerts</a> for a weather check 2 hours before departure.`;
    let d = c.querySelector(".td-al");
    if (d && d.dataset.v === html) return;
    if (!d) { d = document.createElement("div"); d.className = "td-al"; c.appendChild(d); }
    d.dataset.v = html; d.innerHTML = html;
    const a = d.querySelector("a"); if (a) a.onclick = (e) => { e.preventDefault(); turnOn(); };
  }
  // Notification taps open #/alert/<flight id>
  if (typeof ROUTES !== "undefined") ROUTES.alert = () => {
    const id = decodeURIComponent((location.hash.split("/")[2] || "").split("?")[0]);
    if (id && (S.flights || []).some((f) => f.id === id)) { S.currentId = id; try { save(); } catch {} }
    location.replace("#/brief");
  };
  navigator.serviceWorker && navigator.serviceWorker.addEventListener && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.asOpen) location.href = e.data.asOpen; });

  // Keep the server list in step with this device's flights
  const baseSave = save;
  let tm = 0;
  save = function () { const r = baseSave.apply(this, arguments); try { if (cfg().on) { clearTimeout(tm); tm = setTimeout(() => sync(), 5000); } } catch {} return r; };
  let t = 0;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { panel(); today(); } catch (e) { console.error(e); } }, 200); };
  new MutationObserver(kick).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", kick);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });
  setTimeout(() => sync(), 4000);
  if (/^#\/alert\//.test(location.hash || "")) setTimeout(() => { try { go(); } catch {} }, 0);
  kick();
  window.AeroAlerts = { turnOn, turnOff, sync, rowFor, flights };
})();
