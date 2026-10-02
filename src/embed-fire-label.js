// ---------------------------------------------------------------------------
// Forced fire name label for SEO /fires/ iframes.
//
// When ?fireLabel=… (or alias ?label=…) and/or ?fire=… is present, draw a
// single always-on Lexend symbol so the page H1 fire name is visible even
// when main-map FoN/status labeling rules would hide it.
//
// Anchor priority (never follows the camera):
//   1. Matching USA fire point geometry (usa-fire-data / fire_id_source)
//   2. Fixed lat/lng from the MapLibre hash #zoom/lat/lng (parsed once;
//      refreshed only if the hash coordinates themselves change)
//   3. map.getCenter() once at first place — still no pan-follow
//
// Does nothing when both params are absent — main-map labeling unchanged.
// ---------------------------------------------------------------------------

import { brand, cartoLightLabels, fonts } from './theme.js';
import { resolveBasemapId, isLightCartographic } from './basemap-resolve.js';
import { resolveFireLabel, resolveFireId } from './embed.js';

const SRC = 'ddb-embed-fire-label';
const LAYER = 'ddb-embed-fire-label';
/** Agency USA stack GeoJSON source id (see agency-fires.js). */
const USA_FIRE_SOURCE = 'usa-fire-data';

/** Props Website / FireDB may expose for ?fire= matching (primary: fire_id_source). */
const FIRE_ID_PROPS = [
  'fire_id_source',
  'fire_id',
  'unique_fire_identifier',
  'irwin_id'
];

/**
 * Strip tags / control chars so MapLibre text-field gets a plain string.
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeFireLabelText(raw) {
  if (raw == null) return '';
  let s = String(raw);
  // Decode common HTML entities that might sneak in from CMS titles.
  s = s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
  s = s.replace(/<[^>]*>/g, '');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize FireDB / Irwin ids for comparison.
 * Strips braces and hyphens; lowercases. "78d35d3b" and
 * "{78D35D3B-F791-4961-AE36-C6D1A4DFF5A0}" share a comparable form.
 * @param {unknown} v
 * @returns {string}
 */
export function normalizeFireIdKey(v) {
  if (v == null) return '';
  return String(v)
    .trim()
    .toLowerCase()
    .replace(/^\{|\}$/g, '')
    .replace(/-/g, '');
}

/**
 * True when query (?fire=) matches a feature id prop.
 * Accepts short UUID prefix (8+ hex) or full UUID / fire_id_source.
 * @param {string} query
 * @param {unknown} propVal
 */
export function fireIdsMatch(query, propVal) {
  const q = normalizeFireIdKey(query);
  const p = normalizeFireIdKey(propVal);
  if (!q || !p) return false;
  if (q === p) return true;
  // Short id: first UUID segment (e.g. 78d35d3b).
  if (q.length >= 8 && p.startsWith(q)) return true;
  if (p.length >= 8 && q.startsWith(p)) return true;
  return false;
}

/**
 * Parse MapLibre hash `#zoom/lat/lng` → fixed {lat,lng}. Null if missing/invalid.
 * @param {string} [hash]
 * @returns {{lat:number,lng:number}|null}
 */
