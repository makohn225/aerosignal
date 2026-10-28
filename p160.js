"use strict";
/* p160: faster first load on phones (October 28, 2026). Loaded right after p1 and before p16, because
   it has to be in place before p16 asks for the military symbol library at startup.
   1. The military symbol library (milsymbol from jsDelivr, the largest download after the app itself)
      is only needed for mission diagrams. In Flight School mode it now waits until a Missions or
      kneeboard page opens or the pilot switches to Military Planning; in Military Planning mode it
      waits until the page has finished loading, so it no longer competes with the app on a slow
      connection. Everything that used it still works the same once it arrives.
   2. index.html: a placeholder in the main view ("Loading AeroSignal...") so a slow first visit never
      shows an empty screen, and an early connection (preconnect) to the data server. */
(function () {
  const SYM = /cdn\.jsdelivr\.net\/npm\/milsymbol@/;
  const held = [];
  const needed = () => {
    try { if (S.role && S.role !== "civil") return true; } catch {}
    return /^#\/(missions|kneeboard|oa)/.test(location.hash || "");
  };
  let loaded = document.readyState === "complete";
  window.addEventListener("load", () => { loaded = true; setTimeout(release, 300); });
  function release(force) {
    if (!held.length) return;
    const mil = (() => { try { return S.role && S.role !== "civil"; } catch { return false; } })();
    const missionPage = /^#\/(missions|kneeboard|oa)/.test(location.hash || "");
    if (!(force || missionPage || (mil && loaded))) return;
    while (held.length) { const [parent, node] = held.shift(); try { orig.call(parent, node); } catch (e) { console.error(e); } }
  }
  const orig = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    try {
      if (node && node.tagName === "SCRIPT" && SYM.test(node.src || "") && !(needed() && loaded) && !/^#\/(missions|kneeboard|oa)/.test(location.hash || "")) {
        held.push([this, node]);
        return node;
      }
    } catch {}
    return orig.call(this, node);
  };
  window.addEventListener("hashchange", () => release());
  // A switch to Military Planning (p153 sets body.mode-mil) releases it too
  const watch = () => new MutationObserver(() => { if (document.body.classList.contains("mode-mil")) release(); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);
  window.AeroBoot = { releaseSymbols: () => release(true), heldSymbols: () => held.length };

})();
