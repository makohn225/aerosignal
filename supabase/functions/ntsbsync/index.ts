import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";
import MDBReader from "npm:mdb-reader@3.0.0";
import { Buffer } from "node:buffer";

// Keeps the NTSB accident tables current (November 4, 2026). Two public sources, existing columns only:
//   mode "mdb":    an NTSB weekly update file from data.ntsb.gov/avdata (up01NOV.zip and so on; the last
//                  12 months of new and changed cases, with coordinates, aircraft and narratives).
//                  POST { mode: "mdb", file: "up01NOV.zip", probe?: true }
//   mode "mirror": the weekly public mirror of the NTSB "Download All" summary on GitHub, for cases from
//                  after the original load until the update files begin (no narratives in that source).
//                  POST { mode: "mirror", after: "2022-10-26", before: "2025-11-01", offset: 0 }
// Same x-ingest-token auth as the ingest function. Embeddings for new narratives come from ingest backfill.
const AV = "https://data.ntsb.gov/avdata/FileDirectory/DownloadFile?fileID=";
const MIRROR = "https://raw.githubusercontent.com/picluster-trading/aviation-data/main/data/ntsb_accidents.csv";

const INJ: Record<string, string> = { FATL: "Fatal", SERS: "Serious", MINR: "Minor", NONE: "Non-Fatal" };
const DMG: Record<string, string> = { DEST: "Destroyed", SUBS: "Substantial", MINR: "Minor", NONE: "None", UNK: "Unknown" };
const CAT: Record<string, string> = { AIR: "Airplane", HELI: "Helicopter", GLI: "Glider", BALL: "Balloon", WSFT: "Weight-Shift", PPAR: "Powered Parachute", GYRO: "Gyroplane", BLIM: "Blimp", ULTR: "Ultralight", PLFT: "Powered-Lift", UNK: "Unknown" };
const ENG: Record<string, string> = { REC: "Reciprocating", TP: "Turbo Prop", TF: "Turbo Fan", TS: "Turbo Shaft", TJ: "Turbo Jet", ELEC: "Electric", NONE: "None", UNK: "Unknown" };
const PUR: Record<string, string> = { PERS: "Personal", INST: "Instructional", BUS: "Business", POSI: "Positioning", AAPL: "Aerial Application", OWRK: "Other Work Use", UNK: "Unknown", AOBV: "Aerial Observation", FLTS: "Flight Test", SKYD: "Skydiving", EXEC: "Executive/corporate", BANT: "Banner Tow", FERY: "Ferry", PUBU: "Public Aircraft", PUBF: "Public Aircraft - Federal", PUBS: "Public Aircraft - State", PUBL: "Public Aircraft - Local", ASHO: "Air Race show", GLDT: "Glider Tow", EXTE: "External Load", FIRF: "Firefighting", ADRP: "Air Drop" };
const WX: Record<string, string> = { VMC: "VMC", IMC: "IMC", UNK: "Unknown" };

function fam(make: string, model: string) {
  const mk = (make || "").toUpperCase().trim(), md = (model || "").toUpperCase().replace(/\s/g, "");
  if (mk.startsWith("CESSNA") && /^(C-?)?172/.test(md)) return "C172";
  if (mk.startsWith("PIPER") && /^PA-?28R/.test(md)) return "PA28R";
  if (mk.startsWith("PIPER") && /^PA-?28(-?\d{3})?$/.test(md)) return "PA28";
  if (mk.includes("CIRRUS") && /^SR-?2[02]/.test(md)) return "SR2X";
  if (mk.includes("DIAMOND") && /^DA-?40/.test(md)) return "DA40";
  return null;
}
const s = (v: unknown) => { const t = v == null ? "" : String(v).trim(); return t === "" ? null : t; };
const n = (v: unknown) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
const d = (v: unknown) => { if (v == null || v === "") return null; const x = v instanceof Date ? v : new Date(String(v)); return isNaN(+x) ? null : x.toISOString().slice(0, 10); };
const title = (t: string | null) => (t ? t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : null);

async function upsert(sb: any, table: string, rows: Record<string, unknown>[], key = "ev_id") {
  const seen = new Set(); rows = rows.filter((r) => (seen.has(r[key]) ? false : (seen.add(r[key]), true)));
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 400), { onConflict: key });
    if (error) throw new Error(`${table}: ${error.message} at ${i}`);
  }
  return rows.length;
}

