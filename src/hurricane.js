// ---------------------------------------------------------------------------
// Hurricane Tracks — Google DeepMind cyclone forecast
//
// 1:1 port of FireMap.live's hurricane layer (FireMapStaging / firemap-script.js
// NP_HURR_* block). Point features from FireDB WFS are stitched into tracks by
// track_id; an HTML Marker interpolates along the segment spanning "now".
// ---------------------------------------------------------------------------

const TYPENAME = 'FireDB:google_deepmindhurricanetracks';
const WFS = 'https://geo.firemap.live/geoserver/ows';
// Live FireDB currently publishes sample=-1 (not 0). Prefer null so the
// first WFS request is the one that returns features; set to 0 to match
// FireMap's historical prefer-control-member behaviour (empty → retry).
const SAMPLE_PREF = null;
const REFRESH_MIN = 15;
const MAX_FEATURES = 20000;
const LOOKBACK_H = 6;
const TICK_MS = 1000;
// Skip Marker.setLngLat when motion is below this (~1 m at equator).
const LNG_LAT_EPS = 1e-5;

const STYLE_ID = 'np-hurr-styles';
const LINE_SRC = 'hurricane-tracks-src';
const LINE_ID = 'hurricane-tracks';
const FIX_SRC = 'hurricane-fixes-src';
const FIX_ID = 'hurricane-fix-points';
const FIXLBL_ID = 'hurricane-fix-labels';
const NAME_SRC = 'hurricane-names-src';
const NAME_ID = 'hurricane-name-labels';
const LABEL_MINZOOM = 5;
const NAME_MINZOOM = 2;
const CHECKBOX_ID = 'lyr-hurricane';

export const HURRICANE_LAYER_IDS = [LINE_ID, FIX_ID, FIXLBL_ID, NAME_ID];

// Name-label paint: white fill + category-colored halo (FoN-like w1.5 / blur0.5) — FireMap 20261001e.
const NAME_LBL_PAINT = {
  'text-color': '#FFFFFF',
  'text-halo-color': ['get', 'color'],
  'text-halo-width': 1.5,
  'text-halo-blur': 0.5
};

// Streets vs sat track line — thicken in sat only (no black casing). Mirror FireMap 20261001e.
const LINE_PAINT_STREETS = {
  'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.5, 6, 2.5, 9, 4],
  'line-opacity': 0.9
};
const LINE_PAINT_SAT = {
  'line-width': ['interpolate', ['linear'], ['zoom'], 2, 2.25, 6, 3.75, 9, 5.75],
  'line-opacity': 0.95
};

const NAME_TEXT_FONT = ['Lexend Bold']; // App glyphs are Lexend-only (no Open Sans PBF)

const CATS = [
  { min: 137, key: 'c5', label: 'Category 5 Hurricane', color: '#D96BE8', size: 30 },
  { min: 113, key: 'c4', label: 'Category 4 Hurricane', color: '#FF5A5A', size: 27 },
  { min: 96,  key: 'c3', label: 'Category 3 Hurricane', color: '#FF8C42', size: 25 },
  { min: 83,  key: 'c2', label: 'Category 2 Hurricane', color: '#E0A800', size: 23 },
  { min: 64,  key: 'c1', label: 'Category 1 Hurricane', color: '#FFE066', size: 21 },
  { min: 34,  key: 'ts', label: 'Tropical Storm',       color: '#4DD0C7', size: 18 },
  { min: 0,   key: 'td', label: 'Tropical Depression',  color: '#6EC1FF', size: 16 }
];

/** FireMap.live track marker (exact string from script-test.js / firemap-script.js):
 *  el.innerHTML = '<span class="np-hurr-scale"><i class="fa-solid fa-hurricane"></i></span>';
 *  Glyph is Font Awesome Free 6.6.0 solid U+F751 via webfont (NOT CSS-mask SVG, NOT CY_*.png).
 *  CY_L/M/H.png are GDACS Tropical Cyclone alert pins + legend art only. */
const HURR_MARKER_INNER =
  '<span class="np-hurr-scale"><i class="fa-solid fa-hurricane"></i></span>';

