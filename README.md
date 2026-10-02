# EarthMap

Map client is a carbon copy of the DisasterDB App (`app.disasterdb.com` / `disasterdb-app`), except the **EarthMap L5 logo** and the **EarthMap** name in the wordmark slot.

**Live (GitHub Pages):** https://geoscobie.github.io/earthmap/

## What ships

- Same map shell as the App: dark banner chip (logo + live clock + search), layer list, toolbar, legend, about, measure, share, locate
- Same GeoColor seams and bottom-right time transport (chip, play, scrub, time-since)
- Search matches the App (banner button + fire name / Photon place dropdown), not a custom inline field
- Country landings under `/countries/` are unchanged and are not part of the map chrome
- L5 mark: `public/icons/earthmap-l5-512.png`

## Stack

Vite + MapLibre 6 + `pmtiles` + `@protomaps/basemaps` + `maplibre-contour` (same client modules as the App).

```bash
npm install
npm run dev      # http://localhost:5174/
npm run build    # dist/  (VITE_BASE=/ for earthmap.live, /earthmap/ for Pages)
```

## Deploy

See `DEPLOY.md`. GIT owns Hostinger — do not FTP from agents.
