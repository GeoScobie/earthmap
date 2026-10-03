// ---------------------------------------------------------------------------
// GOES East/West + Meteosat + Himawari + GK2A GeoColor overlays
//
// East: owned sat.disasterdb.com XYZ (GOES-19 GeoColor).
// West family: owned sat.disasterdb.com XYZ (GOES-18 GeoColor) via ONE MapLibre
//       raster. CDN split remains two tilers — /geocolor/goes-west (Hawaii /
//       −lon / EW) + /geocolor/goes-west-widl (IDL sliver / +lon / WG). A dual
//       template protocol routes each XYZ so IDL neighbors share one source
//       (two sources meeting at ±180 left a translucent grey feather strip).
//       Shares West ymd/hhmm until latest.json grows a widl key.
// Meteosat: owned sat.disasterdb.com XYZ (MSG GeoColor).
// Himawari: owned sat.disasterdb.com XYZ (AHI GeoColor) — same Bunny path shape.
// GK2A: owned sat.disasterdb.com XYZ (AMI GeoColor) — same Bunny path shape.
//
// Client-only linear seam fades via addProtocol + worker-safe
// OffscreenCanvas. Shared width 5.625°. Western sat of each pair is prioritized;
// eastern partner stays opaque underneath. Passthrough still fetches via the
// protocol (arrayBuffer — not a zero-copy Response / raw CDN URL). Source
// bounds below cut fanout for sats that would be fully clear in a region.
// Formula (western-of-pair alpha):
//   w = clamp((lon - cut + width/2) / width, 0, 1); westOfPairAlpha = 1 - w
//   West family:     one MapLibre raster (avoids IDL cross-source feather gap).
//                    Protocol routes XYZ to goes-west (−lon / Hawaii / EW fade)
//                    or goes-west-widl (+lon / IDL sliver / WG fade into GK2A).
//   East tiles:      EM cut −27.1875 (fade East)
//   Meteosat:        MG cut 61.875 (fade Meteosat)
//   GK2A: no seam protocol. Himawari: parked / untouched.
// Layer stack bottom→top: GK2A → Meteosat → East → West-family.
// Cook/land ownership unchanged — client alpha only.
// Tab wake: visibilitychange / pageshow (bfcache) / focus (if was hidden)
//   debounced (~500ms) re-poll of latest.json via fromWake (awaits MapLibre
//   style/WebGL). Tip polls pause while document.hidden. Interval tip poll is
//   ~60s and fires immediately on start — leave-open must not wait 10min.
//   Every successful poll (when not dragging) force-applies per-sat latest
//   tiles + rewrites tipFrame/displayFrame/transportClockFrame from
//   newestTipFrame (age ticker alone must not grow a frozen ~03:30 stamp).
//   Cold open / primeTimeTransport: always paint latest.json center tip first;
//   never playlist mid-index (range value=0 / preserved gkPlayIndex → ~03:30).
//   latest.json fetch: cache-bust URL (?t=) + cache:'no-store' every network
//   hit; wake/force skips the ~30s in-memory cache (iOS webview HTTP reuse).
// Tip clock / age / transport sat label = tip stamp of the sat whose hard-cut
//   sector owns map.getCenter() (not min/max of every sat, not fixed GK2A).
//   moveend/zoomend re-evaluate center owner while live; scrub/play index is
//   not jumped when only the center sat changes mid-historical scrub.
// ---------------------------------------------------------------------------

import * as maplibregl from 'maplibre-gl';
import { applyHurricaneSatPaint } from './hurricane.js';
import {
  goesEast,
  goesWest,
  goesWestWidl,
  goesMeteosat,
  goesHimawari,
  goesGk2a,
  goesGeocolor,
  attribution,
  SAT_ROADS_LAYER_ID,
  CONTOUR_LINES_LAYER_ID,
  BOUNDARY_BEFORE_ID,
  BOUNDARY_LAYER_IDS,
  GOES_EW_CUT_LON,
  GOES_EM_CUT_LON,
  GOES_MG_CUT_LON,
  GOES_WG_CUT_LON,
  GOES_EW_FADE_WIDTH
} from './theme.js';
import { syncSatRoadsVisibility } from './roads-sat.js';

export const GOES_EAST_LAYER_ID = 'goes-east-demo';
export const GOES_EAST_SOURCE_ID = 'goes-east-demo-src';
export const GOES_WEST_LAYER_ID = 'goes-west-demo';
export const GOES_WEST_SOURCE_ID = 'goes-west-demo-src';
export const GOES_WEST_WIDL_LAYER_ID = 'goes-west-widl-demo';
export const GOES_WEST_WIDL_SOURCE_ID = 'goes-west-widl-demo-src';
export const GOES_METEOSAT_LAYER_ID = 'goes-meteosat-demo';
export const GOES_METEOSAT_SOURCE_ID = 'goes-meteosat-demo-src';
export const GOES_HIMAWARI_LAYER_ID = 'goes-himawari-demo';
export const GOES_HIMAWARI_SOURCE_ID = 'goes-himawari-demo-src';
export const GOES_GK2A_LAYER_ID = 'goes-gk2a-demo';
export const GOES_GK2A_SOURCE_ID = 'goes-gk2a-demo-src';

const EAST_BASE = String(goesEast.baseUrl || 'https://sat.disasterdb.com').replace(
  /\/$/,
  ''
);
const EAST_PREFIX = goesEast.pathPrefix || '/geocolor/goes-east';
const EAST_FRAME_RETRY_SLOTS = goesEast.frameRetrySlots ?? 6;

const WEST_BASE = String(goesWest.baseUrl || 'https://sat.disasterdb.com').replace(
  /\/$/,
  ''
);
const WEST_PREFIX = goesWest.pathPrefix || '/geocolor/goes-west';
const WEST_FRAME_RETRY_SLOTS = goesWest.frameRetrySlots ?? 6;

const WEST_WIDL_BASE = String(
  goesWestWidl?.baseUrl || goesWest.baseUrl || 'https://sat.disasterdb.com'
).replace(/\/$/, '');
const WEST_WIDL_PREFIX = goesWestWidl?.pathPrefix || '/geocolor/goes-west-widl';

const METEOSAT_BASE = String(goesMeteosat?.baseUrl || 'https://sat.disasterdb.com').replace(
  /\/$/,
  ''
);
const METEOSAT_PREFIX = goesMeteosat?.pathPrefix || '/geocolor/meteosat';
const METEOSAT_FRAME_RETRY_SLOTS = goesMeteosat?.frameRetrySlots ?? 6;

const HIMAWARI_BASE = String(goesHimawari?.baseUrl || 'https://sat.disasterdb.com').replace(
  /\/$/,
  ''
);
const HIMAWARI_PREFIX = goesHimawari?.pathPrefix || '/geocolor/himawari';
const HIMAWARI_FRAME_RETRY_SLOTS = goesHimawari?.frameRetrySlots ?? 6;

const GK2A_BASE = String(goesGk2a?.baseUrl || 'https://sat.disasterdb.com').replace(
  /\/$/,
  ''
);
const GK2A_PREFIX = goesGk2a?.pathPrefix || '/geocolor/gk2a';
const GK2A_FRAME_RETRY_SLOTS = goesGk2a?.frameRetrySlots ?? 6;

// ---------------------------------------------------------------------------
// Owned frames — ymd / hhmm on 10-minute cadence (shared East + West)
// ---------------------------------------------------------------------------

/** Pad to 2 digits. */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Floor a Date (UTC) to the 10-minute grid → { ymd, hhmm, iso }.
 * hhmm = HH + floor(minute/10)*10 as 4 digits (2310, 2320).
 */
export function floorUtcToOwnedFrame(date = new Date()) {
  const ms = typeof date === 'number' ? date : date.getTime();
  const d = new Date(ms);
  const flooredMin = Math.floor(d.getUTCMinutes() / 10) * 10;
  d.setUTCMinutes(flooredMin, 0, 0);
  const ymd = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const hhmm = `${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}`;
  return { ymd, hhmm, iso: d.toISOString().replace(/\.\d{3}Z$/, 'Z'), ms: d.getTime() };
}

/** Step one 10-minute slot backward. */
export function stepBackOwnedFrame({ ymd, hhmm }) {
  const hh = Number(hhmm.slice(0, 2));
  const mm = Number(hhmm.slice(2, 4));
  const [Y, M, D] = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D, hh, mm, 0, 0));
  d.setUTCMinutes(d.getUTCMinutes() - 10);
  return floorUtcToOwnedFrame(d);
}

function ownedTileUrl(ymd, hhmm, baseUrl, pathPrefix) {
  const root = String(baseUrl || '').replace(/\/$/, '');
  const prefix = pathPrefix.startsWith('/') ? pathPrefix : `/${pathPrefix}`;
  return `${root}${prefix}/${ymd}/${hhmm}/{z}/{x}/{y}.png`;
}

/** Raw owned East HTTPS XYZ template (probes / upstream fetch). */
function ownedGoesEastTileUrlRaw(ymd, hhmm, baseUrl = EAST_BASE) {
  return ownedTileUrl(ymd, hhmm, baseUrl, EAST_PREFIX);
}

/** Owned East XYZ template — wrapped for client linear East↔Meteosat seam fade. */
export function ownedGoesEastTileUrl(ymd, hhmm, baseUrl = EAST_BASE) {
  registerGoesEastSeamProtocol();
  return wrapLonSeamUrl(GOES_EAST_SEAM_PROTOCOL, ownedGoesEastTileUrlRaw(ymd, hhmm, baseUrl));
}

/** Raw owned West HTTPS XYZ template (probes / upstream fetch). */
function ownedGoesWestTileUrlRaw(ymd, hhmm, baseUrl = WEST_BASE) {
  return ownedTileUrl(ymd, hhmm, baseUrl, WEST_PREFIX);
}

/**
 * Owned West-family XYZ — one MapLibre source, two CDN tilers.
 * Dual-template protocol routes −lon → goes-west (EW) and +lon → goes-west-widl (WG)
 * so tiles abut inside one source (no IDL cross-source feather gap).
 */
export function ownedGoesWestTileUrl(ymd, hhmm, baseUrl = WEST_BASE) {
  registerGoesWestFamilySeamProtocol();
  const west = ownedGoesWestTileUrlRaw(ymd, hhmm, baseUrl);
  const widl = ownedGoesWestWidlTileUrlRaw(ymd, hhmm);
  return wrapLonSeamUrl(GOES_WEST_FAMILY_SEAM_PROTOCOL, `${west}|${widl}`);
}

/** Raw owned West-widl HTTPS XYZ template (probes / upstream fetch). */
function ownedGoesWestWidlTileUrlRaw(ymd, hhmm, baseUrl = WEST_WIDL_BASE) {
  return ownedTileUrl(ymd, hhmm, baseUrl, WEST_WIDL_PREFIX);
}

/**
 * Owned West-widl XYZ (probe / legacy). Live map uses ownedGoesWestTileUrl family
 * protocol so IDL neighbors share one MapLibre source.
 */
export function ownedGoesWestWidlTileUrl(ymd, hhmm, baseUrl = WEST_WIDL_BASE) {
  registerGoesWestWidlSeamProtocol();
  return wrapLonSeamUrl(
    GOES_WEST_WIDL_SEAM_PROTOCOL,
    ownedGoesWestWidlTileUrlRaw(ymd, hhmm, baseUrl)
  );
}

/** Raw owned Meteosat HTTPS XYZ template (probes / upstream fetch). */
function ownedGoesMeteosatTileUrlRaw(ymd, hhmm, baseUrl = METEOSAT_BASE) {
  return ownedTileUrl(ymd, hhmm, baseUrl, METEOSAT_PREFIX);
}

/** Owned Meteosat XYZ template — wrapped for client linear Meteosat↔GK2A seam fade. */
export function ownedGoesMeteosatTileUrl(ymd, hhmm, baseUrl = METEOSAT_BASE) {
  registerGoesMeteosatSeamProtocol();
  return wrapLonSeamUrl(
    GOES_MET_SEAM_PROTOCOL,
    ownedGoesMeteosatTileUrlRaw(ymd, hhmm, baseUrl)
  );
}

// ---------------------------------------------------------------------------
// Client lon-alpha seam fade (western sat of each pair prioritized)
// Formula: w = clamp((lon - cut + width/2) / width, 0, 1); westOfPairAlpha = 1 - w
// West (Hawaii): EW fade only; +lon clear (widl owns IDL half).
// West-widl: WG IDL inverse fade toward GK2A — see westWidlSeamAlpha.
// ---------------------------------------------------------------------------

const GOES_WEST_SEAM_PROTOCOL = 'goeswestseam';
const GOES_WEST_WIDL_SEAM_PROTOCOL = 'goeswestwidlseam';
const GOES_WEST_FAMILY_SEAM_PROTOCOL = 'goeswestfamilyseam';
const GOES_EAST_SEAM_PROTOCOL = 'goeseastseam';
const GOES_MET_SEAM_PROTOCOL = 'goesmetseam';
const registeredLonSeamProtocols = new Set();

/**
 * Linear western-of-pair alpha vs longitude. Pure linear — no cosine/smoothstep.
 * w = clamp((lon - cut + width/2) / width, 0, 1); westOfPairAlpha = 1 - w
 */
export function lonSeamAlpha(lon, cutLon, width = GOES_EW_FADE_WIDTH) {
  const half = width / 2;
  const w = Math.min(1, Math.max(0, (lon - cutLon + half) / width));
  return 1 - w;
}

/**
 * GOES-West (east-of-IDL / Hawaii) alpha: Pacific EW seam only.
 *
 * −lon / Americas: western-of-EW-pair fades at GOES_EW_CUT_LON (−132.5).
 * +lon / west-of-IDL: clear — that half moved to goes-west-widl.
 */
export function westSeamAlpha(lon) {
  if (lon > 0) return 0;
  return lonSeamAlpha(lon, GOES_EW_CUT_LON);
}

/**
 * GOES-West-widl (west-of-IDL) alpha: GK2A↔West IDL seam only.
 * Stack keeps widl above GK2A, so widl (eastern of the WG pair) uses inverse
 * western-of-pair alpha at GOES_WG_CUT_LON (169) — transparent west of band
 * (GK2A shows), opaque east of band (widl owns toward the date line).
 */
export function westWidlSeamAlpha(lon) {
  return 1 - lonSeamAlpha(lon, GOES_WG_CUT_LON);
}

/** East↔Meteosat: fade GOES-East at GOES_EM_CUT_LON. */
export function eastEmSeamAlpha(lon) {
  return lonSeamAlpha(lon, GOES_EM_CUT_LON);
}

/** Meteosat↔GK2A: fade Meteosat at GOES_MG_CUT_LON. */
export function meteosatMgSeamAlpha(lon) {
  return lonSeamAlpha(lon, GOES_MG_CUT_LON);
}

function wrapLonSeamUrl(protocol, httpsUrl) {
  const s = String(httpsUrl || '');
  const prefix = `${protocol}://`;
  if (s.startsWith(prefix)) return s;
  return `${prefix}${s}`;
}

function parseLonSeamUpstream(protocol, protocolUrl) {
  const prefix = `${protocol}://`;
  const upstream = String(protocolUrl || '').startsWith(prefix)
    ? String(protocolUrl).slice(prefix.length)
    : String(protocolUrl || '');
  const m = upstream.match(/\/(\d+)\/(\d+)\/(\d+)\.png(?:\?|$)/i);
  if (!m) {
    throw new Error(`[${protocol}] bad tile URL: ${protocolUrl}`);
  }
  return {
    upstream,
    z: Number(m[1]),
    tileX: Number(m[2]),
    tileY: Number(m[3])
  };
}

/**
 * Worker-safe canvas: OffscreenCanvas in workers (no `document`), else DOM canvas.
 * Encode via convertToBlob (OffscreenCanvas) or toBlob (HTMLCanvasElement).
 */
function createLonSeamCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error('[goes-lon-seam] no canvas (need OffscreenCanvas or document)');
}

async function encodeCanvasPng(canvas) {
  if (typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blob.arrayBuffer();
  }
  if (typeof canvas.toBlob === 'function') {
    const outBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('[goes-lon-seam] PNG encode failed'))),
        'image/png'
      );
    });
    return outBlob.arrayBuffer();
  }
  throw new Error('[goes-lon-seam] PNG encode unavailable');
}

/**
 * Precomputed 256×256 fully transparent PNG. Used when a seam tile is wholly
 * outside the western-of-pair band (alpha 0) — skip fetch + OffscreenCanvas.
 */
const TRANSPARENT_TILE_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAABFUlEQVR42u3BMQEAAADCoPVP7WsIoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMBPAAB2ClDBAAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
).buffer;

/** Conservative lon span of XYZ tile (pixel centers). */
export function tileLonSpan(z, tileX) {
  const n = 2 ** z;
  return {
    lonLeft: ((tileX + 0.5 / 256) / n) * 360 - 180,
    lonRight: ((tileX + 255.5 / 256) / n) * 360 - 180
  };
}

/**
 * Classify a tile vs seam cut before fetch/canvas.
 * @returns {'passthrough'|'clear'|'fade'}
 *   passthrough — return upstream bytes unchanged (opaque western / west-of-band)
 *   clear — fully transparent (skip network + canvas; use TRANSPARENT_TILE_PNG)
 *   fade — intersects fade band (fetch + per-pixel alpha)
 */
export function lonSeamTileDisposition(z, tileX, cutLon, width = GOES_EW_FADE_WIDTH) {
  const half = width / 2;
  const { lonLeft, lonRight } = tileLonSpan(z, tileX);

  // West Hawaii (east-of-IDL): EW fade only; +lon belongs to widl.
  if (cutLon === GOES_EW_CUT_LON) {
    const ewWest = GOES_EW_CUT_LON - half;
    const ewEast = GOES_EW_CUT_LON + half;
    if (lonRight <= ewWest) return 'passthrough';
    // Wholly +lon, or wholly east of EW on −lon (Atlantic / central hole).
    if (lonLeft >= 0 || (lonRight <= 0 && lonLeft >= ewEast)) return 'clear';
    return 'fade';
  }

  // West-widl (west-of-IDL / WG): inverse WG fade; −lon belongs to Hawaii West.
  if (cutLon === GOES_WG_CUT_LON) {
    const wgWest = GOES_WG_CUT_LON - half;
    const wgEast = GOES_WG_CUT_LON + half;
    if (lonLeft >= wgEast) return 'passthrough';
    if (lonRight <= 0 || lonRight <= wgWest) return 'clear';
    return 'fade';
  }

  // EM / MG: western-of-pair opaque west of band; clear east of band.
  const bandWest = cutLon - half;
  const bandEast = cutLon + half;
  if (lonRight <= bandWest) return 'passthrough';
  if (lonLeft >= bandEast) return 'clear';
  return 'fade';
}