function hurrCat(kt) {
  if (kt === null || typeof kt === 'undefined' || Number.isNaN(kt)) {
    return { key: 'unk', label: 'Unknown intensity', color: '#9AA4AD', size: 16 };
  }
  for (const c of CATS) {
    if (kt >= c.min) return c;
  }
  return CATS[CATS.length - 1];
}

function num(v) {
  if (v === null || typeof v === 'undefined' || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function utcMs(v) {
  if (v === null || typeof v === 'undefined') return null;
  let s = String(v).trim();
  if (!s) return null;
  if (/^\d{14}$/.test(s)) {
    return Date.UTC(
      +s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8),
      +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14)
    );
  }
  s = s.replace(' ', 'T');
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function esc(s) {
  return String(s === null || typeof s === 'undefined' ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function localFull(ms) {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const tracks = new Map();
const markers = new Map();
let mapRef = null;
let maplibreglRef = null;
let ticker = null;
let refresher = null;
let lastFetch = 0;
let fetching = false;
let zoomBound = false;
let lastScale = null;
let sizeRaf = null;
let visBound = false;

function hurrOn() {
  const cb = document.getElementById(CHECKBOX_ID);
  return cb ? cb.checked : true;
}

function hurrCql(withSample) {
  const parts = [];
  if (withSample && SAMPLE_PREF !== null) parts.push(`sample=${SAMPLE_PREF}`);
  if (LOOKBACK_H !== null) {
    const d = new Date(Date.now() - LOOKBACK_H * 3600000);
    parts.push(`valid_time AFTER ${d.toISOString().replace(/\.\d{3}Z$/, 'Z')}`);
  }
  return parts.join(' AND ');
}

function hurrFetch(noSampleRetry) {
  if (fetching) return;
  fetching = true;
  const cql = hurrCql(!noSampleRetry);
  const url = `${WFS}?service=WFS&version=1.0.0&request=GetFeature` +
    `&typeName=${encodeURIComponent(TYPENAME)}` +
    `&outputFormat=${encodeURIComponent('application/json')}` +
    `&maxFeatures=${MAX_FEATURES}` +
    (cql ? `&cql_filter=${encodeURIComponent(cql)}` : '');
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((d) => {
      fetching = false;
      const feats = (d && d.features) || [];
      if (!feats.length && !noSampleRetry && SAMPLE_PREF !== null) {
        hurrFetch(true);
        return;
      }
      lastFetch = Date.now();
      hurrIngest(feats);
      hurrRebuild();
    })
    .catch((e) => {
      fetching = false;
      console.error('[hurricane]', e.message);
    });
}

function hurrIngest(features) {
  const rows = [];
  for (const f of features) {
    const p = (f && f.properties) || {};
    const t = utcMs(p.valid_time);
    if (t === null) continue;
    let lon = null;
    let lat = null;
    if (f.geometry && f.geometry.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
      lon = num(f.geometry.coordinates[0]);
      lat = num(f.geometry.coordinates[1]);
    }
    if (lon === null) lon = num(p.lon);
    if (lat === null) lat = num(p.lat);
    if (lon === null || lat === null) continue;
    const stormName = (typeof p.name === 'string') ? p.name.trim() : '';
    rows.push({
      id: String(p.track_id || 'Unknown storm'),
      name: stormName || null,
      sample: num(p.sample),
      initMs: utcMs(p.init_time),
      t, lon, lat,
      kt: num(p.maximum_sustained_wind_speed_knots),
      hpa: num(p.minimum_sea_level_pressure_hpa),
      leadH: num(p.lead_time_hours),
      rmwKm: num(p.radius_of_maximum_winds_km),
      r34: [
        num(p.radius_34_knot_winds_ne_km), num(p.radius_34_knot_winds_se_km),
        num(p.radius_34_knot_winds_sw_km), num(p.radius_34_knot_winds_nw_km)
      ]
    });
  }

  // Newest init_time per track_id only.
  const newestInit = new Map();
  for (const r of rows) {
    const cur = newestInit.get(r.id);
    if (r.initMs !== null && (typeof cur === 'undefined' || r.initMs > cur)) {
      newestInit.set(r.id, r.initMs);
    }
  }

  // Prefer sample===0, else lowest sample, else null-sample.
  const chosenSample = new Map();
  for (const r of rows) {
    const ni = newestInit.get(r.id);
    if (r.initMs !== null && typeof ni !== 'undefined' && r.initMs !== ni) continue;
    if (r.sample === null) continue;
    const cur = chosenSample.get(r.id);
    if (SAMPLE_PREF !== null && cur === SAMPLE_PREF) continue;
    if (SAMPLE_PREF !== null && r.sample === SAMPLE_PREF) {
      chosenSample.set(r.id, r.sample);
      continue;
    }
    if (typeof cur === 'undefined' || r.sample < cur) chosenSample.set(r.id, r.sample);
  }

  tracks.clear();
  for (const r of rows) {
    const ni = newestInit.get(r.id);
    if (r.initMs !== null && typeof ni !== 'undefined' && r.initMs !== ni) continue;
    const cs = chosenSample.get(r.id);
    if (typeof cs !== 'undefined') {
      if (r.sample !== cs) continue;
    } else if (r.sample !== null) {
      continue;
    }
    let tr = tracks.get(r.id);
    if (!tr) {
      tr = { pts: [], initMs: r.initMs, sample: r.sample, peakKt: null, now: null, name: null };
      tracks.set(r.id, tr);
    }
    tr.pts.push(r);
    if (r.name && !tr.name) tr.name = r.name;
    if (r.kt !== null && (tr.peakKt === null || r.kt > tr.peakKt)) tr.peakKt = r.kt;
  }

  const now = Date.now();
  for (const id of Array.from(tracks.keys())) {
    const tr = tracks.get(id);
    tr.pts.sort((a, b) => a.t - b.t);
    // Unwrap lon ±180 so tracks crossing the antimeridian stay continuous.
    for (let i = 1; i < tr.pts.length; i++) {
      let cur = tr.pts[i].lon;
      const prev = tr.pts[i - 1].lon;
      while (cur - prev > 180) cur -= 360;
      while (cur - prev < -180) cur += 360;
      tr.pts[i].lon = cur;
    }
    // Drop track if last point is already in the past.
    if (!tr.pts.length || tr.pts[tr.pts.length - 1].t <= now) tracks.delete(id);
  }
  console.log('[hurricane] tracks loaded:', tracks.size);
}

function hurrLineData() {
  const fc = { type: 'FeatureCollection', features: [] };
  tracks.forEach((tr, id) => {
    if (tr.pts.length < 2) return;
    fc.features.push({
      type: 'Feature',
      properties: { track_id: id, color: hurrCat(tr.peakKt).color },
      geometry: {
        type: 'LineString',
        coordinates: tr.pts.map((p) => [p.lon, p.lat])
      }
    });
  });
  return fc;
}

function hurrFixLabel(ms) {
  return new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: 'numeric' });
}

function hurrPointData() {
  const now = Date.now();
  const fc = { type: 'FeatureCollection', features: [] };
  tracks.forEach((tr, id) => {
    const color = hurrCat(tr.peakKt).color;
    for (const p of tr.pts) {
      if (p.t <= now) continue; // future fixes only
      fc.features.push({
        type: 'Feature',
        properties: { track_id: id, color, label: hurrFixLabel(p.t) },
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] }
      });
    }
  });
  return fc;
}

