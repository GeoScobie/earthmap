// ---------------------------------------------------------------------------
// Disaster DB — brand tokens
//
// This is the ONLY file you need to touch to rebrand the map. Everything in
// style.js reads from here. When you pull your Mapbox Studio style JSON
// (see README step 6), copy your real hex values in here and the whole map
// re-skins in one shot.
// ---------------------------------------------------------------------------

export const brand = {
  // --- Chrome (the UI around the map) ------------------------------------
  ink:    'hsl(222, 56%, 4%)',  // Studio 'background' layer — dark navy, not black
  panel:  '#10161D',  // control surfaces
  edge:   '#223040',  // hairlines and borders
  text:   '#DFE6ED',
  muted:  '#7E8D9C',

  // --- Map label colors ---------------------------------------------------
  // Copied verbatim from the Mapbox Studio paint blocks, in the hsl() form
  // Studio wrote them — MapLibre parses hsl() natively, so these are the same
  // numbers you tuned there rather than my approximation of them.
  labelText:      'hsl(0, 0%, 100%)',   // POIs, roads, natural features
  labelDim:       'hsl(0, 0%, 95%)',    // settlements, states, countries
  labelHalo:      'hsl(0, 5%, 0%)',     // the standard halo
  labelHaloSoft:  'hsla(0, 0%, 0%, 0.5)', // water only — deliberately weaker
  labelHaloSub:   'hsla(0, 5%, 0%, 0.75)', // neighbourhood labels

  // Water labels are periwinkle in your style, NOT the cyan this file used to
  // guess at. Oceans/seas/bays get the more saturated of the two.
  waterLabel:      'hsl(240, 68%, 90%)',
  waterLabelOcean: 'hsl(240, 96%, 82%)',

  labelMuted:     '#C6D2DD',

  // POI category colours, straight from Studio's poi-label paint block. This
  // colour coding is the signature of your basemap — green parks, orange
  // schools, red hospitals — and it was missing here entirely.
  poiPark:      'hsl(110, 100%, 85%)',
  poiEducation: 'hsl(30, 100%, 85%)',
  poiMedical:   'hsl(0, 100%, 85%)',
  poiHalo:      'hsl(0, 0%, 10%)',
  // Near-solid white admin borders — read clearly over satellite / live imagery.
  // Protomaps boundaries.kind: country | region | county (ADM2) | locality
  boundaryLine:   'rgba(255,255,255,0.88)',  // region / state
  boundaryLineAdm2: 'rgba(255,255,255,0.82)',  // county / ADM2
  boundaryLineHi: 'rgba(255,255,255,0.95)',  // country (ADM0)
  // Dark halo under coast / strong ADM0 — silhouette through cloud.
  boundaryCasing: 'rgba(0,0,0,0.72)',
  coastlineLine:  'rgba(255,255,255,0.95)',

  // --- Road colors over imagery ------------------------------------------
  // Studio uses two near-identical greys and no casing at all. There is no
  // yellow highway in your style — that was this file's invention.
  roadMajor:   'hsla(0, 0%, 80%, 0.8)',   // motorway, trunk, primary, secondary
  roadMinor:   'hsla(0, 0%, 77%, 0.8)',   // street, service, track, link roads
  roadCasing:  'hsl(0, 0%, 14%)'          // bridges only, per Studio
};

// Sat major-roads overlay (planet PMTiles roads source-layer). Live imagery
// prefers addLayer(..., SAT_ROADS_LAYER_ID) so roads sit above GeoColor and
// under coast/ADM/labels — see style.js buildOverlays + goes.js beforeId.
export const SAT_ROADS_LAYER_ID = 'roads-simple';

// Contour / hillshade layer ids (maplibre-contour + Terrarium). GeoColor
// beforeId prefers CONTOUR_LINES so isolines sit above sat at low zoom;
// hillshade stays in the Protomaps OSM carto stack under imagery.
export const HILLSHADE_LAYER_ID = 'hillshade';
export const CONTOUR_LINES_LAYER_ID = 'contour-lines';
export const CONTOUR_LABELS_LAYER_ID = 'contour-labels';

// First outline layer in style.js paint order (coast casing → coast → ADM →
// country). Fallback beforeId when roads-simple is absent.
export const BOUNDARY_BEFORE_ID = 'coastline-casing';
export const BOUNDARY_LAYER_IDS = [
  'coastline-casing',
  'coastline',
  'boundary-adm2',
  'boundary-region',
  'boundary-country-casing',
  'boundary-country'
];
// Coast + country casing are sat/near-time only; ADM1/ADM2 stay in both modes.
export const SAT_ONLY_OUTLINE_IDS = [
  'coastline-casing',
  'coastline',
  'boundary-country-casing'
];

// ---------------------------------------------------------------------------
// Basemap selection (satellite default on load)
//
// Ids:
//   'satellite'         Prod default — near-time GeoColor over Protomaps.
//                       Ocean/land fills stay under the rasters (style.js).
//                       ?basemap=disasterdb-topo still forces topo.
//   'disasterdb-topo'   Topo — colors + Lexend label layout tracked to
//                       Mapbox outdoors-v11. Not the load default.
//   'disasterdb-light'  Light — Mapbox light-v10 grays + Lexend labels.
//   'disasterdb-dark'   Dark — Mapbox dark-v10 grays + Lexend labels.
//   'disasterdb-streets' Streets — Mapbox streets-v11 + Lexend labels.
//   'disasterdb-navigation' Navigation — FireMap nav (navigation-night-v1).
//   'disasterdb-gray'   Gray — desaturated light-v10 + Lexend labels.
//   'disasterdb-night-nav' Night navigation — near-black ground, yellow/white
//                       major roads. Not a Mapbox navigation-day match.
//   'disasterdb-hybrid' Hybrid — dark muted land, light roads. Not imagery
//                       and not a Mapbox satellite-streets color match.
//
// Override cold start:
//   1) ?basemap=satellite (or disasterdb-light / disasterdb-dark)
//   2) Or export overrides from theme.local.js (see theme.local.js.example)
//
// Tile URL stays sources.basemapPMTiles (r2.dev today; tile.disasterdb.com
// when DNS is ready — see comment on basemapPMTiles).
// ---------------------------------------------------------------------------

