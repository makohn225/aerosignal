"use strict";
/* p190: What's new (November 8, 2026). Testers kept asking for features that already existed (a point by
   point route list, filing help, flying a route ahead of time). A small card at the top of the Plan page lists
   what was added since their last visit (returning pilots only; titles only on phones), each with a link that opens it. It shows again only when something
   new is added, and Hide puts it away. It is also reachable at any time from More. Saved on this device only. */
(function () {
  const VER = "2026-11-08", KEY = "vg_whatsnew";
  const ITEMS = [
    ["#/preview", "Preview in 3D", "Fly your route over 3D terrain before you go, with towers and other tall obstacles shown, at your altitude or a set height above the ground."],
    ["#/maps", "Route list and VFR checkpoints", "Maps has a Route tab that lists every point with course and distance, and adds checkpoints about every 20 nm."],
    ["#/flights", "Avoid special use airspace", "Reroute around restricted areas, warning areas and MOAs at your altitude, with Undo."],
    ["#/fly", "Fly screen", "Groundspeed, next waypoint, time and fuel to the destination and the nearest airports, from your phone's GPS."],
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
