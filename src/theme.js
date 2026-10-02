// Lean EarthMap theme — OSM under GeoColor + hillshade/contours (App #114).
// GOES / seam / transport knobs mirrored from disasterdb-app theme.js.
// No FireMap branding / wildfire chrome.

export const CONTOUR_LINES_LAYER_ID = 'contour-lines';
export const CONTOUR_LABELS_LAYER_ID = 'contour-labels';
export const HILLSHADE_LAYER_ID = 'hillshade';

// Preferred beforeId fallbacks (App goes.js). EarthMap may lack these layers.
export const SAT_ROADS_LAYER_ID = 'roads-simple';
export const BOUNDARY_BEFORE_ID = 'coastline-casing';
export const BOUNDARY_LAYER_IDS = [
  'coastline-casing',
  'coastline',
  'boundary-adm2',
  'boundary-region',
  'boundary-country-casing',
  'boundary-country'
];

export const sources = {
  basemapPMTiles:
    'https://pub-2a3163bf2e4a4cbabab542c736fcd7cf.r2.dev/disasterdb-planet-z15.pmtiles',
  terrariumTiles: 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',
  terrariumTileSize: 512,
  terrariumMaxzoom: 15
};

export const hillshade = {
  method: 'igor',
  shadow: 'rgba(0, 0, 0, 0.42)',
  highlight: 'rgba(255, 255, 255, 0.28)',
  exaggeration: 0.35
};

export const waterFillOpacity = 0.65;
export const waterLineOpacity = 1;

/** Contour thresholds from App #114 — lines from z4 for sat-live. */
export const contours = {
  multiplier: 1,
  layer: 'contours',
  elevationKey: 'ele',
  levelKey: 'level',
  thresholds: {
    4: [2000, 8000],
    6: [1000, 4000],
    8: [500, 2000],
    10: [250, 1000],
    12: [100, 500],
    14: [50, 200],
    15: [25, 100]
  },
  lineColor: 'rgba(255, 236, 200, 0.42)',
  lineColorMajor: 'rgba(255, 230, 180, 0.72)',
  labelColor: '#f5ead0',
  labelHalo: 'rgba(10, 16, 28, 0.85)'
};

export const attribution = {
  protomaps: '<a href="https://github.com/protomaps/basemaps">Protomaps</a>',
  osm: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
  mapterhorn:
    'Elevation <a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
  geocolor: 'GeoColor © NOAA / EUMETSAT / KMA · DisasterDB',
  mosaicCopyright: '\u00A9 DisasterDB',
  sectorEast: 'NOAA GOES-East',
  sectorWest: 'NOAA GOES-West',
  sectorMeteosat: 'EUMETSAT Meteosat',
  sectorGk2a: 'KMA GK2A',
  ownedGoesEast: 'DisasterDB GeoColor · NOAA GOES-19',
  ownedGoesWest: 'DisasterDB GeoColor · NOAA GOES-18',
  ownedGoesWestWidl: 'DisasterDB GeoColor · NOAA GOES-18',
  ownedMeteosat: 'DisasterDB GeoColor · EUMETSAT Meteosat',
  ownedHimawari: 'DisasterDB GeoColor · JMA Himawari',
  ownedGk2a: 'DisasterDB GeoColor · KMA GK2A'
};

/** Shared GeoColor timing / defaults (ported from App). */
export const goesGeocolor = {
  latestJson: 'https://sat.disasterdb.com/geocolor/latest.json',
  timesJson: 'https://sat.disasterdb.com/geocolor/times.json',
  hours: 1,
  stepMinutes: 10,
  defaultOn: true,
  westDefaultOn: true,
  meteosatDefaultOn: true,
  himawariDefaultOn: false,
  gk2aDefaultOn: true,
  // EarthMap is GEO-primary — show bottom transport by default.
  timeSlider: true,
  overlapOpacity: 1,
  fade: {
    mobileCutoff: 8.3,
    desktopCutoff: 7.8,
    mobileQuery: '(max-width: 768px), (pointer: coarse)',
    fullOpacity: 1,
    fadeSpan: 0.55
  },
  cloudGrade: {
    brightnessMin: 0,
    brightnessMax: 1,
    contrast: 0,
    saturation: 0,
    resampling: 'linear'
  }
};

export const goesEast = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  pathPrefix: '/geocolor/goes-east',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

export const goesWest = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  pathPrefix: '/geocolor/goes-west',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

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
export const GOES_EW_CUT_LON = -132.5;
export const GOES_EM_CUT_LON = -27.1875;
export const GOES_MG_CUT_LON = 61.875;
export const GOES_WG_CUT_LON = 169;
export const GOES_EW_FADE_WIDTH = 5.625;

export const goesMeteosat = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  pathPrefix: '/geocolor/meteosat',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

export const goesHimawari = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  pathPrefix: '/geocolor/himawari',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

export const goesGk2a = {
  owned: true,
  baseUrl: 'https://sat.disasterdb.com',
  pathPrefix: '/geocolor/gk2a',
  maxzoom: 7,
  tileSize: 256,
  refreshMs: 60 * 1000,
  frameRetrySlots: 36
};

/** Legacy tip helper used by older geocolor.js (kept for tooling). */
export const GEOCOLOR = {
  latest: 'https://sat.disasterdb.com/geocolor/latest.json',
  base: 'https://sat.disasterdb.com/geocolor',
  sats: [
    { id: 'gk2a', sourceId: 'em-gk2a', layerId: 'em-gk2a', bounds: [58, -70, 175, 75], opacity: 0.92 },
    { id: 'meteosat', sourceId: 'em-meteosat', layerId: 'em-meteosat', bounds: [-29, -40, 65, 65], opacity: 0.95 },
    { id: 'goes-east', sourceId: 'em-goes-east', layerId: 'em-goes-east', bounds: [-136, -55, -23, 65], opacity: 0.95 },
    { id: 'goes-west', sourceId: 'em-goes-west', layerId: 'em-goes-west', bounds: [-180, -55, -130, 65], opacity: 0.95 }
  ]
};
