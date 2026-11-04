import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// FAA National Airspace System status relay (p175): ground stops, ground delay programs, arrival and
// departure delays, closures and the runway configuration in use, from nasstatus.faa.gov (public).
//   GET /functions/v1/nasstatus?ids=KPNS,KATL   (no ids = every airport with an event)
// The FAA lists only airports with something to report, mostly large airports. Cached two minutes.
// It also removes pilot airport reports (p175) older than 30 days, at most once an hour, as the approved
// privacy sentence promises (November 4, 2026).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const SRC = "https://nasstatus.faa.gov/api/airport-events";
let cache: { at: number; rows: any[] } | null = null;

const id3 = (s: string) => { const u = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return u.length === 4 && u[0] === "K" ? u.slice(1) : u; };
function slim(e: any) {
  const d = (x: any) => x ? { reason: x.reason || null, min: x.arrivalDeparture?.min || null, max: x.arrivalDeparture?.max || null, avg: x.averageDelay ? Number(x.averageDelay) : null, trend: x.trend || x.arrivalDeparture?.trend || null, updated: x.updateTime || null } : null;
  return {
    id: e.airportId, name: e.airportLongName || null,
    groundStop: e.groundStop ? { reason: e.groundStop.impactingCondition || e.groundStop.reason || null, end: e.groundStop.endTime || null, probability: e.groundStop.probabilityOfExtension || null } : null,
    groundDelay: e.groundDelay ? { reason: e.groundDelay.impactingCondition || e.groundDelay.reason || null, avg: e.groundDelay.avgDelay ?? null, max: e.groundDelay.maxDelay ?? null, end: e.groundDelay.endTime || null } : null,
    closure: e.airportClosure ? { text: e.airportClosure.simpleText || e.airportClosure.text || null, start: e.airportClosure.startTime || null, end: e.airportClosure.endTime || null } : null,
    notice: e.freeForm ? { text: e.freeForm.simpleText || e.freeForm.text || null, end: e.freeForm.endTime || null } : null,
    arrivalDelay: d(e.arrivalDelay), departureDelay: d(e.departureDelay),
    config: e.airportConfig ? { arr: e.airportConfig.arrivalRunwayConfig || null, dep: e.airportConfig.departureRunwayConfig || null, rate: e.airportConfig.arrivalRate ?? null, at: e.airportConfig.sourceTimeStamp || null } : null,
    deicing: !!e.deicing,
  };
}
let purgedAt = 0;
async function purgeReports() {
  if (Date.now() - purgedAt < 3_600_000) return;
  purgedAt = Date.now();
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const cut = new Date(Date.now() - 30 * 864e5).toISOString();
  try { await fetch(`${url}/rest/v1/airport_reports?created_at=lt.${encodeURIComponent(cut)}`, { method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" } }); } catch (_) { purgedAt = 0; }
}
async function rows() {
  if (cache && Date.now() - cache.at < 120_000) return cache.rows;
  const r = await fetch(SRC, { headers: { Accept: "application/json", "User-Agent": "Vigilyn/0.1 (preflight brief)" } });
  if (!r.ok) throw new Error(`FAA status ${r.status}`);
  const j = await r.json();
  cache = { at: Date.now(), rows: (Array.isArray(j) ? j : []).map(slim) };
  return cache.rows;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    purgeReports();
    const all = await rows();
    const q = new URL(req.url).searchParams.get("ids");
    const want = q ? new Set(q.split(",").map(id3).filter(Boolean).slice(0, 30)) : null;
    const out = want ? all.filter((x) => want.has(id3(x.id))) : all;
    return Response.json({ source: "FAA NAS Status (nasstatus.faa.gov)", fetched: new Date(cache!.at).toISOString(), listed: all.length, airports: out }, { headers: { ...CORS, "Cache-Control": "public, max-age=60" } });
  } catch (e) {
    return Response.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502, headers: CORS });
  }
});
