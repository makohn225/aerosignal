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

Brief panel order (each module places itself next to one neighbor; never position against a
neighbor another module already uses): bbody, dbPanel, wtgPanel, trkPanel, rwPanel, dvPanel, pfPanel,
llPanel, lcPanel, wbPanel, goPanel, pkPanel, tfrPanel, ntPanel, advPanel, asPanel, pmPanel, waPanel, mnPanel.
