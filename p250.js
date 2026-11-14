"use strict";
/* p250: share identical data requests (November 11, 2026). A page such as the brief is built from many sections,
   and several of them ask the server the same question within a few seconds (the brief asked for NOTAMs three
   times and for accident matches, airport reports, airport details and procedures twice each). Each repeat cost a
   round trip and held up the section waiting on it. Now an identical read request made again within 45 seconds
   gets the first answer, whether that answer has arrived yet or not. This also lets a section start its request
   early (p183, p192 and p195 now do, as soon as the brief opens) and have the answer waiting when it paints.
   Only read requests on a fixed list are shared: the lookup functions and data functions named below and FAA
   map queries. Anything that writes (feedback, sync, sign in, uploads) always goes to the server, a failed
   answer is never kept, and each caller gets its own copy of the answer. */
(function () {
  if (!window.fetch || !window.Response) return;
  /* How long an answer is reused (November 14). Reference data that changes rarely (accident matches, airport and
     runway details, procedures, FAA map layers) is kept 30 minutes in memory, so moving between Plan, Maps and the
     brief does not fetch it again. Weather, NOTAMs, TFRs and delays are kept 2 minutes, and airport reports, which
     pilots post, 45 seconds. */
  const TTL = 45000, MAX = 250;
  const LONG = /\/rpc\/(brief_matches|brief_matches_v2|theme_stats|theme_stats_v2|accidents_near_route_v2|airport_detail|faa_airport|faa_airports_box|accidents_near_route|sdr_summary|resolve_points|mtr_by_ident)\b|\/functions\/v1\/(rwyends|divert|cifp|nearfix)\b|arcgis\.com/i;
  const LIVE = /\/functions\/v1\/(wx|winds|tfr|notams|wxhaz|nasstatus)\b/;
  const ttlOf = (k) => (LONG.test(k) ? 30 * 60000 : LIVE.test(k) ? 2 * 60000 : TTL);
  const RPC = /\/rest\/v1\/rpc\/(brief_matches|brief_matches_v2|theme_stats|theme_stats_v2|accidents_near_route_v2|airport_reports|recent_airport_reports|airport_detail|faa_airport|faa_airports_box|accidents_near_route|sdr_summary|resolve_points|mtr_by_ident)$/;
  const FN = /\/functions\/v1\/(wx|winds|tfr|notams|wxhaz|rwyends|divert|cifp|nasstatus|nearfix)(\?|$)/;
  const ARC = /^https:\/\/services\d*\.arcgis\.com\/.*\/query\?|^https:\/\/[a-z0-9.]*arcgis\.com\/.*FeatureServer\/\d+\/query\?/i;
  const store = new Map();
  const of = window.fetch;
  function keyOf(input, init) {
    if (typeof input !== "string") return null;              // Request objects: leave alone
    const m = String((init && init.method) || "GET").toUpperCase();
    if (m === "POST") { if (!RPC.test(input.split("?")[0]) || typeof init.body !== "string") return null; return `P ${input} ${init.body}`; }
    if (m === "GET") return FN.test(input) || ARC.test(input) ? `G ${input}` : null;
    return null;
  }
  const copy = (e) => new Response(e.buf.slice(0), { status: e.status, statusText: e.statusText, headers: e.headers });
  window.fetch = function (input, init) {
    let k = null; try { k = keyOf(input, init); } catch (e) { k = null; }
    if (!k) return of.apply(this, arguments);
    const now = Date.now();
    let ent = store.get(k);
    if (ent && now - ent.at > ttlOf(k)) { store.delete(k); ent = null; }
    if (!ent) {
      const i2 = Object.assign({}, init); delete i2.signal;   // one caller giving up must not cancel it for the others
      ent = { at: now, p: null };
      ent.p = of.call(this, input, i2).then(async (r) => {
        if (!r.ok) { store.delete(k); return { raw: r }; }
        const buf = await r.arrayBuffer();
        return { buf, status: r.status, statusText: r.statusText, headers: [["content-type", r.headers.get("content-type") || "application/json"]] };
      }, (err) => { store.delete(k); throw err; });
      store.set(k, ent);
      if (store.size > MAX) { const first = store.keys().next().value; store.delete(first); }
    }
    const out = ent.p.then((e) => (e.raw ? (e.raw.bodyUsed ? of.call(window, input, init) : e.raw.clone()) : copy(e)));
    const sig = init && init.signal;
    if (!sig) return out;
    return new Promise((res, rej) => {
      const ab = () => rej(new DOMException("Aborted", "AbortError"));
      if (sig.aborted) return ab();
      sig.addEventListener("abort", ab, { once: true });
      out.then(res, rej);
    });
  };
  // Named AeroReadCache (it was AeroShare, which clashed with p91's share link helper; renamed November 14)
  window.AeroReadCache = { clear: () => store.clear(), size: () => store.size, ttl: ttlOf };
})();
