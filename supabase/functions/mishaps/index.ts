import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db, dbMode } from "./db.ts";

// Safety search: NTSB accident and incident records filtered by place and radius, aircraft,
// category, years, weather, hazard keywords and severity, with summary counts. Read only.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const HAZ: Record<string, string[]> = {
  weather: ["%instrument meteorological%", "%low ceiling%", "%fog%", "%visibility%", "%clouds%"],
  night: ["%night%", "%dark night%", "%darkness%"],
  wire: ["%wire%", "%power line%", "%powerline%", "%transmission line%"],
  icing: ["%icing%", "%carburetor ice%", "%structural ice%", "%airframe ice%"],
  fuel: ["%fuel exhaustion%", "%fuel starvation%", "%ran out of fuel%", "%fuel contamination%", "%water in the fuel%"],
  loc: ["%loss of control%", "%aerodynamic stall%", "%stalled%", "%spin%"],
  da: ["%density altitude%"],
  sd: ["%spatial disorientation%"],
  midair: ["%midair%", "%mid-air%", "%collided with another%", "%in-flight collision%"],
  bird: ["%bird%", "%geese%", "%vulture%"],
  engine: ["%loss of engine power%", "%total loss of engine%", "%engine failure%", "%partial loss of engine%"],
  terrain: ["%controlled flight into terrain%", "%rising terrain%", "%mountain%", "%ridge%"],
  dve: ["%brownout%", "%whiteout%", "%dust cloud%", "%blowing snow%"],
  wind: ["%crosswind%", "%gust%", "%tailwind%", "%wind shear%", "%windshear%"],
  landing: ["%hard landing%", "%bounced%", "%runway excursion%", "%overran%", "%nose over%", "%nosed over%"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url), g = (k: string) => (u.searchParams.get(k) || "").trim();
  const lat = parseFloat(g("lat")), lon = parseFloat(g("lon"));
  const hasPt = isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const r = Math.min(Math.max(parseFloat(g("r")) || 50, 1), 300);
  const q = g("q").toUpperCase().slice(0, 40);
  const toks = q.split(/[\s,]+/).map((t) => t.replace(/[^A-Z0-9]/g, "")).filter(Boolean).slice(0, 4);
  const cat = g("cat").toLowerCase();
  const y0 = parseInt(g("from")) || 2000, y1 = parseInt(g("to")) || 2100;
  const fatal = g("fatal") === "1", wx = g("wx").toUpperCase();
  const hz = g("hz").toLowerCase(), pats = HAZ[hz] || null;
  const sort = g("sort") || (hasPt ? "near" : "recent");
  const lim = Math.min(Math.max(parseInt(g("lim")) || 100, 1), 200);
  if (!hasPt && !toks.length && !pats)
    return Response.json({ error: "Pick a location, an aircraft or a hazard to search" }, { status: 400, headers: CORS });
  try {
    const s = await db();
    const dlat = r / 60, dlon = r / (60 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const acClause = toks.length
      ? toks.reduce((acc, t, i) => (i === 0
          ? s`replace(upper(coalesce(e.make,'')||' '||coalesce(e.model,'')),'-','') like ${"%" + t + "%"}`
          : s`${acc} and replace(upper(coalesce(e.make,'')||' '||coalesce(e.model,'')),'-','') like ${"%" + t + "%"}`), s``)
      : null;
    const catClause = cat === "airplane" ? s`and e.aircraft_category = 'Airplane'`
      : cat === "helicopter" ? s`and e.aircraft_category = 'Helicopter'`
      : cat === "other" ? s`and coalesce(e.aircraft_category,'') not in ('Airplane','Helicopter')` : s``;
    const where = s`
      where e.event_date >= ${`${y0}-01-01`}::date and e.event_date <= ${`${y1}-12-31`}::date
      ${hasPt ? s`and e.latitude between ${lat - dlat} and ${lat + dlat} and e.longitude between ${lon - dlon} and ${lon + dlon}` : s``}
      ${acClause ? s`and (upper(coalesce(e.family,'')) = ${toks.join("")} or (${acClause}))` : s``}
      ${catClause}
      ${fatal ? s`and e.fatal > 0` : s``}
      ${wx === "IMC" || wx === "VMC" ? s`and e.weather_condition = ${wx}` : s``}
      ${pats ? (hz === "weather" ? s`and (e.weather_condition = 'IMC' or n.narrative ilike any(${pats}))` : s`and n.narrative ilike any(${pats})`) : s``}`;
    const dist = hasPt ? s`60 * sqrt(power(e.latitude - ${lat}, 2) + power((e.longitude - ${lon}) * cos(radians(${lat})), 2))` : s`null::float8`;
    const base = s`
      select e.ev_id, e.accident_number, e.event_date, e.location, e.airport_code, e.airport_name, e.latitude lat, e.longitude lon,
             e.make, e.model, e.aircraft_category cat, e.injury_severity inj, e.aircraft_damage dmg, coalesce(e.fatal,0) fatal,
             coalesce(e.serious,0) serious, e.weather_condition wx, e.purpose, e.far_part, n.hfacs_label hf, n.narrative, ${dist} dist
      from public.ntsb_events e left join public.ntsb_narratives n using (ev_id) ${where}`;
    const filt = s`select * from (${base}) b where ${hasPt ? s`b.dist <= ${r}` : s`true`}`;
    const order = sort === "fatal" ? s`order by fatal desc, event_date desc` : sort === "near" && hasPt ? s`order by dist asc, event_date desc` : s`order by event_date desc`;
    const [rows, stats] = await Promise.all([
      s`select ev_id, accident_number, event_date, location, airport_code, airport_name, lat, lon, make, model, cat, inj, dmg, fatal, serious, wx,
               purpose, far_part, hf, left(narrative, 1200) narrative, round(dist::numeric, 1)::float8 dist
        from (${filt}) f ${order} limit ${lim}`,
      s`with f as (${filt})
        select (select count(*) from f)::int total,
               (select count(*) from f where fatal > 0)::int fatal_events,
               (select coalesce(sum(fatal),0) from f)::int fatalities,
               (select count(*) from f where wx = 'IMC')::int imc,
               (select count(*) from f where narrative is not null)::int with_narr,
               (select min(event_date) from f) as first_date, (select max(event_date) from f) as last_date,
               (select coalesce(json_agg(x), '[]') from (select extract(year from event_date)::int y, count(*)::int n, count(*) filter (where fatal > 0)::int f from f group by 1 order by 1) x) years,
               (select coalesce(json_agg(x), '[]') from (select initcap(split_part(coalesce(make,'?'),' ',1)) || ' ' || regexp_replace(upper(coalesce(model,'')),'[^A-Z0-9]','','g') m, count(*)::int n, count(*) filter (where fatal > 0)::int f from f group by 1 order by 2 desc limit 8) x) models,
               (select coalesce(json_agg(x), '[]') from (select coalesce(cat,'Unknown') c, count(*)::int n from f group by 1 order by 2 desc) x) cats,
               (select coalesce(json_agg(x), '[]') from (select hf h, count(*)::int n from f where hf is not null group by 1 order by 2 desc) x) hfacs`,
    ]);
    return Response.json({
      source: "NTSB aviation accident database (CAROL), 2008 to 2022 records loaded in AeroSignal",
      query: { lat: hasPt ? lat : null, lon: hasPt ? lon : null, r: hasPt ? r : null, q, cat, from: y0, to: y1, fatal, wx, hz, sort },
      stats: stats[0], rows,
    }, { headers: { ...CORS, "Cache-Control": "public, max-age=600" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
