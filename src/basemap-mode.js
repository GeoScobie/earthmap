// ---------------------------------------------------------------------------
// Primary basemap pair: Protomaps topo ↔ sat-live (OSM under GeoColor).
// Sat-live keeps the Protomaps OSM carto stack (hillshade + contours) under
// GeoColor — FireMap keeps classic basemap under sat; App uses own PMTiles.
// The toolbar basemap button toggles this pair — not globe vs mercator.
// ---------------------------------------------------------------------------

import {
  resolveBasemapId,
  setRuntimeBasemapId,
  togglePrimaryBasemap,
  syncBasemapQuery,
  isSatelliteBasemap
} from './basemap-resolve.js';
import { ensureGoesGeocolorMounted, syncMosaicAttribution } from './goes.js';
import { applyHurricaneSatPaint } from './hurricane.js';
import { attribution, SAT_ONLY_OUTLINE_IDS } from './theme.js';
import { syncSatRoadsVisibility, geocolorCheckboxesOn } from './roads-sat.js';

/** Protomaps OSM carto + hillshade + contours — kept visible in sat-live
 *  (basemap under GeoColor). roads_* stay managed by roads-sat.js. */
const CARTO_OSM_RE =
  /^(background|earth|landcover|landuse_|water$|water_stream|water_river|buildings|hillshade|contour)/;

function setVis(map, layerId, visible) {
  if (!map.getLayer(layerId)) return;
  try {
    map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
  } catch {
    /* ignore */
  }
}


/** Write source attribution and nudge AttributionControl to refresh. */
function writeSourceAttribution(map, sourceId, html) {
  const src = map.getSource(sourceId);
  if (!src) return;
  try {
    src.attribution = html || '';
  } catch {
    /* ignore */
  }
  try {
    map.fire('sourcedata', {
      dataType: 'metadata',
      sourceDataType: 'metadata',
      sourceId,
      isSourceLoaded: true,
      source: src
    });
  } catch {
    /* ignore */
  }
}

/**
 * Terrain + credits for the active mode.
 * MapLibre only lists sources that are used / usedForTerrain — setTerrain on
 * sat was forcing Mapterhorn into the info chip. Also strip Mapterhorn from
 * the vector basemap credit string while sat fills are showing.
 */
export function syncTerrainForBasemap(map, satOn) {
  // Sat-live: drop 3D terrain exaggeration but keep 2D hillshade + contours
  // (Mapterhorn DEM) on the OSM basemap under GeoColor.
  if (satOn) {
    try {
      if (map.getTerrain()) map.setTerrain(null);
    } catch {
      /* ignore */
    }
    writeSourceAttribution(map, 'terrain', '');
    writeSourceAttribution(map, 'terrarium', attribution.mapterhorn);
    writeSourceAttribution(
      map,
      'basemap',
      `${attribution.protomaps} ${attribution.osm} ${attribution.mapterhorn}`.trim()
    );
  } else {
    writeSourceAttribution(map, 'terrain', attribution.mapterhorn);
    writeSourceAttribution(map, 'terrarium', attribution.mapterhorn);
    writeSourceAttribution(
      map,
      'basemap',
      `${attribution.protomaps} ${attribution.osm} ${attribution.mapterhorn}`.trim()
    );
    try {
      if (!map.getTerrain() && map.getSource('terrain')) {
        map.setTerrain({ source: 'terrain', exaggeration: 1.3 });
      }
    } catch (e) {
      console.warn('[basemap-mode] setTerrain', e.message);
    }
  }
}



/**
 * Apply visibility for the active primary basemap on the unified style
 * (Blue Marble + Protomaps always present; one mode shows each).
 */
export function applyBasemapMode(map, id = resolveBasemapId()) {
  const sat = id === 'satellite';

  // Sat-live basemap = Protomaps OSM (topo stack), not Blue Marble — FireMap
  // keeps classic OSM/Mapbox under GeoColor; App uses own planet PMTiles.
  setVis(map, 'bluemarble-lo', false);
  setVis(map, 'bluemarble', false);

  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    if (!CARTO_OSM_RE.test(layer.id)) continue;
    // Always on: OSM fills + hillshade + contours under (or with) GeoColor.
    setVis(map, layer.id, true);
  }
  // Coast + strong ADM0 casing: sat/near-time only.
  // ADM1/ADM2 (and country keyline) stay visible in both modes as today.
  // CARTO_OSM_RE does not match coastline-* / boundary-* — explicit here.
  for (const id of SAT_ONLY_OUTLINE_IDS) {
    setVis(map, id, sat);
  }

  syncGoesForBasemap(map, sat);
  // After GeoColor boxes sync: major roads over imagery (planet PMTiles).
  syncSatRoadsVisibility(map, sat || geocolorCheckboxesOn());
  syncBasemapButton(sat);
  syncTerrainForBasemap(map, sat);
  syncMosaicAttribution(map);
  // Track thicken when primary basemap flips topo ↔ NASA near-time.
  try {
    applyHurricaneSatPaint(sat);
  } catch {
    /* hurricane layer optional */
  }
}

function syncGoesForBasemap(map, satOn) {
  const ids = [
    'lyr-goes-east-demo',
    'lyr-goes-west-demo',
    'lyr-goes-meteosat-demo',
    // Himawari parked — not synced by sat-mode
    'lyr-goes-gk2a-demo'
  ];
  for (const id of ids) {
    const box = document.getElementById(id);
    if (box) box.checked = satOn;
  }
  // Honour via change events so goes.js listeners update layout + time bar.
  for (const id of ids) {
    document.getElementById(id)?.dispatchEvent(new Event('change'));
  }
  const satBtn = document.getElementById('goesSatModeBtn');
  if (satBtn) {
    satBtn.classList.toggle('active', satOn);
    satBtn.setAttribute('aria-pressed', satOn ? 'true' : 'false');
  }
  if (satOn) {
    ensureGoesGeocolorMounted(map).catch((e) =>
      console.warn('[basemap-mode] goes mount', e.message)
    );
  }
}

function syncBasemapButton(satOn) {
  const btn = document.getElementById('basemapBtn');
  if (!btn) return;
  btn.classList.toggle('active', satOn);
  btn.setAttribute('aria-pressed', satOn ? 'true' : 'false');
  btn.title = satOn
    ? 'Basemap: Sat-live / GeoColor (click for topo)'
    : 'Basemap: Topo (click for sat-live)';
}

/** Toggle topo ↔ NASA near-time and apply. Returns the new basemap id. */
export function cyclePrimaryBasemap(map) {
  const next = togglePrimaryBasemap();
  syncBasemapQuery(next);
  applyBasemapMode(map, next);
  return next;
}

export function wireBasemapToggle(map) {
  // Honour cold-start mode (URL / theme). Satellite is the load default.
  // The topo ↔ sat toolbar button was removed; ?basemap= still overrides.
  applyBasemapMode(map, resolveBasemapId());
  const btn = document.getElementById('basemapBtn');
  if (!btn || btn.dataset.basemapWired) return;
  btn.dataset.basemapWired = '1';
  btn.addEventListener('click', () => {
    cyclePrimaryBasemap(map);
  });
}

export { isSatelliteBasemap, setRuntimeBasemapId } from './basemap-resolve.js';
export { syncSatRoadsVisibility } from './roads-sat.js';
