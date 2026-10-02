import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { setupContourDem } from './contour-dem.js';
import { buildStyle } from './basemap.js';
import { fetchTip, ensureGeocolorLayers, fmtStamp } from './geocolor.js';
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
  // Teach MapLibre pmtiles:// once (App app.js).
  if (!maplibregl._earthmapPmtiles) {
    maplibregl.addProtocol('pmtiles', new Protocol().tile);
    maplibregl._earthmapPmtiles = true;
  }
  setupContourDem(maplibregl);

  const deep = parseDeepLink();
  const stampEl = document.getElementById('tip-stamp');

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

  map.on('load', async () => {
    try {
      if (map.setProjection) map.setProjection({ type: 'globe' });
    } catch (_) {}

    try {
      map.setFog({
        color: 'rgb(8, 14, 28)',
        'high-color': 'rgb(20, 40, 80)',
        'horizon-blend': 0.04,
        'space-color': 'rgb(2, 4, 12)',
        'star-intensity': 0.35
      });
    } catch (_) {}

    async function refresh() {
      try {
        const tip = await fetchTip();
        ensureGeocolorLayers(map, tip);
        if (stampEl) {
          stampEl.innerHTML =
            '<strong>NEAR-REAL-TIME</strong> · ' + fmtStamp(tip.sats);
        }
      } catch (err) {
        console.warn('[earthmap] tip refresh failed', err);
        if (stampEl) stampEl.textContent = 'tip unavailable — retrying…';
      }
    }

    await refresh();
    setInterval(refresh, 60_000);
  });

  // Fix country / nav links for project Pages base
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
