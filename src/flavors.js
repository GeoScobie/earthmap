// ---------------------------------------------------------------------------
// DisasterDB Protomaps Flavors — used by @protomaps/basemaps layers()
//
// Own-Protomaps only (R2 v4 PMTiles). Not MapTiler / Stadia / Mapbox CDN.
// See docs/PR_DISASTERDB_TOPO.md.
// ---------------------------------------------------------------------------

import { namedFlavor } from '@protomaps/basemaps';

/**
 * Topo palette sampled from Mapbox outdoors-v11 (style JSON, not a guess).
 * Same override keys as disasterdbStreetsFlavor, plus tunnel/bridge keys that
 * Protomaps paints. Flat colors are the outdoors-v11 stop on screen when that
 * class reads (motorway fill at z>=9, land at z<=11). Outdoors keeps wood/
 * grass/scrub landuse fills (unlike streets, where landcover fades by z7).
 * Motorway is the softer outdoors orange (67% sat), not streets' 100% sat.
 * Lexend stacks stay; label layout is outdoorsV11Labels in style.js.
 * Prod cartographic flavor when ?basemap=disasterdb-topo; default basemapId
 * stays satellite.
 */
export function disasterdbTopoFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // land background: hsl(35, 32%, 91%) through z11; z13 drifts to hsl(35, 12%, 89%)
    background: 'hsl(35, 32%, 91%)',
    earth: 'hsl(35, 32%, 91%)',
    // landuse park / national-park: hsl(100, 58%, 76%). park_a unused by layers().
    park_a: 'hsl(100, 58%, 76%)',
    park_b: 'hsl(100, 58%, 76%)',
    // outdoors landuse wood/grass/scrub: hsl(75, 41%, 74%). wood_a unused;
    // wood_b is kind=wood inside landuse_park.
    wood_a: 'hsl(75, 41%, 74%)',
    wood_b: 'hsl(75, 41%, 74%)',
    scrub_a: 'hsl(75, 41%, 74%)',
    scrub_b: 'hsl(75, 41%, 74%)',
    hospital: 'hsl(340, 37%, 87%)',
    // industrial is not an outdoors landuse class — sit on land
    industrial: 'hsl(35, 32%, 91%)',
    school: 'hsl(50, 47%, 81%)',
    // road-pedestrian-polygon-fill at z16
    pedestrian: 'hsl(230, 16%, 94%)',
    glacier: 'hsl(196, 72%, 93%)',
    sand: 'hsl(60, 46%, 87%)',
    beach: 'hsl(60, 46%, 87%)',
    // aeroway-polygon at z15 / landuse airport
    aerodrome: 'hsl(230, 23%, 82%)',
    runway: 'hsl(230, 23%, 82%)',
    // water fill. waterway lines are hsl(205, 87%, 76%) — one Protomaps water key.
    water: 'hsl(196, 80%, 70%)',
    // landuse_park paints military/naval_base/airfield with `zoo` (not military)
    zoo: 'hsl(35, 32%, 91%)',
    military: 'hsl(35, 32%, 91%)',
    pier: 'hsl(35, 32%, 91%)',
    // building fill at z15
    buildings: 'hsl(35, 11%, 86%)',
    // road-motorway-trunk fill at z>=9 is hsl(26, 67%, 70%). Trunk is
    // hsl(46, 69%, 68%) but Protomaps kind=highway is both, so motorway wins.
    // Casing is white (gap outline). Softened vs streets' hsl(26, 100%, 68%).
    highway: 'hsl(26, 67%, 70%)',
    highway_casing_early: 'hsl(0, 0%, 100%)',
    highway_casing_late: 'hsl(0, 0%, 100%)',
    // road-primary / secondary / tertiary fills are white; case hsl(230, 24%, 87%)
    major: 'hsl(0, 0%, 100%)',
    major_casing_early: 'hsl(230, 24%, 87%)',
    major_casing_late: 'hsl(230, 24%, 87%)',
    minor_a: 'hsl(0, 0%, 100%)',
    minor_b: 'hsl(0, 0%, 100%)',
    minor_casing: 'hsl(230, 24%, 87%)',
    minor_service: 'hsl(0, 0%, 100%)',
    minor_service_casing: 'hsl(230, 24%, 87%)',
    // motorway_link matches motorway; trunk_link yellow cannot split.
    // roads_link_casing paints from minor_casing on this protomaps build.
    link: 'hsl(26, 67%, 70%)',
    link_casing: 'hsl(0, 0%, 100%)',
    other: 'hsl(0, 0%, 100%)',
    // road-rail at z13
    railway: 'hsl(50, 17%, 82%)',
    // admin-0-boundary. Spliced boundary layers use outdoorsV11Labels.
    boundaries: 'hsl(230, 8%, 51%)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    // tunnels: lighter than surface. outdoors motorway tunnel hsl(26, 74%, 81%).
    tunnel_highway: 'hsl(26, 74%, 81%)',
    tunnel_highway_casing: 'hsl(0, 0%, 100%)',
    tunnel_major: 'hsl(0, 0%, 100%)',
    tunnel_major_casing: 'hsl(230, 19%, 75%)',
    tunnel_minor: 'hsl(0, 0%, 100%)',
    tunnel_minor_casing: 'hsl(230, 19%, 75%)',
    tunnel_link: 'hsl(26, 74%, 81%)',
    tunnel_link_casing: 'hsl(0, 0%, 100%)',
    tunnel_other: 'hsl(0, 0%, 100%)',
    tunnel_other_casing: 'hsl(230, 19%, 75%)',
    // bridges match the surface roads
    bridges_highway: 'hsl(26, 67%, 70%)',
    bridges_highway_casing: 'hsl(0, 0%, 100%)',
    bridges_major: 'hsl(0, 0%, 100%)',
    bridges_major_casing: 'hsl(230, 24%, 87%)',
    bridges_minor: 'hsl(0, 0%, 100%)',
    bridges_minor_casing: 'hsl(230, 24%, 87%)',
    bridges_link: 'hsl(26, 67%, 70%)',
    bridges_link_casing: 'hsl(0, 0%, 100%)',
    bridges_other: 'hsl(0, 0%, 100%)',
    bridges_other_casing: 'hsl(230, 24%, 87%)',
    landcover: {
      // outdoors landcover (persists to z12): grass/scrub/wood hsl(75, 62%, 81%)
      grassland: 'hsl(75, 62%, 81%)',
      barren: 'hsl(60, 46%, 87%)',
      urban_area: 'hsl(35, 32%, 91%)',
      // agriculture landuse hsl(75, 37%, 81%)
      farmland: 'hsl(75, 37%, 81%)',
      glacier: 'hsl(196, 72%, 93%)',
      scrub: 'hsl(75, 62%, 81%)',
      forest: 'hsl(75, 62%, 81%)'
    },
    // PM symbols stripped; mirror outdoors-v11 if a label layer is kept.
    city_label: 'hsl(0, 0%, 0%)',
    city_label_halo: 'hsl(0, 0%, 100%)',
    state_label: 'hsl(0, 0%, 0%)',
    state_label_halo: 'hsl(0, 0%, 100%)',
    country_label: 'hsl(0, 0%, 0%)',
    ocean_label: 'hsl(205, 84%, 88%)',
    subplace_label: 'hsl(230, 29%, 35%)',
    subplace_label_halo: 'hsl(0, 0%, 100%)',
    roads_label_major: 'hsl(0, 0%, 0%)',
    roads_label_major_halo: 'hsl(0, 0%, 100%)',
    roads_label_minor: 'hsl(0, 0%, 0%)',
    roads_label_minor_halo: 'hsl(0, 0%, 100%)'
  };
}