/** GeoColor / sat-mode checkboxes (same IDs as goes.js eitherGeocolorOn). */
function hurrSatOn() {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.getElementById('lyr-goes-east-demo')?.checked ||
    document.getElementById('lyr-goes-west-demo')?.checked ||
    document.getElementById('lyr-goes-meteosat-demo')?.checked ||
    document.getElementById('lyr-goes-gk2a-demo')?.checked
  );
}

function hurrPaintSet(lid, props) {
  const map = mapRef;
  if (!map || !map.getLayer || !map.getLayer(lid) || !props) return;
  for (const k of Object.keys(props)) {
    try {
      map.setPaintProperty(lid, k, props[k]);
    } catch {
      /* ignore */
    }
  }
}

/** Sat-mode: thicker track line only. No casing. Name halo stays category color. */
function hurrApplySatPaint(satOn) {
  hurrPaintSet(LINE_ID, satOn ? LINE_PAINT_SAT : LINE_PAINT_STREETS);
}

/** Storm name labels at the live marker position. */

function hurrNameData() {
  const fc = { type: 'FeatureCollection', features: [] };
  tracks.forEach((tr, id) => {
    const name = tr.name;
    if (!name) return;
    let lon = null;
    let lat = null;
    let kt = tr.peakKt;
    if (tr.now) {
      lon = tr.now.lon;
      lat = tr.now.lat;
      kt = tr.now.kt;
    } else if (tr.pts.length) {
      lon = tr.pts[0].lon;
      lat = tr.pts[0].lat;
      kt = tr.pts[0].kt;
    }
    if (lon === null || lat === null) return;
    fc.features.push({
      type: 'Feature',
      properties: {
        track_id: id,
        name,
        color: hurrCat(kt).color
      },
      geometry: { type: 'Point', coordinates: [lon, lat] }
    });
  });
  return fc;
}

