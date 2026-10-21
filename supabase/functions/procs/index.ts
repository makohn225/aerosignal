import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

// SID and STAR relay. Reads the FAA NASR 28 day DP and STAR CSV files (public domain) and returns procedures
// in flying order. Read only; nothing is stored.
//   GET procs?apt=LYH        -> every SID and STAR serving the airport, with bodies, transitions and runways
//   GET procs?code=FRDMM7    -> one procedure by name (also accepts HURTT5.DECAF or BUCKO.FRDMM7)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const UA = "AeroSignal/0.1 (preflight risk prototype)";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ANCHOR = Date.UTC(2026, 8, 3); // a NASR cycle start, 3 Sep 2026
const DAY = 864e5;

type Seg = { name: string; pts: string[]; rwys: string[]; regions?: string[] };
type Proc = { type: "SID" | "STAR"; ident: string; code: string; name: string; rnav: boolean; airports: string[]; bodies: Seg[]; transitions: Seg[]; coords?: Record<string, [number, number]> };

let DB: { at: number; cycle: string; byIdent: Map<string, Proc>; byApt: Map<string, Set<string>> } | null = null;
let loading: Promise<void> | null = null;

function cycles(): Date[] {
  const n = Math.floor((Date.now() - ANCHOR) / (28 * DAY));
  return [n, n - 1].map((k) => new Date(ANCHOR + k * 28 * DAY));
}
const tag = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}_${MON[d.getUTCMonth()]}_${d.getUTCFullYear()}`;

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function table(files: Record<string, Uint8Array>, name: string) {
  const key = Object.keys(files).find((k) => k.toUpperCase().endsWith(name));
  if (!key) throw new Error(`missing ${name}`);
  const rows = parseCSV(strFromU8(files[key]));
  const head = rows.shift()!.map((h) => h.trim());
  return rows.filter((r) => r.length >= head.length - 1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}

async function fetchZip(kind: "DP" | "STAR" | "FIX" | "NAV") {
  let last = "";
  for (const d of cycles()) {
    const url = `https://nfdc.faa.gov/webContent/28DaySub/extra/${tag(d)}_${kind}_CSV.zip`;
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.ok) return { files: unzipSync(new Uint8Array(await r.arrayBuffer())), cycle: d.toISOString().slice(0, 10) };
    last = `${kind} ${r.status}`;
  }
  throw new Error(`FAA data not reachable (${last})`);
}

function build(kind: "SID" | "STAR", files: Record<string, Uint8Array>, byIdent: Map<string, Proc>, byApt: Map<string, Set<string>>) {
  const pre = kind === "SID" ? "DP" : "STAR";
  const base = table(files, `${pre}_BASE.CSV`);
  const rte = table(files, `${pre}_RTE.CSV`);
  const code = (r: Record<string, string>) => (kind === "SID" ? r.DP_COMPUTER_CODE : r.STAR_COMPUTER_CODE) || "";
  const identOf = (c: string) => (kind === "SID" ? c.split(".")[0] : c.split(".").pop() || "");
  for (const b of base) {
    const c = code(b); const id = identOf(c); if (!id) continue;
    const served = (b.SERVED_ARPT || "").split(/\s+/).filter(Boolean);
    byIdent.set(id, { type: kind, ident: id, code: c, name: (kind === "SID" ? b.DP_NAME : (b.STAR_NAME || b.ARRIVAL_NAME || id)) + (b.AMENDMENT_NO ? ` ${b.AMENDMENT_NO}` : ""), rnav: b.RNAV_FLAG === "Y", airports: served, bodies: [], transitions: [] });
    for (const a of served) { if (!byApt.has(a)) byApt.set(a, new Set()); byApt.get(a)!.add(id); }
  }
  const segs = new Map<string, { p: Proc; seg: Seg; trans: boolean; pts: [number, string][] }>();
  for (const r of rte) {
    const id = identOf(code(r)); const p = byIdent.get(id); if (!p) continue;
    const trans = r.ROUTE_PORTION_TYPE === "TRANSITION";
    const tcode = r.TRANSITION_COMPUTER_CODE || "";
    const nm = trans ? (kind === "SID" ? tcode.split(".").pop() : tcode.split(".")[0]) || r.ROUTE_NAME : r.ROUTE_NAME;
    const key = `${id}|${trans ? "T" : "B"}|${nm}|${r.BODY_SEQ}`;
    let s = segs.get(key);
    if (!s) {
      const rwys = (r.ARPT_RWY_ASSOC || "").split(/\s*,\s*/).filter(Boolean);
      s = { p, seg: { name: nm, pts: [], rwys }, trans, pts: [] };
      segs.set(key, s);
    }
    s.pts.push([Number(r.POINT_SEQ) || 0, r.POINT, r.ICAO_REGION_CODE || ""] as unknown as [number, string]);
  }
  for (const s of segs.values()) {
    const sorted = s.pts.sort((a, b) => a[0] - b[0]) as unknown as [number, string, string][];
    const keep = sorted.filter((x, i, a) => x[1] && x[1] !== (a[i - 1] || [])[1]);
    s.seg.pts = keep.map((x) => x[1]);
    s.seg.regions = keep.map((x) => x[2]);
    (s.trans ? s.p.transitions : s.p.bodies).push(s.seg);
    for (const rw of s.seg.rwys) { const a = rw.split("/")[0]; if (a && !s.p.airports.includes(a)) s.p.airports.push(a); }
  }
  for (const p of byIdent.values()) if (p.type === kind) for (const a of p.airports) { if (!byApt.has(a)) byApt.set(a, new Set()); byApt.get(a)!.add(p.ident); }
}

