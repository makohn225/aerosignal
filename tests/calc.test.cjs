/* AeroSignal calculation tests (November 2, 2026).
   Checks the safety relevant math against answers worked out independently of the app:
   great circle distance and course (Ed Williams' Aviation Formulary worked example), the wind
   triangle (solved by brute force vector addition, not the app's formula), magnetic variation
   (ppigrf, an independent implementation of IGRF 14), weight and balance and fuel (hand computed
   from the Cessna 172S example numbers), and the VFR nav log built from them.

   Run from the repository root:   node tests/calc.test.cjs
   Needs Playwright with Chromium (preinstalled in the Claude workspace). It serves the repository
   itself, loads the app's own modules unbundled with every outside request blocked, and calls the
   same functions the app uses. Exit code 0 means every case passed.
   Not deployed: tests/ is listed in .vercelignore. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/json" };

// [name, expression evaluated in the page, expected, tolerance]
const CASES = [
  // Distance and course: LAX (33°57'N 118°24'W) to JFK (40°38'N 73°47'W) is 2144 nm on an initial
  // true course of 066 (Aviation Formulary, which uses 1 minute = 1 nm; the app's earth radius gives
  // about 1 nm more).
  ["LAX to JFK distance (nm)", `AeroWinds.legs({points:[{lat:33.95,lon:-118.4},{lat:40.6333,lon:-73.7833}]})[0].nm`, 2144, 3],
  ["LAX to JFK initial true course", `AeroWinds.legs({points:[{lat:33.95,lon:-118.4},{lat:40.6333,lon:-73.7833}]})[0].crs`, 66, 1],
  // Wind triangle (independent vector solution)
  ["TC 090, TAS 100, wind 360/20: true heading", `T.solve(90,100,360,20).hdg`, 78.46, 0.1],
  ["TC 090, TAS 100, wind 360/20: groundspeed", `T.solve(90,100,360,20).gs`, 97.98, 0.1],
  ["TC 360, TAS 120, wind 360/30: true heading", `T.solve(360,120,360,30).hdg % 360`, 0, 0.1],
  ["TC 360, TAS 120, wind 360/30: groundspeed", `T.solve(360,120,360,30).gs`, 90, 0.1],
  ["TC 135, TAS 120, wind 180/25: true heading", `T.solve(135,120,180,25).hdg`, 143.47, 0.1],
  ["TC 135, TAS 120, wind 180/25: groundspeed", `T.solve(135,120,180,25).gs`, 101.01, 0.1],
  ["TC 270, TAS 100, wind 090/20: groundspeed", `T.solve(270,100,90,20).gs`, 120, 0.1],
  ["No wind: groundspeed equals TAS", `T.solve(45,110,null,0).gs`, 110, 0.01],
  // Magnetic variation, east positive (ppigrf, IGRF 14, July 1 2026)
  ["Variation at KPNS", `AeroMag.decl(30.4734,-87.1866,0,new Date("2026-07-01T00:00:00Z"))`, -3.46, 0.3],
  ["Variation at KSEA", `AeroMag.decl(47.449,-122.309,0,new Date("2026-07-01T00:00:00Z"))`, 14.87, 0.3],
  ["Variation at KBOS", `AeroMag.decl(42.3656,-71.0096,0,new Date("2026-07-01T00:00:00Z"))`, -13.96, 0.3],
  ["Variation at PANC", `AeroMag.decl(61.1744,-149.996,0,new Date("2026-07-01T00:00:00Z"))`, 14.02, 0.3],
  // Weight and balance, Cessna 172S example numbers. By hand: empty 1680 at 40.6 = 68,208;
  // front 340 at 37 = 12,580; baggage 20 at 95 = 1,900; fuel 40 gal less 1 gal taxi = 39 gal x 6 =
  // 234 lb at 48 = 11,232. Takeoff 2,274 lb, moment 93,920, CG 41.30 in.
  ["Takeoff weight (lb)", `T.wb({front:340,bag1:20,fuel:40}).to.w`, 2274, 0.01],
  ["Takeoff CG (in)", `T.wb({front:340,bag1:20,fuel:40}).to.cg`, 41.30, 0.01],
  // Forward limit slopes from 35.0 at 1,950 lb to 41.0 at 2,550 lb: at 2,274 lb, 35 + 6 x 324/600 = 38.24
  ["Forward CG limit at 2,274 lb", `T.wb({front:340,bag1:20,fuel:40}).to.fwd`, 38.24, 0.01],
  // Landing: trip fuel (time en route x 9 gal per hr) burns off at the fuel arm of 48 in, so the
  // landing weight is 2,274 less trip x 6 lb and the landing moment is 93,920 less trip x 6 x 48
  ["Trip fuel is time en route x burn", `(r => r.trip - r.ete * 9)(T.wb({front:340,bag1:20,fuel:40}))`, 0, 0.001],
  ["Landing weight is takeoff weight less trip fuel", `(r => r.ld.w - (2274 - r.trip * 6))(T.wb({front:340,bag1:20,fuel:40}))`, 0, 0.01],
  ["Landing CG from the remaining moment", `(r => r.ld.cg - (93920 - r.trip * 6 * 48) / (2274 - r.trip * 6))(T.wb({front:340,bag1:20,fuel:40}))`, 0, 0.01],
  ["Day VFR reserve is 30 minutes (91.151)", `T.wb({front:340,bag1:20,fuel:40}).resMin`, 30, 0],
  ["Day VFR reserve fuel at 9 gal per hr", `T.wb({front:340,bag1:20,fuel:40}).reserve`, 4.5, 0.001],
  ["Overweight loading is flagged", `T.wb({front:400,rear:340,bag1:120,fuel:53}).probs.some(p=>/over max takeoff/.test(p[1]))?1:0`, 1, 0],
  ["Normal loading has no problems", `T.wb({front:340,bag1:20,fuel:40}).probs.length`, 0, 0],
  // Nav log: along the equator from 0°E to 1°E (true course 090, 60.04 nm), TAS 100, wind 360/20 at
  // every level, 10 gal per hr, 40 gal at start, 1 gal taxi. GS 97.98, so 36.77 min, rounded up to
  // 37 min; fuel 37/60 x 10 = 6.17, rounded up to 6.2 gal; 32.8 gal left. Variation at 0°N 0.5°E is
  // 3.68°W (ppigrf), so MH = 078.46 + 3.68 = 082.1.
  ["Nav log distance (nm)", `T.nl().rows[0].nm`, 60.04, 0.05],
  ["Nav log true course", `T.nl().rows[0].tc`, 90, 0.01],
  ["Nav log wind correction angle (negative is left)", `T.nl().rows[0].wca`, -11.54, 0.1],
  ["Nav log groundspeed", `T.nl().rows[0].gs`, 97.98, 0.1],
  ["Nav log ETE (min, before rounding)", `T.nl().rows[0].min`, 36.77, 0.05],
  ["Nav log leg fuel (gal, rounded up)", `T.nl().rows[0].fuel`, 6.2, 0.001],
  ["Nav log fuel left (gal)", `T.nl().landFuel`, 32.8, 0.001],
  ["Nav log magnetic heading", `T.nl().rows[0].mh`, 82.14, 0.35],
];

const HELPERS = `window.T = {
  windsAll(dir, spd, lat, lon) { const w = {}; for (const l of [3000, 6000, 9000, 12000]) w[l] = dir == null ? null : { dir, spd, temp: 10 }; return { levels: [3000, 6000, 9000, 12000], stations: [{ id: "X", lat, lon, w }] }; },
  solve(tc, tas, dir, spd) {
    // A leg flown exactly on the requested true course: due north, east, south or west from a point,
    // or along a meridian otherwise is not exact, so use a short leg and pin its course
    const leg = { from: { ident: "A", lat: 10, lon: 10 }, to: { ident: "B", lat: 10, lon: 10 }, nm: 50, crs: tc, mid: { lat: 10, lon: 10 } };
    return AeroWinds.solve(this.windsAll(dir, spd, 10, 10), [leg], tas, 5500).rows[0];
  },
  wb(load) { return AeroWB.calc({ id: "t", wb: load, rules: "VFR", points: [] }, { ...AeroWB.C172S }); },
  nl() {
    const f = { id: "t", date: "2026-07-01", time: "12:00", rules: "VFR", points: [{ ident: "A", lat: 0, lon: 0 }, { ident: "B", lat: 0, lon: 1 }], nl: { tas: 100, gph: 10, fuel: 40, taxi: 1, alt: 5500 } };
    return AeroNavLog.compute(f, this.windsAll(360, 20, 0, 0.5));
  },
};`;

(async () => {
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    const p = path.join(ROOT, u === "/" ? "index.html" : u);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).pipe(res);
  }).listen(0);
  const port = server.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: "block" });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.fulfill({ status: 503, body: "" }));
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.AeroWinds && window.AeroWB && window.AeroMag && window.AeroNavLog, null, { timeout: 30000 });
  await page.evaluate(HELPERS);
  let fail = 0;
  for (const [name, expr, want, tol] of CASES) {
    let got;
    try { got = await page.evaluate(expr); } catch (e) { got = `error: ${String(e.message || e).split("\n")[0]}`; }
    const ok = typeof got === "number" && Math.abs(got - want) <= tol + 1e-9;
    if (!ok) fail++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${typeof got === "number" ? +got.toFixed(4) : got}, expected ${want}${tol ? ` within ${tol}` : ""}`);
  }
  console.log(`\n${CASES.length - fail} of ${CASES.length} passed`);
  await browser.close(); server.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
