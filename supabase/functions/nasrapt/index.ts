import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

// FAA NASR airport data (28 day subscription, APT CSV) into public.faa_airports (approved November 8, 2026).
//   POST { cycle?: "2026-10-29", part?: 0, parts?: 2 }   The cycle defaults to the one in effect today; parts split the
//   upsert across calls if needed. Same x-ingest-token auth as the ingest function.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function cycleNow() { const base = Date.UTC(2026, 9, 29), day = 864e5, k = Math.floor((Date.now() - base) / (28 * day)); return new Date(base + k * 28 * day); }
const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}_${MON[d.getUTCMonth()]}_${d.getUTCFullYear()}`;
function cells(line: string) {
  const out: string[] = []; let f = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (q) { if (c === 34) { if (line.charCodeAt(i + 1) === 34) { f += '"'; i++; } else q = false; } else f += line[i]; }
    else if (c === 34) q = true; else if (c === 44) { out.push(f); f = ""; } else if (c !== 13) f += line[i];
  }
  out.push(f); return out;
}
const s = (v: string | undefined) => { const t = (v || "").trim(); return t ? t : null; };
const n = (v: string | undefined) => { const x = parseFloat(v || ""); return isFinite(x) ? x : null; };

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));
  const { data: okTok } = await sb.rpc("check_ingest_token", { t: req.headers.get("x-ingest-token") ?? "" });
  if (okTok !== true) return new Response("forbidden", { status: 403 });
  const cyc = body.cycle ? new Date(body.cycle + "T00:00:00Z") : cycleNow();
  const url = `https://nfdc.faa.gov/webContent/28DaySub/extra/${fmt(cyc)}_APT_CSV.zip`;
  try {
    const r = await fetch(url);
    if (!r.ok) return Response.json({ error: `fetch ${r.status}`, url }, { status: 502 });
    const files = unzipSync(new Uint8Array(await r.arrayBuffer()), { filter: (f) => /APT_(BASE|ATT)\.csv$/.test(f.name) });
    const base = strFromU8(files[Object.keys(files).find((k) => k.endsWith("APT_BASE.csv"))!]).split("\n");
    const attK = Object.keys(files).find((k) => k.endsWith("APT_ATT.csv"));
    const att = new Map<string, string[]>();
    if (attK) {
      const L = strFromU8(files[attK]).split("\n"), H = cells(L[0]), si = H.indexOf("SITE_NO"), mo = H.indexOf("MONTH"), dy = H.indexOf("DAY"), hr = H.indexOf("HOUR");
      for (let i = 1; i < L.length; i++) { if (!L[i]) continue; const c = cells(L[i]); const t = [c[mo], c[dy], c[hr]].map((x) => (x || "").trim()).filter(Boolean).join(" "); if (!t) continue; const a = att.get(c[si]) || []; a.push(t); att.set(c[si], a); }
    }
    const H = cells(base[0]), ix = (k: string) => H.indexOf(k);
    const I = { site: ix("SITE_NO"), type: ix("SITE_TYPE_CODE"), st: ix("STATE_CODE"), id: ix("ARPT_ID"), city: ix("CITY"), name: ix("ARPT_NAME"), own: ix("OWNERSHIP_TYPE_CODE"), use: ix("FACILITY_USE_CODE"), lat: ix("LAT_DECIMAL"), lon: ix("LONG_DECIMAL"), elev: ix("ELEV"), status: ix("ARPT_STATUS"), fuel: ix("FUEL_TYPES"), twr: ix("TWR_TYPE_CODE"), lgt: ix("LGT_SKED"), other: ix("OTHER_SERVICES"), icao: ix("ICAO_ID") };
    const rows: Record<string, unknown>[] = [];
    for (let i = 1; i < base.length; i++) {
      if (!base[i]) continue;
      const c = cells(base[i]); const site = s(c[I.site]), id = s(c[I.id]); if (!site || !id) continue;
      const icao = s(c[I.icao]);
      rows.push({ site_no: site, arpt_id: id, icao_id: icao, ident: icao || id, site_type: s(c[I.type]), name: s(c[I.name]), city: s(c[I.city]), state: s(c[I.st]),
        lat: n(c[I.lat]), lon: n(c[I.lon]), elev_ft: n(c[I.elev]), ownership: s(c[I.own]), facility_use: s(c[I.use]), status: s(c[I.status]),
        fuel_types: s(c[I.fuel]), twr_type: s(c[I.twr]), lgt_sked: s(c[I.lgt]), other_services: s(c[I.other]),
        attendance: (att.get(c[I.site]) || []).join("; ") || null, cycle: cyc.toISOString().slice(0, 10), loaded_at: new Date().toISOString() });
    }
    // A few sites appear twice in the file; keep the first row for each site number
    const seenSite = new Set<string>(); for (let i = rows.length - 1; i >= 0; i--) { const k = rows[i].site_no as string; if (seenSite.has(k)) rows.splice(i, 1); else seenSite.add(k); }
    const parts = Math.max(1, body.parts | 0 || 1), part = Math.min(parts - 1, Math.max(0, body.part | 0));
    const size = Math.ceil(rows.length / parts), mine = rows.slice(part * size, (part + 1) * size);
    for (let i = 0; i < mine.length; i += 1000) {
      const { error } = await sb.from("faa_airports").upsert(mine.slice(i, i + 1000), { onConflict: "site_no" });
      if (error) return Response.json({ error: error.message, at: i }, { status: 500 });
    }
    return Response.json({ url, total: rows.length, part, parts, upserted: mine.length, withFuel: mine.filter((x) => x.fuel_types).length });
  } catch (e) { return Response.json({ error: String(e), url }, { status: 500 }); }
});
