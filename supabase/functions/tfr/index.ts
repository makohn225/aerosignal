import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// TFR relay: tfr.faa.gov does not allow browser (CORS) requests, so the app calls this instead.
//   GET tfr            -> every current TFR area: id, title, type, state, polygon rings [[lon,lat],...]
//   GET tfr?id=6/6654  -> one TFR's details: active times, altitudes, purpose and NOTAM text
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const UA = "AeroSignal/0.1 (preflight risk prototype)";
const LIST_URL = "https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=2000&outputFormat=application/json&srsname=EPSG:4326";
let listCache: { at: number; body: unknown } | null = null;
const detCache = new Map<string, { at: number; body: unknown }>();

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const tag = (xml: string, t: string) => { const m = xml.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return m ? m[1].trim() : null; };
const unesc = (s: string | null) => (s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function list() {
  if (listCache && Date.now() - listCache.at < 10 * 60_000) return { ...(listCache.body as object), cached: true };
  const r = await fetch(LIST_URL, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`tfr list ${r.status}`);
  const j = await r.json();
  const rows = (j.features || []).map((f: any) => {
    const p = f.properties || {};
    const g = f.geometry || {};
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return {
      id: String(p.NOTAM_KEY || "").split("-")[0] || String(f.id || "").replace(/^V_TFR_LOC\./, ""),
      title: p.TITLE || "",
      type: p.LEGAL || "",
      state: p.STATE || "",
      facility: p.CNS_LOCATION_ID || "",
      modified: p.LAST_MODIFICATION_DATETIME || "",
      rings: polys.map((poly: number[][][]) => (poly[0] || []).map((c) => [r4(c[0]), r4(c[1])])),
    };
  }).filter((x: any) => x.id && x.rings.length);
  const body = { fetched_at: new Date().toISOString(), source: "FAA TFR service, tfr.faa.gov", rows };
  listCache = { at: Date.now(), body };
  return body;
}

async function detail(id: string) {
  const hit = detCache.get(id);
  if (hit && Date.now() - hit.at < 30 * 60_000) return { ...(hit.body as object), cached: true };
  const [yr, seq] = id.split("/");
  const r = await fetch(`https://tfr.faa.gov/download/detail_${yr}_${seq}.xml`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`tfr detail ${r.status}`);
  const x = await r.text();
  const alt = (which: "Upper" | "Lower") => {
    const v = tag(x, `valDistVer${which}`);
    if (v == null) return null;
    return { ft: Number(v), uom: tag(x, `uomDistVer${which}`) || "FT", ref: tag(x, `codeDistVer${which}`) || "" };
  };
  const body = {
    id,
    effective: tag(x, "dateEffective"),
    expires: tag(x, "dateExpire"),
    timezone: tag(x, "codeTimeZone") || "UTC",
    daily: (tag(x, "codeDailyOper") || "").toLowerCase() === "true",
    type: tag(x, "codeType"),
    lower: alt("Lower"),
    upper: alt("Upper"),
    purpose: unesc(tag(x, "txtDescrPurpose")),
    city: unesc(tag(x, "txtNameCity")),
    text: unesc(tag(x, "txtDescrTraditional")).slice(0, 2500),
    link: `https://tfr.faa.gov/tfr3/?page=detail_${yr}_${seq}`,
  };
  detCache.set(id, { at: Date.now(), body });
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const id = (u.searchParams.get("id") || "").trim();
  try {
    if (id) {
      if (!/^\d\/\d{1,5}$/.test(id)) return Response.json({ error: "id must look like 6/6654" }, { status: 400, headers: CORS });
      return Response.json(await detail(id), { headers: CORS });
    }
    return Response.json(await list(), { headers: CORS });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