/**
 * Light palette sampled from Mapbox light-v10. Quiet gray land, pale water,
 * white roads with a faint green-gray casing — not the previous paper/blue
 * sheet. Tunnel/bridge keys are set because Protomaps paints them.
 * Lexend stacks stay; label layout is lightV10Labels in style.js.
 * Not the prod default.
 */
export function disasterdbLightFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // land background
    background: 'hsl(55, 11%, 96%)',
    earth: 'hsl(55, 11%, 96%)',
    // landuse + national-park are one fill. landcover (low zoom) is separate.
    park_a: 'hsl(150, 6%, 93%)',
    park_b: 'hsl(150, 6%, 93%)',
    wood_a: 'hsl(150, 6%, 93%)',
    wood_b: 'hsl(150, 6%, 93%)',
    scrub_a: 'hsl(150, 6%, 93%)',
    scrub_b: 'hsl(150, 6%, 93%)',
    hospital: 'hsl(150, 6%, 93%)',
    industrial: 'hsl(150, 6%, 93%)',
    school: 'hsl(150, 6%, 93%)',
    pedestrian: 'hsl(150, 6%, 93%)',
    glacier: 'hsl(150, 6%, 93%)',
    sand: 'hsl(150, 6%, 93%)',
    beach: 'hsl(150, 6%, 93%)',
    aerodrome: 'hsl(0, 0%, 97%)',
    runway: 'hsl(0, 0%, 97%)',
    // water fill. waterway lines are hsl(187, 9%, 81%) — one Protomaps key.
    water: 'hsl(185, 9%, 81%)',
    zoo: 'hsl(150, 6%, 93%)',
    military: 'hsl(150, 6%, 93%)',
    pier: 'hsl(55, 11%, 96%)',
    buildings: 'hsl(55, 5%, 91%)',
    // every surface road class is white; casing hsl(156, 12%, 92%)
    highway: 'hsl(0, 0%, 100%)',
    highway_casing_early: 'hsl(156, 12%, 92%)',
    highway_casing_late: 'hsl(156, 12%, 92%)',
    major: 'hsl(0, 0%, 100%)',
    major_casing_early: 'hsl(156, 12%, 92%)',
    major_casing_late: 'hsl(156, 12%, 92%)',
    minor_a: 'hsl(0, 0%, 100%)',
    minor_b: 'hsl(0, 0%, 100%)',
    minor_casing: 'hsl(156, 12%, 92%)',
    minor_service: 'hsl(0, 0%, 100%)',
    minor_service_casing: 'hsl(156, 12%, 92%)',
    link: 'hsl(0, 0%, 100%)',
    link_casing: 'hsl(156, 12%, 92%)',
    other: 'hsl(0, 0%, 100%)',
    railway: 'hsl(156, 12%, 92%)',
    boundaries: 'hsl(0, 0%, 62%)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    tunnel_highway: 'hsl(187, 7%, 88%)',
    tunnel_highway_casing: 'hsl(185, 12%, 89%)',
    tunnel_major: 'hsl(187, 7%, 88%)',
    tunnel_major_casing: 'hsl(185, 12%, 89%)',
    tunnel_minor: 'hsl(187, 7%, 88%)',
    tunnel_minor_casing: 'hsl(185, 12%, 89%)',
    tunnel_link: 'hsl(187, 7%, 88%)',
    tunnel_link_casing: 'hsl(185, 12%, 89%)',
    tunnel_other: 'hsl(187, 7%, 88%)',
    tunnel_other_casing: 'hsl(185, 12%, 89%)',
    bridges_highway: 'hsl(0, 0%, 100%)',
    bridges_highway_casing: 'hsl(156, 12%, 92%)',
    bridges_major: 'hsl(0, 0%, 100%)',
    bridges_major_casing: 'hsl(156, 12%, 92%)',
    bridges_minor: 'hsl(0, 0%, 100%)',
    bridges_minor_casing: 'hsl(156, 12%, 92%)',
    bridges_link: 'hsl(0, 0%, 100%)',
    bridges_link_casing: 'hsl(156, 12%, 92%)',
    bridges_other: 'hsl(0, 0%, 100%)',
    bridges_other_casing: 'hsl(156, 12%, 92%)',
    landcover: {
      grassland: 'hsl(0, 0%, 89%)',
      barren: 'hsl(0, 0%, 89%)',
      urban_area: 'hsl(0, 0%, 89%)',
      farmland: 'hsl(0, 0%, 89%)',
      glacier: 'hsl(0, 0%, 89%)',
      scrub: 'hsl(0, 0%, 89%)',
      forest: 'hsl(0, 0%, 89%)'
    },
    city_label: 'hsl(0, 0%, 42%)',
    city_label_halo: 'hsl(0, 0%, 100%)',
    state_label: 'hsl(0, 0%, 66%)',
    state_label_halo: 'hsl(0, 0%, 100%)',
    country_label: 'hsl(0, 0%, 42%)',
    ocean_label: 'hsl(187, 7%, 51%)',
    subplace_label: 'hsl(0, 0%, 62%)',
    subplace_label_halo: 'hsl(0, 0%, 100%)',
    roads_label_major: 'hsl(0, 0%, 42%)',
    roads_label_major_halo: 'hsl(0, 0%, 100%)',
    roads_label_minor: 'hsl(0, 0%, 42%)',
    roads_label_minor_halo: 'hsl(0, 0%, 100%)'
  };
}

