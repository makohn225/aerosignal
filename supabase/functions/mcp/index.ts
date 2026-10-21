import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db } from "./db.ts";

// AeroSignal AI connector: a read only Model Context Protocol server (Streamable HTTP, JSON responses)
// so Claude, ChatGPT and other AI assistants can use AeroSignal's public safety data while a pilot
// plans. Public data only: NTSB accident records and narratives, public military mishap reporting,
// FAA airport data and aviationweather.gov advisories. No user data, no accounts, nothing is written.
//   POST /functions/v1/mcp   JSON-RPC 2.0 (initialize, tools/list, tools/call, ping)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};
const APP = "https://aerosignal-app.vercel.app";
const DISC = "AeroSignal is advisory only. It is not an official weather briefing, NOTAM source or flight plan. The pilot in command is responsible for the decision to fly. Military narratives come from public reporting, not official mishap reports. Never enter CUI or classified information.";
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

// Simple per address limit so one client cannot hammer the database
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), w = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  w.push(now); hits.set(ip, w);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
  return w.length > 60;
}

const clamp = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const R = Math.PI / 180;
const nm = (a: number[], b: number[]) => 60 * Math.hypot(b[0] - a[0], (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * R));

type Pt = { ident?: string; name?: string; lat: number; lon: number };
async function resolveRoute(route: unknown, points: unknown): Promise<{ pts: Pt[]; missing: string[] }> {
  if (Array.isArray(points) && points.length) {
    const pts = points.slice(0, 60).map((p: any) => ({ lat: Number(p.lat), lon: Number(p.lon) })).filter((p) => isFinite(p.lat) && isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
    return { pts, missing: [] };
  }
  const toks = String(route || "").toUpperCase().split(/[\s,]+/).map((t) => t.replace(/[^A-Z0-9]/g, "")).filter((t) => t && t !== "DCT" && !/^(V|T|J|Q)\d{1,4}$/.test(t)).slice(0, 40);
  if (!toks.length) return { pts: [], missing: [] };
  const s = await db();
  const rows = await s`select token, ident, name, lat, lon from public.resolve_points(${toks}::text[])`;
  const by = new Map(rows.map((r: any) => [r.token, r]));
  const pts: Pt[] = [], missing: string[] = [];
  for (const t of toks) { const r: any = by.get(t); if (r) pts.push({ ident: r.ident, name: r.name, lat: r.lat, lon: r.lon }); else missing.push(t); }
  return { pts, missing };
}

const ROUTE_PROPS = {
  route: { type: "string", description: "Route as airport and fix identifiers separated by spaces, for example \"KHEF MRB KLYH\". Airways and DCT are skipped." },
  points: { type: "array", description: "Alternative to route: list of {lat, lon} points in decimal degrees.", items: { type: "object", properties: { lat: { type: "number" }, lon: { type: "number" } }, required: ["lat", "lon"] } },
};

const TOOLS = [
  {
    name: "accidents_along_route",
    title: "NTSB accidents along a route",
    description: "Find NTSB accident and incident records within a corridor of a planned route (US, about 2000 to present). Returns date, place, aircraft, injuries, weather, a human factors label, distance from the route and a short excerpt. Use get_accident_narratives for the full text.",
    inputSchema: { type: "object", properties: { ...ROUTE_PROPS, corridor_nm: { type: "number", description: "Half width of the corridor in nautical miles, 1 to 25. Default 10." }, limit: { type: "integer", description: "Maximum records, 1 to 50. Default 20." } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "accidents_near_point",
    title: "NTSB accidents near a place",
    description: "Find NTSB accident and incident records within a radius of a point or airport, optionally filtered by aircraft make or model text (for example \"C172\" or \"R44\"), fatal only, and years.",
    inputSchema: { type: "object", properties: { airport: { type: "string", description: "Airport identifier such as KLYH. Use this or lat and lon." }, lat: { type: "number" }, lon: { type: "number" }, radius_nm: { type: "number", description: "1 to 100. Default 25." }, aircraft: { type: "string" }, fatal_only: { type: "boolean" }, from_year: { type: "integer" }, to_year: { type: "integer" }, limit: { type: "integer", description: "1 to 50. Default 20." } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_accident_narratives",
    title: "NTSB narratives",
    description: "Full NTSB narrative text (factual and probable cause where available) for up to 10 event ids returned by the other tools.",
    inputSchema: { type: "object", properties: { ev_ids: { type: "array", items: { type: "string" }, maxItems: 10 } }, required: ["ev_ids"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "military_mishaps_near_route",
    title: "Public military mishap narratives",
    description: "US military aviation mishaps from public reporting (news and official public releases, never privileged safety investigation findings) near a route or point, with the hazard lesson and source link. Locations are approximate.",
    inputSchema: { type: "object", properties: { ...ROUTE_PROPS, airport: { type: "string" }, lat: { type: "number" }, lon: { type: "number" }, radius_nm: { type: "number", description: "1 to 200. Default 50." }, aircraft: { type: "string", description: "Optional text filter such as MV-22, H-60, F-35." } } },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "route_weather_advisories",
    title: "Turbulence, icing and convective advisories along a route",
    description: "Current G-AIRMETs (turbulence, icing, IFR, mountain obscuration, low level wind shear), SIGMETs, convective SIGMETs, Center Weather Advisories and turbulence or icing PIREPs from aviationweather.gov that touch a route. For planning only; get an official briefing.",
    inputSchema: { type: "object", properties: { ...ROUTE_PROPS, pirep_radius_nm: { type: "number", description: "1 to 50. Default 25." } } },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "airport_info",
    title: "Airport information",
    description: "FAA and public airport data for one airport: name, location, elevation and runways.",
    inputSchema: { type: "object", properties: { airport: { type: "string", description: "Identifier such as KHEF or HEF." } }, required: ["airport"] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

async function pointOf(a: any): Promise<{ lat: number; lon: number; label: string } | null> {
  if (a.airport) {
    const { pts } = await resolveRoute(a.airport, null);
    if (pts[0]) return { lat: pts[0].lat, lon: pts[0].lon, label: pts[0].ident || String(a.airport) };
    return null;
  }
  const lat = Number(a.lat), lon = Number(a.lon);
  return isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon, label: `${lat.toFixed(3)}, ${lon.toFixed(3)}` } : null;
}

async function accidentsAlongRoute(a: any) {
  const { pts, missing } = await resolveRoute(a.route, a.points);
  if (pts.length < 1) throw new Error("Give a route of known identifiers or at least one point.");
  const s = await db();
  const rows = await s`select ev_id, event_date, location, airport_code, model, fatal, injury_severity, weather_condition, hfacs_label, round(dist_nm::numeric,1) dist_nm, excerpt
    from public.accidents_near_route(${pts.map((p) => p.lat)}::float8[], ${pts.map((p) => p.lon)}::float8[], ${clamp(a.corridor_nm, 1, 25, 10)}, ${clamp(a.limit, 1, 50, 20)})`;
  return { route: pts.map((p) => p.ident || `${p.lat},${p.lon}`), unresolved: missing, count: rows.length, accidents: rows };
}

async function accidentsNearPoint(a: any) {
  const p = await pointOf(a);
  if (!p) throw new Error("Give an airport identifier or lat and lon.");
  const r = clamp(a.radius_nm, 1, 100, 25), lim = clamp(a.limit, 1, 50, 20);
  const dlat = r / 60, dlon = r / (60 * Math.max(0.2, Math.cos(p.lat * R)));
  const ac = String(a.aircraft || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const y0 = clamp(a.from_year, 1960, 2100, 2000), y1 = clamp(a.to_year, 1960, 2100, 2100);
  const s = await db();
  const rows = await s`
    select e.ev_id, e.event_date, e.location, e.airport_code, e.make, e.model, coalesce(e.fatal,0) fatal, e.injury_severity, e.weather_condition,
      round((60 * sqrt(power(e.latitude - ${p.lat}, 2) + power((e.longitude - ${p.lon}) * cos(radians(${p.lat})), 2)))::numeric, 1) dist_nm
    from public.ntsb_events e
    where e.latitude between ${p.lat - dlat} and ${p.lat + dlat} and e.longitude between ${p.lon - dlon} and ${p.lon + dlon}
      and e.event_date between ${`${y0}-01-01`}::date and ${`${y1}-12-31`}::date
      ${ac ? s`and (upper(coalesce(e.family,'')) = ${ac} or replace(replace(upper(coalesce(e.make,'')||coalesce(e.model,'')),'-',''),' ','') like ${"%" + ac + "%"} or replace(replace(upper(coalesce(e.model,'')),'-',''),' ','') like ${(/^[A-Z]\d{3}/.test(ac) ? ac.slice(1) : ac) + "%"})` : s``}
      ${a.fatal_only ? s`and coalesce(e.fatal,0) > 0` : s``}
      and 60 * sqrt(power(e.latitude - ${p.lat}, 2) + power((e.longitude - ${p.lon}) * cos(radians(${p.lat})), 2)) <= ${r}
    order by e.event_date desc limit ${lim}`;
  return { center: p.label, radius_nm: r, count: rows.length, accidents: rows };
}

async function narratives(a: any) {
  const ids = [...new Set((Array.isArray(a.ev_ids) ? a.ev_ids : []).map((x: unknown) => String(x).trim()).filter((x: string) => /^[A-Z0-9]{6,20}$/i.test(x)))].slice(0, 10);
  if (!ids.length) throw new Error("ev_ids required");
  const s = await db();
  const rows = await s`select e.ev_id, e.event_date, e.location, e.make, e.model, e.injury_severity, left(n.narrative, 8000) narrative
    from public.ntsb_events e left join public.ntsb_narratives n using (ev_id) where e.ev_id = any(${ids})`;
  return { narratives: rows, source: "NTSB CAROL and aviation accident database" };
}

let milCache: { at: number; rows: any[] } | null = null;
async function milRows() {
  if (milCache && Date.now() - milCache.at < 3_600_000) return milCache.rows;
  const r = await fetch(`${APP}/milmishaps.json`);
  if (!r.ok) throw new Error(`military narratives ${r.status}`);
  const rows = await r.json();
  milCache = { at: Date.now(), rows: Array.isArray(rows) ? rows : [] };
  return milCache.rows;
}
async function milNear(a: any) {
  const rows = await milRows();
  let pts: number[][] = [];
  if (a.route || (Array.isArray(a.points) && a.points.length)) pts = (await resolveRoute(a.route, a.points)).pts.map((p) => [p.lat, p.lon]);
  else { const p = await pointOf(a); if (p) pts = [[p.lat, p.lon]]; }
  const r = clamp(a.radius_nm, 1, 200, 50);
  const ac = String(a.aircraft || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Sample the route every ~5 nm
  const S: number[][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) { S.push(pts[0]); continue; }
    const n = Math.max(1, Math.ceil(nm(pts[i - 1], pts[i]) / 5));
    for (let k = 1; k <= n; k++) S.push([pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * k) / n, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * k) / n]);
  }
  const out = rows
    .filter((m) => !ac || String(m.aircraft || "").toUpperCase().replace(/[^A-Z0-9]/g, "").includes(ac))
    .map((m) => ({ m, d: S.length ? Math.min(...S.map((p) => nm(p, [m.lat, m.lon]))) : null }))
    .filter((x) => x.d == null || x.d <= r)
    .sort((x, y) => (x.d ?? 0) - (y.d ?? 0) || String(y.m.date).localeCompare(String(x.m.date)))
    .slice(0, 25)
    .map(({ m, d }) => ({ date: m.date, service: m.service, aircraft: m.aircraft, place: m.place, location_precision: m.loc_precision, distance_nm: d == null ? null : Math.round(d), phase: m.phase, fatal: m.fatal, narrative: m.narrative, hazard_lesson: m.hazard, source: m.source_title, source_url: m.source_url }));
  return { count: out.length, mishaps: out, note: "From public reporting, not official mishap reports. Locations approximate." };
}

// aviationweather.gov advisories
const AWC = "https://aviationweather.gov/api/data";
async function awc(path: string) {
  const r = await fetch(`${AWC}/${path}`, { headers: { "User-Agent": "AeroSignal/0.1 (MCP connector)" } });
  if (r.status === 204) return [];
  if (!r.ok) throw new Error(`${path.split("?")[0]} ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}
const toPts = (c: any[]) => (Array.isArray(c) ? c : []).map((p) => [Number(p.lat), Number(p.lon)]).filter((p) => isFinite(p[0]) && isFinite(p[1]));
function inside(poly: number[][], p: number[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
async function advisories(a: any) {
  const { pts, missing } = await resolveRoute(a.route, a.points);
  if (!pts.length) throw new Error("Give a route of known identifiers or points.");
  const P = pts.map((p) => [p.lat, p.lon]);
  const S: number[][] = [P[0]];
  for (let i = 1; i < P.length; i++) { const n = Math.max(1, Math.ceil(nm(P[i - 1], P[i]) / 5)); for (let k = 1; k <= n; k++) S.push([P[i - 1][0] + ((P[i][0] - P[i - 1][0]) * k) / n, P[i - 1][1] + ((P[i][1] - P[i - 1][1]) * k) / n]); }
  const crosses = (poly: number[][]) => poly.length > 2 && S.some((p) => inside(poly, p));
  let a0 = 90, b0 = 180, c0 = -90, d0 = -180;
  for (const [la, lo] of P) { a0 = Math.min(a0, la); b0 = Math.min(b0, lo); c0 = Math.max(c0, la); d0 = Math.max(d0, lo); }
  const bb = [a0 - 1, b0 - 1, c0 + 1, d0 + 1].map((v) => v.toFixed(1)).join(",");
  const safe = async (p: string) => { try { return { ok: true, d: await awc(p) }; } catch { return { ok: false, d: [] as any[] }; } };
  const [pr, as, ga, cw] = await Promise.all([safe(`pirep?bbox=${bb}&age=3&format=json`), safe("airsigmet?format=json"), safe("gairmet?format=json"), safe("cwa?format=json")]);
  const rad = clamp(a.pirep_radius_nm, 1, 50, 25);
  const gairmets = ga.d.filter((g: any) => Number(g.forecastHour) <= 6 && !/FZLVL/.test(g.hazard || "") && crosses(toPts(g.coords)))
    .map((g: any) => ({ hazard: g.hazard, severity: g.severity || null, forecast_hour: Number(g.forecastHour), valid: g.validTime, base: g.base ?? null, top: g.top ?? null, due_to: g.due_to || null }));
  const sigmets = as.d.filter((s: any) => crosses(toPts(s.coords))).map((s: any) => ({ type: s.airSigmetType, hazard: s.hazard, severity: s.severity ?? null, valid_from: s.validTimeFrom, valid_to: s.validTimeTo, low_ft: s.altitudeLow1 ?? null, high_ft: s.altitudeHi1 ?? null, text: s.rawAirSigmet }));
  const cwas = cw.d.filter((c: any) => crosses(toPts(c.coords))).map((c: any) => ({ hazard: c.hazard, valid_from: c.validTimeFrom, valid_to: c.validTimeTo, text: c.cwaText || c.rawText }));
  const pireps = pr.d.filter((p: any) => (p.tbInt1 && !/NEG|SMTH/.test(p.tbInt1)) || (p.icgInt1 && !/NEG/.test(p.icgInt1)))
    .map((p: any) => ({ p, d: Math.min(...S.map((s) => nm(s, [Number(p.lat), Number(p.lon)]))) })).filter((x: any) => x.d <= rad)
    .slice(0, 30).map(({ p, d }: any) => ({ time: p.obsTime, distance_nm: Math.round(d), flight_level: p.fltLvl, aircraft: p.acType, turbulence: p.tbInt1 || null, icing: p.icgInt1 || null, text: p.rawOb }));
  return { route: pts.map((p) => p.ident), unresolved: missing, gairmets, sigmets, center_weather_advisories: cwas, pireps, partial: [pr, as, ga, cw].some((x) => !x.ok), source: "aviationweather.gov" };
}

async function airport(a: any) {
  const code = String(a.airport || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!code) throw new Error("airport required");
  const s = await db();
  const [row] = await s`select public.airport_detail(${code}) d`;
  if (row && row.d && row.d.airport) return row.d;
  const [k] = await s`select public.airport_detail(${"K" + code}) d`;
  if (k && k.d && k.d.airport) return k.d;
  throw new Error(`No airport found for ${code}`);
}

const HANDLERS: Record<string, (a: any) => Promise<unknown>> = {
  accidents_along_route: accidentsAlongRoute,
  accidents_near_point: accidentsNearPoint,
  get_accident_narratives: narratives,
  military_mishaps_near_route: milNear,
  route_weather_advisories: advisories,
  airport_info: airport,
};

async function handle(msg: any): Promise<any | null> {
  const { id, method, params } = msg || {};
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Invalid request");
  if (id === undefined || id === null) return null; // notification
  switch (method) {
    case "initialize": {
      const want = params && params.protocolVersion;
      return ok({
        protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "aerosignal", title: "AeroSignal", version: "1.0.0" },
        instructions: `AeroSignal preflight mishap intelligence. Use these tools to look up past accidents and public military mishaps along a route, current turbulence and icing advisories, and airport data, then explain the lessons that apply to the pilot's flight. ${DISC}`,
      });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call": {
      const name = params && params.name, fn = HANDLERS[name];
      if (!fn) return err(-32602, `Unknown tool ${name}`);
      try {
        const data = await fn((params && params.arguments) || {});
        return ok({ content: [{ type: "text", text: JSON.stringify({ ...(data as object), disclaimer: DISC }) }], structuredContent: { ...(data as object), disclaimer: DISC }, isError: false });
      } catch (e) {
        return ok({ content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true });
      }
    }
    case "resources/list": return ok({ resources: [] });
    case "prompts/list": return ok({ prompts: [] });
    default: return err(-32601, `Method not found: ${method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method === "GET") {
    const accept = req.headers.get("accept") || "";
    if (accept.includes("text/event-stream")) return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST" } });
    return Response.json({ name: "AeroSignal AI connector", transport: "streamable-http", endpoint: new URL(req.url).pathname, tools: TOOLS.map((t) => t.name), about: `${APP}/#/more`, disclaimer: DISC }, { headers: CORS });
  }
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: CORS });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  if (limited(ip)) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests, slow down" } }, { status: 429, headers: CORS });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS }); }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]).slice(0, 20);
  const out = (await Promise.all(msgs.map(handle))).filter((x) => x !== null);
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? out : out[0], { headers: { ...CORS, "Content-Type": "application/json" } });
});
