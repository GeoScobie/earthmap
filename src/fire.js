// ---------------------------------------------------------------------------
// Fire Map Live incident layers
//
// Ported from the existing Mapbox implementation (FireMapStaging/script-test.js).
// The data all comes from your own GeoServer at geo.firemap.live, workspace
// `FireDB`, which serves:
//
//   * MVT vector tiles through GeoWebCache (WMTS), and
//   * GeoJSON through WFS.
//
// Prefer the MVT endpoints. The WFS ones return the entire global result set in
// one response — `combined_fire_pt_active` is 2.5 MB and 7,435 features — which
// is fine for a page that loads it once but wasteful per view. The tiled
// equivalents are ~2-8 KB per tile.
//
// GeoServer sends `Access-Control-Allow-Origin: *`, so this works from any
// origin, including a Hostinger-hosted site. Nothing to configure.
//
// NOTE ON TILEMATRIXSET: these URLs use `EPSG:900913`, the legacy code for Web
// Mercator (identical to EPSG:3857). GeoServer's `TILECOL`/`TILEROW` map
// straight onto {x}/{y}, so the templates drop into MapLibre unchanged.
// ---------------------------------------------------------------------------

const GEOSERVER = 'https://geo.firemap.live/geoserver';

/** Build a GeoWebCache WMTS vector-tile URL template for a FireDB layer. */
const mvt = (layer, matrixSet = 'EPSG:900913') =>
  `${GEOSERVER}/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
  `&LAYER=FireDB:${layer}&STYLE=&TILEMATRIXSET=${matrixSet}` +
  `&FORMAT=application/vnd.mapbox-vector-tile` +
  `&TILEMATRIX=${matrixSet}:{z}&TILECOL={x}&TILEROW={y}`;

/** Raster (PNG) WMTS template — used for the smoke overlay. */
const wmtsRaster = (layer, style, matrixSet = 'EPSG:900913x2') =>
  `${GEOSERVER}/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
  `&LAYER=FireDB:${layer}&STYLE=${style}&TILEMATRIXSET=${matrixSet}` +
  `&TILEMATRIX=${matrixSet}:{z}&TILEROW={y}&TILECOL={x}` +
  `&FORMAT=image/png&TRANSPARENT=TRUE`;

// TWO age ramps, because the two layers carry DIFFERENT field names — this is
// the kind of thing that fails silently and looks like a styling problem.
//
//   firms_hotspot_pt_slim   -> `hours_since_update`
//   usa_nasa_firms_24hrs_pt -> `time_diff`
//
// Applying the wrong one makes every point fall through to the 49 default and
// render near-white, which is exactly what happened on the first pass here.

// firms_hotspot_pt_slim
const AGE_GRADIENT = [
  'interpolate', ['linear'],
  ['to-number', ['coalesce', ['get', 'hours_since_update'], 49]],
  0, '#D50000',
  12, '#E62200',
  20, '#FF4500',
  28, '#FF8C00',
  36, '#FFB732',
  42, '#FFD996',
  48, '#FFF5E0'
];

// usa_nasa_firms_24hrs_pt — finer ramp, and keyed on `time_diff` (hours).
const TIME_DIFF_GRADIENT = [
  'interpolate', ['linear'],
  ['coalesce', ['to-number', ['get', 'time_diff']], 49],
  0, '#D50000',
  3, '#FF1A00',
  6, '#FF4500',
  12, '#FF5A36',
  18, '#FFA500',
  24, '#FFB732',
  30, '#FFC864',
  36, '#FFD996',
  42, '#FFEACC',
  48, '#FFF5E0'
];

export const FIRE_LAYER_IDS = [
  'fire-smoke',
  'fire-historical-fill',
  'fire-perimeter-fill',
  'fire-perimeter-outline',
  'fire-hotspots',
  'fire-points-active'
];

/**
 * Add the incident layers.
 *
 * Everything is inserted BENEATH the basemap's label layers so place names and
 * POIs stay readable on top of a perimeter — the fire data is the subject, but
 * an unlabelled map of a burning county is not much use to anyone.
 */