function hurrSyncNameLabels() {
  const map = mapRef;
  if (!map || !map.getSource) return;
  const src = map.getSource(NAME_SRC);
  if (src && typeof src.setData === 'function') src.setData(hurrNameData());
}

function hurrRebuild() {
  const map = mapRef;
  if (!map || !map.getStyle) return;
  injectStyles();

  if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
  if (map.getSource(LINE_SRC)) map.removeSource(LINE_SRC);
  map.addSource(LINE_SRC, { type: 'geojson', data: hurrLineData() });
  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: LINE_SRC,
    paint: {
      'line-color': ['get', 'color'],
      ...LINE_PAINT_STREETS,
      'line-dasharray': [1, 2]
    },
    layout: {
      'line-cap': 'round',
      visibility: hurrOn() ? 'visible' : 'none'
    }
  });

  if (map.getLayer(FIXLBL_ID)) map.removeLayer(FIXLBL_ID);
  if (map.getLayer(FIX_ID)) map.removeLayer(FIX_ID);
  if (map.getSource(FIX_SRC)) map.removeSource(FIX_SRC);
  map.addSource(FIX_SRC, { type: 'geojson', data: hurrPointData() });
  map.addLayer({
    id: FIX_ID,
    type: 'circle',
    source: FIX_SRC,
    minzoom: LABEL_MINZOOM,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], LABEL_MINZOOM, 2, 9, 3.5],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.85,
      'circle-stroke-color': '#1F1F1F',
      'circle-stroke-width': 1
    },
    layout: { visibility: hurrOn() ? 'visible' : 'none' }
  });
  // Lexend Bold is self-hosted here (theme.js). FireMap falls back through
  // Open Sans / Arial Unicode; we skip those since they have no glyph ranges.
  map.addLayer({
    id: FIXLBL_ID,
    type: 'symbol',
    source: FIX_SRC,
    minzoom: LABEL_MINZOOM,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Lexend Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], LABEL_MINZOOM, 9, 9, 12],
      'text-offset': [0, 0.8],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      visibility: hurrOn() ? 'visible' : 'none'
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': '#1F1F1F',
      'text-halo-width': 1.4,
      'text-halo-blur': 0.4
    }
  });

  if (map.getLayer(NAME_ID)) map.removeLayer(NAME_ID);
  if (map.getSource(NAME_SRC)) map.removeSource(NAME_SRC);
  map.addSource(NAME_SRC, { type: 'geojson', data: hurrNameData() });
  map.addLayer({
    id: NAME_ID,
    type: 'symbol',
    source: NAME_SRC,
    minzoom: NAME_MINZOOM,
    filter: [
      'all',
      ['has', 'name'],
      ['!=', ['coalesce', ['get', 'name'], ''], '']
    ],
    layout: {
      'text-field': ['upcase', ['coalesce', ['get', 'name'], '']],
      'text-font': NAME_TEXT_FONT,
      'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 7, 13, 10, 15],
      'text-offset': [0, 1.15],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-max-width': 8,
      'text-line-height': 1.1,
      visibility: hurrOn() ? 'visible' : 'none'
    },
    paint: NAME_LBL_PAINT
  });

  // Keep the stack above interim GOES rasters / wind (those may add later).
  for (const lid of HURRICANE_LAYER_IDS) {
    if (map.getLayer(lid)) map.moveLayer(lid);
  }

  if (!zoomBound && map.on) {
    zoomBound = true;
    map.on('zoom', hurrQueueSizes);
    map.on('zoomend', hurrApplySizes);
  }

  hurrSyncMarkers();
  hurrInstallVisibility();
  hurrMaybeStartTicker();
  hurrApplySatPaint(hurrSatOn());
}

