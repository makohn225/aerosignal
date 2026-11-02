"use strict";
/* p164: a clearer weight and balance envelope chart (November 2, 2026). The brief's Weight, balance and
   fuel panel (p72) draws a small envelope; this redraws it larger with a grid, axis titles, the
   airplane's own limits (forward limit line that slopes above its break weight, aft limit, max takeoff
   and max landing weight), and the takeoff and landing points with their weight and CG. Points outside
   the envelope turn red. Uses only the numbers already entered for that tail; nothing is assumed. */
(function () {
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : null; };
  const css = document.createElement("style");
  css.textContent = `
    #wbPanel .wb-out:has(.wbx-wrap){grid-template-columns:minmax(0,1fr) minmax(280px,380px)}
    @media (max-width:760px){#wbPanel .wb-out:has(.wbx-wrap){grid-template-columns:1fr}}
    #wbPanel svg.wbx{width:100%;max-width:400px;height:auto;display:block;background:rgba(0,0,0,.18);border-radius:12px;border:1px solid var(--line2)}
    #wbPanel svg.wbx text{font:10px var(--mono,monospace);fill:var(--ink2,#9db2ce)}
    #wbPanel svg.wbx .tt{font:600 10.5px var(--body,system-ui);fill:var(--ink2,#9db2ce)}
    #wbPanel svg.wbx .pl{font:700 11px var(--mono,monospace)}
    #wbPanel .wbx-wrap{min-width:0;max-width:400px}
    #wbPanel .wbx-cap{font-size:12px;color:var(--ink2);margin:4px 2px 0}
  `;
  document.head.appendChild(css);
  function fwdAt(wb, w) {
    const lo = num(wb.fwdLo), hi = num(wb.fwdHi), w1 = num(wb.fwdW), max = num(wb.maxTO);
    if (hi == null || w1 == null || !max || w <= w1) return lo;
    return lo + (hi - lo) * Math.min(1, (w - w1) / (max - w1));
  }
  function draw(wb, r) {
    const maxTO = num(wb.maxTO), maxLdg = num(wb.maxLdg) || maxTO, aft = num(wb.aft), fwdLo = num(wb.fwdLo);
    const cgs = [fwdLo, aft, r.to.cg, r.ld.cg];
    const lo = Math.floor(Math.min(...cgs) - 1), hi = Math.ceil(Math.max(...cgs) + 1);
    const wLo = Math.floor(Math.min(maxTO * 0.62, r.ld.w - 100) / 100) * 100, wHi = Math.ceil((Math.max(maxTO, r.to.w) + 60) / 100) * 100;
    const W = 400, H = 300, L = 52, R = 14, T = 14, B = 44;
    const x = (c) => L + ((c - lo) / (hi - lo)) * (W - L - R), y = (w) => T + (1 - (w - wLo) / (wHi - wLo)) * (H - T - B);
    let g = "";
    const cStep = hi - lo > 14 ? 2 : 1;
    for (let c = Math.ceil(lo / cStep) * cStep; c <= hi; c += cStep) g += `<line x1="${x(c)}" y1="${T}" x2="${x(c)}" y2="${H - B}" stroke="rgba(255,255,255,.07)"/><text x="${x(c)}" y="${H - B + 13}" text-anchor="middle">${c}</text>`;
    const wStep = wHi - wLo > 700 ? 200 : 100;
    for (let w = wLo; w <= wHi; w += wStep) g += `<line x1="${L}" y1="${y(w)}" x2="${W - R}" y2="${y(w)}" stroke="rgba(255,255,255,.07)"/><text x="${L - 5}" y="${y(w) + 3}" text-anchor="end">${w.toLocaleString("en-US")}</text>`;
    const brk = Math.min(num(wb.fwdW) || maxTO, maxTO);
    const env = [[fwdLo, wLo], [fwdLo, brk], [fwdAt(wb, maxTO), maxTO], [aft, maxTO], [aft, wLo]];
    const poly = env.map(([c, w]) => `${x(c).toFixed(1)},${y(w).toFixed(1)}`).join(" ");
    const bad = (k) => r.probs.some((p) => p[1].includes(k));
    const toBad = bad("takeoff"), ldBad = bad("landing");
    const pt = (p, col, lab, below) => { const px = x(p.cg), py = y(p.w), ly = below ? py + 16 : py - 9, anchor = px + 150 > W - R ? "end" : "start", lx = anchor === "end" ? px - 8 : px + 8;
      return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5.5" fill="${col}" stroke="#04121f" stroke-width="1.5"/><text class="pl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" style="fill:${col}">${lab} ${Math.round(p.w).toLocaleString("en-US")} lb, ${p.cg.toFixed(1)} in</text>`; };
    const toAbove = r.to.w >= r.ld.w;
    const ldgLine = maxLdg < maxTO ? `<line x1="${x(fwdAt(wb, maxLdg))}" y1="${y(maxLdg)}" x2="${x(aft)}" y2="${y(maxLdg)}" stroke="#5aa9ff" stroke-dasharray="4 3"/><text x="${x(aft) - 4}" y="${y(maxLdg) - 4}" text-anchor="end">max landing</text>` : "";
    return `<svg class="wbx" viewBox="0 0 ${W} ${H}" role="img" aria-label="Center of gravity envelope. Takeoff ${Math.round(r.to.w)} pounds at ${r.to.cg.toFixed(1)} inches, landing ${Math.round(r.ld.w)} pounds at ${r.ld.cg.toFixed(1)} inches. ${toBad || ldBad ? "Outside limits." : "Within limits."}">
      ${g}
      <polygon points="${poly}" fill="rgba(61,224,255,.1)" stroke="#3DE0FF" stroke-width="1.6"/>
      <text x="${x(aft) - 4}" y="${y(maxTO) - 4}" text-anchor="end">max takeoff ${maxTO.toLocaleString("en-US")}</text>${ldgLine}
      <line x1="${x(r.to.cg)}" y1="${y(r.to.w)}" x2="${x(r.ld.cg)}" y2="${y(r.ld.w)}" stroke="#9fb0c8" stroke-width="1.4" stroke-dasharray="4 3"/>
      ${pt(r.to, toBad ? "#ff4d6a" : "#46e39b", "TO", !toAbove)}${pt(r.ld, ldBad ? "#ff4d6a" : "#5aa9ff", "LDG", toAbove)}
      <text class="tt" x="${(L + W - R) / 2}" y="${H - 8}" text-anchor="middle">Center of gravity (inches aft of datum)</text>
      <text class="tt" transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Weight (lb)</text>
    </svg>`;
  }
  function apply() {
    if (!/^#\/brief/.test(location.hash || "")) return;
    const sec = document.getElementById("wbPanel");
    const old = sec && sec.querySelector(".wb-out > svg:not(.wbx)");
    if (!old || !window.AeroWB) return;
    let f = null; try { f = currentFlight(); } catch {}
    const wb = f && ((S.profiles || {})[f.tail] || {}).wb;
    if (!wb) return;
    try {
      const r = AeroWB.calc(f, wb);
      const box = document.createElement("div"); box.className = "wbx-wrap";
      box.innerHTML = draw(wb, r) + `<p class="wbx-cap">The shaded area is ${(f.tail || "this airplane")}'s envelope from its own numbers. The dashed line shows the CG moving as fuel burns.</p>`;
      old.replaceWith(box);
    } catch (e) { console.error(e); }
  }
  new MutationObserver(apply).observe(document.getElementById("view") || document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", () => setTimeout(apply, 300));
  window.AeroWBChart = { draw };
})();
