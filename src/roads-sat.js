// ---------------------------------------------------------------------------
// Major roads over sat / GeoColor — planet PMTiles layer `roads-simple`.
// Shared by basemap-mode + goes so sat-button and basemap toggle stay in sync
// without a circular import (basemap-mode → goes).
// ---------------------------------------------------------------------------

import { SAT_ROADS_LAYER_ID } from './theme.js';
import { isSatelliteBasemap } from './basemap-resolve.js';

function setVis(map, layerId, visible) {
  if (!map?.getLayer?.(layerId)) return;
  try {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  } catch {
    /* ignore */
  }
}

/** True when any owned GeoColor TOC checkbox is on (sat-mode button path). */
export function geocolorCheckboxesOn() {
  for (const id of [
    'lyr-goes-east-demo',
    'lyr-goes-west-demo',
    'lyr-goes-meteosat-demo',
    'lyr-goes-gk2a-demo'
  ]) {
    if (document.getElementById(id)?.checked) return true;
  }
  return false;
}

/**
 * Major roads over imagery. On when NASA near-time basemap OR GeoColor is
 * active (and Layers → Roads is checked / absent).
 * @param {import('maplibre-gl').Map} map
 * @param {boolean} [imageryOn] force; default = sat basemap || GeoColor boxes
 */
export function syncSatRoadsVisibility(map, imageryOn) {
  if (!map) return;
  const on =
    imageryOn != null
      ? Boolean(imageryOn)
      : isSatelliteBasemap() || geocolorCheckboxesOn();
  const box = document.getElementById('lyr-roads');
  const want = on && (!box || box.checked);
  setVis(map, SAT_ROADS_LAYER_ID, want);
  // Hide cased topo roads_* while sat overlay is active (avoid double draw).
  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    if (String(layer.id).startsWith('roads_')) setVis(map, layer.id, !on);
  }
}
