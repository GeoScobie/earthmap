// ---------------------------------------------------------------------------
// 10 m wind -- FireMap's wind, 1:1.
//
// Rendering, UI and data all match firemap.live:
//
//   particles  WindParticlesCPU (wind-particles-cpu.js, ported verbatim from
//              firemap.live). A few hundred to ~1500 soft glowing tadpoles,
//              viewport-relative so density holds at every zoom, simulated on
//              the CPU and projected with map.project() -- globe-correct on
//              MapLibre exactly as it is on Mapbox. Pale blue (217,235,255) for
//              calm air ramping to white at 30 m/s, master opacity 0.62, with
//              the global/city scale anchors, wide-zoom thinning and globe limb
//              cull that firemap.live ships.
//   chrome     wind-ui.js -- toolbar dot, bottom-right LIVE nub that expands
//              into the day track / play / Now bar. Same file as FireMap, with
//              only the MapLibre control-class selectors added.
//   data       FireMap's live GFS publish (manifest.json + one RGB PNG per
//              forecast hour). R = u, G = v, B = validity mask.
//
// This replaces the earlier mapbox-exif-layer ParticleMotion field (900k grey
// dots seeded across the whole image, gated to z2.5-6, arrows above that),
// which read as a solid speckled mat next to FireMap's streaks.
// ---------------------------------------------------------------------------

import { WindParticlesCPU, loadWindManifest } from './wind-particles-cpu.js';
import { mountWindUI } from './wind-ui.js';

// FireMap's wind host. Absolute HTTPS on purpose: EarthMap has no /wind/ tree.
// It is served with Access-Control-Allow-Origin: *, so the PNGs decode through
// canvas without tainting it. EarthMap deliberately does NOT re-host a copy:
// the ETL republishes there, and a second tree would silently go stale (and
// was 404ing on every Hostinger deploy).
const WIND_HOST = 'https://firemap.live/data/wind/gfs/';
const MANIFEST_URL = WIND_HOST + 'manifest.json';

// The published pixels are encoded at +/-40 m/s even though FireMap's manifest
// currently advertises +/-50 -- firemap.live forces the same override. Drop it
// once the manifest's encoding block reports -40/40.
const FIREMAP_UV_RANGE = [-40, 40];

// Hide the layer rather than show stale weather. FireMap's manifest is
// refreshed per GFS cycle (~6 h apart, plus NOAA's publication lag), so the
// run's age is judged on a 12 h clock; the frame nearest now must still sit
// within 3 h of it, or the map would present old wind as current.
const FIREMAP_MAX_AGE_HOURS = 12;
const MAX_FRAME_GAP_HOURS = 3;

const state = { map: null, layer: null, manifest: null, ui: null };

/** Fetch FireMap's manifest; null when missing, empty or stale. */
async function loadFresh() {
  let man;
  try {
    man = await loadWindManifest(MANIFEST_URL);
  } catch (e) {
    console.warn('[wind] manifest:', e.message);
    return null;
  }
  if (!man.frames.length) { console.warn('[wind] manifest has no frames'); return null; }
  const issued = Date.parse(man.updated || man.cycle || '');
  const ageH = (Date.now() - issued) / 3.6e6;
  const near = man.frameFor(Date.now());
  const gapH = near ? Math.abs(near.t - Date.now()) / 3.6e6 : Infinity;
  if (!(ageH <= FIREMAP_MAX_AGE_HOURS) || gapH > MAX_FRAME_GAP_HOURS) {
    console.warn('[wind] global is ' + (isFinite(ageH) ? ageH.toFixed(1) : '?') + ' h old — skipping');
    return null;
  }
  return man;
}

export async function addWindLayer(map) {
  state.map = map;
  const man = await loadFresh();
  if (!man) { console.warn('[wind] no usable playlist'); return null; }
  state.manifest = man;

  const frame = man.frameFor(Date.now());
  // Same construction as WindParticlesCPU.fromManifest on firemap.live, minus
  // the second manifest fetch: manifest-derived values are defaults and the
  // +/-40 override wins.
  const layer = new WindParticlesCPU(map, {
    manifest: man,
    image: frame.href,
    uRange: FIREMAP_UV_RANGE,
    vRange: FIREMAP_UV_RANGE,
    hasMask: man.encoding.hasMask
  });
  layer.manifestUrl = MANIFEST_URL;
  state.layer = layer;
  window.__wind = { layer, frame };
  console.info('[wind] global — ' + frame.valid + ' — ' + frame.href);

  // Bottom-right wind transport (minimized LIVE nub ↔ expand left), with the
  // loader from THIS module instance so the 10-minute refresh stays current.
  try {
    const box = document.getElementById('lyr-wind');
    const ui = mountWindUI(map, layer, man, {
      defaultOn: box ? box.checked : true,
      loadManifest: loadWindManifest,
      onChange(on) { if (box) box.checked = on; }
    });
    state.ui = ui;
    window.__windUi = ui;
  } catch (e) {
    // A wind UI failure must never take the rest of the map down with it.
    console.warn('[wind] UI:', e.message);
  }
  return layer;
}

/** Layers-panel checkbox drives the same on/off as the toolbar button. */
export function wireWindToggle(map) {
  const box = document.getElementById('lyr-wind');
  if (!box) return;
  box.addEventListener('change', () => {
    if (state.ui && typeof state.ui.setOn === 'function') { state.ui.setOn(box.checked); return; }
    if (state.layer) state.layer.tune({ opacity: box.checked ? 0.62 : 0 });
  });
  if (state.ui) box.checked = !!state.ui.on;
}

/**
 * Kept for app.js. FireMap draws wind at every zoom -- density is viewport-
 * relative, so there is no band where it collapses -- so there is nothing to
 * gate any more.
 */
export function wireWindZoomGate() {}

/**
 * Live tuning handle, same as window.__cpu.tune() on firemap.live:
 *
 *     windTune({ opacity: 0.5 })
 *     windTune({ anchors: { global: { count: 1200 } } })
 */
export function windTune(overrides = {}) {
  return state.layer ? state.layer.tune(overrides) : null;
}
window.windTune = windTune;