function hurrSyncMarkers() {
  const map = mapRef;
  const maplibregl = maplibreglRef;
  if (!map || !maplibregl) return;

  for (const id of Array.from(markers.keys())) {
    if (!tracks.has(id)) {
      markers.get(id).marker.remove();
      markers.delete(id);
    }
  }

  tracks.forEach((tr, id) => {
    if (markers.has(id)) return;
    const el = document.createElement('div');
    el.className = 'np-hurr-marker';
    el.innerHTML = HURR_MARKER_INNER;  // exact FireMap marker HTML
    el.title = tr.name || id;
    el.style.display = hurrOn() ? 'block' : 'none';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      hurrShowInfo(id);
    });
    const p0 = tr.pts[0];
    // Hide markers when occluded by the globe (far side of Earth). Prior fix
    // used opacityWhenCovered: 1 so icons stayed visible through the planet.
    // Near-side markers keep full opacity (MapLibre only applies this when covered).
    const marker = new maplibregl.Marker({ element: el, opacityWhenCovered: 0 })
      .setLngLat([p0.lon, p0.lat])
      .addTo(map);
    el.firstElementChild.style.transform = `scale(${hurrScale().toFixed(3)})`;
    markers.set(id, {
      marker,
      el,
      scaleEl: el.firstElementChild,
      icon: el.querySelector('.fa-hurricane') || el.firstElementChild.firstElementChild,
      catKey: null,
      cw: null,
      lastLon: null,
      lastLat: null
    });
  });
}

function hurrScale() {
  const z = mapRef && mapRef.getZoom ? mapRef.getZoom() : 4;
  if (z <= 3) return 0.75;
  if (z >= 9) return 1.7;
  if (z <= 6) return 0.75 + ((z - 3) / 3) * 0.25;
  return 1.0 + ((z - 6) / 3) * 0.7;
}

function hurrApplySizes() {
  const s = hurrScale();
  if (lastScale !== null && Math.abs(s - lastScale) < 0.01) return;
  lastScale = s;
  const t = `scale(${s.toFixed(3)})`;
  markers.forEach((m) => {
    if (m.scaleEl) m.scaleEl.style.transform = t;
  });
}

function hurrQueueSizes() {
  if (sizeRaf) return;
  sizeRaf = requestAnimationFrame(() => {
    sizeRaf = null;
    hurrApplySizes();
  });
}

