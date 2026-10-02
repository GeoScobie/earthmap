# EarthMap Tier-1 country SEO draft

**Status:** Draft only; EarthMap green light recorded 2026-09-29. Nothing here was deployed or sent to Hostinger/live sites.

## What is here

- `COUNTRY-SEO-DRAFT.md` — master rules, Tier-1 table, hub outline, template, and open questions.
- `countries/INDEX.md` — region-grouped `/countries/` hub outline.
- `countries/*.md` — one EN-first markdown SEO sketch for each of the 35 Tier-1 countries.

## Locks applied

- GEO imagery is the primary story; no FireMap, wildfire, or disaster-domain chrome.
- Country pages are content-first inventory: each has one secondary `<!-- ad slot: standard content page -->` placeholder. No ad network or size is invented.
- Every page is `noindex,follow` until HTTPS is real **and** its Open-on-EarthMap CTA reaches a working map.
- Titles use `{Country} Live Satellite Map | EarthMap`; body copy says near-real-time and avoids live-now, exact-latency, or exact-retention claims.
- History is only “up to ~30 days” as a product hook; actual depth/cadence is pipeline-dependent.
- Deep-links use only `?lng=&lat=&zoom=` plus `{{EARTHMAP_EMBED}}` TBD. No public disaster-domain or legacy internal URLs.
- Bird copy follows `/workspace/earthmap/geo-bird-coverage.md`: Meteosat/GOES/GK2A truth is named where supported; Himawari is softened while parked; India, western China, Canada’s far north, Chile’s Cape Horn, and NZ limb caveats remain honest.

## Next steps (not performed here)

1. Review the 35 country copy blocks and approve any editorial/camera changes.
2. Build a generator that emits `/countries/{slug}/` routes, frontmatter/meta robots, canonical tags, and JSON-LD from the Tier-1 data.
3. Validate HTTPS and the real Open-on-EarthMap CTA/embed contract.
4. After the site is unparked and explicitly approved, implement on Hostinger; only then reconsider indexing and run a final coverage/CTA QA pass.
