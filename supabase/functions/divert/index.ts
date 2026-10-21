import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db, dbMode } from "./db.ts";

// Diversion airports along a route: public airports with a runway at least `min` feet long (paved only
// by default) within `r` nm of the route, with their distance off the route and how far along it they
// are. Read only. GET divert?pts=lat,lon;lat,lon;...&r=25&min=3000&paved=1
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const R = Math.PI / 180;
const PAVED = "^(ASP|CON|PEM|BIT|PAV|ASPH|CONC|ASPHALT|CONCRETE|TAR|MAC)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const pts = (u.searchParams.get("pts") || "").split(";").map((s) => s.split(",").map(Number)).filter((p) => p.length === 2 && p.every(isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180).slice(0, 80);
  if (!pts.length) return Response.json({ error: "pts required as lat,lon;lat,lon" }, { status: 400, headers: CORS });
  const r = Math.min(Math.max(parseFloat(u.searchParams.get("r") || "") || 25, 2), 50);
  const min = Math.min(Math.max(parseInt(u.searchParams.get("min") || "") || 3000, 0), 15000);
  const paved = u.searchParams.get("paved") !== "0";
  let a = 90, b = 180, c = -90, d = -180;
  for (const [la, lo] of pts) { a = Math.min(a, la); b = Math.min(b, lo); c = Math.max(c, la); d = Math.max(d, lo); }
  const pad = r / 60, padLo = r / (60 * Math.max(0.2, Math.cos(((a + c) / 2) * R)));
  if (c - a > 25 || d - b > 35) return Response.json({ error: "route too long for one lookup" }, { status: 400, headers: CORS });
  try {
    const s = await db();
    const rows = await s`
      select coalesce(nullif(a.icao_code,''), nullif(a.local_code,''), nullif(a.gps_code,''), a.ident) ident, a.name, a.type, a.lat, a.lon, a.elev_ft,
             max(w.length_ft)::int longest, bool_or(coalesce(w.lighted,false)) lit,
             (array_agg(w.surface order by w.length_ft desc))[1] surface,
             (array_agg(coalesce(w.le_ident,'') || '/' || coalesce(w.he_ident,'') order by w.length_ft desc))[1] rwy
      from public.airports a join public.runways w on w.airport_ref = a.id
      where a.type in ('small_airport','medium_airport','large_airport')
        and a.lat between ${a - pad} and ${c + pad} and a.lon between ${b - padLo} and ${d + padLo}
        and coalesce(w.length_ft,0) >= ${min}
        ${paved ? s`and upper(coalesce(w.surface,'')) ~ ${PAVED}` : s``}
      group by a.id limit 600`;
    // Distance from each airport to the route polyline, and the along route distance of the closest point
    const legs: { a: number[]; b: number[]; len: number; at: number }[] = [];
    let at = 0;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const len = 60 * Math.hypot(q[0] - p[0], (q[1] - p[1]) * Math.cos(((p[0] + q[0]) / 2) * R));
      legs.push({ a: p, b: q, len, at }); at += len;
    }
    const out = [];
    for (const x of rows as any[]) {
      let best = Infinity, along = 0;
      if (!legs.length) { best = 60 * Math.hypot(x.lat - pts[0][0], (x.lon - pts[0][1]) * Math.cos(x.lat * R)); }
      for (const L of legs) {
        const k = Math.cos(x.lat * R);
        const ax = (L.a[1] - x.lon) * k, ay = L.a[0] - x.lat, bx = (L.b[1] - x.lon) * k, by = L.b[0] - x.lat;
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
        const dd = 60 * Math.hypot(ax + t * dx, ay + t * dy);
        if (dd < best) { best = dd; along = L.at + t * L.len; }
      }
      if (best <= r) out.push({ ...x, off: Math.round(best * 10) / 10, along: Math.round(along * 10) / 10 });
    }
    out.sort((p, q) => p.along - q.along);
    return Response.json({ total_nm: Math.round(at * 10) / 10, r, min, paved, airports: out }, { headers: { ...CORS, "Cache-Control": "public, max-age=86400", "X-DB-Mode": dbMode } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
