import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Route weather hazards relay: PIREPs, SIGMETs, G-AIRMETs and CWAs from aviationweather.gov
// for a bounding box around the route. Read only, no database access.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const UA = "AeroSignal/0.1 (preflight risk prototype)";
const BASE = "https://aviationweather.gov/api/data";
const cache = new Map<string, { at: number; body: unknown }>();

type Pt = [number, number];
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const toPts = (c: any[]): Pt[] =>
  (Array.isArray(c) ? c : []).map((p) => [Number(p.lat), Number(p.lon)] as Pt).filter((p) => isFinite(p[0]) && isFinite(p[1]));
const overlaps = (pts: Pt[], b: number[]) => {
  if (!pts.length) return false;
  let a = 90, c = -90, d = 180, e = -180;
  for (const [la, lo] of pts) { a = Math.min(a, la); c = Math.max(c, la); d = Math.min(d, lo); e = Math.max(e, lo); }
  return !(c < b[0] || a > b[2] || e < b[1] || d > b[3]);
};

async function get(path: string) {
  const r = await fetch(`${BASE}/${path}`, { headers: { "User-Agent": UA } });
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}
const safe = async (p: string) => { try { return { ok: true, data: await get(p) }; } catch (e) { return { ok: false, data: [], err: String(e) }; } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const b = (u.searchParams.get("bbox") || "").split(",").map(Number);
  if (b.length !== 4 || !b.every(isFinite) || b[0] >= b[2] || b[1] >= b[3] || b[0] < -90 || b[2] > 90 || b[1] < -180 || b[3] > 180 || b[2] - b[0] > 30 || b[3] - b[1] > 40)
    return Response.json({ error: "bbox must be minLat,minLon,maxLat,maxLon spanning at most 30 by 40 degrees" }, { status: 400, headers: CORS });
  const bb = b.map((v) => Math.round(v * 10) / 10);
  const key = bb.join(",");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 300_000) return Response.json({ ...(hit.body as object), cached: true }, { headers: CORS });

  const [pr, as, ga, cw] = await Promise.all([
    safe(`pirep?bbox=${bb[0]},${bb[1]},${bb[2]},${bb[3]}&age=3&format=json`),
    safe(`airsigmet?format=json`),
    safe(`gairmet?format=json`),
    safe(`cwa?format=json`),
  ]);
  const pireps = pr.data.map((p: any) => ({
    t: p.obsTime, lat: num(p.lat), lon: num(p.lon), fl: num(p.fltLvl), ac: p.acType || "",
    urgent: /urgent/i.test(p.pirepType || "") || /^\s*\S*\s*UUA/.test(p.rawOb || ""),
    tb: p.tbInt1 || "", tbType: p.tbType1 || "", tbBase: num(p.tbBas1), tbTop: num(p.tbTop1),
    ic: p.icgInt1 || "", icType: p.icgType1 || "", icBase: num(p.icgBas1), icTop: num(p.icgTop1),
    wx: p.wxString || "", raw: p.rawOb || "",
  })).filter((p: any) => p.lat !== null && p.lon !== null);
  const sigmets = as.data.map((s: any) => ({
    kind: s.airSigmetType || "SIGMET", hazard: s.hazard || "", sev: s.severity ?? null, id: s.seriesId || "",
    lo: num(s.altitudeLow1), hi: num(s.altitudeHi1), from: s.validTimeFrom, to: s.validTimeTo,
    dir: num(s.movementDir), spd: num(s.movementSpd), pts: toPts(s.coords), raw: s.rawAirSigmet || "",
  })).filter((s: any) => overlaps(s.pts, bb));
  const gairmets = ga.data.filter((g: any) => Number(g.forecastHour) <= 6).map((g: any) => ({
    hazard: g.hazard || "", sev: g.severity || "", fh: Number(g.forecastHour), valid: g.validTime, geom: g.geometryType || g.geom || "",
    base: g.base ?? null, top: g.top ?? null, fzlBase: g.fzlbase ?? null, fzlTop: g.fzltop ?? null, level: g.level ?? null,
    due: g.due_to || "", pts: toPts(g.coords),
  })).filter((g: any) => g.hazard !== "FZLVL" && g.hazard !== "M_FZLVL" && overlaps(g.pts, bb));
  const cwas = cw.data.map((c: any) => ({
    id: `${c.cwsu || ""} ${c.seriesId || ""}`.trim(), hazard: c.hazard || "", qual: c.qualifier || "", from: c.validTimeFrom, to: c.validTimeTo,
    lo: num(c.base), hi: num(c.top), pts: toPts(c.coords), raw: c.cwaText || c.rawText || "",
  })).filter((c: any) => overlaps(c.pts, bb));
  const body = {
    fetched_at: new Date().toISOString(), source: "aviationweather.gov Data API", bbox: bb,
    pireps, sigmets, gairmets, cwas,
    partial: [pr, as, ga, cw].some((x) => !x.ok),
  };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return Response.json(body, { headers: CORS });
});
