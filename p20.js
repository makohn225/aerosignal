"use strict";
/* Release readiness: privacy policy, terms of use, your data controls (export, delete on
   this device, account deletion request), installable app (manifest and offline shell). */
(function () {
  const UPDATED = "October 6, 2026";
  const DRAFT = `<p class="lgdraft">Draft for review. This text has not yet been reviewed by an attorney and will be updated before public release.</p>`;

  const css = document.createElement("style");
  css.textContent = `
    .legal h2{margin-top:22px}.legal p,.legal li{line-height:1.6}.legal ul{padding-left:20px}
    .lgdraft{border:1px solid rgba(255,181,71,.5);background:rgba(255,181,71,.08);color:var(--amber);border-radius:10px;padding:10px 12px;font-size:13.5px}
    .lgnav{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}
    .lgwarn{color:#ff4d6a;font-weight:700}
    .dz{border-color:rgba(255,59,92,.45)!important}
    .dz .btn.bad{background:#ff3b5c;border-color:#ff3b5c;color:#fff}
  `;
  document.head.appendChild(css);

  const nav = (cur) => `<div class="lgnav"><a class="btn ${cur === "privacy" ? "" : "sec"} sm" href="#/privacy">Privacy policy</a><a class="btn ${cur === "terms" ? "" : "sec"} sm" href="#/terms">Terms of use</a><a class="btn sec sm" href="#/data">Your data</a></div>`;

  function pagePrivacy(el) {
    el.innerHTML = `<div class="page legal">
      <h1>Privacy policy</h1><p class="lede">Last updated ${UPDATED}</p>${nav("privacy")}${DRAFT}
      <h2>The short version</h2>
      <ul>
        <li>Your logbook, flights, missions and kneeboard data are stored in your browser on your device. They are not uploaded to our servers.</li>
        <li>If you create an account, we store your email address and the profile details you enter.</li>
        <li>Feedback you send is stored so it can be read and acted on.</li>
        <li>To look up accidents, airspace, terrain and map tiles, the app sends route coordinates to the services listed below.</li>
        <li>We do not sell your data, show advertising or use third party analytics or tracking.</li>
      </ul>
      <p class="lgwarn">Never enter controlled unclassified information (CUI) or classified information in AeroSignal. The app is not accredited to store or process it.</p>
      <h2>Information stored on your device</h2>
      <p>Logbook imports, aircraft, flights, routes, missions, objective area files, comm cards and settings are kept in your browser's local storage on the device you use. They stay there until you delete them, clear your browser data or uninstall the app. You can export or delete this data at any time on the <a href="#/data">Your data</a> page.</p>
      <h2>Information we store</h2>
      <ul>
        <li><b>Account.</b> Email address, a securely hashed password, and the optional profile fields you enter: name, callsign, service, role, aircraft and organization. We use these to sign you in and to support account features.</li>
        <li><b>Feedback.</b> The message, rating, the page you were on, your browser type, the app version and, if you provide it or are signed in, your email address.</li>
        <li><b>Service requests.</b> When the app looks up accidents, airports, airways, training routes or obstacles near a route, it sends the route coordinates to our database. These lookups are not tied to your account and are not kept as a history of your flights.</li>
      </ul>
      <h2>Services the app connects to</h2>
      <ul>
        <li>Supabase, which hosts our database and accounts.</li>
        <li>Vercel, which hosts the app.</li>
        <li>Federal Aviation Administration public data services, for charts, airspace and obstacles.</li>
        <li>OpenStreetMap and public elevation tile services, for map and terrain tiles.</li>
        <li>Public code libraries loaded from cdnjs and jsDelivr, and fonts from Google Fonts.</li>
      </ul>
      <p>These services receive your device's IP address and the requests needed to provide their data, under their own privacy policies.</p>
      <h2>How long we keep information</h2>
      <p>Account information is kept while your account is open. When you ask us to delete your account, we delete your account and profile and remove your email address from any feedback you sent within 30 days. Feedback content may be kept without your identity to improve the app.</p>
      <h2>Your choices</h2>
      <p>You can use most of AeroSignal without an account. You can export or delete the data on your device, edit your profile, and request deletion of your account from the <a href="#/data">Your data</a> page or your account page.</p>
      <h2>Children</h2>
      <p>AeroSignal is intended for pilots and aviation professionals and is not directed to children under 13. We do not knowingly collect information from children.</p>
      <h2>Changes</h2>
      <p>If this policy changes, the date at the top will change, and significant changes will be announced in the app.</p>
      <h2>Contact</h2>
      <p>Questions or requests about privacy can be sent through the <a href="#/feedback">feedback page</a>.</p>
    </div>`;
  }

  function pageTerms(el) {
    el.innerHTML = `<div class="page legal">
      <h1>Terms of use</h1><p class="lede">Last updated ${UPDATED}</p>${nav("terms")}${DRAFT}
      <h2>Not for navigation</h2>
      <p>AeroSignal is a planning and safety awareness aid. It is not approved for navigation and does not replace official charts, publications, NOTAMs, weather briefings, aircraft manuals, or your unit's orders, procedures and approved mission planning systems. Altitudes, courses, times, airspace and accident locations are calculated from public data that may be incomplete, delayed or wrong. Always verify against official sources. The pilot in command remains responsible for the safety of every flight.</p>
      <h2>No controlled or classified information</h2>
      <p class="lgwarn">Do not enter, upload or store controlled unclassified information (CUI), classified information, privileged safety investigation material or other information you are not authorized to share. Use notional or publicly releasable data only.</p>
      <h2>Prototype</h2>
      <p>AeroSignal is an early prototype. Features may change, break or be removed, and data on your device could be lost. Export anything you want to keep.</p>
      <h2>Your account</h2>
      <p>Keep your password private and tell us through the feedback page if you think your account has been used without permission. We may suspend accounts that misuse the service.</p>
      <h2>Acceptable use</h2>
      <p>Do not try to disrupt the service, access other people's data, scrape the service at high volume or use it for anything unlawful.</p>
      <h2>Data sources</h2>
      <p>Accident records come from the National Transportation Safety Board. Charts, airspace, obstacles and training routes come from the Federal Aviation Administration and Department of Defense public sources. AeroSignal is not affiliated with or endorsed by these agencies, the Department of Defense or any military service.</p>
      <h2>Disclaimer and limits</h2>
      <p>The service is provided as is, without warranties of any kind, to the fullest extent the law allows. To the fullest extent the law allows, we are not liable for indirect, incidental or consequential damages, or for decisions made using the app.</p>
      <h2>Changes</h2>
      <p>We may update these terms. Continuing to use AeroSignal after a change means you accept the updated terms.</p>
      <h2>Contact</h2>
      <p>Send questions through the <a href="#/feedback">feedback page</a>.</p>
    </div>`;
  }

  const signedIn = () => typeof AUTH !== "undefined" && AUTH && AUTH.user;

  function pageData(el) {
    const n = (k) => (Array.isArray(S[k]) ? S[k].length : 0);
    const lb = (S.logbook && S.logbook.flights && S.logbook.flights.length) || 0;
    el.innerHTML = `<div class="page legal">
      <h1>Your data</h1><p class="lede">What AeroSignal keeps on this device and how to take it with you or remove it.</p>${nav("data")}
      <section class="panel"><h2>On this device</h2>
        <p style="margin-top:0">${fmt(lb)} logbook entries, ${n("flights")} flights and ${n("missions")} missions are stored in this browser. Nothing here is uploaded to our servers.</p>
        <div class="row" style="gap:8px"><button class="btn" id="dExp">Export everything (JSON)</button></div>
        <p class="small muted">The export includes your logbook, flights, missions, comm cards and settings, so you can keep a backup or move to another device.</p>
      </section>
      <section class="panel dz"><h2>Delete data on this device</h2>
        <p style="margin-top:0">Removes your logbook, flights, missions and settings from this browser. This cannot be undone, so export first if you want a copy. Your account, if you have one, is not affected.</p>
        <button class="btn bad" id="dDel">Delete data on this device</button>
      </section>
      <section class="panel dz"><h2>Delete your account</h2>
        ${signedIn() ? `<p style="margin-top:0">Signed in as <b>${esc(AUTH.user.email || "")}</b>. Your account and profile will be deleted and your email removed from any feedback within 30 days. Data on this device is not affected; delete it above if you want.</p>
        <button class="btn bad" id="dAcct">Request account deletion</button>` : `<p style="margin-top:0">You are not signed in. To delete an account, <a href="#/account">sign in</a> first, then come back to this page.</p>`}
        <div id="dMsg" class="small" style="margin-top:8px"></div>
      </section>
    </div>`;
    $("#dExp").onclick = () => {
      const stamp = new Date().toISOString().slice(0, 10);
      download(`aerosignal_backup_${stamp}.json`, JSON.stringify({ kind: "aerosignal.backup", v: 1, exported: new Date().toISOString(), data: S }, null, 1), "application/json");
    };
    $("#dDel").onclick = () => {
      if (!confirm("Delete all AeroSignal data on this device? This cannot be undone.")) return;
      for (const k of Object.keys(S)) delete S[k];
      try { localStorage.removeItem("aerosignal.v1"); } catch {}
      toast("Data on this device deleted");
      setTimeout(() => location.reload(), 600);
    };
    const a = $("#dAcct");
    if (a) a.onclick = () => requestDeletion($("#dMsg"), a);
  }

  async function requestDeletion(msgEl, btn) {
    if (!signedIn()) return;
    if (!confirm("Request deletion of your AeroSignal account? You will be signed out on this device.")) return;
    btn.disabled = true;
    btn.textContent = "Sending request…";
    try {
      await restFetch("feedback", { method: "POST", prefer: "return=minimal", body: { kind: "OTHER", area: "account", rating: null, message: `ACCOUNT DELETION REQUEST for ${AUTH.user.email} (user ${AUTH.user.id}). Delete the account and profile and remove the email from feedback within 30 days.`, email: AUTH.user.email, page: "#/data", user_agent: navigator.userAgent.slice(0, 400), app_version: typeof APP_VERSION !== "undefined" ? APP_VERSION : "" } });
      msgEl.className = "small";
      msgEl.textContent = "Request received. Your account will be deleted within 30 days and you will get an email when it is done.";
      const out = document.getElementById("sOut");
      if (out) out.click();
      else { try { localStorage.removeItem("aerosignal.auth"); } catch {} }
      btn.textContent = "Request sent";
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Request account deletion";
      msgEl.className = "small mtr-bad";
      msgEl.textContent = "The request could not be sent. Check your connection and try again, or ask through the feedback page.";
    }
  }

  ROUTES.privacy = pagePrivacy;
  ROUTES.terms = pageTerms;
  ROUTES.data = pageData;

  function decorate() {
    const h = location.hash || "";
    if (h.startsWith("#/more") && !document.getElementById("lgMore")) {
      const page = document.querySelector("#view .page") || document.getElementById("view");
      if (page) {
        const s = document.createElement("section");
        s.className = "panel";
        s.id = "lgMore";
        s.innerHTML = `<h2>Privacy and your data</h2><p style="margin-top:0">Your logbook and missions stay on this device. Export or delete them, or read the policies.</p><div class="row" style="gap:8px"><a class="btn sec sm" href="#/data">Your data</a><a class="btn sec sm" href="#/privacy">Privacy policy</a><a class="btn sec sm" href="#/terms">Terms of use</a></div>`;
        page.appendChild(s);
      }
    }
    const terms = document.getElementById("aTerms");
    if (terms && !document.getElementById("lgSign")) {
      const lab = terms.closest("label") || terms.parentNode;
      const p = document.createElement("div");
      p.id = "lgSign";
      p.className = "small";
      p.style.margin = "6px 0 0";
      p.innerHTML = `By creating an account you agree to the <a href="#/terms" target="_blank" rel="noopener">Terms of use</a> and <a href="#/privacy" target="_blank" rel="noopener">Privacy policy</a>.`;
      lab.after(p);
    }
    if (h.startsWith("#/account") && signedIn() && document.getElementById("sOut") && !document.getElementById("lgAcct")) {
      const sec = document.getElementById("sOut").closest("section");
      if (sec) {
        const s = document.createElement("section");
        s.className = "panel dz";
        s.id = "lgAcct";
        s.innerHTML = `<h2>Delete your account</h2><p style="margin-top:0">Deletes your account and profile within 30 days. Logbook and missions on this device are kept unless you delete them on the <a href="#/data">Your data</a> page.</p><button class="btn bad" id="lgDel">Request account deletion</button><div id="lgMsg" class="small" style="margin-top:8px"></div>`;
        sec.after(s);
        $("#lgDel").onclick = () => requestDeletion($("#lgMsg"), $("#lgDel"));
      }
    }
  }
  window.addEventListener("hashchange", () => setTimeout(decorate, 80));
  new MutationObserver(() => { if (document.getElementById("aTerms") && !document.getElementById("lgSign")) decorate(); if ((location.hash || "").startsWith("#/account") && document.getElementById("sOut") && !document.getElementById("lgAcct")) decorate(); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  setTimeout(decorate, 150);

  const head = document.head;
  const addLink = (rel, href, extra) => { if (head.querySelector(`link[rel="${rel}"]`)) return; const l = document.createElement("link"); l.rel = rel; l.href = href; if (extra) Object.assign(l, extra); head.appendChild(l); };
  addLink("manifest", "/manifest.webmanifest");
  addLink("apple-touch-icon", "/icons/apple-touch-icon.png");
  const meta = (name, content) => { if (head.querySelector(`meta[name="${name}"]`)) return; const m = document.createElement("meta"); m.name = name; m.content = content; head.appendChild(m); };
  meta("apple-mobile-web-app-capable", "yes");
  meta("mobile-web-app-capable", "yes");
  meta("apple-mobile-web-app-title", "AeroSignal");
  meta("apple-mobile-web-app-status-bar-style", "black-translucent");
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  const h0 = location.hash || "";
  if (h0.startsWith("#/privacy") || h0.startsWith("#/terms") || h0.startsWith("#/data")) go();
})();
