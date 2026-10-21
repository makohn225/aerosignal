import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db, dbMode } from "./db.ts";

// Plan helper AI assist. The app's built in rules handle the request first; only the parts they
// could not read come here. A Groq hosted model rewrites them into the plain commands the rules
// already understand, and the app applies those commands itself. The model never edits anything.
//   GET  planai            -> { enabled }
//   POST planai { text, kind, route, today }  -> { commands: [], reply }
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const KEY = () => Deno.env.get("GROQ_API_KEY") || "";
// Groq retires models over time, so the list is read from Groq and the best available one is used.
const PREFER = [/gpt-oss-120b/, /llama-3\.3-70b/, /qwen3?[.-]?\d*.*(32|27)b/i, /llama-4-maverick/, /llama-4-scout/, /gpt-oss-20b/, /llama-3\.1-8b/];
let models: string[] = [], modelsAt = 0;
async function pickModels(): Promise<string[]> {
  if (models.length && Date.now() - modelsAt < 6 * 3600e3) return models;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${KEY()}` } });
    const j = await r.json();
    const ids: string[] = (j.data || []).filter((m: any) => m.active !== false).map((m: any) => String(m.id))
      .filter((id: string) => !/whisper|tts|guard|playai|orpheus|prompt-guard|safeguard|compound|allam/i.test(id));
    const ranked: string[] = [];
    for (const re of PREFER) for (const id of ids) if (re.test(id) && !ranked.includes(id)) ranked.push(id);
    models = (ranked.length ? ranked : ids).slice(0, 3); modelsAt = Date.now();
  } catch { /* keep the last list */ }
  return models.length ? models : ["llama-3.1-8b-instant"];
}


// The model is never trusted to know airport codes: every place it names is checked against the
// airport database (OurAirports) and corrected to the airport whose town or name matches what the pilot said.
type Apt = { ident: string; name: string; municipality: string; type: string; lat: number; lon: number };
const nm = (a: Apt, b: Apt) => {
  const r = Math.PI / 180, x = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 3440 * Math.asin(Math.sqrt(x));
};
async function checkPlaces(places: { said: string; ident: string }[]) {
  const sq = await db();
  const out: { said: string; ident: string; apt?: Apt; cands: Apt[] }[] = [];
  for (const p of places.slice(0, 6)) {
    const said = String(p.said || "").replace(/\b(mcas|nas|afb|aaf|airport|airfield|field|municipal|regional|international|intl|executive|county)\b/gi, " ").replace(/[^A-Za-z .']/g, " ").replace(/\s+/g, " ").trim();
    const ident = String(p.ident || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
    let cands: Apt[] = [];
    if (said.length >= 3) {
      try {
        cands = await sq`select ident, name, municipality, type, lat, lon from public.airports
          where iso_country = 'US' and type in ('large_airport','medium_airport','small_airport')
            and (municipality ilike ${said} or name ilike ${"%" + said + "%"})
          order by (type = 'large_airport') desc, (type = 'medium_airport') desc, (ident ~ '^K[A-Z0-9]{3}$') desc
          limit 40`;
      } catch { cands = []; }
    }
    let apt: Apt | undefined;
    if (ident) { try { [apt] = await sq`select ident, name, municipality, type, lat, lon from public.airports where ident = ${ident} limit 1`; } catch {} }
    out.push({ said: String(p.said || ""), ident, apt, cands });
  }
  const TYPE: Record<string, number> = { large_airport: 3, medium_airport: 2, small_airport: 0 };
  const score = (c: Apt, said: string, ai: string) => {
    const w = said.toLowerCase();
    return (c.municipality && c.municipality.toLowerCase() === w ? 3 : 0) + (c.name.toLowerCase().includes(w) ? 2 : 0) +
      (TYPE[c.type] || 0) + (/^K[A-Z0-9]{3}$/.test(c.ident) ? 5 : 0) + (c.ident === ai ? 4 : 0);
  };
  // first pass: places whose model choice matches the database, or that have a single clear candidate
  const fixed: Apt[] = [];
  for (const o of out) {
    if (o.apt && o.cands.some((c) => c.ident === o.apt!.ident)) { fixed.push(o.apt); (o as any).final = o.apt; }
  }
  for (const o of out) {
    if ((o as any).final) continue;
    if (!o.cands.length) { (o as any).final = o.apt || null; if (o.apt) fixed.push(o.apt); continue; }
    const s = o.said.replace(/\b(mcas|nas|afb|aaf|airport|airfield|field)\b/gi, " ").trim();
    let best = o.cands[0], bs = -1e9;
    for (const c of o.cands) {
      let sc = score(c, s, o.ident);
      if (fixed.length) sc -= Math.min(...fixed.map((f) => nm(f, c))) / 150;
      if (sc > bs) { bs = sc; best = c; }
    }
    (o as any).final = best; fixed.push(best);
  }
  // second pass: settle near ties (two towns with the same name) by distance to the other places
  for (const o of out) {
    if (!o.cands.length || (o.apt && o.cands.some((c) => c.ident === o.apt!.ident))) continue;
    const others = out.filter((x) => x !== o && (x as any).final).map((x) => (x as any).final as Apt);
    if (!others.length) continue;
    const s = o.said.replace(/\b(mcas|nas|afb|aaf|airport|airfield|field)\b/gi, " ").trim();
    let best = (o as any).final as Apt, bs = -1e9;
    for (const c of o.cands) { const sc = score(c, s, o.ident) - Math.min(...others.map((f) => nm(f, c))) / 150; if (sc > bs) { bs = sc; best = c; } }
    (o as any).final = best;
  }
  return out.map((o) => ({ said: o.said, ident: o.ident, final: (o as any).final as Apt | null }));
}

// Rough per address limit so one visitor cannot use up the free daily quota
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), win = hits.get(ip)?.filter((t) => now - t < 60_000) || [];
  win.push(now); hits.set(ip, win);
  if (hits.size > 5000) hits.clear();
  return win.length > 12;
}

const SYSTEM = `You translate a pilot's plain language request into short commands for a flight planning app.
Return JSON only: {"commands": ["..."], "reply": "..."}.
"commands" is a list of commands written exactly in the forms below. "reply" is one short plain sentence for the pilot.
If the request cannot be expressed with these commands, return {"commands": [], "reply": "<briefly say what you can do instead>"}.
Never invent airports, fixes or points the pilot did not name or that are not in the current route. Use ICAO airport identifiers (four letters, like KDCA) when the pilot names a US airport by its three letter code or by a well known name you are sure of; otherwise keep the name exactly as given.
Never write hyphens or dashes in the reply.

Commands for a FLIGHT:
  from KJYO to KOKV            (new route from departure to destination; may add "tomorrow at 0930", "IFR", "at 6000 ft")
  route KJYO BRV KOKV          (replace the whole route)
  add BRV after KDCA           (also "before")
  add BRV between KDCA and KRIC
  remove BRV
  replace BRV with GVE
  change the destination to KRIC
  change the departure to KHEF
  direct to KLYH
  KDCA direct KRIC
  use V16 from GVE to KRIC     (airways start with V, J, T or Q)
  reverse the route
  depart at 1400               (24 hour time; add "tomorrow", a weekday, or a date when given)
  IFR   /   VFR
  altitude 6500   /   altitude FL210
  speed 120 knots
  night   /   day
Commands for a MISSION (military leg plan):
  add BZA after KNYL   /   remove GBN   /   change the destination to LZ SPARROW
  add a leg from LZ SPARROW to KNYL
  launch at 1930
  TOT 2015 at LZ SPARROW
  NVG on every leg   /   remove TERF   /   NVG on the leg to LZ SPARROW
  (mission types: NVG, TERF, AERIAL REFUEL, FORMATION, DVE, EXTERNAL LIFT, CAL, FARP, DECK LANDING)
  speed 140 knots
Examples:
  "swing by Brooke on the way" with route KDCA KRIC -> {"commands":["add BRV between KDCA and KRIC"],"reply":"Adding Brooke (BRV) between KDCA and KRIC."}
  "actually lets leave an hour later" when departure is 1300 -> {"commands":["depart at 1400"],"reply":"Moving departure to 1400."}
  "take out the second fix" with route KHEF GVE BRV KRIC -> {"commands":["remove BRV"],"reply":"Removing BRV."}
  "skip the stop and go straight there" with route KHEF GVE KRIC -> {"commands":["KHEF direct KRIC"],"reply":"Going direct from KHEF to KRIC."}`;

const PLAN = `You rewrite a pilot's plain language flight description into one short plan sentence that a flight planning app's simple reader understands.
Return JSON only: {"plan": "...", "places": [{"said": "...", "ident": "..."}], "reply": "..."}.
"places" lists every place name you turned into an identifier: "said" is the place exactly as the pilot wrote it, "ident" is the identifier you used in the plan.
The reader understands: a day word (today, tomorrow, a weekday, or a date), a four digit 24 hour time, VFR or IFR, "from <ID> to <ID>", "via <ID> <airway>", "and back", "night", an aircraft, "about <N> knots", "at <N> ft", and for military missions "launch <time> from <ID>, route <points> to <point>, TOT <time> at <point>, NVG".
Rules:
  Copy over ONLY what the pilot said. Never add VFR, IFR, an aircraft, a speed, an altitude, night or stops that the pilot did not say.
  Turn each place name into its ICAO identifier when you know the airport (Leesburg = KJYO, Dulles = KIAD, Reagan National = KDCA, Richmond = KRIC, Charlotte = KCLT, Manassas = KHEF, Ocean City MD = KOXB, New River or MCAS New River = KNCA, Cherry Point or MCAS Cherry Point = KNKT, Quantico = KNYG, Norfolk = KORF). Only when a name could mean several airports and you cannot tell which, keep the pilot's words for it.
  Keep identifiers, airways, coordinates, MGRS grids and named points (LZ, HLZ, OBJ, IP, CP, BP, FARP and similar) exactly as written.
  Loose times become: early morning 0700, morning 0900, late morning 1100, noon or lunch 1200, after lunch 1300, afternoon 1400, late afternoon 1600, evening 1800, night 2000. "2 pm" becomes 1400. Use "today" or "tomorrow" when the day is today or tomorrow.
  A round trip gets "and back". The app keeps one departure time, so mention any return time only in the reply.
  If there is a departure or a destination at all, always return a plan, even if something is missing; the app asks the pilot for anything missing.
"reply" is one short plain sentence that states any time or day assumption you made (what time a loose time became, a return time that is not stored). Do not mention airports in the reply; the app names them. Leave reply empty if you assumed nothing. Never write hyphens or dashes in the reply.
Only if the text has no departure and no destination at all, return {"plan": "", "reply": "<say briefly that you could not find a flight in it>"}.
Examples (today is Thursday):
  "Leesburg to Richmond tomorrow morning, back after lunch" -> {"plan":"Tomorrow at 0900 from KJYO to KRIC and back","places":[{"said":"Leesburg","ident":"KJYO"},{"said":"Richmond","ident":"KRIC"}],"reply":"Morning set to 0900; the return after lunch (about 1300) is not stored."}
  "night flight from new river to cherry point" -> {"plan":"Night, from KNCA to KNKT","places":[{"said":"new river","ident":"KNCA"},{"said":"cherry point","ident":"KNKT"}],"reply":""}
  "KJYO to Ocean City" -> {"plan":"From KJYO to KOXB","places":[{"said":"Ocean City","ident":"KOXB"}],"reply":""}
  "IFR to Charlotte from Dulles at 2 pm in the Bonanza" -> {"plan":"Today 1400, IFR from KIAD to KCLT in my Bonanza","places":[{"said":"Dulles","ident":"KIAD"},{"said":"Charlotte","ident":"KCLT"}],"reply":"2 pm set to 1400 today."}
  "launch at 1930 out of New River with two Ospreys to LZ SPARROW, TOT 2015, goggles" -> {"plan":"Section of two MV-22s, launch 1930 from KNCA to LZ SPARROW, TOT 2015 at LZ SPARROW, NVG","places":[{"said":"New River","ident":"KNCA"}],"reply":"Two Ospreys read as a section of two MV-22s and goggles as NVG."}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method === "GET") {
    if (new URL(req.url).searchParams.has("models") && KEY()) return Response.json({ enabled: true, models: await pickModels() }, { headers: CORS });
    return Response.json({ enabled: !!KEY() }, { headers: CORS });
  }
  if (!KEY()) return Response.json({ enabled: false, commands: [], reply: "" }, { headers: CORS });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
  if (limited(ip)) return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: CORS });
  let body: any = {};
  try { body = await req.json(); } catch {}
  const text = String(body.text || "").slice(0, 400).trim();
  if (!text) return Response.json({ error: "text required" }, { status: 400, headers: CORS });
  const planMode = body.mode === "plan";
  const kind = body.kind === "mission" ? "MISSION" : "FLIGHT";
  const route = String(body.route || "").replace(/[^A-Za-z0-9 \-]/g, " ").slice(0, 300);
  const user = planMode ? `Today is ${String(body.weekday || "").slice(0, 10)} ${String(body.today || "").slice(0, 10)}.\nPilot description: ${text}` : `Context: editing a ${kind}. Current route: ${route || "none yet"}. ${body.time ? `Current departure or launch time: ${String(body.time).slice(0, 8)}. ` : ""}Today is ${String(body.today || "").slice(0, 10)}.\nPilot request: ${text}`;

  let last = "";
  for (const model of await pickModels()) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 900, ...(/gpt-oss/.test(model) ? { reasoning_effort: "low" } : {}), response_format: { type: "json_object" }, messages: [{ role: "system", content: planMode ? PLAN : SYSTEM }, { role: "user", content: user }] }),
      });
      if (r.status === 429 || r.status >= 500 || r.status === 404) { last = String(r.status); if (r.status === 404) modelsAt = 0; continue; }
      if (r.status === 400) { last = `400 ${(await r.text()).slice(0, 160)}`; continue; }
      if (!r.ok) return Response.json({ error: `AI service error ${r.status}` }, { status: 502, headers: CORS });
      const j = await r.json();
      let out: any = {};
      try { out = JSON.parse(j.choices?.[0]?.message?.content || "{}"); } catch {}
      if (planMode) {
        let plan = String(out.plan || "").replace(/[\u2010-\u2015]/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
        let reply = String(out.reply || "").replace(/[\u2010-\u2015]/g, ",").slice(0, 300);
        const said: string[] = [];
        // Places the model listed, plus any place names it left as words after from, to or via
        const places: { said: string; ident: string }[] = Array.isArray(out.places) ? out.places.slice(0, 6) : [];
        for (const m of plan.matchAll(/\b(?:from|to|via)\s+([A-Za-z][A-Za-z.' ]*?)(?=\s+(?:to|via|and back|in my|in the|at|about)\b|,|$)/gi)) {
          const w = m[1].trim();
          if (!w || /^[A-Z0-9]{3,5}$/.test(w) || /^(LZ|HLZ|OBJ|IP|CP|BP|FARP|RP|PZ|TGT)\b/i.test(w) || places.some((p) => String(p.said || "").toLowerCase() === w.toLowerCase())) continue;
          places.push({ said: w, ident: "" });
        }
        if (plan && places.length) {
          const checked = await checkPlaces(places);
          for (const c of checked) {
            if (!c.final) continue;
            const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const asWords = c.said && new RegExp(`\\b${esc(c.said)}\\b`, "i");
            if (asWords && asWords.test(plan) && !/^[A-Z0-9]{3,5}$/.test(c.said)) plan = plan.replace(asWords, c.final.ident);
            else if (c.ident && c.ident !== c.final.ident) plan = plan.replace(new RegExp(`\\b${c.ident}\\b`, "g"), c.final.ident);
            const nmTxt = c.final.name.replace(/\s*\/\s*$/, "").replace(/\s*\/\s*/g, ", ").replace(/[-\u2010-\u2015]/g, " ");
            said.push(`${c.said.replace(/\b\w/g, (m) => m.toUpperCase())} is ${c.final.ident}, ${nmTxt}${c.final.municipality && !c.final.name.includes(c.final.municipality) ? ` in ${c.final.municipality}` : ""}.`);
          }
        }
        reply = [said.join(" "), reply].filter(Boolean).join(" ").replace(/[\u2010-\u2015]/g, ",").trim();
        return Response.json({ enabled: true, plan, reply, model }, { headers: CORS });
      }
      const commands = (Array.isArray(out.commands) ? out.commands : []).map((c: unknown) => String(c).replace(/[\u2010-\u2015]/g, " ").slice(0, 160)).filter(Boolean).slice(0, 8);
      const reply = String(out.reply || "").replace(/[\u2010-\u2015]/g, ",").slice(0, 300);
      return Response.json({ enabled: true, commands, reply, model }, { headers: CORS });
    } catch (_) { /* try the next model */ }
  }
  console.log("planai: no model answered", last);
  return Response.json({ error: "The AI service is busy. Try again shortly.", detail: last.slice(0, 40) }, { status: 503, headers: CORS });
});
