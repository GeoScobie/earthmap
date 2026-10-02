// ---------------------------------------------------------------------------
// FIRMS / satellite hotspot infoBox — FireMap.live 1:1
//
// Paint lives in fire.js (`fire-points-active`, `fire-hotspots`).
// Click → #infoBox uses the same HTML + caveats as FireMap
// firmsHotspotToHtml / createFirePointInteractionHandlers.
// ---------------------------------------------------------------------------

import { injectNextPassStyles } from './next-pass.js';
import { createFirePointInteractionHandlers } from './agency-fires.js';

const NP_DETECT_EPOCH_KEYS = [
  'detect_epoch',
  'detectepoch',
  'detection_epoch',
  'detect_epoch_utc'
];

function esc(s) {
  return String(s === null || typeof s === 'undefined' ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

function npLocalFull(ms) {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
}

function npUtcLabel(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

/** Resolve detection epoch (unix seconds) from FIRMS feature props. */
export function npResolveDetectEpoch(p) {
  if (!p) return null;
  for (let i = 0; i < NP_DETECT_EPOCH_KEYS.length; i++) {
    const k = NP_DETECT_EPOCH_KEYS[i];
    const v = p[k];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    let n = Number(v);
    if (Number.isNaN(n) || n <= 0) continue;
    if (n > 1e12) n = n / 1000;
    console.debug('[hotspot-age] epoch from "' + k + '" =', n);
    return { sec: n, src: k };
  }
  if (p.time_diff !== undefined && p.time_diff !== null && !Number.isNaN(Number(p.time_diff))) {
    console.debug('[hotspot-age] NO epoch attribute; fallback time_diff =', p.time_diff);
    return { sec: (Date.now() - Number(p.time_diff) * 3600000) / 1000, src: 'time_diff' };
  }
  if (
    p.hours_since_update !== undefined &&
    p.hours_since_update !== null &&
    !Number.isNaN(Number(p.hours_since_update))
  ) {
    console.debug(
      '[hotspot-age] NO epoch attribute; fallback hours_since_update =',
      p.hours_since_update
    );
    return {
      sec: (Date.now() - Number(p.hours_since_update) * 3600000) / 1000,
      src: 'hours_since_update'
    };
  }
  console.debug('[hotspot-age] no usable time attribute | keys:', Object.keys(p).join(','));
  return null;
}

function npFirmsDetectionNoteHTML() {
  return `
    <details class="np-firms-note">
      <summary>&#9432; About satellite hotspots</summary>
      <div class="np-firms-note-body">
        <p><strong>A hotspot is a heat detection, not a confirmed fire.</strong>
        Each point marks the centre of a satellite pixel roughly 375&nbsp;m to
        2&nbsp;km across. The heat source sits somewhere inside that footprint,
        not necessarily at the centre.</p>
        <p><strong>No detection does not mean no fire.</strong> Cloud, thick
        smoke and dense canopy all hide fires, and each satellite only sees a
        given location on its overpass.</p>
        <p class="np-firms-note-warn">Do not use this layer for evacuation or
        life-safety decisions. Follow your local fire agency.</p>
      </div>
    </details>`;
}

export function firmsHotspotToHtml(p, title) {
  injectNextPassStyles();
  title = title || 'NASA FIRMS Hotspot';
  const satName = p.satellite || p.satellite_name || 'Satellite';

  const npEpoch = npResolveDetectEpoch(p);
  const epochSec = npEpoch ? npEpoch.sec : null;

  let dynamicHeadline = '';
  if (epochSec) {
    const epochMs = epochSec * 1000;
    const elapsedMs = Math.max(0, Date.now() - epochMs);
    const elapsedText = npFormatElapsed(elapsedMs);

    let metaDetails = `<span class="np-plat">${esc(satName)}</span>`;
    if (p.daynight) {
      const isNight = String(p.daynight).toUpperCase() === 'N';
      metaDetails +=
        `<span class="np-glyph ${isNight ? 'np-glyph-night' : 'np-glyph-day'}" ` +
        `title="${isNight ? 'Night pass' : 'Daylight pass'}">` +
        `${isNight ? '\u263E' : '\u2600'}</span>`;
    }

    dynamicHeadline = `
        <div class="np-headline" style="margin-bottom: 8px;">
          <div class="np-count" aria-hidden="true">
            <span class="np-count-val" data-np-detect-epoch="${epochSec}">${elapsedText}</span>
          </div>
          <div class="np-meta">${metaDetails}</div>
          <p class="np-when">${esc(npLocalFull(epochMs))}
            <span class="np-utc">${esc(npUtcLabel(epochMs))}</span>
          </p>
        </div>`;
  }

  let extraDetails = '';
  if (p.confidence !== undefined && p.confidence !== null && p.confidence !== '') {
    extraDetails += `<strong>Confidence:</strong> ${esc(p.confidence)}<br>`;
  }
  if (p.frp !== undefined && p.frp !== null && p.frp !== '') {
    extraDetails += `<strong>FRP:</strong> ${esc(p.frp)} MW<br>`;
  }
  if (p.brightness || p.bright_ti4) {
    extraDetails += `<strong>Brightness:</strong> ${esc(p.brightness || p.bright_ti4)} K<br>`;
  }
  if (p.satellite_returns_24hrs) {
    extraDetails += `<strong>Returns (24hrs):</strong> ${esc(p.satellite_returns_24hrs)}<br>`;
  }

  const primaryHtml = dynamicHeadline || `<strong>Satellite:</strong> ${esc(satName)}<br>`;
  return `<h3>${esc(title)}</h3>` + primaryHtml +
    (extraDetails ? `<div class="np-more-body" style="margin-top:6px;">${extraDetails}</div>` : '') +
    npFirmsDetectionNoteHTML();
}

/**
 * Wire click → #infoBox for FIRMS layers from fire.js.
 * Call after addFireLayers (layers exist) + addAgencyFireLayers (mapRef).
 * Passes map explicitly so handlers bind even if mapRef timing shifts.
 */
export function wireFirmsHotspotInteractions(map) {
  if (!map) return;
  const bind = () => {
    createFirePointInteractionHandlers(
      'fire-points-active',
      (p) => firmsHotspotToHtml(p, 'NASA FIRMS Hotspot'),
      map
    );
    createFirePointInteractionHandlers(
      'fire-hotspots',
      (p) => firmsHotspotToHtml(p, 'Satellite Hotspot'),
      map
    );
  };
  if (map.getLayer('fire-hotspots') || map.getLayer('fire-points-active')) {
    bind();
    return;
  }
  // fire.js should have added them already; one-frame retry if style mid-load.
  requestAnimationFrame(bind);
}
