# Deploy — earthmap.live

## Preferred pattern (same as firemap.live / app.disasterdb.com)

Hostinger shared hosting + GitHub Actions `lftp` mirror.

### 1) Unpark / attach website

`earthmap.live` currently resolves to Hostinger parked (`2.57.91.91`, hcdn “Parked Domain”).

In hPanel:
1. Add website / addon domain `earthmap.live` on an active hosting order (same plan family as firemap if available).
2. Confirm document root (typically `…/earthmap.live/public_html` or account root — match firemap quirk docs).
3. Create an FTP user rooted at that public_html (e.g. `u….earthmap`).

### 2) GitHub Actions secrets (this repo)

| Secret | Example |
|--------|---------|
| `PROD_FTP_SERVER` | FTP host / IP (firemap uses `ftp.firemap.live` or IP) |
| `PROD_FTP_USERNAME` | Hostinger FTP user for earthmap.live |
| `PROD_FTP_PASSWORD` | FTP password |

Workflow: `.github/workflows/deploy-production.yml` (workflow_dispatch + push to `main`).

### 3) DNS

Keep Hostinger nameservers (or point A/`@` and `www` at the hosting IP once the site exists).
HTTPS: Hostinger auto-SSL once the website is attached (parked page already answers TLS).

### Fast-track alternatives (if FTP not ready)

- **Cloudflare Pages** or **GitHub Pages** on a temporary host, then CNAME `earthmap.live` — only if you’re willing to move DNS off parked Hostinger.
- Manual zip upload via hPanel File Manager into public_html.

## Smoke after deploy

1. `https://earthmap.live/` shows globe + tip stamp (not parked page).
2. Tiles load from `sat.disasterdb.com` (CORS already open for public GeoColor).
3. `/countries/united-states/` CTA → `/?lng=-98.5&lat=39.8&zoom=4` centers CONUS.
4. Confirm `noindex` still present until Rob flips indexing.
