// Protomaps OSM carto + hillshade + low-z contours under GeoColor (App #114).
import { layers as pmLayers } from '@protomaps/basemaps';
import {
  sources,
  hillshade,
  contours,
  waterFillOpacity,
  waterLineOpacity,
  attribution,
  HILLSHADE_LAYER_ID,
  CONTOUR_LINES_LAYER_ID,
  CONTOUR_LABELS_LAYER_ID
} from './theme.js';
import { earthmapTopoFlavor, isCartoBaseLayer } from './flavors.js';
import { sharedDemTilesUrl, contourTilesUrl } from './contour-dem.js';

/**
 * Build style with OSM fills + DEM hillshade + contours.
 * Contour layers sit above where GeoColor will insert (beforeId = contour-lines).
 * Hide roads_* — sat-live reads clean; major-roads-over-sat can land later.
 */
export function buildStyle() {
  const flavor = earthmapTopoFlavor();
  const basemapAttr =
    `${attribution.protomaps} ${attribution.osm} ${attribution.mapterhorn}`.trim();

  const styleSources = {
    basemap: {
      type: 'vector',
      url: `pmtiles://${sources.basemapPMTiles}`,
      maxzoom: 15,
      attribution: basemapAttr
    },
    terrarium: {
      type: 'raster-dem',
      tiles: [sharedDemTilesUrl()],
      tileSize: sources.terrariumTileSize ?? 512,
      maxzoom: sources.terrariumMaxzoom ?? 15,
      encoding: 'terrarium',
      attribution: attribution.mapterhorn
    },
    contours: {
      type: 'vector',
      tiles: [contourTilesUrl()],
      maxzoom: 15
    }
  };

  let base = pmLayers('basemap', flavor, { lang: 'en' }).filter(isCartoBaseLayer);

  // Soften water fill so hillshade reads under lakes/coast.
  const waterFill = base.find((l) => l.id === 'water');
  if (waterFill?.paint) {
    waterFill.paint = { ...waterFill.paint, 'fill-opacity': waterFillOpacity };
  }
  for (const id of ['water_stream', 'water_river']) {
    const line = base.find((l) => l.id === id);
    if (line?.paint) {
      line.paint = { ...line.paint, 'line-opacity': waterLineOpacity };
    }
  }

  // Sat-live: hide cased roads under imagery (App hides roads_* too).
  for (const layer of base) {
    if (String(layer.id).startsWith('roads_')) {
      layer.layout = { ...(layer.layout || {}), visibility: 'none' };
    }
  }

  const insertBeforeWater = (layer) => {
    const waterAt = base.findIndex((l) => l.id === 'water');
    if (waterAt >= 0) base.splice(waterAt, 0, layer);
    else base.push(layer);
  };

  insertBeforeWater({
    id: HILLSHADE_LAYER_ID,
    type: 'hillshade',
    source: 'terrarium',
    paint: {
      'hillshade-method': hillshade.method || 'igor',
      'hillshade-shadow-color': hillshade.shadow,
      'hillshade-highlight-color': hillshade.highlight,
      'hillshade-exaggeration': hillshade.exaggeration
    }
  });

  // Contours after water — GeoColor inserts before contour-lines so isolines
  // sit above sat at low zoom (App goes.js / geocolor.js beforeId).
  const contourLayers = [
    {
      id: CONTOUR_LINES_LAYER_ID,
      type: 'line',
      source: 'contours',
      'source-layer': contours.layer,
      minzoom: 4,
      paint: {
        'line-color': [
          'match',
          ['get', contours.levelKey],
          1,
          contours.lineColorMajor,
          contours.lineColor
        ],
        'line-width': ['match', ['get', contours.levelKey], 1, 1.1, 0.45],
        'line-opacity': 0.9
      }
    },
    {
      id: CONTOUR_LABELS_LAYER_ID,
      type: 'symbol',
      source: 'contours',
      'source-layer': contours.layer,
      minzoom: 9,
      filter: ['>', ['get', contours.levelKey], 0],
      layout: {
        'symbol-placement': 'line',
        'text-field': [
          'concat',
          ['to-string', ['round', ['get', contours.elevationKey]]],
          ' m'
        ],
        'text-size': 10,
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular']
      },
      paint: {
        'text-color': contours.labelColor,
        'text-halo-color': contours.labelHalo,
        'text-halo-width': 1.2
      }
    }
  ];

  const roadsAt = base.findIndex((l) => String(l.id).startsWith('roads_'));
  if (roadsAt >= 0) base.splice(roadsAt, 0, ...contourLayers);
  else base.push(...contourLayers);

  return {
    version: 8,
    name: 'EarthMap — OSM + GeoColor',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: styleSources,
    layers: base
  };
}