// Coordinates for every point the procedures use, from the same cycle's FIX and NAV files
type Cand = { r: string; lat: number; lon: number };
function locate(byIdent: Map<string, Proc>, fixFiles: Record<string, Uint8Array>, navFiles: Record<string, Uint8Array>) {
  const need = new Set<string>();
  for (const p of byIdent.values()) for (const s of [...p.bodies, ...p.transitions]) for (const n of s.pts) need.add(n);
  const cands = new Map<string, Cand[]>();
  const add = (n: string, c: Cand) => { if (!cands.has(n)) cands.set(n, []); cands.get(n)!.push(c); };
  // FIX_BASE: the columns we need come before any free text, so a plain split is safe for them
  const fk = Object.keys(fixFiles).find((k) => k.toUpperCase().endsWith("FIX_BASE.CSV"));
  if (fk) {
    const lines = strFromU8(fixFiles[fk]).split("\n");
    const head = lines[0].replace(/"/g, "").trim().split(",");
    const iId = head.indexOf("FIX_ID"), iR = head.indexOf("ICAO_REGION_CODE"), iLa = head.indexOf("LAT_DECIMAL"), iLo = head.indexOf("LONG_DECIMAL");
    for (let i = 1; i < lines.length; i++) {
      const f = lines[i].split(",", iLo + 1);
      const id = (f[iId] || "").replace(/"/g, "");
      if (!need.has(id)) continue;
      add(id, { r: (f[iR] || "").replace(/"/g, ""), lat: Number(f[iLa]), lon: Number(f[iLo]) });
    }
  }
  try {
    for (const n of table(navFiles, "NAV_BASE.CSV")) if (need.has(n.NAV_ID)) add(n.NAV_ID, { r: "", lat: Number(n.LAT_DECIMAL), lon: Number(n.LONG_DECIMAL) });
  } catch { /* navaids are optional */ }
  for (const p of byIdent.values()) {
    const coords: Record<string, [number, number]> = {};
    const amb: string[] = [];
    for (const s of [...p.bodies, ...p.transitions]) s.pts.forEach((n, i) => {
      if (coords[n]) return;
      const cs = (cands.get(n) || []).filter((c) => isFinite(c.lat) && isFinite(c.lon));
      const reg = (s.regions || [])[i];
      const m = cs.filter((c) => c.r && c.r === reg);
      const pick = m.length === 1 ? m[0] : cs.length === 1 ? cs[0] : null;
      if (pick) coords[n] = [Math.round(pick.lat * 1e5) / 1e5, Math.round(pick.lon * 1e5) / 1e5];
      else if (cs.length) amb.push(n);
    });
    const known = Object.values(coords);
    if (amb.length && known.length) {
      const cla = known.reduce((a, c) => a + c[0], 0) / known.length, clo = known.reduce((a, c) => a + c[1], 0) / known.length;
      for (const n of amb) {
        const best = (cands.get(n) || []).reduce((b: Cand | null, c) => (!b || (c.lat - cla) ** 2 + (c.lon - clo) ** 2 < (b.lat - cla) ** 2 + (b.lon - clo) ** 2 ? c : b), null);
        if (best) coords[n] = [Math.round(best.lat * 1e5) / 1e5, Math.round(best.lon * 1e5) / 1e5];
      }
    }
    p.coords = coords;
    for (const s of [...p.bodies, ...p.transitions]) delete s.regions;
  }
}

async function load() {
  if (DB && Date.now() - DB.at < 12 * 3600e3) return;
  if (!loading) loading = (async () => {
    const [dp, st, fx, nv] = await Promise.all([fetchZip("DP"), fetchZip("STAR"), fetchZip("FIX"), fetchZip("NAV")]);
    const byIdent = new Map<string, Proc>(), byApt = new Map<string, Set<string>>();
    build("SID", dp.files, byIdent, byApt);
    build("STAR", st.files, byIdent, byApt);
    locate(byIdent, fx.files, nv.files);
    DB = { at: Date.now(), cycle: dp.cycle, byIdent, byApt };
  })().finally(() => { loading = null; });
  await loading;
}

const aptKey = (s: string) => { const u = s.toUpperCase().trim(); return /^K[A-Z0-9]{3}$/.test(u) ? u.slice(1) : u; };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  try {
    await load();
    const db = DB!;
    const meta = { cycle: db.cycle, source: "FAA NASR 28 day subscription, DP and STAR data" };
    const apt = (u.searchParams.get("apt") || "").trim();
    const code = (u.searchParams.get("code") || "").trim().toUpperCase();
    if (apt) {
      if (!/^[A-Z0-9]{3,4}$/i.test(apt)) return Response.json({ error: "apt must be an airport id" }, { status: 400, headers: CORS });
      let k = aptKey(apt); let ids = db.byApt.get(k);
      if (!ids && k.length === 4) { k = k.slice(1); ids = db.byApt.get(k); }
      const list = [...(ids || [])].map((i) => db.byIdent.get(i)!).sort((a, b) => a.ident.localeCompare(b.ident));
      return Response.json({ ...meta, apt: k, sids: list.filter((p) => p.type === "SID"), stars: list.filter((p) => p.type === "STAR") }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
    }
    if (code) {
      if (!/^[A-Z0-9.]{3,16}$/.test(code)) return Response.json({ error: "bad code" }, { status: 400, headers: CORS });
      const parts = code.split(".");
      const p = parts.map((x) => db.byIdent.get(x)).find(Boolean);
      if (!p) return Response.json({ ...meta, proc: null }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
      return Response.json({ ...meta, proc: p }, { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
    }
    return Response.json({ error: "use ?apt=LYH or ?code=FRDMM7" }, { status: 400, headers: CORS });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