export const BASEMAP_IDS = [
  'satellite',
  'disasterdb-topo',
  'disasterdb-light',
  'disasterdb-dark',
  'disasterdb-streets',
  'disasterdb-navigation',
  'disasterdb-gray',
  'disasterdb-night-nav',
  'disasterdb-hybrid'
];

/** @type {'satellite'|'disasterdb-topo'|'disasterdb-light'|'disasterdb-dark'|'disasterdb-streets'|'disasterdb-navigation'|'disasterdb-gray'|'disasterdb-night-nav'|'disasterdb-hybrid'} */
export const basemapId = 'satellite';  // near-time NASA + GeoColor (Rob 2026-09-21)

// Optional hillshade for cartographic modes (topo / light / dark).
// Theme default stays false (light/dark stubs); disasterdb-topo forces ON in
// basemap-resolve.js unless &hillshade=0.
// Interim DEM: Mapterhorn CDN Terrarium WebP (tileSize 512). Next: own R2
// Americas extract PMTiles — see docs/PR_DISASTERDB_TOPO.md.
export const hillshadeEnabled = false;

// Hillshade paint (cartographic modes only).
// Milder relief: 'igor' (softer than multidirectional). Swap back to
// 'multidirectional' + exaggeration ~0.3 if QA prefers the old look.
// Later "real-time" shade: animate hillshade-illumination-direction from solar
// azimuth on the same DEM — document only; not shipped yet.
export const hillshade = {
  method: 'igor',
  shadow: 'rgba(0, 0, 0, 0.42)',
  highlight: 'rgba(255, 255, 255, 0.28)',
  exaggeration: 0.35
  // illuminationDirection: 335  // reserved for future solar-azimuth animation
};

// Water fill vs lines (cartographic). Hillshade is inserted *under* the water
// polygon fill — opaque fill washed out relief over oceans/lakes. Soften fill
// so terrarium shade reads through (Google/Outdoors-ish). Keep river/stream
// *line* layers fully opaque so linear waterways stay crisp.
// Mapterhorn Terrarium is land DEM only (no GEBCO/bathymetry); translucent
// water still reveals coastal/land relief under water polygons.
export const waterFillOpacity = 0.65;   // polygon fill (ocean / lake / reservoir)
export const waterLineOpacity = 1;      // water_river / water_stream lines

// Runtime isolines via maplibre-contour from the same Terrarium DEM (meters).
// Contours on disasterdb-topo + sat-live (OSM under GeoColor); also when
// hillshade/DEM is on for light/dark. Low-z thresholds so isolines read on
// sat-live (not only at high z). Coarser mid-zoom vs AWS Joerd spike.
export const contours = {
  multiplier: 1,
  layer: 'contours',
  elevationKey: 'ele',
  levelKey: 'level',
  // zoom -> [minor, major] interval (meters) — start at low z for sat-live
  thresholds: {
    4: [2000, 8000],
    6: [1000, 4000],
    8: [500, 2000],
    10: [250, 1000],
    12: [100, 500],
    14: [50, 200],
    15: [25, 100]
  },
  lineColor: 'rgba(90, 70, 40, 0.45)',
  lineColorMajor: 'rgba(70, 50, 30, 0.65)',
  labelColor: '#5a4630',
  labelHalo: 'rgba(245, 242, 234, 0.9)'
};

// Label/POI colors for light cartographic basemaps (topo + light).
// Satellite keeps brand.* (white Lexend over imagery). Dark stub keeps brand.*.
export const cartoLightLabels = {
  labelText: '#1f2430',
  labelDim: '#2c3340',
  labelHalo: 'rgba(245, 242, 234, 0.92)',
  labelHaloSoft: 'rgba(245, 242, 234, 0.55)',
  labelHaloSub: 'rgba(245, 242, 234, 0.75)',
  waterLabel: '#2a5a78',
  waterLabelOcean: '#1e4a68',
  labelMuted: '#5a6570',
  poiPark: '#1a6b3c',
  poiEducation: '#8a5a10',
  poiMedical: '#a02030',
  poiHalo: 'rgba(245, 242, 234, 0.9)'
};


// Label / admin colors copied from Mapbox streets-v11 symbol + admin layers.
// Applied only for basemap disasterdb-streets (see style.js paintColors).
// Other cartographic flavors keep cartoLightLabels / brand.
export const streetsV11Labels = {
  // road-label, settlement-label, state-label, country-label: hsl(0, 0%, 0%)
  labelText: 'hsl(0, 0%, 0%)',
  labelDim: 'hsl(0, 0%, 0%)',
  labelMuted: 'hsl(0, 0%, 0%)',
  labelHalo: 'hsl(0, 0%, 100%)',
  // water-point-label / waterway-label have no halo
  labelHaloSoft: 'hsla(0, 0%, 100%, 0)',
  labelHaloSub: 'hsl(0, 0%, 100%)',
  // settlement-subdivision-label
  labelSubdivision: 'hsl(230, 29%, 35%)',
  // water-point-label: lakes hsl(230, 48%, 44%), ocean/sea/bay hsl(205, 84%, 88%)
  waterLabel: 'hsl(230, 48%, 44%)',
  waterLabelOcean: 'hsl(205, 84%, 88%)',
  // poi-label common case (sizerank >= 5)
  poiPark: 'hsl(100, 100%, 20%)',
  poiEducation: 'hsl(51, 100%, 20%)',
  poiMedical: 'hsl(340, 39%, 42%)',
  poiDefault: 'hsl(26, 25%, 32%)',
  poiHalo: 'hsl(0, 0%, 100%)',
  // natural-point-label
  naturalLabel: 'hsl(26, 25%, 32%)',
  // admin-1 at z7, admin-1 low-z, admin-0
  boundaryLine: 'hsl(230, 8%, 62%)',
  boundaryLineAdm2: 'hsl(230, 14%, 77%)',
  boundaryLineHi: 'hsl(230, 8%, 51%)',
  stateOpacity: 1
};

