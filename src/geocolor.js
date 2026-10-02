// GeoColor XYZ tips — insert under contour-lines (App #114 beforeId).
import { GEOCOLOR, attribution, CONTOUR_LINES_LAYER_ID } from './theme.js';

function tileUrl(slug, tip) {
  return `${GEOCOLOR.base}/${slug}/${tip.ymd}/${tip.hhmm}/{z}/{x}/{y}.png`;
}

function beforeId(map) {
  if (map.getLayer(CONTOUR_LINES_LAYER_ID)) return CONTOUR_LINES_LAYER_ID;
  return undefined;
}

export async function fetchTip() {
  const res = await fetch(GEOCOLOR.latest, { cache: 'no-store' });
  if (!res.ok) throw new Error('latest.json ' + res.status);
  return res.json();
}

export function ensureGeocolorLayers(map, tip) {
  const before = beforeId(map);
  for (const sat of GEOCOLOR.sats) {
    const t = tip.sats?.[sat.id];
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
        attribution: attribution.geocolor
      });
      const layer = {
        id: sat.layerId,
        type: 'raster',
        source: sat.sourceId,
        paint: {
          'raster-opacity': sat.opacity,
          'raster-fade-duration': 0
        }
      };
      if (before) map.addLayer(layer, before);
      else map.addLayer(layer);
    }
  }
}

export function fmtStamp(sats) {
  const picks = ['goes-east', 'meteosat', 'gk2a', 'goes-west'];
  const parts = [];
  for (const id of picks) {
    const t = sats?.[id];
    if (!t) continue;
    parts.push(`${id} ${t.hhmm}Z`);
  }
  return parts.join(' · ') || 'tip loading…';
}
