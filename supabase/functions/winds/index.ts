import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db, dbMode } from "./db.ts";

// Winds and temperatures aloft (FB forecast) from aviationweather.gov, decoded, with station
// coordinates, for the forecast period that covers the requested time. Read only.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const UA = "AeroSignal/0.1 (preflight risk prototype)";
const cache = new Map<string, { at: number; body: any }>();
let coords: Map<string, [number, number]> | null = null;

function decode(s: string, lvl: number) {
  s = s.trim();
  if (!s) return null;
  let dd = +s.slice(0, 2), ss = +s.slice(2, 4);
  let temp: number | null = null;
  if (lvl >= 30000 && s.length >= 6) temp = -Number(s.slice(4, 6));
  else if (s.length >= 7) temp = Number(s.slice(4, 7));
  if (dd === 99 && ss === 0) return { dir: null, spd: 0, temp };
  if (dd >= 51 && dd <= 86) { dd -= 50; ss += 100; }
  return { dir: dd * 10, spd: ss, temp };
}

function when(day: number, hh: number) {
  const now = new Date();
  let y = now.getUTCFullYear(), m = now.getUTCMonth();
  if (day < now.getUTCDate() - 15) m += 1; else if (day > now.getUTCDate() + 15) m -= 1;
  return Date.UTC(y, m, day, hh);
}

async function product(fcst: string) {
  const hit = cache.get(fcst);
  if (hit && Date.now() - hit.at < 30 * 60e3) return hit.body;
  const r = await fetch(`https://aviationweather.gov/api/data/windtemp?region=all&level=low&fcst=${fcst}`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`winds ${r.status}`);
  const lines = (await r.text()).split(/\r?\n/);
  const based = (lines.find((l) => /DATA BASED ON/.test(l)) || "").match(/(\d{6})Z/)?.[1] || "";
  const vl = lines.find((l) => /^VALID/.test(l)) || "";
  const valid = vl.match(/VALID\s+(\d{2})(\d{2})(\d{2})Z/);
  const use = vl.match(/FOR USE\s+(\d{2})\d{2}-(\d{2})\d{2}Z/);
  const hi = lines.findIndex((l) => /^FT\s/.test(l));
  if (hi < 0 || !valid) throw new Error("could not read the winds product");
  const head = lines[hi];
  const levels: { ft: number; end: number; width: number }[] = [];
  for (const m of head.matchAll(/\d{4,5}/g)) {
    const ft = +m[0], end = (m.index || 0) + m[0].length;
    levels.push({ ft, end, width: ft === 3000 ? 4 : ft >= 30000 ? 6 : 7 });
  }
  const stations: any[] = [];
  for (const l of lines.slice(hi + 1)) {
    const id = l.slice(0, 3).trim();
    if (!/^[A-Z0-9]{3}$/.test(id)) continue;
    const w: Record<number, any> = {};
    for (const lv of levels) w[lv.ft] = decode(l.slice(Math.max(3, lv.end - lv.width), lv.end), lv.ft);
    stations.push({ id, w });
  }
  const vDay = +valid[1], vHr = +valid[2];
  let from = use ? +use[1] : vHr - 4, to = use ? +use[2] : vHr + 3;
  let start = when(vDay, from); if (from > vHr) start -= 864e5;
  let end = when(vDay, to); if (end <= start) end += 864e5;
  const body = { fcst, based, valid: new Date(when(vDay, vHr)).toISOString(), use: [new Date(start).toISOString(), new Date(end).toISOString()], levels: levels.map((x) => x.ft), stations };
  cache.set(fcst, { at: Date.now(), body });
  return body;
}

async function stationCoords(ids: string[]) {
  if (coords && ids.every((i) => coords!.has(i))) return coords;
  const sq = await db();
  const rows = await sq`select ident, kind, lat, lon from nas_points where ident = any(${ids}) and lat is not null`;
  coords = coords || new Map();
  for (const r of rows as any[]) {
    if (!coords.has(r.ident) || r.kind === "navaid") coords.set(r.ident, [r.lat, r.lon]);
  }
  return coords;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const t = Date.parse(u.searchParams.get("t") || "") || Date.now();
  try {
    const prods = await Promise.all(["06", "12", "24"].map((f) => product(f).catch(() => null)));
    const ok = prods.filter(Boolean) as any[];
    if (!ok.length) throw new Error("winds forecast unavailable");
    const cover = ok.find((p) => t >= Date.parse(p.use[0]) && t < Date.parse(p.use[1]));
    const pick = cover || ok.reduce((a, b) => (Math.abs(Date.parse(b.valid) - t) < Math.abs(Date.parse(a.valid) - t) ? b : a));
    const c = await stationCoords(pick.stations.map((s: any) => s.id));
    const stations = pick.stations.filter((s: any) => c.has(s.id)).map((s: any) => ({ ...s, lat: c.get(s.id)![0], lon: c.get(s.id)![1] }));
    return Response.json({
      source: "aviationweather.gov winds and temperatures aloft (FB)", fcst: pick.fcst, based: pick.based, valid: pick.valid,
      use: pick.use, covers: !!cover, levels: pick.levels, stations,
    }, { headers: { ...CORS, "Cache-Control": "public, max-age=900" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
