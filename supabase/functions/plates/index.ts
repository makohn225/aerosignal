import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Approach plate relay. aeronav.faa.gov does not allow browser (CORS) requests, so the app calls this instead.
// FAA d-TPP charts are public domain. Read only; nothing is stored.
//   GET plates?apt=LYH            -> the airport's charts for the current cycle (approaches, diagram, SIDs, STARs, minimums)
//   GET plates?pdf=00499IL4.PDF   -> the chart PDF itself
//   GET plates?geo=00499IL4.PDF   -> the georeference the FAA embeds in the PDF (page box, corner lat/lon, projection)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const UA = "AeroSignal/0.1 (preflight risk prototype)";
const ANCHOR = Date.UTC(2026, 0, 22); // AIRAC 2601
const DAY = 864e5;

function cycleIds(): { id: string; from: string }[] {
  const n = Math.floor((Date.now() - ANCHOR) / (28 * DAY));
  return [n, n - 1].map((k) => {
    const d = new Date(ANCHOR + k * 28 * DAY);
    // AIRAC numbering restarts each year: count cycles since the first one of that year
    const y = d.getUTCFullYear();
    let first = ANCHOR; while (new Date(first).getUTCFullYear() < y) first += 13 * 28 * DAY;
    while (new Date(first - 28 * DAY).getUTCFullYear() === y) first -= 28 * DAY;
    const num = Math.round((d.getTime() - first) / (28 * DAY)) + 1;
    return { id: `${String(y).slice(2)}${String(num).padStart(2, "0")}`, from: d.toISOString().slice(0, 10) };
  });
}

let META: { at: number; cycle: string; from: string; xml: string } | null = null;
let loading: Promise<void> | null = null;
async function meta() {
  if (META && Date.now() - META.at < 6 * 3600e3) return META;
  if (!loading) loading = (async () => {
    let last = "";
    for (const c of cycleIds()) {
      const r = await fetch(`https://aeronav.faa.gov/d-tpp/${c.id}/xml_data/d-tpp_Metafile.xml`, { headers: { "User-Agent": UA } });
      if (r.ok) { META = { at: Date.now(), cycle: c.id, from: c.from, xml: await r.text() }; return; }
      last = String(r.status);
    }
    throw new Error(`FAA chart index not reachable (${last})`);
  })().finally(() => { loading = null; });
  await loading;
  return META!;
}

const tag = (x: string, t: string) => { const m = x.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return m ? m[1].trim() : ""; };
const unesc = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function airportBlock(xml: string, apt: string) {
  const u = apt.toUpperCase();
  const keys = [`apt_ident="${u}"`, `icao_ident="${u}"`];
  if (/^K[A-Z0-9]{3}$/.test(u)) keys.push(`apt_ident="${u.slice(1)}"`);
  for (const k of keys) {
    const i = xml.indexOf(k);
    if (i < 0) continue;
    const s = xml.lastIndexOf("<airport_name", i);
    const e = xml.indexOf("</airport_name>", i);
    return xml.slice(s, e);
  }
  return null;
}

async function list(apt: string) {
  const m = await meta();
  const blk = airportBlock(m.xml, apt);
  const head = blk ? blk.slice(0, blk.indexOf(">") + 1) : "";
  const attr = (a: string) => { const r = head.match(new RegExp(`${a}="([^"]*)"`)); return r ? unesc(r[1]) : ""; };
  const charts = blk ? blk.split("<record>").slice(1).map((r) => ({
    code: tag(r, "chart_code"),
    name: unesc(tag(r, "chart_name")),
    pdf: tag(r, "pdf_name"),
    action: tag(r, "useraction"),
    amdt: tag(r, "amdtnum"),
  })).filter((c) => c.pdf && c.action !== "D") : [];
  return {
    cycle: m.cycle, effective: m.from, source: "FAA digital Terminal Procedures Publication (d-TPP)",
    apt: attr("apt_ident") || apt.toUpperCase(), icao: attr("icao_ident"), name: attr("ID"), military: attr("military") === "Y",
    charts,
  };
}

const PDF_OK = /^[A-Z0-9_]{2,24}\.PDF$/i;
async function pdfBytes(name: string) {
  const m = await meta();
  const r = await fetch(`https://aeronav.faa.gov/d-tpp/${m.cycle}/${name.toUpperCase()}`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`chart ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

function nums(s: string | undefined) { return s ? s.trim().split(/\s+/).map(Number) : null; }
function geo(bytes: Uint8Array) {
  // The viewport dictionary sits in plain text in the page object of FAA charts
  const txt = new TextDecoder("latin1").decode(bytes);
  const vp = txt.indexOf("/VP");
  if (vp < 0) return null;
  const seg = txt.slice(vp, vp + 4000);
  const bbox = nums(seg.match(/\/BBox\s*\[([^\]]+)\]/)?.[1]);
  const gpts = nums(seg.match(/\/GPTS\s*\[([^\]]+)\]/)?.[1]);
  const lpts = nums(seg.match(/\/LPTS\s*\[([^\]]+)\]/)?.[1]);
  if (!bbox || !gpts || !lpts || gpts.length < 8 || lpts.length < 8) return null;
  const media = nums(txt.match(/\/MediaBox\s*\[([^\]]+)\]/)?.[1]);
  const rot = Number(txt.match(/\/Rotate\s+(\d+)/)?.[1] || 0);
  const p = (k: string) => { const r = seg.match(new RegExp(`PARAMETER\\["${k}",(-?[0-9.]+)\\]`)); return r ? Number(r[1]) : null; };
  return {
    bbox, gpts, lpts, media, rotate: rot,
    projection: /Lambert_Conformal_Conic/.test(seg) ? "LCC" : (seg.match(/PROJECTION\["([^"]+)"/)?.[1] || ""),
    params: { cm: p("Central_Meridian"), lat0: p("Latitude_Of_Origin"), sp1: p("Standard_Parallel_1"), sp2: p("Standard_Parallel_2") },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  try {
    const apt = (u.searchParams.get("apt") || "").trim();
    const pdf = (u.searchParams.get("pdf") || "").trim();
    const g = (u.searchParams.get("geo") || "").trim();
    if (apt) {
      if (!/^[A-Z0-9]{3,4}$/i.test(apt)) return Response.json({ error: "apt must be an airport id" }, { status: 400, headers: CORS });
      return Response.json(await list(apt), { headers: { ...CORS, "Cache-Control": "public, max-age=3600" } });
    }
    if (pdf) {
      if (!PDF_OK.test(pdf)) return Response.json({ error: "bad chart name" }, { status: 400, headers: CORS });
      return new Response(await pdfBytes(pdf), { headers: { ...CORS, "Content-Type": "application/pdf", "Cache-Control": "public, max-age=86400" } });
    }
    if (g) {
      if (!PDF_OK.test(g)) return Response.json({ error: "bad chart name" }, { status: 400, headers: CORS });
      const m = await meta();
      return Response.json({ cycle: m.cycle, pdf: g.toUpperCase(), geo: geo(await pdfBytes(g)) }, { headers: { ...CORS, "Cache-Control": "public, max-age=86400" } });
    }
    return Response.json({ error: "use ?apt=LYH, ?pdf=NAME.PDF or ?geo=NAME.PDF" }, { status: 400, headers: CORS });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502, headers: CORS });
  }
});
