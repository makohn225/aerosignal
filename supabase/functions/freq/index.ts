// Airport radio frequencies for the kneeboard card. Source: OurAirports (public domain community data).
// GET freq?ids=KHEF,KLYH  ->  { src, rows: { KHEF: [{ type, desc, mhz }] } }
const SRC = "https://davidmegginson.github.io/ourairports-data/airport-frequencies.csv";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
let table: Map<string, { type: string; desc: string; mhz: string }[]> | null = null;
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
async function load() {
  if (table && Date.now() - loadedAt < 24 * 36e5) return table;
  const r = await fetch(SRC);
  if (!r.ok) throw new Error("source " + r.status);
  const txt = await r.text();
  const m = new Map<string, { type: string; desc: string; mhz: string }[]>();
  const lines = txt.split(/\r?\n/);
  const head = parseLine(lines[0]);
  const iI = head.indexOf("airport_ident"), iT = head.indexOf("type"), iD = head.indexOf("description"), iF = head.indexOf("frequency_mhz");
  for (let k = 1; k < lines.length; k++) {
    if (!lines[k]) continue;
    const c = parseLine(lines[k]);
    const id = (c[iI] || "").toUpperCase(); if (!id) continue;
    const a = m.get(id) || []; a.push({ type: c[iT] || "", desc: c[iD] || "", mhz: c[iF] || "" }); m.set(id, a);
  }
  table = m; loadedAt = Date.now(); return m;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const ids = (new URL(req.url).searchParams.get("ids") || "").toUpperCase().split(",").map((s) => s.replace(/[^A-Z0-9]/g, "")).filter(Boolean).slice(0, 6);
    const t = await load();
    const rows: Record<string, unknown> = {};
    for (const id of ids) {
      const alt = id.length === 3 ? "K" + id : id.length === 4 && id[0] === "K" ? id.slice(1) : id;
      rows[id] = (t.get(id) || t.get(alt) || []).slice(0, 16);
    }
    return new Response(JSON.stringify({ src: "OurAirports", rows }), { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
