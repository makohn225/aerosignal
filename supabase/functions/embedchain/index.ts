import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Runs the ingest embedding backfill in small steps until nothing is left, re-invoking itself after each step.
// Needs the same x-ingest-token as ingest (ingest checks it and answers 403 otherwise).
//   POST { shard: 0, shards: 3, batch: 5, left: 400 }
Deno.serve(async (req) => {
  const tok = req.headers.get("x-ingest-token") ?? "";
  const body = await req.json().catch(() => ({}));
  const base = Deno.env.get("SUPABASE_URL") + "/functions/v1/";
  const H = { "Content-Type": "application/json", "x-ingest-token": tok };
  const r = await fetch(base + "ingest", { method: "POST", headers: H, body: JSON.stringify({ mode: "backfill", batch: body.batch || 5, shard: body.shard || 0, shards: body.shards || 1 }) });
  if (r.status === 403) return new Response("forbidden", { status: 403 });
  const j: any = await r.json().catch(() => ({ status: r.status }));
  const left = (Number(body.left) || 400) - 1;
  const more = (j.embedded > 0 || !("embedded" in j)) && left > 0;
  if (more) {
    // @ts-ignore EdgeRuntime is provided by the Supabase runtime
    EdgeRuntime.waitUntil(new Promise((res) => setTimeout(res, 300)).then(() => fetch(base + "embedchain", { method: "POST", headers: H, body: JSON.stringify({ ...body, left }) })));
  }
  return Response.json({ step: j, left, more });
});
