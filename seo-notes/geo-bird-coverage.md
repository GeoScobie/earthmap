# EarthMap — GEO bird coverage (cook / CDN truth)

**Audience:** SEO (fills TBD birds in `earthmap-seo-draft/COUNTRY-SEO-DRAFT.md`).  
**Not a competing Tier-1 list.** Do not invent birds; prefer **known / parked / gap / TBD**.  
**As of:** 2026-09-30 ~09:40 UTC (box PT Tue Sep 29, ~11:40 PM HST).  
**Product note:** EarthMap is GEO-primary (not wildfire). Birds below are DisasterDB Sat cook slugs on Bunny — EarthMap may rebrand later; slug names are cook truth today.

---

## 1. Live cook / CDN inventory

### Public tile contract

```
https://sat.disasterdb.com/geocolor/<slug>/<YYYY-MM-DD>/<HHMM>/{z}/{x}/{y}.png
https://geocolor.b-cdn.net/geocolor/<slug>/…   # same Bunny zone `geocolor`
```

Manifests: `…/geocolor/latest.json`, `…/geocolor/times.json`  
Client soft-seam path (FireMap): same-origin `/__gc__/<slug>/…` (not for SEO URLs).

### Slugs that exist in cook (`GeoScobie/firemap-geocolor` README)

| slug | Sensor / bird | Role |
|------|---------------|------|
| `goes-east` | NOAA **GOES-19** ABI | Americas E ownership |
| `goes-west` | NOAA **GOES-18** ABI | E Pacific / Hawaii side |
| `goes-west-widl` | GOES-18 (IDL wrap strip) | Client dual-route with west; stamp shares `goes-west` |
| `meteosat` | EUMETSAT **MTG / Meteosat** GeoColour-class | Europe–Africa–ME ownership |
| `himawari` | JMA **Himawari-9** AHI | Asia–Oceania ownership |
| `gk2a` | KMA **GEO-KOMPSAT-2A** AMI | Overlay; prefer ~115–140°E over Himawari |

**No `msg-iodc` / Meteosat-IODC slug** in cook. Indian Ocean / western India are **not** a separate bird today.

### Tip status (`latest.json` probe 2026-09-30)

| slug | Tip status | Tip ISO (UTC) | SEO meaning |
|------|------------|---------------|-------------|
| `goes-east` | **LIVE** | 2026-09-30T09:00:00Z | Safe to name as live Americas E |
| `goes-west` / `goes-west-widl` | **LIVE** | 2026-09-30T09:00:00Z | Safe to name as live Americas W / Pacific |
| `meteosat` | **LIVE** | 2026-09-30T09:10:00Z | Safe to name as live Europe–Africa–Gulf |
| `gk2a` | **LIVE** | 2026-09-30T08:50:00Z | Safe to name as live Korea–EA overlay |
| `himawari` | **PARKED / frozen tip** | 2026-09-22T05:50:00Z (~8 days stale) | Cook slug + scripts exist; clients mark Himawari **parked**; **do not claim live Himawari** until tip advances again |

`times.json` currently lists short rolling windows per sat (hours-scale index); Bunny tile objects for `goes-east` still HEAD-ok ~15–18 days back in this probe — **not yet a reliable ~30-day guarantee**. SEO “up to ~30 days” stays a product hook, not CDN-proven retention.

---

## 2. Ownership vs publish clip (cook README)

Abutting lon ownership (display priority / “whose country”):

| slug | Ownership W | Ownership E | Notes |
|------|-------------|-------------|-------|
| `goes-west` | −180.0 | −133.0 | −133 puts CA/OR/WA/BC on **goes-east** |
| `goes-east` | −133.0 | −26.0 | |
| `meteosat` | −26.0 | +62.0 | |
| `himawari` | +62.0 | +180.0 | |
| `gk2a` | overlay | prefer ~115–140°E | Not a full ownership sector |

Publish clips (`gdalwarp` / tile CLIP — ~3° halo past ownership; **lat limits matter for limbs**):

| slug | W | S | E | N |
|------|---|---|---|---|
| `goes-west` | −180 | **−55** | −130 | **65** |
| `goes-east` | −136 | **−55** | −23 | **65** |
| `meteosat` | −29 | **−40** | +65 | **65** |
| `himawari` | +59 | **−65** | +180 | **70** |
| `gk2a` | +58 | **−70** | +175 | **75** |

Client soft seams (FireMap / App — fade only, not cook ownership): EW **−132.5°**, EM **−27.1875°**, MG **61.875°**, WG **169°**, fade **5.625°**. Stack order: GK2A → Meteosat → East → West-family.

**Polar honesty:** GEO usable imagery degrades poleward of ~±60–65°. Publish clips already stop at N=65 (GOES/Meteosat) / 70–75 (Himawari/GK2A). Far Arctic / Antarctic = **gap**, not a missing SEO bird name.

---

## 3. Answers to SEO TBDs (Tier-1 draft §D)

