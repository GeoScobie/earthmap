import { geocolor, geocoderUrl as themeGeocoderUrl } from './theme.js';
import { wireBasemapToggle } from './basemap-mode.js';
import { syncSatRoadsVisibility } from './roads-sat.js';
import { installInfoBoxBuildStamp } from './build-stamp.js';
import {
  searchAgencyFiresByName,
  openAgencyFireFromSearch
} from './agency-fires.js';
// ---------------------------------------------------------------------------
// UI chrome — ported from firemap.live
//
// The panels, toolbar and live clock behave as they do on firemap.live. What
// differs is what they're wired TO: the layer list drives the layers this map
// actually has, rather than showing toggles that do nothing. Layers whose data
// exists on GeoServer but whose UI hasn't been ported (GDACS) are shown
// disabled and labelled as such. Hurricane + Satellite Tracks are ported
// (hurricane.js, satellite.js, agency-fires.js).
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

// Layer-list checkbox -> the style layer ids it controls.
const LAYER_MAP = {
  'lyr-perimeters': ['fire-perimeter-fill', 'fire-perimeter-outline'],
  'lyr-hotspots': ['fire-hotspots'],
  'lyr-firms': ['fire-points-active'],
  // US/CA/AU/EU fire-point stacks: toggled in agency-fires.js (pulse + labels too).
  // Listed here so future generic sync stays aware of the checkbox ids.
  // 'lyr-usa-fires' / 'lyr-canada-fires' / 'lyr-aus-fires' / 'lyr-europe-fires'
  'lyr-historical': ['fire-historical-fill'],
  'lyr-smoke': ['fire-smoke'],
  // Owned GeoColor — East default-on via HTML/embed; West off until toggled.
  'lyr-goes-east-demo': ['goes-east-demo'],
  'lyr-goes-west-demo': ['goes-west-demo'],
  'lyr-goes-meteosat-demo': ['goes-meteosat-demo'],
  'lyr-goes-himawari-demo': ['goes-himawari-demo'],
  'lyr-goes-gk2a-demo': ['goes-gk2a-demo'],
  // Path B product — row hidden until CDN ready.
  'lyr-geocolor': ['geocolor-mosaic'],
  // Place labels: always on via forcePlaceLabelsOn (no menu row).
  'lyr-roads': ['roads-simple'],
  // Google DeepMind cyclone forecast — FireMap.live 1:1 (hurricane.js).
  // Markers are toggled separately via wireHurricaneToggle.
  'lyr-hurricane': ['hurricane-tracks', 'hurricane-fix-points', 'hurricane-fix-labels']
};

const PLACE_LABEL_LAYER_IDS = [
  'roads-label-minor', 'roads-label-major',
  'poi-label', 'natural-point-label', 'water-label', 'waterway-label',
  'place-subdivision', 'place-locality', 'place-region', 'place-country'
];

export function initUI(map) {
  liveClock();
  installInfoBoxBuildStamp();
  panels(map);
  gateProductGeocolorRow();
  forcePlaceLabelsOn(map);
  layerList(map);
  measure(map);
  share(map);
  locate(map);
  search(map);
  readout(map);
}

// --- Live clock -------------------------------------------------------------
function liveClock() {
  const local = $('clockLocalTime');
  const zone = $('clockLocalZone');
  const utc = $('clockUtcTime');
  if (!local) return;

  const hhmm = (d, useUTC) => {
    const h = useUTC ? d.getUTCHours() : d.getHours();
    const m = useUTC ? d.getUTCMinutes() : d.getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Short zone abbreviation, e.g. PDT. Falls back to a UTC offset.
  let label = 'LOCAL';
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
      .formatToParts(new Date());
    label = parts.find((p) => p.type === 'timeZoneName')?.value || 'LOCAL';
  } catch { /* keep the default */ }

  const tick = () => {
    const now = new Date();
    local.textContent = hhmm(now, false);
    utc.textContent = hhmm(now, true);
    if (zone) zone.textContent = label;
  };
  tick();
  setInterval(tick, 1000);
}