export function addFireLayers(map) {
  // Under place/road/POI labels — not under contour-labels (those sit before roads_*).
  const layers = map.getStyle().layers || [];
  const TOP_LABEL =
    /^(place-|roads-label|poi-label|natural-point-label|waterway-label|water-label)/;
  const firstLabel =
    layers.find((l) => l.type === 'symbol' && TOP_LABEL.test(l.id)) ||
    layers.find((l) => l.type === 'symbol' && !String(l.id).startsWith('contour'));
  const before = firstLabel ? firstLabel.id : undefined;

  const add = (layer) => {
    if (map.getLayer(layer.id)) map.removeLayer(layer.id);
    map.addLayer(layer, before);
  };

  // --- Smoke (raster) ------------------------------------------------------
  // Bottom of the incident stack so perimeters and hotspots read through it.
  map.addSource('fire-smoke-src', {
    type: 'raster',
    tiles: [wmtsRaster('smoke_latest', 'rasters:smoke_style')],
    tileSize: 256
  });
  add({
    id: 'fire-smoke',
    type: 'raster',
    source: 'fire-smoke-src',
    layout: { visibility: 'none' },   // opt-in; it covers a lot of ground
    paint: { 'raster-opacity': 0.55 }
  });

  // --- Historical perimeters (2025) ---------------------------------------
  map.addSource('fire-historical-src', {
    type: 'vector',
    tiles: [mvt('fire_pg_historical_2025')],
    minzoom: 5,
    maxzoom: 12
  });
  add({
    id: 'fire-historical-fill',
    type: 'fill',
    source: 'fire-historical-src',
    'source-layer': 'fire_pg_historical_2025',
    minzoom: 5,
    layout: { visibility: 'none' },
    paint: {
      'fill-color': '#FF5722',
      'fill-opacity': 0.2,
      'fill-outline-color': '#BF360C'
    }
  });

  // --- Active fire perimeters ---------------------------------------------
  // Source caps at z12; MapLibre overzooms above that, which is correct here —
  // a perimeter polygon stays accurate when magnified.
  map.addSource('fire-perimeter-src', {
    type: 'vector',
    tiles: [mvt('fire_pg_combined')],
    minzoom: 5,
    maxzoom: 12
  });
  add({
    id: 'fire-perimeter-fill',
    type: 'fill',
    source: 'fire-perimeter-src',
    'source-layer': 'fire_pg_combined',
    minzoom: 5,
    paint: { 'fill-color': '#FFFF00', 'fill-opacity': 0.2 }
  });
  add({
    id: 'fire-perimeter-outline',
    type: 'line',
    source: 'fire-perimeter-src',
    'source-layer': 'fire_pg_combined',
    minzoom: 5,
    paint: { 'line-color': '#8B0000', 'line-width': 1.8 }
  });

  // --- Satellite hotspots (FIRMS) — FireMap addGlobalFIRMSLayer paint 1:1 --
  map.addSource('fire-hotspots-src', {
    type: 'vector',
    tiles: [mvt('firms_hotspot_pt_slim')],
    minzoom: 5,
    maxzoom: 10
  });
  add({
    id: 'fire-hotspots',
    type: 'circle',
    source: 'fire-hotspots-src',
    'source-layer': 'firms_hotspot_pt_slim',
    minzoom: 5,
    layout: {
      // Freshest detections drawn last, so they sit on top of older ones.
      'circle-sort-key': ['-', 48, ['to-number', ['coalesce', ['get', 'hours_since_update'], 49]]]
    },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.0, 6.5, 6, 9, 11],
      'circle-blur': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 6.5, 0.55, 9, 0.9],
      'circle-color': AGE_GRADIENT,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.015, 6.5, 0.35, 9, 0.69],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 5, 0.05, 6.5, 0.5, 9, 1],
      'circle-stroke-color': AGE_GRADIENT,
      'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.015, 6.5, 0.35, 9, 0.69]
    }
  });

  // --- NASA FIRMS 24h detections (North America) ---------------------------
  // FireMap.live addUSAFIRMSPointsLayer() paint 1:1 (time_diff ramp + glow).
  // IMPORTANT: do not re-add this layer id — a second add() removes the first
  // and historically swapped in AGE_GRADIENT (hours_since_update), which is
  // missing on this source → every point fell through to age 49 / near-white.
  // Zoom stops match FireMap BURNED_AREA_VISIBILITY_ZOOM_THRESHOLD (=5):
  //   MIN=5, MID=MIN+1.5=6.5, DETAIL=MIN+4=9
  // Mid values are averages of broad + zoomed-in constants from FireMap.
  const MIN_FIRMS_ZOOM = 5;
  const FIRMS_MID_TRANSITION_ZOOM = MIN_FIRMS_ZOOM + 1.5;
  const FIRMS_DETAIL_ZOOM_START = MIN_FIRMS_ZOOM + 4;
  const ORIGINAL_BLUR_ZOOMED_IN = 0.9;
  const ORIGINAL_OPACITY_ZOOMED_IN = 0.69;
  const ORIGINAL_RADIUS_ZOOMED_IN = 11;
  const ORIGINAL_STROKE_WIDTH_ZOOMED_IN = 1;
  const BROAD_RADIUS_MIN = 1.0;
  const BROAD_OPACITY_MIN = 0.015;
  const BROAD_BLUR_MIN = 0.2;
  const BROAD_STROKE_WIDTH_MIN = 0.05;
  const MID_RADIUS = (BROAD_RADIUS_MIN + ORIGINAL_RADIUS_ZOOMED_IN) / 2;
  const MID_BLUR = (BROAD_BLUR_MIN + ORIGINAL_BLUR_ZOOMED_IN) / 2;
  const MID_OPACITY = (BROAD_OPACITY_MIN + ORIGINAL_OPACITY_ZOOMED_IN) / 2;
  const MID_STROKE_WIDTH = (BROAD_STROKE_WIDTH_MIN + ORIGINAL_STROKE_WIDTH_ZOOMED_IN) / 2;

  map.addSource('fire-points-src', {
    type: 'vector',
    tiles: [mvt('usa_nasa_firms_24hrs_pt')],
    minzoom: MIN_FIRMS_ZOOM,
    maxzoom: 11,
    bounds: [-170, 18, -52, 74]   // the layer is North America only
  });
  add({
    id: 'fire-points-active',
    type: 'circle',
    source: 'fire-points-src',
    'source-layer': 'usa_nasa_firms_24hrs_pt',
    minzoom: MIN_FIRMS_ZOOM,
    layout: {
      'circle-sort-key': ['-', 48, ['coalesce', ['to-number', ['get', 'time_diff']], 49]]
    },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], MIN_FIRMS_ZOOM, BROAD_RADIUS_MIN, FIRMS_MID_TRANSITION_ZOOM, MID_RADIUS, FIRMS_DETAIL_ZOOM_START, ORIGINAL_RADIUS_ZOOMED_IN],
      'circle-blur': ['interpolate', ['linear'], ['zoom'], MIN_FIRMS_ZOOM, BROAD_BLUR_MIN, FIRMS_MID_TRANSITION_ZOOM, MID_BLUR, FIRMS_DETAIL_ZOOM_START, ORIGINAL_BLUR_ZOOMED_IN],
      'circle-color': TIME_DIFF_GRADIENT,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], MIN_FIRMS_ZOOM, BROAD_OPACITY_MIN, FIRMS_MID_TRANSITION_ZOOM, MID_OPACITY, FIRMS_DETAIL_ZOOM_START, ORIGINAL_OPACITY_ZOOMED_IN],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], MIN_FIRMS_ZOOM, BROAD_STROKE_WIDTH_MIN, FIRMS_MID_TRANSITION_ZOOM, MID_STROKE_WIDTH, FIRMS_DETAIL_ZOOM_START, ORIGINAL_STROKE_WIDTH_ZOOMED_IN],
      'circle-stroke-color': TIME_DIFF_GRADIENT,
      'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], MIN_FIRMS_ZOOM, BROAD_OPACITY_MIN, FIRMS_MID_TRANSITION_ZOOM, MID_OPACITY, FIRMS_DETAIL_ZOOM_START, ORIGINAL_OPACITY_ZOOMED_IN]
    }
  });

  wireInspect(map);
}

/**
 * Shift-free console dump for perimeters / burned areas only.
 * FIRMS hotspots (`fire-hotspots`, `fire-points-active`) use the FireMap
 * infoBox handlers in firms-infobox.js — keep them out of this query list.
 */
function wireInspect(map) {
  const queryable = ['fire-perimeter-fill', 'fire-historical-fill'];
  map.on('click', (e) => {
    const layers = queryable.filter((id) => map.getLayer(id));
    if (!layers.length) return;
    const hits = map.queryRenderedFeatures(e.point, { layers });
    if (!hits.length) return;
    // Skip if a FIRMS/incident point handler already filled the info box.
    const box = document.getElementById('infoBox');
    if (box && box.style.display !== 'none' && box.innerHTML.trim()) return;
    console.log(`%c${hits[0].layer.id}`, 'font-weight:bold', hits[0].properties);
  });

  map.on('mouseenter', 'fire-perimeter-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'fire-perimeter-fill', () => { map.getCanvas().style.cursor = ''; });
}
