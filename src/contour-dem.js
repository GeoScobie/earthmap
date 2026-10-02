// ---------------------------------------------------------------------------
// Runtime Terrarium DEM + maplibre-contour isolines (no pre-baked contour tiles).
// Setup must run before buildStyle() when cartographic DEM/contours are used.
// Interim CDN: Mapterhorn Terrarium WebP (tileSize 512). See docs/PR_DISASTERDB_TOPO.md.
// ---------------------------------------------------------------------------

import mlcontour from 'maplibre-contour';
import { sources, contours as contourOpts } from './theme.js';

let demSource = null;

export function setupContourDem(maplibregl) {
  if (demSource) return demSource;
  demSource = new mlcontour.DemSource({
    url: sources.terrariumTiles,
    encoding: 'terrarium',
    maxzoom: sources.terrariumMaxzoom ?? 15,
    worker: true,
    cacheSize: 100,
    timeoutMs: 10_000
  });
  demSource.setupMaplibre(maplibregl);
  return demSource;
}

export function getDemSource() {
  return demSource;
}

export function sharedDemTilesUrl() {
  if (!demSource) {
    throw new Error('setupContourDem(maplibregl) before buildStyle() when DEM/contours are on');
  }
  return demSource.sharedDemProtocolUrl;
}

export function contourTilesUrl() {
  if (!demSource) {
    throw new Error('setupContourDem(maplibregl) before buildStyle() when DEM/contours are on');
  }
  return demSource.contourProtocolUrl({
    multiplier: contourOpts.multiplier,
    thresholds: contourOpts.thresholds,
    contourLayer: contourOpts.layer,
    elevationKey: contourOpts.elevationKey,
    levelKey: contourOpts.levelKey,
    // Mapterhorn (and other 512 DEM) — overzoom 1 cuts neighbor fetches
    overzoom: 1
  });
}
