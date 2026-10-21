import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db, dbMode } from "./db.ts";

// Full NTSB narratives for a list of event ids, so the app can write a bottom line up front for each
// accident along a route. Read only.
//   GET ntsbtext?ids=20130822X45719,20220623105336
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const ids = [...new Set((u.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter((s) => /^[A-Z0-9]{6,20}$/i.test(s)))].slice(0, 300);
  if (!ids.length) return Response.json({ error: "ids required" }, { status: 400, headers: CORS });
  try {
    const sq = await db();
    const rows = await sq`
      select e.ev_id, e.injury_severity inj, coalesce(e.fatal,0) fatal, coalesce(e.serious,0) serious, e.phase, left(n.narrative, 6000) narrative
      from public.ntsb_events e left join public.ntsb_narratives n using (ev_id)
      where e.ev_id = any(${ids})`;
    return Response.json({ rows }, { headers: { ...CORS, "Cache-Control": "public, max-age=86400", "X-DB-Mode": dbMode } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
