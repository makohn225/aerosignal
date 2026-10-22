import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db } from "./db.ts";
import { newVapid, send } from "./push.ts";

// Flight alerts (approved October 22, 2026). Runs every 15 minutes from pg_cron.
//   GET  ?pub=1           the public VAPID key the app subscribes with (made once, kept in Vault)
//   POST (x-cron-key)     recheck weather, TFRs and closure NOTAMs for flights departing within
//                         4 hours, push "2 hours to go" and "the brief changed" notifications,
//                         and delete rows a few hours after each flight
//   POST ?test=1 (signed in user)  send a test notification to the posted subscription
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const UA = "AeroSignal/0.1 (flight alerts)";
const SUBJECT = "https://aerosignal-app.vercel.app";
const RANK: Record<string, number> = { VFR: 0, MVFR: 1, IFR: 2, LIFR: 3 };
const json = (o: unknown, s = 200) => Response.json(o, { status: s, headers: CORS });

async function secret(name: string): Promise<string | null> {
  const sql = await db();
  const r = await sql`select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1`;
  return r.length ? String(r[0].decrypted_secret) : null;
}
let vapidCache: { jwk: JsonWebKey; pub: string } | null = null;
async function vapid() {
  if (vapidCache) return vapidCache;
  let s = await secret("vapid_keys");
  if (!s) {
    const v = await newVapid();
    const sql = await db();
    await sql`select vault.create_secret(${JSON.stringify(v)}, 'vapid_keys', 'Web push signing keys for flight alerts')`;
    s = await secret("vapid_keys");
  }
  vapidCache = JSON.parse(s!);
  return vapidCache!;
}

/* Weather */
function cat(vis: number | null, ceil: number | null) {
  const c = ceil ?? 99999, v = vis ?? 99;
  if (c < 500 || v < 1) return "LIFR";
  if (c < 1000 || v < 3) return "IFR";
  if (c <= 3000 || v <= 5) return "MVFR";
  return "VFR";
}
const visNum = (v: unknown) => (v == null ? null : typeof v === "number" ? v : parseFloat(String(v).replace("+", "")) || null);
const ceilOf = (clouds: any[]) => { const b = (clouds || []).filter((c) => /BKN|OVC|OVX/.test(c.cover || "")).map((c) => +c.base).filter((n) => isFinite(n)); return b.length ? Math.min(...b) : null; };
async function weather(ids: string[]) {
  const out: Record<string, { metar?: any; taf?: any }> = {};
  if (!ids.length) return out;
  const get = async (p: string) => { const r = await fetch(`https://aviationweather.gov/api/data/${p}?ids=${ids.join(",")}&format=json`, { headers: { "User-Agent": UA } }); if (r.status === 204) return []; if (!r.ok) throw new Error(`${p} ${r.status}`); return await r.json(); };
  const [m, t] = await Promise.all([get("metar").catch((e) => { console.error(e); return []; }), get("taf").catch((e) => { console.error(e); return []; })]);
  for (const x of m as any[]) (out[x.icaoId] ??= {}).metar ??= x;
  for (const x of t as any[]) (out[x.icaoId] ??= {}).taf ??= x;
  return out;
}
// Flight category and gust at a station at a time: the METAR for the next hour, the TAF after that
function at(w: { metar?: any; taf?: any } | undefined, ms: number) {
  if (!w) return null;
  const soon = ms - Date.now() < 3600e3;
  if ((soon || !w.taf) && w.metar) return { cat: w.metar.fltCat || cat(visNum(w.metar.visib), ceilOf(w.metar.clouds)), gust: +w.metar.wgst || 0, src: "now" };
  if (w.taf) {
    const s = ms / 1000;
    const base = (w.taf.fcsts || []).filter((f: any) => !/TEMPO|PROB/.test(f.fcstChange || "") && f.timeFrom <= s && (f.timeTo ?? Infinity) > s);
    const f = base[base.length - 1] || (w.taf.fcsts || [])[0];
    if (f) return { cat: cat(visNum(f.visib), ceilOf(f.clouds)), gust: +f.wgst || 0, src: "forecast" };
  }
  return w.metar ? { cat: w.metar.fltCat || "VFR", gust: +w.metar.wgst || 0, src: "now" } : null;
}

