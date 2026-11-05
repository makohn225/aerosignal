import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// FAA Service Difficulty Reports into public.sdr_reports (approved November 4, 2026), general aviation makes only.
// The yearly CSV (faa.gov/av-info/download_SDR) is read in slices so each call stays small:
//   POST { year: 2025, offset: 0, span: 1500000, chain: true }   chain re-invokes itself for the next slice.
// Same x-ingest-token auth as the ingest function.
const HDR = "OperatorControlNumber,DifficultyDate,SubmissionDate,OperatorDesignator,SubmitterDesignator,SubmitterTypeCode,ReceivingRegionCode,ReceivingDistrictOffice,SDRType,JASCCode,NatureOfConditionA,NatureOfConditionB,NatureOfConditionC,PrecautionaryProcedureA,PrecautionaryProcedureB,PrecautionaryProcedureC,PrecautionaryProcedureD,StageOfOperationCode,HowDiscoveredCode,RegistryNNumber,AircraftMake,AircraftModel,AircraftSerialNumber,AircraftTotalTime,AircraftTotalCycles,EngineMake,EngineModel,EngineSerialNumber,EngineTotalTime,EngineTotalCycles,PropellerMake,PropellerModel,PropellerSerialNumber,PropellerTotalTime,PropellerTotalCycles,PartMake,PartName,PartNumber,PartSerialNumber,PartCondition,PartLocation,PartTotalTime,PartTotalCycles,PartTimeSince,PartSinceCode,ComponentMake,ComponentModel,ComponentName,ComponentPartNumber,ComponentSerialNumber,ComponentLocation,ComponentTotalTime,ComponentTotalCycles,ComponentTimeSince,ComponentSinceCode,FuselageStationFrom,FuselageStationTo,StringerFrom,StringerFromSide,StringerTo,StringerToSide,WingStationFrom,WingStationFromSide,WingStationTo,WingStationToSide,ButtLineFrom,ButtLineFromSide,ButtlineTo,ButtlineToSide,WaterLineFrom,WaterLineTo,CrackLength,NumberOfCracks,CorrosionLevel,StructuralOther,Discrepancy".split(",");
const I = (k: string) => HDR.indexOf(k);
const GA = /^(CESSNA|PIPER|CIRRUS|BEECH|RAYTHEON|TEXTRON|MOONEY|DIAMOND|ROBINSON|GRUMMAN|MAULE|AMERICAN CHAMPION|CHAMPION|AVIAT|TECNAM|VANS|VAN'S|LUSCOMBE|AERONCA|SOCATA|DAHER|COMMANDER|ROCKWELL|BELLANCA|TAYLORCRAFT|ERCOUPE|LAKE|ICON|CUBCRAFTERS|SCHWEIZER|ENSTROM|AMERICAN GENERAL|GULFSTREAM AMERICAN|QUEST|KODIAK|PILATUS|EXTRA|LIBERTY|FLIGHT DESIGN|PIPISTREL|REMOS)/;
const ANCHOR = /\n([A-Z0-9][A-Z0-9-]{3,40}),\d\d\/\d\d\/\d{4},/g;

function parse(t: string, pos: number, stopAt: number) {
  const rows: string[][] = [];
  while (pos < t.length && pos < stopAt) {
    const row: string[] = []; let f = "", i = pos, q = false, ok = false;
    for (; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n") { row.push(f.replace(/\r$/, "")); ok = true; i++; break; }
      else f += c;
    }
    if (!ok) break;
    if (row.length === HDR.length) rows.push(row);
    pos = i;
  }
  return rows;
}
const s = (v: string) => { const t = (v || "").trim(); return t ? t : null; };
const dt = (v: string) => { const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(v || ""); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const tok = req.headers.get("x-ingest-token") ?? "";
  const body = await req.json().catch(() => ({}));
  const { data: okTok } = await sb.rpc("check_ingest_token", { t: tok });
  if (okTok !== true) return new Response("forbidden", { status: 403 });
  const year = Math.min(2100, Math.max(1990, body.year | 0 || new Date().getUTCFullYear()));
  const offset = Math.max(0, body.offset | 0), span = Math.min(3_000_000, body.span | 0 || 1_500_000);
  try {
    const r = await fetch(`https://external.apic4e.faa.gov/sdrs/retrieve/SDR-${year}.csv`, { headers: { "User-Agent": "Mozilla/5.0 (vigilyn-safety)" } });
    if (!r.ok || !r.body) return Response.json({ error: "fetch " + r.status }, { status: 502 });
    // Stream to the slice: skip bytes before offset, keep span plus a tail to finish the last record
    const reader = r.body.getReader(); const parts: Uint8Array[] = []; let seen = 0, kept = 0, done = false;
    const want = span + 300_000;
    for (;;) {
      const { value, done: d } = await reader.read();
      if (d) { done = true; break; }
      const a = seen, b = seen + value.length; seen = b;
      if (b <= offset) continue;
      const piece = value.subarray(Math.max(0, offset - a));
      parts.push(piece); kept += piece.length;
      if (kept >= want) break;
    }
    try { await reader.cancel(); } catch (_) {}
    const buf = new Uint8Array(kept); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
    const t = "\n" + new TextDecoder("utf-8").decode(buf);
    ANCHOR.lastIndex = 0; const m = ANCHOR.exec(t);
    if (!m) return Response.json({ year, offset, rows: 0, done, note: "no record start in slice" });
    const rows = parse(t, m.index + 1, done && kept < want ? t.length : span);
    const out = rows.filter((x) => GA.test((x[I("AircraftMake")] || "").toUpperCase())).map((x) => ({
      id: x[I("OperatorControlNumber")], difficulty_date: dt(x[I("DifficultyDate")]), jasc: s(x[I("JASCCode")]),
      make: (x[I("AircraftMake")] || "").toUpperCase().trim(), model: s(x[I("AircraftModel")]),
      model_norm: (x[I("AircraftModel")] || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      part_name: s(x[I("PartName")]), part_condition: s(x[I("PartCondition")]), part_location: s(x[I("PartLocation")]),
      stage: s(x[I("StageOfOperationCode")]), discrepancy: (s(x[I("Discrepancy")]) || "").slice(0, 1200) || null,
    })).filter((x) => x.id);
    const seenId = new Set(); const uniq = out.filter((x) => (seenId.has(x.id) ? false : (seenId.add(x.id), true)));
    for (let i = 0; i < uniq.length; i += 500) {
      const { error } = await sb.from("sdr_reports").upsert(uniq.slice(i, i + 500), { onConflict: "id" });
      if (error) return Response.json({ error: error.message }, { status: 500 });
    }
    const finished = done && kept < want;
    const next = offset + span;
    if (body.chain && !finished) {
      // @ts-ignore EdgeRuntime is provided by the Supabase runtime
      EdgeRuntime.waitUntil(fetch(Deno.env.get("SUPABASE_URL") + "/functions/v1/sdrsync", { method: "POST", headers: { "Content-Type": "application/json", "x-ingest-token": tok }, body: JSON.stringify({ ...body, offset: next }) }));
    }
    return Response.json({ year, offset, parsed: rows.length, kept: uniq.length, finished, next: finished ? null : next });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
