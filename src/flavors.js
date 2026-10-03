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

/**
 * Light cartographic palette on Protomaps light structure — same override keys
 * as disasterdbTopoFlavor / disasterdbStreetsFlavor. Paper land, clear blue
 * water, quiet gray/white roads (not streets orange, not Outdoors greens).
 * Lexend stacks match the other flavors. Leftover keys stay on stock light.
 */
export function disasterdbLightFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // Land — paper / cream, quieter than topo earth
    background: '#e8eef2',
    earth: '#f5f2ea',
    // Soft parks — present but not Outdoors-saturated
    park_a: '#dce8d4',
    park_b: '#d0e0c6',
    wood_a: '#d4e0cc',
    wood_b: '#c4d4b8',
    scrub_a: '#e4e6d4',
    scrub_b: '#d8dcc6',
    hospital: '#f0e6e4',
    industrial: '#e8e6e2',
    school: '#f2ece2',
    pedestrian: '#efebe4',
    glacier: '#f0f4f8',
    sand: '#efe6d4',
    beach: '#f4ecd4',
    aerodrome: '#e8e6e4',
    runway: '#d4d2d0',
    water: '#6ba3c7',
    zoo: '#d8e4d4',
    // Soft khaki
    military: '#d8d6c4',
    pier: '#e8e4de',
    buildings: '#e4e0da',
    // Roads — quiet: soft white fills, light gray casings (no orange hierarchy)
    highway: '#ffffff',
    highway_casing_early: '#b8b0a4',
    highway_casing_late: '#b8b0a4',
    major: '#ffffff',
    major_casing_early: '#c4beb4',
    major_casing_late: '#c4beb4',
    minor_a: '#fafaf8',
    minor_b: '#f8f8f4',
    minor_casing: '#d0ccc4',
    minor_service: '#f4f2ee',
    minor_service_casing: '#dcd8d0',
    link: '#ffffff',
    link_casing: '#c8c4bc',
    other: '#eeeae4',
    railway: '#b8b4ac',
    // White ADM intent (we still splice DisasterDB boundary-* layers)
    boundaries: 'rgba(255,255,255,0.88)',
    // Lexend stacks (only matter if PM label layers are kept; we strip them)
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(220, 232, 208, 1)',
      barren: 'rgba(236, 228, 208, 1)',
      urban_area: 'rgba(228, 226, 220, 1)',
      farmland: 'rgba(228, 234, 208, 1)',
      glacier: 'rgba(240, 244, 248, 1)',
      scrub: 'rgba(228, 230, 210, 1)',
      forest: 'rgba(196, 216, 180, 1)'
    },
    // Dark ink + light halo — readable on paper land if PM symbols are kept
    city_label: '#2a2a2a',
    city_label_halo: '#f7f4ee',
    state_label: '#5a5a5a',
    state_label_halo: '#f7f4ee',
    country_label: '#3a3a3a',
    ocean_label: '#3a6a88',
    subplace_label: '#4a4a4a',
    subplace_label_halo: '#f7f4ee'
  };
}

/**
 * Streets recolor of the Protomaps light structure — same override keys as
 * disasterdbTopoFlavor, Mapbox streets-v11 read (not Outdoors).
 * Neutral land, orange/yellow/white road hierarchy, muted parks and woods.
 * Lexend stacks match the other flavors. Leftover keys (tunnels, bridges,
 * pois) stay on the stock light base.
 */
export function disasterdbStreetsFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // Land — neutral gray-beige, not Outdoors earth or the topo blue-gray
    background: '#e6e4e0',
    earth: '#f2efe9',
    // Parks and woods sit close to land; topo's saturated greens stay there
    park_a: '#e4eadc',
    park_b: '#d5e0c8',
    wood_a: '#e2e6dc',
    wood_b: '#d7dece',
    scrub_a: '#e6e4d8',
    scrub_b: '#dddcc8',
    hospital: '#f0e4e2',
    industrial: '#e4e2de',
    school: '#f3eee4',
    pedestrian: '#ebe7e0',
    glacier: '#f4f7f8',
    sand: '#efe6d2',
    beach: '#f3ead0',
    aerodrome: '#e4e2e0',
    runway: '#d0cecc',
    water: '#8fbfdc',
    zoo: '#dce6d8',
    // Khaki, quieter than topo olive so it doesn't read as landcover
    military: '#d5d2c4',
    pier: '#e4e0da',
    buildings: '#e0dcd6',
    // Roads — orange motorway, warm major, white local, gray service
    highway: '#f5a04a',
    highway_casing_early: '#c46a22',
    highway_casing_late: '#c46a22',
    major: '#ffe9a0',
    major_casing_early: '#c4b48a',
    major_casing_late: '#b7a67a',
    minor_a: '#ffffff',
    minor_b: '#ffffff',
    minor_casing: '#b0aaa2',
    minor_service: '#f0eeea',
    minor_service_casing: '#c4bfb8',
    link: '#f7c56a',
    link_casing: '#c4a060',
    other: '#e6e2dc',
    railway: '#b0a8a4',
    // White ADM intent (we still splice DisasterDB boundary-* layers)
    boundaries: 'rgba(255,255,255,0.88)',
    // Lexend stacks (only matter if PM label layers are kept; we strip them)
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(226, 230, 214, 1)',
      barren: 'rgba(236, 228, 210, 1)',
      urban_area: 'rgba(226, 224, 220, 1)',
      farmland: 'rgba(230, 232, 210, 1)',
      glacier: 'rgba(244, 247, 248, 1)',
      scrub: 'rgba(226, 226, 208, 1)',
      forest: 'rgba(214, 222, 206, 1)'
    },
    // Dark ink + light halo — readable on neutral land if PM symbols are kept
    city_label: '#2a2a2a',
    city_label_halo: '#f7f4ee',
    state_label: '#5a5a5a',
    state_label_halo: '#f7f4ee',
    country_label: '#3a3a3a',
    ocean_label: '#2f6d90',
    subplace_label: '#4a4a4a',
    subplace_label_halo: '#f7f4ee'
  };
}