/**
 * Decode PNG → multiply alpha by seam alpha(lon) → re-encode PNG.
 * West (GOES_EW_CUT_LON): westSeamAlpha (EW only; +lon clear).
 * West-widl (GOES_WG_CUT_LON): westWidlSeamAlpha (WG inverse).
 * EM / MG tiles use lonSeamAlpha at their cut.
 * Callers should skip this for disposition 'clear' / 'passthrough' when possible.
 */
export async function applyLonSeamFadeToPng(
  arrayBuffer,
  z,
  tileX,
  _tileY,
  cutLon,
  width = GOES_EW_FADE_WIDTH
) {
  const disposition = lonSeamTileDisposition(z, tileX, cutLon, width);
  if (disposition === 'passthrough') return arrayBuffer;
  if (disposition === 'clear') return TRANSPARENT_TILE_PNG.slice(0);

  const n = 2 ** z;
  const isWestHawaii = cutLon === GOES_EW_CUT_LON;
  const isWestWidl = cutLon === GOES_WG_CUT_LON;

  const blob = new Blob([arrayBuffer], { type: 'image/png' });
  const bitmap = await createImageBitmap(blob);
  const wPx = bitmap.width;
  const hPx = bitmap.height;
  const canvas = createLonSeamCanvas(wPx, hPx);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('[goes-lon-seam] 2d context unavailable');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, wPx, hPx);
  const data = imageData.data;
  for (let py = 0; py < hPx; py++) {
    for (let px = 0; px < wPx; px++) {
      const i = (py * wPx + px) * 4;
      const a = data[i + 3];
      if (a === 0) continue;
      const lon = ((tileX + (px + 0.5) / wPx) / n) * 360 - 180;
      const alpha = isWestHawaii
        ? westSeamAlpha(lon)
        : isWestWidl
          ? westWidlSeamAlpha(lon)
          : lonSeamAlpha(lon, cutLon, width);
      data[i + 3] = Math.round(a * alpha);
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return encodeCanvasPng(canvas);
}

/** @deprecated prefer applyLonSeamFadeToPng(..., GOES_EW_CUT_LON) */
export async function applyWestSeamFadeToPng(arrayBuffer, z, tileX, tileY) {
  return applyLonSeamFadeToPng(arrayBuffer, z, tileX, tileY, GOES_EW_CUT_LON);
}

/**
 * Idempotent MapLibre protocol: multiply tile alpha by lonSeamAlpha at cutLon.
 * Worker-safe OffscreenCanvas path.
 */
export function registerLonSeamProtocol(protocol, cutLon, ml = maplibregl) {
  if (registeredLonSeamProtocols.has(protocol)) return;
  if (!ml || typeof ml.addProtocol !== 'function') {
    throw new Error(`[${protocol}] maplibregl.addProtocol unavailable`);
  }
  ml.addProtocol(protocol, async (params, abortController) => {
    const { upstream, z, tileX, tileY } = parseLonSeamUpstream(protocol, params.url);
    // Skip CDN + OffscreenCanvas when the whole tile is outside the fade band.
    const disposition = lonSeamTileDisposition(z, tileX, cutLon);
    if (disposition === 'clear') {
      return { data: TRANSPARENT_TILE_PNG.slice(0) };
    }
    const res = await fetch(upstream, {
      method: 'GET',
      signal: abortController?.signal
    });
    if (!res.ok) {
      throw new Error(`Tile fetch error: ${res.status} ${res.statusText}`);
    }
    const raw = await res.arrayBuffer();
    if (disposition === 'passthrough') {
      return { data: raw };
    }
    const data = await applyLonSeamFadeToPng(raw, z, tileX, tileY, cutLon);
    return { data };
  });
  registeredLonSeamProtocols.add(protocol);
}

/** West Hawaii tiles: EW (−132.5) via westSeamAlpha; +lon hard-clear. */
export function registerGoesWestSeamProtocol(ml = maplibregl) {
  registerLonSeamProtocol(GOES_WEST_SEAM_PROTOCOL, GOES_EW_CUT_LON, ml);
}

/**
 * West-widl tiles: WG/IDL (169) inverse via westWidlSeamAlpha.
 * Soft-404 → transparent (widl may lag West tip before CDN / latest.json catch up).
 */
export function registerGoesWestWidlSeamProtocol(ml = maplibregl) {
  const protocol = GOES_WEST_WIDL_SEAM_PROTOCOL;
  const cutLon = GOES_WG_CUT_LON;
  if (registeredLonSeamProtocols.has(protocol)) return;
  if (!ml || typeof ml.addProtocol !== 'function') {
    throw new Error(`[${protocol}] maplibregl.addProtocol unavailable`);
  }
  ml.addProtocol(protocol, async (params, abortController) => {
    const { upstream, z, tileX, tileY } = parseLonSeamUpstream(protocol, params.url);
    const disposition = lonSeamTileDisposition(z, tileX, cutLon);
    if (disposition === 'clear') {
      return { data: TRANSPARENT_TILE_PNG.slice(0) };
    }
    const res = await fetch(upstream, {
      method: 'GET',
      signal: abortController?.signal
    });
    if (!res.ok) {
      // Missing widl frame / still rolling out — do not throw (keeps Hawaii West up).
      return { data: TRANSPARENT_TILE_PNG.slice(0) };
    }
    const raw = await res.arrayBuffer();
    if (disposition === 'passthrough') {
      return { data: raw };
    }
    const data = await applyLonSeamFadeToPng(raw, z, tileX, tileY, cutLon);
    return { data };
  });
  registeredLonSeamProtocols.add(protocol);
}

/**
 * West family: one protocol, two CDN tilers. MapLibre sees a single raster source
 * so IDL-adjacent XYZ tiles (x=2^z-1 and x=0) are neighbors inside one source —
 * avoids the translucent grey feather gap when west + west-widl were separate
 * sources meeting at ±180 after the cook split.
 *
 * Routing: wholly −lon → goes-west + EW seam; wholly +lon → goes-west-widl + WG
 * seam; tiles spanning lon 0 (low-z) → dual fetch + per-pixel composite.
 * Widl half soft-404s to transparent (may lag West tip).
 */
export function registerGoesWestFamilySeamProtocol(ml = maplibregl) {
  const protocol = GOES_WEST_FAMILY_SEAM_PROTOCOL;
  if (registeredLonSeamProtocols.has(protocol)) return;
  if (!ml || typeof ml.addProtocol !== 'function') {
    throw new Error(`[${protocol}] maplibregl.addProtocol unavailable`);
  }
  ml.addProtocol(protocol, async (params, abortController) => {
    const prefix = `${protocol}://`;
    const body = String(params.url || '').startsWith(prefix)
      ? String(params.url).slice(prefix.length)
      : String(params.url || '');
    // Dual CDN templates joined by | (MapLibre only substitutes {z}/{x}/{y}).
    const parts = body.split('|');
    if (parts.length !== 2) {
      throw new Error(`[${protocol}] bad dual URL: ${params.url}`);
    }
    const [westUpstream, widlUpstream] = parts;
    const m = westUpstream.match(/\/(\d+)\/(\d+)\/(\d+)\.png(?:\?|$)/i);
    if (!m) {
      throw new Error(`[${protocol}] bad west tile URL: ${westUpstream}`);
    }
    const z = Number(m[1]);
    const tileX = Number(m[2]);
    const tileY = Number(m[3]);
    const { lonLeft, lonRight } = tileLonSpan(z, tileX);
    const signal = abortController?.signal;

    // Wholly −lon: Hawaii west only.
    if (lonRight <= 0) {
      const disp = lonSeamTileDisposition(z, tileX, GOES_EW_CUT_LON);
      if (disp === 'clear') return { data: TRANSPARENT_TILE_PNG.slice(0) };
      const res = await fetch(westUpstream, { method: 'GET', signal });
      if (!res.ok) throw new Error(`Tile fetch error: ${res.status} ${res.statusText}`);
      const raw = await res.arrayBuffer();
      if (disp === 'passthrough') return { data: raw };
      return { data: await applyLonSeamFadeToPng(raw, z, tileX, tileY, GOES_EW_CUT_LON) };
    }

    // Wholly +lon: widl only (soft-404 → transparent).
    if (lonLeft >= 0) {
      const disp = lonSeamTileDisposition(z, tileX, GOES_WG_CUT_LON);
      if (disp === 'clear') return { data: TRANSPARENT_TILE_PNG.slice(0) };
      const res = await fetch(widlUpstream, { method: 'GET', signal });
      if (!res.ok) return { data: TRANSPARENT_TILE_PNG.slice(0) };
      const raw = await res.arrayBuffer();
      if (disp === 'passthrough') return { data: raw };
      return { data: await applyLonSeamFadeToPng(raw, z, tileX, tileY, GOES_WG_CUT_LON) };
    }

    // Spans lon 0 (low-z): composite west (−lon) + widl (+lon) per pixel.
    return { data: await compositeWestFamilyTile(westUpstream, widlUpstream, z, tileX, tileY, signal) };
  });
  registeredLonSeamProtocols.add(protocol);
}

/** Dual-fetch composite for low-z tiles that cross lon 0. */
async function compositeWestFamilyTile(westUrl, widlUrl, z, tileX, tileY, signal) {
  const fetchHalf = async (url, soft) => {
    try {
      const res = await fetch(url, { method: 'GET', signal });
      if (!res.ok) return soft ? null : null;
      return res.arrayBuffer();
    } catch {
      return null;
    }
  };
  const [westRaw, widlRaw] = await Promise.all([
    fetchHalf(westUrl, false),
    fetchHalf(widlUrl, true)
  ]);
  if (!westRaw && !widlRaw) return TRANSPARENT_TILE_PNG.slice(0);
  // Decode both through seam (west clears +lon; widl clears −lon / WG).
  const westFaded = westRaw
    ? await applyLonSeamFadeToPng(westRaw, z, tileX, tileY, GOES_EW_CUT_LON)
    : null;
  const widlFaded = widlRaw
    ? await applyLonSeamFadeToPng(widlRaw, z, tileX, tileY, GOES_WG_CUT_LON)
    : null;

  const decode = async (buf) => {
    if (!buf) return null;
    const blob = new Blob([buf], { type: 'image/png' });
    return createImageBitmap(blob);
  };
  const westBmp = await decode(westFaded);
  const widlBmp = await decode(widlFaded);
  const wPx = westBmp?.width || widlBmp?.width || 256;
  const hPx = westBmp?.height || widlBmp?.height || 256;
  const canvas = createLonSeamCanvas(wPx, hPx);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    westBmp?.close?.();
    widlBmp?.close?.();
    throw new Error('[goes-west-family] 2d context unavailable');
  }
  if (westBmp) {
    ctx.drawImage(westBmp, 0, 0);
    westBmp.close();
  }
  if (widlBmp) {
    // Draw widl on top — its seam alpha already clears −lon / west-of-WG.
    ctx.drawImage(widlBmp, 0, 0);
    widlBmp.close();
  }
  return encodeCanvasPng(canvas);
}

/** East tiles: East↔Meteosat seam at GOES_EM_CUT_LON. */
export function registerGoesEastSeamProtocol(ml = maplibregl) {
  registerLonSeamProtocol(GOES_EAST_SEAM_PROTOCOL, GOES_EM_CUT_LON, ml);
}

/** Meteosat tiles: Meteosat↔GK2A seam at GOES_MG_CUT_LON. */
export function registerGoesMeteosatSeamProtocol(ml = maplibregl) {
  registerLonSeamProtocol(GOES_MET_SEAM_PROTOCOL, GOES_MG_CUT_LON, ml);
}

/** Register all lon-alpha seam protocols (idempotent). */
export function registerAllGoesSeamProtocols(ml = maplibregl) {
  registerGoesWestSeamProtocol(ml);
  registerGoesWestWidlSeamProtocol(ml);
  registerGoesWestFamilySeamProtocol(ml);
  registerGoesEastSeamProtocol(ml);
  registerGoesMeteosatSeamProtocol(ml);
}

/** Owned Himawari XYZ template — same Bunny shape as GOES. */
export function ownedGoesHimawariTileUrl(ymd, hhmm, baseUrl = HIMAWARI_BASE) {
  return ownedTileUrl(ymd, hhmm, baseUrl, HIMAWARI_PREFIX);
}

/** Owned GK2A XYZ template — same Bunny shape as GOES/Himawari. */
export function ownedGoesGk2aTileUrl(ymd, hhmm, baseUrl = GK2A_BASE) {
  return ownedTileUrl(ymd, hhmm, baseUrl, GK2A_PREFIX);
}

// ---------------------------------------------------------------------------
// latest.json — last-good frame per sat (replaces client 404 step-back)
// ---------------------------------------------------------------------------

const LATEST_JSON_URL =
  goesGeocolor.latestJson ||
  'https://sat.disasterdb.com/geocolor/latest.json';

/** @type {null | { fetchedAt: number, data: object }} */
let latestManifestCache = null;
const LATEST_CACHE_MS = 30 * 1000;

/** @type {null | { fetchedAt: number, data: object }} */
let timesManifestCache = null;
const TIMES_CACHE_MS = 60 * 1000;

const TIMES_JSON_URL =
  goesGeocolor.timesJson ||
  'https://sat.disasterdb.com/geocolor/times.json';

/** Tip UI: legacy 1h bar open flag — kept false; long slider retired for bottom transport. */
let scrubberTestOpen = false;
/**
 * User opened bottom transport via toolbar Satellite button.
 * Cold start keeps GeoColor default-on but transport hidden until this flag,
 * ?scrub=1, or theme.goesGeocolor.timeSlider.
 */
let transportUserOpen = false;
/** Expanded full transport vs minimized age chip (sat-on cold → chip). */
let transportExpanded = false;
/** Age ticker for chip / expanded age line. */
let transportAgeTimer = 0;
/** Last painted tip/scrub frame for age chip (center-sector when live). */
let transportClockFrame = null;
/** GK2A bottom-transport play loop (opt-in via Satellite button / ?scrub=1 / timeSlider). */
let gkPlaying = false;
let gkPlayTimer = null;
/** True while preloading the first play buffer (spinner on transport play btn). */
let gkBuffering = false;
/** Bumps to cancel an in-flight prefetch when play pauses / restarts. */
let gkPrefetchGen = 0;
/**
 * Monotonic clock epoch for scrub/play/Latest frame applies.
 * Bumped on scrub flush, play step, Latest, and pause so late setTiles /
 * seam work from an older target is dropped before paint.
 */
let gkClockGen = 0;
/** True while the user is dragging the transport scrub track (pause + seek). */
let gkUserDragging = false;
/**
 * True after the user has intentionally scrubbed (pointerdown on range) until
 * we snap back to live tip. Cold open / prime / tip-poll must NOT paint
 * playlist mid-frames (e.g. ~03:30 / ~2h13m) unless this is set — otherwise
 * a stale gkPlayIndex or range value=0 can overwrite latest.json tip clock.
 */
let gkIntentionalScrub = false;
/** Debounce timer to coalesce rapid scrub input → setTiles. */
let gkScrubTimer = 0;
/** Latest scrub index waiting to apply (coalesce; only this position paints). */
let gkPendingScrubIdx = null;
/** Play window length in hours (times.json frames ≤ tip age). */
const GK_PLAY_HOURS = 4;
/** ~350ms/step → ~2.8 fps of distinct frames (~4h / ~21–24 frames ≈ 7–9s wall). */
const GK_PLAY_INTERVAL_MS = 350;
/** Frames to warm before first play tick (rolling; rest keep prefetching). */
const GK_PLAY_BUFFER_FRAMES = 16;
/** Max concurrent HTTPS tile warms during buffer/prefetch. */
const GK_PLAY_PREFETCH_CONCURRENCY = 8;
/** While dragging, coalesce scrub applies to this many ms (latest index wins). */
const GK_SCRUB_COALESCE_MS = 48;
/** @type {null | object} */
let goesUiState = null;
/** @type {null | import('maplibre-gl').Map} */
let goesUiMap = null;

/** Chrome background-tab wake: debounced tip re-poll after visibility restore. */
const WAKE_DEBOUNCE_MS = 500;
let _wasHidden = false;
let _wakeTimer = 0;
let _tipWatchWired = false;
let _tipPollTimer = 0;
let _tipPollMs = 60 * 1000;
/** @type {null | ((opts?: { fromWake?: boolean }) => Promise<void>)} */
let _tipRefresh = null;

/**
 * Fetch (or reuse) https://sat.disasterdb.com/geocolor/times.json
 * Shape: { "goes-east": [unix, ...], "goes-west": [...], ... }
 */