// Label / admin colors copied from Mapbox outdoors-v11 symbol + admin layers.
// outdoors-v11 shares streets-v11 symbol paints (black settlement ink, white
// halo, park/education/medical POI hues). Applied only for disasterdb-topo.
// Sizes share the v11 ramps via style.js `v11` / `topo` flag.
export const outdoorsV11Labels = {
  // road-label, settlement-label, state-label, country-label: hsl(0, 0%, 0%)
  labelText: 'hsl(0, 0%, 0%)',
  labelDim: 'hsl(0, 0%, 0%)',
  labelMuted: 'hsl(0, 0%, 0%)',
  labelHalo: 'hsl(0, 0%, 100%)',
  // water-point-label / waterway-label have no halo
  labelHaloSoft: 'hsla(0, 0%, 100%, 0)',
  labelHaloSub: 'hsl(0, 0%, 100%)',
  // settlement-subdivision-label
  labelSubdivision: 'hsl(230, 29%, 35%)',
  // water-point-label: lakes hsl(230, 48%, 44%), ocean/sea/bay hsl(205, 84%, 88%)
  waterLabel: 'hsl(230, 48%, 44%)',
  waterLabelOcean: 'hsl(205, 84%, 88%)',
  // poi-label common case (sizerank >= 5)
  poiPark: 'hsl(100, 100%, 20%)',
  poiEducation: 'hsl(51, 100%, 20%)',
  poiMedical: 'hsl(340, 39%, 42%)',
  poiDefault: 'hsl(26, 25%, 32%)',
  poiHalo: 'hsl(0, 0%, 100%)',
  // natural-point-label
  naturalLabel: 'hsl(26, 25%, 32%)',
  // admin-1 at z7, admin-1 low-z, admin-0
  boundaryLine: 'hsl(230, 8%, 62%)',
  boundaryLineAdm2: 'hsl(230, 14%, 77%)',
  boundaryLineHi: 'hsl(230, 8%, 51%)',
  stateOpacity: 1
};

// Label / admin colors copied from Mapbox dark-v10.
// Applied only for basemap disasterdb-dark. Sizes are shared with streets
// (same Mapbox ramps) via style.js `v11`.
export const darkV10Labels = {
  // settlement-label large end (symbolrank < 11). Smaller ranks are 85% / 70%.
  labelDim: 'hsl(0, 0%, 90%)',
  labelText: 'hsl(0, 0%, 60%)',
  labelMuted: 'hsl(0, 0%, 78%)',
  // road-label
  roadLabel: 'hsl(0, 0%, 78%)',
  roadLabelMinor: 'hsl(0, 0%, 78%)',
  roadHalo: 'hsl(0, 0%, 13%)',
  // settlement halo. State uses the same 10% / 0.75.
  labelHalo: 'hsla(0, 0%, 10%, 0.75)',
  labelHaloSoft: 'hsla(0, 0%, 10%, 0)',
  labelHaloSub: 'hsla(0, 0%, 10%, 0.75)',
  labelSubdivision: 'hsl(0, 0%, 70%)',
  // state-label / country-label are dimmer than cities
  stateLabel: 'hsl(0, 0%, 50%)',
  countryLabel: 'hsl(0, 0%, 45%)',
  countryHalo: 'hsl(0, 0%, 10%)',
  // water-point-label and waterway-label are one gray, oceans included
  waterLabel: 'hsl(0, 0%, 45%)',
  waterLabelOcean: 'hsl(0, 0%, 45%)',
  // poi-label has no category hues in dark-v10
  poiPark: 'hsl(0, 0%, 60%)',
  poiEducation: 'hsl(0, 0%, 60%)',
  poiMedical: 'hsl(0, 0%, 60%)',
  poiDefault: 'hsl(0, 0%, 60%)',
  poiHalo: 'hsl(0, 0%, 13%)',
  naturalLabel: 'hsl(0, 0%, 85%)',
  // admin-0, admin-1 at z7, low-zoom admin
  boundaryLineHi: 'hsl(0, 0%, 43%)',
  boundaryLine: 'hsl(0, 0%, 35%)',
  boundaryLineAdm2: 'hsl(0, 0%, 27%)',
  stateOpacity: 1
};



// Label / admin colors from FireMap Navigation
// (disasterdb/cm17bo79203s201r722er0wsz ≈ navigation-night-v1).
// Applied only for basemap disasterdb-navigation. Sizes share the v11 ramps
// (nav ramps are slightly larger at high z; one Protomaps key cannot express
// major vs minor settlement split or sizerank).
export const navigationNightLabels = {
  // settlement-major/minor / state / country
  labelDim: 'hsl(215, 30%, 75%)',
  labelText: 'hsl(215, 30%, 75%)',
  labelMuted: 'hsl(215, 30%, 75%)',
  // road-label-navigation
  roadLabel: 'hsl(0, 0%, 90%)',
  roadLabelMinor: 'hsl(0, 0%, 90%)',
  roadHalo: 'hsl(213, 9%, 19%)',
  labelHalo: 'hsl(215, 20%, 25%)',
  // water labels use a soft dark halo in this style
  labelHaloSoft: 'hsla(215, 12%, 16%, 0.5)',
  labelHaloSub: 'hsla(215, 20%, 25%, 0.75)',
  labelSubdivision: 'hsl(215, 30%, 85%)',
  stateLabel: 'hsl(215, 30%, 75%)',
  countryLabel: 'hsl(215, 30%, 75%)',
  countryHalo: 'hsl(215, 20%, 25%)',
  // water-point-label: lakes hsl(197, 0%, 90%), ocean hsl(197, 11%, 63%)
  waterLabel: 'hsl(197, 0%, 90%)',
  waterLabelOcean: 'hsl(197, 11%, 63%)',
  // poi-label
  poiPark: 'hsl(150, 50%, 85%)',
  poiEducation: 'hsl(236, 50%, 95%)',
  poiMedical: 'hsl(0, 50%, 85%)',
  poiDefault: 'hsl(236, 50%, 95%)',
  poiHalo: 'hsl(215, 15%, 23%)',
  naturalLabel: 'hsl(236, 50%, 95%)',
  boundaryLineHi: 'hsl(250, 10%, 65%)',
  boundaryLine: 'hsl(250, 10%, 70%)',
  boundaryLineAdm2: 'hsl(250, 10%, 70%)',
  stateOpacity: 0.5
};

