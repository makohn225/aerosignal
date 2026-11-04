"use strict";
/* p169: Vigilyn name (November 3, 2026).
   Shows the new product name, Vigilyn, wherever the app shows AeroSignal, without rewriting older modules.
   The owner approved on November 3, 2026 swapping only the name (no other wording) in the privacy policy, the terms of use
   and the agreement dialog, so those are renamed too. Internal names (storage keys, AeroXxx script APIs, file names) do not change. */
(function () {
  const OLD = /AeroSignal/g, NEW = "Vigilyn", HAS = (s) => typeof s === "string" && s.indexOf("AeroSignal") !== -1;
  const ATTRS = ["title", "aria-label", "placeholder", "alt", "content"];
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

  window.addEventListener("hashchange", () => setTimeout(() => { sweep(view()); brand(); }, 0));
  brand(); sweep(document.documentElement);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { brand(); sweep(document.documentElement); });
  window.AeroBrand = { name: NEW, sweep };
})();
