// Lean EarthMap theme — OSM under GeoColor + hillshade/contours (App #114 patterns).
// No FireMap branding / wildfire chrome.

export const CONTOUR_LINES_LAYER_ID = 'contour-lines';
export const CONTOUR_LABELS_LAYER_ID = 'contour-labels';
export const HILLSHADE_LAYER_ID = 'hillshade';

export const sources = {
  // DisasterDB planet PMTiles (same as App sat-live / topo)
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
  // Slightly brighter over sat imagery than pure topo browns
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
  geocolor: 'GeoColor © NOAA / EUMETSAT / KMA · DisasterDB'
};

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
