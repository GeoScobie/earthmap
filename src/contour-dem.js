// Runtime Terrarium DEM + maplibre-contour (App contour-dem.js pattern).
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

export function sharedDemTilesUrl() {
  if (!demSource) throw new Error('setupContourDem before buildStyle');
  return demSource.sharedDemProtocolUrl;
}

export function contourTilesUrl() {
  if (!demSource) throw new Error('setupContourDem before buildStyle');
  return demSource.contourProtocolUrl({
    multiplier: contourOpts.multiplier,
    thresholds: contourOpts.thresholds,
    contourLayer: contourOpts.layer,
    elevationKey: contourOpts.elevationKey,
    levelKey: contourOpts.levelKey,
    overzoom: 1
  });
}
