// ---------------------------------------------------------------------------
// POI icons — Maki, loaded at runtime
//
// Your Mapbox style draws POI icons with:
//     coalesce(image(maki_beta), image(maki))
// i.e. every feature carries a `maki` field naming its icon, and Mapbox's
// hosted sprite supplies the artwork.
//
// Protomaps has NO `maki` field. Its POI `kind` is the raw OSM value — `park`,
// `fire_station`, `place_of_worship`, 145 distinct values in a single city
// view. So this cannot be copied across; the kind -> icon table below is the
// translation layer, written by hand against the 215 real Maki icon names.
//
// Maki itself is CC0-1.0, so the artwork is free to use and to mirror.
//
// WHY RUNTIME, NOT A SPRITE SHEET: a sprite is a PNG atlas plus an index JSON,
// and building one needs a toolchain this project deliberately doesn't have
// (no Node). Fetching the SVGs and calling map.addImage() gets identical
// results with no build step, and lets the icons be recoloured per category —
// which a pre-baked sprite could not do without one atlas per colour.
//
// PRODUCTION: Maki SVGs are vendored under public/icons/ (CC0-1.0) so the
// static build does not depend on a CDN at runtime. MAKI_BASE is same-
// origin '/icons'. Add a new kind to POI_ICONS, drop its SVG next to the
// others if missing, and rebuild.
// ---------------------------------------------------------------------------

const MAKI_BASE = `${import.meta.env.BASE_URL}icons`;

// Colour categories, matching Studio's poi-label paint block.
export const CAT = {
  PARK: 'park',
  EDU: 'education',
  MED: 'medical',
  PLAIN: 'plain'
};

