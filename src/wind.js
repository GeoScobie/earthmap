// ---------------------------------------------------------------------------
// 10 m wind particles
//
// Data is a plain equirectangular RGB PNG per forecast hour, served as static
// files. R = u, G = v, B = no-data mask (0 = NA, 255 = valid), with u/v
// de-normalised from 0-255 against a FIXED +/-40 m/s range. No tile server, no
// token, no GRIB in the browser. The ETL rolls GFS from its native 0-360
// longitude to -180..180 before writing the PNG, because the particle layer has
// no 360 wrap mode.
//
// The range must stay fixed across every frame of a run. It is not just a
// convention: interpolating raw pixel values between hour N and N+1 is only
// valid if both frames share a scale. A per-frame min/max would make the
// planned 15-minute lerp silently wrong rather than merely imprecise.
//
// Time is a playlist (latest.json), not a mosaic or a WMTS TIME dimension. The
// current frame is whichever valid_utc sits nearest wall clock -- it is NOT
// always f000, since the newest cycle is typically a few hours old.
//
// DENSITY IS AN EXTENT PROBLEM, NOT A COUNT PROBLEM. This is the single most
// important thing to know before touching the numbers below. Particles are
// seeded on a jittered lattice across the WHOLE source image and are never
// re-seeded to the viewport, so particleCount is a GLOBAL budget: at z8 you are
// looking at roughly a millionth of the world, so a global PNG puts a handful
// of particles on screen no matter how high the count goes -- and the count is
// the one setting that costs frames. Shrinking the IMAGE fixes it for free. The
// CONUS crop in PLAYLISTS is 1/38th the area of the global one, so the same
// budget lands 38x denser. That is why this file picks a playlist by extent
// instead of just turning particleCount up.
// ---------------------------------------------------------------------------

import { ParticleMotion } from 'mapbox-exif-layer';
import { addWindArrows } from './wind-arrows.js';
import { mountWindUI } from './wind-ui.js';

// FireMap's wind host. Absolute HTTPS on purpose: EarthMap has no /wind/ tree.
const WIND_HOST = 'https://firemap.live/data/wind/gfs/';

// The published pixels are encoded at +/-40 m/s even though FireMap's manifest
// currently advertises +/-50 -- firemap.live forces the same override. Drop it
// once the manifest's encoding block reports -40/40.
const FIREMAP_UV_RANGE = [-40, 40];

// FireMap's manifest is refreshed per GFS cycle (~6 h apart, plus NOAA's
// publication lag), not hourly, so its age is judged on a looser clock than
// the 3 h playlist gate below. The frames themselves must still bracket now.
const FIREMAP_MAX_AGE_HOURS = 12;

