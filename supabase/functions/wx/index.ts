import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Weather relay: aviationweather.gov does not allow browser (CORS) requests, so the app calls this instead.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const UA = "AeroSignal/0.1 (preflight risk prototype)";
const cache = new Map<string, { at: number; body: unknown }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const ids = (u.searchParams.get("ids") || "").toUpperCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.length || ids.length > 10 || !ids.every((i) => /^[A-Z][A-Z0-9]{3}$/.test(i)))
    return Response.json({ error: "ids must be 1 to 10 four character ICAO identifiers" }, { status: 400, headers: CORS });
  const key = [...ids].sort().join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return Response.json({ ...(hit.body as object), cached: true }, { headers: CORS });
  const base = "https://aviationweather.gov/api/data";
  const get = async (p: string) => {
    const r = await fetch(`${base}/${p}?ids=${key}&format=json`, { headers: { "User-Agent": UA } });
    if (r.status === 204) return [];
    if (!r.ok) throw new Error(`${p} ${r.status}`);
    return await r.json();
  };
  try {
    const [metar, taf] = await Promise.all([get("metar"), get("taf")]);
    const body = {
      fetched_at: new Date().toISOString(), source: "aviationweather.gov Data API",
      metar: (metar as any[]).map((m) => ({ station: m.icaoId, obs_time: m.reportTime ?? m.obsTime, raw: m.rawOb, flight_category: m.fltCat ?? null })),
      taf: (taf as any[]).map((t) => ({ station: t.icaoId, issued: t.issueTime, raw: t.rawTAF })),
    };
    cache.set(key, { at: Date.now(), body });
    return Response.json(body, { headers: CORS });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