export function parseHashLngLat(hash) {
  let h = hash == null ? '' : String(hash);
  if (h.startsWith('#')) h = h.slice(1);
  if (!h) return null;
  const parts = h.split('/');
  if (parts.length < 3) return null;
  const lat = parseFloat(parts[1]);
  const lng = parseFloat(parts[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function labelPaint() {
  const light = isLightCartographic(resolveBasemapId());
  if (light) {
    return {
      'text-color': cartoLightLabels.labelText,
      'text-halo-color': cartoLightLabels.labelHalo,
      'text-halo-width': fonts.settlementHaloWidth,
      'text-halo-blur': 0.4
    };
  }
  return {
    'text-color': brand.labelText ?? '#ffffff',
    'text-halo-color': brand.labelHalo,
    'text-halo-width': fonts.settlementHaloWidth,
    'text-halo-blur': 0.4
  };
}

function pointFeature(lng, lat, name, fireId) {
  const props = { name };
  if (fireId) props.fire = fireId;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: props
  };
}

function centerFromMap(map) {
  const c = map.getCenter();
  return { lng: c.lng, lat: c.lat };
}

function hashCoordKey(ll) {
  if (!ll) return '';
  return `${ll.lat},${ll.lng}`;
}

/**
 * Collect USA fire point features from the agency GeoJSON source.
 * @param {import('maplibre-gl').Map} map
 * @returns {Array<GeoJSON.Feature>}
 */
function usaFireFeatures(map) {
  const src = map.getSource(USA_FIRE_SOURCE);
  if (!src) return [];

  // GeoJSON sources: serialize().data is the FeatureCollection we loaded.
  try {
    if (typeof src.serialize === 'function') {
      const data = src.serialize()?.data;
      if (data && typeof data === 'object' && Array.isArray(data.features)) {
        return data.features;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    return map.querySourceFeatures(USA_FIRE_SOURCE) || [];
  } catch {
    return [];
  }
}

/**
 * Find USA fire pt matching ?fire= against fire_id_source (and siblings).
 * @param {import('maplibre-gl').Map} map
 * @param {string|null} fireId
 * @returns {GeoJSON.Feature|null}
 */
function findMatchingUsaFire(map, fireId) {
  if (!fireId) return null;
  const features = usaFireFeatures(map);
  for (const f of features) {
    const props = f?.properties || {};
    for (const key of FIRE_ID_PROPS) {
      if (fireIdsMatch(fireId, props[key])) return f;
    }
  }
  return null;
}

function coordsFromFeature(feature) {
  const g = feature?.geometry;
  if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) {
    return null;
  }
  const lng = Number(g.coordinates[0]);
  const lat = Number(g.coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lng, lat };
}

/**
 * Add always-on fire name label anchored to the USA fire point (or fixed hash).
 * Call after map 'load' (style ready for addSource/addLayer).
 * @param {import('maplibre-gl').Map} map
 */
export function addEmbedFireLabel(map) {
  const rawLabel = resolveFireLabel();
  const fireId = resolveFireId();
  if (!rawLabel && !fireId) return;

  let name = sanitizeFireLabelText(rawLabel || '');
  /** @type {{lng:number,lat:number}|null} */
  let pinned = null;
  let anchoredToFeature = false;
  let lastHashKey = hashCoordKey(
    parseHashLngLat(typeof window !== 'undefined' ? window.location.hash : '')
  );

  const resolveFallbackAnchor = () => {
    const fromHash = parseHashLngLat(
      typeof window !== 'undefined' ? window.location.hash : ''
    );
    if (fromHash) return { lng: fromHash.lng, lat: fromHash.lat };
    return centerFromMap(map);
  };

  const ensureLayer = () => {
    if (map.getLayer(LAYER)) return;
    if (map.getSource(SRC)) {
      try {
        map.removeSource(SRC);
      } catch {
        /* ignore */
      }
    }

    if (!pinned) pinned = resolveFallbackAnchor();
    const labelName = name || 'Fire';
    map.addSource(SRC, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [pointFeature(pinned.lng, pinned.lat, labelName, fireId)]
      }
    });

    map.addLayer({
      id: LAYER,
      type: 'symbol',
      source: SRC,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': fonts.settlement,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          12,
          8,
          15,
          12,
          18
        ],
        'text-anchor': 'center',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'symbol-sort-key': 0,
        'text-max-width': 14
      },
      paint: labelPaint()
    });
  };

  const writeAnchor = (lng, lat, nextName) => {
    if (nextName) name = nextName;
    if (!name) return;
    pinned = { lng, lat };
    ensureLayer();
    const src = map.getSource(SRC);
    if (!src || typeof src.setData !== 'function') return;
    src.setData({
      type: 'FeatureCollection',
      features: [pointFeature(lng, lat, name, fireId)]
    });
  };

  const trySnapToUsaFire = () => {
    const feature = findMatchingUsaFire(map, fireId);
    if (!feature) return false;
    const ll = coordsFromFeature(feature);
    if (!ll) return false;
    const featureName = sanitizeFireLabelText(feature.properties?.fire_name || '');
    const labelText = name || featureName;
    if (!labelText) return false;
    anchoredToFeature = true;
    writeAnchor(ll.lng, ll.lat, labelText);
    return true;
  };

  const placeInitial = () => {
    if (trySnapToUsaFire()) return;
    // Fixed fallback — hash lat/lng once, else getCenter once. No pan-follow.
    const fb = resolveFallbackAnchor();
    if (!name) return; // need fireLabel text until feature loads
    writeAnchor(fb.lng, fb.lat, name);
  };

  placeInitial();
  if (map.loaded()) {
    map.once('idle', () => {
      if (!anchoredToFeature) placeInitial();
    });
  } else {
    map.once('load', () => {
      map.once('idle', () => {
        if (!anchoredToFeature) placeInitial();
      });
    });
  }

  // When USA WFS finishes loading, snap anchor to the fire point geometry.
  map.on('sourcedata', (e) => {
    if (anchoredToFeature) return;
    if (!e || e.sourceId !== USA_FIRE_SOURCE) return;
    if (e.isSourceLoaded === false) return;
    trySnapToUsaFire();
  });

  // Only react to hash when lat/lng in the deep-link changes (different fire),
  // and only while we have not yet snapped to a USA feature. Never follow pans.
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
      const ll = parseHashLngLat(window.location.hash);
      const key = hashCoordKey(ll);
      if (key === lastHashKey) return;
      lastHashKey = key;
      if (anchoredToFeature) return;
      if (ll && name) writeAnchor(ll.lng, ll.lat, name);
    });
  }
}
