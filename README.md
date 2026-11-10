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
- p150 (loaded before p54) launch polish round 3, restored from the first p138: narration audio waits until played (saves about 1.6 MB on every first visit), larger touch targets, Feedback button name, a persistent banner when browser storage is full, friendly date on the risk assessment. Module numbering between chats: see COORDINATION.md
- p152 Go to an airport: top bar Go to button, / or Ctrl K (Cmd K), map Tools item; results open the airport page or center the map with a marker; Airports in the side menu on wide screens (window.AeroGoTo). Built here because the regular chat's p140 could not be recovered; p140 is unused
- p153 two operating modes: Flight School (S.role civil) and Military Planning (military; a former "both" counts as military). First run question, mode hub at the top of Plan, top bar switch on wide screens, More. body.mode-school / body.mode-mil; window.AeroMode
- p154 school fleet at #/fleet: tail, type, planning speed, weight and balance (S.profiles[tail].wb, same fields as p72) and checklists (p95 by tail); shared by link (#/fleet/import/<data>) or file, no server storage; S.fleet; window.AeroFleet
- p155 planning lab at #/lab: six lessons tied to Private Pilot ACS Area I (weather, performance, weight and balance, fuel, airspace, risk) with 172 and Warrior notes, a practice flight that opens the matching brief panel, and three check questions; progress in S.lab; window.AeroLab
- p156 sample school at #/school/demo (fictional Gulf Coast Flight Academy): sample shared briefs, roster and fleet; buttons add the sample fleet (172S example numbers, flagged) and plan KPNS to KJKA
- p157 tutorial and demo for the two modes: Flight School tutorial track (lab, practice flight KPNS KJKA in sample DEMO1, verdict, weight and balance, fleet, invite, sample dashboard), Tutorial page with Flight School, Military Planning and instrument pilot tours, Flight school card on #/demo, Flight School tabs on the Start here card
- p158 school invite link and QR code (#/join/<code>, QR library lazy loaded from vendor/qrcode-1.4.4.min.js, MIT), school fleet saved with the school (schools.fleet, rpc set_school_fleet) and synced to students, optional planning lab progress shared with instructors (school_members.lab, rpc share_lab_progress) shown on the dashboard; privacy sentence approved October 28, 2026
- p159 printable instructor sheets for each planning lab lesson (answer key, notes box), print all six from the lesson list
- p160 (loaded right after p1, before p16) faster first load: the military symbol library waits until a mission page or Military Planning mode needs it; index.html has a loading placeholder in #view and a preconnect to the data server
- p161 Gold display theme (light gray, white and gold with serif headings), built on Day mode; saved under as_theme_x
- p162 printing fixes: p118's hide everything print rule applies only with the civil card on the page (brief, mission and kneeboard prints were blank), light themes print uninverted, floating buttons stay off the paper
- p163 VFR nav log on the brief (TC, wind, WCA, TH, variation, MH, distance, GS, ETE, fuel per leg; times and fuel rounded up; printable paper form with ATE, ETA, ATA and deviation columns), window.AeroNavLog
- p164 larger weight and balance envelope chart with grid, axis titles, max weights and labeled takeoff and landing points
- p165 instructor review of shared briefs: Plans to review on the school dashboard (approve, return with comment; rpc review_share), status on the student's brief and Account page, history in school_reviews; migration 20261102_school_share_reviews.sql and privacy sentence approved November 2, 2026
- p166 tablet touch targets: brief view switches, section chips and Plan examples at least 40 px on touch screens
- p167 schools edit the planning lab: instructors change a lesson's check questions (1 to 10) and add a school note; saved with the school (schools.lab, rpc set_school_lab), shown only to its members, Restore the standard version; migration 20261103_school_lab_edits.sql and privacy sentence approved November 3, 2026. p155 and p158 score against each lesson's question count
- p168 for instructors: Instructor tutorial track on the Tutorial page (sample school and fleet; lesson editing scene only while p167 is on) and a Getting started checklist on a school's dashboard (S.gsHide)
- p169 Vigilyn name on screen, in speech, shares and text downloads (runtime rename; internal names unchanged)
- p170 Move my data from the old aerosignal-app link to flyvigilyn (window to window, confirmed on the new link)
- p171 Pilot mode home: #/minimums (personal minimums and currency); Flight School tutorials switch mode while they play
- p172 #/scenarios: scenario practice from NTSB accidents near the route, tagged by Private Pilot ACS area
- p174 Safety summary on the instructor dashboard and the sample school (print or save as PDF)
- p175 Airport traffic and delays panel on the brief: FAA NAS status (nasstatus function) and pilot reports (live November 4: post from the brief when signed in, shown without names for 90 minutes; nasstatus deletes reports older than 30 days; demo flight shows samples and cannot post). p107 edit: verdict reads the bf-ns line
- p176 School traffic picture on the instructor dashboard and sample school (shared flights by airport and hour, next 48 hours); students and instructors see counts without names on the brief (school_traffic function, applied November 4)
- p177 GPS and approaches panel on the brief: GPS, WAAS and LPV NOTAMs at route airports (bf-gps card line, read by p107) and, on IFR flights, which destination and alternate approaches need GPS
- p178 #/clearance: CRAFT clearance practice (preferred route, departure frequency, squawk; listen, copy blind, check, readback); tiles in Pilot and Flight School hubs (p153 edit)
- p179 Themes: only Gold (default on first run), Dark (p87 signal) and Tactical (p87 tac) are offered; Night red and Tactical users go to Tactical
- p180 Student progress panel and printable per student report on the instructor dashboard and sample school
- p181 Flight Service handoff on the Flight plan sheet (tap to copy each item, 1800wxbrief.com, .fpl download, Open in ForeFlight on iPhone and iPad); Gold text glow removed, compact phone top bar, Tactical keeps disclaimers red
- p182 Fly screen (#/fly): GPS groundspeed, magnetic track, altitude, next waypoint with auto sequencing and Direct to, destination ETE and ETA, fuel estimate from the nav log numbers, flight timer, nearest airports; Fly tile in Pilot mode and a Fly this route button on the Flight plan sheet (p153 edit adds the tile)
- p183 Known issues for this aircraft type (#kiPanel after #gpPanel): FAA Service Difficulty Reports by system and part with the latest reports, through sdr_summary; edge function sdrsync loads the yearly SDR files; weekly NTSB job private.ntsb_weekly on cron
- p184 Avoid special use airspace: on Flights and in the brief airspace panel, pick prohibited and restricted (always), warning, MOA, alert; reroutes each leg around them at cruise altitude with a 3 nm margin as coordinate waypoints, with Undo (tester feedback 16)
- p185 Edit route on the map: the solid magenta route follows the drag instead of only the dashed line (tester feedback 17)
- p186 Maps sidebar Route tab (every point with magnetic course, leg and total distance, time at cruise speed) and Add VFR checkpoints (Maps Route tab and Flights page): about every 20 nm on long legs, public airports within 5 nm of the line first, then VORs; private strips and military fields skipped; Undo
- p187 Ask and Feedback floating buttons are round icons that show their label on hover or focus; pages get bottom room so the last lines scroll clear
- p187 edit Nov 8: Ask stacks above Feedback whenever they would overlap (phones and tablets on More, Airports, Logbook, Fly, Preview and others)
- p170 edit Nov 8: after Move my data (or I already moved) the old aerosignal-app link opens flyvigilyn automatically (?stay=1 to stay); closing the note hides it 3 days; the note tells home screen users to replace the old icon
- p188 Forgiving route entry: TO, THEN, VIA, FROM, AND and arrows between points are ignored; a middle point more than 300 nm off the route is left out with a toast (stops a typo or a word like TO resolving to a navaid on another continent)
- p189 Preview in 3D (#/preview): flies the route over 3D terrain (AWS open elevation tiles) with satellite imagery or the FAA sectional, cockpit, chase or overhead view, fixed MSL or height above ground, speed 1x to 40x, scrub bar, HUD with next point, MSL, ground and AGL (red under 500 ft); FAA obstacles 200 ft AGL or taller within 3 nm drawn as red columns with an Obstacle ahead readout (Nov 6); Nov 8: Training route block altitude mode (200 ft above each MTR segment floor, under its ceiling, route in purple), cloud bases from current METARs near the route as gray layers with a Ceiling readout, and day, dusk or night lighting at the planned departure time; MapLibre GL 4.7.1 from unpkg on demand; entry from the Maps Route tab, Fly screen, MTR panel and Pilot and Military hub tiles
- p190 What's new card on the Plan page for returning pilots (titles only on phones), Hide to dismiss until the next update, and a What's new button on More; p189 edit Nov 8 caps the 3D pixel ratio at 1.5 for phones
- p191 Your feedback: new feedback carries a device made client_token; More shows this device's feedback with status and reply (feedback.reply, public; admin_note stays internal); a one time note on Plan when a reply or status change arrives; the admin inbox has a Reply to tester box. When resolving feedback, write feedback.reply for the tester.
- p192 FAA airport data (faa_airports from NASR via edge function nasrapt, refreshed weekly by private.nasr_apt): Fuel and services panel on airport pages, Fuel stops panel on the brief (#fsPanel after #kiPanel, range from nav log fuel, burn and TAS with a 30, 45 or 60 minute reserve and 10% margin, public airports within 15 nm selling the chosen fuel, Add stop), plus an arrival check in that panel (ETA against attended hours, private use, no fuel, night lighting by remark; attendance in plain words; departure and arrival times in each airport's own time zone from its state and position), and AeroFAA.publicSet used by VFR checkpoints (p186) and Fly nearest airports (p182, which also shows each airport's fuel) to leave out private fields
- p193 See a sample brief: a button on the Start here card that loads the notional civilian sample flight (p15's bundle) and opens its brief with no tour; a pilot's own logbook is kept; #sbNote on the brief marks the sample
- p194 touch polish (pointer:coarse only): fingertip sized grab areas on Edit route handles (.re-h, .re-g) and measure points (.ms-pt), taller tap areas on .pnl-tg and .linkbtn
- p195 Accidents along this route: brief panel #rtPanel after #fsPanel from the existing accidents_near_route function, plain summary plus the five most relevant with reason tags, a pointer line in #bfBluf and a Route accidents jump link
- p196 terrain with the offline copy: when p69 has saved a flight, terrain tiles along the route go into aerosignal-region-v1 (S.offTerrain) and p189 reads saved terrain first; #ofFly on the Fly screen shows offline status and opens the saved brief
- p123 two finger measure needs an 850 ms hold (November 9); tests/tdz-scan.cjs checks all modules before a push; build.mjs adds a preconnect to cdnjs
- p182 edit Nov 6: Fly screen only derives speed and track from precise fixes and says when the device has no GPS (laptops)
- p182 edit Nov 8: Terrain ahead tile on the Fly screen (highest ground within 0.5 nm of track over the next 5 nm from the elevation tiles via AeroPreview.elev, and FAA obstacles 200 ft AGL or taller), amber under 1,000 ft clearance and red under 500 ft, with the elevation tiles along the whole route loaded when Start flying is tapped so it works without a signal; p190 What's new list refreshed (version 2026-11-08b)
- Monthly SDR refresh job private.sdr_monthly on cron (approved Nov 6)
- Edge functions ntsbsync (NTSB weekly update files and the public GitHub mirror into ntsb_events and ntsb_narratives) and embedchain (runs the embedding backfill in steps)
- p153 edit: third mode, Pilot (S.modeKind = pilot, same civil role as Flight School)
- tests/calc.test.cjs: calculation tests (distance and course, wind triangle, magnetic variation, weight and balance, fuel, nav log) against independently worked answers; run with node tests/calc.test.cjs (not deployed)
- tests/tdz-scan.cjs: scans every module for a let or const name used before its declaration in the same block (this broke Add VFR checkpoints on November 8); run with node tests/tdz-scan.cjs before pushing (needs acorn, not deployed)
- p129 ADS-B In groundwork: GDL 90 decoder and encoder, traffic layer, Traffic simulator in the map Tools menu (AeroMapTools hook in p123); live feed only in the native app (`native/`, plugin `aero-gdl90`)
- p139 pilot feedback Oct 28: plate viewer keeps the mouse wheel off the map (full screen map), On map from the full size viewer, georeference note and Hide route corridors (Tools menu and Plates panel, S.corrHide), airport page charts, NOTAMs, frequencies and FAA publication links, logo goes home to the Start here card, device voices say FAA as F A A

Brief panel order (each module places itself next to one neighbor; never position against a
neighbor another module already uses): bbody, dbPanel, wtgPanel, trkPanel, rwPanel, dvPanel, pfPanel,
llPanel, lcPanel, wbPanel, goPanel, pkPanel, tfrPanel, ntPanel, advPanel, asPanel, pmPanel, waPanel, mnPanel.

- p350 Daylight and night panel on the brief (sunrise, sunset, civil twilight, time after dark; `AeroDaylight`)
