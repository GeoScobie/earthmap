// ---------------------------------------------------------------------------
// GeoColor product stub — Path B (owned CDN)
//
// ONE MapLibre raster source. Time swaps via source.setTiles.
// Live East contract (Rob 2026-09-14):
//   {baseUrl}/geocolor/goes-east/{ymd}/{hhmm}/{z}/{x}/{y}.png
// No times.json yet — floor UTC to 10 min, step back on 404.
//
// Idle while theme.geocolor.enabled=false. GOES-East is live via goes.js.
// NOT GIBS. See docs/geocolor.md.
// ---------------------------------------------------------------------------

import { geocolor, attribution, SAT_ROADS_LAYER_ID, CONTOUR_LINES_LAYER_ID, BOUNDARY_BEFORE_ID, BOUNDARY_LAYER_IDS } from './theme.js';

export const GEOCOLOR_SOURCE_ID = 'geocolor-mosaic';
export const GEOCOLOR_LAYER_ID = 'geocolor-mosaic';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Floor Date (UTC) to 10-minute cadence → { ymd, hhmm, iso }. */
export function floorUtcToGeocolorFrame(date = new Date()) {
  const d = new Date(date.getTime());
  const flooredMin = Math.floor(d.getUTCMinutes() / 10) * 10;
  d.setUTCMinutes(flooredMin, 0, 0);
  const ymd = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const hhmm = `${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}`;
  return { ymd, hhmm, iso: d.toISOString().replace(/\.\d{3}Z$/, 'Z') };
}

export function stepBackGeocolorFrame({ ymd, hhmm }) {
  const hh = Number(hhmm.slice(0, 2));
  const mm = Number(hhmm.slice(2, 4));
  const [Y, M, D] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D, hh, mm, 0, 0));
  d.setUTCMinutes(d.getUTCMinutes() - 10);
  return floorUtcToGeocolorFrame(d);
}

/** Owned GeoColor XYZ template (goes-east/{ymd}/{hhmm}/…png). */
export function geocolorTileUrl(baseUrl, ymd, hhmm) {
  const root = String(baseUrl || '').replace(/\/$/, '');
  const prefix = String(geocolor.pathPrefix || '/geocolor/goes-east');
  const p = prefix.startsWith('/') ? prefix : `/${prefix}`;
  return `${root}${p}/${ymd}/${hhmm}/{z}/{x}/{y}.png`;
}

