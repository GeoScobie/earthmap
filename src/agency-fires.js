// ---------------------------------------------------------------------------
// Incident fire points (US / Canada / Australia / Europe)
//
// 1:1 port of FireMap.live GeoJSON WFS fire-point stacks from firemap-script.js:
//   addUSAFirePointsLayer / addCanadaFirePointsLayer /
//   addAustralianFirePointsLayer / addEuropeFirePointsLayer
// plus paint, pulse, FoN labels, click → #infoBox popups.
//
// Next-pass (Hotspot forecast) + FDR cards: see ./next-pass.js
// (WFS FireDB:satellite_next_pass_northamerica — not satellite_orbit_12hr).
// USA FWI from FireDB:usa_fire_pt_active_2026 (fwi_0..fwi_6 live GEFF): see ./us-fwi-placeholder.js
// ---------------------------------------------------------------------------

import {
  clearNextPassCard,
  injectNextPassStyles,
  npClearFDRCard,
  npRenderFDRCard,
  renderNextPassCard
} from './next-pass.js';
import {
  clearUsFwiPlaceholder,
  renderUsFwiPlaceholder
} from './us-fwi-placeholder.js';

const GEOSERVER_CDN = 'https://geo.firemap.live/geoserver/ows';
const GEOSERVER_ORIGIN = 'https://geo-origin.firemap.live/geoserver/ows';
// Prefer CDN (matches FireMap agency URLs). Both send Access-Control-Allow-Origin: *.
let WFS_BASE = GEOSERVER_CDN;

const NP_PULSE_DURATION_MS = 1750;
const NP_PULSE_ZOOM_SCALE = true;
const NP_PULSE_RECENCY_GATE = false;
const NP_PULSE_MAX_AGE_MIN = 60;

const STYLE_ID = 'np-agency-fire-styles';

/** Layer ids owned by this module (circle + pulse pair + FoN labels). */
export const AGENCY_FIRE_LAYER_IDS = {
  usa: [
    'usa-fire-points-pulse-outer',
    'usa-fire-points-pulse',
    'usa-fire-points',
    'usa-fire-points-labels-fon'
  ],
  canada: [
    'canada-fire-points-pulse-outer',
    'canada-fire-points-pulse',
    'canada-fire-points',
    'canada-fire-points-labels-fon'
  ],
  aus: [
    'fire-points-aus-pulse-outer',
    'fire-points-aus-pulse',
    'fire-points-aus',
    'fire-points-aus-labels-fon'
  ],
  europe: [
    'fire-points-europe-pulse-outer',
    'fire-points-europe-pulse',
    'fire-points-europe',
    'fire-points-europe-labels-fon'
  ]
};

const ALL_AGENCY_IDS = [
  ...AGENCY_FIRE_LAYER_IDS.europe,
  ...AGENCY_FIRE_LAYER_IDS.aus,
  ...AGENCY_FIRE_LAYER_IDS.usa,
  ...AGENCY_FIRE_LAYER_IDS.canada
];

// Hotspot / perimeter ids in DisasterDB (fire.js) to keep below agency stacks.
const HOTSPOT_BELOW_IDS = [
  'fire-historical-fill',
  'fire-perimeter-fill',
  'fire-perimeter-outline',
  'fire-hotspots',
  'fire-points-active'
];

let mapRef = null;

/** In-memory agency GeoJSON features for banner search (US/CA/AU/EU). */
const agencyFirePool = {
  usa: [],
  canada: [],
  aus: [],
  europe: []
};

const AGENCY_SEARCH_STACKS = [
  { key: 'usa', sourceId: 'usa-fire-data', circleLayerId: 'usa-fire-points', isUsa: true },
  { key: 'canada', sourceId: 'canada-fire-data', circleLayerId: 'canada-fire-points', isUsa: false },
  { key: 'aus', sourceId: 'fire-data-aus', circleLayerId: 'fire-points-aus', isUsa: false },
  { key: 'europe', sourceId: 'fire-data-europe', circleLayerId: 'fire-points-europe', isUsa: false }
];

const activePulseLayers = new Set();
const npActivePulseLayers = new Set();
let pulseAnimationId = null;
let npPulseAnimationId = null;
let pulseFilterTicker = null;
let hotspotTicker = null;
let closeInstalled = false;

// ---------------------------------------------------------------------------
// Paint / pulse / name helpers (FireMap 1:1)
// ---------------------------------------------------------------------------

export function getFireLayerPaintProperties() {
  return {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      0, ['match', ['get', 'fire_status'],
        'Fire of Note', 2.23,
        'Out of Control', 1.155,
        'Out', 0.5,
        'Being Held', 1.2,
        'Under Control', 1.2,
        0.5],
      12, ['match', ['get', 'fire_status'],
        'Fire of Note', 13.781,
        'Out of Control', 7.26,
        'Out', 4.4,
        'Being Held', 7.2,
        'Under Control', 7.2,
        5]
    ],
    'circle-color': [
      'match', ['get', 'fire_status'],
      'Fire of Note', '#ff0000',
      'Out of Control', '#ff4500',
      'Out', '#696969',
      'Being Held', '#ff7f50',
      'Under Control', '#ff7f50',
      '#ff0000'
    ],
    'circle-stroke-color': [
      'match', ['get', 'fire_status'],
      'Fire of Note', '#8B0000',
      'Out of Control', '#8B0000',
      'Out', '#8B0000',
      'Being Held', '#ffff00',
      'Under Control', '#ffff00',
      '#000000'
    ],
    'circle-stroke-width': [
      'match', ['get', 'fire_status'],
      'Fire of Note', 2,
      'Out of Control', 2,
      'Out', 1,
      'Being Held', 1,
      'Under Control', 1,
      1
    ]
  };
}

