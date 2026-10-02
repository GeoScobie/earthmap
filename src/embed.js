// ---------------------------------------------------------------------------
// Embed mode — chrome-light map for website iframes (SEO / fire pages).
//
// Query: ?embed=1 or ?embed=true (also yes|on; bare ?embed). Off: 0|false|no|off.
// Works with ?basemap=… and MapLibre hash #z/lat/lng.
//
// Forced fire name on SEO embeds (always-on, fire-anchored label):
//   ?fireLabel=<URL-encoded display name>   (H1 text; preferred)
//   alias: ?label=… if fireLabel absent
//   ?fire=<id>  match usa_fire_pt fire_id_source (short UUID prefix OK,
//               e.g. 78d35d3b or {78D35D3B-F791-4961-AE36-C6D1A4DFF5A0})
//               Anchor = that USA fire point geometry when loaded;
//               else fixed hash #z/lat/lng (no camera-follow).
//               Label text from fireLabel if set, else feature fire_name.
//
// Example (Sinlahekin):
//   https://app.disasterdb.com/?basemap=disasterdb-topo&embed=1&fireLabel=Sinlahekin%20Fire&fire=78d35d3b#10/48.7/-119.5
//
// See docs/PR_EMBED_MODE.md.
// ---------------------------------------------------------------------------

import { goesGeocolor } from './theme.js';

function queryParams() {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

/**
 * True when the URL asks for embed / iframe chrome-light mode.
 * Accepts: embed=1|true|yes|on, or bare ?embed (empty value).
 */
export function resolveEmbedMode() {
  const q = queryParams();
  if (!q?.has('embed')) return false;
  const v = (q.get('embed') || '').toLowerCase();
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return v === '' || v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * GOES GeoColor default visibility (cold-start mount) for East + West.
 * Embed always forces OFF (theme.goesGeocolor.defaultOn is ignored).
 * Non-embed follows theme.goesGeocolor.defaultOn.
 */
export function resolveGoesGeocolorDefaultOn() {
  if (resolveEmbedMode()) return false;
  return Boolean(goesGeocolor?.defaultOn);
}

/** West default — follows westDefaultOn when set, else same as defaultOn. */
export function resolveGoesWestDefaultOn() {
  if (resolveEmbedMode()) return false;
  if (typeof goesGeocolor?.westDefaultOn === 'boolean') {
    return Boolean(goesGeocolor.westDefaultOn) && Boolean(goesGeocolor?.defaultOn);
  }
  return Boolean(goesGeocolor?.defaultOn);
}

/** Meteosat default — follows meteosatDefaultOn when set, else same as defaultOn. */
export function resolveGoesMeteosatDefaultOn() {
  if (resolveEmbedMode()) return false;
  if (typeof goesGeocolor?.meteosatDefaultOn === 'boolean') {
    return Boolean(goesGeocolor.meteosatDefaultOn) && Boolean(goesGeocolor?.defaultOn);
  }
  return Boolean(goesGeocolor?.defaultOn);
}

/** Himawari default — follows himawariDefaultOn when set, else same as defaultOn. */
export function resolveGoesHimawariDefaultOn() {
  if (resolveEmbedMode()) return false;
  if (typeof goesGeocolor?.himawariDefaultOn === 'boolean') {
    return Boolean(goesGeocolor.himawariDefaultOn) && Boolean(goesGeocolor?.defaultOn);
  }
  return Boolean(goesGeocolor?.defaultOn);
}

/** GK2A default — follows gk2aDefaultOn when set, else same as defaultOn. */
export function resolveGoesGk2aDefaultOn() {
  if (resolveEmbedMode()) return false;
  if (typeof goesGeocolor?.gk2aDefaultOn === 'boolean') {
    return Boolean(goesGeocolor.gk2aDefaultOn) && Boolean(goesGeocolor?.defaultOn);
  }
  return Boolean(goesGeocolor?.defaultOn);
}

/**
 * Apply body/html class + force GOES layer-list checkboxes to match defaults.
 * Call once early in createMap (before layers / initUI).
 * @returns {boolean} whether embed mode is active
 */
export function applyEmbedMode() {
  const embed = resolveEmbedMode();

  if (embed) {
    try {
      document.documentElement.classList.add('embed-mode');
      document.body?.classList.add('embed-mode');
    } catch {
      /* SSR / no DOM */
    }
  }

  // Sync GOES boxes: East + West + Meteosat + Himawari + GK2A. Embed forces all OFF.
  const goesOn = resolveGoesGeocolorDefaultOn();
  const westOn = resolveGoesWestDefaultOn();
  const metOn = resolveGoesMeteosatDefaultOn();
  const himOn = resolveGoesHimawariDefaultOn();
  const gkOn = resolveGoesGk2aDefaultOn();
  const east = document.getElementById('lyr-goes-east-demo');
  if (east) east.checked = goesOn;
  const west = document.getElementById('lyr-goes-west-demo');
  if (west) west.checked = westOn;
  const met = document.getElementById('lyr-goes-meteosat-demo');
  if (met) met.checked = metOn;
  const him = document.getElementById('lyr-goes-himawari-demo');
  if (him) him.checked = himOn;
  const gk = document.getElementById('lyr-goes-gk2a-demo');
  if (gk) gk.checked = gkOn;

  const satBtn = document.getElementById('goesSatModeBtn');
  if (satBtn) {
    const on = Boolean(goesOn || westOn || metOn || himOn || gkOn);
    satBtn.classList.toggle('active', on);
    satBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  return embed;
}


/**
 * Display name for forced SEO fire label on embeds.
 * Canonical: fireLabel. Alias: label (only if fireLabel absent).
 * @returns {string|null} raw query value (may need sanitize) or null
 */
export function resolveFireLabel() {
  const q = queryParams();
  if (!q) return null;
  let v = null;
  if (q.has('fireLabel')) v = q.get('fireLabel');
  else if (q.has('label')) v = q.get('label');
  if (v == null) return null;
  v = String(v).trim();
  return v === '' ? null : v;
}

/**
 * Optional USA fire point id for label anchoring / future select.
 * Matched against usa_fire_pt_active_2026 props (primary: fire_id_source).
 * Website should bake short UUID prefix or full Irwin UUID, e.g. 78d35d3b.
 * Label text still prefers resolveFireLabel() (H1); falls back to fire_name.
 * @returns {string|null}
 */
export function resolveFireId() {
  const q = queryParams();
  if (!q?.has('fire')) return null;
  const v = String(q.get('fire') || '').trim();
  return v === '' ? null : v;
}