async function mdb(sb: any, body: any) {
  if (!/^up\d{2}[A-Z]{3}\.zip$/.test(body.file || "")) return Response.json({ error: "bad file" }, { status: 400 });
  const r = await fetch(AV + body.file, { headers: { "User-Agent": "Mozilla/5.0 (vigilyn-safety)" } });
  if (!r.ok) return Response.json({ error: "fetch " + r.status }, { status: 502 });
  const files = unzipSync(new Uint8Array(await r.arrayBuffer()));
  const name = Object.keys(files).find((k) => /\.mdb$/i.test(k));
  if (!name) return Response.json({ error: "no mdb" }, { status: 502 });
  const db = new MDBReader(Buffer.from(files[name]));
  const tn = db.getTableNames();
  const T = (want: string) => { const k = tn.find((x: string) => x.toLowerCase() === want); return k ? db.getTable(k) : null; };
  if (body.probe) {
    const out: Record<string, unknown> = { tables: tn };
    for (const t of ["events", "aircraft", "narratives", "engines"]) { const tb = T(t); if (tb) out[t] = { cols: tb.getColumnNames(), n: tb.rowCount, row: tb.getData({ rowLimit: 1 })[0] }; }
    return Response.json(out);
  }
  const ev = T("events")!.getData() as any[];
  const ac = (T("aircraft")?.getData() || []) as any[];
  const en = (T("engines")?.getData() || []) as any[];
  const na = (T("narratives")?.getData() || []) as any[];
  const acBy = new Map<string, any>(); for (const a of ac) if (!acBy.has(a.ev_id) || Number(a.Aircraft_Key) === 1) acBy.set(a.ev_id, a);
  const enBy = new Map<string, any>(); for (const e of en) if (!enBy.has(e.ev_id)) enBy.set(e.ev_id, e);
  const events = ev.filter((e) => (d(e.ev_date) || "") > "2008-01-01").map((e) => {
    const a = acBy.get(e.ev_id) || {}, g = enBy.get(e.ev_id) || {};
    const lat = n(e.dec_latitude), lon = n(e.dec_longitude);
    const city = title(s(e.ev_city)), st = s(e.ev_state);
    return {
      ev_id: s(e.ev_id), accident_number: s(e.ntsb_no), event_date: d(e.ev_date),
      location: city ? (st ? `${city}, ${st}` : city) : null, country: s(e.ev_country) === "USA" ? "United States" : s(e.ev_country),
      latitude: lat && Math.abs(lat) > 0.01 ? lat : null, longitude: lon && Math.abs(lon) > 0.01 ? lon : null,
      lat_raw: s(e.latitude), lon_raw: s(e.longitude), airport_code: s(e.ev_nr_apt_id), airport_name: title(s(e.apt_name)),
      injury_severity: INJ[s(e.ev_highest_injury) || ""] ?? null, aircraft_damage: DMG[s(a.damage) || ""] ?? null,
      aircraft_category: CAT[s(a.acft_category) || ""] ?? null, make: s(a.acft_make)?.toUpperCase() ?? null, model: s(a.acft_model),
      family: fam(s(a.acft_make) || "", s(a.acft_model) || ""), amateur_built: s(a.homebuilt) === "Y" ? true : s(a.homebuilt) === "N" ? false : null,
      engines: n(a.num_eng), engine_type: ENG[s(g.eng_type) || ""] ?? null, far_part: s(a.far_part), purpose: PUR[s(a.type_fly) || ""] ?? null,
      fatal: n(e.inj_tot_f), serious: n(e.inj_tot_s), minor: n(e.inj_tot_m), uninjured: n(e.inj_tot_n),
      weather_condition: WX[s(e.wx_cond_basic) || ""] ?? null, phase: null,
    };
  }).filter((x) => x.ev_id);
  const dates = new Map(events.map((e) => [e.ev_id, e.event_date]));
  const narr: Record<string, unknown>[] = [];
  const byEv = new Map<string, any>(); for (const x of na) if (!byEv.has(x.ev_id) || Number(x.Aircraft_Key) === 1) byEv.set(x.ev_id, x);
  for (const [id, x] of byEv) {
    if (!dates.has(id)) continue;
    const text = [s(x.narr_accf) || s(x.narr_accp), s(x.narr_cause) ? `Probable cause: ${s(x.narr_cause)}` : null].filter(Boolean).join("\n\n");
    if (text.length > 40) narr.push({ ev_id: id, event_date: dates.get(id), narrative: text, embedding: null, embedded_at: null });
  }
  // A summary row from the mirror for the same case is replaced by the full record
  const nos = events.map((e) => e.accident_number).filter(Boolean) as string[];
  for (let i = 0; i < nos.length; i += 300) await sb.from("ntsb_events").delete().in("ev_id", nos.slice(i, i + 300));
  const ne = await upsert(sb, "ntsb_events", events);
  const nn = await upsert(sb, "ntsb_narratives", narr);
  const span = events.map((e) => e.event_date as string).sort();
  return Response.json({ file: body.file, events: ne, narratives: nn, from: span[0], to: span[span.length - 1] });
}