/**
 * Streets palette sampled from Mapbox streets-v11 (style JSON, not a guess).
 * Same override keys as disasterdbTopoFlavor, plus tunnel/bridge keys that
 * Protomaps actually paints — otherwise tunnels stay the stock light gray.
 * Flat colors are the streets-v11 stop that is on screen when that class
 * reads (motorway fill at z>=9, land at z<=11). Lexend stacks stay; PM
 * symbols are stripped and real label layout lives in style.js.
 * Not the prod default.
 */
export function disasterdbStreetsFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // land background: hsl(35, 32%, 91%) through z11; z13 drifts to hsl(35, 12%, 89%)
    background: 'hsl(35, 32%, 91%)',
    earth: 'hsl(35, 32%, 91%)',
    // landuse park / national-park: hsl(100, 58%, 76%). park_a is unused by layers().
    park_a: 'hsl(100, 58%, 76%)',
    park_b: 'hsl(100, 58%, 76%)',
    // streets-v11 landcover (wood/grass) fades out by z7 — no high-zoom wood fill.
    // wood_a is unused; wood_b is kind=wood inside landuse_park, so keep it on land.
    wood_a: 'hsl(35, 32%, 91%)',
    wood_b: 'hsl(35, 32%, 91%)',
    scrub_a: 'hsl(75, 62%, 81%)',
    scrub_b: 'hsl(75, 62%, 81%)',
    hospital: 'hsl(340, 37%, 87%)',
    // industrial is not a streets-v11 landuse class — sit on land, don't invent a tint
    industrial: 'hsl(35, 32%, 91%)',
    school: 'hsl(50, 47%, 81%)',
    // road-pedestrian-polygon-fill at z16
    pedestrian: 'hsl(230, 16%, 94%)',
    glacier: 'hsl(196, 72%, 93%)',
    sand: 'hsl(60, 46%, 87%)',
    beach: 'hsl(60, 46%, 87%)',
    // aeroway-polygon at z15
    aerodrome: 'hsl(230, 23%, 82%)',
    runway: 'hsl(230, 23%, 82%)',
    // water fill. waterway lines are hsl(205, 87%, 76%) — one Protomaps water key.
    water: 'hsl(196, 80%, 70%)',
    // landuse_park paints military/naval_base/airfield with `zoo` (not military)
    zoo: 'hsl(35, 32%, 91%)',
    military: 'hsl(35, 32%, 91%)',
    pier: 'hsl(35, 32%, 91%)',
    // building fill at z15. Outline hsl(35, 6%, 79%) is not a flavor key; layer opacity stays 0.5.
    buildings: 'hsl(35, 11%, 86%)',
    // road-motorway-trunk fill at z>=9 is hsl(26, 100%, 68%). Trunk is
    // hsl(46, 85%, 67%) but Protomaps kind=highway is both, so motorway wins.
    // Casing is white (gap outline), not a dark orange edge.
    highway: 'hsl(26, 100%, 68%)',
    highway_casing_early: 'hsl(0, 0%, 100%)',
    highway_casing_late: 'hsl(0, 0%, 100%)',
    // road-primary / secondary / tertiary fills are white; case hsl(230, 24%, 87%)
    major: 'hsl(0, 0%, 100%)',
    major_casing_early: 'hsl(230, 24%, 87%)',
    major_casing_late: 'hsl(230, 24%, 87%)',
    minor_a: 'hsl(0, 0%, 100%)',
    minor_b: 'hsl(0, 0%, 100%)',
    minor_casing: 'hsl(230, 24%, 87%)',
    // service is white in streets-v11, same case. street_limited hsl(35, 14%, 93%) cannot split.
    minor_service: 'hsl(0, 0%, 100%)',
    minor_service_casing: 'hsl(230, 24%, 87%)',
    // motorway_link matches motorway; trunk_link yellow cannot split.
    // This protomaps build paints roads_link_casing from minor_casing, not
    // link_casing, so link edges follow the street case (hsl(230, 24%, 87%)).
    link: 'hsl(26, 100%, 68%)',
    link_casing: 'hsl(0, 0%, 100%)',
    // road-path / road-pedestrian fill
    other: 'hsl(0, 0%, 100%)',
    // road-rail at z13 (hsl(50, 17%, 82%)); z16 cools to hsl(230, 10%, 74%)
    railway: 'hsl(50, 17%, 82%)',
    // admin-0-boundary. Our spliced boundary layers use streetsV11Labels instead.
    boundaries: 'hsl(230, 8%, 51%)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    // tunnels: lighter than surface. Case for non-motorway is hsl(230, 19%, 75%).
    tunnel_highway: 'hsl(26, 100%, 78%)',
    tunnel_highway_casing: 'hsl(0, 0%, 100%)',
    tunnel_major: 'hsl(0, 0%, 100%)',
    tunnel_major_casing: 'hsl(230, 19%, 75%)',
    tunnel_minor: 'hsl(0, 0%, 100%)',
    tunnel_minor_casing: 'hsl(230, 19%, 75%)',
    tunnel_link: 'hsl(26, 100%, 78%)',
    tunnel_link_casing: 'hsl(0, 0%, 100%)',
    tunnel_other: 'hsl(0, 0%, 100%)',
    tunnel_other_casing: 'hsl(230, 19%, 75%)',
    // bridges match the surface roads
    bridges_highway: 'hsl(26, 100%, 68%)',
    bridges_highway_casing: 'hsl(0, 0%, 100%)',
    bridges_major: 'hsl(0, 0%, 100%)',
    bridges_major_casing: 'hsl(230, 24%, 87%)',
    bridges_minor: 'hsl(0, 0%, 100%)',
    bridges_minor_casing: 'hsl(230, 24%, 87%)',
    bridges_link: 'hsl(26, 100%, 68%)',
    bridges_link_casing: 'hsl(0, 0%, 100%)',
    bridges_other: 'hsl(0, 0%, 100%)',
    bridges_other_casing: 'hsl(230, 24%, 87%)',
    landcover: {
      grassland: 'hsl(75, 62%, 81%)',
      barren: 'hsl(60, 46%, 87%)',
      urban_area: 'hsl(35, 32%, 91%)',
      farmland: 'hsl(75, 62%, 81%)',
      glacier: 'hsl(196, 72%, 93%)',
      scrub: 'hsl(75, 62%, 81%)',
      forest: 'hsl(75, 62%, 81%)'
    },
    // PM symbols are stripped; these mirror streets-v11 if a label layer is kept.
    city_label: 'hsl(0, 0%, 0%)',
    city_label_halo: 'hsl(0, 0%, 100%)',
    state_label: 'hsl(0, 0%, 0%)',
    state_label_halo: 'hsl(0, 0%, 100%)',
    country_label: 'hsl(0, 0%, 0%)',
    ocean_label: 'hsl(205, 84%, 88%)',
    subplace_label: 'hsl(230, 29%, 35%)',
    subplace_label_halo: 'hsl(0, 0%, 100%)',
    roads_label_major: 'hsl(0, 0%, 0%)',
    roads_label_major_halo: 'hsl(0, 0%, 100%)',
    roads_label_minor: 'hsl(0, 0%, 0%)',
    roads_label_minor_halo: 'hsl(0, 0%, 100%)'
  };
}