export async function fetchGeocolorTimesManifest(opts = {}) {
  const force = Boolean(opts.force);
  const now = Date.now();
  if (
    !force &&
    timesManifestCache &&
    now - timesManifestCache.fetchedAt < TIMES_CACHE_MS
  ) {
    return timesManifestCache.data;
  }
  const res = await fetch(TIMES_JSON_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`times.json HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data !== 'object') {
    throw new Error('times.json: invalid body');
  }
  timesManifestCache = { fetchedAt: now, data };
  return data;
}


/**
 * Fetch (or reuse) https://sat.disasterdb.com/geocolor/latest.json
 * Shape: { updated, sats: { "goes-east": { ymd, hhmm, iso, unix }, ... } }
 *
 * In-memory reuse is ~30s (LATEST_CACHE_MS) for same-cycle resolve after a
 * forced tip poll. Wake / force always network-fetch. Every network hit uses a
 * unique ?t= URL + cache:'no-store' so iOS webview / HTTP caches cannot serve a
 * prior latest.json (stable URL + cache:'no-cache' was still sticky).
 */
export async function fetchGeocolorLatestManifest(opts = {}) {
  // Wake must never reuse the 30s memory cache even if force was omitted.
  const force = Boolean(opts.force) || Boolean(opts.fromWake);
  const now = Date.now();
  if (
    !force &&
    latestManifestCache &&
    now - latestManifestCache.fetchedAt < LATEST_CACHE_MS
  ) {
    return latestManifestCache.data;
  }
  const sep = LATEST_JSON_URL.includes('?') ? '&' : '?';
  const url = `${LATEST_JSON_URL}${sep}t=${now}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`latest.json HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data !== 'object' || !data.sats) {
    throw new Error('latest.json: missing sats');
  }
  latestManifestCache = { fetchedAt: now, data };
  return data;
}

/**
 * @param {string} satKey e.g. 'goes-east'
 * @param {object} [manifest]
 * @returns {{ ymd: string, hhmm: string, iso: string, ms: number } | null}
 */
export function frameFromLatestManifest(satKey, manifest) {
  const row = manifest?.sats?.[satKey];
  if (!row || !row.ymd || !row.hhmm) return null;
  const ms =
    typeof row.unix === 'number' && Number.isFinite(row.unix)
      ? row.unix * 1000
      : Date.parse(row.iso || `${row.ymd}T${row.hhmm.slice(0, 2)}:${row.hhmm.slice(2, 4)}:00Z`);
  return {
    ymd: row.ymd,
    hhmm: String(row.hhmm).padStart(4, '0'),
    iso: row.iso || isoZ(ms),
    ms: Number.isFinite(ms) ? ms : Date.now()
  };
}

async function resolveFromLatestOrProbe(satKey, probeResolve, label) {
  try {
    const man = await fetchGeocolorLatestManifest();
    const frame = frameFromLatestManifest(satKey, man);
    if (frame) return frame;
    console.warn(`[goes-geocolor] latest.json has no ${satKey}; short probe fallback`);
  } catch (e) {
    console.warn(`[goes-geocolor] latest.json (${label}):`, e.message);
  }
  // Cap fallback probes — full-window step-back looks like "cycling" and is slow
  // when latest.json is unreachable (e.g. CORS). Prefer floored-now if probe fails.
  try {
    return await probeResolve();
  } catch (e) {
    console.warn(`[goes-geocolor] probe fallback (${label}):`, e.message);
    return floorUtcToOwnedFrame();
  }
}

async function probeOwnedFrame(tileTpl) {
  const url = tileTpl.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0');
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-cache' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Probe z0/0/0 for an East frame; true on HTTP 200. */
export async function probeOwnedEastFrame(ymd, hhmm, baseUrl = EAST_BASE) {
  // Probe the real HTTPS tile — protocol wrap is for MapLibre sources only.
  return probeOwnedFrame(ownedGoesEastTileUrlRaw(ymd, hhmm, baseUrl));
}

/** Probe z0/0/0 for a West frame; true on HTTP 200. */
export async function probeOwnedWestFrame(ymd, hhmm, baseUrl = WEST_BASE) {
  // Probe the real HTTPS tile — protocol wrap is for MapLibre sources only.
  return probeOwnedFrame(ownedGoesWestTileUrlRaw(ymd, hhmm, baseUrl));
}

/** Probe z0/0/0 for a Meteosat frame; true on HTTP 200. */
export async function probeOwnedMeteosatFrame(ymd, hhmm, baseUrl = METEOSAT_BASE) {
  // Probe the real HTTPS tile — protocol wrap is for MapLibre sources only.
  return probeOwnedFrame(ownedGoesMeteosatTileUrlRaw(ymd, hhmm, baseUrl));
}

/** Probe z0/0/0 for a Himawari frame; true on HTTP 200. */
export async function probeOwnedHimawariFrame(ymd, hhmm, baseUrl = HIMAWARI_BASE) {
  return probeOwnedFrame(ownedGoesHimawariTileUrl(ymd, hhmm, baseUrl));
}

/** Probe z0/0/0 for a GK2A frame; true on HTTP 200. */
export async function probeOwnedGk2aFrame(ymd, hhmm, baseUrl = GK2A_BASE) {
  return probeOwnedFrame(ownedGoesGk2aTileUrl(ymd, hhmm, baseUrl));
}

async function resolveOwnedLatest(opts, probe, label) {
  const retries = opts.retries ?? EAST_FRAME_RETRY_SLOTS;
  let frame = floorUtcToOwnedFrame(opts.now ? new Date(opts.now) : new Date());
  let lastProbed = frame;
  for (let i = 0; i <= retries; i++) {
    lastProbed = frame;
    // eslint-disable-next-line no-await-in-loop
    const ok = await probe(frame.ymd, frame.hhmm, opts.baseUrl);
    if (ok) return frame;
    frame = stepBackOwnedFrame(frame);
  }
  console.warn(
    `[goes-geocolor] ${label}: no 200 frame in window; using ${lastProbed.ymd}/${lastProbed.hhmm}`
  );
  return lastProbed;
}

/**
 * Latest owned East frame: floor UTC to 10 min, then step back on 404
 * (upload lag / overnight gaps / stalled bake). Never returns an unprobed
 * floored-now — if the full window fails, returns the oldest probed slot.
 */
export async function resolveOwnedEastLatest(opts = {}) {
  return resolveFromLatestOrProbe('goes-east', () =>
    resolveOwnedLatest(
      { ...opts, retries: opts.retries ?? 6, baseUrl: opts.baseUrl ?? EAST_BASE },
      probeOwnedEastFrame,
      'East'
    ), 'East');
}

/**
 * Latest owned West frame — same last-good semantics as East.
 */
export async function resolveOwnedWestLatest(opts = {}) {
  return resolveFromLatestOrProbe('goes-west', () =>
    resolveOwnedLatest(
      { ...opts, retries: opts.retries ?? 6, baseUrl: opts.baseUrl ?? WEST_BASE },
      probeOwnedWestFrame,
      'West'
    ), 'West');
}

/** Latest owned Meteosat frame — same last-good semantics as East/West. */
export async function resolveOwnedMeteosatLatest(opts = {}) {
  return resolveFromLatestOrProbe('meteosat', () =>
    resolveOwnedLatest(
      {
        ...opts,
        retries: opts.retries ?? 6,
        baseUrl: opts.baseUrl ?? METEOSAT_BASE
      },
      probeOwnedMeteosatFrame,
      'Meteosat'
    ), 'Meteosat');
}

/** Latest owned Himawari frame — same last-good semantics as East/West. */
export async function resolveOwnedHimawariLatest(opts = {}) {
  return resolveFromLatestOrProbe('himawari', () =>
    resolveOwnedLatest(
      {
        ...opts,
        retries: opts.retries ?? 6,
        baseUrl: opts.baseUrl ?? HIMAWARI_BASE
      },
      probeOwnedHimawariFrame,
      'Himawari'
    ), 'Himawari');
}

/** Latest owned GK2A frame — same last-good semantics as East/West. */
export async function resolveOwnedGk2aLatest(opts = {}) {
  return resolveFromLatestOrProbe('gk2a', () =>
    resolveOwnedLatest(
      {
        ...opts,
        retries: opts.retries ?? 6,
        baseUrl: opts.baseUrl ?? GK2A_BASE
      },
      probeOwnedGk2aFrame,
      'GK2A'
    ), 'GK2A');
}

/** @deprecated East is owned; kept for callers that still pass ISO times. */
export function goesEastTileUrl(time) {
  const ms = Date.parse(time);
  const frame = floorUtcToOwnedFrame(Number.isFinite(ms) ? ms : Date.now());
  return ownedGoesEastTileUrl(frame.ymd, frame.hhmm);
}

/** @deprecated West is owned; GIBS template unused. */
export function goesTileUrl(layerIdent, time) {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerIdent}` +
    `/default/${time}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`
  );
}

function isoZ(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Floor an ISO8601 UTC timestamp to the stepMinutes grid. */
export function floorToStep(iso, stepMinutes) {
  const stepMs = stepMinutes * 60 * 1000;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) throw new Error(`bad time: ${iso}`);
  return isoZ(Math.floor(ms / stepMs) * stepMs);
}

/**
 * Rolling list from (latest − hours) … latest inclusive, stepMinutes apart.
 * Ascending (oldest → newest) for a left-to-right slider.
 */
export function buildTimeList(latestIso, hours, stepMinutes) {
  const stepMs = stepMinutes * 60 * 1000;
  const end = Date.parse(floorToStep(latestIso, stepMinutes));
  const start = end - hours * 60 * 60 * 1000;
  const times = [];
  for (let t = start; t <= end; t += stepMs) {
    times.push(isoZ(t));
  }
  return times;
}

/**
 * @deprecated West no longer uses GIBS capabilities.
 * Kept so older call sites / docs samples do not break imports.
 */