// Most specific first. The first playlist whose extent contains the view centre
// wins, so regional data takes over from global wherever it exists. Adding real
// HRRR / HRDPS later means adding entries here -- no other change.
const PLAYLISTS = [
  {
    name: 'global',
    // FireMap's live GFS publish -- the same /data/wind/gfs/ tree firemap.live
    // and its staging read (manifest.json + one PNG per forecast hour). It is
    // served with Access-Control-Allow-Origin: *, so the PNGs decode through
    // canvas without tainting it. EarthMap deliberately does NOT re-host a
    // copy on its own origin: the ETL republishes there, and a second tree
    // would silently go stale (and was 404ing on every Hostinger deploy).
    url: WIND_HOST + 'manifest.json',
    format: 'firemap',
    ramp: 'bright',
    // THREE SHORT COMETS per cell rather than one long streak. The library
    // draws one head plus `trailLength` tail points per particle and cannot
    // split a particle into several streaks -- but trading trail length for
    // particle count gets the same picture. Points drawn per frame is
    // count x (1 + trailLength), so 600k x 4 here is almost exactly the 200k x 9
    // this started at: three times the comets, a third the length, same cost.
    //
    // velocityFactor is pulled down with the trail, since it sets streak length
    // and trail spacing as well as speed -- left at 0.09 the shorter trail beads
    // apart into separate dots instead of reading as one small comet.
    look: { particleCount: 900000, pointSize: 2.0, trailLength: 2,
            trailSizeDecay: 0.70, fadeOpacity: 0.88, velocityFactor: 0.055,
            maxAge: 200, ageThreshold: 100 }
  }

  // A CONUS-cropped playlist is staged at /wind/gfs_conus/ and deliberately NOT
  // enabled. It does raise density at z4-5 -- dramatically, since it is 1/38th
  // the world's area -- but a fixed particle count over a fixed extent only
  // looks right inside a narrow zoom band: settings tuned at z4.7 saturate to a
  // solid white slab at z3, where the whole extent is on screen at once, and
  // thin out to specks by z7.
  //
  // Enabling a regional playlist is therefore not a tuning job. It needs the
  // count driven by visible extent rather than set per playlist, which this
  // library cannot do -- it seeds once across the image and never re-seeds to
  // the viewport. Mapbox's raster-particle avoids the whole problem by being
  // tile-based, which is why its particle-count is 4000 rather than 200000.
  // { name: 'conus', url: '/wind/gfs_conus/latest.json', ramp: 'dim',
  //   look: { particleCount: 1200000, pointSize: 1.5, trailLength: 6,
  //           trailSizeDecay: 0.75, fadeOpacity: 0.93, velocityFactor: 0.10,
  //           maxAge: 250, ageThreshold: 125 } }
];

// Hide the layer rather than show stale weather. A run older than this means
// the ETL stopped, and the map would otherwise present old wind as current.
const MAX_AGE_HOURS = 3;

// Show the layer only in the zoom band where it actually reads as flow.
//
// UPPER BOUND: density collapses as you zoom in (see the extent note at the
// top), so past ~z6 the field becomes scattered specks that look broken rather
// than sparse. It is also past the point where a 0.25-degree grid means
// anything -- that is ~28 km, so you are looking at interpolation. Raise this
// ONLY together with a smaller-extent playlist; on a global image a higher gate
// just puts the speckled state back on screen.
//
// LOWER BOUND: zoomed all the way out the whole world's worth of particles
// lands at once and reads as noise over the basemap rather than weather.
const MIN_ZOOM = 2.5;
const MAX_ZOOM = 6.0;

// Speed -> colour. Near-monochrome on purpose: this layer communicates through
// MOTION, not hue. A full spectral ramp fights the fire layers, which are the
// things on this map that are supposed to be coloured.
//
// These are deliberately dim greys rather than white. ParticleMotion builds its
// colormap with a helper that HARDCODES alpha to 255 -- the sibling helper used
// by SmoothRaster honours a 4th channel, this one does not -- so a translucent
// ramp is not available, and passing [r,g,b,a] silently drops the alpha.
// Dimming the RGB against the dark basemap is the only way to get a
// see-through look.
//
// Authored in m/s to match the data; converted to mph below.
// FAINT BY DESIGN. The particles are a veil over the basemap, not a subject.
//
// This cannot be done with alpha. ParticleMotion builds its colormap with a
// helper that HARDCODES alpha to 255 -- the sibling helper used by SmoothRaster
// honours a 4th channel, this one does not -- and the layer exposes no
// `opacity` option either. Passing [r,g,b,a] silently drops the a. So every
// particle is drawn FULLY OPAQUE, and "transparent" here means "close in
// brightness to what is behind it".
//
// That has a consequence worth knowing before you turn BRIGHTNESS down: over
// dark ocean, dim particles genuinely melt away, but over bright terrain
// (desert, snow) they invert and read as dark specks rather than fading. These
// mid-dim blue-greys sit near the basemap's average luminance so they stay
// faint over both. Going much darker looks good over water and dirty over land.
//
// Authored in m/s to match the data; converted to mph below.
// FADE BY SPEED. This ramp is the closest thing to opacity the layer has, so it
// carries two jobs at once: hue (neutral white) and apparent transparency.
//
// The floor (60) is deliberately exactly where the old flat ramp bottomed out --
// calm air is no darker than before, it just no longer drags the windy air down
// with it. Everything above it climbs steeply, so light wind nearly dissolves
// into the basemap while strong wind reads bright. That contrast is what makes
// the field legible at this level of fade: it is speed, not brightness alone,
// telling you where to look.
//
// Values are FINAL rgb (BRIGHTNESS below multiplies them, and now defaults to
// 1.0 so these read literally). Do not push the first stop lower -- see the
// opaque-particle note above; below ~55 it inverts against bright desert.
const RAMP_MPS = [
  [0,  [ 60,  62,  66]],
  [4,  [ 88,  91,  96]],
  [9,  [128, 132, 138]],
  [15, [178, 182, 188]],
  [22, [222, 226, 231]],
  [32, [255, 255, 255]]
];

