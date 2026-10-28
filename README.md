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

## Phone and tablet apps

`native/` holds the Capacitor 7 iOS and Android projects and the `aero-gdl90` UDP plugin. See
`native/README.md`. The website build ignores this folder (`.vercelignore`).

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
- p125 press and hold (or right click) on any map: position report from the nearest VOR and airport (nearfix only=report), range rings 5/10/25 nm, measure from here
- p126 Follow my aircraft (live GPS ownship, trail, GS/track/GPS altitude, recenter, wake lock) and tighter plate georeference (reference points moved onto the plan view from the FAA Lambert projection)
- p127 approach profile while following: 3 degree reference path to the nearest aligned runway (rwyends function, OurAirports), high or low and left or right readout
- p112 tutorial scene for the verdict and recorded narration for the newer tutorial lines
- p128 FAA Terminal Area Chart overlay (shown with the sectional, S.tacOff) and published glidepaths for the approach profile from the FAA CIFP (edge function `cifp`, cached on the device in S.cifp)
- p130 spoken callouts while following: traffic, TFR ahead, glidepath deviation (speechSynthesis, S.calloutsOff)
- p131 approach debrief: follow mode records the flight's track (track.rec); brief card compares the final approach with the published glidepath, stabilized gates at 1,000 and 500 ft
- p132 save charts for an area (Tools menu): separate never trimmed cache aerosignal-region-v1 served first by sw.js, S.chartAreas
- p133 privacy page sentences for the phone and tablet apps and for flight school sharing (approved October 22, 2026)
- p134 Pro plan switch (AeroPro reads entitlements, ENFORCE off so all features stay free) and flight school dashboard (schools, school_members, school_shares; Account panel, Share on the brief, #/school/<id>). School UI is live (SCHOOLS_LIVE); its privacy sentence is in p133. Pro sold in the iOS app must use Apple In-App Purchase.
- p135 launch polish from a new pilot audit: Read and brief opens the brief, aircraft type from the plan words, honest bottom line (loading or failed lines never all clear; NOTAM and hazard failures count as CAUTION), civil Plan page without military hints, phone header theme icon, wording fixes (dates, round trips, Account and Logbook intros)
- p136 Questions and answers page at #/faq with search; linked from More, the Plan welcome card and the public welcome page
- p137 launch polish round 2: empty flights removed when leaving Flights, aircraft list starts on Choose an aircraft so Add aircraft works for new pilots, currency reads Not current in this logbook, civil pilots skip Missions on the welcome card and Service and Callsign on sign up
- p138 (loaded before p54) launch polish round 3: narration audio waits until played (saves about 1.6 MB on every first visit), larger touch targets, Feedback button name, a persistent banner when browser storage is full, friendly date on the risk assessment
- p139 from pilot feedback: Airports page Charts and NOTAMs section (every FAA chart as a PDF link, Chart Supplement link for the current cycle, current NOTAMs), plate viewer stops scroll reaching the map and gains On map, show or hide the safe altitude corridor (Altitudes switch and Tools item, S.corrHide), logo always returns to the start of Plan
- p129 ADS-B In groundwork: GDL 90 decoder and encoder, traffic layer, Traffic simulator in the map Tools menu (AeroMapTools hook in p123); live feed only in the native app (`native/`, plugin `aero-gdl90`)

Brief panel order (each module places itself next to one neighbor; never position against a
neighbor another module already uses): bbody, dbPanel, wtgPanel, trkPanel, rwPanel, dvPanel, pfPanel,
llPanel, lcPanel, wbPanel, goPanel, pkPanel, tfrPanel, ntPanel, advPanel, asPanel, pmPanel, waPanel, mnPanel.