// --- Panels and toolbar -----------------------------------------------------

/** Measure #searchWrap and park left sat chrome below it (FireMap SoT). */
function notifySatChromeLayout() {
  const FALLBACK = 58;
  const GAP = 8;
  let topPx = FALLBACK;
  try {
    const wrap = $('searchWrap');
    if (wrap) {
      const r = wrap.getBoundingClientRect();
      if (r && Number.isFinite(r.bottom) && r.bottom > 0) {
        topPx = Math.max(FALLBACK, Math.ceil(r.bottom + GAP));
      }
    }
  } catch { /* ignore */ }
  try {
    document.documentElement.style.setProperty('--ddb-sat-chrome-top', `${topPx}px`);
  } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent('ddb:search-layout'));
  } catch { /* ignore */ }
}

function closeSearch() {
  const panel = $('searchPanel');
  const btn = $('searchBtn');
  const wrap = $('searchWrap');
  const input = $('searchInput');
  const results = $('searchResults');
  if (panel) {
    panel.classList.remove('active');
    panel.hidden = true;
  }
  wrap?.classList.remove('search-open');
  if (btn) {
    btn.classList.remove('active');
    btn.setAttribute('aria-expanded', 'false');
  }
  if (input) input.value = '';
  if (results) results.innerHTML = '';
  // Closed chip is shorter — pull any left sat chrome back up under banner.
  notifySatChromeLayout();
}

function openSearch(closeLeft) {
  const panel = $('searchPanel');
  const btn = $('searchBtn');
  const wrap = $('searchWrap');
  if (!panel) return;
  // Close competing left chrome that overlaps the banner card.
  closeLeft?.(panel);
  $('layerListPanel')?.classList.remove('active');
  $('aboutPanel')?.classList.remove('active');
  panel.hidden = false;
  panel.classList.add('active');
  wrap?.classList.add('search-open');
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-expanded', 'true');
  }
  const input = $('searchInput');
  if (input) {
    setTimeout(() => { try { input.focus(); input.select(); } catch { /* ignore */ } }, 0);
  }
  // Open card is taller — push left sat chrome below banner+search.
  notifySatChromeLayout();
}

function toggleSearch(closeLeft) {
  const panel = $('searchPanel');
  if (panel && panel.classList.contains('active')) closeSearch();
  else openSearch(closeLeft);
}