// Label / admin colors copied from Mapbox light-v10.
// Applied only for basemap disasterdb-light. Sizes share the v11 ramps.
export const lightV10Labels = {
  // settlement-label / country-label / road-label large end
  labelDim: 'hsl(0, 0%, 42%)',
  labelText: 'hsl(0, 0%, 42%)',
  labelMuted: 'hsl(0, 0%, 42%)',
  roadLabel: 'hsl(0, 0%, 42%)',
  roadLabelMinor: 'hsl(0, 0%, 42%)',
  labelHalo: 'hsl(0, 0%, 100%)',
  labelHaloSoft: 'hsla(0, 0%, 100%, 0)',
  labelHaloSub: 'hsl(0, 0%, 100%)',
  labelSubdivision: 'hsl(0, 0%, 62%)',
  // state-label is lighter than cities
  stateLabel: 'hsl(0, 0%, 66%)',
  countryLabel: 'hsl(0, 0%, 42%)',
  // water-point-label and waterway-label
  waterLabel: 'hsl(187, 7%, 51%)',
  waterLabelOcean: 'hsl(187, 7%, 51%)',
  // poi-label common case hsl(230, 0%, 56%) — no category hues
  poiPark: 'hsl(0, 0%, 56%)',
  poiEducation: 'hsl(0, 0%, 56%)',
  poiMedical: 'hsl(0, 0%, 56%)',
  poiDefault: 'hsl(0, 0%, 56%)',
  poiHalo: 'hsl(0, 0%, 100%)',
  naturalLabel: 'hsl(0, 0%, 42%)',
  boundaryLineHi: 'hsl(0, 0%, 62%)',
  boundaryLine: 'hsl(0, 0%, 70%)',
  boundaryLineAdm2: 'hsl(0, 0%, 80%)',
  stateOpacity: 1
};

// Label / admin colors: grayscale reading of Mapbox light-v10 (PR #125).
// Same lightness stops as lightV10Labels; residual hue (water) zeroed.
// Applied only for basemap disasterdb-gray. Sizes share the v11 / light ramps.
export const grayLightV10Labels = {
  labelDim: 'hsl(0, 0%, 42%)',
  labelText: 'hsl(0, 0%, 42%)',
  labelMuted: 'hsl(0, 0%, 42%)',
  roadLabel: 'hsl(0, 0%, 42%)',
  roadLabelMinor: 'hsl(0, 0%, 42%)',
  labelHalo: 'hsl(0, 0%, 100%)',
  labelHaloSoft: 'hsla(0, 0%, 100%, 0)',
  labelHaloSub: 'hsl(0, 0%, 100%)',
  labelSubdivision: 'hsl(0, 0%, 62%)',
  stateLabel: 'hsl(0, 0%, 66%)',
  countryLabel: 'hsl(0, 0%, 42%)',
  // light-v10 water hsl(187, 7%, 51%) → gray
  waterLabel: 'hsl(0, 0%, 51%)',
  waterLabelOcean: 'hsl(0, 0%, 51%)',
  poiPark: 'hsl(0, 0%, 56%)',
  poiEducation: 'hsl(0, 0%, 56%)',
  poiMedical: 'hsl(0, 0%, 56%)',
  poiDefault: 'hsl(0, 0%, 56%)',
  poiHalo: 'hsl(0, 0%, 100%)',
  naturalLabel: 'hsl(0, 0%, 42%)',
  boundaryLineHi: 'hsl(0, 0%, 62%)',
  boundaryLine: 'hsl(0, 0%, 70%)',
  boundaryLineAdm2: 'hsl(0, 0%, 80%)',
  stateOpacity: 1
};

// ---------------------------------------------------------------------------
// Typography — LEXEND, read straight off your Mapbox Studio style
//
// Pulled from api.mapbox.com for style disasterdb/cmaycljer005l01sy9qzodnrb
// ("Satellite 3D FireMap"). The earlier assumption that Studio meant DIN Pro
// was wrong, and wrong in your favour: you are on Lexend, which is SIL OFL and
// therefore fully portable. Nothing about your type has to change to leave
// Mapbox. The five weights below are exactly the five your style uses.
//
// Glyphs come from fonts.openmaptiles.org, which hosts prebuilt SDF ranges for
// the Google Fonts library — all five Lexend weights verified present.
//
// PRODUCTION CAVEAT, same shape as the Protomaps one: this is a free community
// endpoint, not a CDN you have a contract with. Before launch, generate your
// own at https://maplibre.org/font-maker/ (upload the Lexend TTFs from Google
// Fonts), drop the output in public/fonts/, and change `glyphs` to
// '/fonts/{fontstack}/{range}.pbf'. Nothing else moves.
//
// SILENT FAILURE: these strings must match the glyph folder names EXACTLY,
// capitals and spaces included. "Lexend ExtraLight" works; "Lexend Extra Light"
// and "Lexend-ExtraLight" both give you a map with no labels and no error.
// ---------------------------------------------------------------------------

export const fonts = {
  // SELF-HOSTED, and it has to be.
  //
  // This previously pointed at fonts.openmaptiles.org. That service is
  // decommissioned: it answers HTTP 200 with a 2.7 KB HTML page for EVERY
  // path — "Lexend Medium", "Totally Fake Font", anything. MapLibre logs
  // nothing for that and silently falls back to another face, so the map
  // rendered every label in the wrong font with a clean console. If a font
  // ever looks wrong again, fetch a glyph URL by hand and check that what
  // comes back is a protobuf and not a web page.
  //
  // These are built from the real Lexend variable TTF by tools/make_glyphs.py.
  // Re-run that script if you add a weight or a unicode range.
  glyphs: `${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`,

  // Weight -> where your Studio style uses it:
  black:      ['Lexend Black'],       // POIs, airports, transit, natural features
  bold:       ['Lexend Bold'],        // state / province labels
  medium:     ['Lexend Medium'],      // settlements, countries, continents
  regular:    ['Lexend Regular'],     // road and path labels
  extraLight: ['Lexend ExtraLight'],  // all water labels

  // --- Renderer compensation ---------------------------------------------
  // Studio specifies "Lexend Medium" for settlements, countries and
  // neighbourhoods, and that is what this file used. Rendered side by side at
  // the same zoom, MapLibre's output came out visibly LIGHTER than Mapbox's.
  //
  // ORIGINAL DIAGNOSIS WAS WRONG, and the real cause is now fixed: the map had
  // no Lexend glyphs at all (fonts.openmaptiles.org is dead — see `glyphs`
  // above) and was silently falling back to another face. Everything is real
  // Lexend now.
  //
  // What remains is smaller and genuinely a renderer difference: Mapbox GL v3
  // applies "emissive strength" lighting to labels — visible in every Studio
  // panel as "1 intensity" — which MapLibre has no equivalent for, so labels
  // here are lit flat and read slightly lighter at the same weight.
  //
  // Studio's literal value is Medium. Judge them side by side now that the
  // font is correct and pick; this is a one-line change either way.
  //
  // Stepping up one weight matches the rendered appearance. This is a
  // DELIBERATE DEVIATION from the style JSON: the literal value is Medium.
  // Set this back to ['Lexend Medium'] to be spec-faithful and lighter.
  settlement: ['Lexend SemiBold'],

  // Same reasoning — Studio says 1px, but its halo reads stronger than
  // MapLibre's at the same value.
  settlementHaloWidth: 1.4,

  // UI chrome (not the map). Now Lexend too, so the panel matches the map.
  ui: "'Lexend', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
};

