import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { setupContourDem } from './contour-dem.js';
import { buildStyle } from './basemap.js';
import {
  ensureGoesGeocolorMounted,
  wireGoesGeocolorLazy,
  registerAllGoesSeamProtocols
} from './goes.js';
import { setupSearch } from './search.js';
import { wireTipStampMirror } from './tipStamp.js';
import 'maplibre-gl/dist/maplibre-gl.css';

function parseDeepLink() {
  const q = new URLSearchParams(location.search);
  const lng = parseFloat(q.get('lng'));
  const lat = parseFloat(q.get('lat'));
  const zoom = parseFloat(q.get('zoom'));
  return {
    center: [Number.isFinite(lng) ? lng : -20, Number.isFinite(lat) ? lat : 20],
    zoom: Number.isFinite(zoom) ? zoom : 2.2
  };
}

function withBase(path) {
  const base = import.meta.env.BASE_URL || '/';
  if (path.startsWith('http')) return path;
  return base.replace(/\/?$/, '/') + String(path).replace(/^\//, '');
}

function boot() {
  if (!maplibregl._earthmapPmtiles) {
    maplibregl.addProtocol('pmtiles', new Protocol().tile);
    maplibregl._earthmapPmtiles = true;
  }
  // Client lon-alpha seam fades (same protocols as DisasterDB App).
  registerAllGoesSeamProtocols(maplibregl);
  setupContourDem(maplibregl);

  const deep = parseDeepLink();

  const map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(),
    center: deep.center,
    zoom: deep.zoom,
    pitch: 0,
    bearing: 0,
    maxPitch: 0,
    attributionControl: true,
    hash: false
  });

  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: false }),
    'bottom-right'
  );
  if (typeof maplibregl.GlobeControl === 'function') {
    map.addControl(new maplibregl.GlobeControl(), 'bottom-right');
  }

  setupSearch(map);
  wireTipStampMirror();

  map.on('load', async () => {
    try {
      if (map.setProjection) map.setProjection({ type: 'globe' });
    } catch (_) {}

    try {
      // L5 navy / sky space fog (not FireMap charcoal)
      map.setFog({
        color: 'rgb(10, 22, 40)',
        'high-color': 'rgb(24, 72, 140)',
        'horizon-blend': 0.04,
        'space-color': 'rgb(4, 10, 22)',
        'star-intensity': 0.35
      });
    } catch (_) {}

    // Wire transport/play/scrub + mount seamed GeoColor (App path).
    wireGoesGeocolorLazy(map);
    try {
      await ensureGoesGeocolorMounted(map);
    } catch (err) {
      console.warn('[earthmap] goes mount failed', err);
    }
  });

  document.querySelectorAll('a[data-em-path]').forEach((a) => {
    a.setAttribute('href', withBase(a.getAttribute('data-em-path')));
  });

  window.__earthmap = map;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