function panels(map) {
  const layerPanel = $('layerListPanel');
  const legendPanel = $('legendPanel');
  const searchPanel = $('searchPanel');
  const aboutPanel = $('aboutPanel');

  const toggle = (el, btn) => {
    if (!el) return;
    const open = el.classList.toggle('active');
    if (btn) btn.setAttribute('aria-expanded', String(open));
  };

  // Only one left-hand panel at a time — they occupy the same space.
  const closeLeft = (except) => {
    for (const el of [layerPanel, searchPanel]) {
      if (el && el !== except) {
        if (el === searchPanel) closeSearch();
        else el.classList.remove('active');
      }
    }
  };

  $('toggleLayersBtn')?.addEventListener('click', () => {
    closeLeft(layerPanel);
    toggle(layerPanel);
  });
  $('closeLayerList')?.addEventListener('click', () => layerPanel?.classList.remove('active'));

  $('legendBtn')?.addEventListener('click', (e) => toggle(legendPanel, e.currentTarget));
  $('closeLegendPanel')?.addEventListener('click', () => legendPanel?.classList.remove('active'));

  $('searchBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSearch(closeLeft);
  });
  $('closeSearchPanel')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSearch();
  });

  // Click outside closes search (banner chip + panel are both in #searchWrap).
  document.addEventListener('click', (e) => {
    if (!searchPanel?.classList.contains('active')) return;
    const wrap = $('searchWrap');
    if (wrap && wrap.contains(e.target)) return;
    closeSearch();
  });

  $('aboutBtn')?.addEventListener('click', () => {
    closeSearch();
    aboutPanel?.classList.add('active');
  });
  $('closeAboutPanel')?.addEventListener('click', () => aboutPanel?.classList.remove('active'));

  // Cold-start basemap (satellite default). Topo ↔ sat toolbar toggle removed.
  wireBasemapToggle(map);

  // Reset view (closing search keeps banner chrome tidy — FireMap SoT).
  $('logoBtn')?.addEventListener('click', () => {
    closeSearch();
    map.easeTo({ center: [-100, 25], zoom: 2.2, pitch: 0, bearing: 0, duration: 1200 });
  });

  // Smoke PM2.5 ramp popup.
  const trigger = $('smokeLegendTrigger');
  const ramp = $('smokeColorRampPopup');
  if (trigger && ramp) {
    const show = (on) => { ramp.style.display = on ? 'block' : 'none'; };
    trigger.addEventListener('mouseenter', () => show(true));
    trigger.addEventListener('mouseleave', () => show(false));
    trigger.addEventListener('click', () => show(ramp.style.display !== 'block'));
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (searchPanel?.classList.contains('active')) closeSearch();
    for (const el of [layerPanel, legendPanel, aboutPanel]) {
      el?.classList.remove('active');
    }
    $('shareMapModal')?.classList.remove('active');
  });

  // Initial park for any future left sat chrome under the closed chip.
  notifySatChromeLayout();
  try {
    window.addEventListener('resize', notifySatChromeLayout);
  } catch { /* ignore */ }
}

// --- Layer list -------------------------------------------------------------

// Hide Path B product GeoColor until CDN is configured — empty control looked broken.
function gateProductGeocolorRow() {
  const box = document.getElementById('lyr-geocolor');
  const row = box?.closest('.layer-item');
  if (!row) return;
  const ready = Boolean(geocolor?.enabled && String(geocolor.baseUrl || '').trim());
  row.hidden = !ready;
  row.style.display = ready ? '' : 'none';
}

/** Place labels stay forced on (no layer-list row). CORS may still blank them. */
function forcePlaceLabelsOn(map) {
  for (const id of PLACE_LABEL_LAYER_IDS) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'visible');
    }
  }
}

function layerList(map) {
  const setVisible = (ids, on) => {
    for (const id of ids) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      }
    }
  };

  for (const [checkboxId, layerIds] of Object.entries(LAYER_MAP)) {
    const box = $(checkboxId);
    if (!box) continue;
    // Roads over sat: only show in near-time; topo keeps cased roads_*.
    if (checkboxId === 'lyr-roads') {
      syncSatRoadsVisibility(map);
      box.addEventListener('change', () => {
        syncSatRoadsVisibility(map);
      });
      continue;
    }
    // Sync the map to the checkbox's initial state rather than assuming they
    // already agree — the HTML is the source of truth for defaults.
    setVisible(layerIds, box.checked);
    box.addEventListener('change', () => setVisible(layerIds, box.checked));
  }

  const slider = $('smokeOpacitySlider');
  const display = $('smokeOpacityValue');
  slider?.addEventListener('input', () => {
    const pct = Number(slider.value);
    if (display) display.textContent = `${pct}%`;
    if (map.getLayer('fire-smoke')) {
      map.setPaintProperty('fire-smoke', 'raster-opacity', pct / 100);
    }
  });
}