// Protomaps POI `kind` -> [Maki icon name, colour category].
// Every icon name here was verified against the published Maki 8.2.0 file
// list. An unlisted kind falls through to the marker below, so this table can
// grow without anything breaking.
export const POI_ICONS = {
  // --- Green: parks and open space --------------------------------------
  park:              ['park', CAT.PARK],
  garden:            ['garden', CAT.PARK],
  dog_park:          ['dog-park', CAT.PARK],
  nature_reserve:    ['natural', CAT.PARK],
  picnic_site:       ['picnic-site', CAT.PARK],
  playground:        ['playground', CAT.PARK],
  golf_course:       ['golf', CAT.PARK],
  miniature_golf:    ['golf', CAT.PARK],
  pitch:             ['pitch', CAT.PARK],
  sports_centre:     ['fitness-centre', CAT.PARK],
  fitness_centre:    ['fitness-centre', CAT.PARK],
  stadium:           ['stadium', CAT.PARK],
  beach:             ['beach', CAT.PARK],
  peak:              ['mountain', CAT.PARK],
  grave_yard:        ['cemetery', CAT.PARK],
  ice_rink:          ['skiing', CAT.PARK],

  // --- Orange: education --------------------------------------------------
  school:            ['school', CAT.EDU],
  kindergarten:      ['school', CAT.EDU],
  childcare:         ['school', CAT.EDU],
  university:        ['college', CAT.EDU],
  college:           ['college', CAT.EDU],
  library:           ['library', CAT.EDU],

  // --- Red: medical and emergency ----------------------------------------
  // Studio colours only medical; fire/police are arguably the most important
  // POIs on a wildfire map, so they're grouped in here deliberately.
  hospital:          ['hospital', CAT.MED],
  clinic:            ['doctor', CAT.MED],
  doctors:           ['doctor', CAT.MED],
  dentist:           ['dentist', CAT.MED],
  pharmacy:          ['pharmacy', CAT.MED],
  veterinary:        ['veterinary', CAT.MED],
  fire_station:      ['fire-station', CAT.MED],
  police:            ['police', CAT.MED],
  social_facility:   ['shelter', CAT.MED],

  // --- White: everything else --------------------------------------------
  // Military / airfield when present as POIs (landuse fill is separate).
  military:          ['castle', CAT.PLAIN],
  naval_base:        ['harbor', CAT.PLAIN],
  airfield:          ['airport', CAT.PLAIN],
  barracks:          ['castle', CAT.PLAIN],
  hotel:             ['lodging', CAT.PLAIN],
  motel:             ['lodging', CAT.PLAIN],
  hostel:            ['lodging', CAT.PLAIN],
  restaurant:        ['restaurant', CAT.PLAIN],
  fast_food:         ['fast-food', CAT.PLAIN],
  food_court:        ['restaurant', CAT.PLAIN],
  cafe:              ['cafe', CAT.PLAIN],
  bar:               ['bar', CAT.PLAIN],
  pub:               ['beer', CAT.PLAIN],
  biergarten:        ['beer', CAT.PLAIN],
  nightclub:         ['nightclub', CAT.PLAIN],
  bakery:            ['bakery', CAT.PLAIN],
  deli:              ['grocery', CAT.PLAIN],
  supermarket:       ['grocery', CAT.PLAIN],
  convenience:       ['convenience', CAT.PLAIN],
  greengrocer:       ['grocery', CAT.PLAIN],
  butcher:           ['slaughterhouse', CAT.PLAIN],
  marketplace:       ['shop', CAT.PLAIN],
  mall:              ['shop', CAT.PLAIN],
  department_store:  ['shop', CAT.PLAIN],
  retail:            ['shop', CAT.PLAIN],
  commercial:        ['commercial', CAT.PLAIN],
  place_of_worship:  ['place-of-worship', CAT.PLAIN],
  museum:            ['museum', CAT.PLAIN],
  gallery:           ['art-gallery', CAT.PLAIN],
  arts_centre:       ['art-gallery', CAT.PLAIN],
  artwork:           ['art-gallery', CAT.PLAIN],
  theatre:           ['theatre', CAT.PLAIN],
  concert_hall:      ['music', CAT.PLAIN],
  cinema:            ['cinema', CAT.PLAIN],
  attraction:        ['attraction', CAT.PLAIN],
  landmark:          ['landmark', CAT.PLAIN],
  heritage:          ['monument', CAT.PLAIN],
  information:       ['information', CAT.PLAIN],
  bank:              ['bank', CAT.PLAIN],
  post_office:       ['post', CAT.PLAIN],
  townhall:          ['town-hall', CAT.PLAIN],
  administrative:    ['town-hall', CAT.PLAIN],
  courthouse:        ['town-hall', CAT.PLAIN],
  prison:            ['prison', CAT.PLAIN],
  community_centre:  ['town-hall', CAT.PLAIN],
  parking:           ['parking', CAT.PLAIN],
  fuel:              ['fuel', CAT.PLAIN],
  charging_station:  ['charging-station', CAT.PLAIN],
  car_repair:        ['car-repair', CAT.PLAIN],
  car_rental:        ['car-rental', CAT.PLAIN],
  car_wash:          ['car', CAT.PLAIN],
  car:               ['car', CAT.PLAIN],
  motorcycle:        ['scooter', CAT.PLAIN],
  bicycle:           ['bicycle', CAT.PLAIN],
  bicycle_rental:    ['bicycle-share', CAT.PLAIN],
  station:           ['rail', CAT.PLAIN],
  bus_stop:          ['bus', CAT.PLAIN],
  cruise_terminal:   ['harbor', CAT.PLAIN],
  hairdresser:       ['hairdresser', CAT.PLAIN],
  florist:           ['florist', CAT.PLAIN],
  hardware:          ['hardware', CAT.PLAIN],
  doityourself:      ['hardware', CAT.PLAIN],
  furniture:         ['furniture', CAT.PLAIN],
  electronics:       ['mobile-phone', CAT.PLAIN],
  books:             ['library', CAT.PLAIN],
  pet:               ['dog-park', CAT.PLAIN],
  laundry:           ['laundry', CAT.PLAIN],
  storage_rental:    ['warehouse', CAT.PLAIN],
  wholesale:         ['warehouse', CAT.PLAIN],
  industrial:        ['industry', CAT.PLAIN],
  construction:      ['construction', CAT.PLAIN],
  water:             ['water', CAT.PLAIN],
  fountain:          ['drinking-water', CAT.PLAIN],
  toilets:           ['toilet', CAT.PLAIN],
  bowling_alley:     ['bowling-alley', CAT.PLAIN],
  travel_agency:     ['suitcase', CAT.PLAIN],
  events_venue:      ['theatre', CAT.PLAIN],
  conference_centre: ['suitcase', CAT.PLAIN],
  // --- Common Protomaps kinds that previously fell through to marker ------
  national_park:     ['park', CAT.PARK],
  state_park:        ['park', CAT.PARK],
  protected_area:    ['natural', CAT.PARK],
  forest:            ['park', CAT.PARK],
  wood:              ['park', CAT.PARK],
  recreation_ground: ['pitch', CAT.PARK],
  volcano:           ['mountain', CAT.PARK],
  glacier:           ['mountain', CAT.PARK],
  viewpoint:         ['viewpoint', CAT.PARK],
  waterfall:         ['waterfall', CAT.PARK],
  wetland:           ['wetland', CAT.PARK],
  camp_site:         ['campsite', CAT.PARK],
  campsite:          ['campsite', CAT.PARK],
  wilderness_hut:    ['shelter', CAT.PARK],
  alpine_hut:        ['shelter', CAT.PARK],
  swimming_pool:     ['swimming', CAT.PARK],
  water_park:        ['amusement-park', CAT.PARK],
  sports_hall:       ['fitness-centre', CAT.PARK],
  zoo:               ['zoo', CAT.PARK],
  aquarium:          ['aquarium', CAT.PARK],
  amusement_park:    ['amusement-park', CAT.PARK],

  nursing_home:      ['hospital', CAT.MED],
  ambulance_station: ['hospital', CAT.MED],
  defibrillator:     ['defibrillator', CAT.MED],
  ranger_station:    ['ranger-station', CAT.MED],

  aerodrome:         ['airport', CAT.PLAIN],
  airport:           ['airport', CAT.PLAIN],
  helipad:           ['heliport', CAT.PLAIN],
  heliport:          ['heliport', CAT.PLAIN],
  ferry_terminal:    ['ferry', CAT.PLAIN],
  ferry:             ['ferry', CAT.PLAIN],
  marina:            ['harbor', CAT.PLAIN],
  harbour:           ['harbor', CAT.PLAIN],
  harbor:            ['harbor', CAT.PLAIN],
  lighthouse:        ['lighthouse', CAT.PLAIN],
  slipway:           ['slipway', CAT.PLAIN],
  bus_station:       ['bus', CAT.PLAIN],
  railway_station:   ['rail', CAT.PLAIN],
  subway_entrance:   ['rail-metro', CAT.PLAIN],
  tram_stop:         ['rail-light', CAT.PLAIN],
  aerialway:         ['aerialway', CAT.PLAIN],
  parking_garage:    ['parking-garage', CAT.PLAIN],
  drinking_water:    ['drinking-water', CAT.PLAIN],
  recycling:         ['recycling', CAT.PLAIN],
  waste_basket:      ['waste-basket', CAT.PLAIN],
  atm:               ['bank', CAT.PLAIN],
  embassy:           ['embassy', CAT.PLAIN],
  memorial:          ['monument', CAT.PLAIN],
  monument:          ['monument', CAT.PLAIN],
  ruins:             ['castle', CAT.PLAIN],
  castle:            ['castle', CAT.PLAIN],
  dam:               ['dam', CAT.PLAIN],
  farm:              ['farm', CAT.PLAIN],
  farmland:          ['farm', CAT.PLAIN],
  cemetery:          ['cemetery', CAT.PARK],
  christian:         ['religious-christian', CAT.PLAIN],
  jewish:            ['religious-jewish', CAT.PLAIN],
  muslim:            ['religious-muslim', CAT.PLAIN],
  hindu:             ['place-of-worship', CAT.PLAIN],
  buddhist:          ['place-of-worship', CAT.PLAIN],
  shinto:            ['place-of-worship', CAT.PLAIN]

};