// LIBRARY QUIRK, and it is a silent one.
//
// mapbox-exif-layer converts velocityRange out of the declared `unit` into mph
// internally (applyParticleRangesFromVelocityRange -> valueRange_u), but it
// derives the colour lookup straight off the raw `color` stop values with no
// conversion at all (speedRange = min/max of the stops). So particle SPEED is
// always computed in mph while the stops are taken at face value, whatever
// `unit` says. Pass stops in m/s and nothing errors -- the ramp just saturates
// at roughly 45% of the intended speed.
const MPS_TO_MPH = 2.23694;
// Global brightness multiplier, 0..1. Live-tunable: windTune({ brightness: 0.5 }).
// The single knob for "fainter" / "stronger" without re-picking every stop.
let BRIGHTNESS = 1.0;

const buildRamp = () => RAMP_MPS.map(([mps, rgb]) =>
  [mps * MPS_TO_MPH, rgb.map((c) => Math.round(c * BRIGHTNESS))]);

// Look and motion. Tuned by eye against the dark basemap. windTune() at the
// bottom of this file changes these live, without a reload.
//
//   maxAge          particle lifetime, and a HARD FLOOR hides here: particles
//                   are initialised with a random age of 0-99, so any maxAge
//                   below ~100 leaves most of them permanently past death and
//                   never drawing. Setting maxAge 40 made 2M particles look
//                   emptier than 1.2M at maxAge 140. Do not go below ~100.
//   fadeOpacity     how long the previous frame persists. Drives apparent
//                   density as much as particleCount does, and costs nothing.
//                   Reach for this before reaching for count.
//   trailSizeDecay  the comet parameter: each trail point draws smaller than
//                   the last, giving a bright head and a tapering tail. Near
//                   1.0 turns comets into uniform dotted lines.
//   velocityFactor  motion speed, and ALSO streak length and trail spacing,
//                   since trail points are previous positions. Raise it and
//                   comets stretch, then visibly bead apart at high zoom.
// Live overrides applied on top of the active playlist's own look. Empty by
// default -- edit a playlist's `look` above for a permanent change, and use
// windTune() for experiments.
const LOOK = {};

// The one setting that meaningfully costs frames: it draws
// particleCount x (1 + trailLength) points every frame. 3M measurably dropped
// this machine to 20 fps; 1.2M sat at its 30 fps cap. That cap also hides how
// much headroom was really left, so the desktop figure is NOT transferable --
// a phone GPU asked for 8M points/frame will not cope. Tune the desktop number
// by taste; tune the mobile one on an actual phone.
const DENSITY_SCALE = (() => {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4;
  return (coarse || weak) ? 0.2 : 1;
})();

