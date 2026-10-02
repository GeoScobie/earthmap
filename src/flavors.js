// ---------------------------------------------------------------------------
// DisasterDB Protomaps Flavors — used by @protomaps/basemaps layers()
//
// Own-Protomaps only (R2 v4 PMTiles). Not MapTiler / Stadia / Mapbox CDN.
// See docs/PR_DISASTERDB_TOPO.md.
// ---------------------------------------------------------------------------

import { namedFlavor } from '@protomaps/basemaps';

/**
 * Mapbox Outdoors–inspired cartographic palette on Protomaps light structure.
 * Tuned for Lexend place labels (dark ink + light halo) and white ADM borders.
 */
export function disasterdbTopoFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // Terrain / land — warmer earth, richer greens (Outdoors-ish)
    background: '#d8e4ec',
    earth: '#e8e4d8',
    park_a: '#c6ddc0',
    park_b: '#b4d4a8',
    wood_a: '#b8d0a8',
    wood_b: '#9bc48a',
    scrub_a: '#d4d8b8',
    scrub_b: '#c5cfa0',
    hospital: '#e8d4d0',
    industrial: '#d8d6d0',
    school: '#e6dfd0',
    pedestrian: '#e4e0d4',
    glacier: '#eef4f8',
    sand: '#e8e0c8',
    beach: '#f0e8c8',
    aerodrome: '#dcd8d4',
    runway: '#c8c4c0',
    water: '#5a9bb8',
    zoo: '#c0d8c8',
    // Google-like olive/khaki — distinct from park greens / washed gray
    military: '#b8b47a',
    pier: '#e0dcd4',
    buildings: '#d4d0c8',
    // Roads — light fill / soft casing (readable over landcover)
    highway: '#f5f0e0',
    highway_casing_early: '#c4a574',
    highway_casing_late: '#c4a574',
    major: '#ffffff',
    major_casing_early: '#c8c0b0',
    major_casing_late: '#c8c0b0',
    minor_a: '#ffffff',
    minor_b: '#ffffff',
    minor_casing: '#c8c4b8',
    minor_service: '#f5f5f0',
    minor_service_casing: '#d0ccc4',
    link: '#ffffff',
    link_casing: '#c8c4b8',
    other: '#ebe8e0',
    railway: '#a8a098',
    // White ADM intent (we still splice DisasterDB boundary-* layers)
    boundaries: 'rgba(255,255,255,0.88)',
    // Lexend stacks (only matter if PM label layers are kept; we strip them)
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(196, 220, 168, 1)',
      barren: 'rgba(232, 220, 188, 1)',
      urban_area: 'rgba(220, 216, 208, 1)',
      farmland: 'rgba(210, 224, 176, 1)',
      glacier: 'rgba(236, 244, 248, 1)',
      scrub: 'rgba(214, 220, 176, 1)',
      forest: 'rgba(152, 188, 132, 1)'
    },
    // Label colors unused when we strip PM symbols — kept for completeness
    city_label: '#2a2a2a',
    city_label_halo: '#f5f2ea',
    state_label: '#5a5a5a',
    state_label_halo: '#f5f2ea',
    country_label: '#3a3a3a',
    ocean_label: '#3a6a88',
    subplace_label: '#4a4a4a',
    subplace_label_halo: '#f5f2ea'
  };
}

/** Stub: stock Protomaps light — wire for future QA, not topo-polished. */
export function disasterdbLightFlavor() {
  return {
    ...namedFlavor('light'),
    boundaries: 'rgba(255,255,255,0.88)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular'
  };
}

/** Stub: stock Protomaps dark — wire for future QA. */
export function disasterdbDarkFlavor() {
  return {
    ...namedFlavor('dark'),
    boundaries: 'rgba(255,255,255,0.88)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular'
  };
}

/** Layer ids from layers() that we keep for cartographic fills + roads. */
export const CARTO_LAYER_ID_RE =
  /^(background|earth|landcover|landuse_|water$|water_stream|water_river|buildings|roads_)/;

/** Drop PM boundaries / labels / shields / POIs — DisasterDB owns those. */
export function isCartoBaseLayer(layer) {
  if (!CARTO_LAYER_ID_RE.test(layer.id)) return false;
  if (/label|shield|oneway|boundaries|pois|places|address/.test(layer.id)) {
    return false;
  }
  // Sprite-dependent symbol layers (shields etc.) already filtered by id.
  const raw = JSON.stringify(layer);
  if (raw.includes('"icon-image"')) return false;
  return true;
}
