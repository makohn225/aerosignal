"use strict";
/* p169: Vigilyn name (November 3, 2026).
   Shows the new product name, Vigilyn, wherever the app shows AeroSignal, without rewriting older modules.
   The owner approved on November 3, 2026 swapping only the name (no other wording) in the privacy policy, the terms of use
   and the agreement dialog, so those are renamed too. Internal names (storage keys, AeroXxx script APIs, file names) do not change. */
(function () {
  const OLD = /AeroSignal/g, NEW = "Vigilyn", HAS = (s) => typeof s === "string" && s.indexOf("AeroSignal") !== -1;
  const ATTRS = ["title", "aria-label", "placeholder", "alt", "content"];
  const VOICE = {"e94828c4":["e94828c4v",10.1],"f5693bd0":["f5693bd0v",11.2],"365d1677":["365d1677v",8.7],"0c3faecb":["0c3faecbv",6.0],"b8d39b86":["b8d39b86v",7.3],"a019505e":["a019505ev",11.7],"9c0d8afa":["9c0d8afav",6.3],"d827aeac":["d827aeacv",6.5],"46b39487":["46b39487v",6.4],"1e71b21e":["1e71b21ev",11.4],"958cb98a":["958cb98av",7.7],"89f8c40d":["89f8c40dv",11.6],"2e80eead":["2e80eeadv",9.9],"9aee28b6":["9aee28b6v",9.2],"ddf25ca1":["ddf25ca1v",7.9],"bc4c7e54":["bc4c7e54v",10.7],"a1e179d4":["a1e179d4v",9.7],"7234af3a":["7234af3av",8.4],"e3a38e03":["e3a38e03v",9.0],"dde3ded3":["dde3ded3v",7.3],"9ab8d97e":["9ab8d97ev",10.8],"2f2bf074":["2f2bf074v",11.8],"100efd5a":["100efd5av",12.5],"01cb5053":["01cb5053v",7.8],"de6ca3e1":["de6ca3e1v",9.8],"aa67a255":["aa67a255v",10.5]};
  const view = () => document.getElementById("view");

  // Text people type stays as typed.
  function kept(n) {
    for (let e = n.nodeType === 1 ? n : n.parentNode; e && e.nodeType === 1; e = e.parentNode) {
      if (e.tagName === "SCRIPT" || e.tagName === "STYLE" || e.tagName === "TEXTAREA" || e.isContentEditable) return true;
    }
    return false;
  }

  function fixText(t) { if (HAS(t.nodeValue) && !kept(t)) t.nodeValue = t.nodeValue.replace(OLD, NEW); }
  function fixAttrs(el) {
    if (el.nodeType !== 1 || el.tagName === "SCRIPT") return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (HAS(v) && !kept(el)) el.setAttribute(a, v.replace(OLD, NEW)); }
    if ((el.tagName === "INPUT") && HAS(el.value) && el.type === "button") el.value = el.value.replace(OLD, NEW);
  }
  function sweep(root) {
    if (!root) return;
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) fixAttrs(root);
    if (!HAS(root.textContent) && !(root.querySelector && root.querySelector("[title],[aria-label],[placeholder],[alt],meta[content]"))) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) fixText(t);
    if (root.querySelectorAll) root.querySelectorAll(ATTRS.map((a) => `[${a}*="AeroSignal"]`).join(",")).forEach(fixAttrs);
  }

  function brand() {
    const b = document.querySelector(".topbar .brand");
    if (b && b.dataset.vg !== "1") { b.dataset.vg = "1"; b.innerHTML = "Vigil<span>yn</span>"; }
    if (HAS(document.title)) document.title = document.title.replace(OLD, NEW);
  }

  // Native dialogs cannot be reached in the page, so their text is renamed as it is shown.
  for (const k of ["confirm", "alert", "prompt"]) {
    const f = window[k];
    if (typeof f === "function") window[k] = function (m, ...r) { return f.call(window, HAS(m) ? m.replace(OLD, NEW) : m, ...r); };
  }

  let queued = new Set(), timer = 0;
  function flush() { timer = 0; const q = queued; queued = new Set(); q.forEach((n) => { if (n.isConnected) sweep(n); }); brand(); }
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") { if (HAS(m.target.nodeValue)) queued.add(m.target); }
      else if (m.type === "attributes") { if (HAS(m.target.getAttribute(m.attributeName))) queued.add(m.target); }
      else m.addedNodes.forEach((n) => queued.add(n));
    }
    if (queued.size && !timer) timer = setTimeout(flush, 0);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  // Spoken and copied text: the tutorial and intro scripts, the voice, shares, the clipboard and text downloads.
  const SITE = /aerosignal-app\.vercel\.app/g, swap = (s) => s.replace(OLD, NEW).replace(SITE, "flyvigilyn.vercel.app");
  try {
    (window.AeroPromo && AeroPromo.scenes || []).forEach((s) => { if (HAS(s.t)) s.t = swap(s.t); });
    const T = window.AeroTutorial && AeroTutorial.scripts;
    if (T) for (const k in T) (T[k] && T[k].scenes || []).forEach((s) => { if (HAS(s.text)) s.text = swap(s.text); });
  } catch (e) { console.error(e); }
  // Recorded natural voice for the renamed lines and the school and instructor tours (same voice as the other tutorials).
  try { if (window.AeroNarration && AeroNarration.manifest) Object.assign(AeroNarration.manifest, VOICE); } catch (e) { console.error(e); }
  const ss = window.speechSynthesis;
  if (ss && typeof ss.speak === "function") {
    const speak = ss.speak.bind(ss);
    ss.speak = function (u) { try { if (u && HAS(u.text)) u.text = swap(u.text); } catch (e) {} return speak(u); };
  }
  if (navigator.share) {
    const share = navigator.share.bind(navigator);
    navigator.share = (d) => share(d && typeof d === "object" ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "string" ? swap(v) : v])) : d);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    const wt = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (t) => wt(typeof t === "string" ? swap(t) : t);
  }
  // Text downloads (calendar, KML, CSV, printouts). JSON backups keep their exact content so they import anywhere.
  if (typeof Blob === "function") {
    const B = Blob;
    const VB = function (parts, opts) {
      const ty = (opts && opts.type) || "";
      if (Array.isArray(parts) && !/json/i.test(ty)) parts = parts.map((p) => typeof p === "string" && (HAS(p) || SITE.test(p)) ? (SITE.lastIndex = 0, swap(p)) : p);
      SITE.lastIndex = 0;
      return new B(parts, opts);
    };
    VB.prototype = B.prototype;
    try { window.Blob = VB; } catch (e) {}
  }

  window.addEventListener("hashchange", () => setTimeout(() => { sweep(view()); brand(); }, 0));
  brand(); sweep(document.documentElement);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { brand(); sweep(document.documentElement); });
  window.AeroBrand = { name: NEW, sweep };
})();