/**
 * Pixel CENTRES from the playlist -> the pixel EDGE bounds the layer wants,
 * as [minX, maxY, maxX, minY]. Note the ordering: west, north, east, south.
 *
 * Latitude is clamped to +/-90. A global 0.25-degree grid has its centres ON
 * the poles, so true edges overshoot to +/-90.125, and Mercator Y is undefined
 * at |lat| >= 90. The clamp costs half a cell of vertical stretch -- below the
 * grid's own resolution, invisible in particle motion -- where the overshoot
 * risks NaN bounds and a layer that silently renders nothing.
 */
function edgeBounds({ lon0, lat0, dx, dy, nx, ny }) {
  const clamp = (v) => Math.max(-90, Math.min(90, v));
  return [
    lon0 - dx / 2,
    clamp(lat0 - dy / 2),            // dy is negative (north -> south)
    lon0 + (nx - 0.5) * dx,
    clamp(lat0 + (ny - 0.5) * dy)
  ];
}

const inZoomBand = (z) => z >= MIN_ZOOM && z < MAX_ZOOM;

const contains = ([w, n, e, s], { lng, lat }) =>
  lng >= w && lng <= e && lat <= n && lat >= s;

/** The frame whose valid time is nearest to now. */
function pickFrame(frames, now = Date.now()) {
  let best = null, bestGap = Infinity;
  for (const f of frames) {
    const gap = Math.abs(Date.parse(f.valid_utc) - now);
    if (gap < bestGap) { bestGap = gap; best = f; }
  }
  return best;
}

/**
 * FireMap manifest -> the playlist shape the rest of this file expects.
 *
 *   { updated, cycle, model, encoding: { width, height, bounds }, frames: [
 *       { valid, fh, url: '20261005T18Z' } ] }
 *
 * `url` is relative to the manifest and may omit '.png' (firemap.live's own
 * loader appends it). The 1440x721 grid has pixel CENTRES on -180 and on both
 * poles, so lon0/lat0 are the bounds' west/north and dx/dy fall out of the
 * size -- edgeBounds() then turns those back into edges.
 */
function fromFireMapManifest(man, manifestUrl) {
  const enc = man.encoding || {};
  const [w, s, e, n] = enc.bounds || [-180, -90, 180, 90];
  const nx = enc.width || 1440;
  const ny = enc.height || 721;
  const base = manifestUrl.replace(/[^/]*$/, '');
  return {
    model: man.model || 'gfs',
    cycle: man.cycle,
    updated: man.updated,
    issued_utc: man.updated || man.cycle,
    base,
    lon0: w,
    lat0: n,
    dx: (e - w) / nx,
    dy: -(n - s) / (ny - 1),
    nx,
    ny,
    u_range: FIREMAP_UV_RANGE,
    v_range: FIREMAP_UV_RANGE,
    units: 'mps',
    frames: (man.frames || []).map((f) => ({
      valid_utc: f.valid,
      fh: f.fh,
      file: /\.png$/i.test(f.url) ? f.url : f.url + '.png'
    }))
  };
}

/** Fetch every playlist once, dropping any that are missing or stale. */
async function loadPlaylists() {
  const out = [];
  for (const p of PLAYLISTS) {
    try {
      const res = await fetch(p.url, { cache: 'no-cache' });
      if (!res.ok) { console.warn('[wind] ' + p.name + ': ' + res.status); continue; }
      const raw = await res.json();
      const pl = p.format === 'firemap' ? fromFireMapManifest(raw, p.url) : raw;
      const ageH = (Date.now() - Date.parse(pl.issued_utc)) / 3.6e6;
      const maxAge = p.format === 'firemap' ? FIREMAP_MAX_AGE_HOURS : MAX_AGE_HOURS;
      const near = pickFrame(pl.frames || []);
      const gapH = near ? Math.abs(Date.parse(near.valid_utc) - Date.now()) / 3.6e6 : Infinity;
      if (!(ageH <= maxAge) || gapH > MAX_AGE_HOURS) {
        console.warn('[wind] ' + p.name + ' is ' + ageH.toFixed(1) + ' h old — skipping');
        continue;
      }
      out.push({ ...p, playlist: pl, bounds: edgeBounds(pl) });
    } catch (e) {
      console.warn('[wind] ' + p.name + ':', e.message);
    }
  }
  return out;
}