/**
 * Navigation palette sampled from FireMap's Mapbox style
 * disasterdb/cm17bo79203s201r722er0wsz (origin navigation-night-v1).
 * Dark blue-gray land, muted water, bluish motorway, dark street fills with
 * lighter casings. Uses the Protomaps dark base so tunnels/bridges/pois
 * inherit night structure. Lexend stacks stay; label layout is
 * navigationNightLabels in style.js. Not the prod default.
 */
export function disasterdbNavigationFlavor() {
  const dark = namedFlavor('dark');
  return {
    ...dark,
    // land at z11 (street-reading stop). z9 is hsl(215, 15%, 40%).
    background: 'hsl(215, 13%, 27%)',
    earth: 'hsl(215, 13%, 27%)',
    // national-park / park landuse
    park_a: 'hsl(170, 18%, 30%)',
    park_b: 'hsl(170, 18%, 30%)',
    // wood landcover/landuse
    wood_a: 'hsl(175, 13%, 28%)',
    wood_b: 'hsl(175, 13%, 28%)',
    scrub_a: 'hsl(170, 10%, 29%)',
    scrub_b: 'hsl(170, 10%, 29%)',
    hospital: 'hsl(250, 10%, 35%)',
    industrial: 'hsl(230, 12%, 28%)',
    school: 'hsl(200, 10%, 30%)',
    pedestrian: 'hsl(215, 13%, 27%)',
    glacier: 'hsl(197, 0%, 68%)',
    sand: 'hsl(213, 23%, 33%)',
    beach: 'hsl(213, 23%, 33%)',
    aerodrome: 'hsl(230, 17%, 36%)',
    runway: 'hsl(230, 17%, 36%)',
    // water + waterway share this hue in the FireMap nav style
    water: 'hsl(197, 15%, 43%)',
    zoo: 'hsl(170, 18%, 30%)',
    military: 'hsl(215, 13%, 27%)',
    pier: 'hsl(215, 13%, 27%)',
    buildings: 'hsl(215, 10%, 24%)',
    // motorway fill hsl(215, 28%, 48%); trunk hsl(221, 20%, 44%) cannot split.
    // Casing is darker than the fill (night nav), not white.
    highway: 'hsl(215, 28%, 48%)',
    highway_casing_early: 'hsl(215, 18%, 28%)',
    highway_casing_late: 'hsl(215, 18%, 28%)',
    // primary / secondary / street fills are near-black; case is lighter
    major: 'hsl(213, 9%, 19%)',
    major_casing_early: 'hsl(217, 11%, 32%)',
    major_casing_late: 'hsl(217, 11%, 32%)',
    minor_a: 'hsl(213, 9%, 19%)',
    minor_b: 'hsl(213, 9%, 19%)',
    minor_casing: 'hsl(217, 11%, 32%)',
    minor_service: 'hsl(213, 9%, 19%)',
    minor_service_casing: 'hsl(217, 11%, 32%)',
    link: 'hsl(215, 28%, 48%)',
    link_casing: 'hsl(215, 18%, 28%)',
    other: 'hsl(213, 9%, 19%)',
    railway: 'hsl(230, 20%, 23%)',
    boundaries: 'hsl(250, 10%, 65%)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    tunnel_highway: 'hsl(215, 21%, 50%)',
    tunnel_highway_casing: 'hsl(215, 18%, 28%)',
    tunnel_major: 'hsl(213, 9%, 19%)',
    tunnel_major_casing: 'hsl(217, 11%, 32%)',
    tunnel_minor: 'hsl(213, 9%, 19%)',
    tunnel_minor_casing: 'hsl(217, 11%, 32%)',
    tunnel_link: 'hsl(215, 21%, 50%)',
    tunnel_link_casing: 'hsl(215, 18%, 28%)',
    tunnel_other: 'hsl(213, 9%, 19%)',
    tunnel_other_casing: 'hsl(217, 11%, 32%)',
    bridges_highway: 'hsl(215, 28%, 48%)',
    bridges_highway_casing: 'hsl(215, 18%, 28%)',
    bridges_major: 'hsl(213, 9%, 19%)',
    bridges_major_casing: 'hsl(217, 11%, 32%)',
    bridges_minor: 'hsl(213, 9%, 19%)',
    bridges_minor_casing: 'hsl(217, 11%, 32%)',
    bridges_link: 'hsl(215, 28%, 48%)',
    bridges_link_casing: 'hsl(215, 18%, 28%)',
    bridges_other: 'hsl(213, 9%, 19%)',
    bridges_other_casing: 'hsl(217, 11%, 32%)',
    landcover: {
      grassland: 'hsl(170, 13%, 33%)',
      barren: 'hsl(213, 23%, 33%)',
      urban_area: 'hsl(215, 3%, 23%)',
      farmland: 'hsl(170, 13%, 33%)',
      glacier: 'hsl(197, 0%, 68%)',
      scrub: 'hsl(170, 10%, 29%)',
      forest: 'hsl(175, 13%, 28%)'
    },
    city_label: 'hsl(215, 30%, 75%)',
    city_label_halo: 'hsl(215, 20%, 25%)',
    state_label: 'hsl(215, 30%, 75%)',
    state_label_halo: 'hsl(215, 20%, 25%)',
    country_label: 'hsl(215, 30%, 75%)',
    ocean_label: 'hsl(197, 11%, 63%)',
    subplace_label: 'hsl(215, 30%, 85%)',
    subplace_label_halo: 'hsla(215, 20%, 25%, 0.75)',
    roads_label_major: 'hsl(0, 0%, 90%)',
    roads_label_major_halo: 'hsl(213, 9%, 19%)',
    roads_label_minor: 'hsl(0, 0%, 90%)',
    roads_label_minor_halo: 'hsl(213, 9%, 19%)'
  };
}