// Anything not in the table.
const FALLBACK = ['marker', CAT.PLAIN];

// Image id for a given icon/category pair. Colour is baked into the raster, so
// the same glyph in two colours is two images.
const imageId = (icon, cat) => `poi-${icon}-${cat}`;

/**
 * The `icon-image` expression for the poi-label layer, generated from the same
 * table the images are built from — so the two can never drift apart.
 */
export function poiIconExpression() {
  const expr = ['match', ['get', 'kind']];
  for (const [kind, [icon, cat]] of Object.entries(POI_ICONS)) {
    expr.push(kind, imageId(icon, cat));
  }
  expr.push(imageId(FALLBACK[0], FALLBACK[1]));
  return expr;
}

/**
 * Fetch each Maki SVG once, recolour it per category, and register it with the
 * map. Safe to call before or after load. Failures are logged and skipped —
 * a missing icon must never take the basemap down with it.
 */
export async function loadPoiIcons(map, colors) {
  const colorFor = {
    [CAT.PARK]: colors.poiPark,
    [CAT.EDU]: colors.poiEducation,
    [CAT.MED]: colors.poiMedical,
    [CAT.PLAIN]: colors.labelText
  };

  // Unique (icon, category) pairs actually referenced.
  const pairs = new Map();
  for (const [icon, cat] of [...Object.values(POI_ICONS), FALLBACK]) {
    pairs.set(`${icon}|${cat}`, [icon, cat]);
  }

  // One network fetch per distinct glyph, even if it's used in two colours.
  const svgCache = new Map();
  const getSvg = (icon) => {
    if (!svgCache.has(icon)) {
      svgCache.set(icon, fetch(`${MAKI_BASE}/${icon}.svg`).then((r) => {
        if (!r.ok) throw new Error(`maki ${icon}: HTTP ${r.status}`);
        return r.text();
      }));
    }
    return svgCache.get(icon);
  };

  let ok = 0;
  let failed = 0;

  await Promise.all([...pairs.values()].map(async ([icon, cat]) => {
    const id = imageId(icon, cat);
    if (map.hasImage(id)) return;
    try {
      const raw = await getSvg(icon);
      // Maki paths carry no fill of their own, so a fill on the root <svg>
      // colours the whole glyph. Doubling the declared size renders at 2x for
      // retina; pixelRatio 2 below scales it back to 15px on screen.
      const svg = raw
        .replace(/width="15"/, 'width="30"')
        .replace(/height="15"/, 'height="30"')
        .replace(/<svg /, `<svg fill="${colorFor[cat]}" `);

      const img = new Image(30, 30);
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try {
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = () => rej(new Error(`decode failed: ${icon}`));
          img.src = url;
        });
        if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
        ok++;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      failed++;
      console.warn('[icons]', e.message);
    }
  }));

  console.log(`[icons] ${ok} POI icons loaded${failed ? `, ${failed} failed` : ''}`);
}