function hurrTick() {
  const now = Date.now();
  tracks.forEach((tr, id) => {
    const m = markers.get(id);
    if (!m) return;
    if (m.el.style.display === 'none') return;
    const pts = tr.pts;
    let a = null;
    let b = null;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].t <= now) a = pts[i];
      else {
        b = pts[i];
        break;
      }
    }
    let lon;
    let lat;
    let kt;
    if (!a) {
      a = pts[0];
      b = pts[0];
      lon = a.lon;
      lat = a.lat;
      kt = a.kt;
    } else if (!b) {
      b = a;
      lon = a.lon;
      lat = a.lat;
      kt = a.kt;
    } else {
      const frac = Math.max(0, Math.min(1, (now - a.t) / (b.t - a.t)));
      lon = a.lon + (b.lon - a.lon) * frac;
      lat = a.lat + (b.lat - a.lat) * frac;
      kt = (a.kt !== null && b.kt !== null)
        ? a.kt + (b.kt - a.kt) * frac
        : (a.kt !== null ? a.kt : b.kt);
    }
    // Avoid poking MapLibre when the interpolated point has not moved enough
    // to matter (stationary endpoints / sub-pixel motion). CSS spin keeps going.
    if (
      m.lastLon === null ||
      Math.abs(lon - m.lastLon) > LNG_LAT_EPS ||
      Math.abs(lat - m.lastLat) > LNG_LAT_EPS
    ) {
      m.marker.setLngLat([lon, lat]);
      m.lastLon = lon;
      m.lastLat = lat;
    }
    tr.now = { lon, lat, kt, a, b };

    const cat = hurrCat(kt);
    if (m.catKey !== cat.key) {
      m.catKey = cat.key;
      if (m.icon) {
        m.icon.style.color = cat.color;
        m.icon.style.fontSize = `${cat.size}px`;
      }
    }
    // CCW north of equator, CW south (FireMap convention).
    const wantCw = lat < 0;
    if (m.cw !== wantCw) {
      m.cw = wantCw;
      m.el.classList.toggle('np-hurr-cw', wantCw);
    }
  });
  hurrSyncNameLabels();
}

function hurrSetPaused(paused) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('np-hurr-paused', !!paused);
}

function hurrStopTicker() {
  if (!ticker) return;
  clearInterval(ticker);
  ticker = null;
}

function hurrShouldTick() {
  return (
    hurrOn() &&
    tracks.size > 0 &&
    !(typeof document !== 'undefined' && document.hidden)
  );
}

function hurrStartTicker() {
  if (ticker) return;
  if (!hurrShouldTick()) return;
  ticker = setInterval(hurrTick, TICK_MS);
  hurrTick();
}

function hurrMaybeStartTicker() {
  if (hurrShouldTick()) hurrStartTicker();
  else hurrStopTicker();
}

function hurrInstallVisibility() {
  if (visBound || typeof document === 'undefined') return;
  visBound = true;
  // Background tabs: no position timer, and pause CSS keyframes so the GPU
  // is not compositing invisible spinning markers (helps phone heat).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hurrStopTicker();
      hurrSetPaused(true);
    } else {
      hurrSetPaused(false);
      hurrMaybeStartTicker();
    }
  });
}