function npParseCompactUtc(v) {
  if (v === null || typeof v === 'undefined') return null;
  const s = String(v).trim();
  if (!/^\d{14}$/.test(s)) return null;
  return Date.UTC(
    +s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8),
    +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14)
  );
}

function npPulseCutoffStr() {
  const d = new Date(Date.now() - NP_PULSE_MAX_AGE_MIN * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return '' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
    p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds());
}

export function npPulseFilter() {
  const f = [
    'all',
    ['==', ['get', 'fire_status'], 'Fire of Note'],
    ['>', ['to-number', ['coalesce', ['get', 'heatsigfcidetections_last_hour'], 0]], 0]
  ];
  if (NP_PULSE_RECENCY_GATE) {
    f.push(['>=', ['coalesce', ['get', 'heatsigfciacqtime'], ''], npPulseCutoffStr()]);
  }
  return f;
}

function npPulseScale() {
  if (!NP_PULSE_ZOOM_SCALE || !mapRef) return 1;
  const z = mapRef.getZoom();
  if (z >= 8) return 1;
  if (z <= 3) return 0.35;
  return 0.35 + ((z - 3) / 5) * 0.65;
}

function startFirePulseAnimation() {
  if (pulseAnimationId) return;
  if (typeof requestAnimationFrame !== 'function') return;

  function frame(timestamp) {
    const progress = (timestamp % NP_PULSE_DURATION_MS) / NP_PULSE_DURATION_MS;
    const breathe = (Math.sin(progress * Math.PI * 2) + 1) / 2;
    const s = npPulseScale();
    const map = mapRef;

    activePulseLayers.forEach((layerId) => {
      const outerId = layerId + '-outer';
      if (map && map.getLayer(layerId) && map.getLayer(outerId)) {
        map.setPaintProperty(layerId, 'circle-radius', (7 + breathe * 5.5) * s);
        map.setPaintProperty(layerId, 'circle-blur', 0.15 + breathe * 0.4);
        map.setPaintProperty(layerId, 'circle-opacity', 0.4 + breathe * 0.4);
        map.setPaintProperty(outerId, 'circle-radius', (7 + progress * 24) * s);
        map.setPaintProperty(outerId, 'circle-stroke-opacity', Math.max(0, (1 - progress) * 0.95));
        map.setPaintProperty(outerId, 'circle-stroke-width', (1.2 + (1 - progress) * 2.2) * Math.max(0.5, s));
        map.setPaintProperty(outerId, 'circle-opacity', Math.max(0, (1 - progress) * 0.95) * 0.18);
      }
    });
    pulseAnimationId = requestAnimationFrame(frame);
  }
  pulseAnimationId = requestAnimationFrame(frame);
}

export function addFirePulsingLayer(sourceId, pulseLayerId) {
  const map = mapRef;
  if (!map) return;
  const outerRingId = pulseLayerId + '-outer';
  if (map.getLayer(outerRingId)) map.removeLayer(outerRingId);
  if (map.getLayer(pulseLayerId)) map.removeLayer(pulseLayerId);

  const pulseFilter = npPulseFilter();
  const before = firstLabelId(map);

  map.addLayer({
    id: outerRingId,
    type: 'circle',
    source: sourceId,
    filter: pulseFilter,
    paint: {
      'circle-radius': 12,
      'circle-color': '#FF0000',
      'circle-opacity': 0.15,
      'circle-stroke-color': '#8B0000',
      'circle-stroke-width': 2,
      'circle-stroke-opacity': 0.9,
      'circle-blur': 0.15
    }
  }, before);

  map.addLayer({
    id: pulseLayerId,
    type: 'circle',
    source: sourceId,
    filter: pulseFilter,
    paint: {
      'circle-radius': 8,
      'circle-color': '#FF3300',
      'circle-opacity': 0.6,
      'circle-stroke-color': '#8B0000',
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': 0.85,
      'circle-blur': 0.3
    }
  }, before);

  activePulseLayers.add(pulseLayerId);
  startFirePulseAnimation();

  if (!pulseFilterTicker) {
    pulseFilterTicker = setInterval(() => {
      const f = npPulseFilter();
      activePulseLayers.forEach((id) => {
        try {
          if (mapRef.getLayer(id)) mapRef.setFilter(id, f);
          if (mapRef.getLayer(id + '-outer')) mapRef.setFilter(id + '-outer', f);
        } catch { /* layer gone */ }
      });
    }, 60000);
  }
}