const state = { sources: [], active: null, map: null, ui: null };

function build(map, src) {
  if (!src) return null;
  const frame = pickFrame(src.playlist.frames);
  const layer = new ParticleMotion({
    id: 'wind-10m',
    source: src.playlist.base + frame.file,
    bounds: src.bounds,
    velocityRange: src.playlist.u_range,
    unit: src.playlist.units || 'mps',
    color: buildRamp(),
    readyForDisplay: inZoomBand(map.getZoom()),
    mapRuntime: 'maplibre',        // REQUIRED; without it the layer assumes Mapbox
    ...src.look,
    particleCount: Math.round(src.look.particleCount * DENSITY_SCALE),
    ...LOOK
  });

  // Beneath the fire layers: wind is context, and must never hide an incident.
  const beneath = ['fire-perimeter-fill', 'fire-hotspots', 'fire-points-active']
    .find((l) => map.getLayer(l));
  map.addLayer(layer, beneath);
  state.active = src;
  console.info('[wind] ' + src.name + ' — ' + frame.valid_utc + ' — ' + src.playlist.base + frame.file);
  window.__wind = { layer, source: src, frame };
  return layer;
}

/** Which playlist covers the current view centre. */
function pick(map) {
  const c = map.getCenter();
  return state.sources.find((s) => contains(s.bounds, c)) ?? state.sources.at(-1);
}

/** Rebuild only when the view has actually crossed into a different playlist. */
function reselect() {
  const map = state.map;
  if (!map || !state.sources.length) return;
  if (!map.getLayer('wind-10m')) return;      // hidden by the toggle; leave it alone
  const next = pick(map);
  if (next === state.active) return;
  map.removeLayer('wind-10m');
  build(map, next);
}


