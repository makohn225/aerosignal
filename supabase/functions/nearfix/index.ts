import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db, dbMode } from "./db.ts";

// Nearest fixes, navaids and airports to a point, for snapping map edits to named waypoints. Read only.
// only=report returns the nearest VOR or TACAN and nearest airports instead (position reports).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const lat = parseFloat(u.searchParams.get("lat") || ""), lon = parseFloat(u.searchParams.get("lon") || "");
  const r = Math.min(Math.max(parseFloat(u.searchParams.get("r") || "") || 5, 0.2), 30);
  if (!isFinite(lat) || !isFinite(lon)) return Response.json({ error: "lat and lon required" }, { status: 400, headers: CORS });
  const dlat = r / 60, dlon = r / (60 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  try {
    const s = await db();
    // only=report: the nearest VOR or TACAN and the nearest airports, for position reports
    if (u.searchParams.get("only") === "report") {
      const rows = await s`
        (select ident, kind, type_code as type, name, lat, lon,
                round((60 * sqrt(power(lat - ${lat}, 2) + power((lon - ${lon}) * cos(radians(${lat})), 2)))::numeric, 2)::float8 as nm
           from public.nas_points
          where kind = 'navaid' and type_code ~ '(VOR|TACAN)' and lat between ${lat - dlat} and ${lat + dlat} and lon between ${lon - dlon} and ${lon + dlon}
          order by nm asc limit 2)
        union all
        (select coalesce(nullif(icao_code,''), nullif(gps_code,''), ident) as ident, 'airport' as kind, type, name, lat, lon,
                round((60 * sqrt(power(lat - ${lat}, 2) + power((lon - ${lon}) * cos(radians(${lat})), 2)))::numeric, 2)::float8 as nm
           from public.airports
          where type in ('small_airport','medium_airport','large_airport') and lat between ${lat - dlat} and ${lat + dlat} and lon between ${lon - dlon} and ${lon + dlon}
          order by nm asc limit 8)`;
      return Response.json({ rows: (rows as any[]).filter((x) => x.nm <= r).sort((a, b) => a.nm - b.nm) }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
    }
    const rows = await s`
      with c as (
        select ident, kind, type_code as type, name, lat, lon from public.nas_points
          where lat between ${lat - dlat} and ${lat + dlat} and lon between ${lon - dlon} and ${lon + dlon}
        union all
        select coalesce(nullif(icao_code,''), nullif(gps_code,''), ident) as ident, 'airport' as kind, type, name, lat, lon from public.airports
          where type in ('small_airport','medium_airport','large_airport') and lat between ${lat - dlat} and ${lat + dlat} and lon between ${lon - dlon} and ${lon + dlon}
      )
      select ident, kind, type, name, lat, lon,
             round((60 * sqrt(power(lat - ${lat}, 2) + power((lon - ${lon}) * cos(radians(${lat})), 2)))::numeric, 2)::float8 as nm
      from c order by nm asc limit 6`;
    return Response.json({ rows: (rows as any[]).filter((x) => x.nm <= r) }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
