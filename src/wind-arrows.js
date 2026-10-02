// ---------------------------------------------------------------------------
// Wind direction arrows — the high-zoom half of the wind layer.
//
// WHY THIS EXISTS. Particles cannot work zoomed in. mapbox-exif-layer seeds a
// fixed number of particles across the whole source image and never re-seeds to
// the viewport, so on-screen density falls off with zoom: by z7 a global PNG
// puts a handful of specks on screen, and raising the count is both ruinously
// expensive and still wrong, because the budget is spread over the planet
// rather than over what you are looking at.
//
// Arrows invert that. They are generated FROM THE VIEWPORT — a fixed screen-
// space grid, unprojected to lon/lat and sampled out of the same PNG — so the
// count is constant at every zoom by construction. Roughly 200 symbols per
// screen, regardless of whether you are looking at a state or a city block.
//
// So the two halves split the zoom range and never overlap:
//   z2.5 - 6   particles  (motion; how fast, and the shape of the flow)
//   z6 +       arrows     (direction; which way, legibly, at any scale)
//
// Both read the same u/v PNG. Nothing extra is fetched.
// ---------------------------------------------------------------------------

// Screen-space spacing between arrows, in CSS pixels. This is the whole reason
// density stays constant: the grid is built in screen space, not world space.
const SPACING_PX = 62;

// Below about this speed the direction is not meaningful enough to draw -- GFS
// near-calm cells are mostly numerical noise, and a field of arrows all
// disagreeing at 0.5 m/s reads as broken rather than calm.
const MIN_SPEED_MPS = 0.8;

/**
 * Decode the wind PNG once into raw RGBA, for CPU-side sampling.
 *
 * The particle layer uploads this same image to the GPU as a texture; we need
 * it readable on the CPU instead, hence the canvas round-trip. Same URL, so the
 * browser serves it from cache -- this is not a second download.
 */
async function loadField(url, meta) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((ok, fail) => {
    img.onload = ok;
    img.onerror = () => fail(new Error('arrow field: cannot load ' + url));
    img.src = url;
  });
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
  return { data, w: cv.width, h: cv.height, meta };
}

/**
 * Sample earth-relative u/v at a lon/lat. Nearest-neighbour: at these zooms an
 * arrow sits well inside one 0.25-degree cell anyway, and interpolating would
 * invent structure the source does not have.
 *
 * lon0/lat0 in the playlist are pixel CENTRES, so the index is a plain offset
 * with no half-cell correction -- that correction belongs to the EDGE bounds
 * handed to the particle layer, and applying it here too would double it.
 */
function sample(field, lon, lat) {
  const { lon0, lat0, dx, dy, u_range } = field.meta;
  let x = Math.round((lon - lon0) / dx);
  const y = Math.round((lat - lat0) / dy);
  x = ((x % field.w) + field.w) % field.w;              // wrap the antimeridian
  if (y < 0 || y >= field.h) return null;               // past the poles
  const i = (y * field.w + x) * 4;
  if (field.data[i + 2] === 0) return null;             // B = no-data mask
  const [lo, hi] = u_range;
  const span = hi - lo;
  return {
    u: (field.data[i]     / 255) * span + lo,
    v: (field.data[i + 1] / 255) * span + lo
  };
}

/** A small white chevron, drawn at 2x for retina and pointing UP (north). */
function arrowImage() {
  const s = 34;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const c = cv.getContext('2d');
  c.strokeStyle = '#fff';
  c.fillStyle = '#fff';
  c.lineWidth = 2.6;
  c.lineCap = 'round';
  c.beginPath();                       // shaft
  c.moveTo(s / 2, s * 0.80);
  c.lineTo(s / 2, s * 0.30);
  c.stroke();
  c.beginPath();                       // head
  c.moveTo(s / 2, s * 0.13);
  c.lineTo(s * 0.30, s * 0.42);
  c.lineTo(s * 0.70, s * 0.42);
  c.closePath();
  c.fill();
  return c.getImageData(0, 0, s, s);
}

/**
 * Build one arrow per screen-grid node.
 *
 * Bearing is atan2(u, v): u is eastward and v northward, so this is degrees
 * clockwise from north, which is exactly what icon-rotate wants with an icon
 * drawn pointing up. It is the direction the wind is blowing TOWARDS -- the
 * opposite of the meteorological convention, and the right one for an arrow.
 */
function buildArrows(map, field) {
  const { width, height } = map.getCanvas();
  const dpr = window.devicePixelRatio || 1;
  const stepX = SPACING_PX, stepY = SPACING_PX;
  const w = width / dpr, h = height / dpr;
  const features = [];

  for (let py = stepY / 2; py < h; py += stepY) {
    for (let px = stepX / 2; px < w; px += stepX) {
      const ll = map.unproject([px, py]);
      if (!isFinite(ll.lng) || !isFinite(ll.lat) || Math.abs(ll.lat) > 89.5) continue;
      const s = sample(field, ll.lng, ll.lat);
      if (!s) continue;
      const speed = Math.hypot(s.u, s.v);
      if (speed < MIN_SPEED_MPS) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [ll.lng, ll.lat] },
        properties: {
          bearing: Math.atan2(s.u, s.v) * 180 / Math.PI,
          speed
        }
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Wire the arrow layer. Renders only above `minZoom`, where the particles have
 * been gated off, so the two never draw at the same time.
 */
export async function addWindArrows(map, { playlist, frame, minZoom }) {
  const field = await loadField(playlist.base + frame.file, playlist);

  if (!map.hasImage('wind-arrow')) {
    map.addImage('wind-arrow', arrowImage(), { pixelRatio: 2 });
  }
  map.addSource('wind-arrows', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  map.addLayer({
    id: 'wind-arrows',
    type: 'symbol',
    source: 'wind-arrows',
    minzoom: minZoom,
    layout: {
      'icon-image': 'wind-arrow',
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',   // rotate with the map, not the screen
      'icon-allow-overlap': true,         // it is a regular grid; let it draw
      'icon-ignore-placement': true,
      // The icon is 34px drawn at pixelRatio 2, so it lays down at 17 CSS px
      // before scaling: this yields roughly 14-22 px arrows, which is the range
      // where a chevron's heading is actually readable at a glance.
      'icon-size': ['interpolate', ['linear'], ['get', 'speed'], 0, 0.85, 20, 1.3]
    },
    paint: {
      // Same speed-fade idea as the particles: calm air recedes, wind reads.
      // No halo properties here -- icon-halo-* apply only to SDF images, and
      // this is a plain raster icon, so they would be silently ignored.
      'icon-opacity': ['interpolate', ['linear'], ['get', 'speed'], 1, 0.45, 12, 0.92]
    }
  });

  const refresh = () => {
    if (map.getZoom() < minZoom) return;               // layer is hidden anyway
    const src = map.getSource('wind-arrows');
    if (src) src.setData(buildArrows(map, field));
  };

  let t;
  map.on('moveend', () => { clearTimeout(t); t = setTimeout(refresh, 120); });
  refresh();

  return { refresh };
}