/** Normalize playlist frames for wind-ui ({ t, href, fh }). */
function toWindUiManifest(playlist) {
  const base = playlist?.base || '';
  const model = playlist?.model || 'gfs';
  const frames = [];
  for (const f of playlist?.frames || []) {
    const t = Date.parse(f.valid_utc || f.valid || f.iso || '');
    if (!Number.isFinite(t)) continue;
    const file = f.file || f.url || '';
    let href;
    if (/^https?:\/\//i.test(file)) href = file;
    else if (file.startsWith('/')) href = file;
    else href = base + file;
    const fh = Number.isFinite(Number(f.fh))
      ? Number(f.fh)
      : Number.isFinite(Number(f.forecast_hour))
        ? Number(f.forecast_hour)
        : frames.length;
    frames.push({ t, href, fh, valid_utc: f.valid_utc });
  }
  frames.sort((a, b) => a.t - b.t);
  return {
    model,
    cycle: playlist?.cycle || playlist?.issued_utc || '',
    updated: playlist?.updated || playlist?.issued_utc || '',
    frames
  };
}

/** Adapt ParticleMotion (setSource) to wind-ui's setFrameUrl / tune API. */
function adaptParticleLayer(layer) {
  return {
    setFrameUrl(url) {
      try {
        layer.setSource(url, 0.35);
      } catch (e) {
        console.warn('[wind] setFrameUrl', e.message);
      }
      return Promise.resolve();
    },
    tune({ opacity } = {}) {
      if (opacity == null) return;
      const off = opacity <= 0.01;
      layer._windUiOff = off;
      layer.fadeOpacity = off ? 0 : opacity;
      if (off) {
        layer.readyForDisplay = false;
      } else if (state.map) {
        layer.readyForDisplay = inZoomBand(state.map.getZoom());
      }
      try { layer.map?.triggerRepaint(); } catch { /* ignore */ }
    }
  };
}

export async function addWindLayer(map) {
  state.map = map;
  state.sources = await loadPlaylists();
  if (!state.sources.length) { console.warn('[wind] no usable playlist'); return null; }

  const layer = build(map, pick(map));

  // Direction arrows above MAX_ZOOM, where particle density has collapsed.
  // Same PNG, generated from the viewport, so the two halves cover the whole
  // zoom range between them without ever drawing at once.
  const src = state.active;
  addWindArrows(map, {
    playlist: src.playlist,
    frame: pickFrame(src.playlist.frames),
    minZoom: MAX_ZOOM
  }).catch((e) => console.warn('[wind] arrows:', e.message));

  // Bottom-right wind transport (minimized LIVE nub ↔ expand left).
  try {
    const box = document.getElementById('lyr-wind');
    const defaultOn = box ? box.checked : true;
    const manifest = toWindUiManifest(src.playlist);
    if (manifest.frames.length) {
      const fade = Number(src.look?.fadeOpacity);
      const ui = mountWindUI(map, adaptParticleLayer(layer), manifest, {
        defaultOn,
        opacity: Number.isFinite(fade) ? fade : 0.88,
        outlookHours: 120,
        onChange(on) {
          if (box) box.checked = on;
          // Keep MapLibre custom layer present; visibility via tune/readyForDisplay.
          if (on && !map.getLayer('wind-10m')) build(map, pick(map));
        }
      });
      state.ui = ui;
      window.__windUi = ui;
    }
  } catch (e) {
    console.warn('[wind] UI:', e.message);
  }

  let t;
  map.on('moveend', () => { clearTimeout(t); t = setTimeout(reselect, 250); });
  return layer;
}

/**
 * Custom layers have no layout properties, so setLayoutProperty('visibility')
 * -- what ui.js does for every other layer -- throws on this one. Add/remove is
 * the supported equivalent, which is why this is not in ui.js's LAYER_MAP.
 */
export function wireWindToggle(map) {
  const box = document.getElementById('lyr-wind');
  if (!box) return;
  box.addEventListener('change', () => {
    if (state.ui && typeof state.ui.setOn === 'function') {
      state.ui.setOn(box.checked);
      return;
    }
    const present = !!map.getLayer('wind-10m');
    if (box.checked && !present) build(map, pick(map));
    else if (!box.checked && present) map.removeLayer('wind-10m');
  });
  // Prefer UI state when mounted; else layer presence.
  if (state.ui) box.checked = !!state.ui.on;
  else box.checked = !!map.getLayer('wind-10m');
}

/** Keep the particles inside the zoom band where they read as flow. */
export function wireWindZoomGate(map) {
  const apply = () => {
    const l = map.getLayer('wind-10m');
    if (!l) return;
    const impl = l.implementation || l;
    if ('readyForDisplay' in impl) {
      impl.readyForDisplay = !impl._windUiOff && inZoomBand(map.getZoom());
    }
  };
  map.on('zoomend', apply);
  apply();
}

/**
 * Live tuning handle, for dialling the look in without an edit-reload cycle:
 *
 *     windTune({ brightness: 0.5 })      // fainter
 *     windTune({ fadeOpacity: 0.96, velocityFactor: 0.14 })
 *     windTune()                    // rebuild with whatever LOOK holds now
 *
 * Rebuilds the layer, so particles restart. Whatever you settle on, copy it
 * into LOOK above -- this does not survive a reload.
 */
export function windTune(overrides) {
  if (overrides && 'brightness' in overrides) {
    BRIGHTNESS = overrides.brightness;
    delete overrides.brightness;
  }
  if (overrides) Object.assign(LOOK, overrides);
  const map = state.map;
  if (!map) return null;
  if (map.getLayer('wind-10m')) map.removeLayer('wind-10m');
  return build(map, state.active ?? pick(map));
}
window.windTune = windTune;