/* TFRs near the route */
async function tfrs() {
  const r = await fetch("https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=2000&outputFormat=application/json&srsname=EPSG:4326", { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) return null;
  const j = await r.json();
  return (j.features || []).map((f: any) => {
    const p = f.properties || {}, g = f.geometry || {};
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return { id: String(p.NOTAM_KEY || "").split("-")[0] || String(f.id || ""), title: p.TITLE || "TFR", ring: polys.flatMap((poly: number[][][]) => poly[0] || []) };
  }).filter((x: any) => x.ring.length);
}
const nm = (a: number[], b: number[]) => 60 * Math.hypot(b[0] - a[0], (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180));
function near(pts: number[][], t: { ring: number[][] }) {
  // pts are [lat, lon]; rings are [lon, lat]. Dense route samples against the ring and its middle.
  const ring = t.ring.map((c) => [c[1], c[0]]);
  const mid = [ring.reduce((s, c) => s + c[0], 0) / ring.length, ring.reduce((s, c) => s + c[1], 0) / ring.length];
  const rad = Math.max(...ring.map((c) => nm(mid, c)));
  const samples: number[][] = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[i + 1] || a; const n = Math.max(1, Math.ceil(nm(a, b) / 5)); for (let k = 0; k < n; k++) samples.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return samples.some((s) => nm(s, mid) < rad + 10);
}

/* Runway and airport closures from the FAA NOTAM search */
async function closures(id: string) {
  const body = new URLSearchParams({ searchType: "0", designatorsForLocation: id, notamsOnly: "false", radius: "10", sortColumns: "5 false", sortDirection: "true", offset: "0" });
  try {
    const r = await fetch("https://notams.aim.faa.gov/notamSearch/search", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "application/json", "User-Agent": "Mozilla/5.0 (AeroSignal flight alerts)", Origin: "https://notams.aim.faa.gov", Referer: "https://notams.aim.faa.gov/notamSearch/" }, body, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.notamList || []).filter((n: any) => !n.cancelledOrExpired && (n.facilityDesignator || id).toUpperCase().replace(/^K/, "") === id.replace(/^K/, ""))
      .map((n: any) => ({ num: n.notamNumber || "", text: String(n.traditionalMessageFrom4thWord || n.traditionalMessage || "").replace(/\s+/g, " ").trim() }))
      .filter((n: any) => /^(RWY|AD)\b/.test(n.text) && /\bCLSD\b/.test(n.text) && !/\bTWY\b/.test(n.text.split(/\bCLSD\b/)[0]))
      .slice(0, 6);
  } catch { return null; }
}

const safeSend = async (...a: Parameters<typeof send>) => { try { return await send(...a); } catch (e) { console.error(e); return 0; } };
const z = (ms: number) => { const d = new Date(ms); return `${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}Z`; };

