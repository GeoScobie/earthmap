\
/* EarthMap MVP — MapLibre globe + DisasterDB GeoColor XYZ tips.
   Stack order (bottom→top): gk2a, meteosat, goes-east, goes-west(+widl later).
   Soft seams deferred; Himawari omitted while tip parked. */
(function () {
  const LATEST = 'https://sat.disasterdb.com/geocolor/latest.json';
  const BASE = 'https://sat.disasterdb.com/geocolor';
  const SATS = [
    { id: 'gk2a',      sourceId: 'em-gk2a', layerId: 'em-gk2a', bounds: [58, -70, 175, 75], opacity: 0.92 },
    { id: 'meteosat',  sourceId: 'em-meteosat', layerId: 'em-meteosat', bounds: [-29, -40, 65, 65], opacity: 0.95 },
    { id: 'goes-east', sourceId: 'em-goes-east', layerId: 'em-goes-east', bounds: [-136, -55, -23, 65], opacity: 0.95 },
    { id: 'goes-west', sourceId: 'em-goes-west', layerId: 'em-goes-west', bounds: [-180, -55, -130, 65], opacity: 0.95 }
  ];

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

  function tileUrl(slug, tip) {
    return `${BASE}/${slug}/${tip.ymd}/${tip.hhmm}/{z}/{x}/{y}.png`;
  }

  function fmtStamp(sats) {
    const picks = ['goes-east', 'meteosat', 'gk2a', 'goes-west'];
    const parts = [];
    for (const id of picks) {
      const t = sats[id];
      if (!t) continue;
      parts.push(`${id} ${t.hhmm}Z`);
    }
    return parts.join(' · ') || 'tip loading…';
  }

  async function fetchTip() {
    const res = await fetch(LATEST, { cache: 'no-store' });
    if (!res.ok) throw new Error('latest.json ' + res.status);
    return res.json();
  }

  function ensureLayers(map, tip) {
    for (const sat of SATS) {
      const t = tip.sats[sat.id];
      if (!t) continue;
      const url = tileUrl(sat.id, t);
      if (map.getSource(sat.sourceId)) {
        map.getSource(sat.sourceId).setTiles([url]);
      } else {
        map.addSource(sat.sourceId, {
          type: 'raster',
          tiles: [url],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 6,
          bounds: sat.bounds,
          attribution: 'GeoColor © NOAA / EUMETSAT / KMA · DisasterDB'
        });
        map.addLayer({
          id: sat.layerId,
          type: 'raster',
          source: sat.sourceId,
          paint: {
            'raster-opacity': sat.opacity,
            'raster-fade-duration': 0
          }
        });
      }
    }
  }

  function boot() {
    const deep = parseDeepLink();
    const stampEl = document.getElementById('tip-stamp');

    const map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          // dark empty basemap — sat is the story
          'empty': {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#02060f' }
          }
        ]
      },
      center: deep.center,
      zoom: deep.zoom,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      attributionControl: true,
      hash: false
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right');
    if (typeof maplibregl.GlobeControl === 'function') {
      map.addControl(new maplibregl.GlobeControl(), 'bottom-right');
    }

    map.on('load', async () => {
      try {
        if (map.setProjection) map.setProjection({ type: 'globe' });
      } catch (_) {}

      // soft atmosphere
      try {
        map.setFog({
          color: 'rgb(8, 14, 28)',
          'high-color': 'rgb(20, 40, 80)',
          'horizon-blend': 0.04,
          'space-color': 'rgb(2, 4, 12)',
          'star-intensity': 0.35
        });
      } catch (_) {}

      // light coastlines from Natural Earth via MapLibre demo (optional low-viz)
      try {
        map.addSource('ne', {
          type: 'vector',
          url: 'https://demotiles.maplibre.org/tiles/tiles.json'
        });
        map.addLayer({
          id: 'ne-countries',
          type: 'line',
          source: 'ne',
          'source-layer': 'countries',
          paint: {
            'line-color': 'rgba(200,220,255,0.35)',
            'line-width': 0.6
          }
        });
      } catch (_) {}

      async function refresh() {
        try {
          const tip = await fetchTip();
          ensureLayers(map, tip);
          if (stampEl) {
            stampEl.innerHTML = '<strong>NEAR-REAL-TIME</strong> · ' + fmtStamp(tip.sats);
          }
        } catch (err) {
          console.warn('[earthmap] tip refresh failed', err);
          if (stampEl) stampEl.textContent = 'tip unavailable — retrying…';
        }
      }

      await refresh();
      setInterval(refresh, 60_000);
    });

    window.__earthmap = map;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