// --- Measure ----------------------------------------------------------------
function measure(map) {
  const btn = $('measureBtn');
  const panel = $('measurePanel');
  if (!btn || !panel) return;

  let on = false;
  let pts = [];

  const SRC = 'measure-src';
  const ensureSource = () => {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'measure-line', type: 'line', source: SRC,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': '#FF6347', 'line-width': 2, 'line-dasharray': [2, 1] }
    });
    map.addLayer({
      id: 'measure-pts', type: 'circle', source: SRC,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 4, 'circle-color': '#FF6347',
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff'
      }
    });
  };

  // Haversine — good to a few metres at these distances.
  const dist = (a, b) => {
    const R = 6371;
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };

  const render = () => {
    ensureSource();
    const features = pts.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p } }));
    if (pts.length > 1) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts } });
    }
    map.getSource(SRC).setData({ type: 'FeatureCollection', features });

    let km = 0;
    for (let i = 1; i < pts.length; i++) km += dist(pts[i - 1], pts[i]);
    $('measureKm').textContent = `${km.toFixed(2)} km`;
    $('measureMi').textContent = `${(km * 0.621371).toFixed(2)} mi`;
    $('measureHint').textContent = pts.length
      ? 'Click to add points'
      : 'Click the map to start measuring';
  };

  const onClick = (e) => {
    pts.push([e.lngLat.lng, e.lngLat.lat]);
    render();
  };

  const stop = () => {
    on = false;
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
    panel.classList.remove('active');
    map.off('click', onClick);
    map.getCanvas().style.cursor = '';
  };

  btn.addEventListener('click', () => {
    on = !on;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
    panel.classList.toggle('active', on);
    if (on) {
      pts = [];
      render();
      map.on('click', onClick);
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      stop();
    }
  });

  $('measureClearBtn')?.addEventListener('click', () => { pts = []; render(); });
  $('measureDoneBtn')?.addEventListener('click', stop);
}

// --- Share ------------------------------------------------------------------
function share(map) {
  const modal = $('shareMapModal');
  const field = $('shareMapURL');
  if (!modal || !field) return;

  $('shareMapBtn')?.addEventListener('click', () => {
    const c = map.getCenter();
    const hash = `#${map.getZoom().toFixed(2)}/${c.lat.toFixed(4)}/${c.lng.toFixed(4)}`;
    field.value = location.origin + location.pathname + hash;
    modal.classList.add('active');
    field.select();
  });

  modal.querySelector('.close-btn')?.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

  $('copyURLBtn')?.addEventListener('click', async () => {
    const btn = $('copyURLBtn');
    try {
      await navigator.clipboard.writeText(field.value);
      btn.textContent = 'Copied';
    } catch {
      field.select();
      btn.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => { btn.textContent = 'Copy URL'; }, 1800);
  });
}

// --- Locate me (bottom-right above zoom — FireMap SoT; not near search) ------
/** MapLibre IControl: locate crosshairs above NavigationControl. */
export function LocateMeControl() {}
LocateMeControl.prototype.onAdd = function onAdd() {
  this._container = document.createElement('div');
  this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group ddb-locate-ctrl';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'locateMeBtn';
  btn.className = 'ddb-locate-btn';
  btn.setAttribute('aria-label', 'Locate Me');
  btn.title = 'Locate Me';
  btn.innerHTML =
    '<svg class="ddb-locate-icon" aria-hidden="true" viewBox="0 0 512 512">' +
    '<path fill="currentColor" d="M256 0c17.7 0 32 14.3 32 32V66.7C378.1 80.8 431.2 133.9 445.3 224H480c17.7 0 32 14.3 32 32s-14.3 32-32 32H445.3C431.2 378.1 378.1 431.2 288 445.3V480c0 17.7-14.3 32-32 32s-32-14.3-32-32V445.3C133.9 431.2 80.8 378.1 66.7 288H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H66.7C80.8 133.9 133.9 80.8 224 66.7V32c0-17.7 14.3-32 32-32zM128 256a128 128 0 1 0 256 0 128 128 0 1 0-256 0zm128-80a80 80 0 1 1 0 160 80 80 0 1 1 0-160z"/></svg>';
  this._container.appendChild(btn);
  return this._container;
};
LocateMeControl.prototype.onRemove = function onRemove() {
  if (this._container && this._container.parentNode) {
    this._container.parentNode.removeChild(this._container);
  }
  this._container = undefined;
};

