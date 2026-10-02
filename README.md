# EarthMap

GEO-primary **live satellite map on a 3D globe** — lean MVP (App experiment).

**Live (GitHub Pages):** https://geoscobie.github.io/earthmap/

## What ships

- MapLibre GL globe + GeoColor XYZ from `https://sat.disasterdb.com/geocolor/...`
  - Layers: GK2A → Meteosat → GOES-East → GOES-West family (same stack as DisasterDB App)
  - **Client lon-alpha seam fades** (App `goes.js` protocols: EW / EM / MG / West-family IDL)
  - Tip from `latest.json`, ~60s poll + wake refresh
  - Deep-link: `?lng=&lat=&zoom=` · `?scrub=1`
- **Time chrome (ported from App):**
  - Search-bar tip / observation stamp (LIVE · local · UTC · age)
  - Bottom-right chip ↔ expand transport: play loop (~4h), scrub slider, Latest, time-since
- **Sat-live basemap (App #114):** Protomaps OSM carto (DisasterDB planet PMTiles) + Mapterhorn Terrarium hillshade + maplibre-contour isolines from z4
- Country landings under `/countries/` (noindex until proven)
- L5 branding (navy / sky / teal / coral) — no FireMap / wildfire chrome

## Stack

Vite + MapLibre 5.6 + `pmtiles` + `@protomaps/basemaps` + `maplibre-contour`

```bash
npm install
npm run dev      # http://localhost:5174/earthmap/
npm run build    # dist/ for Pages
```

## Deploy

See `DEPLOY.md`. GitHub Actions → Pages is the default path. GIT owns Hostinger — do not FTP from agents.
