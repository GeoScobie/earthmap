// ---------------------------------------------------------------------------
// The map itself. Everything that is not build-tool-specific lives here so the
// two entry points — the Vite one (main.js) and the no-build CDN one
// (main.standalone.js) — stay byte-for-byte identical in behaviour. Those two
// files do nothing but wire up the worker and hand the library in.
// ---------------------------------------------------------------------------

import { buildStyle } from './style.js';
import { brand, cartoLightLabels, sources, attribution } from './theme.js';
import { resolveDemNeeded, resolveBasemapId, isLightCartographic, isSatelliteBasemap } from './basemap-resolve.js';
// isSatelliteBasemap used for terrain + default sat chrome
import { setupContourDem } from './contour-dem.js';
import { loadPoiIcons } from './icons.js';
import { addFireLayers } from './fire.js';
import { initUI, LocateMeControl } from './ui.js';
import { addWindLayer, wireWindZoomGate, wireWindToggle } from './wind.js';
import { addGeocolorLayers } from './geocolor.js';
import { ensureGoesGeocolorMounted, wireGoesGeocolorLazy, wireGoesSatMode } from './goes.js';
import { addHurricaneLayers, wireHurricaneToggle } from './hurricane.js';
import { addSatelliteLayers, wireSatelliteToggle } from './satellite.js';
import { addAgencyFireLayers, wireAgencyFireToggles } from './agency-fires.js';
import { wireFirmsHotspotInteractions } from './firms-infobox.js';
import { applyEmbedMode, resolveEmbedMode, resolveGoesGeocolorDefaultOn } from './embed.js';
import { addEmbedFireLabel } from './embed-fire-label.js';


// ---------------------------------------------------------------------------
// Dual-unit scale bar (miles + kilometers on one control)
// ---------------------------------------------------------------------------
// FireMap.live: map.addControl(new mapboxgl.ScaleControl(), 'bottom-left') —
// single unit only. Rob asked for both mi and km on the same bar (common
// topo-map layout: imperial above, metric below, shared bar width).
// FireMap SoT: desktop maxWidth 110; mobile ≤900px stays 65 (do not enlarge).
function DualScaleControl(opts = {}) {
  this._maxWidthDesktop = opts.maxWidth != null ? opts.maxWidth : 110;
  this._maxWidthMobile = opts.maxWidthMobile != null ? opts.maxWidthMobile : 65;
  this._mobileMq = opts.mobileMq || '(max-width: 900px)';
}

DualScaleControl.prototype._effectiveMaxWidth = function _effectiveMaxWidth() {
  try {
    if (typeof window !== 'undefined' && window.matchMedia &&
        window.matchMedia(this._mobileMq).matches) {
      return this._maxWidthMobile;
    }
  } catch { /* ignore */ }
  return this._maxWidthDesktop;
};

DualScaleControl.prototype.onAdd = function onAdd(map) {
  this._map = map;
  this._container = document.createElement('div');
  this._container.className = 'maplibregl-ctrl ddb-dual-scale';
  this._container.setAttribute('aria-label', 'Map scale');
  this._mi = document.createElement('div');
  this._mi.className = 'ddb-dual-scale-label ddb-dual-scale-mi';
  this._bar = document.createElement('div');
  this._bar.className = 'ddb-dual-scale-bar';
  this._km = document.createElement('div');
  this._km.className = 'ddb-dual-scale-label ddb-dual-scale-km';
  this._container.append(this._mi, this._bar, this._km);
  this._onMove = () => this._update();
  this._onResize = () => this._update();
  map.on('move', this._onMove);
  map.on('resize', this._onResize);
  this._update();
  return this._container;
};

DualScaleControl.prototype.onRemove = function onRemove() {
  this._container.remove();
  this._map.off('move', this._onMove);
  this._map.off('resize', this._onResize);
  this._map = undefined;
};

/** Round to a cartographic "nice" length (same idea as MapLibre ScaleControl). */
DualScaleControl.prototype._roundNice = function _roundNice(n) {
  const pow = Math.pow(10, Math.floor(Math.log10(n)));
  const d = n / pow;
  const nice = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;
  return nice * pow;
};

