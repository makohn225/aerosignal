"use strict";
/* p188: forgiving route entry (November 6, 2026). Pilots type routes the way they say them: "KPNS to KJKA",
   "PNS -> JKA", "KHEF then MRB then KHSP". Words like TO, THEN, VIA and FROM were being looked up as navaid
   identifiers, and the nearest match could be an NDB on another continent (there are TO beacons in Iceland,
   Zimbabwe and Indonesia), which threw the route across the world. Now:
   1. Arrows and filler words between points are dropped before lookup: TO, THEN, VIA, FROM, AND, OVER, ->.
   2. Any middle point that would add more than 300 nm and more than double its leg is left out and reported
      as not found, with a toast saying which and why, so a typo never sends the route overseas. */
(function () {
  if (typeof resolveRoute !== "function") return;
  const FILL = /^(TO|THEN|VIA|FROM|AND|OVER|INTO|ONTO|->|=>|→|>|-|–|—)$/;
  const R = Math.PI / 180;
  const nm = (a, b) => { const p1 = a.lat * R, p2 = b.lat * R, x = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2; return 6880.13 * Math.asin(Math.min(1, Math.sqrt(x))); };
  function clean(text) {
    const toks = String(text || "").replace(/(->|=>|→)/g, " ").split(/\s+/).filter(Boolean);
    if (toks.length < 3) return { text: String(text || ""), dropped: [] };
    const dropped = [], keep = [];
    toks.forEach((t, i) => { if (i > 0 && i < toks.length - 1 && FILL.test(t.toUpperCase())) dropped.push(t); else keep.push(t); });
    return { text: keep.join(" "), dropped };
  }
  const orig = resolveRoute;
  async function forgiving(text) {
    const c = clean(text);
    const r = await orig(c.text);
    if (!r || !Array.isArray(r.points) || r.points.length < 3) return r;
    const pts = r.points.slice(), far = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], p = pts[i], b = pts[i + 1];
      if (![a, p, b].every((x) => isFinite(x.lat) && isFinite(x.lon))) continue;
      const direct = nm(a, b), extra = nm(a, p) + nm(p, b) - direct;
      if (extra > 300 && extra > 2 * Math.max(direct, 1)) { far.push(`${p.ident}${p.name ? ` (${p.name})` : ""}`); pts.splice(i, 1); i--; }
    }
    if (!far.length) return c.text === String(text || "") ? r : { ...r, route: r.route || c.text.toUpperCase() };
    try { toast(`Left out ${far.join(", ")}: it is far off the route. Check the spelling.`); } catch (e) {}
    const route = String(r.route || c.text).split(/\s+/).filter((t) => !far.some((f) => f.split(" ")[0] === t.toUpperCase())).join(" ");
    return { ...r, points: pts, route, unresolved: [...(r.unresolved || []), ...far.map((f) => f.split(" ")[0])] };
  }
  try { window.resolveRoute = forgiving; } catch (e) {}
  try { resolveRoute = forgiving; } catch (e) {}
  window.AeroForgivingRoute = { clean, forgiving };
})();