/**
 * Gray palette: muted grayscale reading of Mapbox light-v10.
 * Same structure and lightness stops as disasterdbLightFlavor (#125), with
 * saturation forced to 0 so land/water/roads/parks read as gray rather than
 * the light-v10 green-gray tint. Tunnel/bridge keys included. Lexend stacks
 * stay; label layout is grayLightV10Labels (light-v10 ramps, gray ink).
 * Not the prod default.
 */
export function disasterdbGrayFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    // light-v10 land hsl(55, 11%, 96%) → gray
    background: 'hsl(0, 0%, 96%)',
    earth: 'hsl(0, 0%, 96%)',
    // light-v10 landuse/park hsl(150, 6%, 93%) → gray
    park_a: 'hsl(0, 0%, 93%)',
    park_b: 'hsl(0, 0%, 93%)',
    wood_a: 'hsl(0, 0%, 93%)',
    wood_b: 'hsl(0, 0%, 93%)',
    scrub_a: 'hsl(0, 0%, 93%)',
    scrub_b: 'hsl(0, 0%, 93%)',
    hospital: 'hsl(0, 0%, 93%)',
    industrial: 'hsl(0, 0%, 93%)',
    school: 'hsl(0, 0%, 93%)',
    pedestrian: 'hsl(0, 0%, 93%)',
    glacier: 'hsl(0, 0%, 93%)',
    sand: 'hsl(0, 0%, 93%)',
    beach: 'hsl(0, 0%, 93%)',
    aerodrome: 'hsl(0, 0%, 97%)',
    runway: 'hsl(0, 0%, 97%)',
    // light-v10 water hsl(185, 9%, 81%) → gray
    water: 'hsl(0, 0%, 81%)',
    zoo: 'hsl(0, 0%, 93%)',
    military: 'hsl(0, 0%, 93%)',
    pier: 'hsl(0, 0%, 96%)',
    buildings: 'hsl(0, 0%, 91%)',
    // white roads; casing was hsl(156, 12%, 92%) → gray
    highway: 'hsl(0, 0%, 100%)',
    highway_casing_early: 'hsl(0, 0%, 92%)',
    highway_casing_late: 'hsl(0, 0%, 92%)',
    major: 'hsl(0, 0%, 100%)',
    major_casing_early: 'hsl(0, 0%, 92%)',
    major_casing_late: 'hsl(0, 0%, 92%)',
    minor_a: 'hsl(0, 0%, 100%)',
    minor_b: 'hsl(0, 0%, 100%)',
    minor_casing: 'hsl(0, 0%, 92%)',
    minor_service: 'hsl(0, 0%, 100%)',
    minor_service_casing: 'hsl(0, 0%, 92%)',
    link: 'hsl(0, 0%, 100%)',
    link_casing: 'hsl(0, 0%, 92%)',
    other: 'hsl(0, 0%, 100%)',
    railway: 'hsl(0, 0%, 92%)',
    boundaries: 'hsl(0, 0%, 62%)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    // tunnels: light-v10 hsl(187, 7%, 88%) / case hsl(185, 12%, 89%)
    tunnel_highway: 'hsl(0, 0%, 88%)',
    tunnel_highway_casing: 'hsl(0, 0%, 89%)',
    tunnel_major: 'hsl(0, 0%, 88%)',
    tunnel_major_casing: 'hsl(0, 0%, 89%)',
    tunnel_minor: 'hsl(0, 0%, 88%)',
    tunnel_minor_casing: 'hsl(0, 0%, 89%)',
    tunnel_link: 'hsl(0, 0%, 88%)',
    tunnel_link_casing: 'hsl(0, 0%, 89%)',
    tunnel_other: 'hsl(0, 0%, 88%)',
    tunnel_other_casing: 'hsl(0, 0%, 89%)',
    bridges_highway: 'hsl(0, 0%, 100%)',
    bridges_highway_casing: 'hsl(0, 0%, 92%)',
    bridges_major: 'hsl(0, 0%, 100%)',
    bridges_major_casing: 'hsl(0, 0%, 92%)',
    bridges_minor: 'hsl(0, 0%, 100%)',
    bridges_minor_casing: 'hsl(0, 0%, 92%)',
    bridges_link: 'hsl(0, 0%, 100%)',
    bridges_link_casing: 'hsl(0, 0%, 92%)',
    bridges_other: 'hsl(0, 0%, 100%)',
    bridges_other_casing: 'hsl(0, 0%, 92%)',
    landcover: {
      grassland: 'hsl(0, 0%, 89%)',
      barren: 'hsl(0, 0%, 89%)',
      urban_area: 'hsl(0, 0%, 89%)',
      farmland: 'hsl(0, 0%, 89%)',
      glacier: 'hsl(0, 0%, 89%)',
      scrub: 'hsl(0, 0%, 89%)',
      forest: 'hsl(0, 0%, 89%)'
    },
    city_label: 'hsl(0, 0%, 42%)',
    city_label_halo: 'hsl(0, 0%, 100%)',
    state_label: 'hsl(0, 0%, 66%)',
    state_label_halo: 'hsl(0, 0%, 100%)',
    country_label: 'hsl(0, 0%, 42%)',
    // water label was hsl(187, 7%, 51%) → gray
    ocean_label: 'hsl(0, 0%, 51%)',
    subplace_label: 'hsl(0, 0%, 62%)',
    subplace_label_halo: 'hsl(0, 0%, 100%)',
    roads_label_major: 'hsl(0, 0%, 42%)',
    roads_label_major_halo: 'hsl(0, 0%, 100%)',
    roads_label_minor: 'hsl(0, 0%, 42%)',
    roads_label_minor_halo: 'hsl(0, 0%, 100%)'
  };
}

