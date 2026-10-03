import {
  brand, fonts, sources, attribution, handoff, awsLocation, grade, sentinel,
  cartoLightLabels, hillshade, contours, waterFillOpacity, waterLineOpacity
} from './theme.js';
import { poiIconExpression } from './icons.js';
import { layers as pmLayers } from '@protomaps/basemaps';
import {
  disasterdbTopoFlavor,
  disasterdbLightFlavor,
  disasterdbDarkFlavor,
  isCartoBaseLayer
} from './flavors.js';
import {
  resolveBasemapId,
  resolveHillshadeEnabled,
  resolveContoursEnabled,
  resolveDemNeeded,
  isCartographicBasemap,
  isLightCartographic
} from './basemap-resolve.js';
import { sharedDemTilesUrl, contourTilesUrl } from './contour-dem.js';

// ---------------------------------------------------------------------------
// buildStyle() — satellite (prod default) or cartographic topo hybrid.
// Cartographic modes use @protomaps/basemaps layers() + DisasterDB Flavor,
// then splice white ADM borders + Lexend place/POI/water labels.
// See docs/PR_DISASTERDB_TOPO.md.
// ---------------------------------------------------------------------------

const graded = (g) => ({
  'raster-brightness-min': g.brightnessMin,
  'raster-brightness-max': g.brightnessMax,
  'raster-contrast': g.contrast,
  'raster-saturation': g.saturation
});

const widthRamp = (stops) => [
  'interpolate', ['exponential', 1.4], ['zoom'], ...stops.flat()
];

const sizeRamp = (stops) => [
  'interpolate', ['linear'], ['zoom'], ...stops.flat()
];

const labelField = ['coalesce', ['get', 'name:en'], ['get', 'name']];

const awsEnabled = Boolean(awsLocation.apiKey);

function paintColors(basemapId) {
  if (!isLightCartographic(basemapId)) return brand;
  return { ...brand, ...cartoLightLabels };
}

function flavorFor(basemapId) {
  if (basemapId === 'disasterdb-light') return disasterdbLightFlavor();
  if (basemapId === 'disasterdb-dark') return disasterdbDarkFlavor();
  return disasterdbTopoFlavor(); // disasterdb-topo
}

function styleName(basemapId) {
  if (basemapId === 'disasterdb-topo') return 'EarthMap — Topo';
  if (basemapId === 'disasterdb-light') return 'EarthMap — Light (stub)';
  if (basemapId === 'disasterdb-dark') return 'EarthMap — Dark (stub)';
  if (basemapId === 'satellite') return 'EarthMap — Sat';
  return 'EarthMap — Satellite Hybrid';
}

/** White ADM + Lexend labels (+ optional satellite roads-simple).
 *  When satOutlines is true, coast + country casing + roads-simple start
 *  visible (near-time / satellite). Topo hides those via basemap-mode.
 *
 *  Paint order (bottom → top): roads-simple → coast/ADM → labels.
 *  Matches FireMap Studio (imagery → road-simple → admin → labels).
 *  Live GeoColor inserts BEFORE roads-simple so major roads stay over sat. */
