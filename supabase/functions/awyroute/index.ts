import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db, dbMode } from "./db.ts";

// Airway router: finds a chain of published airways between two points, the way an EFB
// route builder does. Read only; uses the FAA airway segments already loaded.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const R = 3440.065, rad = Math.PI / 180;
const nm = (a: number[], b: number[]) => {
  const x = Math.sin((b[0] - a[0]) * rad / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin((b[1] - a[1]) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

class Heap {
  a: [number, string][] = [];
  push(x: [number, string]) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0]; const last = a.pop()!; if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const p = (k: string) => (u.searchParams.get(k) || "").split(",").map(Number);
  const A = p("from"), B = p("to");
  const high = u.searchParams.get("level") === "high";
  if (A.length !== 2 || B.length !== 2 || [...A, ...B].some((x) => !isFinite(x)))
    return Response.json({ error: "from and to must be lat,lon" }, { status: 400, headers: CORS });
  const direct = nm(A, B);
  if (direct > 900) return Response.json({ error: "too far for one airway search" }, { status: 400, headers: CORS });
  const pad = Math.max(0.6, (direct * 0.3 + 30) / 60);
  const lat0 = Math.min(A[0], B[0]) - pad, lat1 = Math.max(A[0], B[0]) + pad;
  const cosl = Math.max(0.3, Math.cos(((A[0] + B[0]) / 2) * rad));
  const lon0 = Math.min(A[1], B[1]) - pad / cosl, lon1 = Math.max(A[1], B[1]) + pad / cosl;
  const levels = high ? ["U", "B"] : ["L", "B"];
  try {
    const sq = await db();
    const rows = await sq`
      select a.ident awy, s.ident si, s.lat sla, s.lon slo, e.ident ei, e.lat ela, e.lon elo,
             coalesce(a.length_nm, 0) len, greatest(coalesce(a.mea_e,0), coalesce(a.mea_w,0)) mea
      from airway_segments a
      join nas_points s on s.global_id = a.start_id
      join nas_points e on e.global_id = a.end_id
      where a.level = any(${levels})
        and s.lat between ${lat0} and ${lat1} and s.lon between ${lon0} and ${lon1}
        and e.lat between ${lat0} and ${lat1} and e.lon between ${lon0} and ${lon1}`;
    const node = new Map<string, { id: string; lat: number; lon: number }>();
    const adj = new Map<string, { to: string; awy: string; len: number; mea: number }[]>();
    const key = (id: string, la: number, lo: number) => `${id}|${la.toFixed(3)}|${lo.toFixed(3)}`;
    const add = (id: string, la: number, lo: number) => { const k = key(id, la, lo); if (!node.has(k)) { node.set(k, { id, lat: la, lon: lo }); adj.set(k, []); } return k; };
    for (const r of rows as any[]) {
      const s = add(r.si, r.sla, r.slo), e = add(r.ei, r.ela, r.elo);
      const len = r.len || nm([r.sla, r.slo], [r.ela, r.elo]);
      adj.get(s)!.push({ to: e, awy: r.awy, len, mea: r.mea }); adj.get(e)!.push({ to: s, awy: r.awy, len, mea: r.mea });
    }
    // on and off the airway system: short direct legs, penalized so the route rides airways
    const near = (P: number[], max: number) => [...node.entries()].map(([k, v]) => ({ k, d: nm(P, [v.lat, v.lon]) })).filter((x) => x.d <= max).sort((a, b) => a.d - b.d).slice(0, 12);
    let starts = near(A, 25), ends = near(B, 25);
    if (!starts.length) starts = near(A, 45);
    if (!ends.length) ends = near(B, 45);
    if (!starts.length || !ends.length) return Response.json({ found: false, reason: "no airways near one end", direct }, { headers: CORS });
    const endCost = new Map(ends.map((x) => [x.k, x.d * 1.6]));
    const CHANGE = 12;
    const dist = new Map<string, number>(), prev = new Map<string, string | null>();
    const h = new Heap();
    for (const s of starts) { const st = `${s.k}#`; const c = s.d * 1.6; dist.set(st, c); prev.set(st, null); h.push([c, st]); }
    let best: { c: number; st: string } | null = null;
    while (h.size) {
      const [c, st] = h.pop();
      if (c > (dist.get(st) ?? Infinity)) continue;
      if (best && c >= best.c) break;
      const [k, awy] = st.split("#");
      if (endCost.has(k)) { const tot = c + endCost.get(k)!; if (!best || tot < best.c) best = { c: tot, st }; }
      for (const e of adj.get(k) || []) {
        const nc = c + e.len + (awy && awy !== e.awy ? CHANGE : 0);
        const ns = `${e.to}#${e.awy}`;
        if (nc < (dist.get(ns) ?? Infinity)) { dist.set(ns, nc); prev.set(ns, st); h.push([nc, ns]); }
      }
    }
    if (!best) return Response.json({ found: false, reason: "no connected airways", direct }, { headers: CORS });
    const chain: { k: string; awy: string }[] = [];
    for (let st: string | null = best.st; st; st = prev.get(st) ?? null) { const [k, awy] = st.split("#"); chain.unshift({ k, awy }); }
    // compress to the filed form: entry fix, then airway and the fix where it ends
    const tokens: string[] = [node.get(chain[0].k)!.id];
    const fixes = chain.map((c) => ({ ...node.get(c.k)!, awy: c.awy || null }));
    for (let i = 1; i < chain.length; i++) {
      const cur = chain[i].awy, next = chain[i + 1]?.awy;
      if (cur !== next) tokens.push(cur, node.get(chain[i].k)!.id);
    }
    let along = 0;
    for (let i = 1; i < fixes.length; i++) along += nm([fixes[i - 1].lat, fixes[i - 1].lon], [fixes[i].lat, fixes[i].lon]);
    const on = nm(A, [fixes[0].lat, fixes[0].lon]), off = nm([fixes.at(-1)!.lat, fixes.at(-1)!.lon], B);
    return Response.json({
      found: true, route: tokens.join(" "), tokens, fixes,
      nm: Math.round(on + along + off), direct: Math.round(direct), on: Math.round(on), off: Math.round(off),
      airways: [...new Set(chain.map((c) => c.awy).filter(Boolean))],
    }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
