"use strict";
/* p181: file and fly from Vigilyn (November 4, 2026).
   1. Flight Service handoff on the Flight plan sheet (p151): tap any value to copy just that item, so filing
      on 1800wxbrief.com is copy and paste item by item; buttons open 1800wxbrief.com in a new tab, download
      the route as a .fpl file (Garmin Pilot, ForeFlight and most panel GPS units import it) and, on iPhone
      and iPad, open the route in ForeFlight. Vigilyn still does not file anything.
   2. Look and feel fixes from the November 4 review: no neon glow on text in the Gold theme (it blurred the
      route and identifiers), no glow on the active tab icon in Gold, and a roomier top bar on phones (theme
      button shows only its icon, brand shows only the logo) so the current flight chip is readable; the active tab reads dark gold in Gold; in Tactical,
      bold red disclaimers are counter tinted so they stay red (the theme tints the whole page). */
(function () {
  const css = document.createElement("style");
  css.textContent = `
    html.th-gold.day *{text-shadow:none!important}
    html.th-gold.day .tabs a.on svg{filter:none!important}
    html.th-gold.day .tabs a.on,html.th-gold.day .tabs a.on *{color:#e9d38c!important}
    html.th-tac .vg-red{filter:hue-rotate(100deg) saturate(1.7)}
    #fpPanel .fp-v.cp{cursor:copy}
    #fpPanel .fp-v.cp:hover{text-decoration:underline dotted}
    #fpPanel .fp-go{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
    @media (max-width:520px){
      .topbar #dayBtn{font-size:0!important;min-width:36px;padding-left:8px;padding-right:8px}
      .topbar #dayBtn::after{content:none!important}
      .topbar .brand{font-size:0!important;letter-spacing:0!important;gap:0!important}
      .topbar .brand>*:not(svg):not(img){display:none!important}
      .topbar .brand svg,.topbar .brand img{font-size:initial}
      .topbar #flightChip{max-width:none;flex:1 1 auto;min-width:0}
    }`;
  document.head.appendChild(css);

  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function copy(txt, what) {
    const ok = () => toast(`${what} copied`);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, () => toast("Could not copy. Select the text instead"));
    else toast("Could not copy. Select the text instead");
  }
  function routeString(f) {
    return String(f.route || "").toUpperCase().replace(/[,;]/g, " ").split(/\s+/).filter(Boolean).join(" ");
  }
  function enhance() {
    const sec = document.querySelector("#fpPanel");
    if (!sec || !/^#\/brief/.test(location.hash || "")) return;
    let f = null; try { f = currentFlight(); } catch (e) {}
    if (!f) return;
    sec.querySelectorAll(".fp-v:not(.todo):not(.cp)").forEach((v) => {
      v.classList.add("cp"); v.title = "Tap to copy";
      const k = v.previousElementSibling ? v.previousElementSibling.textContent.replace(/^\d+\s*/, "") : "Item";
      v.onclick = () => copy(v.textContent.replace(/\s*\(hours and minutes\)$/, "").replace(/ kt$/, ""), k);
    });
    if (sec.querySelector(".fp-go")) return;
    const btn = sec.querySelector("#fpCopy");
    if (!btn) return;
    const box = document.createElement("div"); box.className = "fp-go";
    const rs = routeString(f);
    box.innerHTML = `<a class="btn sm" href="https://www.1800wxbrief.com" target="_blank" rel="noopener">File on 1800wxbrief.com</a>
      <button type="button" class="btn sec sm" id="fpFpl">Download .fpl for your EFB</button>
      ${IOS && rs ? `<a class="btn sec sm" href="foreflightmobile://maps/search?q=${encodeURIComponent(rs)}">Open in ForeFlight</a>` : ""}`;
    btn.after(box);
    const p = document.createElement("p"); p.className = "small muted"; p.style.margin = "6px 0 0";
    p.textContent = "Tap any item above to copy just that item, then paste it into the matching box on 1800wxbrief.com.";
    box.after(p);
    box.querySelector("#fpFpl").onclick = () => {
      const pts = (f.points || []).filter((x) => x.ident);
      if (pts.length < 2 || typeof toFPL !== "function") return toast("Load a route first");
      const name = typeof fname === "function" ? fname(f) : "route";
      download(`${name}.fpl`, toFPL(pts), "application/xml");
    };
  }
  // Tactical tints the whole page olive with a filter, which turned the red disclaimers blue. Counter the tint on
  // bold red text so every disclaimer stays bold and red in all three themes.
  function reds() {
    if (!document.documentElement.classList.contains("th-tac")) return;
    document.querySelectorAll("#view *, .modal *, dialog *, #agreeBg *").forEach((e) => {
      if (e.classList.contains("vg-red") || !e.firstChild) return;
      const c = getComputedStyle(e);
      if ((c.color === "rgb(255, 77, 106)" || c.color === "rgb(255, 92, 108)") && +c.fontWeight >= 700 && !e.parentElement.closest(".vg-red")) e.classList.add("vg-red");
    });
  }
  let t = 0, tr = 0;
  const kickRed = () => { clearTimeout(tr); tr = setTimeout(() => { try { reds(); } catch (e) {} }, 500); };
  new MutationObserver(kickRed).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(kickRed).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { try { enhance(); } catch (e) { console.error(e); } }, 300); })
    .observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroFileFly = { enhance, routeString };
})();
