"use strict";
/* p198: pick the military aircraft for the demo's sample flight (November 11, 2026). The military demo profile is
   a notional MV-22B pilot. A visitor from another community can now choose their own aircraft on the demo page.
   The choice is used for the sample flight (so its brief and load computation are for that type; accident
   matching for military types is by theme, since the NTSB record is civil); the sample logbook and the sample missions are unchanged and the page says so, because swapping the
   name on an MV-22B career would read wrong to anyone who flies something else. Before this the military
   sample flight used the first aircraft in the logbook, a T-6B. The choice is remembered on this device. */
(function () {
  const KEY = "vg_demo_mil", DEF = "MV-22B";
  const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const types = () => { try { return (AeroMilFlight.TYPES || []).filter(([g]) => /^Military/.test(g)); } catch (e) { return []; } };
  const all = () => types().flatMap(([, l]) => l.map((t) => ({ code: t[0], name: t[1], tas: t[2] })));
  const get = () => { let v = DEF; try { v = localStorage.getItem(KEY) || DEF; } catch (e) {} return all().some((t) => t.code === v) ? v : DEF; };
  const css = document.createElement("style");
  css.textContent = `
    #dmAc{margin:14px 0 0;display:flex;gap:8px 12px;align-items:center;flex-wrap:wrap;font-size:14px}
    #dmAc label{display:flex;gap:8px;align-items:center;margin:0;text-transform:none;letter-spacing:normal;font-size:14px;color:inherit}
    #dmAc select{font:inherit;font-size:16px;padding:8px 10px;border-radius:9px;border:1px solid var(--line2,rgba(255,255,255,.2));background:#06101d;color:var(--ink,#EAF2FF);max-width:100%}`;
  document.head.appendChild(css);
  function apply() {
    const t = all().find((x) => x.code === get()); if (!t) return;
    const f = (S.flights || []).find((x) => x.demo); if (!f) return;
    S.profiles = S.profiles || {};
    const p = (S.profiles[t.code] = S.profiles[t.code] || {});
    p.typeCode = t.code; p.model = t.name; p.mil = true; if (!p.tas) p.tas = t.tas;
    f.tail = t.code; f.updated = Date.now();
    try { save(); } catch (e) {}
  }
  // The demo's own loader picks the flight's aircraft; set ours after it finishes
  if (typeof startDemo === "function") {
    const orig = startDemo;
    startDemo = async function (profile, btns, status) { // eslint-disable-line no-global-assign
      const r = await orig.apply(this, arguments);
      try { if (profile === "military" && S.demoLoaded === "military") apply(); } catch (e) { console.error(e); }
      return r;
    };
  }
  function scan() {
    if (!/^#\/(demo|welcome)/.test(location.hash || "")) return;
    const wrap = document.querySelector("#view .wchoice"); if (!wrap || document.getElementById("dmAc") || !types().length) return;
    const cur = get(), d = document.createElement("div"); d.id = "dmAc";
    d.innerHTML = `<label>Military aircraft for the sample flight<select aria-label="Military aircraft for the sample flight">${types().map(([g, l]) => `<optgroup label="${h(g)}">${l.map((t) => `<option value="${h(t[0])}"${t[0] === cur ? " selected" : ""}>${h(t[1])}</option>`).join("")}</optgroup>`).join("")}</select></label>
      <span class="small muted">Used for the sample flight's brief and load computation. The sample logbook and missions stay those of a notional MV-22B pilot.</span>`;
    d.querySelector("select").onchange = (e) => { try { localStorage.setItem(KEY, e.target.value); } catch (err) {} try { if (S.demoLoaded === "military") { apply(); toast(`Sample flight aircraft set to ${e.target.value}`); } } catch (err) {} };
    wrap.after(d);
  }
  let t = 0;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { try { scan(); } catch (e) { console.error(e); } }, 300); }).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.AeroDemoAircraft = { get, apply };
})();