function csvRows(t: string) {
  const rows: string[][] = []; let row: string[] = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const PISTON = /^(CESSNA|PIPER|CIRRUS|MOONEY|DIAMOND|AERONCA|LUSCOMBE|TAYLORCRAFT|CHAMPION|AMERICAN CHAMPION|BELLANCA|GRUMMAN|MAULE|STINSON|ERCOUPE|SOCATA|TECNAM|VANS|VAN'S|LAKE|COMMANDER|ROCKWELL|BEECH|AVIAT|REMOS|ICON|CUBCRAFTERS)/;
function guessEngine(make: string, model: string, engines: number | null, cat: string | null) {
  if (cat !== "Airplane" || engines !== 1) return null;
  const mk = make.toUpperCase(), md = model.toUpperCase().replace(/\s/g, "");
  if (!PISTON.test(mk)) return null;
  if (/^CESSNA/.test(mk) && /^(208|5\d\d|CITATION)/.test(md)) return null;
  if (/^PIPER/.test(mk) && /PA-?46-?5|M500|M600|PA-?42|PA-?31T/.test(md)) return null;
  if (/CIRRUS/.test(mk) && /SF50/.test(md)) return null;
  if (/^BEECH/.test(mk) && !/^(A?36|V?35|F33|B19|C23|A23|A24|77|35)/.test(md)) return null;
  return "Reciprocating";
}
async function mirror(sb: any, body: any) {
  const after = String(body.after || "2022-10-26"), before = String(body.before || "2099-01-01");
  // The file is newest first, so the first megabytes hold every case since the original load
  const r = await fetch(MIRROR, { headers: { Range: `bytes=0-${Math.min(4_000_000, body.bytes | 0 || 1_600_000)}` } });
  if (!r.ok) return Response.json({ error: "fetch " + r.status }, { status: 502 });
  const txt = await r.text();
  const rows = csvRows(txt.slice(0, txt.lastIndexOf("\n") + 1)); const H = rows.shift()!; const ix = (k: string) => H.indexOf(k);
  if (rows.length && rows[rows.length - 1][ix("EventDate")].slice(0, 10) > after) return Response.json({ error: "range too short; pass a larger bytes" }, { status: 400 });
  const pick = rows.filter((x) => x.length === H.length && x[ix("EventDate")].slice(0, 10) > after && x[ix("EventDate")].slice(0, 10) < before && x[ix("Country")] === "United States");
  const off = body.offset | 0, lim = Math.min(3000, body.limit | 0 || 3000);
  const part = pick.slice(off, off + lim);
  const have = new Set<string>();
  const nos = part.map((x) => x[ix("NtsbNo")]);
  for (let i = 0; i < nos.length; i += 300) {
    const { data } = await sb.from("ntsb_events").select("accident_number,ev_id").in("accident_number", nos.slice(i, i + 300));
    for (const h of data || []) if (h.ev_id !== h.accident_number) have.add(h.accident_number);
  }
  const cat1 = (c: string) => (c ? CAT[c.split(",")[0]] ?? null : "Airplane");
  const out = part.filter((x) => !have.has(x[ix("NtsbNo")])).map((x) => {
    const lat = n(x[ix("Latitude")]), lon = n(x[ix("Longitude")]), make = x[ix("Make")] || "", model = x[ix("Model")] || "";
    const eng = n((x[ix("NumberOfEngines")] || "").split(",")[0]), cat = cat1(x[ix("AirCraftCategory")]);
    const inj = s(x[ix("HighestInjuryLevel")]);
    return {
      ev_id: x[ix("NtsbNo")], accident_number: x[ix("NtsbNo")], event_date: x[ix("EventDate")].slice(0, 10), country: "United States",
      latitude: lat && Math.abs(lat) > 0.01 ? lat : null, longitude: lon && Math.abs(lon) > 0.01 ? lon : null,
      injury_severity: inj === "Fatal" ? "Fatal" : inj === "Serious" ? "Serious" : inj === "Minor" ? "Minor" : "Non-Fatal",
      aircraft_damage: s(x[ix("AirCraftDamage")]), aircraft_category: x[ix("AirCraftCategory")] ? cat : null, make: make.toUpperCase() || null, model: model || null,
      family: fam(make, model), engines: eng, engine_type: guessEngine(make, model, eng, cat),
      far_part: s(x[ix("FAR")]), purpose: PUR[(x[ix("PurposeOfFlight")] || "").split(",")[0]] ?? null,
      fatal: n(x[ix("FatalInjuryCount")]), serious: n(x[ix("SeriousInjuryCount")]), minor: n(x[ix("MinorInjuryCount")]),
      weather_condition: WX[(x[ix("WeatherCondition")] || "").split(",")[0]] ?? null,
    };
  });
  const ne = await upsert(sb, "ntsb_events", out);
  return Response.json({ matched: pick.length, offset: off, already_full: have.size, upserted: ne });
}

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const { data: okTok } = await sb.rpc("check_ingest_token", { t: req.headers.get("x-ingest-token") ?? "" });
  if (okTok !== true) return new Response("forbidden", { status: 403 });
  try {
    if (body.mode === "mdb") return await mdb(sb, body);
    if (body.mode === "mirror") return await mirror(sb, body);
    return Response.json({ error: "mode must be mdb or mirror" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