/**
 * Dark palette sampled from Mapbox dark-v10. Land, water, and roads are
 * near-neutral grays — not the old Outdoors-night greens. Tunnel/bridge
 * keys are set because Protomaps paints them. Lexend stacks stay; label
 * layout for this basemap is in style.js (darkV10Labels).
 * Not the prod default.
 */
export function disasterdbDarkFlavor() {
  const dark = namedFlavor('dark');
  return {
    ...dark,
    // land background + landcover (landcover fades by z7)
    background: 'hsl(55, 1%, 20%)',
    earth: 'hsl(55, 1%, 20%)',
    // landuse + national-park are one flat fill, barely greener than land
    park_a: 'hsl(132, 2%, 20%)',
    park_b: 'hsl(132, 2%, 20%)',
    wood_a: 'hsl(132, 2%, 20%)',
    wood_b: 'hsl(132, 2%, 20%)',
    scrub_a: 'hsl(132, 2%, 20%)',
    scrub_b: 'hsl(132, 2%, 20%)',
    hospital: 'hsl(132, 2%, 20%)',
    industrial: 'hsl(132, 2%, 20%)',
    school: 'hsl(132, 2%, 20%)',
    pedestrian: 'hsl(132, 2%, 20%)',
    glacier: 'hsl(132, 2%, 20%)',
    sand: 'hsl(132, 2%, 20%)',
    beach: 'hsl(132, 2%, 20%)',
    // aeroway-polygon / aeroway-line
    aerodrome: 'hsl(0, 0%, 27%)',
    runway: 'hsl(0, 0%, 27%)',
    // water fill and waterway share this in dark-v10
    water: 'hsl(185, 2%, 10%)',
    // landuse_park military/airfield slot — dark-v10 does not tint them
    zoo: 'hsl(132, 2%, 20%)',
    military: 'hsl(132, 2%, 20%)',
    pier: 'hsl(55, 1%, 20%)',
    // building fill. Opacity ramp is in the layer, not the flavor.
    buildings: 'hsl(55, 1%, 17%)',
    // Every surface road class is hsl(0, 0%, 27%) with casing hsl(0, 0%, 17%).
    // Motorway is not a separate hue in dark-v10.
    highway: 'hsl(0, 0%, 27%)',
    highway_casing_early: 'hsl(0, 0%, 17%)',
    highway_casing_late: 'hsl(0, 0%, 17%)',
    major: 'hsl(0, 0%, 27%)',
    major_casing_early: 'hsl(0, 0%, 17%)',
    major_casing_late: 'hsl(0, 0%, 17%)',
    minor_a: 'hsl(0, 0%, 27%)',
    minor_b: 'hsl(0, 0%, 27%)',
    minor_casing: 'hsl(0, 0%, 17%)',
    minor_service: 'hsl(0, 0%, 27%)',
    minor_service_casing: 'hsl(0, 0%, 17%)',
    link: 'hsl(0, 0%, 27%)',
    // unused by this protomaps build (link casing follows minor_casing)
    link_casing: 'hsl(0, 0%, 17%)',
    other: 'hsl(0, 0%, 27%)',
    railway: 'hsl(0, 0%, 17%)',
    boundaries: 'hsl(0, 0%, 43%)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    tunnel_highway: 'hsl(185, 2%, 15%)',
    tunnel_highway_casing: 'hsl(185, 2%, 29%)',
    tunnel_major: 'hsl(185, 2%, 15%)',
    tunnel_major_casing: 'hsl(185, 2%, 29%)',
    tunnel_minor: 'hsl(185, 2%, 15%)',
    tunnel_minor_casing: 'hsl(185, 2%, 29%)',
    tunnel_link: 'hsl(185, 2%, 15%)',
    tunnel_link_casing: 'hsl(185, 2%, 29%)',
    tunnel_other: 'hsl(185, 2%, 15%)',
    tunnel_other_casing: 'hsl(185, 2%, 29%)',
    bridges_highway: 'hsl(0, 0%, 27%)',
    bridges_highway_casing: 'hsl(0, 0%, 17%)',
    bridges_major: 'hsl(0, 0%, 27%)',
    bridges_major_casing: 'hsl(0, 0%, 17%)',
    bridges_minor: 'hsl(0, 0%, 27%)',
    bridges_minor_casing: 'hsl(0, 0%, 17%)',
    bridges_link: 'hsl(0, 0%, 27%)',
    bridges_link_casing: 'hsl(0, 0%, 17%)',
    bridges_other: 'hsl(0, 0%, 27%)',
    bridges_other_casing: 'hsl(0, 0%, 17%)',
    landcover: {
      grassland: 'hsl(55, 1%, 20%)',
      barren: 'hsl(55, 1%, 20%)',
      urban_area: 'hsl(55, 1%, 20%)',
      farmland: 'hsl(55, 1%, 20%)',
      glacier: 'hsl(55, 1%, 20%)',
      scrub: 'hsl(55, 1%, 20%)',
      forest: 'hsl(55, 1%, 20%)'
    },
    city_label: 'hsl(0, 0%, 90%)',
    city_label_halo: 'hsla(0, 0%, 10%, 0.75)',
    state_label: 'hsl(0, 0%, 50%)',
    state_label_halo: 'hsla(0, 0%, 10%, 0.75)',
    country_label: 'hsl(0, 0%, 45%)',
    ocean_label: 'hsl(0, 0%, 45%)',
    subplace_label: 'hsl(0, 0%, 70%)',
    subplace_label_halo: 'hsla(0, 0%, 10%, 0.75)',
    roads_label_major: 'hsl(0, 0%, 78%)',
    roads_label_major_halo: 'hsl(0, 0%, 13%)',
    roads_label_minor: 'hsl(0, 0%, 78%)',
    roads_label_minor_halo: 'hsl(0, 0%, 13%)'
  };
}