export async function fetchGoesDefaultTime(
  layerIdent,
  capabilitiesUrl,
  opts = {}
) {
  const url =
    capabilitiesUrl ||
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml';
  const timeoutMs = opts.timeoutMs ?? 8000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`GIBS capabilities timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`GIBS capabilities HTTP ${res.status}`);
  }
  const xml = await res.text();
  const needle = `${layerIdent}</ows:Identifier>`;
  const at = xml.indexOf(needle);
  if (at < 0) {
    throw new Error(`${layerIdent} missing from GIBS capabilities`);
  }
  const window = xml.slice(at, at + 2500);
  const m = window.match(
    /<Default>(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)<\/Default>/
  );
  if (!m) {
    throw new Error(`no Default time for ${layerIdent}`);
  }
  return m[1];
}

/** @deprecated East no longer uses GIBS Default. */
export async function fetchGoesEastDefaultTime() {
  const frame = await resolveOwnedEastLatest();
  return frame.iso;
}

function beforeId(map) {
  // Prefer contour-lines so GeoColor sits under isolines at low zoom.
  // contour-lines is spliced AFTER water/earth/landcover/landuse/buildings
  // (style.js) — inserting here keeps those fills UNDER the sat rasters.
  // Fallback: roads-simple / coast/ADM, which are also above the fills.
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

/** Active fade cutoff: mobile 8.3 / desktop tunable. */
export function goesFadeCutoff() {
  const fade = goesGeocolor.fade || {};
  const q = fade.mobileQuery || '(max-width: 768px), (pointer: coarse)';
  let mobile = false;
  try {
    mobile = typeof window !== 'undefined' && window.matchMedia?.(q)?.matches;
  } catch {
    mobile = false;
  }
  const cutoff = mobile
    ? Number(fade.mobileCutoff ?? 8.3)
    : Number(fade.desktopCutoff ?? 7.8);
  return Number.isFinite(cutoff) ? cutoff : 8;
}

/** Zoom opacity: full strength until a short fade into cutoff. */
export function goesOpacityByZoom() {
  const fade = goesGeocolor.fade || {};
  const cutoff = goesFadeCutoff();
  const full = Number(fade.fullOpacity ?? 1);
  const span = Math.max(0.15, Number(fade.fadeSpan ?? 0.55));
  const holdZ = Math.max(0, cutoff - span);
  return [
    'interpolate', ['linear'], ['zoom'],
    0, full,
    holdZ, full,
    cutoff, 0
  ];
}

/** Raster paint: identity color grade + zoom opacity fade (all GeoColor sats). */
export function goesRasterPaint() {
  const g = goesGeocolor.cloudGrade || {};
  return {
    'raster-opacity': goesOpacityByZoom(),
    'raster-brightness-min': g.brightnessMin ?? 0,
    'raster-brightness-max': g.brightnessMax ?? 1,
    'raster-contrast': g.contrast ?? 0,
    'raster-saturation': g.saturation ?? 0,
    'raster-resampling': g.resampling || 'linear',
    'raster-fade-duration': 0
  };
}

/** Low-z preview pyramid (few tiles) — overzooms so the globe isn’t blank. */
const PREVIEW_MAXZOOM = 2;
const loId = (id) => `${id}-lo`;

/**
 * Bottom→top stack: GK2A → Meteosat → East → West-family.
 * West-family is one layer (dual CDN protocol) so IDL neighbors share a source.
 */
function restackGoesLayers(map, before) {
  const order = [
    GOES_GK2A_LAYER_ID,
    GOES_METEOSAT_LAYER_ID,
    GOES_EAST_LAYER_ID,
    GOES_WEST_LAYER_ID
  ];
  for (const layerId of order) {
    if (map.getLayer(layerId)) {
      map.moveLayer(layerId, before);
    }
    const lo = loId(layerId);
    if (map.getLayer(lo) && map.getLayer(layerId)) {
      map.moveLayer(lo, layerId);
    } else if (map.getLayer(lo)) {
      map.moveLayer(lo, before);
    }
  }
}

/**
 * Coverage box (west,south,east,north) for JS viewport cull during play/scrub.
 * West family formerly one antimeridian-spanning box
 * [WG−half, −85, EW+half, 85]; that cull now spans two layers (Hawaii West +
 * widl). Half-width padding keeps the fade band itself in-coverage.
 *
 * Do NOT pass a west>east box to MapLibre raster `bounds` — TileBounds builds
 * minX/maxX from mercatorX(west)/mercatorX(east) with no wrap, so west>east ⇒
 * minX>maxX ⇒ hasTile() never true and West vanishes (#81 regression). Hawaii
 * West MapLibre bounds stay null; widl uses a non-wrapping +lon box.
 */
function satSourceBounds(sat) {
  const half = GOES_EW_FADE_WIDTH / 2 + 0.5;
  switch (sat) {
    case 'east':
      // Opaque west of EM band; clear east of band (#68). Skip Africa/Asia.
      return [-150, -85, GOES_EM_CUT_LON + half, 85];
    case 'meteosat':
      // Useful Atlantic–IO; skip CONUS/Pacific passthrough fetches.
      return [GOES_EM_CUT_LON - half, -85, GOES_MG_CUT_LON + half, 85];
    case 'gk2a':
      // Korea–EA / west Pac; skip CONUS/Atlantic raw CDN fanout.
      return [GOES_MG_CUT_LON - half, -85, 180, 85];
    case 'west':
      // Full West family cull (Hawaii + IDL sliver). west>east spans antimeridian
      // so Fiji–Tonga views keep the dual-CDN source updating during play.
      return [GOES_WG_CUT_LON - half, -85, GOES_EW_CUT_LON + half, 85];
    case 'west-widl':
      // Legacy key — family is culled as 'west' now.
      return [GOES_WG_CUT_LON - half, -85, 180, 85];
    default:
      return null;
  }
}

/**
 * MapLibre raster source bounds. West-family stays unbounded (antimeridian-safe)
 * — same #81 lesson: west>east TileBounds never hasTile. Dual-CDN protocol
 * clears out-of-half tiles; JS cull uses satSourceBounds('west').
 */
function satMaplibreBounds(sat) {
  if (sat === 'west' || sat === 'west-widl') return null;
  return satSourceBounds(sat);
}

/**
 * True if sat source coverage intersects the current map viewport.
 * Extends #71 source-bounds fanout: skip setTiles for sats fully off-frame
 * during play/scrub (Europe should not thrash GK2A/West Pacific, and vice versa).
 * Coverage with west>east spans the antimeridian (West). Unknown map → true.
 */
function satViewportIntersects(map, sat) {
  const cov = satSourceBounds(sat);
  if (!cov) return true;
  if (!map || typeof map.getBounds !== 'function') return true;
  let b;
  try {
    b = map.getBounds();
  } catch {
    return true;
  }
  if (!b) return true;
  const west = b.getWest();
  const east = b.getEast();
  const south = b.getSouth();
  const north = b.getNorth();
  // Antimeridian / unwrapped world copies — be conservative.
  if (!(Number.isFinite(west) && Number.isFinite(east))) return true;
  if (east < west) return true;
  const [cw, cs, ce, cn] = cov;
  if (north < cs || south > cn) return false;
  // west>east ⇒ coverage is [cw,180] ∪ [-180,ce]; hole is (ce, cw).
  if (cw > ce) return !(west > ce && east < cw);
  if (east < cw || west > ce) return false;
  return true;
}

/** Apply owned tiles only when sat coverage meets the viewport (or force). */
function applyOwnedIfInView(map, sat, applyFn, frame, force = false) {
  if (!frame || typeof applyFn !== 'function') return false;
  if (!force && !satViewportIntersects(map, sat)) return false;
  applyFn(map, frame);
  return true;
}

/**
 * True if lng/lat lies inside satSourceBounds coverage (fade-expanded sector).
 * Antimeridian: west>east covers [cw,180] ∪ [-180,ce].
 */
function lngLatInSatCoverage(lng, lat, sat) {
  const cov = satSourceBounds(sat);
  if (!cov) return true;
  let x = Number(lng);
  const y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  const [cw, cs, ce, cn] = cov;
  if (y < cs || y > cn) return false;
  if (cw > ce) return x >= cw || x <= ce;
  return x >= cw && x <= ce;
}

/**
 * Exclusive hard-cut owner for a longitude (fade overlaps ignored).
 * west: ≤ EW cut or ≥ WG cut; east / meteosat / gk2a between cuts.
 */
function owningCullKeyForLon(lon) {
  let x = Number(lon);
  if (!Number.isFinite(x)) return null;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  if (x <= GOES_EW_CUT_LON || x >= GOES_WG_CUT_LON) return 'west';
  if (x <= GOES_EM_CUT_LON) return 'east';
  if (x <= GOES_MG_CUT_LON) return 'meteosat';
  return 'gk2a';
}

/** Short transport labels — west-family collapses to GOES-West. */
const TRANSPORT_SAT_META = {
  east: { label: 'GOES-East', order: 1 },
  west: { label: 'GOES-West', order: 2 },
  meteosat: { label: 'Meteosat', order: 3 },
  gk2a: { label: 'GK2A', order: 4 }
};

/** Cull key for the sat whose sector owns map.getCenter(). */
function primaryTipCullKeyForMap(map) {
  if (!map || typeof map.getCenter !== 'function') return null;
  let c;
  try {
    c = map.getCenter();
  } catch {
    return null;
  }
  if (!c || !Number.isFinite(c.lng) || !Number.isFinite(c.lat)) return null;
  return owningCullKeyForLon(c.lng);
}

function frameForCullKey(state, key) {
  if (!state || !key) return null;
  if (key === 'east') return state.eastFrame || null;
  if (key === 'west') return state.westFrame || null;
  if (key === 'meteosat') return state.metFrame || null;
  if (key === 'gk2a') return state.gkFrame || null;
  return null;
}

/** Newest tip among all owned sats (fallback when center owner tip missing). */
function globalMaxTipFrame(state) {
  if (!state) return null;
  const frames = [state.eastFrame, state.westFrame, state.metFrame, state.gkFrame].filter(
    Boolean
  );
  if (!frames.length) return null;
  return frames.reduce((a, b) => ((a?.ms || 0) >= (b?.ms || 0) ? a : b));
}

/**
 * Transport tip stamp: tip frame of the sat whose sector owns map.getCenter().
 * Edge-of-view sats do not override. Falls back to global max among tip keys
 * if center/owner tip is missing. Never min() / never pin to a lagging sat.
 */
function newestTipFrame(map, state) {
  if (!state) return null;
  const key = primaryTipCullKeyForMap(map);
  const owned = frameForCullKey(state, key);
  if (owned) return owned;
  return globalMaxTipFrame(state);
}

/** Primary center-sector sat label for transport meta (single name). */
function visibleSatLabelForTransport(map) {
  const key = primaryTipCullKeyForMap(map);
  if (!key) return null;
  return TRANSPORT_SAT_META[key]?.label || key;
}

/** Transport meta: "GOES-East · last ~4h" (center owner, not every sat in view). */
function paintTransportMeta(map = goesUiMap) {
  const meta = document.getElementById('goesTimeTransportMeta');
  if (!meta) return;
  const hours = playHoursLabel();
  const name = visibleSatLabelForTransport(map);
  if (name) {
    meta.textContent = `${name} · last ~${hours}h`;
    meta.title = `${name} — last ~${hours} hours`;
  } else {
    meta.textContent = `Last ~${hours}h`;
    meta.title = `Last ~${hours} hours`;
  }
}

/**
 * Live tip + transport open: refresh tip label for map-center sector.
 * Only skip while the user is actively dragging scrub or mid-play/buffer —
 * parked mid-timeline still catch-up to center-sector tip (stale age chip).
 */
function syncTipClockForViewport(map = goesUiMap) {
  if (!eitherGeocolorOn()) return;
  paintTransportMeta(map);
  if (!transportShouldShow()) return;
  // Active drag: do not steal the scrub. Mid-play: clock follows play frame.
  if (gkUserDragging || gkPlaying || gkBuffering) return;
  const state = goesUiState;
  if (!state || !map) return;
  const tip = newestTipFrame(map, state);
  if (!tip) return;
  state.tipFrame = tip;
  // Snap playlist to tip edge when not dragging/playing (incl. parked scrub).
  const frames = state.gkPlayFrames || [];
  if (frames.length) {
    state.gkPlayIndex = Math.max(0, frames.length - 1);
    state.scrubbing = false;
    syncScrubRange(state.gkPlayIndex, frames.length);
  }
  state.displayFrame = tip;
  state.currentTime = tip.iso;
  paintGkPlayLabel(tip, { show: true });
  if (transportShouldShow()) startTransportAgeTicker();
}

function ensureRaster(map, sourceId, layerId, tiles, cfg, before, attr, visibility = 'none') {
  const srcLo = loId(sourceId);
  const lyrLo = loId(layerId);
  for (const id of [layerId, lyrLo]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [sourceId, srcLo]) {
    if (map.getSource(id)) map.removeSource(id);
  }

  const tileSize = cfg.tileSize || 256;
  const detailMax = cfg.maxzoom ?? 7;
  const cutoff = goesFadeCutoff();
  const paint = goesRasterPaint();

  // Preview: only requests z0–z2 (fast), overzooms to cover the view while
  // detail tiles stream in on top — pyramid / progressive load.
  const bounds = cfg.bounds || null;
  const loSpec = {
    type: 'raster',
    tiles,
    tileSize,
    maxzoom: PREVIEW_MAXZOOM,
    attribution: attr
  };
  const detailSpec = {
    type: 'raster',
    tiles,
    tileSize,
    // Source maxzoom = native tile pyramid (overzoom still allowed below layer maxzoom).
    maxzoom: detailMax,
    attribution: attr
  };
  if (bounds) {
    loSpec.bounds = bounds;
    detailSpec.bounds = bounds;
  }

  map.addSource(srcLo, loSpec);
  map.addLayer(
    {
      id: lyrLo,
      type: 'raster',
      source: srcLo,
      maxzoom: cutoff,
      layout: { visibility },
      paint
    },
    before
  );

  map.addSource(sourceId, detailSpec);
  map.addLayer(
    {
      id: layerId,
      type: 'raster',
      source: sourceId,
      // Hard off at cutoff — no overzoom draw / fewer wasted paints past fade.
      maxzoom: cutoff,
      layout: { visibility },
      paint
    },
    before
  );
}


/** Initial layout visibility from the matching checkbox (default-on cold start). */
function visibilityFromCheckbox(checkboxId) {
  const box = document.getElementById(checkboxId);
  return box?.checked ? 'visible' : 'none';
}

function honourCheckbox(map, checkboxId, layerId) {
  const box = document.getElementById(checkboxId);
  const vis = box?.checked ? 'visible' : 'none';
  for (const id of [layerId, loId(layerId)]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  }
}

function eitherGeocolorOn() {
  const east = document.getElementById('lyr-goes-east-demo');
  const west = document.getElementById('lyr-goes-west-demo');
  const met = document.getElementById('lyr-goes-meteosat-demo');
  const gk = document.getElementById('lyr-goes-gk2a-demo');
  // Himawari parked — ignored for sat-mode pressed state
  return Boolean(east?.checked || west?.checked || met?.checked || gk?.checked);
}

/** Extent-aware mosaic credits — GOES-East/West labels (not GOES-19/18). */
const SECTOR_CREDITS = [
  { key: 'east', label: attribution.sectorEast },
  { key: 'west', label: attribution.sectorWest },
  { key: 'meteosat', label: attribution.sectorMeteosat },
  { key: 'gk2a', label: attribution.sectorGk2a }
];

let _lastMosaicAttr = null;
let _attribMoveWired = false;

function mosaicAttributionHtml(map) {
  const parts = [attribution.mosaicCopyright];
  for (const s of SECTOR_CREDITS) {
    if (satViewportIntersects(map, s.key)) parts.push(s.label);
  }
  return parts.join(' \u00B7 ');
}

function findAttributionControl(map) {
  for (const c of map._controls || []) {
    if (c?.options && typeof c._updateAttributions === 'function') return c;
  }
  return null;
}

/** Sync customAttribution: © DisasterDB + sats whose sectors meet the viewport. */
export function syncMosaicAttribution(map) {
  if (!map) return;
  const html = eitherGeocolorOn() ? mosaicAttributionHtml(map) : '';
  if (html === _lastMosaicAttr) return;
  _lastMosaicAttr = html;
  const ctrl = findAttributionControl(map);
  if (!ctrl) return;
  try {
    ctrl.options.customAttribution = html || null;
    ctrl._updateAttributions();
  } catch (e) {
    console.warn('[goes-geocolor] attrib sync', e?.message || e);
  }
}

function wireAttribExtent(map) {
  if (!map || _attribMoveWired) return;
  _attribMoveWired = true;
  map.on('moveend', () => {
    if (!eitherGeocolorOn()) return;
    syncMosaicAttribution(map);
    syncTipClockForViewport(map);
  });
  map.on('zoomend', () => {
    if (!eitherGeocolorOn()) return;
    syncMosaicAttribution(map);
    syncTipClockForViewport(map);
  });
}

function timeSliderEnabled() {
  // Tip: only while toolbar "1h" is pressed (default stays latest-only).
  return scrubberTestOpen;
}

function setTimeBarVisible(_on, _map) {
  const bar = document.getElementById('geocolorTimeBar');
  if (!bar) return;
  // Tip: long range slider retired — keep DOM but never show.
  bar.hidden = true;
  bar.style.display = 'none';
}

function safeSetTilesOne(map, sourceId, url, opts = {}) {
  const force = Boolean(opts.force);
  try {
    if (!map?.getStyle?.()) return;
    const src = map.getSource(sourceId);
    if (!src || typeof src.setTiles !== 'function') return;
    const prev = src.tiles?.[0] || src._options?.tiles?.[0];
    if (prev === url) {
      if (!force) return; // no-op — avoids thrash/crashes mid-zoom
      // Same ymd/hhmm but chip/tiles stale (leave-open freeze): clear then
      // re-set so MapLibre remounts the template / protocol cache.
      try {
        src.setTiles([]);
      } catch {
        /* ignore */
      }
      src.setTiles([url]);
      return;
    }
    src.setTiles([url]);
  } catch (e) {
    console.warn('[goes-geocolor] setTiles', sourceId, e.message);
  }
}

/** Latest times.json unix at or before target (per sat). */
function unixAtOrBefore(satKey, targetUnix, manifest) {
  const list = manifest?.[satKey];
  if (!Array.isArray(list) || !list.length || !Number.isFinite(targetUnix)) return null;
  let best = null;
  for (const u of list) {
    const n = Number(u);
    if (!Number.isFinite(n) || n > targetUnix) continue;
    if (best === null || n > best) best = n;
  }
  return best;
}

function frameAtOrBefore(satKey, targetUnix, manifest, fallback) {
  const u = unixAtOrBefore(satKey, targetUnix, manifest);
  if (u == null) return fallback || null;
  return floorUtcToOwnedFrame(u * 1000);
}

function safeSetTiles(map, sourceId, url, opts = {}) {
  safeSetTilesOne(map, sourceId, url, opts);
  safeSetTilesOne(map, loId(sourceId), url, opts);
}

function applyEastOwned(map, frame, opts = {}) {
  safeSetTiles(
    map,
    GOES_EAST_SOURCE_ID,
    ownedGoesEastTileUrl(frame.ymd, frame.hhmm),
    opts
  );
}

function applyWestOwned(map, frame, opts = {}) {
  safeSetTiles(
    map,
    GOES_WEST_SOURCE_ID,
    ownedGoesWestTileUrl(frame.ymd, frame.hhmm),
    opts
  );
}

/** @deprecated Widl is folded into the West-family protocol URL. */
function applyWestWidlOwned(_map, _frame, _opts) {
  // no-op — ownedGoesWestTileUrl already routes both CDN halves
}

/** Apply West family (Hawaii + date-line-west via one dual-CDN source). */
function applyWestFamilyOwned(map, frame, opts = {}) {
  applyWestOwned(map, frame, opts);
}

function applyMeteosatOwned(map, frame, opts = {}) {
  safeSetTiles(
    map,
    GOES_METEOSAT_SOURCE_ID,
    ownedGoesMeteosatTileUrl(frame.ymd, frame.hhmm),
    opts
  );
}

function applyHimawariOwned(map, frame, opts = {}) {
  safeSetTiles(
    map,
    GOES_HIMAWARI_SOURCE_ID,
    ownedGoesHimawariTileUrl(frame.ymd, frame.hhmm),
    opts
  );
}

function applyGk2aOwned(map, frame, opts = {}) {
  safeSetTiles(
    map,
    GOES_GK2A_SOURCE_ID,
    ownedGoesGk2aTileUrl(frame.ymd, frame.hhmm),
    opts
  );
}

function applyOwnedFrameBoth(map, frame, opts = {}) {
  applyEastOwned(map, frame, opts);
  applyWestFamilyOwned(map, frame, opts);
  applyMeteosatOwned(map, frame, opts);
  // applyHimawariOwned parked
  applyGk2aOwned(map, frame, opts);
}

function formatFrameLabel(frame) {
  if (!frame) return '—';
  // Big wind-style readout: weekday + HH:MM UTC
  const ms = frame.ms ?? Date.parse(frame.iso);
  if (!Number.isFinite(ms)) {
    return `${frame.hhmm.slice(0, 2)}:${frame.hhmm.slice(2, 4)} UTC`;
  }
  const d = new Date(ms);
  const wd = d.toLocaleString('en-US', { timeZone: 'UTC', weekday: 'short' });
  return `${wd} ${frame.hhmm.slice(0, 2)}:${frame.hhmm.slice(2, 4)} UTC`;
}

function syncSatModeButton() {
  const btn = document.getElementById('goesSatModeBtn');
  if (!btn) return;
  const on = eitherGeocolorOn();
  btn.classList.toggle('active', on);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', 'Satellite');
  btn.title = on ? 'Satellite (on)' : 'Satellite';
  // Hurricane track thicken in sat (no casing).
  try {
    applyHurricaneSatPaint(on);
  } catch {
    /* hurricane layer optional */
  }
}

function wireVisibilityAndBar(map, state) {
  const sync = () => {
    honourCheckbox(map, 'lyr-goes-east-demo', GOES_EAST_LAYER_ID);
    honourCheckbox(map, 'lyr-goes-west-demo', GOES_WEST_LAYER_ID);
    honourCheckbox(map, 'lyr-goes-meteosat-demo', GOES_METEOSAT_LAYER_ID);
    // himawari parked
    honourCheckbox(map, 'lyr-goes-gk2a-demo', GOES_GK2A_LAYER_ID);
    syncSatRoadsVisibility(map);
    setTimeBarVisible(scrubberTestOpen && eitherGeocolorOn(), map);
    syncSatModeButton();
    syncTimeScrubButton();
    syncMosaicAttribution(map);
  };

  for (const id of ['lyr-goes-east-demo', 'lyr-goes-west-demo', 'lyr-goes-meteosat-demo', 'lyr-goes-gk2a-demo']) {
    const box = document.getElementById(id);
    if (!box || box.dataset.goesBarWired) continue;
    box.dataset.goesBarWired = '1';
    box.addEventListener('change', () => {
      sync();
      if (box.checked) ensureGoesGeocolorMounted(map);
    });
  }
  sync();
}

function wireTimeSlider(map, _state) {
  const slider = document.getElementById('geocolorTimeSlider');
  const labelEl = document.getElementById('geocolorTimeLabel');
  if (!slider || slider.dataset.goesSliderWired) return;
  slider.dataset.goesSliderWired = '1';

  const paintLabel = (frame) => {
    if (labelEl) labelEl.textContent = formatFrameLabel(frame);
  };

  // Always read goesUiState live — closing over a mount-time state object
  // breaks after remount (slider.dataset stays wired to a dead times[]).
  const applyIndex = (idx) => {
    const state = goesUiState;
    if (!state) return;
    const times = state.times || [];
    if (!times.length) {
      console.warn('[goes-geocolor] scrub: empty times[] — times.json not applied');
      return;
    }
    const i = Math.max(0, Math.min(times.length - 1, idx));
    slider.value = String(i);
    const iso = times[i];
    state.scrubbing = i < times.length - 1;
    applyScrubIso(map, state, iso);
    const nowBtn = document.getElementById('geocolorTimeNowBtn');
    if (nowBtn) nowBtn.hidden = !state.scrubbing;
  };

  slider.addEventListener('input', () => {
    applyIndex(Number(slider.value) || 0);
  });
  // change fires on release — some mobile browsers skip intermediate input
  slider.addEventListener('change', () => {
    applyIndex(Number(slider.value) || 0);
  });

  const nowBtn = document.getElementById('geocolorTimeNowBtn');
  if (nowBtn && !nowBtn.dataset.goesNowWired) {
    nowBtn.dataset.goesNowWired = '1';
    nowBtn.addEventListener('click', () => {
      const state = goesUiState;
      const times = state?.times || [];
      if (!times.length) return;
      applyIndex(times.length - 1);
      nowBtn.hidden = true;
    });
  }

  if (_state) {
    _state._applySliderIndex = applyIndex;
    _state._paintLabel = paintLabel;
  }
  if (goesUiState) {
    goesUiState._applySliderIndex = applyIndex;
    goesUiState._paintLabel = paintLabel;
  }
}

/**
 * Probe candidate 10-min slots; keep only frames that exist on East and/or West.
 * Blind clock lists include bake gaps (404) so the scrubber looked broken.
 */
async function probeAvailableGoesTimes(tipIso, hours, stepMinutes) {
  const candidates = buildTimeList(tipIso, hours, stepMinutes);
  const avail = {};
  // Newest → oldest, sequential (parallel fan-out was hard on mobile).
  const ordered = candidates.slice().reverse();
  for (const iso of ordered) {
    const frame = floorUtcToOwnedFrame(Date.parse(iso));
    let eastOk = false;
    let westOk = false;
    let metOk = false;
    let himOk = false;
    let gkOk = false;
    try {
      eastOk = await probeOwnedEastFrame(frame.ymd, frame.hhmm);
    } catch { /* ignore */ }
    try {
      westOk = await probeOwnedWestFrame(frame.ymd, frame.hhmm);
    } catch { /* ignore */ }
    try {
      metOk = await probeOwnedMeteosatFrame(frame.ymd, frame.hhmm);
    } catch { /* ignore */ }
    try {
      himOk = await probeOwnedHimawariFrame(frame.ymd, frame.hhmm);
    } catch { /* ignore */ }
    try {
      gkOk = await probeOwnedGk2aFrame(frame.ymd, frame.hhmm);
    } catch { /* ignore */ }
    if (eastOk || westOk || metOk || himOk || gkOk) {
      avail[iso] = { east: eastOk, west: westOk, meteosat: metOk, himawari: himOk, gk2a: gkOk, frame };
    }
  }
  const times = candidates.filter((iso) => avail[iso]);
  return { times, avail };
}

function applyScrubIso(map, state, iso) {
  const targetMs = Date.parse(iso);
  const targetUnix = Number.isFinite(targetMs)
    ? Math.floor(targetMs / 1000)
    : null;
  const man = state.timesManifest;

  // Per-sat at-or-before: #67 only applied sats with an *exact* times.json
  // unix for the scrub index. Near tip that is often GK2A-only, so East/West
  // /Meteosat never got setTiles — label moved, imagery + network did not.
  const east =
    frameAtOrBefore('goes-east', targetUnix, man, state.eastFrame) ||
    state.eastFrame;
  const west =
    frameAtOrBefore('goes-west', targetUnix, man, state.westFrame) ||
    state.westFrame;
  const met =
    frameAtOrBefore('meteosat', targetUnix, man, state.metFrame) ||
    state.metFrame;
  const gk =
    frameAtOrBefore('gk2a', targetUnix, man, state.gkFrame) ||
    state.gkFrame;

  const display =
    [east, west, met, gk].reduce((a, b) =>
      (a?.ms || 0) >= (b?.ms || 0) ? a : b
    ) || floorUtcToOwnedFrame(Number.isFinite(targetMs) ? targetMs : Date.now());

  state.currentTime = display.iso;
  state.displayFrame = display;
  state.scrubFrames = { east, west, met, gk };

  if (east) applyEastOwned(map, east);
  if (west) applyWestFamilyOwned(map, west);
  if (met) applyMeteosatOwned(map, met);
  // himawari parked
  if (gk) applyGk2aOwned(map, gk);

  if (state._paintLabel) state._paintLabel(display);
  console.info(
    '[goes-geocolor] scrub →',
    display.iso,
    `E ${east?.hhmm || '—'}`,
    `W ${west?.hhmm || '—'}`,
    `M ${met?.hhmm || '—'}`,
    `G ${gk?.hhmm || '—'}`
  );
  return display;
}

async function rebuildTimeList(state, tipFrame) {
  const hours = goesGeocolor.hours ?? 1;
  const tipIso = tipFrame?.iso || floorUtcToOwnedFrame().iso;
  const tipMs = tipFrame?.ms ?? Date.parse(tipIso);
  let times = [];
  let avail = {};

  try {
    const data = await fetchGeocolorTimesManifest({ force: true });
    state.timesManifest = data;
    const eastSet = new Set((data['goes-east'] || []).map(Number));
    const westSet = new Set((data['goes-west'] || []).map(Number));
    const metSet = new Set((data['meteosat'] || []).map(Number));
    const gkSet = new Set((data['gk2a'] || []).map(Number));
    // Himawari parked — not included in tip scrubber.
    const startMs = tipMs - hours * 60 * 60 * 1000;
    const union = new Set();
    for (const set of [eastSet, westSet, metSet, gkSet]) {
      for (const unix of set) {
        const ms = unix * 1000;
        if (ms >= startMs && ms <= tipMs + 60 * 1000) union.add(unix);
      }
    }
    const unixes = [...union].sort((a, b) => a - b);
    const seenIso = new Set();
    for (const unix of unixes) {
      // Skip GK-only slots. Near tip GK2A is often ahead of East/West/Met;
      // indexing those freezes Americas imagery (#67 looked like a dead slider).
      if (!eastSet.has(unix) && !westSet.has(unix) && !metSet.has(unix)) continue;
      const frame = floorUtcToOwnedFrame(unix * 1000);
      const iso = frame.iso;
      // Dedup floored slots so each slider step changes ymd/hhmm URLs.
      if (seenIso.has(iso)) continue;
      seenIso.add(iso);
      times.push(iso);
      avail[iso] = {
        east: unixAtOrBefore('goes-east', unix, data) != null,
        west: unixAtOrBefore('goes-west', unix, data) != null,
        meteosat: unixAtOrBefore('meteosat', unix, data) != null,
        himawari: false,
        gk2a: unixAtOrBefore('gk2a', unix, data) != null,
        frame
      };
    }
  } catch (e) {
    console.warn('[goes-geocolor] times.json:', e.message);
  }

  // Always include tip even if times.json lagged
  if (tipIso && !times.includes(tipIso)) {
    times = times.concat(tipIso);
    avail[tipIso] = avail[tipIso] || {
      east: true,
      west: true,
      meteosat: true,
      himawari: false,
      gk2a: true,
      frame: tipFrame || floorUtcToOwnedFrame(Date.parse(tipIso))
    };
  }

  if (!times.length) {
    times = [tipIso];
    avail = {
      [tipIso]: {
        east: true,
        west: true,
        meteosat: true,
        himawari: false,
        gk2a: true,
        frame: tipFrame || floorUtcToOwnedFrame(Date.parse(tipIso))
      }
    };
  }

  state.times = times;
  state.avail = avail;
  state.tipIso = tipIso;

  const slider = document.getElementById('geocolorTimeSlider');
  const metaEl = document.querySelector('.geocolor-time-title');
  if (metaEl) {
    metaEl.textContent =
      times.length > 1
        ? `Sat · last hour · ${times.length} frames`
        : 'Sat · latest scene';
  }
  if (slider && times.length) {
    slider.min = '0';
    slider.max = String(Math.max(0, times.length - 1));
    slider.disabled = times.length < 2;
    if (!state.scrubbing) {
      slider.value = String(times.length - 1);
      state.displayFrame = tipFrame;
      state.currentTime = tipIso;
      if (state._paintLabel) state._paintLabel(tipFrame);
      const nowBtn = document.getElementById('geocolorTimeNowBtn');
      if (nowBtn) nowBtn.hidden = true;
    }
  }
}


function formatCompactClock(frame) {
  if (!frame?.hhmm) return '—';
  return `${frame.hhmm.slice(0, 2)}:${frame.hhmm.slice(2, 4)}`;
}

function scrubUiAllowed() {
  let allow = Boolean(goesGeocolor.timeSlider);
  try {
    allow =
      allow || new URLSearchParams(location.search).get('scrub') === '1';
  } catch { /* ignore */ }
  return allow;
}

/** Bottom transport: deep-link / theme force-on, else GeoColor on (minimized chip). */
function transportShouldShow() {
  if (scrubUiAllowed()) return true;
  // Sat-on ⇒ chip (or expanded). transportUserOpen still tracks explicit open
  // for legacy paths; eitherGeocolorOn is the cold/default-on signal.
  return Boolean(eitherGeocolorOn() || transportUserOpen);
}

function refreshTransportVisibility() {
  if (!eitherGeocolorOn()) {
    transportUserOpen = false;
    stopTransportAgeTicker();
  } else {
    // Cold / defaultOn: ensure user-open so chip can show without a prior tap.
    transportUserOpen = true;
  }
  setTransportVisible(transportShouldShow());
}

/** Prime play frames + clock when transport becomes visible. */
async function primeTimeTransport(map) {
  await ensureGoesGeocolorMounted(map);
  const gk = document.getElementById('lyr-goes-gk2a-demo');
  if (gk && !gk.checked) {
    gk.checked = true;
    honourCheckbox(map, 'lyr-goes-gk2a-demo', GOES_GK2A_LAYER_ID);
    syncSatModeButton();
  }
  const state = goesUiState;
  if (!state) return null;
  // Always rebuild tip edge from times.json + gkFrame (latest.json), then
  // force-paint center-sat latest tip — never leave chip on playlist mid
  // (HTML range defaults value=0; a preserved gkPlayIndex painted ~03:30).
  try {
    await rebuildGkPlayList(state);
  } catch (e) {
    console.warn('[goes-geocolor] prime play list:', e?.message || e);
  }
  const holdMid =
    gkUserDragging ||
    gkPlaying ||
    gkBuffering ||
    (gkIntentionalScrub && state.scrubbing);
  if (!holdMid) {
    gkIntentionalScrub = false;
    forceLiveTipFromPoll(map, state, { forceTiles: true });
    console.info(
      '[goes-geocolor] prime → live tip',
      newestTipFrame(map, state)?.iso || state.gkFrame?.iso || '—'
    );
    return state;
  }
  const frames = state.gkPlayFrames || [];
  const idx = Number.isFinite(state.gkPlayIndex)
    ? state.gkPlayIndex
    : Math.max(0, frames.length - 1);
  state.gkPlayIndex = idx;
  const frame = frames[idx] || state.gkFrame;
  if (frame) paintGkPlayLabel(frame, { show: true });
  paintTransportMeta(map);
  syncScrubRange(idx, frames.length);
  syncTimeTransport();
  return state;
}

function playHoursLabel() {
  const playHours =
    Number(goesGeocolor.gkPlayHours) > 0
      ? Number(goesGeocolor.gkPlayHours)
      : GK_PLAY_HOURS;
  return playHours;
}

function tzOf(d) {
  try {
    const parts = new Intl.DateTimeFormat([], { timeZoneName: 'short' }).formatToParts(d);
    for (const p of parts) {
      if (p.type === 'timeZoneName') return p.value || '';
    }
  } catch { /* ignore */ }
  return '';
}

function formatLocalClock(d) {
  try {
    return d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
}

function formatUtcClock(d) {
  try {
    return d.toLocaleString([], {
      timeZone: 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
}

/** Compact age: "45s ago", "12m ago", "1h 12m ago". Detailed adds seconds under 1h. */
function formatAge(ms, detailed) {
  if (!Number.isFinite(ms)) return '—';
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) {
    if (detailed) return `${min}m ${pad2(sec % 60)}s ago`;
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  if (hr < 48) {
    if (remMin === 0) return `${hr}h ago`;
    return `${hr}h ${remMin}m ago`;
  }
  return `${Math.floor(hr / 24)}d ago`;
}

function frameMs(frame) {
  if (!frame) return NaN;
  if (Number.isFinite(frame.ms)) return frame.ms;
  if (frame.iso) {
    const t = Date.parse(frame.iso);
    if (Number.isFinite(t)) return t;
  }
  return NaN;
}

function isTransportChipLive() {
  const state = goesUiState;
  if (!state?.gkPlayFrames?.length) return true;
  if (gkPlaying || gkBuffering) return false;
  if (state.scrubbing) return false;
  const idx = state.gkPlayIndex;
  if (!Number.isFinite(idx)) return true;
  return idx >= state.gkPlayFrames.length - 1;
}

/** Under-title label: "Sat 38 min ago". Public name is Sat. */
function formatSatSceneLabel(ms) {
  if (!Number.isFinite(ms)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return `Sat ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Sat ${min} min ago`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  if (hr < 48) {
    if (remMin === 0) return `Sat ${hr}h ago`;
    return `Sat ${hr}h ${remMin}m ago`;
  }
  return `Sat ${Math.floor(hr / 24)}d ago`;
}

function paintMinimizedChip(frame) {
  const chipEl = document.getElementById('goesTimeAgeChip');
  const host = document.getElementById('satSceneAge');
  const ms = frameMs(frame);
  const on = eitherGeocolorOn() && Number.isFinite(ms);
  const label = on ? formatSatSceneLabel(ms) : '';
  if (chipEl) chipEl.textContent = label;
  if (host) host.hidden = !on;
}

function paintTransportAge(frame) {
  const ms = frameMs(frame);
  const ageEl = document.getElementById('goesTimeAge');
  if (ageEl) ageEl.textContent = formatAge(ms, Boolean(transportExpanded));
  paintMinimizedChip(frame);
}

function stopTransportAgeTicker() {
  if (transportAgeTimer) {
    clearInterval(transportAgeTimer);
    transportAgeTimer = 0;
  }
}

function startTransportAgeTicker() {
  stopTransportAgeTicker();
  paintTransportAge(transportClockFrame);
  // Label lives under the title. Tick whenever Sat is on, even with the
  // scrubber removed. New scenes still rewrite transportClockFrame from
  // latest.json; this interval only re-formats that frame's age.
  if (!eitherGeocolorOn()) return;
  transportAgeTimer = setInterval(() => {
    paintTransportAge(transportClockFrame);
  }, 1000);
}

function windParkRightPx() {
  // FireMap SoT: measure ONLY bottom-right nav .maplibregl-ctrl-group
  // → right = width + 16 (~45). Ignore attribution (same container, expands).
  const host = document.getElementById('map') || document.body;
  let right = 12;
  try {
    const grp =
      host.querySelector('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group') ||
      host.querySelector('.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-group');
    if (grp) {
      const r = grp.getBoundingClientRect();
      if (r.width > 0) right = Math.round(r.width) + 16;
    }
  } catch { /* ignore */ }
  return right;
}

function chromeClearPx() {
  // FireMap SoT: expanded transport clears zoom + right TOC rail (~88 floor).
  // Measure chrome (zoom group + .vertical-toolbar), not the whole bottom-right
  // container (attrib expands on desktop). Minimized chip uses windPark only.
  const host = document.getElementById('map') || document.body;
  let clear = Math.max(88, windParkRightPx());
  try {
    const cssRight = getComputedStyle(host).getPropertyValue('--wind-right');
    if (cssRight) {
      const n = parseFloat(cssRight);
      if (Number.isFinite(n) && n > 0) clear = Math.max(clear, n);
    }
  } catch { /* ignore */ }
  try {
    const grp =
      host.querySelector('.maplibregl-ctrl-bottom-right .maplibregl-ctrl-group') ||
      host.querySelector('.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-group');
    if (grp) {
      const r = grp.getBoundingClientRect();
      if (r.width > 0) {
        clear = Math.max(clear, Math.round(window.innerWidth - r.left) + 20);
      }
    }
  } catch { /* ignore */ }
  const rail =
    document.querySelector('.vertical-toolbar') ||
    document.getElementById('verticalToolbar');
  if (rail && rail.getClientRects && rail.getClientRects().length) {
    try {
      const rr = rail.getBoundingClientRect();
      if (rr.width > 0 && Number.isFinite(rr.left)) {
        clear = Math.max(clear, Math.round(window.innerWidth - rr.left) + 12);
      }
    } catch { /* ignore */ }
  }
  // Publish floor so CSS fallbacks + wind --wind-right never undercut the rail.
  try {
    const prev = parseFloat(getComputedStyle(host).getPropertyValue('--wind-right')) || 0;
    if (!(prev >= clear)) host.style.setProperty('--wind-right', `${clear}px`);
  } catch { /* ignore */ }
  return clear;
}

function syncGoesLift(transport, minimized, bottomPx) {
  // FireMap SoT: ONLY expanded visible transport lifts dual-scale + logo.
  // lift = height + bottom + 10; wind max() combo via .goes-lift + CSS.
  const host = document.getElementById('map') || document.body;
  const need = Boolean(transport && !transport.hidden && !minimized);
  let h = 0;
  if (need) {
    h = Math.round((transport.offsetHeight || 72) + (bottomPx || 22) + 10);
  }
  host.classList.toggle('goes-lift', need);
  host.style.setProperty('--goes-tab-h', `${h}px`);
  const bl = host.querySelector('.maplibregl-ctrl-bottom-left');
  if (!bl) return;
  for (const el of bl.querySelectorAll('.ddb-dual-scale, .maplibregl-ctrl-scale, .maplibregl-ctrl-logo')) {
    el.classList.toggle('goes-ctrl-lift', need);
  }
}

function positionTransport() {
  const transport = document.getElementById('goesTimeTransport');
  if (!transport || transport.hidden) return;
  const host = document.getElementById('map') || document.body;
  const windTab =
    host.querySelector('.wind-tab.on') || document.querySelector('.wind-tab.on');
  let windPark = windParkRightPx();
  let windRight = windPark;
  try {
    const cssRight = getComputedStyle(host).getPropertyValue('--wind-right');
    if (cssRight) {
      const n = parseFloat(cssRight);
      // Prefer live --wind-right when it looks like wind's zoom-only park (not chrome 88 floor).
      if (Number.isFinite(n) && n >= 12 && n <= windPark + 8) windRight = n;
    }
  } catch { /* ignore */ }
  windRight = Math.max(12, Math.min(windRight, windPark + 8));

  const gap = 10;
  const minimized = transport.classList.contains('minimized');
  const tw = transport.offsetWidth || (minimized ? 120 : 360);
  let bottom = 22;
  let right = windRight;
  const mobile = window.innerWidth < 640;

  if (minimized) {
    // Flush-right like wind nub: zoom-group park only (not chromeClear ~88).
    // Do not call chromeClearPx here — it would rewrite --wind-right to 88.
    right = windRight;
    bottom = mobile ? 28 : 22;
    if (windTab) {
      // Stack above wind at the SAME right edge (do not slide left of wind).
      const wrMin = windTab.getBoundingClientRect();
      bottom = Math.max(
        bottom,
        Math.round(window.innerHeight - wrMin.top + gap)
      );
    }
  } else {
    // Expanded: chromeClear ~88 (zoom + right rail); may sit left of / above wind.
    const chromeClear = chromeClearPx();
    windRight = Math.max(windRight, chromeClear);
    right = windRight;

    if (windTab) {
      const wr = windTab.getBoundingClientRect();
      right = Math.round(window.innerWidth - wr.left + gap);
      if (right + tw > window.innerWidth - 12) {
        right = Math.max(chromeClear, windRight);
        bottom = Math.round(window.innerHeight - wr.top + gap);
      } else {
        bottom = Math.max(22, Math.round(window.innerHeight - wr.bottom));
        if (bottom < 16) bottom = 22;
      }
    } else {
      right = Math.max(chromeClear, windRight);
      bottom = 22;
    }

    right = Math.max(right, chromeClear);
    if (mobile) {
      if (right + tw > window.innerWidth - 8) {
        right = Math.max(chromeClear, windRight);
        bottom = Math.max(bottom, 28);
        if (windTab) {
          const wr2 = windTab.getBoundingClientRect();
          bottom = Math.max(bottom, Math.round(window.innerHeight - wr2.top + gap));
        }
      } else {
        bottom = Math.max(bottom, 28);
      }
    }

    // If open transport still intersects the right rail in Y, sit below its bottom.
    const railEl =
      document.querySelector('.vertical-toolbar') ||
      document.getElementById('verticalToolbar');
    if (railEl && railEl.getClientRects && railEl.getClientRects().length) {
      try {
        const railR = railEl.getBoundingClientRect();
        const th = transport.offsetHeight || (mobile ? 96 : 110);
        const transportTop = window.innerHeight - bottom - th;
        if (railR.bottom > transportTop - 8 && railR.left < window.innerWidth - right) {
          bottom = Math.max(
            bottom,
            Math.round(window.innerHeight - railR.bottom + gap)
          );
        }
      } catch { /* ignore */ }
    }
  }

  transport.style.left = 'auto';
  transport.style.right = `${right}px`;
  transport.style.bottom = `${bottom}px`;
  transport.style.transform = 'none';
  if (minimized) {
    transport.style.width = 'auto';
    transport.style.maxWidth = `calc(100vw - ${right + 24}px)`;
  } else if (mobile) {
    transport.style.width = `min(280px, calc(100vw - ${right + 24}px))`;
    transport.style.maxWidth = `calc(100vw - ${right + 24}px)`;
  } else {
    transport.style.width = `min(360px, calc(100vw - ${right + 24}px))`;
    transport.style.maxWidth = '360px';
  }
  syncGoesLift(transport, minimized, bottom);
}

function schedulePositionTransport() {
  requestAnimationFrame(() => positionTransport());
}

function setTransportExpanded(expanded) {
  transportExpanded = !!expanded;
  const transport = document.getElementById('goesTimeTransport');
  if (transport) {
    transport.classList.toggle('minimized', !transportExpanded);
    transport.setAttribute(
      'aria-label',
      transportExpanded
        ? 'Satellite time'
        : 'Satellite time — tap to expand'
    );
  }
  if (!transportExpanded && (gkPlaying || gkBuffering)) {
    pauseGkPlay();
  }
  if (transportExpanded) startTransportAgeTicker();
  else paintTransportAge(transportClockFrame);
  schedulePositionTransport();
}

function setTransportVisible(on) {
  const transport = document.getElementById('goesTimeTransport');
  if (transport) {
    transport.hidden = !on;
    if (on) {
      paintTransportMeta(goesUiMap);
      transport.classList.toggle('minimized', !transportExpanded);
      positionTransport();
    } else {
      syncGoesLift(transport, true, 0);
    }
  }
  // Age label is under the title, not on the removed transport.
  if (on && eitherGeocolorOn()) startTransportAgeTicker();
  else {
    stopTransportAgeTicker();
    paintMinimizedChip(null);
  }
}

function syncScrubRange(index, frameCount) {
  const range = document.getElementById('goesTimeScrubRange');
  if (!range) return;
  const max = Math.max(0, (frameCount || 1) - 1);
  range.min = '0';
  range.max = String(max);
  range.disabled = max < 1;
  if (!gkUserDragging) {
    const i = Math.max(0, Math.min(max, Number(index) || 0));
    range.value = String(i);
  }
}

function paintGkPlayLabel(frame, { show } = {}) {
  if (frame) transportClockFrame = frame;
  else if (!show) transportClockFrame = null;
  const label = document.getElementById('goesTimeScrubLabel');
  const localEl = document.getElementById('goesTimeLocal');
  const utcEl = document.getElementById('goesTimeUtc');
  const transport = document.getElementById('goesTimeTransport');
  const transportOn = Boolean(transport && !transport.hidden);
  if (!show && !transportOn) {
    if (label) label.textContent = '';
    if (localEl) localEl.textContent = '';
    if (utcEl) utcEl.textContent = '';
    paintTransportAge(frame);
    return;
  }
  const compact = frame ? formatCompactClock(frame) : '—';
  if (label) label.textContent = compact;
  const ms = frameMs(frame);
  if (!Number.isFinite(ms)) {
    if (localEl) localEl.textContent = '—';
    if (utcEl) utcEl.textContent = '—';
    paintTransportAge(frame);
    return;
  }
  const d = new Date(ms);
  const zone = tzOf(d);
  if (localEl) localEl.textContent = `${formatLocalClock(d)}${zone ? ' ' + zone : ''}`;
  if (utcEl) utcEl.textContent = `(${formatUtcClock(d)} UTC)`;
  paintTransportAge(frame);
}

function bumpGkClockGen() {
  gkClockGen += 1;
  return gkClockGen;
}

/** Drop coalesced scrub apply so Play/Latest/pause do not paint an old index. */
function cancelPendingScrubApply() {
  if (gkScrubTimer) {
    clearTimeout(gkScrubTimer);
    gkScrubTimer = 0;
  }
  gkPendingScrubIdx = null;
}

function clearGkPlayTimer() {
  if (gkPlayTimer != null) {
    clearInterval(gkPlayTimer);
    gkPlayTimer = null;
  }
  gkPlaying = false;
  gkBuffering = false;
  gkPrefetchGen += 1;
  cancelPendingScrubApply();
  bumpGkClockGen();
}

/**
 * Last ~gkPlayHours of GK2A frames from times.json (oldest → tip).
 * Uses whatever slots exist in the age window — does not invent missing
 * 10-min cadence gaps. Optional gkPlayFrames hard-caps the slice.
 * Play list stays GK-anchored; applyGkPlayFrame matches West + Meteosat
 * nearest-at-or-before each selected unix. East stays tip-only. Does not
 * depend on #74.
 */
async function rebuildGkPlayList(state) {
  const hours =
    Number(goesGeocolor.gkPlayHours) > 0
      ? Number(goesGeocolor.gkPlayHours)
      : GK_PLAY_HOURS;
  const windowSec = hours * 3600;
  // Optional #77-era hard cap: if set, take last N of the hours window.
  const maxFramesOverride =
    Number(goesGeocolor.gkPlayFrames) > 0
      ? Number(goesGeocolor.gkPlayFrames)
      : null;
  let frames = [];
  try {
    const data = await fetchGeocolorTimesManifest({ force: true });
    state.timesManifest = data;
    const list = (data['gk2a'] || [])
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);
    const tipUnix = Number.isFinite(state.gkFrame?.ms)
      ? Math.floor(state.gkFrame.ms / 1000)
      : list.length
        ? list[list.length - 1]
        : null;
    const inWindow =
      tipUnix == null
        ? list
        : list.filter(
            (u) => u <= tipUnix + 60 && u >= tipUnix - windowSec
          );
    const slice = maxFramesOverride
      ? inWindow.slice(-maxFramesOverride)
      : inWindow;
    const seen = new Set();
    for (const unix of slice) {
      const frame = floorUtcToOwnedFrame(unix * 1000);
      if (seen.has(frame.iso)) continue;
      seen.add(frame.iso);
      frames.push(frame);
    }
  } catch (e) {
    console.warn('[goes-geocolor] gk play times.json:', e.message);
  }

  const tip = state.gkFrame;
  if (tip) {
    const last = frames[frames.length - 1];
    if (!last || (tip.ms || 0) > (last.ms || 0) || last.iso !== tip.iso) {
      if (!frames.some((f) => f.iso === tip.iso)) frames.push(tip);
      else {
        // Ensure tip is last
        frames = frames.filter((f) => f.iso !== tip.iso).concat([tip]);
      }
    }
  }
  if (!frames.length && tip) frames = [tip];

  state.gkPlayFrames = frames;
  // Live / cold: always tip-edge. Only preserve mid index while the user is
  // actively scrubbing, playing, or mid intentional scrub (parked).
  const holdMid =
    gkUserDragging ||
    gkPlaying ||
    gkBuffering ||
    (gkIntentionalScrub && state.scrubbing);
  if (
    !holdMid ||
    !Number.isFinite(state.gkPlayIndex) ||
    state.gkPlayIndex < 0 ||
    state.gkPlayIndex >= frames.length
  ) {
    state.gkPlayIndex = Math.max(0, frames.length - 1);
    if (!holdMid) state.scrubbing = false;
  }
  syncScrubRange(state.gkPlayIndex, frames.length);
  console.info(
    '[goes-geocolor] gk play list',
    frames.length,
    'frames',
    `(${hours}h)`,
    frames[0]?.hhmm || '—',
    '→',
    frames[frames.length - 1]?.hhmm || '—'
  );
  return frames;
}

function applyGkPlayFrame(map, state, index, expectedGen = gkClockGen) {
  // Drop stale applies: scrub stacks async setTiles/seam work; Play/Latest
  // bump gkClockGen so late completions from older targets do not paint.
  if (expectedGen !== gkClockGen) return null;
  const frames = state.gkPlayFrames || [];
  if (!frames.length) return null;
  const i = Math.max(0, Math.min(frames.length - 1, index));
  const frame = frames[i];
  state.gkPlayIndex = i;
  const atTip = i >= frames.length - 1;
  state.scrubbing = !atTip;
  state.displayFrame = frame;
  state.currentTime = frame.iso;

  const targetUnix = Number.isFinite(frame.ms)
    ? Math.floor(frame.ms / 1000)
    : null;
  const man = state.timesManifest;
  // West + Meteosat join the play/scrub clock: nearest times.json unix ≤
  // selected (hold previous / nearest ≤ T when a slot is missing). East stays
  // tip-only — bake lag still looks wrong mid-scrub on the Atlantic disk.
  const west =
    frameAtOrBefore('goes-west', targetUnix, man, state.westFrame) ||
    state.westFrame;
  const met =
    frameAtOrBefore('meteosat', targetUnix, man, state.metFrame) ||
    state.metFrame;
  state.scrubFrames = {
    ...(state.scrubFrames || {}),
    gk: frame,
    west: west || null,
    met: met || null
  };

  // Re-check after framing work in case Latest/pause bumped mid-call.
  if (expectedGen !== gkClockGen) return null;

  // Viewport cull (#71-style): only setTiles for sats whose coverage meets
  // the current map frame. Clock still advances from the GK play list.
  applyOwnedIfInView(map, 'gk2a', applyGk2aOwned, frame);
  applyOwnedIfInView(map, 'west', applyWestOwned, west);
  applyOwnedIfInView(map, 'meteosat', applyMeteosatOwned, met);

  if (expectedGen !== gkClockGen) return null;

  paintGkPlayLabel(frame, { show: true });
  syncScrubRange(i, frames.length);
  const latestBtn = document.getElementById('goesTimeLatestBtn');
  if (latestBtn) latestBtn.hidden = atTip;
  console.info(
    '[goes-geocolor] gk play →',
    frame.iso,
    `(${i + 1}/${frames.length})`,
    `W ${west?.hhmm || '—'}`,
    `M ${met?.hhmm || '—'}`
  );
  return frame;
}

function snapGkPlayToTip(map) {
  // clearGkPlayTimer cancels pending scrub + rolling prefetch + bumps clock.
  clearGkPlayTimer();
  const state = goesUiState;
  if (!state || !map) return;
  const gen = bumpGkClockGen();
  state.scrubbing = false;
  gkIntentionalScrub = false;
  const frames = state.gkPlayFrames || [];
  state.gkPlayIndex = Math.max(0, frames.length - 1);
  if (gen !== gkClockGen) return;
  if (state.gkFrame) {
    applyOwnedIfInView(map, 'gk2a', applyGk2aOwned, state.gkFrame, true);
  }
  // West family + Met return to tip with Latest / snap (scrub-driven mid-window).
  if (state.westFrame) {
    applyOwnedIfInView(map, 'west', applyWestOwned, state.westFrame, true);
  }
  if (state.metFrame) {
    applyOwnedIfInView(map, 'meteosat', applyMeteosatOwned, state.metFrame, true);
  }
  if (gen !== gkClockGen) return;
  const tip =
    newestTipFrame(map, state) || state.gkFrame || state.tipFrame || null;
  if (tip) {
    state.tipFrame = tip;
    state.displayFrame = tip;
    state.currentTime = tip.iso;
    paintGkPlayLabel(tip, { show: true });
  } else {
    paintGkPlayLabel(null, { show: false });
  }
  paintTransportMeta(map);
  syncScrubRange(state.gkPlayIndex, frames.length);
  const latestBtn = document.getElementById('goesTimeLatestBtn');
  if (latestBtn) latestBtn.hidden = true;
  syncTimeTransport();
}

/**
 * Compact tip stamp for East/West/Met/GK (Himawari parked). Any ymd/hhmm
 * change means latest.json advanced at least one disk.
 */
function tipSignature(state) {
  if (!state) return '';
  const parts = [];
  for (const key of ['eastFrame', 'westFrame', 'metFrame', 'gkFrame']) {
    const f = state[key];
    parts.push(f && f.ymd && f.hhmm ? `${f.ymd}/${f.hhmm}` : '—');
  }
  return parts.join('|');
}

/** True when painted age chip/clock lags newest tip by ≥1 frame step. */
function transportClockStaleVsTip(tip) {
  const tipMs = frameMs(tip);
  const clockMs = frameMs(transportClockFrame);
  if (!Number.isFinite(tipMs)) return false;
  if (!Number.isFinite(clockMs)) return true;
  // ≥9 min behind tip ⇒ frozen stamp (e.g. ~03:30 while latest is ~05:10).
  return tipMs - clockMs >= 9 * 60 * 1000;
}

/**
 * Every tip-poll success path: apply per-sat latest + rewrite tip/display/
 * transportClockFrame from newestTipFrame. forceTiles remounts when the
 * MapLibre template string is unchanged but the age chip is stale.
 */
function forceLiveTipFromPoll(map, state, { forceTiles = false } = {}) {
  if (!map || !state || gkUserDragging) return;
  if (gkPlaying || gkBuffering) pauseGkPlay();
  gkIntentionalScrub = false;
  const tileOpts = forceTiles ? { force: true } : {};
  if (state.eastFrame) applyEastOwned(map, state.eastFrame, tileOpts);
  if (state.westFrame) applyWestFamilyOwned(map, state.westFrame, tileOpts);
  if (state.metFrame) applyMeteosatOwned(map, state.metFrame, tileOpts);
  if (state.gkFrame) applyGk2aOwned(map, state.gkFrame, tileOpts);
  const tip =
    newestTipFrame(map, state) || state.gkFrame || state.tipFrame || null;
  if (tip) {
    state.tipFrame = tip;
    state.displayFrame = tip;
    state.currentTime = tip.iso;
    state.scrubbing = false;
    const frames = state.gkPlayFrames || [];
    if (frames.length) {
      state.gkPlayIndex = Math.max(0, frames.length - 1);
      syncScrubRange(state.gkPlayIndex, frames.length);
    }
    paintGkPlayLabel(tip, { show: true });
  }
  paintTransportMeta(map);
  if (state._paintLabel && state.displayFrame) state._paintLabel(state.displayFrame);
  const latestBtn = document.getElementById('goesTimeLatestBtn');
  if (latestBtn) latestBtn.hidden = true;
  if (transportShouldShow()) startTransportAgeTicker();
  else if (state.displayFrame) paintTransportAge(state.displayFrame);
  syncTimeTransport();
}

/**
 * Tip-signature / wake catch-up: rebuild playlist tip edge, then force-apply
 * live tips + rewrite transportClockFrame. Gate: skip while gkUserDragging.
 */
async function catchUpToLiveTips(map, state, { forceTiles = false } = {}) {
  if (!map || !state || gkUserDragging) return;
  if (gkPlaying || gkBuffering) pauseGkPlay();
  try {
    await rebuildGkPlayList(state);
  } catch (e) {
    console.warn('[goes-geocolor] tip catch-up play list:', e?.message || e);
  }
  // East stays tip-live; West/Met/GK via snap (independent frames — not common hhmm).
  // Always rewrite clock from newestTipFrame; remount tiles when forceTiles.
  forceLiveTipFromPoll(map, state, { forceTiles });
}

function pauseGkPlay() {
  clearGkPlayTimer();
  syncTimeTransport();
}


/** Lon/lat → XYZ tile indices (Web Mercator). */
function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y))
  };
}

/** Viewport tile keys at floor(zoom) clamped to GeoColor pyramid (z0–z7). */
function viewportTileCoords(map) {
  if (!map || typeof map.getBounds !== 'function') return [];
  let b;
  try {
    b = map.getBounds();
  } catch {
    return [];
  }
  if (!b) return [];
  const zRaw = typeof map.getZoom === 'function' ? map.getZoom() : 4;
  const z = Math.max(0, Math.min(7, Math.floor(Number(zRaw) || 0)));
  const n = 2 ** z;
  const west = b.getWest();
  const east = b.getEast();
  const south = b.getSouth();
  const north = b.getNorth();
  if (![west, east, south, north].every(Number.isFinite)) return [];
  // Antimeridian / wide unwrap — skip warm (avoid flooding).
  if (east < west || east - west > 350) return [];
  const tl = lonLatToTile(west, north, z);
  const br = lonLatToTile(east, south, z);
  const x0 = Math.max(0, Math.min(tl.x, br.x));
  const x1 = Math.min(n - 1, Math.max(tl.x, br.x));
  const y0 = Math.max(0, Math.min(tl.y, br.y));
  const y1 = Math.min(n - 1, Math.max(tl.y, br.y));
  // Cap fanout (~8×8) so buffer stays snappy on large views.
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) {
    const cx = Math.floor((x0 + x1) / 2);
    const cy = Math.floor((y0 + y1) / 2);
    const half = 3;
    const xs = Math.max(0, cx - half);
    const xe = Math.min(n - 1, cx + half);
    const ys = Math.max(0, cy - half);
    const ye = Math.min(n - 1, cy + half);
    const out = [];
    for (let x = xs; x <= xe; x++) {
      for (let y = ys; y <= ye; y++) out.push({ z, x, y });
    }
    return out;
  }
  const out = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) out.push({ z, x, y });
  }
  return out;
}

function expandTileTemplate(tpl, z, x, y) {
  return String(tpl || '')
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

/** Warm one HTTPS tile into the browser HTTP cache (seam protocol reuses it). */
function warmHttpsTile(url) {
  if (!url) return Promise.resolve();
  return fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache'
  })
    .then((res) => {
      // Drain body so the response is cacheable; ignore non-OK.
      if (res && typeof res.arrayBuffer === 'function') return res.arrayBuffer();
      return null;
    })
    .catch(() => null);
}

async function runPool(items, limit, worker) {
  const list = items || [];
  if (!list.length) return;
  let i = 0;
  const n = Math.max(1, limit | 0);
  const runners = Array.from({ length: Math.min(n, list.length) }, async () => {
    while (i < list.length) {
      const idx = i++;
      await worker(list[idx], idx);
    }
  });
  await Promise.all(runners);
}

/**
 * Resolve west/met frames for a GK play index (same clock as applyGkPlayFrame).
 * East stays tip-only — never warmed onto the scrub clock.
 */
function framesForPlayIndex(state, index) {
  const frames = state?.gkPlayFrames || [];
  if (!frames.length) return null;
  const i = Math.max(0, Math.min(frames.length - 1, index));
  const frame = frames[i];
  const targetUnix = Number.isFinite(frame.ms)
    ? Math.floor(frame.ms / 1000)
    : null;
  const man = state.timesManifest;
  const west =
    frameAtOrBefore('goes-west', targetUnix, man, state.westFrame) ||
    state.westFrame;
  const met =
    frameAtOrBefore('meteosat', targetUnix, man, state.metFrame) ||
    state.metFrame;
  return { gk: frame, west: west || null, met: met || null };
}

/** Collect raw HTTPS tile URLs for viewport-visible sats at a play index. */
function collectPlayWarmUrls(map, state, index) {
  const bundle = framesForPlayIndex(state, index);
  if (!bundle) return [];
  const tiles = viewportTileCoords(map);
  if (!tiles.length) return [];
  const urls = [];
  const pushTpl = (tpl) => {
    if (!tpl) return;
    for (const t of tiles) {
      urls.push(expandTileTemplate(tpl, t.z, t.x, t.y));
    }
  };
  if (bundle.gk && satViewportIntersects(map, 'gk2a')) {
    pushTpl(ownedGoesGk2aTileUrl(bundle.gk.ymd, bundle.gk.hhmm));
  }
  if (bundle.west && satViewportIntersects(map, 'west')) {
    pushTpl(ownedGoesWestTileUrlRaw(bundle.west.ymd, bundle.west.hhmm));
  }
  return urls;
}

/**
 * Warm tiles for play indices [fromIndex, fromIndex+count).
 * Returns false if cancelled via gkPrefetchGen.
 */
async function prefetchGkPlayRange(map, state, fromIndex, count, gen) {
  const frames = state?.gkPlayFrames || [];
  if (!frames.length || !map) return true;
  const start = Math.max(0, fromIndex | 0);
  const end = Math.min(frames.length, start + Math.max(0, count | 0));
  const urls = [];
  const seen = new Set();
  for (let i = start; i < end; i++) {
    if (gen !== gkPrefetchGen) return false;
    for (const u of collectPlayWarmUrls(map, state, i)) {
      if (seen.has(u)) continue;
      seen.add(u);
      urls.push(u);
    }
  }
  await runPool(urls, GK_PLAY_PREFETCH_CONCURRENCY, async (url) => {
    if (gen !== gkPrefetchGen) return;
    await warmHttpsTile(url);
  });
  return gen === gkPrefetchGen;
}

/** Kick a rolling ahead-of-play warm (fire-and-forget). */
function scheduleRollingPrefetch(map, state, fromIndex) {
  const gen = gkPrefetchGen;
  const count = GK_PLAY_BUFFER_FRAMES;
  prefetchGkPlayRange(map, state, fromIndex, count, gen).catch(() => {});
}

async function startGkPlay(map) {
  const state = goesUiState;
  if (!state?.gkPlayFrames?.length) return;
  clearGkPlayTimer();
  let idx = state.gkPlayIndex;
  // At tip or unset → restart from oldest (oldest of window → latest).
  if (!Number.isFinite(idx) || idx < 0 || idx >= state.gkPlayFrames.length - 1) {
    idx = 0;
  }
  state.gkPlayIndex = idx;

  // Buffering: warm next N viewport tiles, show spinner, then play snappier.
  const gen = ++gkPrefetchGen;
  gkBuffering = true;
  syncTimeTransport();
  const bufferCount = Math.min(
    GK_PLAY_BUFFER_FRAMES,
    state.gkPlayFrames.length
  );
  try {
    await prefetchGkPlayRange(map, state, idx, bufferCount, gen);
  } catch (e) {
    console.warn('[goes-geocolor] play buffer:', e?.message || e);
  }
  if (gen !== gkPrefetchGen) return; // paused / superseded
  gkBuffering = false;

  const applyGen = bumpGkClockGen();
  if (applyGkPlayFrame(map, state, idx, applyGen) == null) return;
  gkPlaying = true;
  syncTimeTransport();
  // Keep warming ahead of the playhead (rolling buffer).
  scheduleRollingPrefetch(map, state, idx + bufferCount);

  const interval =
    Number(goesGeocolor.gkPlayIntervalMs) > 0
      ? Number(goesGeocolor.gkPlayIntervalMs)
      : GK_PLAY_INTERVAL_MS;

  gkPlayTimer = setInterval(() => {
    const st = goesUiState;
    if (!st?.gkPlayFrames?.length) {
      pauseGkPlay();
      return;
    }
    // Skip auto-advance while the user is dragging the scrub track.
    if (gkUserDragging) return;
    const stepGen = bumpGkClockGen();
    const next = (st.gkPlayIndex ?? 0) + 1;
    if (next >= st.gkPlayFrames.length) {
      // Continuous loop: tip → oldest in the play window.
      applyGkPlayFrame(map, st, 0, stepGen);
      scheduleRollingPrefetch(map, st, 0);
      return;
    }
    applyGkPlayFrame(map, st, next, stepGen);
    // Prefetch further ahead every few steps.
    if (next % 4 === 0) {
      scheduleRollingPrefetch(map, st, next + 1);
    }
  }, interval);
}

function syncTimeTransport() {
  const btn = document.getElementById('goesTimePlayBtn');
  if (!btn) return;
  const state = goesUiState;
  const mid =
    Boolean(state?.scrubbing) ||
    (Number.isFinite(state?.gkPlayIndex) &&
      state?.gkPlayFrames?.length > 1 &&
      state.gkPlayIndex < state.gkPlayFrames.length - 1);
  const active = gkPlaying || mid;
  btn.classList.toggle('active', active);
  btn.classList.toggle('playing', gkPlaying);
  btn.setAttribute('aria-pressed', gkPlaying ? 'true' : 'false');

  const playIcon = btn.querySelector('.goes-time-play-icon--play');
  const pauseIcon = btn.querySelector('.goes-time-play-icon--pause');
  const spinIcon = btn.querySelector('.goes-time-play-icon--spin');
  btn.classList.toggle('buffering', gkBuffering);
  if (playIcon && pauseIcon) {
    if (gkBuffering) {
      playIcon.hidden = true;
      pauseIcon.hidden = true;
    } else {
      playIcon.hidden = gkPlaying;
      pauseIcon.hidden = !gkPlaying;
    }
  }
  if (spinIcon) spinIcon.hidden = !gkBuffering;

  const playHours = playHoursLabel();
  if (gkBuffering) {
    btn.title = 'Buffering scenes…';
    btn.setAttribute('aria-label', 'Buffering satellite play');
  } else if (gkPlaying) {
    btn.title = 'Pause';
    btn.setAttribute('aria-label', 'Pause satellite play');
  } else if (mid) {
    btn.title = 'Resume';
    btn.setAttribute('aria-label', 'Resume satellite play');
  } else {
    btn.title = `Play last ~${playHours}h of scenes`;
    btn.setAttribute('aria-label', 'Play satellite loop');
  }

  const latestBtn = document.getElementById('goesTimeLatestBtn');
  if (latestBtn && state) {
    const frames = state.gkPlayFrames || [];
    const atTip =
      !frames.length ||
      !Number.isFinite(state.gkPlayIndex) ||
      state.gkPlayIndex >= frames.length - 1;
    latestBtn.hidden = atTip && !gkPlaying;
  }
  // Keep chip scrubbed state + park in sync with painted clock frame.
  paintTransportMeta(goesUiMap);
  if (transportClockFrame) paintTransportAge(transportClockFrame);
  schedulePositionTransport();
}

/** @deprecated alias — older call sites */
function syncTimeScrubButton() {
  refreshTransportVisibility();
  syncTimeTransport();
  syncSatModeButton();
}

function seekGkPlayIndex(map, index) {
  const state = goesUiState;
  if (!state?.gkPlayFrames?.length) return;
  const gen = bumpGkClockGen();
  applyGkPlayFrame(map, state, index, gen);
  syncTimeTransport();
}

/** Paint only the latest scrub index; drop intermediates while dragging. */
function flushPendingScrubSeek(map) {
  if (gkScrubTimer) {
    clearTimeout(gkScrubTimer);
    gkScrubTimer = 0;
  }
  const idx = gkPendingScrubIdx;
  gkPendingScrubIdx = null;
  if (idx == null || !map) return;
  seekGkPlayIndex(map, idx);
}

/**
 * Coalesce scrub: update the clock label immediately, debounce setTiles so
 * hard back-and-forth only applies the latest position (unless immediate).
 */
function scheduleScrubSeek(map, index, { immediate = false } = {}) {
  const idx = Math.max(0, Number(index) || 0);
  gkPendingScrubIdx = idx;
  const state = goesUiState;
  const frames = state?.gkPlayFrames || [];
  if (frames.length) {
    const i = Math.max(0, Math.min(frames.length - 1, idx));
    const frame = frames[i];
    if (frame) paintGkPlayLabel(frame, { show: true });
  }
  if (immediate) {
    flushPendingScrubSeek(map);
    return;
  }
  if (gkScrubTimer) return; // pending idx already updated — wait for flush
  gkScrubTimer = setTimeout(() => {
    gkScrubTimer = 0;
    flushPendingScrubSeek(map);
  }, GK_SCRUB_COALESCE_MS);
}

/**
 * Bottom-center time transport for GK2A (~gkPlayHours window, loops).
 * Visible via toolbar Satellite button, theme.goesGeocolor.timeSlider, or ?scrub=1.
 * Play/pause + scrub-to-frame + Latest (snap tip). Sidebar clock removed.
 * Handlers always wire; visibility is gated (not forever-hidden behind query only).
 */
function wireGoesTimeScrubTest(map) {
  const transport = document.getElementById('goesTimeTransport');
  const playBtn = document.getElementById('goesTimePlayBtn');
  if (!transport || !playBtn || playBtn.dataset.goesScrubWired) return;
  playBtn.dataset.goesScrubWired = '1';

  refreshTransportVisibility();
  if (transportShouldShow()) setTransportExpanded(false);

  const ensureList = async () => primeTimeTransport(map);

  const hideBtn = document.getElementById('goesTimeHideBtn');
  if (hideBtn && !hideBtn.dataset.goesHideWired) {
    hideBtn.dataset.goesHideWired = '1';
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setTransportExpanded(false);
      syncSatModeButton();
    });
  }
  const chipBtn = document.getElementById('goesTimeChip');
  if (chipBtn && !chipBtn.dataset.goesChipWired) {
    chipBtn.dataset.goesChipWired = '1';
    chipBtn.addEventListener('click', () => {
      transportUserOpen = true;
      setTransportExpanded(true);
      refreshTransportVisibility();
      syncSatModeButton();
      ensureList();
    });
  }

  // Deep-link / theme: prime immediately. Button path primes on open.
  if (transportShouldShow()) {
    ensureList();
  }

  playBtn.addEventListener('click', async () => {
    const state = await ensureList();
    if (!state) return;

    if (gkBuffering) return;

    if (gkPlaying) {
      pauseGkPlay();
      return;
    }

    const frames = state.gkPlayFrames || [];
    const mid =
      state.scrubbing &&
      frames.length > 1 &&
      Number.isFinite(state.gkPlayIndex) &&
      state.gkPlayIndex < frames.length - 1;
    if (mid) {
      await startGkPlay(map);
      return;
    }

    await rebuildGkPlayList(state);
    if (!(state.gkPlayFrames || []).length) {
      console.warn('[goes-geocolor] gk play: no frames');
      return;
    }
    // Force restart from oldest when starting at tip.
    state.gkPlayIndex = state.gkPlayFrames.length - 1;
    await startGkPlay(map);
  });

  const latestBtn = document.getElementById('goesTimeLatestBtn');
  if (latestBtn && !latestBtn.dataset.goesLatestWired) {
    latestBtn.dataset.goesLatestWired = '1';
    latestBtn.addEventListener('click', async () => {
      await ensureGoesGeocolorMounted(map);
      snapGkPlayToTip(map);
    });
  }

  const range = document.getElementById('goesTimeScrubRange');
  if (range && !range.dataset.goesRangeWired) {
    range.dataset.goesRangeWired = '1';

    const idxFromRange = () => Number(range.value) || 0;

    range.addEventListener('pointerdown', () => {
      gkUserDragging = true;
      gkIntentionalScrub = true;
      if (gkPlaying || gkBuffering) pauseGkPlay();
    });
    range.addEventListener('pointerup', () => {
      gkUserDragging = false;
      scheduleScrubSeek(map, idxFromRange(), { immediate: true });
    });
    range.addEventListener('pointercancel', () => {
      gkUserDragging = false;
      scheduleScrubSeek(map, idxFromRange(), { immediate: true });
    });
    // input fires continuously while dragging — coalesce so only the latest
    // index fully applies (label stays live; setTiles is debounced).
    range.addEventListener('input', () => {
      scheduleScrubSeek(map, idxFromRange(), { immediate: false });
    });
    range.addEventListener('change', () => {
      gkUserDragging = false;
      scheduleScrubSeek(map, idxFromRange(), { immediate: true });
    });
  }

  syncTimeTransport();

  // Pan into a sat's coverage mid-scrub: re-apply current play frame so the
  // viewport cull does not leave a newly visible sat stuck on an old URL.
  if (!map._goesPlayMoveWired) {
    map._goesPlayMoveWired = true;
    map.on('moveend', () => {
      const st = goesUiState;
      if (!st?.gkPlayFrames?.length) return;
      if (!st.scrubbing && !gkPlaying) return;
      if (!Number.isFinite(st.gkPlayIndex)) return;
      const gen = bumpGkClockGen();
      applyGkPlayFrame(map, st, st.gkPlayIndex, gen);
    });
  }
}

/**
 * Toolbar Satellite: GeoColor on/off + bottom time transport.
 * Cold start may already have GeoColor on — first tap then only opens transport.
 * Tap again hides transport and clears GeoColor. ?scrub=1 still forces transport on.
 */
export function wireGoesSatMode(map) {
  const btn = document.getElementById('goesSatModeBtn');
  if (!btn || btn.dataset.goesSatWired) return;
  btn.dataset.goesSatWired = '1';

  const setBoxes = (on) => {
    const east = document.getElementById('lyr-goes-east-demo');
    const west = document.getElementById('lyr-goes-west-demo');
    const met = document.getElementById('lyr-goes-meteosat-demo');
    const gk = document.getElementById('lyr-goes-gk2a-demo');
    if (east) east.checked = on;
    if (west) west.checked = on;
    if (met) met.checked = on;
    // Himawari parked — sat-mode does not enable it
    if (gk) gk.checked = on;
    const satMaster = document.getElementById('lyr-sat');
    if (satMaster) satMaster.checked = on;
    honourCheckbox(map, 'lyr-goes-east-demo', GOES_EAST_LAYER_ID);
    honourCheckbox(map, 'lyr-goes-west-demo', GOES_WEST_LAYER_ID);
    honourCheckbox(map, 'lyr-goes-meteosat-demo', GOES_METEOSAT_LAYER_ID);
    honourCheckbox(map, 'lyr-goes-gk2a-demo', GOES_GK2A_LAYER_ID);
    if (!on) {
      scrubberTestOpen = false;
      transportUserOpen = false;
      transportExpanded = false;
      stopTransportAgeTicker();
      if (map) snapGkPlayToTip(map);
      else {
        clearGkPlayTimer();
        paintGkPlayLabel(null, { show: false });
      }
    }
    setTimeBarVisible(false, map);
    syncSatModeButton();
    refreshTransportVisibility();
    syncTimeTransport();
    syncMosaicAttribution(map);
    syncSatRoadsVisibility(map);
  };

  btn.addEventListener('click', () => {
    const satOn = eitherGeocolorOn();
    if (!satOn) {
      setBoxes(true);
      // Existing tip pipeline (latest.json). No scrubber.
      primeTimeTransport(map);
      return;
    }
    setBoxes(false);
  });

  syncSatModeButton();
  refreshTransportVisibility();
  // Cold sat-on: start minimized (chip), not expanded.
  if (transportShouldShow()) setTransportExpanded(false);
  syncTimeTransport();
  schedulePositionTransport();
  if (!window._goesTransportResizeWired) {
    window._goesTransportResizeWired = true;
    window.addEventListener('resize', schedulePositionTransport);
    window.addEventListener('orientationchange', schedulePositionTransport);
    window.addEventListener('ddb-wind-chrome', schedulePositionTransport);
  }
}

/**
 * Wait briefly for MapLibre style/WebGL after a background tab restore.
 * Chrome often drops the context while hidden; plain tip polls then no-op.
 * @param {import('maplibre-gl').Map} map
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
function awaitMapStyleReady(map, timeoutMs = 2000) {
  if (!map) return Promise.resolve(false);
  try {
    if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
      return Promise.resolve(true);
    }
  } catch {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(finish, timeoutMs);
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(t);
      try {
        map.off('style.load', finish);
        map.off('idle', finish);
        map.off('load', finish);
      } catch {
        /* ignore */
      }
      let ok = false;
      try {
        ok =
          (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) ||
          Boolean(map.getStyle?.());
      } catch {
        ok = false;
      }
      resolve(ok);
    }
    try {
      map.once('style.load', finish);
      map.once('idle', finish);
      map.once('load', finish);
      if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) finish();
    } catch {
      finish();
    }
  });
}

function stopTipPoll() {
  if (_tipPollTimer) {
    clearInterval(_tipPollTimer);
    _tipPollTimer = 0;
  }
}

function startTipPoll(opts = {}) {
  stopTipPoll();
  if (typeof _tipRefresh !== 'function') return;
  // Fire once immediately — setInterval alone waits a full period, so a
  // leave-open session stuck on a ~03:30 stamp would sit another 60s–10min.
  // Wake path passes immediate:false when it already ran fromWake refresh.
  if (opts.immediate !== false && !document.hidden) {
    Promise.resolve()
      .then(() => _tipRefresh({}))
      .catch(() => {});
  }
  _tipPollTimer = setInterval(() => {
    if (document.hidden) return;
    _tipRefresh({});
  }, _tipPollMs);
}

/**
 * Live tip = not scrubbing / not mid-play (transport chip "live" state).
 * Tip catch-up / tab-wake gate on gkUserDragging instead — parked scrub still
 * snaps when latest.json advances.
 */
function isOnLiveTip() {
  return isTransportChipLive();
}

/**
 * Debounced wake on visibilitychange / pageshow / focus: force tip poll +
 * restart interval. Pause polls while hidden (Chrome throttles them into
 * long gaps that race the wake refresh).
 */
function wireTipWatch() {
  if (_tipWatchWired) return;
  _tipWatchWired = true;

  function scheduleWakeRefresh(_reason) {
    if (!eitherGeocolorOn()) return;
    if (document.visibilityState !== 'visible') return;
    if (_wakeTimer) clearTimeout(_wakeTimer);
    _wakeTimer = setTimeout(() => {
      _wakeTimer = 0;
      if (!eitherGeocolorOn() || document.visibilityState !== 'visible') return;
      const run = _tipRefresh;
      if (typeof run !== 'function') return;
      // Immediate tip poll on wake — do not wait for the next interval.
      // fromWake awaits style/WebGL restore; snaps to tip unless actively dragging.
      run({ fromWake: true }).then(() => {
        // Snap to tip unless user is actively dragging scrub (parked mid-
        // timeline / mid-play still catch up after background throttle).
        if (!eitherGeocolorOn() || gkUserDragging) return;
        const map = goesUiMap;
        const state = goesUiState;
        if (!map || !state) return;
        return catchUpToLiveTips(map, state, { forceTiles: true });
      });
      startTipPoll({ immediate: false });
    }, WAKE_DEBOUNCE_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      _wasHidden = true;
      // Pause tip polls while hidden — Chrome throttles them into long gaps
      // and they race the wake refresh (and often no-op on dead WebGL).
      stopTipPoll();
      if (_wakeTimer) {
        clearTimeout(_wakeTimer);
        _wakeTimer = 0;
      }
      return;
    }
    scheduleWakeRefresh('visibility');
  });
  window.addEventListener('pageshow', (ev) => {
    // bfcache restore: treat as wake so tip/clock catch up without F5.
    if (ev && ev.persisted) _wasHidden = true;
    scheduleWakeRefresh('pageshow');
  });
  window.addEventListener('focus', () => {
    // visibilitychange usually covers tab return; only wake if we were hidden.
    if (!_wasHidden) return;
    if (document.visibilityState !== 'visible') return;
    scheduleWakeRefresh('focus');
  });
}

/**
 * Add East + West + Meteosat + Himawari + GK2A owned GeoColor rasters under the fire stack.
 * Zoom-fade + layer maxzoom cutoff; frames from latest.json; sat-mode button.
 */
export async function addGoesGeocolorLayers(map) {
  registerAllGoesSeamProtocols();
  setTimeBarVisible(false);
  const before = beforeId(map);

  // One latest.json fetch → paint each sat’s last-good frame (no 404 step-back).
  // Fall back to floored-now only if the manifest misses a sat.
  const guess = floorUtcToOwnedFrame();
  let man = null;
  try {
    man = await fetchGeocolorLatestManifest({ force: true });
  } catch (e) {
    console.warn('[goes-geocolor] latest.json cold start:', e.message);
  }
  let westFrame = frameFromLatestManifest('goes-west', man) || guess;
  let eastFrame = frameFromLatestManifest('goes-east', man) || guess;
  let metFrame = frameFromLatestManifest('meteosat', man) || guess;
  // Himawari parked — do not resolve or mount (saves tiles over EA).
  let himFrame = null;
  let gkFrame = frameFromLatestManifest('gk2a', man) || guess;

  // Probe only sats the manifest omitted. If latest.json failed entirely
  // (CORS / network), stick with floored-now — full probes thrash and "cycle".
  if (man) {
    const need = [];
    if (!frameFromLatestManifest('goes-west', man)) need.push(['west', resolveOwnedWestLatest]);
    if (!frameFromLatestManifest('goes-east', man)) need.push(['east', resolveOwnedEastLatest]);
    if (!frameFromLatestManifest('meteosat', man)) need.push(['met', resolveOwnedMeteosatLatest]);
    // himawari parked
    if (!frameFromLatestManifest('gk2a', man)) need.push(['gk', resolveOwnedGk2aLatest]);
    if (need.length) {
      const settled = await Promise.allSettled(need.map(([, fn]) => fn()));
      settled.forEach((s, i) => {
        if (s.status !== 'fulfilled') return;
        const key = need[i][0];
        if (key === 'west') westFrame = s.value;
        if (key === 'east') eastFrame = s.value;
        if (key === 'met') metFrame = s.value;
        // him parked
        if (key === 'gk') gkFrame = s.value;
      });
    }
  }

  // Bottom→top: GK2A → Meteosat → East → West → West-widl so each faded western
  // sat sits above its eastern partner. Do not move East above West (or Met
  // above East). Widl shares West stamp; Himawari parked — layer not mounted.
  ensureRaster(
    map,
    GOES_GK2A_SOURCE_ID,
    GOES_GK2A_LAYER_ID,
    [ownedGoesGk2aTileUrl(gkFrame.ymd, gkFrame.hhmm)],
    { ...goesGk2a, tileSize: 256, maxzoom: 7, bounds: satMaplibreBounds('gk2a') },
    before,
    '',
    visibilityFromCheckbox('lyr-goes-gk2a-demo')
  );
  ensureRaster(
    map,
    GOES_METEOSAT_SOURCE_ID,
    GOES_METEOSAT_LAYER_ID,
    [ownedGoesMeteosatTileUrl(metFrame.ymd, metFrame.hhmm)],
    { ...goesMeteosat, tileSize: 256, maxzoom: 7, bounds: satMaplibreBounds('meteosat') },
    before,
    '',
    visibilityFromCheckbox('lyr-goes-meteosat-demo')
  );
  ensureRaster(
    map,
    GOES_EAST_SOURCE_ID,
    GOES_EAST_LAYER_ID,
    [ownedGoesEastTileUrl(eastFrame.ymd, eastFrame.hhmm)],
    { ...goesEast, tileSize: 256, maxzoom: 7, bounds: satMaplibreBounds('east') },
    before,
    '',
    visibilityFromCheckbox('lyr-goes-east-demo')
  );
  ensureRaster(
    map,
    GOES_WEST_SOURCE_ID,
    GOES_WEST_LAYER_ID,
    [ownedGoesWestTileUrl(westFrame.ymd, westFrame.hhmm)],
    { ...goesWest, tileSize: 256, maxzoom: 7, bounds: satMaplibreBounds('west') },
    before,
    '',
    visibilityFromCheckbox('lyr-goes-west-demo')
  );
  // West-widl is not a separate MapLibre layer — dual-CDN family protocol on West.

  // Tip stamp = sat owning map center (hard-cut), not max()/min() of all sats.
  const tipBag = { eastFrame, westFrame, metFrame, gkFrame };
  const tipFrame =
    newestTipFrame(map, tipBag) ||
    globalMaxTipFrame(tipBag) ||
    gkFrame ||
    eastFrame ||
    westFrame ||
    metFrame;

  const state = {
    eastFrame,
    westFrame,
    metFrame,
    himFrame,
    gkFrame,
    tipFrame,
    currentTime: tipFrame.iso,
    displayFrame: tipFrame,
    times: [],
    timesManifest: null,
    scrubbing: false
  };

  goesUiMap = map;
  goesUiState = state;
  wireVisibilityAndBar(map, state);
  wireGoesSatMode(map);
  wireGoesTimeScrubTest(map);
  wireTimeSlider(map, state);
  wireAttribExtent(map);
  setTimeBarVisible(scrubberTestOpen && eitherGeocolorOn(), map);
  syncMosaicAttribution(map);
  // Cold open: force live tip clock from latest.json center-sat (not playlist).
  state.scrubbing = false;
  gkIntentionalScrub = false;
  state.displayFrame = tipFrame;
  state.currentTime = tipFrame.iso;
  paintGkPlayLabel(tipFrame, { show: true });
  paintTransportMeta(map);
  if (transportShouldShow()) startTransportAgeTicker();
  // Settle: prime/rebuild may race mount; re-assert latest tip + tiles once.
  queue.resolve().then(() => {
    if (goesUiState !== state || !goesUiMap) return;
    if (gkUserDragging || gkPlaying || gkBuffering) return;
    gkIntentionalScrub = false;
    forceLiveTipFromPoll(goesUiMap, state, { forceTiles: true });
    console.info(
      '[goes-geocolor] cold settle → live tip',
      newestTipFrame(goesUiMap, state)?.iso || state.tipFrame?.iso || '—'
    );
  });

  console.info(
    '[goes-geocolor] East owned @',
    `${eastFrame.ymd}/${eastFrame.hhmm}`,
    `cutoff=${goesFadeCutoff()}`,
    ownedGoesEastTileUrl(eastFrame.ymd, eastFrame.hhmm)
  );
  console.info(
    '[goes-geocolor] West owned @',
    `${westFrame.ymd}/${westFrame.hhmm}`,
    ownedGoesWestTileUrl(westFrame.ymd, westFrame.hhmm)
  );
  console.info(
    '[goes-geocolor] West-family dual CDN @',
    `${westFrame.ymd}/${westFrame.hhmm}`,
    '(goes-west + goes-west-widl via one source)'
  );
  console.info(
    '[goes-geocolor] Meteosat owned @',
    `${metFrame.ymd}/${metFrame.hhmm}`,
    ownedGoesMeteosatTileUrl(metFrame.ymd, metFrame.hhmm)
  );
  // Himawari parked
  console.info(
    '[goes-geocolor] GK2A owned @',
    `${gkFrame.ymd}/${gkFrame.hhmm}`,
    ownedGoesGk2aTileUrl(gkFrame.ymd, gkFrame.hhmm)
  );

  const refresh = async (opts = {}) => {
    const fromWake = Boolean(opts.fromWake);
    if (!map) return;
    // Tip poll gate: MapLibre globe often keeps isStyleLoaded() false (and
    // map.loaded() false) while getStyle() + sources are live — measured on
    // app.disasterdb.com cold open. Treating !isStyleLoaded as "not ready"
    // silent-returns every interval poll; transportClockFrame freezes and the
    // age chip grows to ~1h40 while latest.json tips stay fresh. Only hard-bail
    // when there is no style object. Tab-wake still awaits WebGL restore.
    try {
      const styleMissing = !map.getStyle?.();
      const styleFlagOff =
        typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded();
      if (styleMissing || styleFlagOff) {
        if (styleMissing) {
          if (!fromWake) return;
          const ready = await awaitMapStyleReady(map);
          if (!ready) return;
        }
        // styleFlagOff but getStyle() present → proceed (globe false-negative).
      }
    } catch {
      if (!fromWake) return;
    }
    _wasHidden = false;

    // Bust latest.json memory + HTTP cache so refresh picks up new frames.
    // fromWake ⇒ skip 30s in-memory reuse; URL ?t= + no-store on every fetch.
    try {
      await fetchGeocolorLatestManifest({ force: true, fromWake });
    } catch (e) {
      console.warn('[goes-geocolor] latest.json refresh:', e.message);
    }
    // Tip signature before per-sat resolve — any ymd/hhmm advance triggers catch-up.
    const prevTipSig = tipSignature(state);

    try {
      const nextEast = await resolveOwnedEastLatest();
      const prev = state.eastFrame;
      if (
        !prev ||
        prev.ymd !== nextEast.ymd ||
        prev.hhmm !== nextEast.hhmm
      ) {
        state.eastFrame = nextEast;
        console.info(
          '[goes-geocolor] East tip →',
          `${nextEast.ymd}/${nextEast.hhmm}`
        );
      }
    } catch (e) {
      console.warn('[goes-geocolor] East refresh:', e.message);
    }

    try {
      const nextWest = await resolveOwnedWestLatest();
      const prev = state.westFrame;
      if (
        !prev ||
        prev.ymd !== nextWest.ymd ||
        prev.hhmm !== nextWest.hhmm
      ) {
        state.westFrame = nextWest;
        let remountedWest = false;
        if (!map.getSource(GOES_WEST_SOURCE_ID)) {
          ensureRaster(
            map,
            GOES_WEST_SOURCE_ID,
            GOES_WEST_LAYER_ID,
            [ownedGoesWestTileUrl(nextWest.ymd, nextWest.hhmm)],
            { ...goesWest, tileSize: 256, maxzoom: 7, bounds: satMaplibreBounds('west') },
            before,
            '',
            visibilityFromCheckbox('lyr-goes-west-demo')
          );
          remountedWest = true;
        }
        // widl folded into West-family source

        if (remountedWest) {
          // Restack so West family stays on top of East (and Met above GK2A).
          // Do NOT moveLayer East above West (that re-hardens the EW seam).
          restackGoesLayers(map, before);
          wireVisibilityAndBar(map, state);
        }
        console.info(
          '[goes-geocolor] West tip →',
          `${nextWest.ymd}/${nextWest.hhmm}`,
          '(widl stamp shared)'
        );
      }
    } catch (e) {
      console.warn('[goes-geocolor] West refresh:', e.message);
    }

    try {
      const nextMet = await resolveOwnedMeteosatLatest();
      const prev = state.metFrame;
      if (
        !prev ||
        prev.ymd !== nextMet.ymd ||
        prev.hhmm !== nextMet.hhmm
      ) {
        state.metFrame = nextMet;
        if (!map.getSource(GOES_METEOSAT_SOURCE_ID)) {
          ensureRaster(
            map,
            GOES_METEOSAT_SOURCE_ID,
            GOES_METEOSAT_LAYER_ID,
            [ownedGoesMeteosatTileUrl(nextMet.ymd, nextMet.hhmm)],
            { ...goesMeteosat, tileSize: 256, maxzoom: 7, bounds: satMaplibreBounds('meteosat') },
            before,
            '',
            visibilityFromCheckbox('lyr-goes-meteosat-demo')
          );
          restackGoesLayers(map, before);
          wireVisibilityAndBar(map, state);
        }
        console.info(
          '[goes-geocolor] Meteosat tip →',
          `${nextMet.ymd}/${nextMet.hhmm}`
        );
      }
    } catch (e) {
      console.warn('[goes-geocolor] Meteosat refresh:', e.message);
    }

    // Himawari parked — no refresh

    try {
      const nextGk = await resolveOwnedGk2aLatest();
      const prev = state.gkFrame;
      if (
        !prev ||
        prev.ymd !== nextGk.ymd ||
        prev.hhmm !== nextGk.hhmm
      ) {
        state.gkFrame = nextGk;
        if (!map.getSource(GOES_GK2A_SOURCE_ID)) {
          ensureRaster(
            map,
            GOES_GK2A_SOURCE_ID,
            GOES_GK2A_LAYER_ID,
            [ownedGoesGk2aTileUrl(nextGk.ymd, nextGk.hhmm)],
            { ...goesGk2a, tileSize: 256, maxzoom: 7, bounds: satMaplibreBounds('gk2a') },
            before,
            '',
            visibilityFromCheckbox('lyr-goes-gk2a-demo')
          );
          restackGoesLayers(map, before);
          wireVisibilityAndBar(map, state);
        }
        console.info(
          '[goes-geocolor] GK2A tip →',
          `${nextGk.ymd}/${nextGk.hhmm}`
        );
      }
    } catch (e) {
      console.warn('[goes-geocolor] GK2A refresh:', e.message);
    }

    // Each sat keeps its own last-good frame (they are not synced).
    // Tip stamp = center-sector owner (not max of all sats / not fixed GK2A).
    const nextTip = newestTipFrame(map, state) || globalMaxTipFrame(state);
    state.tipFrame = nextTip;
    // Multi-sat 1h bar retired — skip rebuildTimeList during tip refresh.
    // Himawari parked.
    const tipAdvanced = tipSignature(state) !== prevTipSig;
    const clockStale = transportClockStaleVsTip(nextTip);
    // Aggressive leave-open fix: every successful poll rewrites the age
    // chip from newestTipFrame and setTiles per-sat latest when not dragging.
    // tipAdvanced / fromWake also rebuild the play-list tip edge. forceTiles
    // remounts when the template string is unchanged but clock lagged tip
    // (frozen ~03:30 / ~2h5m chip while latest.json is fresh).
    if (!gkUserDragging) {
      const forceTiles = tipAdvanced || fromWake || clockStale;
      if (tipAdvanced || fromWake) {
        await catchUpToLiveTips(map, state, { forceTiles });
      } else {
        forceLiveTipFromPoll(map, state, { forceTiles });
      }
    } else if (state.eastFrame) {
      // Active scrub drag: East stays tip-live (#77); do not steal the drag.
      applyEastOwned(map, state.eastFrame);
      const frame =
        state.gkPlayFrames?.[state.gkPlayIndex] ||
        state.displayFrame ||
        state.gkFrame;
      if (frame) paintGkPlayLabel(frame, { show: true });
      if (transportShouldShow()) startTransportAgeTicker();
    }
  };

  const refreshMs = goesEast.refreshMs || goesWest.refreshMs || 60 * 1000;
  _tipPollMs = refreshMs;
  _tipRefresh = refresh;
  wireTipWatch();
  startTipPoll();
  map.on('remove', () => {
    stopTipPoll();
    if (_tipRefresh === refresh) _tipRefresh = null;
    if (_wakeTimer) {
      clearTimeout(_wakeTimer);
      _wakeTimer = 0;
    }
  });

  return {
    eastLayerId: GOES_EAST_LAYER_ID,
    westLayerId: GOES_WEST_LAYER_ID,
    westWidlLayerId: GOES_WEST_WIDL_LAYER_ID,
    meteosatLayerId: GOES_METEOSAT_LAYER_ID,
    himawariLayerId: GOES_HIMAWARI_LAYER_ID,
    gk2aLayerId: GOES_GK2A_LAYER_ID,
    time: tipFrame.iso,
    eastFrame,
    westFrame,
    metFrame,
    himFrame,
    gkFrame,
    times: state.times
  };
}

// ---------------------------------------------------------------------------
// Lazy mount — when defaultOn is false, skip until the user enables a toggle
// ---------------------------------------------------------------------------

let goesMountPromise = null;

/** Call after map.setStyle — prior GOES sources/layers are gone. */
export function resetGoesGeocolorMount() {
  clearGkPlayTimer();
  paintGkPlayLabel(null, { show: false });
  transportClockFrame = null;
  scrubberTestOpen = false;
  transportUserOpen = false;
  goesMountPromise = null;
  goesUiState = null;
  goesUiMap = null;
  stopTipPoll();
  _tipRefresh = null;
  if (_wakeTimer) {
    clearTimeout(_wakeTimer);
    _wakeTimer = 0;
  }
  _wasHidden = false;
  _lastMosaicAttr = null;
  _attribMoveWired = false;
  // Allow re-wire against the next mount's state (avoid dead times[] closure).
  gkUserDragging = false;
  gkIntentionalScrub = false;
  cancelPendingScrubApply();
  setTransportVisible(false);
  for (const id of [
    'geocolorTimeSlider',
    'geocolorTimeNowBtn',
    'goesTimePlayBtn',
    'goesTimeLatestBtn',
    'goesTimeScrubRange',
    'goesSatModeBtn'
  ]) {
    const el = document.getElementById(id);
    if (!el?.dataset) continue;
    delete el.dataset.goesSliderWired;
    delete el.dataset.goesNowWired;
    delete el.dataset.goesScrubWired;
    delete el.dataset.goesLatestWired;
    delete el.dataset.goesRangeWired;
    delete el.dataset.goesSatWired;
  }
}

/** Mount East+West GeoColor once; safe to call repeatedly. */
export function ensureGoesGeocolorMounted(map) {
  if (!goesMountPromise) {
    goesMountPromise = addGoesGeocolorLayers(map).catch((e) => {
      goesMountPromise = null;
      console.warn('[goes-geocolor]', e.message);
      return null;
    });
  }
  return goesMountPromise;
}

/** Wire layer-list checkboxes to mount GOES on first enable. */
export function wireGoesGeocolorLazy(map) {
  for (const id of ['lyr-goes-east-demo', 'lyr-goes-west-demo', 'lyr-goes-meteosat-demo', 'lyr-goes-gk2a-demo']) {
    const box = document.getElementById(id);
    if (!box || box.dataset.goesLazyWired) continue;
    box.dataset.goesLazyWired = '1';
    box.addEventListener('change', () => {
      if (box.checked) ensureGoesGeocolorMounted(map);
    });
  }
  wireGoesSatMode(map);
  wireGoesTimeScrubTest(map);
}

/** @deprecated use addGoesGeocolorLayers */
export async function addGoesEastDemoLayer(map) {
  return addGoesGeocolorLayers(map);
}
