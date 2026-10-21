import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// NOTAM relay: current NOTAMs for up to 8 airports or navaids from the FAA NOTAM Search service. Read only.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const SRC = "https://notams.aim.faa.gov/notamSearch/search";

async function one(id: string) {
  const body = new URLSearchParams({ searchType: "0", designatorsForLocation: id, notamsOnly: "false", radius: "10", sortColumns: "5 false", sortDirection: "true", offset: "0" });
  const r = await fetch(SRC, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "Accept": "application/json, text/javascript, */*; q=0.01", "User-Agent": "Mozilla/5.0 (AeroSignal preflight relay)", "Origin": "https://notams.aim.faa.gov", "Referer": "https://notams.aim.faa.gov/notamSearch/nsapp.html", "X-Requested-With": "XMLHttpRequest" },
    body,
    signal: AbortSignal.timeout(12000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`FAA NOTAM search ${r.status}`);
  const j = JSON.parse(txt);
  return (j.notamList || []).filter((n: any) => !n.cancelledOrExpired).slice(0, 120).map((n: any) => ({
    loc: n.facilityDesignator || id,
    num: n.notamNumber || "",
    kw: n.keyword || "",
    feature: n.featureName || "",
    start: n.startDate || "",
    end: n.endDate || "",
    text: String(n.traditionalMessageFrom4thWord || n.traditionalMessage || n.icaoMessage || "").slice(0, 1500),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const ids = [...new Set((u.searchParams.get("ids") || "").toUpperCase().split(/[\s,]+/).map((s) => s.replace(/[^A-Z0-9]/g, "")).filter((s) => s.length >= 3 && s.length <= 5))].slice(0, 8);
  if (!ids.length) return Response.json({ error: "Give one or more airport or navaid identifiers" }, { status: 400, headers: CORS });
  const out: Record<string, unknown> = {};
  const errs: string[] = [];
  await Promise.all(ids.map(async (id) => { try { out[id] = await one(id); } catch (e) { errs.push(`${id}: ${String(e).slice(0, 160)}`); } }));
  const status = Object.keys(out).length ? 200 : 502;
  return Response.json({ source: "FAA NOTAM Search", at: new Date().toISOString(), notams: out, errors: errs }, { status, headers: { ...CORS, "Cache-Control": "public, max-age=600" } });
});
