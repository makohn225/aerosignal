"use strict";
/* p193: see a sample brief in one tap (November 9, 2026). The demo (p15) asks a new visitor to pick a profile and
   then walks a guided tour. Someone who only wants to see what Vigilyn does (a tester, a flight school owner,
   someone handed the link) gets a faster path: "See a sample brief" on the Start here card loads the same
   notional civilian sample (Manassas to Lynchburg) and opens its brief straight away, with no tour. A pilot who
   already has a logbook keeps it: only the sample flight is added. A small note on the brief says it is a sample
   and points to Maps, the 3D preview and planning your own. Stays in this browser like the rest of the demo. */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    #asWelcome .aw-row .sb-go{appearance:none;border:1px solid rgba(61,224,255,.6);background:transparent;color:inherit;border-radius:10px;padding:10px 14px;font:600 14px var(--body,system-ui);cursor:pointer}
    #asWelcome .sb-msg{font-size:13px;margin:6px 0 0;min-height:0}
    #sbNote{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:14px;padding:10px 14px;margin:0 0 14px;display:flex;gap:8px 12px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:rgba(127,127,127,.06)}
    #sbNote .sb-l{display:flex;gap:8px;flex-wrap:wrap}`;
  document.head.appendChild(css);
  const own = () => { try { return !!(S.logbook && S.logbook.flights && S.logbook.flights.length && !/^Demo /.test(S.logbook.source || "")); } catch (e) { return false; } };
  async function load() {
    const b = await loadDemoBundle();
    let aircraft = null;
    if (own()) aircraft = S.logbook.aircraft || {};
    else {
      const lb = importForeFlight(b.logbooks.civil);
      S.logbook = { ...lb, importedAt: Date.now(), source: "Demo civilian logbook" };
      aircraft = lb.aircraft || {};
      S.demoLoaded = "civil";
    }
    let f = (S.flights || []).find((x) => x.demo);
    const fresh = !f;
    if (!f) { f = newFlight(); f.demo = true; }
    f.route = b.flight.route; f.rules = b.flight.rules || "IFR"; f.missionId = undefined;
    const ac = Object.entries(aircraft).find(([, a]) => /C172|P28A|SR22/.test((a && a.typeCode) || ""));
    f.tail = (ac && ac[0]) || Object.keys(aircraft)[0] || f.tail;
    if (fresh || !f.date) { const d = new Date(Date.now() + 864e5); f.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; f.time = "10:00"; } // a daytime departure tomorrow
    try { const r = await resolveRoute(f.route); f.points = r.points; f.unresolved = r.unresolved; } catch (e) { f.points = f.points || []; }
    if (!f.points || f.points.length < 2) throw new Error("The sample route could not be loaded. Check your connection.");
    S.currentId = f.id; save();
    return f;
  }
  function card() {
    const row = document.querySelector("#asWelcome .aw-row");
    if (!row || row.querySelector(".sb-go") || typeof loadDemoBundle !== "function") return;
    const b = document.createElement("button"); b.type = "button"; b.className = "sb-go"; b.textContent = "See a sample brief";
    const m = document.createElement("p"); m.className = "sb-msg";
    row.appendChild(b); row.after(m);
    b.onclick = async () => {
      b.disabled = true; m.textContent = "Loading a sample flight…";
      try { await load(); location.hash = "#/brief"; }
      catch (e) { console.error(e); m.textContent = (e && e.message) || "The sample could not be loaded. Check your connection."; b.disabled = false; }
    };
  }
  function note() {
    const page = document.querySelector("#view .page"); if (!page || page.querySelector("#sbNote")) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!f || !f.demo || document.body.classList.contains("touring") || document.body.classList.contains("tut")) return;
    let hid = false; try { hid = sessionStorage.getItem("vg_sb_hide") === "1"; } catch (e) {}
    if (hid) return;
    const n = document.createElement("div"); n.id = "sbNote";
    n.innerHTML = `<span><b>This is a sample flight</b> with notional pilot data: Manassas to Lynchburg, Virginia.</span>
      <span class="sb-l"><a class="btn sec sm" href="#/maps">Accidents on the map</a><a class="btn sec sm" href="#/preview">Preview in 3D</a><a class="btn sm" href="#/plan">Plan your own</a><button type="button" class="btn sec sm" data-x>Hide</button></span>`;
    n.querySelector("[data-x]").onclick = () => { try { sessionStorage.setItem("vg_sb_hide", "1"); } catch (e) {} n.remove(); };
    const h1 = page.querySelector("h1"); if (h1) h1.before(n); else page.prepend(n); // above the title: brief panels are inserted after it
  }
  function scan() {
    const hash = location.hash || "#/";
    card();
    if (/^#\/brief/.test(hash)) note();
  }
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { try { scan(); } catch (e) { console.error(e); } }, 350); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroSampleBrief = { load };
})();
