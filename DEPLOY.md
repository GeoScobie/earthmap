# Deploy — EarthMap

## Primary: GitHub Pages (Actions)

Workflow: `.github/workflows/pages.yml`

- Push to `main` (or **Actions → Deploy GitHub Pages → Run workflow**)
- Build: Vite static (`VITE_BASE=/earthmap/`) → `actions/upload-pages-artifact` → `deploy-pages`
- Live URL: **https://geoscobie.github.io/earthmap/**

Repo settings (one-time):

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Private repo Pages requires GitHub Pro (or make the repo public)

Custom domain later: set Pages custom domain + rebuild with `VITE_BASE=/`.

## Optional: Hostinger FTP (`earthmap.live`)

`.github/workflows/deploy-production.yml` — `workflow_dispatch` only. Needs `PROD_FTP_*` secrets. Prefer Pages until Hostinger FTP works.

## Smoke

1. Globe loads with OSM fills + hillshade under GeoColor
2. Contour lines from ~z4; labels from ~z9
3. Tip stamp refreshes from `sat.disasterdb.com/geocolor/latest.json`
4. `/earthmap/countries/united-states/` CTA deep-links into the globe
