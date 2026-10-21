import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Preferred IFR routes relay: reads the FAA's published preferred route database
// (fly.faa.gov, NFDC) and returns only the routes for the airports asked for.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const SRC = "https://www.fly.faa.gov/rmt/data_file/prefroutes_db.csv";
const UA = "AeroSignal/0.1 (preflight risk prototype)";
type Row = { o: string; d: string; route: string; type: string; alt: string; acft: string; area: string; hours: string; dir: string; seq: number; from: string[]; to: string[] };
let db: { at: number; asof: string; rows: Row[] } | null = null;

const list = (area: string, word: string) => {
  const m = area.toUpperCase().match(new RegExp(`\\b${word}\\s+([A-Z0-9.\\s]+?)(?=\\b(?:FROM|TO)\\b|$)`));
  return m ? m[1].split(/[.\s]+/).map((s) => s.trim()).filter((s) => /^[A-Z0-9]{2,4}$/.test(s)) : [];
};

async function load() {
  if (db && Date.now() - db.at < 12 * 36e5) return db;
  const r = await fetch(SRC, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`FAA file ${r.status}`);
  const text = (await r.text()).replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines.shift()!.split(",").map((s) => s.trim().toLowerCase());
  const ix = (n: string) => head.indexOf(n);
  const rows: Row[] = [];
  for (const l of lines) {
    const c = l.split(",");
    if (c.length < 10) continue;
    const g = (n: string) => (ix(n) >= 0 ? (c[ix(n)] || "").trim() : "");
    const area = g("area");
    rows.push({
      o: g("orig").toUpperCase(), d: g("dest").toUpperCase(), route: g("route string").replace(/\s+/g, " "),
      type: g("type"), alt: g("altitude"), acft: g("aircraft"), area,
      hours: [g("hours1"), g("hours2"), g("hours3")].filter(Boolean).join(", "), dir: g("direction"), seq: +g("seq") || 0,
      from: list(area, "FROM"), to: list(area, "TO"),
    });
  }
  const lm = r.headers.get("last-modified");
  db = { at: Date.now(), asof: lm ? new Date(lm).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10), rows };
  return db;
}

// "KDCA" -> "DCA" (the FAA file uses three letter US identifiers)
const lid = (s: string) => { s = (s || "").toUpperCase().trim(); return /^K[A-Z]{3}$/.test(s) ? s.slice(1) : s; };
const strip = ({ from, to, ...r }: Row) => r;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const o = lid(u.searchParams.get("o") || ""), d = lid(u.searchParams.get("d") || "");
  if (!/^[A-Z0-9]{2,4}$/.test(o) || !/^[A-Z0-9]{2,4}$/.test(d))
    return Response.json({ error: "o and d must be airport identifiers" }, { status: 400, headers: CORS });
  try {
    const { rows, asof } = await load();
    const fromO = (r: Row) => r.o === o || r.from.includes(o);
    const toD = (r: Row) => r.d === d || r.to.includes(d);
    const exact = rows.filter((r) => fromO(r) && toD(r));
    const toDest = rows.filter((r) => toD(r) && !fromO(r)).slice(0, 400);
    const fromOrig = rows.filter((r) => fromO(r) && !toD(r)).slice(0, 400);
    return Response.json({
      source: "FAA preferred routes database (fly.faa.gov)", asof, o, d,
      exact: exact.map(strip), toDest: toDest.map(strip), fromOrig: fromOrig.map(strip),
    }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