function npStartFirePulseAnimation() {
  if (npPulseAnimationId) return;
  if (typeof requestAnimationFrame !== 'function') return;
  const DURATION = 1750;

  function frame(timestamp) {
    const progress = (timestamp % DURATION) / DURATION;
    const breathe = (Math.sin(progress * Math.PI * 2) + 1) / 2;
    const map = mapRef;

    npActivePulseLayers.forEach((layerId) => {
      const outerId = layerId + '-outer';
      if (map && map.getLayer(layerId) && map.getLayer(outerId)) {
        map.setPaintProperty(layerId, 'circle-radius', 7 + breathe * 5.5);
        map.setPaintProperty(layerId, 'circle-blur', 0.15 + breathe * 0.4);
        map.setPaintProperty(layerId, 'circle-opacity', 0.4 + breathe * 0.4);
        map.setPaintProperty(outerId, 'circle-radius', 7 + progress * 24);
        map.setPaintProperty(outerId, 'circle-stroke-opacity', Math.max(0, (1 - progress) * 0.95));
        map.setPaintProperty(outerId, 'circle-stroke-width', 1.2 + (1 - progress) * 2.2);
        map.setPaintProperty(outerId, 'circle-opacity', Math.max(0, (1 - progress) * 0.95) * 0.18);
      }
    });
    npPulseAnimationId = requestAnimationFrame(frame);
  }
  npPulseAnimationId = requestAnimationFrame(frame);
}

export function npAddAnimatedPulseLayers(sourceId, pulseLayerId, pulseFilter) {
  const map = mapRef;
  if (!map) return;
  const outerRingId = pulseLayerId + '-outer';
  if (map.getLayer(pulseLayerId)) map.removeLayer(pulseLayerId);
  if (map.getLayer(outerRingId)) map.removeLayer(outerRingId);
  const before = firstLabelId(map);

  map.addLayer({
    id: outerRingId,
    type: 'circle',
    source: sourceId,
    filter: pulseFilter,
    paint: {
      'circle-radius': 12,
      'circle-color': '#FF0000',
      'circle-opacity': 0.15,
      'circle-stroke-color': '#8B0000',
      'circle-stroke-width': 2,
      'circle-stroke-opacity': 0.9,
      'circle-blur': 0.15
    }
  }, before);

  map.addLayer({
    id: pulseLayerId,
    type: 'circle',
    source: sourceId,
    filter: pulseFilter,
    paint: {
      'circle-radius': 8,
      'circle-color': '#FF3300',
      'circle-opacity': 0.6,
      'circle-stroke-color': '#8B0000',
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': 0.85,
      'circle-blur': 0.3
    }
  }, before);

  npActivePulseLayers.add(pulseLayerId);
  npStartFirePulseAnimation();
}

export function formatFireNameTwoLines(features) {
  if (!features || !Array.isArray(features)) return;
  features.forEach((feature) => {
    if (feature.properties && feature.properties.fire_name) {
      const nameParts = feature.properties.fire_name.split(' ');
      let line1 = '';
      let line2 = '';
      const maxLengthPerLine = 10;

      for (let i = 0; i < nameParts.length; i++) {
        if (line1.length === 0) {
          line1 = nameParts[i];
        } else if (
          (line1 + ' ' + nameParts[i]).length <= maxLengthPerLine ||
          (nameParts.length - 1 === i && line2.length === 0)
        ) {
          line1 += ' ' + nameParts[i];
        } else if (line2.length === 0) {
          line2 = nameParts[i];
        } else {
          line2 += ' ' + nameParts[i];
        }
      }
      feature.properties.formatted_fire_name = line1;
      if (line2) feature.properties.formatted_fire_name += '\n' + line2;
    } else if (feature.properties) {
      feature.properties.formatted_fire_name = feature.properties.fire_name || 'Unknown Fire';
    }
  });
}