DualScaleControl.prototype._update = function _update() {
  const map = this._map;
  if (!map) return;
  const maxWidth = this._effectiveMaxWidth();
  const y = map.getContainer().clientHeight / 2;
  const x = (map.getContainer().clientWidth - maxWidth) / 2;
  const left = map.unproject([x, y]);
  const right = map.unproject([x + maxWidth, y]);
  const meters = left.distanceTo(right);
  if (!(meters > 0) || !Number.isFinite(meters)) return;

  // Size the bar to a nice metric length (matches MapLibre metric ScaleControl),
  // then label the same ground distance in miles (or feet) above.
  const niceM = this._roundNice(meters);
  const width = Math.max(1, Math.round((maxWidth * niceM) / meters));
  this._bar.style.width = `${width}px`;

  let kmText;
  if (niceM >= 1000) {
    kmText = `${niceM / 1000} km`;
  } else {
    kmText = `${Math.round(niceM)} m`;
  }

  const miles = niceM / 1609.344;
  let miText;
  if (miles >= 1) {
    // Same ground length as the km label (not a second independent nice-mi).
    const exact = miles >= 10 ? Math.round(miles) : Math.round(miles * 10) / 10;
    miText = `${exact} mi`;
  } else {
    miText = `${Math.round(niceM / 0.3048)} ft`;
  }

  this._mi.textContent = miText;
  this._km.textContent = kmText;
};