function buildOverlays(c, { includeRoads, includeRoadLabels = false, satOutlines = false }) {
  const satVis = satOutlines ? 'visible' : 'none';
  // Country / ADM0 — exclude maritime-only segments when tiles expose it
  // (EEZ clutter; true coast comes from earth outline below).
  const countryFilter = [
    'all',
    [
      'any',
      ['==', ['get', 'kind'], 'country'],
      ['<', ['coalesce', ['get', 'kind_detail'], 2], 3]
    ],
    ['!=', ['to-boolean', ['get', 'maritime']], true]
  ];
  // ----- Sat roads (FireMap road-simple) — BEFORE coast so GeoColor beforeId works
  // Major roads only over sat: highway≈motorway/trunk, major_road≈primary,
  // medium_road≈secondary (±tertiary). Same planet PMTiles as topo roads_*.
  const roadsSimple = {
        id: 'roads-simple',
        type: 'line',
        source: 'basemap',
        'source-layer': 'roads',
        minzoom: 5,
        filter: [
          'in',
          ['get', 'kind'],
          ['literal', ['highway', 'major_road', 'medium_road']]
        ],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: satVis
        },
        paint: {
          'line-color': c.roadMajor,
          'line-width': [
            'interpolate', ['exponential', 1.5], ['zoom'],
            5,  ['match', ['get', 'kind'],
                 'highway', 0.375,
                 ['major_road', 'medium_road'], 0.05,
                 0],
            13, ['match', ['get', 'kind'],
                 'highway', 2,
                 ['major_road', 'medium_road'], 1.25,
                 0.5],
            18, ['match', ['get', 'kind'],
                 'highway', 16,
                 ['major_road', 'medium_road'], 13,
                 5]
          ],
          // Studio: 1 at z13 -> 0 at z15. Roads disappear entirely.
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 13, 1, 15, 0]
        }
      };
  const layers = [
      ...(includeRoads ? [roadsSimple] : []),
      // ----- 2. Coast + administrative boundaries ------------------------
      // Paint order (bottom → top of outline stack):
      //   roads-simple → coastline-casing → coastline → ADM2 → ADM1 →
      //   country-casing → country → labels
      // Coast = Protomaps `earth` polygon outline (land/ocean edge), not ADM.
      // Runtime live imagery (GOES / GeoColor) must insert BEFORE
      // roads-simple (preferred) or BOUNDARY_BEFORE_ID — see goes.js / geocolor.js.
      {
        id: 'coastline-casing',
        type: 'line',
        source: 'basemap',
        'source-layer': 'earth',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: satVis
        },
        paint: {
          'line-color': c.boundaryCasing || 'rgba(0,0,0,0.72)',
          'line-width': widthRamp([[2, 2.2], [8, 3.6], [12, 5.0]])
        }
      },
      {
        id: 'coastline',
        type: 'line',
        source: 'basemap',
        'source-layer': 'earth',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: satVis
        },
        paint: {
          'line-color': c.coastlineLine || c.boundaryLineHi,
          'line-width': widthRamp([[2, 0.85], [8, 1.5], [12, 2.2]])
        }
      },
      {
        id: 'boundary-adm2',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        // ADM2 / county — Protomaps kind=county (OSM admin_level typically 6).
        filter: [
          'any',
          ['==', ['get', 'kind'], 'county'],
          ['>=', ['coalesce', ['get', 'kind_detail'], 0], 6]
        ],
        minzoom: 5,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': c.boundaryLineAdm2 || c.boundaryLine,
          'line-dasharray': [1.5, 1.5],
          'line-width': widthRamp([[5, 0.45], [9, 0.9], [12, 1.35]])
        }
      },
      {
        id: 'boundary-region',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        // ADM1 / state-province — kind=region (kind_detail 4; 3/5 also region-ish).
        filter: [
          'any',
          ['==', ['get', 'kind'], 'region'],
          [
            'all',
            ['>=', ['coalesce', ['get', 'kind_detail'], 4], 3],
            ['<', ['coalesce', ['get', 'kind_detail'], 4], 6],
            ['!=', ['get', 'kind'], 'county'],
            ['!=', ['get', 'kind'], 'country']
          ]
        ],
        minzoom: 4,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': c.boundaryLine,
          'line-dasharray': [2, 2],
          'line-width': widthRamp([[4, 0.6], [10, 1.4]])
        }
      },
      {
        id: 'boundary-country-casing',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        filter: countryFilter,
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: satVis
        },
        paint: {
          'line-color': c.boundaryCasing || 'rgba(0,0,0,0.72)',
          'line-width': widthRamp([[2, 2.4], [10, 5.0]])
        }
      },
      {
        id: 'boundary-country',
        type: 'line',
        source: 'basemap',
        'source-layer': 'boundaries',
        filter: countryFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': c.boundaryLineHi,
          // Slightly thicker than ADM1 so country silhouettes read through cloud.
          'line-width': widthRamp([[2, 1.15], [10, 3.0]])
        }
      },

      // ----- 3. Road name labels (cartographic / topo only) -----------------
      // Satellite keeps Studio's no-street-names look over Blue Marble.
      // Topo wants Google-like road names: major/highway earlier, minor later.
      ...(includeRoadLabels
        ? [
            {
              id: 'roads-label-major',
              type: 'symbol',
              source: 'basemap',
              'source-layer': 'roads',
              minzoom: 11,
              filter: ['in', ['get', 'kind'], ['literal', ['highway', 'major_road']]],
              layout: {
                'symbol-placement': 'line',
                'symbol-sort-key': ['get', 'min_zoom'],
                'text-field': labelField,
                'text-font': fonts.regular,
                'text-size': sizeRamp([[11, 10], [14, 12], [18, 14]]),
                'text-max-angle': 30,
                'text-padding': 2
              },
              paint: {
                'text-color': c.labelDim,
                'text-halo-color': c.labelHalo,
                'text-halo-width': 1.2,
                'text-halo-blur': 0.5
              }
            },
            {
              id: 'roads-label-minor',
              type: 'symbol',
              source: 'basemap',
              'source-layer': 'roads',
              minzoom: 14,
              filter: ['in', ['get', 'kind'], ['literal', ['minor_road', 'other', 'path']]],
              layout: {
                'symbol-placement': 'line',
                'symbol-sort-key': ['get', 'min_zoom'],
                'text-field': labelField,
                'text-font': fonts.regular,
                'text-size': sizeRamp([[14, 10], [17, 12]]),
                'text-max-angle': 30,
                'text-padding': 2
              },
              paint: {
                'text-color': c.labelMuted,
                'text-halo-color': c.labelHalo,
                'text-halo-width': 1,
                'text-halo-blur': 0.5
              }
            }
          ]
        : []),

      // ----- 5. Water labels ---------------------------------------------
      {
        id: 'water-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'water',
        minzoom: 3,
        layout: {
          'text-field': labelField,
          // Studio uses ExtraLight for every water label — it's what makes the
          // water read as recessive against the imagery.
          'text-font': fonts.extraLight,
          'text-size': sizeRamp([[3, 11], [10, 14], [16, 18]]),
          // Studio letter-spaces oceans hard (0.25) and seas/bays less (0.15).
          'text-letter-spacing': [
            'match', ['get', 'kind'],
            'ocean', 0.25,
            ['sea', 'bay'], 0.15,
            0.01
          ],
          'text-line-height': 1.3,   // Studio panel
          'text-max-width': [
            'match', ['get', 'kind'],
            'ocean', 4,
            'sea', 5,
            ['bay', 'water'], 7,
            10
          ]
        },
        paint: {
          'text-color': [
            'match', ['get', 'kind'],
            ['bay', 'ocean', 'sea'], c.waterLabelOcean,
            c.waterLabel
          ],
          // Half-strength halo, per Studio. Water labels are meant to sit back.
          'text-halo-color': c.labelHaloSoft,
          'text-halo-width': 1,
          'text-halo-blur': 1
        }
      },

      // ----- 6. Place labels ---------------------------------------------
      // symbol-sort-key drives collision priority: LOWER wins. Feeding it the
      // feature's own min_zoom means big cities beat small towns for space.
      {
        id: 'waterway-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'water',
        // Protomaps carries rivers and canals as LineStrings in `water`.
        filter: ['in', ['get', 'kind'], ['literal', ['river', 'canal', 'stream']]],
        minzoom: 13,
        layout: {
          'text-field': labelField,
          'text-font': fonts.extraLight,
          'text-size': sizeRamp([[13, 12], [18, 18]]),
          'text-line-height': 1.3,
          'symbol-placement': 'line',
          'text-max-angle': 30
        },
        paint: {
          'text-color': c.waterLabel,
          'text-halo-color': c.labelHaloSoft,
          'text-halo-width': 1,
          'text-halo-blur': 1
        }
      },

      {
        id: 'natural-point-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'pois',
        // Studio's natural-point-label runs from z4 — national forests, state
        // parks, wildlife areas. poi-label doesn't start until z12, so this
        // whole class of label was simply absent when zoomed out. Protomaps
        // files them in `pois`, so they're reachable; they just need their own
        // layer with Studio's Lexend Black treatment.
        filter: ['in', ['get', 'kind'],
          ['literal', ['nature_reserve', 'protected_area', 'forest', 'park',
                       'national_park', 'state_park', 'wood', 'peak',
                       'volcano', 'glacier', 'beach']]],
        minzoom: 4,
        maxzoom: 12,      // poi-label takes over here
        layout: {
          'text-field': labelField,
          'text-font': fonts.black,     // Studio: natural labels are Black
          'text-size': sizeRamp([[4, 11], [10, 13], [12, 15]]),
          'text-max-width': 8,
          'text-line-height': 1.2,
          'text-padding': 4,
          'symbol-sort-key': ['get', 'min_zoom']
        },
        paint: {
          'text-color': c.poiPark,
          'text-halo-color': c.poiHalo,
          'text-halo-width': 0.5,
          'text-halo-blur': 0.5
        }
      },

      {
        id: 'poi-label',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'pois',
        // Studio thins POIs hard: `filterrank <= step(zoom,0, 16,1, 17,2) + 3`,
        // which at z12.6 means rank <= 3 — a handful of POIs, not a carpet.
        // Protomaps' min_zoom is more generous, so it needs biasing by a zoom
        // level to land at a comparable density. Raise the 1 to thin further.
        filter: ['all',
          ['<=', ['get', 'min_zoom'], ['zoom']],
          // Protomaps emits administrative and land-use polygons as POIs —
          // "District 2", "District 3", bare 'residential' blocks. Mapbox has
          // no equivalent and never labels them, so drop them.
          ['!', ['in', ['get', 'kind'],
                 ['literal', ['administrative', 'political', 'residential', 'place',
                              'other', 'building', 'commercial', 'industrial',
                              'retail', 'construction', 'grass', 'yes']]]]
        ],
        minzoom: 12,
        layout: {
          'text-field': labelField,
          'text-font': fonts.black,        // Studio uses Black for every POI
          'text-size': sizeRamp([[12, 11], [17, 13]]),
          // Studio panel: letter spacing 0 em, max width 10 em. (The JSON
          // omits letter-spacing entirely, which means the default 0 — I'd
          // guessed 0.01 and 9 before reading the panel.)
          'text-max-width': 10,
          // Studio: icon above, text anchored below it.
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'text-optional': true,

          // Maki, registered at runtime by icons.js. The expression is
          // generated from the same kind->icon table the images are built
          // from, so the two cannot drift apart.
          'icon-image': poiIconExpression(),
          // 15px Maki at pixelRatio 2; nudge up a touch for mobile readability.
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 1.05, 16, 1.2],
          'icon-anchor': 'bottom',
          // If an icon is missing, still draw the label rather than dropping
          // the feature entirely.
          'icon-optional': true,
          // Lower min_zoom = more important, and lower sort key = placed first.
          'symbol-sort-key': ['get', 'min_zoom']
        },
        paint: {
          // The colour coding that makes your basemap recognisable.
          'text-color': [
            'match', ['get', 'kind'],
            ['park', 'golf_course', 'picnic_site', 'garden', 'nature_reserve',
             'recreation_ground', 'playground', 'pitch'], c.poiPark,
            ['school', 'university', 'college', 'library'], c.poiEducation,
            ['hospital', 'clinic', 'doctors', 'pharmacy'], c.poiMedical,
            c.labelText
          ],
          'text-halo-color': c.poiHalo,
          'text-halo-width': 0.5,
          'text-halo-blur': 0.5
        }
      },

      {
        id: 'place-locality',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        layout: {
          'text-field': labelField,
          'text-font': fonts.settlement,
          // Studio sizes settlements by `symbolrank` so big cities outrank
          // small towns at the same zoom. Protomaps' equivalent field is
          // `population_rank` (higher = bigger place), so the hierarchy is
          // reproduced rather than approximated with a flat zoom ramp.
          // Scaled to Studio's settlement-major ramp, which tops out at
          // 26.4px for a big city — mine was reaching only 19, which is why
          // "San Francisco" read as a minor label next to yours.
          //
          // The two rank fields run in OPPOSITE directions: Mapbox symbolrank
          // is low-is-important, Protomaps population_rank is high-is-
          // important. So the step thresholds are inverted, not copied.
          // San Francisco is population_rank 12.
          // Studio splits settlements across TWO layers — settlement-major and
          // settlement-minor — each with its own size ramp. Merging them into
          // one layer here collapsed the range: San Francisco came out 22px
          // and a small town 15.4px, a 1.4x spread, so everything read as the
          // same size. Studio's actual spread is closer to 2x.
          //
          // Widened to span the full population_rank range (4..12+ observed).
          'text-size': [
            'interpolate', ['cubic-bezier', 0.2, 0, 0.9, 1], ['zoom'],
            3,  ['step', ['get', 'population_rank'], 10, 7, 11, 9, 12.1, 11, 14.3],
            6,  ['step', ['get', 'population_rank'], 11, 7, 13.2, 9, 15.4, 11, 19.8],
            8,  ['step', ['get', 'population_rank'], 12.1, 7, 14.3, 9, 17.6, 11, 23],
            12, ['step', ['get', 'population_rank'], 14.3, 7, 16.5, 9, 19.8, 11, 25],
            15, ['step', ['get', 'population_rank'], 15.4, 7, 17.6, 9, 22, 11, 26.4]
          ],
          'text-max-width': 7,
          'text-line-height': 1.1,   // Studio panel
          'text-allow-overlap': false,
          // Higher population_rank = more important. MapLibre places lower
          // sort keys first, so invert rank (keep big cities winning collisions
          // once small towns appear earlier via the min_zoom bias below).
          'symbol-sort-key': ['-', 99, ['coalesce', ['get', 'population_rank'], 0]],
          // Slightly less padding + optional text helps mobile density without
          // letting labels paint over each other unchecked.
          'text-padding': 1.5,
          'text-optional': true
        },
        // LOCALITY_MIN_ZOOM_BIAS = 2: show when zoom >= min_zoom - 2.
        // Small towns (high Protomaps min_zoom) appear earlier — Pahoa-class
        // places near min_zoom 10 show around z8 — without flooding z3 with
        // every hamlet (those still carry min_zoom 12–14+).
        filter: ['all',
          ['==', ['get', 'kind'], 'locality'],
          ['<=', ['get', 'min_zoom'], ['+', ['zoom'], 2]]
        ],
        paint: {
          'text-color': c.labelDim,
          'text-halo-color': c.labelHalo,
          'text-halo-width': fonts.settlementHaloWidth,
          'text-halo-blur': 1
        }
      },
      {
        id: 'place-subdivision',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        // BOTH tiers, and the distinction matters enormously.
        //
        // Protomaps files SF's recognisable neighbourhoods — Marina, Pacific
        // Heights, Chinatown, Tenderloin, Nob Hill, Castro, Haight, Noe Valley
        // — as kind 'macrohood' (detail 'quarter'). Its 'neighbourhood' tier
        // holds the granular stuff: Little Saigon, Polk Gulch, North of
        // Panhandle, Lower Pacific Heights.
        //
        // Dropping macrohood to reduce clutter therefore deletes precisely the
        // names a reader recognises and keeps the ones they don't. Mapbox has
        // no such split — its settlement_subdivision covers both — so this is
        // a translation, not a copy.
        filter: ['in', ['get', 'kind'], ['literal', ['macrohood', 'neighbourhood']]],
        minzoom: 10,
        maxzoom: 15,
        layout: {
          'text-field': labelField,
          'text-font': fonts.settlement,
          // macrohood == Studio's 'suburb' tier: bigger and more tracked.
          'text-size': [
            'interpolate', ['cubic-bezier', 0.5, 0, 1, 1], ['zoom'],
            11, ['match', ['get', 'kind'], 'macrohood', 12.1, 11.55],
            15, ['match', ['get', 'kind'], 'macrohood', 16.5, 15.4]
          ],
          'text-transform': 'uppercase',
          'text-letter-spacing': [
            'match', ['get', 'kind'], 'macrohood', 0.15, 0.05
          ],
          'text-max-width': 7,
          'text-line-height': 1.2,
          'text-padding': 4,
          // Studio ranks with `filterrank`. Protomaps' analogue here is
          // `sort_key` — lower is more important — and MapLibre places lower
          // sort keys first, so it can be used directly. Macrohoods are
          // shifted below every neighbourhood so the big names always win the
          // space, which is what makes this read like your map instead of a
          // list of alleyways.
          'symbol-sort-key': [
            'case',
            ['==', ['get', 'kind'], 'macrohood'], ['get', 'sort_key'],
            ['+', ['get', 'sort_key'], 10000000]
          ]
        },
        paint: {
          'text-color': c.labelText,
          'text-halo-color': c.labelHaloSub,
          'text-halo-width': fonts.settlementHaloWidth,
          'text-halo-blur': 0.5
        }
      },

      {
        id: 'place-region',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['==', ['get', 'kind'], 'region'],
        minzoom: 3,
        maxzoom: 9,          // Studio hides states past z9
        layout: {
          'text-field': labelField,
          'text-font': fonts.bold,   // the ONLY place Studio uses Bold
          'text-size': sizeRamp([[4, 10], [9, 16]]),
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.15,
          'text-max-width': 6
        },
        paint: {
          'text-color': c.labelDim,
          'text-halo-color': c.labelHalo,
          'text-halo-width': 1,
          // Studio holds states at half opacity so they sit under city names.
          'text-opacity': 0.5
        }
      },
      {
        id: 'place-country',
        type: 'symbol',
        source: 'basemap',
        'source-layer': 'places',
        filter: ['==', ['get', 'kind'], 'country'],
        maxzoom: 10,
        layout: {
          'text-field': labelField,
          'text-font': fonts.settlement,
          'text-size': sizeRamp([[1, 11], [5, 15], [9, 20]]),
          'text-line-height': 1.1,   // Studio panel
          // NOTE: Studio does NOT uppercase or letter-space country labels.
          // This file used to do both. Removed to match.
          'text-max-width': 6
        },
        paint: {
          'text-color': c.labelDim,
          'text-halo-color': c.labelHalo,
          // Studio: 1.25. Bumped with the rest — see fonts.settlementHaloWidth.
          'text-halo-width': fonts.settlementHaloWidth
        }
      }

  ];

  return layers;
}

