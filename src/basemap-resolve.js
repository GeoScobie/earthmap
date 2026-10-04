// ---------------------------------------------------------------------------
// Resolve active basemap + hillshade + contours for QA without flipping prod.
// Priority: runtime toggle > URL query > theme.js exports.
// ---------------------------------------------------------------------------

import {
  BASEMAP_IDS,
  basemapId as themeBasemapId,
  hillshadeEnabled as themeHillshade
} from './theme.js';

/** @type {null|'satellite'|'disasterdb-topo'|'disasterdb-light'|'disasterdb-dark'|'disasterdb-streets'|'disasterdb-navigation'|'disasterdb-gray'|'disasterdb-night-nav'|'disasterdb-hybrid'|'disasterdb-navigation-day'|'disasterdb-satellite-streets'|'disasterdb-hydro'|'disasterdb-standard'} */
let runtimeBasemapId = null;

function queryParams() {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

/** @returns {'satellite'|'disasterdb-topo'|'disasterdb-light'|'disasterdb-dark'|'disasterdb-streets'|'disasterdb-navigation'|'disasterdb-gray'|'disasterdb-night-nav'|'disasterdb-hybrid'|'disasterdb-navigation-day'|'disasterdb-satellite-streets'|'disasterdb-hydro'|'disasterdb-standard'} */
export function resolveBasemapId() {
  if (runtimeBasemapId && BASEMAP_IDS.includes(runtimeBasemapId)) {
    return runtimeBasemapId;
  }
  const q = queryParams();
  const fromQuery = q?.get('basemap') || q?.get('basemapId') || '';
  if (fromQuery && BASEMAP_IDS.includes(fromQuery)) return fromQuery;
  if (BASEMAP_IDS.includes(themeBasemapId)) return themeBasemapId;
  return 'disasterdb-topo';
}

/** Primary product pair for the toolbar basemap button. */
export const TOGGLE_BASEMAPS = ['disasterdb-topo', 'satellite'];

export function setRuntimeBasemapId(id) {
  if (!BASEMAP_IDS.includes(id)) return resolveBasemapId();
  runtimeBasemapId = id;
  return id;
}

/** Flip topo ↔ satellite (NASA near-time). Returns the new id. */
export function togglePrimaryBasemap() {
  const cur = resolveBasemapId();
  const next = cur === 'satellite' ? 'disasterdb-topo' : 'satellite';
  return setRuntimeBasemapId(next);
}

/** Persist ?basemap= in the URL without reloading (keeps hash). */
export function syncBasemapQuery(id = resolveBasemapId()) {
  try {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const url = new URL(window.location.href);
    url.searchParams.set('basemap', id);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}

/**
 * Hillshade: satellite always off.
 * URL &hillshade=0|false|off|no disables; &hillshade=1|true|on|yes enables.
 * No query: disasterdb-topo defaults ON; light/dark use theme.hillshadeEnabled.
 */
export function resolveHillshadeEnabled(basemap = resolveBasemapId()) {
  if (basemap === 'satellite') return false;
  const q = queryParams();
  if (q?.has('hillshade')) {
    const v = (q.get('hillshade') || '').toLowerCase();
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }
  if (basemap === 'disasterdb-topo') return true;
  return Boolean(themeHillshade);
}

export function isCartographicBasemap(id = resolveBasemapId()) {
  return id === 'disasterdb-topo' || id === 'disasterdb-light' || id === 'disasterdb-dark' || id === 'disasterdb-streets' || id === 'disasterdb-navigation' || id === 'disasterdb-gray' || id === 'disasterdb-night-nav' || id === 'disasterdb-hybrid' || id === 'disasterdb-navigation-day' || id === 'disasterdb-satellite-streets' || id === 'disasterdb-hydro' || id === 'disasterdb-standard';
}

export function isLightCartographic(id = resolveBasemapId()) {
  // navigation matches FireMap's night-origin nav style (dark), so it is out.
  // night-nav, hybrid, and satellite-streets are dark fields.
  // navigation-day, hydro, and standard are pale.
  return id === 'disasterdb-topo' || id === 'disasterdb-light' || id === 'disasterdb-streets' || id === 'disasterdb-gray' || id === 'disasterdb-navigation-day' || id === 'disasterdb-hydro' || id === 'disasterdb-standard';
}

/** Contours on topo always; on light/dark when hillshade/DEM is on. */
export function resolveContoursEnabled(basemap = resolveBasemapId()) {
  if (basemap === 'disasterdb-topo') return true;
  if (basemap === 'disasterdb-light' || basemap === 'disasterdb-dark' || basemap === 'disasterdb-streets' || basemap === 'disasterdb-navigation' || basemap === 'disasterdb-gray' || basemap === 'disasterdb-night-nav' || basemap === 'disasterdb-hybrid' || basemap === 'disasterdb-navigation-day' || basemap === 'disasterdb-satellite-streets' || basemap === 'disasterdb-hydro' || basemap === 'disasterdb-standard') {
    return resolveHillshadeEnabled(basemap);
  }
  return false;
}

/** Terrarium DEM source needed for hillshade and/or runtime contours. */
export function resolveDemNeeded(basemap = resolveBasemapId()) {
  return resolveHillshadeEnabled(basemap) || resolveContoursEnabled(basemap);
}

/** Near-time NASA+GOES mode. */
export function isSatelliteBasemap(id = resolveBasemapId()) {
  return id === 'satellite';
}
