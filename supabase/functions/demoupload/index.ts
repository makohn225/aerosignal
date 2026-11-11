import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// demoupload: stores a demo video in the public storage bucket "demo" so it has a link that can be shared.
// POST the file as the body with ?name=<file name>. Same x-ingest-token auth as the ingest functions.
Deno.serve(async (req: Request) => {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: okTok } = await sb.rpc("check_ingest_token", { t: req.headers.get("x-ingest-token") ?? "" });
    if (!okTok) return json({ error: "unauthorized" }, 401);
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    const name = (new URL(req.url).searchParams.get("name") || "").replace(/[^A-Za-z0-9._-]/g, "");
    if (!/\.(mp4|jpg|png)$/.test(name)) return json({ error: "name must end in .mp4, .jpg or .png" }, 400);
    const type = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".jpg") ? "image/jpeg" : "image/png";
    const { data: buckets } = await sb.storage.listBuckets();
    if (!(buckets || []).some((b) => b.name === "demo")) {
      const { error: be } = await sb.storage.createBucket("demo", { public: true, fileSizeLimit: "50MB" });
      if (be) return json({ error: "bucket: " + be.message }, 500);
    }
    const body = new Uint8Array(await req.arrayBuffer());
    const { error } = await sb.storage.from("demo").upload(name, body, { contentType: type, upsert: true, cacheControl: "300" });
    if (error) return json({ error: error.message }, 500);
    const { data } = sb.storage.from("demo").getPublicUrl(name);
    return json({ ok: true, bytes: body.length, url: data.publicUrl });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