Source draft: `/workspace/earthmap-seo-draft/COUNTRY-SEO-DRAFT.md` open questions on India, western China, UAE/Saudi, Chile west limb, far-north Canada, NZ south limb.

| Country (slug) | Draft bird today | Cook / CDN verdict | SEO copy guidance |
|----------------|------------------|--------------------|-------------------|
| **India** (`india`) | TBD | **Ownership = `himawari`** (lon ~68–97°E is east of +62). **No IODC slug.** Himawari tip **parked**. `gk2a` publish clip *includes* India lon/lat but AMI is Korea-centered — **severe west-limb foreshortening**; not intended primary. | Keep **TBD for live**. Optional honest line: *“Cook ownership is Himawari; live tip currently parked. No Meteosat-IODC cook. Do not claim live India GEO until Himawari tip moves.”* |
| **China west** (`china`) | Himawari; GK2A (east); TBD west | **East coast (e.g. Shanghai ~121°E): known** — live **`gk2a`** (+ Himawari when unparked). **West / Xinjiang / Kashgar (~76–88°E): ownership `himawari`**, inside Himawari+GK2A publish clips on paper, but **Himawari parked** and GK2A is far west of preference band → **live quality TBD / weak**. | Split copy: *East China — GK2A (live).* *Interior / far west — Himawari when live; treat as TBD until tip unparks.* Do not claim full-country live Himawari. |
| **Saudi Arabia** (`saudi-arabia`) | Meteosat/MTG (east); TBD | **KNOWN primary = `meteosat`.** Riyadh ~45°E is inside ownership (−26…+62) and publish clip. Live tip advancing. | Drop TBD for **bird identity**. Optional quality note only: *eastern Meteosat disk → more foreshortening than Europe, still on-cook.* |
| **UAE** (`united-arab-emirates`) | Meteosat/MTG; TBD | **KNOWN primary = `meteosat`.** Dubai ~55°E still west of +62 ownership edge; live tip OK. Closer to MG seam than Riyadh → slightly more east-limb geometry. | Drop TBD for bird. Soft quality: *Gulf is near Meteosat east ownership edge; still meteosat, not Himawari.* |
| **Chile** (`chile`) | GOES-East, GOES-West (west limb) | **Mainland primary = `goes-east` only** (Santiago ~−71° is east of −133). **Not GOES-West** for the landmass — West ownership is Pacific west of −133. **Cape Horn ~−56° lat is south of goes-east publish S=−55** → **south tip outside publish clip (gap / TBD quality).** | Prefer: *Primary GOES-East.* Remove or demote “GOES-West west limb” for mainland. Flag *far-south Chile / Cape Horn: outside GOES publish south clip (−55) — TBD / gap.* |
| **Canada far north** (`canada`) | GOES-E/W; northern limb TBD | **South / mid-lat CA: known GOES-East** (and West only for far-west lon &lt; −133, e.g. Yukon/Alaska-adjacent). Publish **N=65**. Yellowknife ~62.5°N is at clip edge; High Arctic (e.g. Alert ~82°N) = **outside clip / GEO junk**. | Keep northern caveat. Honest: *Populated south OK on GOES; Arctic Canada beyond ~60–65°N is a GEO / publish-clip gap — not a second bird.* |
| **New Zealand** (`new-zealand`) | Himawari; south limb confirm | **Ownership = `himawari`.** Lat of NZ is inside Himawari (−65) and GK2A (−70) publish clips. Auckland ~174.8°E is near **gk2a E=175** clip edge. **Himawari tip parked** → no live Himawari frames. GK2A may paint northern NZ at extreme east/south limb — **quality TBD**. | Do not claim live Himawari. *Cook primary Himawari (parked). Live fallback GK2A limb only — confirm visually before strong SEO claims. South Island / far south: still in clip box, but limb/foreshortening TBD.* |

---

## 4. Tier-1 bird status cheat-sheet (all 35)

Legend: **Live** = tip advancing · **Parked** = slug exists, tip stale · **Gap** = outside useful GEO/publish · **TBD** = need visual QA or unpark before hard claims.

