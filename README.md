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
