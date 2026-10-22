// Published approach vertical paths from the FAA Coded Instrument Flight Procedures (CIFP, ARINC 424).
// Public domain FAA data, read from the current cycle zip and cached in memory. Read only.
//   GET cifp?apt=KLYH        -> runway thresholds (position, elevation, crossing height) and each approach's
//                               glidepath angle and final approach fix
//   GET cifp?apt=KLYH&raw=1  -> the airport's raw runway and approach records (for checking the parser)
import { Unzip, UnzipInflate } from "npm:fflate@0.8.2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
const PAGE = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/";
let zipCache: { name: string; at: number; bytes: Uint8Array } | null = null;
const aptCache = new Map<string, { at: number; lines: string[] }>();

async function zip() {
  if (zipCache && Date.now() - zipCache.at < 6 * 36e5) return zipCache;
  let names: string[] = [];
  try { const page = await (await fetch(PAGE, { headers: { "User-Agent": "Mozilla/5.0 (AeroSignal)" } })).text(); names = [...new Set(page.match(/CIFP_\d{6}\.zip/g) || [])].sort(); } catch { /* use the cycle date */ }
  // The current cycle: the latest one that is already effective. AIRAC cycles run every 28 days.
  const today = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  let name = names.filter((n) => n.slice(5, 11) <= today).pop();
  if (!name) {
    const ref = Date.UTC(2026, 9, 1), k = Math.floor((Date.now() - ref) / (28 * 864e5));
    const d = new Date(ref + k * 28 * 864e5);
    name = `CIFP_${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}.zip`;
  }
  if (!name) throw new Error("no CIFP cycle listed");
  if (zipCache && zipCache.name === name) { zipCache.at = Date.now(); return zipCache; }
  const r = await fetch(`https://aeronav.faa.gov/Upload_313-d/cifp/${name}`);
  if (!r.ok) throw new Error(`CIFP download ${r.status}`);
  zipCache = { name, at: Date.now(), bytes: new Uint8Array(await r.arrayBuffer()) };
  return zipCache;
}

// Stream the big FAACIFP18 file and keep only this airport's section P records
async function records(apt: string): Promise<string[]> {
  const hit = aptCache.get(apt);
  if (hit && Date.now() - hit.at < 6 * 36e5) return hit.lines;
  const z = await zip();
  const out: string[] = [];
  let tail = "", seen = false, done = false;
  const dec = new TextDecoder();
  await new Promise<void>((resolve, reject) => {
    const uz = new Unzip();
    uz.register(UnzipInflate);
    uz.onfile = (f) => {
      if (!/FAACIFP/i.test(f.name)) return;
      f.ondata = (err, chunk, final) => {
        if (err) return reject(err);
        if (done) return;
        const txt = tail + dec.decode(chunk, { stream: !final });
        const lines = txt.split(/\r?\n/);
        tail = final ? "" : lines.pop() || "";
        for (const l of lines) {
          if (l.length < 20 || l[4] !== "P") continue;
          const id = l.slice(6, 10).trim();
          if (id === apt) { seen = true; out.push(l); }
          else if (seen) { done = true; break; }
        }
        if (final || done) { resolve(); if (done) throw new Error("STOP"); }
      };
      f.start();
    };
    try { uz.push(z.bytes, true); } catch (e) { if (!done) reject(e); }
    if (done) resolve();
  });
  aptCache.set(apt, { at: Date.now(), lines: out });
  return out;
}


// ARINC 424 fixed columns (1 based in the spec, 0 based here)
const num = (s: string) => { const t = s.trim(); return t === "" || !/^[+-]?\d+$/.test(t) ? null : Number(t); };
function latlon(s: string, deg: number) { // N37193470 or W079120345: degrees, minutes, seconds and hundredths
  const h = s[0], d = Number(s.slice(1, 1 + deg)), m = Number(s.slice(1 + deg, 3 + deg)), sec = Number(s.slice(3 + deg)) / 100;
  const v = d + m / 60 + sec / 3600;
  return h === "S" || h === "W" ? -v : v;
}
const KIND: Record<string, string> = { I: "ILS", L: "LOC", R: "RNAV (GPS)", H: "RNAV (RNP)", P: "GPS", D: "VOR/DME", V: "VOR", S: "VOR", N: "NDB", Q: "NDB/DME", X: "LDA", U: "SDF", B: "LOC/BC", J: "GLS" };
function parse(lines: string[]) {
  const runways: Record<string, unknown> = {};
  const approaches: { id: string; kind: string; rwy: string; gpa: number; thrAlt: number | null; faf: string | null; fafAlt: number | null }[] = [];
  const fafs: Record<string, { fix: string; alt: number | null }> = {};
  for (const l of lines) {
    if (l[12] === "G" && l[21] === "0" || l[12] === "G" && l[21] === "1") {
      const id = l.slice(13, 18).trim();
      if (!/^RW/.test(id) || runways[id.slice(2)]) continue;
      runways[id.slice(2)] = {
        lat: latlon(l.slice(32, 41), 2), lon: latlon(l.slice(41, 51), 3),
        len: num(l.slice(22, 27)), brgM: num(l.slice(27, 31)) != null ? num(l.slice(27, 31))! / 10 : null,
        elev: num(l.slice(66, 71)), disp: num(l.slice(71, 75)), tch: num(l.slice(75, 77)), w: num(l.slice(77, 80)),
      };
    }
    if (l[12] === "F" && l[38] !== "2" && /^[A-Z]/.test(l[19])) {
      const id = l.slice(13, 19).trim(), fix = l.slice(29, 34).trim(), desc = l.slice(39, 43);
      if (l.slice(20, 25).trim()) continue; // transitions
      if (desc[3] === "F") fafs[id] = { fix, alt: num(l.slice(84, 89)) };
      const va = num(l.slice(102, 106));
      if (va != null && va < 0 && /^RW/.test(fix)) {
        const rwy = fix.slice(2);
        if (!approaches.some((a) => a.id === id)) approaches.push({ id, kind: KIND[l[19]] || l[19], rwy, gpa: -va / 100, thrAlt: num(l.slice(84, 89)), faf: null, fafAlt: null });
      }
    }
  }
  for (const a of approaches) { const f = fafs[a.id]; if (f) { a.faf = f.fix; a.fafAlt = f.alt; } }
  return { runways, approaches };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const u = new URL(req.url);
    let apt = (u.searchParams.get("apt") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^[A-Z]{3}$/.test(apt)) apt = "K" + apt;
    if (!apt) return Response.json({ error: "apt required" }, { status: 400, headers: CORS });
    const t0 = Date.now();
    const lines = await records(apt);
    const z = await zip();
    if (u.searchParams.get("raw")) {
      const keep = lines.filter((l) => l[12] === "G" || l[12] === "I");
      return Response.json({ cycle: z.name, n: lines.length, ms: Date.now() - t0, lines: keep.slice(0, 40), ...parse(lines) }, { headers: CORS });
    }
    return Response.json({ apt, cycle: z.name.slice(5, 11), ...parse(lines) }, { headers: { ...CORS, "Cache-Control": "public, max-age=86400" } });
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 300) }, { status: 502, headers: CORS });
  }
});
