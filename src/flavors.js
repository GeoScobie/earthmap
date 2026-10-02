// Compact topo-ish Protomaps flavor for EarthMap (App flavors.js subset).
import { namedFlavor } from '@protomaps/basemaps';

export function earthmapTopoFlavor() {
  const light = namedFlavor('light');
  return {
    ...light,
    background: '#0b1220',
    earth: '#1a2438',
    park_a: '#1e3a2e',
    park_b: '#1a3328',
    wood_a: '#1a3024',
    wood_b: '#162a20',
    scrub_a: '#2a3030',
    scrub_b: '#243028',
    hospital: '#2a2430',
    industrial: '#222830',
    school: '#2a2830',
    pedestrian: '#222830',
    glacier: '#2a3448',
    sand: '#3a3428',
    beach: '#3a3428',
    aerodrome: '#222830',
    runway: '#303438',
    water: '#0e2a40',
    zoo: '#1a3028',
    military: '#2a3020',
    pier: '#222830',
    buildings: '#2a3038',
    highway: '#3a4048',
    highway_casing_early: '#1a2028',
    highway_casing_late: '#1a2028',
    major: '#343a44',
    major_casing_early: '#1a2028',
    major_casing_late: '#1a2028',
    minor_a: '#2a3038',
    minor_b: '#2a3038',
    minor_casing: '#1a2028',
    minor_service: '#262c34',
    minor_service_casing: '#1a2028',
    link: '#2a3038',
    link_casing: '#1a2028',
    other: '#262c34',
    railway: '#3a4048',
    boundaries: 'rgba(200,220,255,0.35)',
    regular: 'Lexend Regular',
    bold: 'Lexend Bold',
    italic: 'Lexend Regular',
    landcover: {
      grassland: 'rgba(40, 70, 48, 1)',
      barren: 'rgba(50, 48, 40, 1)',
      urban_area: 'rgba(40, 46, 56, 1)',
      farmland: 'rgba(44, 68, 44, 1)',
      glacier: 'rgba(42, 52, 72, 1)',
      scrub: 'rgba(46, 58, 44, 1)',
      forest: 'rgba(28, 52, 36, 1)'
    }
  };
}

/** Keep fills + roads; drop PM labels/POIs/boundaries (EarthMap is sat-first). */
export const CARTO_LAYER_ID_RE =
  /^(background|earth|landcover|landuse_|water$|water_stream|water_river|buildings|roads_)/;

export function isCartoBaseLayer(layer) {
  if (!CARTO_LAYER_ID_RE.test(layer.id)) return false;
  if (/label|shield|oneway|boundaries|pois|places|address/.test(layer.id)) {
    return false;
  }
  const raw = JSON.stringify(layer);
  if (raw.includes('"icon-image"')) return false;
  return true;
}