| slug | Primary bird (cook) | Live today? | Notes for SEO |
|------|---------------------|-------------|---------------|
| united-states | goes-east + goes-west | Live | CONUS dual-GOES; HI → west; AK → limb / N clip |
| japan | himawari; gk2a overlay | **Himawari parked; GK2A live** | Prefer soft “GEO over Japan” or lead with GK2A until Himawari tip moves |
| united-kingdom | meteosat | Live | Strong |
| germany | meteosat | Live | Strong |
| france | meteosat | Live | Strong |
| italy | meteosat | Live | Strong |
| spain | meteosat | Live | Strong |
| canada | goes-east (+ west far W) | Live (south) | Far north = gap (see §3) |
| mexico | goes-east (+ west NW fringe) | Live | Strong |
| brazil | goes-east | Live | Strong; Amazon/Atlantic |
| australia | himawari | **Parked** | Ownership Himawari; GK2A may help NW fringe only — AU mostly Himawari-dependent |
| india | himawari (no IODC) | **Parked / TBD live** | See §3 |
| south-korea | gk2a; himawari | **GK2A live** | Best GK2A home case |
| china | himawari; gk2a east | **East live via GK2A; west TBD** | See §3 |
| indonesia | himawari | **Parked** | Same Himawari dependency |
| philippines | himawari | **Parked** | Same |
| thailand | himawari | **Parked** | Same |
| vietnam | himawari | **Parked** | Same |
| taiwan | himawari; gk2a | **GK2A live; Himawari parked** | OK to lean GK2A |
| singapore | himawari | **Parked** | Same |
| netherlands | meteosat | Live | Strong |
| poland | meteosat | Live | Strong |
| turkey | meteosat | Live | Strong (east Turkey nearer disk edge) |
| saudi-arabia | meteosat | Live | TBD dropped for identity (§3) |
| united-arab-emirates | meteosat | Live | TBD dropped for identity (§3) |
| south-africa | meteosat | Live | In clip (S ≥ −40); good |
| egypt | meteosat | Live | Strong |
| nigeria | meteosat | Live | Strong |
| argentina | goes-east | Live | South cone; watch S=−55 clip for Tierra del Fuego fringe |
| chile | goes-east | Live (mainland) | West-limb GOES-West claim incorrect for land; south tip gap (§3) |
| colombia | goes-east | Live | Strong |
| new-zealand | himawari | **Parked / limb TBD** | See §3 |
| portugal | meteosat | Live | Atlantic edge of disk — still meteosat |
| ireland | meteosat | Live | Strong |
| malaysia | himawari | **Parked** | Same Himawari dependency |

**SEO implication:** Any landing that *hard-names Himawari as live* (JP, AU, ID, PH, TH, VN, SG, MY, NZ, India, western CN) should soften until `latest.json` → `himawari` tip is current again, **or** name the live overlay (`gk2a`) where it actually helps (KR, TW, east CN, JP rim).

---

## 5. Gaps → treat as Tier-2 / soft claims (not missing bird names)

| Gap | Why | SEO handling |
|-----|-----|--------------|
| **Himawari parked** | Tip frozen ~2026-09-22; clients skip Himawari advance | Soften APAC “live Himawari” copy; or wait for unpark |
| **No MSG-IODC** | README: “No MSG-IODC slug” | India / IO not filled by a second EUMETSAT bird |
| **Poles / High Arctic / Antarctic** | Publish N≤65–75; GEO geometry | Canada far north, Greenland, Antarctica → Tier-2 or explicit gap |
| **Chile / Argentina far south** | GOES publish S=−55 | Cape Horn / deep Patagonia → gap note |
| **Southern Ocean / NZ–AU if only GK2A** | GK2A E clip 175; Himawari parked | Don’t promise crisp south-limb live without QA |
| **~30-day history** | Product hook; CDN probe showed ~2–3 weeks of `goes-east` objects, not 30 | Keep “up to ~30 days” as aspiration; don’t cite exact retention from this cook table |

---

## 6. Sources inspected

| Source | What we took |
|--------|----------------|
| `GeoScobie/firemap-geocolor` README (+ `scripts/*`, `cron/geocolor-prune`) | Slugs, ownership lons, publish clips, Bunny zone `geocolor`, no IODC, Himawari/GK2A cook notes |
| `https://sat.disasterdb.com/geocolor/latest.json` | Live vs frozen tip per slug (Bunny CDN) |
| `https://sat.disasterdb.com/geocolor/times.json` | Per-sat frame lists (short index window) |
| Local FireMap tip `geocolor-sat.js` (`/workspace/audit-geocolor`, `/workspace/firemap-live-cutover`) | Soft seams, `/__gc__/`, stack, Himawari parked |
| `disasterdb-app` `src/goes.js` + `src/theme.js` + `docs/geocolor.md` | Same CDN contract, satSourceBounds, Himawari parked flags |
| `/workspace/arch/research/geocolor-global-sources-cadence.md` | SSP / licence / phase context (Himawari @ 140.7°E, MTG @ 0°, GOES-19/18) — **not** a substitute for cook tip truth |
| SEO draft `/workspace/earthmap-seo-draft/COUNTRY-SEO-DRAFT.md` | TBD list this file answers |

**Repos not used as SoT for bird truth:** GIBS, EUMETView WMS, NICT Himawari browse (non-commercial), FireMap page URLs.

---

## 7. One-line handoff to SEO

- **Saudi / UAE:** lock **Meteosat** (live) — remove bird TBD.  
- **Chile:** lock **GOES-East** for mainland; drop GOES-West land claim; flag Cape Horn publish-clip gap.  
- **Canada far north / NZ south / India / western China:** keep honest **TBD or gap** language; India & western China need **Himawari unpark** (no IODC).  
- **All Himawari-named APAC landings:** soft-claim or lead with **GK2A where live** until Himawari tip advances.

*Output path: `/workspace/earthmap/geo-bird-coverage.md`*
