# EarthMap (`earthmap.live`)

GEO-primary **live satellite map on a 3D globe** — fast-track MVP for clicks.

**Status:** private repo; country pages `noindex,follow` until the live map CTA is proven on HTTPS.

## What ships

- `/` — MapLibre GL globe + GeoColor XYZ from `https://sat.disasterdb.com/geocolor/...`
  - Layers: `gk2a`, `meteosat`, `goes-east`, `goes-west` (Himawari omitted while tip parked)
  - Tip from `latest.json`, refreshed every 60s
  - Deep-link: `?lng=&lat=&zoom=`
- `/countries/` + 35 Tier-1 country landings (from `/workspace/earthmap-seo-draft`)
- No FireMap / wildfire chrome

## Not in this MVP

- Soft seam protocols / dual-route west family (App `goes.js` stays untouched)
- Scrubber / animation / wind
- Ad network wiring (placeholder only)
- Fork-path widget

## Deploy

See `DEPLOY.md`. Pattern mirrors `disasterdb/firemap-live` Hostinger FTP.

## Repo home

Created as `GeoScobie/earthmap` (gh auth). Prefer transfer/recreate under `disasterdb/earthmap` when that account can create repos.