export function npMoveHotspotsBelowAgencyPoints() {
  const map = mapRef;
  if (!map) return;
  if (!map.getStyle()?.layers) return;

  // Keep agency circles (+ pulses) above Protomaps roads_*/buildings and under
  // Lexend place/road labels — matches FireMap "points readable over streets".
  const labelBefore = firstLabelId(map);
  if (labelBefore) {
    const pointIds = ALL_AGENCY_IDS.filter((id) => !id.endsWith('-labels-fon'));
    // Bottom → top among point layers: move in array order so pulses stay under circles.
    pointIds.forEach((id) => {
      if (map.getLayer(id) && map.getLayer(labelBefore)) {
        try { map.moveLayer(id, labelBefore); } catch (err) {
          console.error('[agency-fires] layer order (above roads):', err.message);
        }
      }
    });
    // FoN labels above their circles, still under place labels.
    ALL_AGENCY_IDS.filter((id) => id.endsWith('-labels-fon')).forEach((id) => {
      if (map.getLayer(id) && map.getLayer(labelBefore)) {
        try { map.moveLayer(id, labelBefore); } catch (err) {
          console.error('[agency-fires] layer order (FoN):', err.message);
        }
      }
    });
  }

  // Refresh style after agency moves — snapshot above may be stale.
  const layersNow = map.getStyle()?.layers || [];
  const anchor = layersNow.find((l) => ALL_AGENCY_IDS.indexOf(l.id) !== -1);
  if (!anchor) return;
  HOTSPOT_BELOW_IDS.forEach((id) => {
    if (map.getLayer(id)) {
      try { map.moveLayer(id, anchor.id); } catch (err) {
        console.error('[agency-fires] layer order:', err.message);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Info box HTML (FireMap popup content)
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s === null || typeof s === 'undefined' ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function npFmtArea(v) {
  const n = Number(String(v).replace(/,/g, ''));
  if (v === null || typeof v === 'undefined' || String(v).trim() === '' || Number.isNaN(n)) {
    return 'Unknown';
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function npInfoBoxLayout(primaryHtml, restHtml) {
  return `<div class="np-primary">${primaryHtml}</div>` +
    (restHtml && restHtml.trim()
      ? `<details class="np-more"><summary>More details</summary>` +
        `<div class="np-more-body">${restHtml}</div></details>`
      : '') +
    `<div id="npCardSlot"></div>`;
}

function npFormatElapsed(elapsedMs) {
  if (elapsedMs <= 0) return 'detected just now';
  const totalSec = Math.floor(elapsedMs / 1000);
  const min = Math.floor(totalSec / 60);
  if (totalSec < 60) return `${totalSec}s ago`;
  if (min < 10) return `${min} min ${String(totalSec % 60).padStart(2, '0')} s ago`;
  if (min < 90) return `${min} min ago`;
  if (min < 360) return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m ago`;
  return `${Math.round(min / 60)} hours ago`;
}

function clearHotspotTicker() {
  if (hotspotTicker) {
    clearInterval(hotspotTicker);
    hotspotTicker = null;
  }
}

function tickHotspots() {
  const box = document.getElementById('infoBox');
  if (!box || box.style.display === 'none') {
    clearHotspotTicker();
    return;
  }
  const els = box.querySelectorAll('[data-np-detect-epoch]');
  if (!els.length) {
    clearHotspotTicker();
    return;
  }
  const now = Date.now();
  els.forEach((el) => {
    const epochSec = Number(el.dataset.npDetectEpoch);
    if (!Number.isNaN(epochSec) && epochSec > 0) {
      el.textContent = npFormatElapsed(Math.max(0, now - epochSec * 1000));
    }
  });
}

function startHotspotTicker() {
  clearHotspotTicker();
  tickHotspots();
  hotspotTicker = setInterval(tickHotspots, 1000);
}

function npFciDetectionNoteHTML() {
  injectStyles();
  return `
    <details class="np-firms-note">
      <summary>&#9432; About these heat detections</summary>
      <div class="np-firms-note-body">
        <p>Heat signatures come from <strong>Meteosat MTG FCI</strong>, a
        geostationary satellite that rescans Europe every few minutes --
        pixels are a few kilometres across.</p>
        <p><strong>Geostationary detections can be false positives.</strong>
        Sun glint, hot bare ground and cloud edges can all register as heat,
        and the source location is approximate.</p>
        <p class="np-firms-note-warn">Do not use these detections for
        evacuation or life-safety decisions. Follow your local fire
        agency.</p>
      </div>
    </details>`;
}

function npHeatDetectedHtml(p) {
  const ms = npParseCompactUtc(p.heatsigfciacqtime);
  if (ms === null) return '';
  const epochSec = ms / 1000;
  const elapsed = npFormatElapsed(Math.max(0, Date.now() - ms));
  return `<strong>Last heat detection (MTG FCI):</strong> <span style="color:#FF4500; font-weight:bold;" data-np-detect-epoch="${epochSec}">${elapsed}</span><br>`;
}

export function usaFirePropertiesToHtml(p) {
  let heatSigHtml = '';
  if (
    p.heatsigfcidetections_last_hour !== undefined &&
    p.heatsigfcidetections_last_hour !== null &&
    String(p.heatsigfcidetections_last_hour).trim() !== ''
  ) {
    heatSigHtml =
      `<br><strong>Heat sigs (recent hours):</strong> <span style="color:#FF4500; font-weight:bold;">${esc(p.heatsigfcidetections_last_hour)}</span>`;
    const npHd = npHeatDetectedHtml(p);
    if (npHd) heatSigHtml += `<br>` + npHd.replace(/<br>$/, '');
    heatSigHtml += npFciDetectionNoteHTML();
  }
  const npPrimary =
    `<strong>Status:</strong> ${esc(p.fire_status || 'Unknown')}<br>` +
    `<strong>Size (acres):</strong> ${npFmtArea(p.size_acres)}<br>` +
    `<strong>Daily Acres:</strong> ${esc(p.daily_acres || 'Unknown')}<br>` +
    `<strong>Percent Contained:</strong> ${esc(p.percent_contained || 'Unknown')}%` +
    heatSigHtml;
  const npRest =
    `<strong>Cause:</strong> ${esc(p.fire_cause || 'Unknown')}<br>` +
    `<strong>Total Personnel:</strong> ${esc(p.totalincidentpersonnel || 'Unknown')}<br>` +
    `<strong>Duration (days):</strong> ${esc(p.fire_duration_days || 'Unknown')}<br>` +
    `<strong>Ignition Date:</strong> ${esc(p.ignition_date || 'Unknown')}<br>` +
    `<strong>Last Update (days ago):</strong> ${esc(p.last_update_days || 'Unknown')}`;
  return `<h3>${esc(p.fire_name || 'Unknown Fire')}</h3>` + npInfoBoxLayout(npPrimary, npRest);
}

export function genericFirePropertiesToHtml(p) {
  const riskColorMap = {
    Low: '#28a745',
    Moderate: '#007bff',
    High: '#ffc107',
    'Very High': '#fd7e14',
    Extreme: '#dc3545',
    'Very Extreme': '#dc3545'
  };
  const defaultRiskColor = '#6c757d';
  let riskHtml = '';
  let riskValueProperty;
  const riskLabel = 'Daily fire danger risk:';

  const hasFdrCard =
    (typeof p.fdr_daily !== 'undefined' && p.fdr_daily !== null) ||
    (typeof p.fwi_daily !== 'undefined' && p.fwi_daily !== null) ||
    (typeof p.fwi_d2 !== 'undefined' && p.fwi_d2 !== null) ||
    (typeof p.fwi_d1 !== 'undefined' && p.fwi_d1 !== null) ||
    (typeof p.fwi !== 'undefined' && p.fwi !== null);

  if (!hasFdrCard && typeof p.fwi_daily !== 'undefined' && p.fwi_daily !== null) {
    riskValueProperty = p.fwi_daily;
  }

  if (typeof riskValueProperty !== 'undefined') {
    const displayRiskValue = String(riskValueProperty).trim() || 'Unknown';
    const riskColor = riskColorMap[displayRiskValue] || defaultRiskColor;
    const fontWeightStyle = displayRiskValue === 'Very Extreme' ? 'font-weight: bold;' : '';
    riskHtml =
      `<strong>${riskLabel}</strong> <span style="color: ${riskColor}; ${fontWeightStyle}">${esc(displayRiskValue)}</span><br>`;
  }

  let weatherHtml = '';
  if (
    (typeof p.wind_string !== 'undefined' && p.wind_string !== null && p.wind_string !== '') ||
    (typeof p.wind_dir !== 'undefined' && p.wind_dir !== null && p.wind_dir !== '')
  ) {
    weatherHtml += `<strong>Wind:</strong> ${esc(p.wind_string || 'N/A')}`;
    if (typeof p.wind_dir !== 'undefined' && p.wind_dir !== null && p.wind_dir !== '') {
      weatherHtml += ` (${esc(p.wind_dir)})`;
    }
    weatherHtml += `<br>`;
  }
  if (typeof p.temp_string !== 'undefined' && p.temp_string !== null && p.temp_string !== '') {
    weatherHtml += `<strong>Temperature:</strong> ${esc(p.temp_string || 'N/A')}<br>`;
  }
  if (typeof p.rh_pct !== 'undefined' && p.rh_pct !== null) {
    weatherHtml += `<strong>Relative Humidity:</strong> ${esc(p.rh_pct)}%<br>`;
  }

  let lastUpdateHtml = `<strong>Last Update:</strong> Unknown<br>`;
  if (typeof p.lastupdate_hours !== 'undefined' && p.lastupdate_hours !== null) {
    lastUpdateHtml = `<strong>Last Update (hours):</strong> ${esc(p.lastupdate_hours)}<br>`;
  } else if (typeof p.lastupdate_firedb !== 'undefined' && p.lastupdate_firedb !== null) {
    lastUpdateHtml = `<strong>Last Update:</strong> ${esc(p.lastupdate_firedb || 'Unknown')}<br>`;
  }

  let heatSigHtml = npHeatDetectedHtml(p);
  if (
    p.heatsigfcidetections_last_hour !== undefined &&
    p.heatsigfcidetections_last_hour !== null &&
    String(p.heatsigfcidetections_last_hour).trim() !== ''
  ) {
    heatSigHtml +=
      `<strong>Heat sigs (recent hours):</strong> <span style="color:#FF4500; font-weight:bold;">${esc(p.heatsigfcidetections_last_hour)}</span><br>`;
  }
  if (heatSigHtml) heatSigHtml += npFciDetectionNoteHTML();

  const npPrimary =
    `<strong>Status:</strong> ${esc(p.fire_status || 'Unknown')}<br>` +
    `<strong>Size (ha):</strong> ${npFmtArea(p.size_ha)}<br>` +
    `${heatSigHtml}` +
    `${riskHtml}`;
  const npRest =
    `${weatherHtml}` +
    `<strong>Fire ID:</strong> ${esc(p.fire_id_source || 'Unknown')}<br>` +
    `<strong>Cause:</strong> ${esc(p.fire_cause || 'Unknown')}<br>` +
    `<strong>Duration (days):</strong> ${esc(p.duration_days || 'Unknown')}<br>` +
    `<strong>Ignition Date:</strong> ${esc(p.ignition_date || 'Unknown')}<br>` +
    `${lastUpdateHtml}`;
  return `<h2>${esc(p.fire_name || 'Unknown Fire')}</h2>` + npInfoBoxLayout(npPrimary, npRest);
}

export function closeInfoBox() {
  const box = document.getElementById('infoBox');
  if (box) {
    box.innerHTML = '';
    box.style.display = 'none';
    box.classList.remove('active');
  }
  clearNextPassCard();
  npClearFDRCard();
  clearUsFwiPlaceholder();
  clearHotspotTicker();
}

function installInfoBoxClose() {
  const box = ensureInfoBox();
  if (!box || closeInstalled) return;
  closeInstalled = true;
  injectStyles();

  const ensure = () => {
    if (box.style.display === 'none' || !box.innerHTML.trim()) return;
    if (box.querySelector('.np-close')) return;
    const rail = document.createElement('div');
    rail.className = 'np-close-rail';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'np-close';
    b.setAttribute('aria-label', 'Close fire details');
    b.title = 'Close';
    b.textContent = '\u00D7';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      closeInfoBox();
    });
    rail.appendChild(b);
    box.insertBefore(rail, box.firstChild);
  };

  new MutationObserver(ensure).observe(box, {
    childList: true,
    attributes: true,
    attributeFilter: ['style']
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && box.style.display !== 'none' && box.innerHTML.trim()) {
      closeInfoBox();
    }
  });

  // Expose for satellite.js dismiss wrapping if present.
  if (typeof window !== 'undefined') {
    window.closeInfoBox = closeInfoBox;
  }

  ensure();
}

/** Ensure #infoBox exists (standalone.html has it; vite index.html may not). */
export function ensureInfoBox() {
  let box = document.getElementById('infoBox');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'infoBox';
  box.className = 'info-box';
  document.body.appendChild(box);
  return box;
}

/**
 * Click → #infoBox for a circle/symbol layer (FireMap 1:1).
 * @param {string} layerId
 * @param {(props: object) => string} dataTransformer
 * @param {import('maplibre-gl').Map} [mapInstance] — defaults to mapRef
 */
export function createFirePointInteractionHandlers(layerId, dataTransformer, mapInstance) {
  const map = mapInstance || mapRef;
  if (!map) return;
  if (!mapRef) mapRef = map;
  ensureInfoBox();
  installInfoBoxClose();

  // Layer must exist for MapLibre's layer-scoped mouse events to bind.
  if (!map.getLayer(layerId)) {
    console.warn('[agency-fires] no layer to bind clicks:', layerId);
    return;
  }

  map.on('click', layerId, (e) => {
    if (!e.features || !e.features.length) return;
    if (e.preventDefault) e.preventDefault();
    const geom = e.features[0].geometry;
    if (!geom || !geom.coordinates) return;
    const coordinates = geom.coordinates.slice();
    const properties = e.features[0].properties || {};
    clearHotspotTicker();
    const description = dataTransformer(properties);
    const targetZoom = 10;
    const box = ensureInfoBox();
    box.innerHTML = description;
    box.style.display = 'block';
    box.classList.add('active');
    if (document.querySelector('#infoBox [data-np-detect-epoch]')) {
      startHotspotTicker();
    }
    injectNextPassStyles();
    renderNextPassCard(properties, coordinates);
    npRenderFDRCard(properties);
    // USA-only live FWI from feature fwi_0..fwi_6 (FDR day strip + collapsed 7-day chart).
    if (layerId === 'usa-fire-points') {
      renderUsFwiPlaceholder(properties, coordinates);
    } else {
      clearUsFwiPlaceholder();
    }
    const currentZoom = map.getZoom();
    if (currentZoom >= targetZoom) {
      map.panTo(coordinates);
    } else {
      map.flyTo({ center: coordinates, zoom: targetZoom, essential: true });
    }
  });
  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = '';
  });
}

// ---------------------------------------------------------------------------
// Layer construction
// ---------------------------------------------------------------------------

/** Insert fire circles/pulses under place/road/POI labels, above basemap roads. */
function firstLabelId(map) {
  const layers = map.getStyle()?.layers || [];
  // Carto topo inserts contour-labels (symbol) before roads_* — do not use that
  // as beforeId or agency points end up under streets/buildings when zoomed in.
  const TOP_LABEL =
    /^(place-|roads-label|poi-label|natural-point-label|waterway-label|water-label)/;
  const top = layers.find((l) => l.type === 'symbol' && TOP_LABEL.test(l.id));
  if (top) return top.id;
  const sym = layers.find(
    (l) => l.type === 'symbol' && !String(l.id).startsWith('contour')
  );
  return sym ? sym.id : undefined;
}

function fonLabelSpec(sourceId, labelLayerId) {
  return {
    id: labelLayerId,
    type: 'symbol',
    source: sourceId,
    minzoom: 4,
    filter: ['==', ['get', 'fire_status'], 'Fire of Note'],
    layout: {
      'text-field': ['get', 'formatted_fire_name'],
      'text-font': ['Lexend Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 7, 13, 10, 15],
      'text-offset': [0, 0.8],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-max-width': 8,
      'text-line-height': 1.1
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': '#8B0000',
      'text-halo-width': 1.5,
      'text-halo-blur': 0.5
    }
  };
}

function removeAgencyStack(map, sourceId, circleLayerId, pulseLayerId) {
  const labelLayerId = circleLayerId + '-labels-fon';
  if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
  if (map.getLayer(circleLayerId)) map.removeLayer(circleLayerId);
  if (map.getLayer(pulseLayerId + '-outer')) map.removeLayer(pulseLayerId + '-outer');
  if (map.getLayer(pulseLayerId)) map.removeLayer(pulseLayerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function wfsUrl(typeName) {
  return (
    `${WFS_BASE}?service=WFS&version=1.0.0&request=GetFeature` +
    `&typeName=${encodeURIComponent(typeName)}` +
    `&outputFormat=${encodeURIComponent('application/json')}`
  );
}

async function fetchAgencyGeoJSON(typeName) {
  let res = await fetch(wfsUrl(typeName));
  if (!res.ok && WFS_BASE === GEOSERVER_CDN) {
    console.warn(`[agency-fires] CDN WFS HTTP ${res.status}; retrying geo-origin`);
    WFS_BASE = GEOSERVER_ORIGIN;
    res = await fetch(wfsUrl(typeName));
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if (!d || d.type !== 'FeatureCollection') throw new Error('Invalid GeoJSON');
  return d;
}

function checkboxVisible(checkboxId) {
  const cb = document.getElementById(checkboxId);
  return cb ? cb.checked : true;
}

function setStackVisibility(circleLayerId, visible) {
  const map = mapRef;
  if (!map) return;
  const vis = visible ? 'visible' : 'none';
  const ids = [
    circleLayerId,
    circleLayerId + '-labels-fon',
    circleLayerId + '-pulse',
    circleLayerId + '-pulse-outer'
  ];
  ids.forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
  });
}

async function addAgencyStack({
  typeName,
  sourceId,
  circleLayerId,
  checkboxId,
  htmlFn,
  useNpPulse,
  poolKey
}) {
  const map = mapRef;
  if (!map) return;
  const pulseLayerId = circleLayerId + '-pulse';
  const labelLayerId = circleLayerId + '-labels-fon';

  removeAgencyStack(map, sourceId, circleLayerId, pulseLayerId);

  try {
    const d = await fetchAgencyGeoJSON(typeName);
    formatFireNameTwoLines(d.features);
    if (poolKey && Object.prototype.hasOwnProperty.call(agencyFirePool, poolKey)) {
      agencyFirePool[poolKey] = Array.isArray(d.features) ? d.features.slice() : [];
    }
    map.addSource(sourceId, { type: 'geojson', data: d });

    if (useNpPulse) {
      npAddAnimatedPulseLayers(sourceId, pulseLayerId, npPulseFilter());
    } else {
      addFirePulsingLayer(sourceId, pulseLayerId);
    }

    const before = firstLabelId(map);
    map.addLayer({
      id: circleLayerId,
      type: 'circle',
      source: sourceId,
      paint: getFireLayerPaintProperties()
    }, before);
    createFirePointInteractionHandlers(circleLayerId, htmlFn);
    map.addLayer(fonLabelSpec(sourceId, labelLayerId), before);

    if (!checkboxVisible(checkboxId)) {
      setStackVisibility(circleLayerId, false);
    }

    npMoveHotspotsBelowAgencyPoints();
    console.log(`[agency-fires] ${circleLayerId}: ${d.features.length} features via ${WFS_BASE}`);
  } catch (e) {
    console.error(`[agency-fires] ${circleLayerId}:`, e.message || e);
  }
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
  .np-close-rail { position: sticky; top: 0; height: 0; z-index: 6; }
  .np-close {
    position: absolute; right: -2px; top: -4px;
    background: rgba(43,43,43,0.94); border: 0; color: #C9C9C9;
    font-size: 18px; line-height: 1; padding: 3px 7px;
    cursor: pointer; border-radius: 4px; font-family: inherit;
  }
  .np-close:hover { background: rgba(255,255,255,0.16); color: #FFFFFF; }
  .np-close:focus-visible { outline: 2px solid #FF6347; outline-offset: 1px; }
  #infoBox h2, #infoBox h3 { padding-right: 26px; }
  .np-primary { font-size: 11px; line-height: 1.5; }
  .np-more { margin-top: 8px; }
  .np-more > summary {
    font-size: 10px; color: #FF6347; cursor: pointer;
    padding: 3px 0; list-style: none; user-select: none;
  }
  .np-more > summary::-webkit-details-marker { display: none; }
  .np-more > summary::before { content: '▸ '; }
  .np-more[open] > summary::before { content: '▾ '; }
  .np-more > summary:focus-visible,
  .np-more > summary:focus { outline: 2px solid #FF6347; outline-offset: 2px; border-radius: 2px; }
  .np-more-body { font-size: 11px; line-height: 1.5; margin-top: 2px; }
  #npCardSlot:empty { display: none; }
  #infoBox .np-firms-note { margin-top: 8px; }
  #infoBox .np-firms-note > summary {
    font-size: 10px; color: #FF6347; cursor: pointer;
    padding: 3px 0; list-style: none; user-select: none;
  }
  #infoBox .np-firms-note > summary::-webkit-details-marker { display: none; }
  #infoBox .np-firms-note > summary::before { content: '▸ '; }
  #infoBox .np-firms-note[open] > summary::before { content: '▾ '; }
  #infoBox .np-firms-note-body p {
    font-size: 10px; color: #C9C9C9; line-height: 1.35; margin: 4px 0;
  }
  #infoBox .np-firms-note-body strong { color: #E8E8E8; }
  #infoBox .np-firms-note-body .np-firms-note-warn {
    color: #FFC107; font-weight: 600;
  }
  `;
  document.head.appendChild(s);
}

/**
 * Load all four agency stacks (async WFS). Call after basemap + fire.js layers.
 */
export function addAgencyFireLayers(map) {
  mapRef = map;
  injectStyles();
  injectNextPassStyles();
  installInfoBoxClose();

  // Fire in parallel; each stack reorders hotspots when it lands.
  addAgencyStack({
    typeName: 'FireDB:usa_fire_pt_active_2026',  // live fwi_0..fwi_6 (GEFF on feature)
    sourceId: 'usa-fire-data',
    circleLayerId: 'usa-fire-points',
    checkboxId: 'lyr-usa-fires',
    htmlFn: usaFirePropertiesToHtml,
    poolKey: 'usa',
    useNpPulse: false
  });
  addAgencyStack({
    typeName: 'FireDB:fire_pt_cad_active',
    sourceId: 'canada-fire-data',
    circleLayerId: 'canada-fire-points',
    checkboxId: 'lyr-canada-fires',
    htmlFn: genericFirePropertiesToHtml,
    poolKey: 'canada',
    useNpPulse: false
  });
  addAgencyStack({
    typeName: 'FireDB:fire_pt_aus_active',
    sourceId: 'fire-data-aus',
    circleLayerId: 'fire-points-aus',
    checkboxId: 'lyr-aus-fires',
    htmlFn: genericFirePropertiesToHtml,
    poolKey: 'aus',
    useNpPulse: false
  });
  addAgencyStack({
    typeName: 'FireDB:modis_ba_pt_7day',
    sourceId: 'fire-data-europe',
    circleLayerId: 'fire-points-europe',
    checkboxId: 'lyr-europe-fires',
    htmlFn: genericFirePropertiesToHtml,
    poolKey: 'europe',
    useNpPulse: true
  });
}


/**
 * Search loaded US/CA/AU/EU agency points by fire_name (FoN first, max 12).
 * @param {string} q
 * @returns {Array<{ feature: object, stackKey: string, isUsa: boolean }>}
 */
export function searchAgencyFiresByName(q) {
  const lQ = String(q || '').toLowerCase().trim();
  if (!lQ) return [];
  const seen = new Set();
  const out = [];
  for (const stack of AGENCY_SEARCH_STACKS) {
    const pool = agencyFirePool[stack.key] || [];
    for (const f of pool) {
      const p = f && f.properties;
      if (!p || !p.fire_name) continue;
      if (!String(p.fire_name).toLowerCase().includes(lQ)) continue;
      const coords = f.geometry && f.geometry.coordinates;
      const key =
        String(p.fire_name).toLowerCase() +
        '|' +
        (Array.isArray(coords) ? coords.join(',') : '');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ feature: f, stackKey: stack.key, isUsa: stack.isUsa });
    }
  }
  out.sort((a, b) => {
    const aFon = a.feature.properties.fire_status === 'Fire of Note' ? 0 : 1;
    const bFon = b.feature.properties.fire_status === 'Fire of Note' ? 0 : 1;
    if (aFon !== bFon) return aFon - bFon;
    return String(a.feature.properties.fire_name).localeCompare(
      String(b.feature.properties.fire_name)
    );
  });
  return out.slice(0, 12);
}

/**
 * Open #infoBox + flyTo z10 for a search-selected agency fire (same path as click).
 * @param {import('maplibre-gl').Map} map
 * @param {{ feature: object, isUsa?: boolean }} hit
 */
export function openAgencyFireFromSearch(map, hit) {
  if (!map || !hit || !hit.feature) return;
  const fire = hit.feature;
  const p = fire.properties || {};
  const coords =
    fire.geometry && Array.isArray(fire.geometry.coordinates)
      ? fire.geometry.coordinates.slice()
      : null;
  if (!coords || coords.length < 2) return;

  const htmlFn = hit.isUsa ? usaFirePropertiesToHtml : genericFirePropertiesToHtml;
  clearHotspotTicker();
  const box = ensureInfoBox();
  installInfoBoxClose();
  box.innerHTML = htmlFn(p);
  box.style.display = 'block';
  box.classList.add('active');
  if (document.querySelector('#infoBox [data-np-detect-epoch]')) {
    startHotspotTicker();
  }
  injectNextPassStyles();
  renderNextPassCard(p, coords);
  npRenderFDRCard(p);
  if (hit.isUsa) {
    renderUsFwiPlaceholder(p, coords);
  } else {
    clearUsFwiPlaceholder();
  }
  map.flyTo({ center: coords, zoom: 10, essential: true });
}

/** Wire layer-list checkboxes so they toggle pulse + circle + FoN labels. */
export function wireAgencyFireToggles(map) {
  mapRef = mapRef || map;
  const pairs = [
    ['lyr-usa-fires', 'usa-fire-points'],
    ['lyr-canada-fires', 'canada-fire-points'],
    ['lyr-aus-fires', 'fire-points-aus'],
    ['lyr-europe-fires', 'fire-points-europe']
  ];
  for (const [cbId, circleId] of pairs) {
    const box = document.getElementById(cbId);
    if (!box) continue;
    box.addEventListener('change', () => setStackVisibility(circleId, box.checked));
  }
}