function prioritizeLabels(style) {
  // Keep Lexend place/POI/water/road symbols above every fill (water, landuse,
  // buildings, …). Reordering only among themselves at the first label index
  // left coast cities under ocean when fills sat higher in the stack.
  const LABEL_PRIORITY = [
    'roads-label-minor',
    'roads-label-major',
    'poi-label',
    'natural-point-label',
    'waterway-label',
    'water-label',
    'place-subdivision',
    'place-locality',
    'place-region',
    'place-country'
  ];
  const byId = new Map();
  for (let i = style.layers.length - 1; i >= 0; i--) {
    const id = style.layers[i].id;
    if (!LABEL_PRIORITY.includes(id)) continue;
    byId.set(id, style.layers[i]);
    style.layers.splice(i, 1);
  }
  if (!byId.size) return;
  const ordered = LABEL_PRIORITY.map((id) => byId.get(id)).filter(Boolean);
  style.layers.push(...ordered);
}

function buildCartographicStyle(basemapId, opts = {}) {
  const useHillshade = resolveHillshadeEnabled(basemapId);
  const useContours = resolveContoursEnabled(basemapId);
  const useDem = resolveDemNeeded(basemapId);
  const c = paintColors(basemapId);
  const flavor = flavorFor(basemapId);

  // Sat-live (nearTime): Protomaps OSM carto + hillshade under GeoColor
  // (FireMap keeps classic basemap under sat). Blue Marble stays in the style
  // but hidden — OSM is the sat-live basemap.
  const nearTime = Boolean(opts.nearTime);
  const basemapAttr = useDem
    ? `${attribution.protomaps} ${attribution.osm} ${attribution.mapterhorn}`
    : `${attribution.protomaps} ${attribution.osm}`;

  const styleSources = {
    bluemarble: {
      type: 'raster',
      tiles: [sources.blueMarbleTiles],
      tileSize: 256,
      maxzoom: 8,
      attribution: attribution.nasa
    },
    // Low-z preview — few tiles, overzooms while z3–8 stream in.
    'bluemarble-lo': {
      type: 'raster',
      tiles: [sources.blueMarbleTiles],
      tileSize: 256,
      maxzoom: 2,
      attribution: attribution.nasa
    },
    basemap: {
      type: 'vector',
      url: `pmtiles://${sources.basemapPMTiles}`,
      maxzoom: 15,  // archive is disasterdb-planet-z15.pmtiles
      attribution: basemapAttr
    }
  };

  if (useDem) {
    // Shared DEM via maplibre-contour so hillshade + isolines hit one cache.
    styleSources.terrarium = {
      type: 'raster-dem',
      tiles: [sharedDemTilesUrl()],
      tileSize: sources.terrariumTileSize ?? 512,
      maxzoom: sources.terrariumMaxzoom ?? 15,
      encoding: 'terrarium',
      attribution: attribution.mapterhorn
    };
  }

  if (useContours) {
    styleSources.contours = {
      type: 'vector',
      tiles: [contourTilesUrl()],
      maxzoom: 15
    };
  }

  // Fills + roads from @protomaps/basemaps; drop PM boundaries/labels/sprites.
  let base = pmLayers('basemap', flavor, { lang: 'en' }).filter(isCartoBaseLayer);

  // PM paints military/naval_base/airfield with e.zoo inside landuse_park — swap
  // to flavor.military (olive/khaki). Parks / woods / protected stay as today.
  // No aboriginal/indigenous/reservation kinds in PM landuse or boundaries schema.
  const landusePark = base.find((l) => l.id === 'landuse_park');
  if (landusePark?.paint) {
    landusePark.paint = {
      ...landusePark.paint,
      'fill-color': [
        'case',
        [
          'in',
          ['get', 'kind'],
          [
            'literal',
            [
              'national_park',
              'park',
              'cemetery',
              'protected_area',
              'nature_reserve',
              'forest',
              'golf_course'
            ]
          ]
        ],
        flavor.park_b,
        ['==', ['get', 'kind'], 'wood'],
        flavor.wood_b,
        ['in', ['get', 'kind'], ['literal', ['scrub', 'grassland', 'grass']]],
        flavor.scrub_b,
        ['==', ['get', 'kind'], 'glacier'],
        flavor.glacier,
        ['==', ['get', 'kind'], 'sand'],
        flavor.sand,
        ['in', ['get', 'kind'], ['literal', ['military', 'naval_base', 'airfield']]],
        flavor.military,
        flavor.earth
      ]
    };
  }

  // Soften water *polygon* fill so hillshade shows under ocean/lakes.
  // Rivers/streams stay opaque line layers (separate ids from Protomaps).
  const waterFill = base.find((l) => l.id === 'water');
  if (waterFill?.paint) {
    waterFill.paint = {
      ...waterFill.paint,
      'fill-opacity': waterFillOpacity
    };
  }
  for (const id of ['water_stream', 'water_river']) {
    const line = base.find((l) => l.id === id);
    if (line?.paint) {
      line.paint = {
        ...line.paint,
        'line-opacity': waterLineOpacity
      };
    }
  }

  const insertBeforeWater = (layer) => {
    const waterAt = base.findIndex((l) => l.id === 'water');
    if (waterAt >= 0) base.splice(waterAt, 0, layer);
    else base.push(layer);
  };

  if (useHillshade) {
    insertBeforeWater({
      id: 'hillshade',
      type: 'hillshade',
      source: 'terrarium',
      // No layer maxzoom: keep shade at close zooms (overzoom DEM past terrariumMaxzoom).
      paint: {
        'hillshade-method': hillshade.method || 'multidirectional',
        'hillshade-shadow-color': hillshade.shadow,
        'hillshade-highlight-color': hillshade.highlight,
        'hillshade-exaggeration': hillshade.exaggeration
        // Future solar animation: setPaintProperty('hillshade',
        //   'hillshade-illumination-direction', solarAzimuthDegrees)
      }
    });
  }

  if (useContours) {
    // Isolines after ocean/land fills, before the road stack that should read
    // over imagery. GeoColor inserts immediately under contour-lines
    // (goes.js beforeId). Protomaps paints roads_runway / roads_taxiway
    // BEFORE the `water` fill — splicing contours at the first roads_* id
    // put that ocean fill (and hillshade) ON TOP of the sat rasters.
    const UNDER_SAT_RE =
      /^(background|earth|landcover|landuse_|water$|water_stream|water_river|buildings|hillshade)/;
    let insertAt = 0;
    for (let i = 0; i < base.length; i++) {
      if (UNDER_SAT_RE.test(base[i].id)) insertAt = i + 1;
    }
    const contourLayers = [
      {
        id: 'contour-lines',
        type: 'line',
        source: 'contours',
        'source-layer': contours.layer,
        // Low z for sat-live (thresholds start z4); was z9 topo-only.
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
          'line-opacity': 0.85
        }
      },
      {
        id: 'contour-labels',
        type: 'symbol',
        source: 'contours',
        'source-layer': contours.layer,
        minzoom: 9,
        filter: ['>', ['get', contours.levelKey], 0],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['concat', ['to-string', ['round', ['get', contours.elevationKey]]], ' m'],
          'text-font': ['Lexend Regular'],
          'text-size': 10,
          'text-padding': 8,
          'symbol-spacing': 400
        },
        paint: {
          'text-color': contours.labelColor,
          'text-halo-color': contours.labelHalo,
          'text-halo-width': 1.2
        }
      }
    ];
    base.splice(insertAt, 0, ...contourLayers);
  }

  // roads-simple: same planet PMTiles as roads_*; thin grey FireMap look over
  // GeoColor. Visibility sat-only (basemap-mode); topo keeps cased roads_*.
  const overlays = buildOverlays(c, { includeRoads: true, includeRoadLabels: true, satOutlines: nearTime });

  // NASA Blue Marble under carto fills — visible in near-time (satellite) mode.
  /* nearTime already set above */
  const blueMarblePaint = {
    ...graded(grade.blueMarble),
    'raster-opacity': 1,
    'raster-fade-duration': 300
  };
  // Blue Marble retained in style for rollback/QA but hidden — sat-live uses
  // Protomaps OSM (+ hillshade/contours) under GeoColor (FireMap pattern).
  const blueMarbleLoLayer = {
    id: 'bluemarble-lo',
    type: 'raster',
    source: 'bluemarble-lo',
    maxzoom: handoff.blueMarbleCutoff,
    layout: { visibility: 'none' },
    paint: blueMarblePaint
  };
  const blueMarbleLayer = {
    id: 'bluemarble',
    type: 'raster',
    source: 'bluemarble',
    maxzoom: handoff.blueMarbleCutoff,
    layout: { visibility: 'none' },
    paint: blueMarblePaint
  };

  // Sat-live: keep OSM carto + hillshade + contours visible under GeoColor.
  // Hide cased roads_* only — roads-simple owns major roads over imagery.
  if (nearTime) {
    for (const layer of base) {
      if (String(layer.id).startsWith('roads_')) {
        layer.layout = { ...(layer.layout || {}), visibility: 'none' };
      }
    }
  }

  const style = {
    version: 8,
    name: styleName(nearTime ? 'satellite' : basemapId),
    glyphs: fonts.glyphs,
    projection: { type: 'globe' },
    sources: styleSources,
    layers: [blueMarbleLoLayer, blueMarbleLayer, ...base, ...overlays]
  };

  prioritizeLabels(style);
  return style;
}

