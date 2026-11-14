"use strict";
/* p190: What's new (November 8, 2026). Testers kept asking for features that already existed (a point by
   point route list, filing help, flying a route ahead of time). A small card at the top of the Plan page lists
   what was added since their last visit (returning pilots only; titles only on phones), each with a link that opens it. It shows again only when something
   new is added, and Hide puts it away. It is also reachable at any time from More. Saved on this device only. */
(function () {
  const VER = "2026-11-13f", KEY = "vg_whatsnew";
  const ITEMS = [
    ["#/airports", "Pilot comments on airports", "Share what a visiting pilot should know about an airport, such as FBO service, the ramp or local procedures. Comments are reviewed before they show, without names, and appear on the airport page and in the brief."],
    ["#/maps", "Lightning, free", "Lightning from the last 15 minutes on the map, a lightning check along your route in the brief, and the nearest lightning on the Fly screen, from free NOAA data."],
    ["#/logbook", "Logbook tags", "Tag flights (checkride, mountain, training) in the flight dialog and filter by tag in Find flights."],
    ["#/brief", "Route weather profile", "A side view of your route in the brief: terrain, your planned altitude, reported cloud bases, the freezing level and winds."],
    ["#/fly", "Descent cue", "The Fly screen tells you when to start down and the descent rate needed to reach pattern altitude."],
    ["#/fly", "The Fly screen records your flight", "Fly with the Fly screen and your track is recorded for the debrief and your logbook, with no other app needed."],
    ["#/brief", "Decision points", "The brief places turn back, fuel and destination weather decisions on your route, and the Fly screen shows each one as you reach it."],
    ["#/more", "Sport pilot check (MOSAIC)", "Fly as a sport pilot? Turn it on under More, Your certificate, and each brief checks the flight against the MOSAIC sport pilot privileges."],
    ["#/brief", "FAA weather cameras", "The brief links to FAA weather cameras and the Aviation Weather Center forecasts, with their low altitude mode for helicopters."],
    ["#/maps", "Easier map navigation", "Full map makes the chart fill the screen, Route brings your route back into view, and tapping an accident in the list now shows it on the map."],
    ["#/brief", "Accidents along your route", "The brief now lists the accidents within 10 nm of your route, with the most relevant to your flight first and a tag for why."],
    ["#/fly", "Terrain without signal", "Save a flight for offline and the terrain along the route is saved too, so terrain ahead on the Fly screen works with no signal."],
    ["#/preview", "Preview in 3D", "Fly your route over 3D terrain before you go, with towers, current cloud bases, training route altitude blocks and day or night lighting."],
    ["#/fly", "Terrain ahead on the Fly screen", "The Fly screen warns when the ground or a tall obstacle in the next 5 nm comes within 1,000 ft of your GPS altitude."],
    ["#/brief", "Fuel stops and fuel at airports", "From FAA airport data: the brief suggests public fuel stops when the trip is longer than your range, checks your destination's attended hours at your arrival time, and lists only public use diversion airports, with fuel."],
    ["#/more", "Replies to your feedback", "Feedback you send now shows its status and a reply under More, Your feedback."],
    ["#/maps", "Route list and VFR checkpoints", "Maps has a Route tab that lists every point with course and distance, and adds checkpoints about every 20 nm."],
    ["#/flights", "Avoid special use airspace", "Reroute around restricted areas, warning areas and MOAs at your altitude, with Undo."],
    ["#/brief", "Filing help and known issues", "The brief's flight plan sheet copies each item for 1800wxbrief.com and downloads a .fpl for your EFB; a new section shows FAA mechanic reports for your aircraft type."],
    ["#/flights", "Type routes the way you say them", "\"KPNS to KJKA\" now works; words like to, then and via are ignored."],
  ];
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = document.createElement("style");
  css.textContent = `
    #wnCard{border:1px solid var(--line2,rgba(255,255,255,.14));border-radius:14px;padding:12px 14px;margin:0 0 14px;background:rgba(127,127,127,.06)}
    #wnCard .wn-h{display:flex;justify-content:space-between;align-items:center;gap:10px}
    #wnCard h2{margin:0;font-size:16px}
    #wnCard ul{margin:8px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
    #wnCard li a{display:block;padding:8px 10px;border-radius:10px;border:1px solid var(--line2,rgba(255,255,255,.1));text-decoration:none;color:inherit;height:100%;box-sizing:border-box}
    #wnCard li a:hover{border-color:currentColor}
    #wnCard li b{display:block;margin-bottom:2px}
    #wnCard li span{font-size:13px;opacity:.85}
    @media (max-width:640px){#wnCard ul{display:flex;flex-wrap:wrap;gap:6px}#wnCard li a{padding:6px 10px;border-radius:16px}#wnCard li b{margin:0;font-size:13.5px}#wnCard li span{display:none}}`;
  document.head.appendChild(css);
  const seen = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
  function card(forced) {
    const el = document.createElement("section"); el.id = "wnCard";
    el.innerHTML = `<div class="wn-h"><h2>What's new in Vigilyn</h2><button type="button" class="btn sec sm" data-x>${forced ? "Close" : "Hide"}</button></div>
      <ul>${ITEMS.map(([href, t, d]) => `<li><a href="${href}"><b>${h(t)}</b><span>${h(d)}</span></a></li>`).join("")}</ul>`;
    el.querySelector("[data-x]").onclick = () => { try { localStorage.setItem(KEY, VER); } catch (e) {} el.remove(); };
    el.querySelectorAll("li a").forEach((a) => a.addEventListener("click", () => { try { localStorage.setItem(KEY, VER); } catch (e) {} }));
    return el;
  }
  function scan() {
    const hash = location.hash || "#/";
    const page = document.querySelector("#view .page");
    if (!page || page.querySelector("#wnCard")) return;
    // Only for returning pilots: someone on a first visit sees the Start here card instead
    let returning = false; try { returning = (S.flights || []).length > 0; } catch (e) {}
    if (/^#\/(plan)?$/.test(hash) && seen() !== VER && !returning) { try { if ((S.flights || []).length === 0) localStorage.setItem(KEY, VER); } catch (e) {} }
    if (/^#\/(plan)?$/.test(hash) && seen() !== VER && returning) {
      const h1 = page.querySelector("h1");
      const after = (h1 && h1.nextElementSibling && h1.nextElementSibling.classList.contains("lede")) ? h1.nextElementSibling : h1;
      if (after) after.after(card(false)); else page.prepend(card(false));
    }
    if (/^#\/more/.test(hash) && !page.querySelector("[data-wn]")) {
      const b = document.createElement("p"); b.dataset.wn = "1"; b.innerHTML = `<button type="button" class="btn sec sm">What's new in Vigilyn</button>`;
      b.querySelector("button").onclick = () => { const c = card(true); b.after(c); b.remove(); c.scrollIntoView({ behavior: "smooth", block: "start" }); };
      const h1 = page.querySelector("h1"); if (h1) h1.after(b); else page.prepend(b);
    }
  }
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { try { scan(); } catch (e) { console.error(e); } }, 400); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroWhatsNew = { VER, ITEMS };
})();
