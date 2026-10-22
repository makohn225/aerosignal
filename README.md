# AeroSignal

Preflight mishap intelligence for civil and military pilots. Live at https://aerosignal-app.vercel.app

## Layout

- `index.html` lists every app module in load order (`p1.js` through `p81.js`, no `p61`).
  New features go in a new `pNN.js` module rather than edits to older files.
- `*.css` stylesheets, `icons/`, `manifest.webmanifest`, `sw.js` (offline shell).
- `milmishaps.js` public military mishap narratives (public reporting only, never privileged
  safety investigation findings). The build also writes it as `milmishaps.json` for the AI connector.
- `build.mjs` runs on Vercel at every deploy: bundles the scripts and stylesheets in `index.html`
  order into one hashed `app.<hash>.js` and `app.<hash>.css`, writes the site to `dist/`.
- `supabase/functions/<name>/index.ts` Supabase Edge Functions (read only relays and lookups).
  Functions that read the database include their own copy of `db.ts` (pooled connection).
  `mcp` is the AeroSignal AI connector, a public data Model Context Protocol server.

## Build locally

```
npm install
node build.mjs
cd dist && python3 -m http.server 8794
```

## Deploy

Production deploys automatically from the main branch of this repository through Vercel (project `aerosignal-app`). Every push to main publishes the site.
Edge functions deploy to Supabase project `jcvrcckeprmpcruhxafm`.

## Rules that never change

- No CUI or classified information enters the system. Disclaimers stay bold and red.
- Military narratives come from public sources only. Aircraft limits come only from public,
  unclassified sources.
- Database schema changes and changes to the agreement, terms, privacy or About text need the
  owner's approval.

## Recent modules (October 2026)

- p78 flight track debrief, p79 turbulence and icing, p80 low level route card, p81 AI connector panel
- p82 Vercel Web Analytics and privacy wording (approved), p83 runway winds and density altitude
- p84 diversion airports (edge function `divert`), p85 advisory map layer plus tour and tutorial lines
- p86 takeoff and landing distance check (pilot entered POH figures), p87 display themes (`AeroTheme`)
- p88 brief Essentials view (`S.briefAll`), p89 logbook finder with single entry edit and print
- p90 top of climb and descent, best altitude for wind, glide reach map layer (`S.vnav`)
- p91 share a flight by link (`#/share/<data>`), p92 airspace along the route (FAA ADDS Class and SUA)
- p93 aircraft inspection due dates (`S.profiles[tail].mx`), p94 add a tracked flight to the logbook
- p95 checklists page (`#/checklists`, `S.checklists`), p96 stronger Glass cockpit theme
- Declutter: p97 tutorial button and welcome bar retire, p98 short brief chip bar, p99 top 3 lessons,
  p100 Flights folds procedure panels, p101 bottom line problems first, p102 shorter Logbook,
  p103 More page groups, p104 role based tabs (`S.role`: civil hides Missions)
- p105 brief sections open folded with a one line summary; bottom line ranked items capped at 3
- p106 accident lessons as one line titles that open on tap; currency box folds when the bottom line lists it
- p0 (loads first) faster settling: debounces shortened after the first bottom line card, one redraw at startup
- p107 GO, CAUTION or NO GO verdict with reasons at the top of the bottom line card
- p108 Flights and Safety tabs folded into Plan (Your flights list) and Maps (Safety search button)
- p109 Read and brief: plan text to brief in one step
- p110 automatic offline save for flights departing within 12 hours (S.offAuto, S.offAutoDone)
- p111 checklists in account sync (on; privacy wording approved October 21, 2026)
- p113 privacy page sync paragraph adds checklists (approved October 21, 2026)
- p114 animated tutorial: scene animation per step, chapter cards, gliding spotlight, finish card
- p115 Today card on the Plan page: next flight, countdown, last verdict, recheck prompt
- p116 "Did you fly it?" one tap logbook entry from the plan (or track)
- p117 Fly again, Add to calendar (.ics), import .fpl or .gpx flight plans
- p118 civil kneeboard card #/card with runways, frequencies (freq function, OurAirports), weather, CRAFT pad
- p119 passenger briefing (SAFETY) dialog and card section
- p120 brief remembers its verdict (f.vd) and shows what changed since the last check
- p121 flight alerts: web push (sw.js push handlers), rows in public.flight_alerts (RLS, own rows), alertcheck function run every 15 min by pg_cron job flight-alerts; VAPID keys and cron key in Vault
- p122 privacy page paragraph for flight alerts (approved October 22, 2026), Last updated October 22, 2026
- p123 easier map: Satellite base layer, two finger hold to measure, Tools menu (measure distance, measure landing zone, edit route, plates, glide, my location), folded filters and patterns
- p124 magnetic variation from IGRF 14 on the device (AeroMag): measure tools show °M, kneeboard variation fills in, civil card lists variation
- p112 tutorial scene for the verdict and recorded narration for the newer tutorial lines

Brief panel order (each module places itself next to one neighbor; never position against a
neighbor another module already uses): bbody, dbPanel, wtgPanel, trkPanel, rwPanel, dvPanel, pfPanel,
llPanel, lcPanel, wbPanel, goPanel, pkPanel, tfrPanel, ntPanel, advPanel, asPanel, pmPanel, waPanel, mnPanel.