export function buildStyle() {
  const basemapId = resolveBasemapId();
  // Topo + sat-live share one style (Protomaps OSM + DEM/hillshade/contours).
  // Always build the topo structure so toggling never needs setStyle — sat-live
  // shows OSM under GeoColor (Blue Marble stays hidden).
  if (isCartographicBasemap(basemapId) || basemapId === 'satellite') {
    return buildCartographicStyle(
      basemapId === 'disasterdb-light' || basemapId === 'disasterdb-dark'
        ? basemapId
        : 'disasterdb-topo',
      { nearTime: basemapId === 'satellite' }
    );
  }

  // ----- Satellite hybrid (prod default) ---------------------------------
  const c = brand;
  const style = {
    version: 8,
    name: styleName('satellite'),
    glyphs: fonts.glyphs,
    projection: { type: 'globe' },
    sources: {
      bluemarble: {
        type: 'raster',
        tiles: [sources.blueMarbleTiles],
        tileSize: 256,
        maxzoom: 8,
        attribution: attribution.nasa
      },
      'bluemarble-lo': {
        type: 'raster',
        tiles: [sources.blueMarbleTiles],
        tileSize: 256,
        maxzoom: 2,
        attribution: attribution.nasa
      },
      basemap: {
        type: 'vector',
        url: `pmtiles://${sources.basemapPMTiles}`,
        maxzoom: 15,  // archive is disasterdb-planet-z15.pmtiles
        attribution: `${attribution.protomaps} ${attribution.osm}`
      }
    },
    layers: [
      {
        id: 'backdrop',
        type: 'background',
        paint: { 'background-color': brand.ink }
      },
      {
        id: 'bluemarble-lo',
        type: 'raster',
        source: 'bluemarble-lo',
        maxzoom: handoff.blueMarbleCutoff,
        paint: {
          ...graded(grade.blueMarble),
          'raster-opacity': 1,
          'raster-fade-duration': 300
        }
      },
      {
        id: 'bluemarble',
        type: 'raster',
        source: 'bluemarble',
        maxzoom: handoff.blueMarbleCutoff,
        paint: {
          ...graded(grade.blueMarble),
          'raster-opacity': 1,
          'raster-fade-duration': 300
        }
      },
      ...buildOverlays(c, { includeRoads: true, satOutlines: true })
    ]
  };

  if (sentinel.enabled) {
    style.sources.satellite = {
      type: 'raster',
      tiles: [sources.satelliteTiles],
      tileSize: 256,
      maxzoom: 14,
      attribution: attribution.eox
    };
    const at = style.layers.findIndex((l) => l.id === 'bluemarble') + 1;
    style.layers.splice(at, 0, {
      id: 'satellite',
      type: 'raster',
      source: 'satellite',
      minzoom: handoff.fadeStart,
      ...(awsEnabled ? { maxzoom: handoff.awsFadeEnd } : {}),
      paint: {
        ...graded(grade.sentinel2),
        'raster-opacity': [
          'interpolate', ['linear'], ['zoom'],
          handoff.fadeStart, 0,
          handoff.fadeEnd, 1
        ]
      }
    });
  }

  if (awsEnabled) {
    const { region, tileset, apiKey, tileSize, maxzoom } = awsLocation;
    style.sources['aws-satellite'] = {
      type: 'raster',
      tiles: [
        `https://maps.geo.${region}.amazonaws.com/v2/tiles/${tileset}` +
        `/{z}/{x}/{y}?key=${encodeURIComponent(apiKey)}`
      ],
      tileSize,
      maxzoom,
      attribution: attribution.aws
    };
    const at = style.layers.findIndex((l) => l.id === 'satellite') + 1;
    style.layers.splice(at > 0 ? at : style.layers.findIndex((l) => l.id === 'bluemarble') + 1, 0, {
      id: 'aws-satellite',
      type: 'raster',
      source: 'aws-satellite',
      minzoom: handoff.awsFadeStart,
      paint: {
        ...graded(grade.awsSatellite),
        'raster-opacity': [
          'interpolate', ['linear'], ['zoom'],
          handoff.awsFadeStart, 0,
          handoff.awsFadeEnd, 1
        ]
      }
    });
  }

  prioritizeLabels(style);
  return style;
}
