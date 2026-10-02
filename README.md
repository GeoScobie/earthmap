# EarthMap

GEO-primary **live satellite map on a 3D globe** — lean MVP (App experiment).

**Live (GitHub Pages):** https://geoscobie.github.io/earthmap/

## What ships

- MapLibre GL globe + GeoColor XYZ from `https://sat.disasterdb.com/geocolor/...`
  - Layers: `gk2a`, `meteosat`, `goes-east`, `goes-west`
  - Tip from `latest.json`, refreshed every 60s
  - Deep-link: `?lng=&lat=&zoom=`
- **Sat-live basemap (ported from App #114):** Protomaps OSM carto (DisasterDB planet PMTiles) + Mapterhorn Terrarium **hillshade** (all zooms) + **maplibre-contour** isolines from **z4** (labels z9), with GeoColor inserted under `contour-lines`
- Country landings under `/countries/` (noindex until proven)
- No FireMap / wildfire chrome

## Stack

Vite + MapLibre 5.6 + `pmtiles` + `@protomaps/basemaps` + `maplibre-contour`

```bash
npm install
npm run dev      # http://localhost:5174/earthmap/
npm run build    # dist/ for Pages
```

## Deploy

See `DEPLOY.md`. GitHub Actions → Pages is the default path.