async function probeFrame(baseUrl, ymd, hhmm) {
  const tpl = geocolorTileUrl(baseUrl, ymd, hhmm);
  const url = tpl.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0');
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-cache' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Resolve latest frame: floor UTC → step back on 404 (upload lag). */
export async function resolveGeocolorLatest(baseUrl) {
  const retries = geocolor.frameRetrySlots ?? 6;
  let frame = floorUtcToGeocolorFrame();
  for (let i = 0; i <= retries; i++) {
    // sequential probes by design
    // eslint-disable-next-line no-await-in-loop
    if (await probeFrame(baseUrl, frame.ymd, frame.hhmm)) return frame;
    frame = stepBackGeocolorFrame(frame);
  }
  return floorUtcToGeocolorFrame();
}

/**
 * Optional legacy times.json — only used when timesPath is non-empty.
 * Live CDN has no manifest yet.
 */
export async function fetchGeocolorTimes() {
  const root = String(geocolor.baseUrl || '').replace(/\/$/, '');
  const path = geocolor.timesPath;
  if (!path) throw new Error('no timesPath — use resolveGeocolorLatest');
  const url = `${root}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`times HTTP ${res.status} from ${url}`);
  const data = await res.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('times.json must be an object with times[] + latest');
  }
  const times = Array.isArray(data.times)
    ? data.times.map(String).filter(Boolean)
    : [];
  if (!times.length) throw new Error('times.json has empty times[]');
  const latest = data.latest ? String(data.latest) : times[times.length - 1];
  return { times, latest };
}

function beforeId(map) {
  if (map.getLayer(CONTOUR_LINES_LAYER_ID)) return CONTOUR_LINES_LAYER_ID;
  if (map.getLayer(SAT_ROADS_LAYER_ID)) return SAT_ROADS_LAYER_ID;
  if (map.getLayer(BOUNDARY_BEFORE_ID)) return BOUNDARY_BEFORE_ID;
  for (const id of BOUNDARY_LAYER_IDS) {
    if (map.getLayer(id)) return id;
  }
  return (
    (map.getLayer('fire-smoke') && 'fire-smoke') ||
    map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  );
}

/**
 * Add the single GeoColor mosaic raster. Starts hidden (UI default OFF).
 * Returns null when disabled or baseUrl empty — never throws into createMap.
 */
export async function addGeocolorLayers(map) {
  if (!geocolor.enabled) {
    console.info('[geocolor] theme.geocolor.enabled=false — stub idle');
    return null;
  }

  const base = String(geocolor.baseUrl || '').trim();
  if (!base) {
    console.info('[geocolor] baseUrl empty — stub idle (set theme.geocolor.baseUrl)');
    return null;
  }

  let frame;
  try {
    if (geocolor.timesPath) {
      const manifest = await fetchGeocolorTimes();
      // Legacy ISO path — not used on live goes-east contract.
      frame = floorUtcToGeocolorFrame(Date.parse(manifest.latest) || Date.now());
    } else {
      frame = await resolveGeocolorLatest(base);
    }
  } catch (e) {
    console.warn('[geocolor] resolve:', e.message);
    return null;
  }

  const before = beforeId(map);

  if (map.getLayer(GEOCOLOR_LAYER_ID)) map.removeLayer(GEOCOLOR_LAYER_ID);
  if (map.getSource(GEOCOLOR_SOURCE_ID)) map.removeSource(GEOCOLOR_SOURCE_ID);

  map.addSource(GEOCOLOR_SOURCE_ID, {
    type: 'raster',
    tiles: [geocolorTileUrl(base, frame.ymd, frame.hhmm)],
    tileSize: geocolor.tileSize || 256,
    maxzoom: geocolor.maxzoom ?? 7,
    attribution: attribution.geocolor || attribution.ownedGoesEast || ''
  });

  map.addLayer(
    {
      id: GEOCOLOR_LAYER_ID,
      type: 'raster',
      source: GEOCOLOR_SOURCE_ID,
      layout: { visibility: 'none' },
      paint: {
        'raster-opacity': 0.95,
        'raster-fade-duration': 0
      }
    },
    before
  );

  const state = { baseUrl: base, frame };

  const applyFrame = (next) => {
    if (!next) return false;
    if (
      state.frame &&
      state.frame.ymd === next.ymd &&
      state.frame.hhmm === next.hhmm
    ) {
      return false;
    }
    const src = map.getSource(GEOCOLOR_SOURCE_ID);
    if (!src || typeof src.setTiles !== 'function') return false;
    src.setTiles([geocolorTileUrl(state.baseUrl, next.ymd, next.hhmm)]);
    state.frame = next;
    console.info('[geocolor] time →', `${next.ymd}/${next.hhmm}`);
    return true;
  };

  const refresh = async () => {
    try {
      const next = await resolveGeocolorLatest(state.baseUrl);
      applyFrame(next);
    } catch (e) {
      console.warn('[geocolor] refresh:', e.message);
    }
  };

  const timer = setInterval(refresh, geocolor.refreshMs || 600_000);
  map.on('remove', () => clearInterval(timer));

  map.__geocolor = {
    state,
    setTime(isoOrFrame) {
      if (isoOrFrame && typeof isoOrFrame === 'object' && isoOrFrame.ymd) {
        applyFrame(isoOrFrame);
        return;
      }
      applyFrame(floorUtcToGeocolorFrame(Date.parse(isoOrFrame) || Date.now()));
    },
    layerId: GEOCOLOR_LAYER_ID
  };

  console.info('[geocolor] ready @', `${frame.ymd}/${frame.hhmm}`);
  return map.__geocolor;
}