/**
 * Night navigation recolor — same override keys as disasterdbTopoFlavor /
 * disasterdbStreetsFlavor, on the stock dark base (tunnels, bridges, pois).
 * Near-black ground, bright yellow/white major roads, dim parks. Lexend
 * stacks match the other flavors; light ink + dark halo so labels stay
 * readable. Not the prod default.
 */
export function disasterdbNightNavFlavor() {
  const dark = namedFlavor('dark');
  return {
    ...dark,
    // Land — near-black ground (neutral, not the dark flavor's green night earth)
    background: '#0c0e12',
    earth: '#14161a',
    // Parks and woods dim — barely lifted from the ground
    park_a: '#1a1e1a',
    park_b: '#161a16',
    wood_a: '#181c18',
    wood_b: '#141814',
    scrub_a: '#1c1c18',
    scrub_b: '#181814',
    hospital: '#241c1c',
    industrial: '#1c1e22',
    school: '#201e1a',
    pedestrian: '#1a1c1c',
    glacier: '#1e262c',
    sand: '#242018',
    beach: '#2a261c',
    aerodrome: '#1c1e20',
    runway: '#2a2c30',
    water: '#101820',
    zoo: '#181e1c',
    // Dim olive
    military: '#242418',
    pier: '#2a2c30',
    buildings: '#1c1e22',
    // Roads — bright yellow motorway, white majors, readable on near-black
    highway: '#ffe14a',
    highway_casing_early: '#8a6800',
    highway_casing_late: '#8a6800',
    major: '#ffffff',
    major_casing_early: '#5c6068',
    major_casing_late: '#4e525a',
    minor_a: '#d8dce2',
    minor_b: '#c8ced6',
    minor_casing: '#3a3e44',
    minor_service: '#9aa2aa',
    minor_service_casing: '#2e3238',
    link: '#ffe98a',
    link_casing: '#7a6200',
    other: '#6a7078',
    railway: '#5a6270',
    // White ADM intent (we still splice DisasterDB boundary-* layers)
    boundaries: 'rgba(255,255,255,0.88)',
    // Lexend stacks (only matter if PM label layers are kept; we strip them)
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(32, 40, 32, 1)',
      barren: 'rgba(40, 36, 28, 1)',
      urban_area: 'rgba(28, 30, 34, 1)',
      farmland: 'rgba(36, 40, 28, 1)',
      glacier: 'rgba(36, 46, 54, 1)',
      scrub: 'rgba(36, 38, 30, 1)',
      forest: 'rgba(24, 32, 26, 1)'
    },
    // Light ink + dark halo — readable on near-black if PM symbols are kept
    city_label: '#f2f0ea',
    city_label_halo: '#0a0c10',
    state_label: '#d0cec8',
    state_label_halo: '#0a0c10',
    country_label: '#eceae4',
    ocean_label: '#9eb4c4',
    subplace_label: '#e0ded8',
    subplace_label_halo: '#0a0c10'
  };
}


