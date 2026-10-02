# Deploy — EarthMap

## Primary (org): Hostinger FTP → earthmap.live

Repo: **https://github.com/disasterdb/earthmap**  
Workflow: `.github/workflows/deploy-production.yml`

Triggers: push to `main`, or **Actions → Deploy production (Hostinger FTP) → Run workflow**.

Build: `npm ci` + Vite with `VITE_BASE=/` → `dist/`.

### Secrets (repo Settings → Secrets and variables → Actions)

| Secret | Purpose |
|--------|---------|
| `EARTHMAP_FTP_SERVER` | Hostinger FTP hostname |
| `EARTHMAP_FTP_USERNAME` | FTP user for the earthmap.live site |
| `EARTHMAP_FTP_PASSWORD` | FTP password |

If any secret is missing, the workflow fails with a clear error (no partial upload).

### Hostinger Apache quirk

FTP often lands in `/public_html`, but the Apache document root is the **parent** `/`. The workflow:

1. `cd /`
2. Removes Hostinger `default.php` / `Default.php` / `default.html`
3. `mirror` of `dist/` into `.` (Apache root)
4. Removes a nested `public_html/` if mirror created one

Same pattern as `disasterdb-app` → app.disasterdb.com.

### One-time Hostinger setup (Rob)

1. Create website for **earthmap.live** in Hostinger
2. Create an FTP account scoped to that site
3. Add the three `EARTHMAP_FTP_*` secrets on **disasterdb/earthmap**
4. Push to `main` (or run the workflow manually)

Imagery stays on **sat.disasterdb.com** (client already points there; no Contabo deploy for this app).

## Secondary (personal): GitHub Pages

Repo: **https://github.com/GeoScobie/earthmap**  
Workflow: `.github/workflows/pages.yml`

- Push to `main` (or **Actions → Deploy GitHub Pages → Run workflow**)
- Build with `VITE_BASE=/earthmap/` → Pages artifact
- Live URL: **https://geoscobie.github.io/earthmap/**

Repo settings (one-time): **Settings → Pages → Source: GitHub Actions**. Free-plan Pages needs a **public** repo.

Pages is a convenient personal preview; production for earthmap.live is Hostinger FTP on the org repo.

## Smoke

1. Globe loads with OSM fills + hillshade under GeoColor
2. Contour lines from ~z4; labels from ~z9
3. Tip stamp refreshes from `sat.disasterdb.com/geocolor/latest.json`
4. Country SEO pages CTA deep-links into the globe

## Node `start` script

`package.json` includes `"start": "vite preview --host 0.0.0.0 --port 3000"` so Hostinger Node / Git auto-detect stops complaining. Prefer **static FTP** (`deploy-production.yml`) for earthmap.live — not a long-running Node process. If Hostinger asks for Build + Start: Build = `VITE_BASE=/ npm run build`, Start = `npm start` (preview serves `dist/`).