// ---------------------------------------------------------------------------
// Data endpoints
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Which Blue Marble to draw at low zoom. All three are NASA GIBS, z0-8, public
// domain, and swap cleanly — change this one word and reload.
//
//   BlueMarble_NextGeneration
//     True-colour photography. What a satellite actually sees: flat, no relief
//     shading, oceans a uniform dark blue.
//
//   BlueMarble_ShadedRelief
//     Same imagery with hillshading burned in. Mountain ranges get form and
//     direction — the Andes, Himalaya and Rockies read as terrain rather than
//     as brown smudges. Oceans stay flat.
//
//   BlueMarble_ShadedRelief_Bathymetry   <-- topography, and the current pick
//     Hillshading on land AND sea-floor relief in the oceans. The classic
//     physical-globe look: trenches, ridges and continental shelves visible.
//     The most three-dimensional of the three at a whole-planet view, which is
//     where this layer actually gets used.
// ---------------------------------------------------------------------------

const blueMarbleLayer = 'BlueMarble_ShadedRelief_Bathymetry';

export const sources = {
  // Vector basemap: Protomaps' daily planet build (~137 GB, read over HTTP
  // range requests — PMTiles only pulls the few KB it actually needs).
  //
  // PROTOTYPE ENDPOINT, AND IT EXPIRES. This channel keeps roughly a week of
  // builds and Protomaps asks people not to hotlink it, so this date WILL
  // start 404ing and the vector overlay will silently vanish. Current builds
  // are listed at https://build-metadata.protomaps.dev/builds.json — bump the
  // date to un-break it. The real fix is README step 8: pmtiles extract a
  // regional slice into your own R2 bucket.
  //
  // (The older https://demo-bucket.protomaps.com/v4.pmtiles is dead — 404.)
  // YOUR OWN TILES, on your own R2 bucket. Global Protomaps v4, z0–15.
  //
  // build.protomaps.com is NOT a fallback — it allowlists exactly one origin
  // (http://localhost:5173) and refuses everything else, so it could never
  // have worked from a real domain. See R2-DEPLOY.md.
  //
  // THIS IS THE r2.dev DEV URL. Cloudflare rate-limits it and says explicitly
  // not to use it in production. Once disasterdb.com's nameservers move to
  // Cloudflare, attach tile.disasterdb.com to the bucket and change this to:
  //   'https://tile.disasterdb.com/disasterdb-planet-z15.pmtiles'
  //
  // Header re-validated: PMTiles v3, maxzoom 15 (was briefly zeroed; z12 stays
  // in the bucket as fallback). Client points at z15 only.
  // Rebuild/refresh: tools/bin/pmtiles.exe extract ... then pmtiles upload.
  basemapPMTiles:
    'https://pub-2a3163bf2e4a4cbabab542c736fcd7cf.r2.dev/disasterdb-planet-z15.pmtiles',

  // Mid-zoom imagery. EOX Sentinel-2 cloudless — CURRENTLY DISABLED.
  //
  // Turned off via `sentinel.enabled` below rather than deleted, because the
  // endpoint and its whole configuration are still correct; it is the LICENCE
  // that fails. The 2024 vintage is CC-BY-NC-SA, i.e. non-commercial only, and
  // Fire Map Live is a commercial product.
  //
  // To bring it back you need one of:
  //   - the 2016 vintage: change '2024' to '2016' here (CC-BY-4.0, usable), or
  //   - a commercial licence from cloudless@eox.at, which also permits
  //     mirroring so you could self-host and bake the colour grade in.
  satelliteTiles:
    'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',

  // Low-zoom imagery. NASA Blue Marble via GIBS. Same {z}/{y}/{x} order as EOX.
  //
  // Which variant you get is `blueMarbleLayer` above — that is the only thing
  // to change. All three are z0-8 and public domain.
  //
  // Why it's here: it is US-Government PUBLIC DOMAIN, so the zoom levels where
  // you show the whole planet carry no license question at all — unlike the
  // Sentinel-2 layer above. It is also small enough to mirror into R2 outright
  // (nine zoom levels, ~350 MB) if you'd rather not lean on GIBS in
  // production; GIBS sends `Cache-Control: no-store` and is a courtesy, not a
  // CDN you have a contract with.
  //
  // GIBS serves z0-8 for this layer. z9 returns HTTP 400, not an empty tile.
  blueMarbleTiles:
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${blueMarbleLayer}` +
    '/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',

  // Terrain DEM TileJSON (Mapterhorn). Free CDN; encoding terrarium, tileSize 512.
  terrainTileJSON: 'https://tiles.mapterhorn.com/tilejson.json',

  // Terrarium-encoded DEM XYZ — interim Mapterhorn CDN (was AWS Joerd; too slow).
  // encoding: 'terrarium', tileSize: 512 (see terrariumTileSize).
  // NEXT: own R2 Americas extract PMTiles on tile.disasterdb.com; drop CDN.
  terrariumTiles: 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',
  /** MapLibre raster-dem + maplibre-contour must match TileJSON tileSize. */
  terrariumTileSize: 512,
  // Native DEM zoom; hillshade layer has no maxzoom so MapLibre overzooms past this.
  // Contour source keeps its own maxzoom / thresholds (unchanged).
  terrariumMaxzoom: 15
};

// ---------------------------------------------------------------------------
// Deep zoom: Amazon Location Service, Maps v2 "Dynamic Maps"
//
// Sentinel-2 runs out of resolution at z14 (10 m/px). Above that this takes
// over with sub-metre commercial imagery.
//
// THIS ONE COSTS MONEY, PER TILE, FOREVER. $0.04 per 1,000 tiles, flat, no
// volume tiers — that is straight off the AWS Price List API, usage type
// `Usage-Default-Maps-Tiles`. It is also the one source in this style you may
// not mirror into R2: you are buying access to licensed Esri/HERE imagery, so
// every view is billed at origin and there is no caching escape hatch.
//
// The only real cost lever is `awsFadeStart` in `handoff` below. The layer's
// minzoom is pinned to it, so no tile is requested — and nothing is billed —
// until someone zooms past that level. Raise it to cut the bill; lower it to
// widen the sharp band. Watch the number in Cost Explorer before you trust any
// estimate, including mine.
//
// Path order is {z}/{x}/{y} — X BEFORE Y. Every other raster source in this
// file is {z}/{y}/{x}. Get this wrong and you get plausible-looking imagery of
// the wrong place, which is much worse than a blank tile.
// ---------------------------------------------------------------------------

export const awsLocation = {
  // Leave empty to disable. With no key the layer is not added to the style at
  // all, so nothing 403s and nothing is billed — the map just tops out at
  // Sentinel-2, exactly as it did before.
  //
  // Make one in the AWS console: Amazon Location Service -> API keys. Restrict
  // it by HTTP referer to https://app.disasterdb.com (plus localhost for dev) before it goes public — an
  // unrestricted key on a map this size is someone else's free imagery budget.
  apiKey:
    '',  // inject via gitignored src/theme.local.js — never commit a live key,

  // Pick the region you actually enabled the key in. The key is scoped to its
  // region — point this at the wrong one and every tile 403s.
  region: 'ca-central-1',

  // raster.satellite | vector.basemap | vector.traffic | raster.dem
  tileset: 'raster.satellite',

  // If imagery comes in exactly one zoom level too coarse or too fine, this is
  // the knob — AWS has not documented the raster tile edge length and 512 is
  // the modern default. Flip to 256 and reload.
  tileSize: 512,

  // ALS publishes imagery well past this; 19 is where it stops being useful
  // for wildfire context and starts being a bill.
  maxzoom: 19
};

// ---------------------------------------------------------------------------
// Imagery colour grade
//
// Raw Sentinel-2 is flat and cool — it is a science product, not a basemap.
// Mapbox Satellite looks better because it is *graded*: shadows lifted, warmth
// and contrast pushed. These four knobs do the same thing at render time.
//
// What each one does (MapLibre raster paint properties, all live-tunable from
// the console — see below):
//
//   brightnessMin  Lifts the black point. THE important one for Sentinel-2:
//                  dark conifer forest and burn scars otherwise crush to near
//                  black, which is exactly the terrain a wildfire map is about.
//   brightnessMax  Drops the white point. Below 1 to stop snow and bare rock
//                  blowing out once contrast is up.
//   contrast       -1..1. Adds punch, but costs you shadow detail.
//   saturation     -1..1. Sentinel-2 shipped desaturated (-0.08) in the first
//                  draft, which fought the Mapbox look rather than chasing it.
//
// To tune without editing files, in the browser console:
//   map.setPaintProperty('satellite', 'raster-brightness-min', 0.14)
// then copy whatever you land on back in here.
// ---------------------------------------------------------------------------

export const grade = {
  // Graded toward the Mapbox Satellite look: warmer, brighter, punchier.
  sentinel2: {
    brightnessMin: 0.10,
    brightnessMax: 0.96,
    contrast:      0.16,
    saturation:    0.18
  },

  // Esri/HERE imagery arrives already graded for consumer maps, so this needs
  // far less. Kept non-zero only so the z13-15 dissolve doesn't visibly shift
  // colour halfway through — the two layers should meet looking alike.
  awsSatellite: {
    brightnessMin: 0.04,
    brightnessMax: 1,
    contrast:      0.06,
    saturation:    0.08
  },

  // Blue Marble is already a finished cartographic product. Left flat on
  // purpose; grading it just makes the shaded relief muddy.
  blueMarble: {
    brightnessMin: 0,
    brightnessMax: 1,
    contrast:      0,
    saturation:    0
  }
};

// ---------------------------------------------------------------------------
// Imagery handoff
//
// Blue Marble underneath, Sentinel-2 fading in on top of it. Between fadeStart
// and fadeEnd both are drawn and S2 ramps 0 -> 1, so the swap reads as a
// dissolve rather than a cut.
//
// Outside that band only one source is fetched: below fadeStart the S2 layer
// is off (layer minzoom), above blueMarbleCutoff the Blue Marble layer is off
// (layer maxzoom). A raster layer at opacity 0 still downloads its tiles —
// only minzoom/maxzoom actually stops the requests, which is the whole point.
//
// Tune to taste. Widen the band for a softer dissolve; set fadeStart ===
// fadeEnd for a hard cut.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sentinel-2 on/off
//
// One flag, so removing a whole imagery tier doesn't mean deleting code you'll
// want back. False: the source and layer are never added to the style, nothing
// is requested, and Blue Marble hands straight to Amazon Location.
// ---------------------------------------------------------------------------

export const sentinel = { enabled: false };

export const handoff = {
  fadeStart: 4.5,   // S2 starts appearing, Blue Marble still fully opaque
  fadeEnd:   6.5,   // S2 fully opaque

  // Blue Marble stops drawing here.
  //
  // WITH SENTINEL-2 OFF this is doing more work than it used to. GIBS has no
  // data above z8, so from z8 up to awsFadeStart the Blue Marble tiles are
  // being OVERZOOMED — magnified, and visibly soft. That band (roughly z8-10)
  // is the hole the Sentinel-2 layer used to fill, and it's the gap whatever
  // you replace it with needs to cover.
  //
  // Lowering awsFadeStart closes the gap immediately, but Amazon Location is
  // billed per tile and z8-10 is a lot of traffic, so that trade is left to
  // you rather than made here.
  blueMarbleCutoff: 10,

  // Second handoff: Sentinel-2 -> Amazon Location. Same mechanics, but this
  // boundary is a billing boundary, not just a visual one. No ALS tile is
  // fetched below awsFadeStart.
  //
  // WAS 13 -> 15, chosen to sit just under Sentinel-2's native ceiling. Moved
  // down to 10 -> 11.5 because s2cloudless looks poor from about z10 up: it is
  // an annual median composite, so vegetation goes muddy and mosaic seams show.
  // Sentinel-2 now only bridges z6.5 -> 11.5.
  //
  // COST: this is not a free change. Tiles-per-view barely moves, but the
  // SHARE OF SESSIONS that touch the paid layer moves a lot — most people
  // looking at a fire sit between z8 and z13. Expect a large multiple of the
  // z13 bill, not a small increment. The 500k free tiles will show you the
  // real ratio before you owe anything.
  awsFadeStart: 10,
  awsFadeEnd:   11.5
};

// ---------------------------------------------------------------------------
// GeoColor product — Path B (owned CDN)
//
// Live East contract (Rob 2026-09-14) — standard MapLibre XYZ {z}/{x}/{y}:
//   {baseUrl}/geocolor/goes-east/{ymd}/{hhmm}/{z}/{x}/{y}.png
//   {ymd}  = YYYY-MM-DD UTC
//   {hhmm} = 4-digit UTC on 10-minute cadence (2310, 2320)
//
// Prod host: https://sat.disasterdb.com  (also Bunny: https://geocolor.b-cdn.net)
// times.json + latest.json live on sat.disasterdb.com (Bunny).
//
// GOES-East is wired live via goes.js (goesEast.owned). This Path B stub stays
// OFF until a single Americas mosaic (or explicit product toggle) is ready.
// See docs/geocolor.md.
// ---------------------------------------------------------------------------

export const geocolor = {
  enabled: false,
  // Live owned CDN root (no trailing slash). Stub idle while enabled=false.
  baseUrl: 'https://sat.disasterdb.com',
  // Alternate Bunny pull zone: https://geocolor.b-cdn.net
  pathPrefix: '/geocolor/goes-east',
  // Prefer goesGeocolor.timesJson; kept for older geocolor stub callers.
  timesPath: '/geocolor/times.json',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 6
};


// ---------------------------------------------------------------------------
// GOES East/West GeoColor overlays
//
// East: owned sat.disasterdb.com GeoColor (GOES-19) — live 2026-09-14.
// West: owned sat.disasterdb.com GeoColor (GOES-18) — live 2026-09-15.
// East + West + Meteosat + Himawari + GK2A ON by default on cold start. Embed forces OFF.
// Owned DisasterDB geocolor stack.
// ---------------------------------------------------------------------------

/** Shared GeoColor timing / defaults (East + West). */
export const goesGeocolor = {
  // Manifest of last-good frame per sat (server-written). One fetch replaces
  // client-side 404 step-back probes — much faster cold start.
  // Direct Bunny latest.json (CORS enabled on pull zone geocolor).
  // public/geocolor-latest.php remains as optional same-origin fallback —
  // Hostinger outbound proxy was stale; default is direct.
  latestJson: 'https://sat.disasterdb.com/geocolor/latest.json',
  // Per-sat unix lists (bake history). Tip test scrubber uses last `hours`.
  timesJson: 'https://sat.disasterdb.com/geocolor/times.json',
  // Default = latest only. ?scrub=1 shows bottom transport for last ~gkPlayHours of GK2A.
  hours: 1,
  stepMinutes: 10,
  // Cold-start: East + West ON (non-embed). Embed forces both OFF.
  // Toolbar sat-mode button mirrors this (pressed when either layer on).
  defaultOn: true,
  // West follows defaultOn when true (HTML + applyEmbedMode).
  westDefaultOn: true,
  // Meteosat (MSG) Europe/Africa — same Bunny contract as GOES.
  meteosatDefaultOn: true,
  // Himawari (AHI) Asia-Pacific — parked for now (GK2A covers Korea–EA).
  himawariDefaultOn: false,
  // GK2A (GEO-KOMPSAT-2A / AMI) Korea–East Asia — same Bunny contract.
  // Overlaps Himawari; same zoom fade for now (tune later if needed).
  gk2aDefaultOn: true,
  // GK2A bottom time transport off by default (Rob 2026-09-21/24).
  // Opt-in: toolbar Satellite button, timeSlider true, or ?scrub=1
  // → bottom-center play + scrub (~4h, loops). Button gates UX; query is deep-link.
  timeSlider: false,
  // Play knobs (defaults in goes.js): hours is primary; frames is optional cap.
  // gkPlayHours: 4,          // → 6 for a longer pass; uses times.json slots only
  // gkPlayFrames: 36,        // optional hard cap (#77 leftover; omit to use hours)
  // gkPlayIntervalMs: 700,   // ~700ms/step ≈ 15–17s for a 4h pass

  // Fallback if fade expression cannot be built.
  overlapOpacity: 1,
  // Full-strength until a short dissolve into topo-only at cutoff.
  // Cutoff: mobile 8.3 / desktop 7.8 (tunable). Opacity fade is cheap;
  // layer maxzoom=cutoff also stops overzoom draws.
  fade: {
    mobileCutoff: 8.3,
    desktopCutoff: 7.8,
    mobileQuery: '(max-width: 768px), (pointer: coarse)',
    // Stay at fullOpacity until (cutoff - fadeSpan), then linear → 0.
    fullOpacity: 1,
    fadeSpan: 0.55
  },
  // Identity grade — show CDN tiles as baked (raw TIFF→PNG). The old
  // "fuzzy cloud" knobs (brightnessMax 0.86, contrast -0.14, sat -0.06)
  // washed Himawari/GOES vs downloads; Rob asked map to match tiles (2026-09-20).
  // Zoom fade still lives in fade{} / goesOpacityByZoom — not color grade.
  cloudGrade: {
    brightnessMin: 0,
    brightnessMax: 1,
    contrast: 0,
    saturation: 0,
    resampling: 'linear'
  }
};

/** Owned GOES-East GeoColor on sat.disasterdb.com (Bunny). Not GIBS. */
export const goesEast = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  // Also on Bunny: https://geocolor.b-cdn.net
  pathPrefix: '/geocolor/goes-east',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  // Step back N×10 min when the floored "now" frame 404s
  // (upload lag / overnight gaps / stalled bake). 36 → 6 hours.
  frameRetrySlots: 36
};

/** Owned GOES-West GeoColor on sat.disasterdb.com (Bunny). Not GIBS.
 *  East-of-IDL half (Hawaii / E Pacific / EW fade onto East). */
export const goesWest = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  // Also on Bunny: https://geocolor.b-cdn.net
  pathPrefix: '/geocolor/goes-west',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  // Same last-good lookback as East (36 × 10 min ≈ 6 hours).
  frameRetrySlots: 36
};

/** Owned GOES-West date-line-west half (west-of-IDL sliver into GK2A).
 *  Separate CDN tiler; client merges with goes-west via one MapLibre source
 *  (family seam protocol) so IDL neighbors do not feather across sources.
 *  Frame stamp: reuse goes-west ymd/hhmm until latest.json grows a widl key. */
export const goesWestWidl = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  pathPrefix: '/geocolor/goes-west-widl',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

// Client-only GOES linear seam fades. Shared width 5.625°.
// Cook/land ownership unchanged — client alpha only. Himawari untouched.
//
// East↔West: cut −132.5 → band [−135.3125, −129.6875]. Fade GOES-West (western).
// Measured dual-coverage ~[−135, −130].
export const GOES_EW_CUT_LON = -132.5;
// East↔Meteosat: cut −27.1875 → band [−30, −24.375]. Fade GOES-East (western).
// Overlap measured ~[−29.0, −25.3] (live tile alpha probe).
export const GOES_EM_CUT_LON = -27.1875;
// Meteosat↔GK2A: cut 61.875 → band [59.0625, 64.6875]. Fade Meteosat (western).
// Overlap measured ~[58.0, 65.0] (live tile alpha probe).
export const GOES_MG_CUT_LON = 61.875;
// GOES-West↔GK2A (western Pacific / near IDL): cut 169 → band [166.1875, 171.8125].
// Dual-coverage overlap measured ~[163, 175] (live Bunny column-alpha, all lats;
// mid = 169). Same MG technique: cut at mid-overlap, width 5.625°.
// Lives on goes-west-widl (date-line-west half). goes-west keeps only the
// east-of-IDL / Hawaii half and the EW fade onto East.
// Visual priority: GK2A (western of pair). Stack keeps widl above GK2A, so widl
// (eastern of pair) is alpha-modulated: 0 west of band → 1 east of band.
export const GOES_WG_CUT_LON = 169;
// Shared linear fade width (cut ± width/2). Pure linear — no cosine.
export const GOES_EW_FADE_WIDTH = 5.625;

/** Owned Meteosat GeoColor on sat.disasterdb.com (Bunny). Same path shape as GOES. */
export const goesMeteosat = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  pathPrefix: '/geocolor/meteosat',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

/** Owned Himawari GeoColor on sat.disasterdb.com (Bunny). Same path shape as GOES. */
export const goesHimawari = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  pathPrefix: '/geocolor/himawari',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

/** Owned GK2A GeoColor on sat.disasterdb.com (Bunny). Same path shape as GOES/Himawari. */
export const goesGk2a = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  // Also: https://geocolor.b-cdn.net/geocolor/gk2a/...
  pathPrefix: '/geocolor/gk2a',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

// ---------------------------------------------------------------------------
// Shared OSM Photon geocoder (Girder). Base URL only — client appends /api?q=&limit=.
// Default HTTPS host works on prod/staging without an Actions secret.
// Override at build time with VITE_GEOCODER_URL (or GEOCODER_URL).
// Local Vite can proxy via /geocode (see vite.config.js) if you set
// VITE_GEOCODER_URL=/geocode.
// ---------------------------------------------------------------------------

export const geocoderUrl = 'https://geocode.disasterdb.com';

// ---------------------------------------------------------------------------
// Attribution — these are license conditions, not courtesies. Keep them.
// ---------------------------------------------------------------------------

export const attribution = {
  osm: '<a href="https://openstreetmap.org/copyright">© OpenStreetMap</a> contributors',
  protomaps: '<a href="https://github.com/protomaps/basemaps">Protomaps</a>',
  eox:
    '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by ' +
    '<a href="https://eox.at">EOX IT Services GmbH</a> ' +
    '(Contains modified Copernicus Sentinel data 2024)',

  // Public domain, so this one is courtesy rather than obligation — but NASA
  // asks for it and it costs nothing.
  nasa:
    '<a href="https://visibleearth.nasa.gov/collection/1484/blue-marble">' +
    'Blue Marble Next Generation</a>, NASA Earth Observatory',

  // Contractual, not optional — this is licensed third-party imagery.
  aws: '&copy; <a href="https://aws.amazon.com/location/">Amazon Location Service</a>',

  // Owned GeoColor tiles on sat.disasterdb.com (DisasterDB bake, not CIRA).
  // Mosaic chip via AttributionControl.customAttribution (extent-aware) —
  // do not bake sector credits into raster source.attribution (double-stack).
  mosaicCopyright: '\u00A9 DisasterDB',
  sectorEast: 'NOAA GOES-East',
  sectorWest: 'NOAA GOES-West',
  sectorMeteosat: 'EUMETSAT Meteosat',
  sectorGk2a: 'KMA GK2A',

  geocolor:
    'DisasterDB GeoColor',

  // Legacy per-source strings (unused once mosaic customAttribution is live).
  ownedGoesEast:
    'DisasterDB GeoColor · NOAA GOES-19',

  ownedGoesWest:
    'DisasterDB GeoColor · NOAA GOES-18',

  ownedGoesWestWidl:
    'DisasterDB GeoColor · NOAA GOES-18',

  ownedMeteosat:
    'DisasterDB GeoColor · EUMETSAT Meteosat',

  ownedHimawari:
    'DisasterDB GeoColor · JMA Himawari',

  ownedGk2a:
    'DisasterDB GeoColor · KMA GK2A',

  // Legacy interim GIBS string — unused now that West is owned.
  gibsGoes:
    'Imagery © <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> / ESDIS ' +
    '(GOES-West ABI GeoColor interim). Not an endorsement by NASA.',

  // Terrarium DEM (cartographic hillshade / contours). Interim Mapterhorn CDN.
  // Required credits: Mapterhorn (+ their open-data sources via attribution page).
  mapterhorn:
    'Elevation <a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'
};

