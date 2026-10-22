// Runway end positions and elevations for the approach profile. Source: OurAirports (public domain).
// GET rwyends?ids=KLYH,KHEF -> { src, rows: { KLYH: [{ le, he, len, w, closed }] } } where le/he = { id, lat, lon, elev, disp, hdg }
const SRC = "https://davidmegginson.github.io/ourairports-data/runways.csv";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
let table: Map<string, unknown[]> | null = null;
let loadedAt = 0;
function parseLine(line: string): string[] {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur); return out;
}
const num = (s: string) => { const n = parseFloat(s); return isFinite(n) ? n : null; };
async function load() {
  if (table && Date.now() - loadedAt < 24 * 36e5) return table;
  const r = await fetch(SRC);
  if (!r.ok) throw new Error("source " + r.status);
  const lines = (await r.text()).split(/\r?\n/);
  const H = parseLine(lines[0]); const ix = (k: string) => H.indexOf(k);
  const I = { ap: ix("airport_ident"), len: ix("length_ft"), w: ix("width_ft"), closed: ix("closed"),
    li: ix("le_ident"), lla: ix("le_latitude_deg"), llo: ix("le_longitude_deg"), le: ix("le_elevation_ft"), lh: ix("le_heading_degT"), ld: ix("le_displaced_threshold_ft"),
    hi: ix("he_ident"), hla: ix("he_latitude_deg"), hlo: ix("he_longitude_deg"), he: ix("he_elevation_ft"), hh: ix("he_heading_degT"), hd: ix("he_displaced_threshold_ft") };
  const m = new Map<string, unknown[]>();
  for (let k = 1; k < lines.length; k++) {
    if (!lines[k]) continue;
    const c = parseLine(lines[k]);
    const lat1 = num(c[I.lla]), lat2 = num(c[I.hla]);
    if (lat1 == null || lat2 == null) continue;
    const id = (c[I.ap] || "").toUpperCase();
    const row = { len: num(c[I.len]), w: num(c[I.w]), closed: c[I.closed] === "1",
      le: { id: c[I.li], lat: lat1, lon: num(c[I.llo]), elev: num(c[I.le]), disp: num(c[I.ld]) || 0, hdg: num(c[I.lh]) },
      he: { id: c[I.hi], lat: lat2, lon: num(c[I.hlo]), elev: num(c[I.he]), disp: num(c[I.hd]) || 0, hdg: num(c[I.hh]) } };
    const a = m.get(id) || []; a.push(row); m.set(id, a);
  }
  table = m; loadedAt = Date.now(); return m;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const ids = (new URL(req.url).searchParams.get("ids") || "").toUpperCase().split(",").map((s) => s.replace(/[^A-Z0-9]/g, "")).filter(Boolean).slice(0, 8);
    const t = await load();
    const rows: Record<string, unknown> = {};
    for (const id of ids) { const alt = id.length === 3 ? "K" + id : id.length === 4 && id[0] === "K" ? id.slice(1) : id; rows[id] = t.get(id) || t.get(alt) || []; }
    return new Response(JSON.stringify({ src: "OurAirports", rows }), { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