function hurrShowInfo(id) {
  const tr = tracks.get(id);
  const box = document.getElementById('infoBox');
  if (!tr || !box) return;
  const s = tr.now || {};
  const a = s.a;
  const b = s.b;
  const cat = hurrCat(s.kt);
  const primary =
    `<strong>Status:</strong> <span style="color:${cat.color}; font-weight: bold;">${esc(cat.label)}</span><br>` +
    (s.kt !== null && typeof s.kt !== 'undefined'
      ? `<strong>Max sustained wind:</strong> ${Math.round(s.kt)} kt (${Math.round(s.kt * 1.852)} km/h)<br>`
      : '') +
    (a && a.hpa !== null ? `<strong>Min pressure:</strong> ${Math.round(a.hpa)} hPa<br>` : '') +
    (a ? `<strong>Last fix:</strong> ${esc(localFull(a.t))}<br>` : '') +
    (b && b !== a ? `<strong>Next fix:</strong> ${esc(localFull(b.t))}<br>` : '');
  const rest =
    (tr.initMs !== null ? `<strong>Model run:</strong> ${esc(localFull(tr.initMs))}<br>` : '') +
    (tr.sample !== null ? `<strong>Ensemble member:</strong> ${tr.sample}<br>` : '') +
    (a && a.leadH !== null ? `<strong>Lead time:</strong> ${Math.round(a.leadH)} h<br>` : '') +
    (a && a.rmwKm !== null ? `<strong>Radius of max winds:</strong> ${Math.round(a.rmwKm)} km<br>` : '') +
    (a && a.r34 && a.r34.some((v) => v !== null)
      ? `<strong>34 kt wind radii (NE/SE/SW/NW):</strong> ${
          a.r34.map((v) => (v === null ? '—' : Math.round(v))).join(' / ')
        } km<br>`
      : '') +
    '<strong>Source:</strong> Google DeepMind cyclone forecast<br>';
  const title = tr.name || id;
  let restOut = rest;
  if (tr.name && id && tr.name !== id) {
    restOut = `<strong>Track ID:</strong> ${esc(id)}<br>` + rest;
  }
  box.innerHTML = `<h3>${esc(title)}</h3><div class="info-primary">${primary}</div><div class="info-rest">${restOut}</div>`;
  box.style.display = 'block';
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement('style');
  st.id = STYLE_ID;
  // Exact FireMap.live _hurrInjectStyles() string (no drop-shadow; webfont ink + text-shadow).
  st.textContent =
    '.np-hurr-marker{cursor:pointer;line-height:1;}' +
    '.np-hurr-scale{display:block;will-change:transform;}' +
    '.np-hurr-marker i{display:block;font-size:18px;color:#4DD0C7;' +
      'text-shadow:0 0 8px currentColor;will-change:transform;' +
      'animation:np-hurr-spin-ccw 2.6s linear infinite;}' +
    '.np-hurr-marker.np-hurr-cw i{animation-name:np-hurr-spin-cw;}' +
    // Pause swirl while tab/screen is hidden (class on <html> from visibilitychange).
    'html.np-hurr-paused .np-hurr-marker i{animation-play-state:paused;}' +
    // Belt-and-suspenders: fully hide MapLibre-covered (far-side) markers on globe.
    '.maplibregl-marker-covered{opacity:0!important;pointer-events:none;}' +
    '@keyframes np-hurr-spin-ccw{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}' +
    '@keyframes np-hurr-spin-cw{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
  document.head.appendChild(st);
}

/**
 * Start the hurricane layer: inject CSS, fetch WFS, refresh on an interval.
 * Pass the maplibre-gl module so Markers can be constructed (maplibregl.Marker).
 */
function ensureFaHurricaneCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('fa-hurricane-only')) return;
  const link = document.createElement('link');
  link.id = 'fa-hurricane-only';
  link.rel = 'stylesheet';
  link.href = `${import.meta.env.BASE_URL}vendor/fontawesome/css/fa-hurricane-only.css`;
  document.head.appendChild(link);
}

export function addHurricaneLayers(map, maplibregl) {
  mapRef = map;
  maplibreglRef = maplibregl || (typeof window !== 'undefined' ? window.maplibregl : null);
  ensureFaHurricaneCss();
  injectStyles();
  hurrInstallVisibility();
  const freshMs = Math.max(REFRESH_MIN, 5) * 60000;
  if (tracks.size && Date.now() - lastFetch < freshMs) {
    hurrRebuild();
  } else {
    hurrFetch(false);
  }
  if (REFRESH_MIN > 0 && !refresher) {
    refresher = setInterval(() => { hurrFetch(false); }, REFRESH_MIN * 60000);
  }
}

/** Toggle style layers + HTML markers. */
export function toggleHurricanes(on) {
  const map = mapRef;
  if (map) {
    for (const lid of HURRICANE_LAYER_IDS) {
      if (map.getLayer(lid)) {
        map.setLayoutProperty(lid, 'visibility', on ? 'visible' : 'none');
      }
    }
  }
  markers.forEach((m) => {
    m.el.style.display = on ? 'block' : 'none';
  });
  if (on) hurrMaybeStartTicker();
  else hurrStopTicker();
}

/** Wire the layer-list checkbox (markers are not style layers). */
export function wireHurricaneToggle(map) {
  const box = document.getElementById(CHECKBOX_ID);
  if (!box) return;
  const apply = () => toggleHurricanes(box.checked);
  box.addEventListener('change', apply);
  // Honour initial HTML state once layers/markers exist (or become empty).
  apply();
}

export function refreshHurricanes() {
  hurrFetch(false);
}

/** Sat-mode track thicken (no casing). Hooked from goes / basemap-mode. */
export function applyHurricaneSatPaint(satOn) {
  hurrApplySatPaint(!!satOn);
}