export function createMap(maplibregl, Protocol) {
  // Teach MapLibre how to read pmtiles:// URLs. Do this ONCE, globally.
  maplibregl.addProtocol('pmtiles', new Protocol().tile);

  // Embed / iframe chrome-light (?embed=1) — body class + GOES defaults OFF.
  // Prefer CSS hide over deleting controls; see docs/PR_EMBED_MODE.md.
  const embed = applyEmbedMode();

  // Contours + shared Terrarium DEM protocols before style references them.
  // Unified topo↔NASA style always includes DEM sources, even if cold-start
  // basemap is satellite (visibility-only toggle — no setStyle).
  if (resolveDemNeeded() || resolveBasemapId() === 'satellite' || resolveBasemapId() === 'disasterdb-topo') {
    setupContourDem(maplibregl);
  }

  const map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(),
    center: [-119.7, 37.6],   // Sierra Nevada — good terrain to test 3D against
    zoom: 6,
    hash: true,               // keeps position in the URL so reloads don't lose you
    maxPitch: 80,
    attributionControl: false,
    // Scroll/trackpad zoom with no modifier — ctrl+scroll requirement removed (Rob).

    // Globe fling / drag-pan inertia (MapLibre defaults: linearity 0.3,
    // maxSpeed 1400, deceleration 2500). After #96 (0.35 / 1600 / 2200),
    // push further toward a slingshot coast — longer coast, still capped.
    // Travel scales ~linearity/deceleration.
    dragPan: {
      linearity: 0.42,
      maxSpeed: 2200,
      deceleration: 1700
    },

    // Renders CJK glyphs from the user's system fonts instead of downloading
    // hundreds of MB of SDF glyph ranges. Keep this on.
    localIdeographFontFamily: "'Noto Sans CJK SC', 'Hiragino Sans', sans-serif"
  });

  // Dual mi + km scale (FireMap has a single ScaleControl at bottom-left;
  // MapLibre ScaleControl is one-unit only, so we use a small dual-unit bar).
  map.addControl(new DualScaleControl({ maxWidth: 110, maxWidthMobile: 65 }), 'bottom-left');
  // bottom-right floats: first control sits on the bottom edge, later ones stack above.
  // Put compact attrib (info) first so it sits UNDER the zoom/compass group.
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '' }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right');
  // Locate above zoom (flex order:0). FireMap SoT — not on vertical toolbar / near search.
  map.addControl(new LocateMeControl(), 'bottom-right');

  // -------------------------------------------------------------------------
  // Terrain and sky
  // -------------------------------------------------------------------------
  map.on('load', () => {
    // Terrain is added here but starts disabled — toggle it from the rail.
    map.addSource('terrain', {
      type: 'raster-dem',
      tiles: [sources.terrariumTiles],
      tileSize: sources.terrariumTileSize ?? 512,
      maxzoom: sources.terrariumMaxzoom ?? 15,
      encoding: 'terrarium',
      // Attribution applied only while terrain is active (see syncTerrainForBasemap).
      attribution: isSatelliteBasemap() ? '' : attribution.mapterhorn
    });
    map.setSky({
      'sky-color': '#0A1622',
      'horizon-color': '#2A4257',
      'fog-color': '#0B1119',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.6,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 0.4, 8, 0]
    });

    // Terrain only in topo/carto — enabling it always marks the DEM source
    // usedForTerrain and forces Mapterhorn into sat-mode attribution.
    if (!isSatelliteBasemap()) {
      map.setTerrain({ source: 'terrain', exaggeration: 1.3 });
    }

    wireInspector(map);

    // POI icons are fetched and registered after load. Deliberately not
    // awaited: labels render immediately and icons pop in a moment later,
    // rather than the whole basemap waiting on a CDN.
    // Match carto (topo/light) label colors so Maki icons are not white-on-cream.
    const poiColors = isLightCartographic(resolveBasemapId())
      ? { ...brand, ...cartoLightLabels }
      : brand;
    loadPoiIcons(map, poiColors).catch((e) => console.warn('[icons]', e));

    // Fire Map Live incident layers, from your GeoServer. Added after the
    // basemap so they can be inserted beneath the label layers.
    try {
      addFireLayers(map);
    } catch (e) {
      // A data outage must never take the basemap down with it.
      console.error('[fire]', e);
    }

    // GOES East + West (owned sat.disasterdb.com). Both ON by default when
    // theme.goesGeocolor.defaultOn (cold-start mount). Embed skips entirely.
    // Satellite toolbar button toggles GeoColor + bottom time transport.
    if (!resolveEmbedMode()) {
      // Always wire Satellite toolbar + bottom transport (button gates; ?scrub=1 still forces on).
      // Cold mount only via ensureGoesGeocolorMounted so later ensure calls share one promise.
      wireGoesSatMode(map);
      wireGoesGeocolorLazy(map);
      if (resolveGoesGeocolorDefaultOn()) {
        ensureGoesGeocolorMounted(map).catch((e) => console.warn('[goes-geocolor]', e.message));
      }
    }

    // Path B owned mosaic stub. Idle until theme.geocolor.enabled + baseUrl.
    addGeocolorLayers(map).catch((e) => console.warn('[geocolor]', e.message));

    // Wind particles. Added after the fire layers so it can be inserted
    // beneath them, and deliberately not awaited: a wind outage must never
    // delay the basemap or the incident layers.
    addWindLayer(map)
      .then((l) => { if (l) { wireWindZoomGate(map); wireWindToggle(map); } })
      .catch((e) => console.warn('[wind]', e.message));

    // Hurricane tracks (Google DeepMind via FireDB WFS) — FireMap.live 1:1.
    try {
      addHurricaneLayers(map, maplibregl);
      wireHurricaneToggle(map);
    } catch (e) {
      console.error('[hurricane]', e);
    }

    // Satellite subpoint tracks (FireDB:satellite_orbit_12hr) — FireMap.live 1:1.
    try {
      addSatelliteLayers(map, maplibregl);
      wireSatelliteToggle(map);
    } catch (e) {
      console.error('[satellite]', e);
    }

    // Incident fire points (US/CA/AU/EU WFS) + FIRMS infoBox — FireMap.live 1:1.
    try {
      addAgencyFireLayers(map);
      wireFirmsHotspotInteractions(map);
      wireAgencyFireToggles(map);
    } catch (e) {
      console.error('[agency-fires]', e);
    }


    // SEO embed: always-on fire name at USA fire pt / fixed hash (?fireLabel= / ?fire=).
    // No-op when params absent — does not change main-map labeling.
    try {
      addEmbedFireLabel(map);
    } catch (e) {
      console.warn('[embed-fire-label]', e);
    }

    // Chrome last: the layer list reads the layers added above.
    try {
      initUI(map);
    } catch (e) {
      console.error('[ui]', e);
    }
  });

  // Surface tile failures instead of letting them fail silently.
  map.on('error', (e) => console.error('[maplibre]', e.error?.message ?? e));

  return map;
}

// ---------------------------------------------------------------------------
// Readout + schema inspector
//
// Shift-click anywhere to dump the vector features under the cursor to the
// console. Use this to discover the real property names in your tiles — the
// filters in style.js assume the Protomaps v4 schema, and if you swap to a
// different tileset the field names will differ.
// ---------------------------------------------------------------------------
function wireInspector(map) {
  // The coordinate readout lives in ui.js now; this is only the shift-click
  // schema inspector.

  map.on('click', (e) => {
    if (!e.originalEvent.shiftKey) return;
    const feats = map.queryRenderedFeatures(e.point);
    console.log(
      `%c${feats.length} feature(s) at ${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)}`,
      'font-weight:bold'
    );
    for (const f of feats) {
      console.log(`  [${f.sourceLayer ?? f.source}]`, f.properties);
    }
  });
}