function locate(map) {
  const btn = $('locateMeBtn');
  if (!btn || !navigator.geolocation) return;

  let marker = null;
  btn.addEventListener('click', () => {
    btn.classList.add('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        btn.classList.remove('locating');
        const { longitude, latitude } = pos.coords;
        const el = document.createElement('div');
        el.className = 'user-location-marker';
        marker?.remove();
        marker = new window.maplibregl.Marker({ element: el })
          .setLngLat([longitude, latitude])
          .addTo(map);
        map.easeTo({ center: [longitude, latitude], zoom: 10, duration: 1400 });
      },
      (err) => {
        btn.classList.remove('locating');
        console.warn('[locate]', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// --- Search -----------------------------------------------------------------
// Shared OSM Photon geocoder (Girder). FeatureCollection → list; pick flyTo /
// fitBounds from geometry + optional Photon extent.
// Base: VITE_GEOCODER_URL | GEOCODER_URL | theme.geocoderUrl (HTTPS default).
const GEOCODER_BASE = String(
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_GEOCODER_URL || import.meta.env.GEOCODER_URL)) ||
    themeGeocoderUrl ||
    'https://geocode.disasterdb.com'
).replace(/\/$/, '');

/** Resolve the language used for Photon results in the map or its SEO iframe. */
function resolveGeocoderLanguage() {
  const search =
    typeof window !== 'undefined' && window.location ? window.location.search : '';
  const queryLang = new URLSearchParams(search).get('lang');
  // BCP-47-ish tags such as pt-BR and zh-Hans. Referrer path stays 2-letter.
  const lang = queryLang ? queryLang.trim() : '';
  if (/^[A-Za-z0-9-]{2,10}$/.test(lang)) {
    return lang;
  }

  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  const match = /^https:\/\/earthmap\.live\/([a-z]{2})\/countries\//.exec(referrer);
  return match ? match[1] : 'en';
}

const GEOCODER_LANGUAGE = resolveGeocoderLanguage();

const GEOCODER_ZOOM_BY_TYPE = {
  continent: 2.5,
  country: 5,
  state: 6.5,
  region: 6.5,
  province: 6.5,
  county: 9,
  city: 11,
  town: 12,
  village: 13,
  hamlet: 13,
  district: 13,
  locality: 14,
  street: 15,
  house: 16
};

const GEOCODER_REGION_TYPES = new Set([
  'continent', 'country', 'state', 'region', 'county', 'province', 'territory'
]);

/** Approximate bounds for continent pins Photon returns without a usable extent. */
const CONTINENT_BOUNDS = [
  { keys: ['africa', 'afrika'], bounds: [[-20, -37], [55, 38]] },
  { keys: ['asia'], bounds: [[26, -11], [150, 55]] },
  { keys: ['europe'], bounds: [[-25, 34], [45, 72]] },
  { keys: ['north america', 'northamerica'], bounds: [[-170, 7], [-50, 72]] },
  { keys: ['south america', 'southamerica'], bounds: [[-82, -56], [-34, 13]] },
  { keys: ['oceania', 'australia'], bounds: [[110, -50], [180, 5]] },
  { keys: ['antarctica'], bounds: [[-180, -90], [180, -60]] }
];

function geocoderLabel(props) {
  if (!props) return 'Unknown';
  const parts = [];
  if (props.name) parts.push(props.name);
  if (props.city && props.city !== props.name) parts.push(props.city);
  if (props.county && props.county !== props.name && props.county !== props.city) {
    parts.push(props.county);
  }
  if (props.state) parts.push(props.state);
  if (props.country) parts.push(props.country);
  return parts.join(', ') || props.name || 'Unknown';
}

/** Prefer osm_value when Photon type is "other" (e.g. continent). */
function geocoderPlaceKind(props) {
  if (!props) return '';
  const t = String(props.type || '').toLowerCase();
  const osm = String(props.osm_value || props.osm_key || '').toLowerCase();
  if (t && t !== 'other') return t;
  return osm || t;
}

function geocodeTypeKeys(props) {
  if (!props) return [];
  return [props.osm_value, props.type, props.osm_key]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
}

/** Photon extent [minLon, maxLat, maxLon, minLat] → MapLibre bounds or null. */
function meaningfulGeocodeBounds(extent) {
  if (!Array.isArray(extent) || extent.length !== 4) return null;
  const minLon = Number(extent[0]);
  const maxLat = Number(extent[1]);
  const maxLon = Number(extent[2]);
  const minLat = Number(extent[3]);
  if (![minLon, maxLat, maxLon, minLat].every(Number.isFinite)) return null;
  if (!(minLon < maxLon) || !(minLat < maxLat)) return null;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  if (lonSpan >= 120) return null;
  if (lonSpan <= 0.05 && latSpan <= 0.05) return null;
  return [[minLon, minLat], [maxLon, maxLat]];
}

function continentBoundsForName(name) {
  if (!name) return null;
  const n = String(name).toLowerCase().replace(/;/g, ' ');
  for (const entry of CONTINENT_BOUNDS) {
    for (const k of entry.keys) {
      if (n.includes(k)) return entry.bounds;
    }
  }
  return null;
}

function regionScaleZoom(props) {
  const keys = geocodeTypeKeys(props);
  for (const k of keys) {
    if (GEOCODER_ZOOM_BY_TYPE[k] != null && GEOCODER_REGION_TYPES.has(k)) {
      return GEOCODER_ZOOM_BY_TYPE[k];
    }
  }
  return null;
}

function flyToGeocode(map, feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return;
  const props = feature.properties || {};
  const fitOpts = { padding: 48, maxZoom: 14, duration: 1200, essential: true };

  const bounds = meaningfulGeocodeBounds(props.extent);
  if (bounds) {
    map.fitBounds(bounds, fitOpts);
    closeSearch();
    return;
  }

  const typeKeys = geocodeTypeKeys(props);
  if (typeKeys.includes('continent')) {
    const cBounds = continentBoundsForName(props.name);
    if (cBounds) {
      map.fitBounds(cBounds, fitOpts);
      closeSearch();
      return;
    }
  }

  const regionZoom = regionScaleZoom(props);
  if (regionZoom != null) {
    map.flyTo({ center: coords, zoom: regionZoom, duration: 1200, essential: true });
    closeSearch();
    return;
  }

  const kind = geocoderPlaceKind(props);
  const zoom = GEOCODER_ZOOM_BY_TYPE[kind] ?? 12;
  map.flyTo({ center: coords, zoom, duration: 1200, essential: true });
  closeSearch();
}

function search(map) {
  const input = $('searchInput');
  const results = $('searchResults');
  if (!input || !results) return;

  let timer = 0;
  let seq = 0;

  const appendMsg = (msg) => {
    const li = document.createElement('li');
    li.className = 'search-msg';
    li.textContent = msg;
    results.append(li);
  };

  const appendGroup = (label) => {
    const li = document.createElement('li');
    li.className = 'search-group-label';
    li.textContent = label;
    li.setAttribute('role', 'presentation');
    results.append(li);
  };

  const renderUnified = (fires, places, opts = {}) => {
    results.innerHTML = '';
    if (opts.loading) {
      appendMsg('Searching…');
      return;
    }
    if (opts.error) {
      appendMsg(opts.error);
      return;
    }
    const fireList = Array.isArray(fires) ? fires : [];
    const placeList = Array.isArray(places) ? places : [];
    if (!fireList.length && !placeList.length) {
      appendMsg(opts.emptyMsg || 'No results.');
      return;
    }
    if (fireList.length) {
      appendGroup('Fires');
      for (const hit of fireList) {
        const fire = hit.feature;
        const p = fire.properties || {};
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.tabIndex = 0;
        const kind = document.createElement('span');
        kind.className = 'search-item-kind search-item-kind--fire';
        kind.textContent = 'Fire';
        const title = document.createElement('span');
        title.className = 'search-item-title';
        title.textContent = p.fire_name || 'Unknown fire';
        const meta = document.createElement('span');
        meta.className = 'search-item-meta';
        const bits = [];
        if (p.fire_status) bits.push(p.fire_status);
        if (p.state_name) bits.push(p.state_name);
        else if (p.province) bits.push(p.province);
        else if (p.country) bits.push(p.country);
        if (fire.geometry && fire.geometry.coordinates) {
          bits.push(
            `${Number(fire.geometry.coordinates[1]).toFixed(2)}, ` +
            `${Number(fire.geometry.coordinates[0]).toFixed(2)}`
          );
        }
        meta.textContent = bits.join(' · ');
        li.append(kind, title, meta);
        const pick = () => {
          openAgencyFireFromSearch(map, hit);
          closeSearch();
        };
        li.addEventListener('click', pick);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        });
        results.append(li);
      }
    }
    if (placeList.length) {
      appendGroup('Places');
      for (const f of placeList) {
        const props = f.properties || {};
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.tabIndex = 0;
        const kind = document.createElement('span');
        kind.className = 'search-item-kind search-item-kind--place';
        kind.textContent = 'Place';
        const title = document.createElement('span');
        title.className = 'search-item-title';
        title.textContent = geocoderLabel(props);
        const meta = document.createElement('span');
        meta.className = 'search-item-meta';
        meta.textContent = String(geocoderPlaceKind(props) || props.type || 'place');
        li.append(kind, title, meta);
        const pick = () => flyToGeocode(map, f);
        li.addEventListener('click', pick);
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pick();
          }
        });
        results.append(li);
      }
    }
  };

  const run = async () => {
    const q = input.value.trim();
    results.innerHTML = '';
    if (q.length < 2) return;

    const my = ++seq;
    const fires = searchAgencyFiresByName(q);
    renderUnified(fires, [], { loading: true });

    const url =
      `${GEOCODER_BASE}/api?q=${encodeURIComponent(q)}&limit=5` +
      `&lang=${encodeURIComponent(GEOCODER_LANGUAGE)}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': GEOCODER_LANGUAGE
        }
      });
      if (my !== seq) return;
      if (!res.ok) {
        if (fires.length) renderUnified(fires, []);
        else renderUnified([], [], { error: `Geocoder error (${res.status}). Try again.` });
        return;
      }
      const data = await res.json();
      if (my !== seq) return;
      const feats = Array.isArray(data?.features) ? data.features : [];
      renderUnified(fires, feats, { emptyMsg: 'No results.' });
    } catch (err) {
      if (my !== seq) return;
      const insecure =
        typeof location !== 'undefined' &&
        location.protocol === 'https:' &&
        GEOCODER_BASE.startsWith('http:');
      const errMsg = insecure
        ? 'Geocoder blocked (HTTPS page → HTTP API). Use https://geocode.disasterdb.com.'
        : 'Geocoder unreachable. Check network / CORS.';
      if (fires.length) {
        renderUnified(fires, []);
      } else {
        renderUnified([], [], { error: errMsg });
      }
      console.warn('[geocode]', err);
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 280);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    }
  });
}

// --- Coordinate readout -----------------------------------------------------
function readout(map) {
  const el = $('readout');
  if (!el) return;
  const update = () => {
    const c = map.getCenter();
    el.textContent =
      `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}  ·  z${map.getZoom().toFixed(2)}` +
      `  ·  ${Math.round(map.getBearing())}°  ·  ${Math.round(map.getPitch())}° pitch`;
  };
  map.on('move', update);
  update();
}