/**
 * Hybrid (satellite-streets) recolor without imagery — same override keys as
 * disasterdbTopoFlavor / disasterdbStreetsFlavor, on the stock dark base.
 * Dark muted land like imagery, very dark water, light road casings and
 * light Lexend ink so roads and labels read on top. Vector PMTiles only.
 * Not the prod default.
 */
export function disasterdbHybridFlavor() {
  const dark = namedFlavor('dark');
  return {
    ...dark,
    // Land — dark muted olive-gray, like imagery rather than near-black nav
    background: '#2c302c',
    earth: '#3c4038',
    // Parks and woods stay close to the imagery land, not saturated green
    park_a: '#3a4436',
    park_b: '#343e32',
    wood_a: '#364036',
    wood_b: '#303a30',
    scrub_a: '#3e4034',
    scrub_b: '#383a30',
    hospital: '#443c3c',
    industrial: '#3a3c3e',
    school: '#403e36',
    pedestrian: '#3a3c38',
    glacier: '#4a5458',
    sand: '#4a4638',
    beach: '#524c3c',
    aerodrome: '#3c3e3c',
    runway: '#4a4c4a',
    water: '#0a1218',
    zoo: '#364038',
    // Muted khaki on dark land
    military: '#484838',
    pier: '#4a4c4a',
    buildings: '#343632',
    // Roads — light fills with lighter casings so they read on dark land
    highway: '#f0e2b0',
    highway_casing_early: '#fff8e8',
    highway_casing_late: '#fff8e8',
    major: '#ffffff',
    major_casing_early: '#f4f4ee',
    major_casing_late: '#ecece6',
    minor_a: '#e4e6e2',
    minor_b: '#d8dcd8',
    minor_casing: '#f4f4f0',
    minor_service: '#c8ccc8',
    minor_service_casing: '#eceeea',
    link: '#f4e6c0',
    link_casing: '#fff6e0',
    other: '#b0b4ae',
    railway: '#c8c4bc',
    // White ADM intent (we still splice DisasterDB boundary-* layers)
    boundaries: 'rgba(255,255,255,0.88)',
    // Lexend stacks (only matter if PM label layers are kept; we strip them)
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(62, 70, 54, 1)',
      barren: 'rgba(74, 68, 52, 1)',
      urban_area: 'rgba(58, 58, 54, 1)',
      farmland: 'rgba(68, 72, 52, 1)',
      glacier: 'rgba(80, 90, 96, 1)',
      scrub: 'rgba(66, 68, 52, 1)',
      forest: 'rgba(48, 60, 46, 1)'
    },
    // Light ink + dark halo — readable on muted imagery land
    city_label: '#f7f4ee',
    city_label_halo: '#1a1c18',
    state_label: '#e0ddd4',
    state_label_halo: '#1a1c18',
    country_label: '#f2efe8',
    ocean_label: '#c5d4de',
    subplace_label: '#e8e4dc',
    subplace_label_halo: '#1a1c18'
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