async function runCheck() {
  const sql = await db();
  await sql`delete from public.flight_alerts where coalesce(arr_at, dep_at + interval '3 hours') < now() - interval '6 hours'`;
  const rows = await sql`select * from public.flight_alerts where dep_at < now() + interval '4 hours' and coalesce(arr_at, dep_at + interval '3 hours') > now() - interval '30 minutes'`;
  if (!rows.length) return { rows: 0 };
  const v = await vapid();
  const ids = [...new Set(rows.flatMap((r: any) => (r.idents || []).filter((i: string) => /^[A-Z][A-Z0-9]{3}$/.test(i))))].slice(0, 40);
  const wx = await weather(ids as string[]);
  const tlist = await tfrs().catch(() => null);
  const closeIds = [...new Set(rows.flatMap((r: any) => (r.idents || []).slice(0, 2)))].filter(Boolean).slice(0, 10) as string[];
  const cl: Record<string, any[] | null> = {};
  await Promise.all(closeIds.map(async (i) => { cl[i] = await closures(i); }));
  let sent = 0, gone = 0;
  for (const r of rows as any[]) {
    const dep = +new Date(r.dep_at), arr = r.arr_at ? +new Date(r.arr_at) : dep + 3 * 36e5;
    const [d, a, alt] = r.idents || [];
    const st: any = {
      dep: d ? at(wx[d], dep) : null, arr: a ? at(wx[a], arr) : null, alt: alt ? at(wx[alt], arr) : null,
      tfr: tlist ? tlist.filter((t: any) => near(r.pts || [], t)).map((t: any) => ({ id: t.id, title: t.title })).filter((t: any, i: number, a: any[]) => a.findIndex((x) => x.id === t.id) === i).slice(0, 8) : (r.state && r.state.tfr) || [],
      cls: [d, a].filter(Boolean).flatMap((i: string) => (cl[i] || []).map((n: any) => ({ ap: i, num: n.num, text: n.text.slice(0, 80) }))),
    };
    const old = r.state || null, sentMap = { ...(r.sent || {}) };
    const msgs: string[] = [];
    const vfr = (r.rules || "VFR") !== "IFR";
    if (old) {
      for (const [k, id, when, word] of [["dep", d, dep, "departure"], ["arr", a, arr, "arrival"], ["alt", alt, arr, "alternate"]] as const) {
        const o = old[k], n = st[k];
        if (o && n && RANK[n.cat] > RANK[o.cat] && (vfr || RANK[n.cat] >= 2)) msgs.push(`${id} now ${n.cat} for your ${z(when)} ${word} (was ${o.cat})`);
        if (o && n && n.gust >= 20 && n.gust - (o.gust || 0) >= 8) msgs.push(`${id} gusts to ${n.gust} kt`);
      }
      const oldT = new Set((old.tfr || []).map((t: any) => t.id));
      for (const t of st.tfr) if (!oldT.has(t.id)) msgs.push(`New TFR near your route: ${t.title}`);
      const oldC = new Set((old.cls || []).map((c: any) => c.num));
      for (const c of st.cls) if (!oldC.has(c.num)) msgs.push(`${c.ap} NOTAM: ${c.text}`);
    }
    let status = 0;
    const url = `/#/alert/${encodeURIComponent(r.flight_id)}`;
    const toGo = dep - Date.now();
    if (!sentMap.t2h && toGo <= 130 * 6e4 && toGo > -15 * 6e4) {
      const w = [st.dep && d ? `${d} ${st.dep.cat}` : "", st.arr && a ? `${a} ${st.arr.cat} at arrival` : ""].filter(Boolean).join(", ");
      const extra = [st.tfr.length ? `${st.tfr.length} TFR${st.tfr.length === 1 ? "" : "s"} near the route` : "no TFRs near the route", st.cls.length ? `${st.cls.length} closure NOTAM${st.cls.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(", ");
      status = await safeSend(r.sub, { title: `${r.route} departs in about 2 hours`, body: `${w ? w + ". " : ""}${extra[0].toUpperCase() + extra.slice(1)}. Tap to recheck the brief.`, url, tag: `as-${r.flight_id}` }, v, SUBJECT, 7200);
      sentMap.t2h = Date.now(); sent++;
    } else if (msgs.length && (!sentMap.chg || Date.now() - sentMap.chg > 30 * 6e4)) {
      status = await safeSend(r.sub, { title: `Brief changed: ${r.route}`, body: msgs.slice(0, 3).join(". ") + ". Tap to recheck the brief.", url, tag: `as-${r.flight_id}` }, v, SUBJECT, 3600);
      sentMap.chg = Date.now(); sent++;
    }
    if (status === 404 || status === 410) { await sql`delete from public.flight_alerts where id = ${r.id}`; gone++; continue; }
    await sql`update public.flight_alerts set state = ${sql.json(st)}, sent = ${sql.json(sentMap)}, checked_at = now() where id = ${r.id}`;
  }
  return { rows: rows.length, sent, gone, metars: Object.values(wx).filter((w) => w.metar).length, tafs: Object.values(wx).filter((w) => w.taf).length };
}

async function userOf(req: Request) {
  const tok = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!tok) return null;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, { headers: { Authorization: `Bearer ${tok}`, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  try {
    if (req.method === "GET" && u.searchParams.get("pub")) return json({ pub: (await vapid()).pub });
    if (req.method === "POST" && u.searchParams.get("test")) {
      const user = await userOf(req);
      if (!user) return json({ error: "Sign in to send a test alert" }, 401);
      const b = await req.json().catch(() => ({}));
      if (!b.sub || !b.sub.endpoint || !b.sub.keys) return json({ error: "No subscription" }, 400);
      const s = await send(b.sub, { title: "AeroSignal alerts are on", body: "You will get a check about 2 hours before each departure, and an alert if the weather, TFRs or closures change.", url: "/#/plan", tag: "as-test" }, await vapid(), SUBJECT, 600);
      return json({ status: s });
    }
    if (req.method === "POST") {
      const key = req.headers.get("x-cron-key") || "";
      const want = await secret("alerts_cron_key");
      if (!want || key !== want) return json({ error: "forbidden" }, 403);
      return json(await runCheck());
    }
    return json({ error: "not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