/**
 * Navigation recolor of the Protomaps light structure — same override keys as
 * disasterdbTopoFlavor / disasterdbStreetsFlavor. High-contrast nav look:
 * pale ground, strong yellow/white major roads, subdued parks. Lexend stacks
 * match the other flavors. Leftover keys stay on the stock light base.
 */
export function disasterdbNavigationFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // Land — pale ground for high-contrast roads
    background: '#e4e8ec',
    earth: '#f0f2f4',
    // Parks and woods subdued — sit close to pale ground
    park_a: '#e2e8e0',
    park_b: '#d8e0d4',
    wood_a: '#e0e4dc',
    wood_b: '#d6dcd0',
    scrub_a: '#e4e4dc',
    scrub_b: '#dcddd4',
    hospital: '#ece4e4',
    industrial: '#e4e4e4',
    school: '#ece8e0',
    pedestrian: '#e8e8e4',
    glacier: '#eef2f4',
    sand: '#ece6d8',
    beach: '#f0eadc',
    aerodrome: '#e4e4e4',
    runway: '#d0d0d0',
    water: '#7ab0d0',
    zoo: '#dde4dc',
    // Quiet khaki
    military: '#d8d8cc',
    pier: '#e4e4e0',
    buildings: '#e0e0e0',
    // Roads — strong yellow motorway, white majors, clear hierarchy
    highway: '#f5d000',
    highway_casing_early: '#c4a000',
    highway_casing_late: '#c4a000',
    major: '#ffffff',
    major_casing_early: '#8a8a8a',
    major_casing_late: '#7a7a7a',
    minor_a: '#ffffff',
    minor_b: '#ffffff',
    minor_casing: '#a8a8a8',
    minor_service: '#f0f0f0',
    minor_service_casing: '#c0c0c0',
    link: '#ffe066',
    link_casing: '#c4a020',
    other: '#e8e8e8',
    railway: '#a8a8a8',
    // White ADM intent (we still splice DisasterDB boundary-* layers)
    boundaries: 'rgba(255,255,255,0.88)',
    // Lexend stacks (only matter if PM label layers are kept; we strip them)
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(224, 230, 220, 1)',
      barren: 'rgba(232, 228, 220, 1)',
      urban_area: 'rgba(224, 224, 224, 1)',
      farmland: 'rgba(228, 230, 218, 1)',
      glacier: 'rgba(238, 242, 244, 1)',
      scrub: 'rgba(226, 226, 218, 1)',
      forest: 'rgba(214, 222, 210, 1)'
    },
    // Dark ink + light halo — readable on pale ground if PM symbols are kept
    city_label: '#1a1a1a',
    city_label_halo: '#f4f4f4',
    state_label: '#4a4a4a',
    state_label_halo: '#f4f4f4',
    country_label: '#2a2a2a',
    ocean_label: '#2f6d90',
    subplace_label: '#3a3a3a',
    subplace_label_halo: '#f4f4f4'
  };
}


/**
 * Grayscale / muted gray recolor of the Protomaps light structure — same
 * override keys as disasterdbTopoFlavor / disasterdbStreetsFlavor. Readable
 * road hierarchy and Lexend labels on muted gray land. Leftover keys stay
 * on the stock light base.
 */
