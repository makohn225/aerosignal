import postgres from "npm:postgres@3.4.4";

// Shared database connection for the read only relay functions.
// Every function instance used to open its own direct Postgres connections, so a burst of
// lookups could use up all of the database's connection slots and later lookups failed.
// This connects through Supabase's transaction pooler (Supavisor), which shares a small set
// of real connections between every instance. If the pooler cannot be reached it falls back
// to one direct connection that closes itself a few seconds after it goes idle.
type Sql = ReturnType<typeof postgres>;
const REF = "jcvrcckeprmpcruhxafm";
const POOLERS = ["aws-0-us-east-1.pooler.supabase.com", "aws-1-us-east-1.pooler.supabase.com"];
let chosen: Sql | null = null;
let pending: Promise<Sql> | null = null;
export let dbMode = "none";

async function connect(): Promise<Sql> {
  const direct = Deno.env.get("SUPABASE_DB_URL")!;
  let pw = "";
  try { pw = new URL(direct).password; } catch { /* use direct */ }
  if (pw) {
    for (const host of POOLERS) {
      const s = postgres(`postgresql://postgres.${REF}:${pw}@${host}:6543/postgres`, { max: 2, prepare: false, idle_timeout: 20, connect_timeout: 3, ssl: "prefer" });
      try { await s`select 1`; dbMode = "pooler"; return s; } catch { try { await s.end({ timeout: 1 }); } catch { /* ignore */ } }
    }
  }
  dbMode = "direct";
  return postgres(direct, { max: 1, prepare: false, idle_timeout: 3, connect_timeout: 5 });
}

export async function db(): Promise<Sql> {
  if (chosen) return chosen;
  pending ??= connect().then((s) => (chosen = s)).finally(() => { pending = null; });
  return await pending;
}