export function disasterdbGrayFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // Land — muted gray paper
    background: '#d4d6d8',
    earth: '#e6e6e6',
    // Parks and woods as soft gray-greens that still read grayscale-ish
    park_a: '#d8dcd8',
    park_b: '#d0d4d0',
    wood_a: '#d4d6d2',
    wood_b: '#caccc8',
    scrub_a: '#d8d8d4',
    scrub_b: '#d0d0cc',
    hospital: '#e0dcdc',
    industrial: '#dcdcdc',
    school: '#e0e0dc',
    pedestrian: '#e0e0e0',
    glacier: '#eceeef',
    sand: '#e2e0da',
    beach: '#e6e4de',
    aerodrome: '#dcdcdc',
    runway: '#c4c4c4',
    water: '#9aa8b0',
    zoo: '#d4d8d4',
    // Flat khaki-gray
    military: '#d0d0c8',
    pier: '#dcdcdc',
    buildings: '#d4d4d4',
    // Roads — light fills on gray land; darker casings for contrast
    highway: '#f0f0f0',
    highway_casing_early: '#6a6a6a',
    highway_casing_late: '#6a6a6a',
    major: '#ffffff',
    major_casing_early: '#7a7a7a',
    major_casing_late: '#707070',
    minor_a: '#f4f4f4',
    minor_b: '#f0f0f0',
    minor_casing: '#9a9a9a',
    minor_service: '#e8e8e8',
    minor_service_casing: '#b0b0b0',
    link: '#ececec',
    link_casing: '#808080',
    other: '#e0e0e0',
    railway: '#8a8a8a',
    // White ADM intent (we still splice DisasterDB boundary-* layers)
    boundaries: 'rgba(255,255,255,0.88)',
    // Lexend stacks (only matter if PM label layers are kept; we strip them)
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(212, 216, 212, 1)',
      barren: 'rgba(220, 218, 214, 1)',
      urban_area: 'rgba(210, 210, 210, 1)',
      farmland: 'rgba(214, 216, 210, 1)',
      glacier: 'rgba(236, 238, 239, 1)',
      scrub: 'rgba(214, 214, 210, 1)',
      forest: 'rgba(200, 204, 198, 1)'
    },
    // Dark ink + light halo — readable on gray land if PM symbols are kept
    city_label: '#1a1a1a',
    city_label_halo: '#ececec',
    state_label: '#4a4a4a',
    state_label_halo: '#ececec',
    country_label: '#2a2a2a',
    ocean_label: '#4a5860',
    subplace_label: '#3a3a3a',
    subplace_label_halo: '#ececec'
  };
}

/**
 * Dark recolor of disasterdbTopoFlavor — same override keys, night land.
 * Water is deeper than topo #5a9bb8. Lexend stacks match the other flavors.
 * Leftover Protomaps keys (tunnels, bridges, pois) stay on the stock dark base.
 */
export function disasterdbDarkFlavor() {
  const dark = namedFlavor('dark');
  return {
    ...dark,
    // Terrain / land — night version of the Outdoors earth and greens
    background: '#14181c',
    earth: '#232820',
    park_a: '#2c4630',
    park_b: '#243c28',
    wood_a: '#2a4030',
    wood_b: '#1e3428',
    scrub_a: '#3a4030',
    scrub_b: '#323828',
    hospital: '#3a3030',
    industrial: '#2c3034',
    school: '#343028',
    pedestrian: '#2a2e2a',
    glacier: '#3a4650',
    sand: '#3e3a2c',
    beach: '#4a4432',
    aerodrome: '#2e3234',
    runway: '#3a3e40',
    water: '#163044',
    zoo: '#2a3c34',
    // Muted olive — still distinct from park greens on dark ground
    military: '#4a4830',
    pier: '#3a3e40',
    buildings: '#2a2e32',
    // Roads — light fills so they read on dark land; casings stay darker
    highway: '#e4d4a4',
    highway_casing_early: '#6a5434',
    highway_casing_late: '#6a5434',
    major: '#d8dce2',
    major_casing_early: '#3a4048',
    major_casing_late: '#3a4048',
    minor_a: '#b4bcc6',
    minor_b: '#a8b0ba',
    minor_casing: '#32383e',
    minor_service: '#8e969e',
    minor_service_casing: '#2c3238',
    link: '#c4ccd4',
    link_casing: '#32383e',
    other: '#6e767e',
    railway: '#5a6270',
    // White ADM intent (we still splice DisasterDB boundary-* layers)
    boundaries: 'rgba(255,255,255,0.88)',
    // Lexend stacks (only matter if PM label layers are kept; we strip them)
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(48, 78, 44, 1)',
      barren: 'rgba(72, 64, 46, 1)',
      urban_area: 'rgba(48, 50, 52, 1)',
      farmland: 'rgba(62, 74, 42, 1)',
      glacier: 'rgba(70, 84, 94, 1)',
      scrub: 'rgba(64, 70, 44, 1)',
      forest: 'rgba(36, 62, 42, 1)'
    },
    // Light ink + dark halo so labels stay readable if PM symbols are kept
    city_label: '#eceae4',
    city_label_halo: '#121410',
    state_label: '#c8c6c0',
    state_label_halo: '#121410',
    country_label: '#e4e2dc',
    ocean_label: '#9ec4d6',
    subplace_label: '#d0cec8',
    subplace_label_halo: '#121410'
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
