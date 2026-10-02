// ---------------------------------------------------------------------------
// Next-pass (hotspot forecast) + Fire Danger Rating cards for #infoBox
//
// Port of FireMap.live renderNextPassCard / npRenderFDRCard from firemap-script.js.
// Data: FireDB:satellite_next_pass_northamerica WFS (filtered by fire_name).
// This is NOT the satellite_orbit_12hr track dump in satellite.js — no reuse.
// ---------------------------------------------------------------------------

const GEOSERVER_CDN = 'https://geo.firemap.live/geoserver/ows';
const GEOSERVER_ORIGIN = 'https://geo-origin.firemap.live/geoserver/ows';
let NEXT_PASS_WFS = GEOSERVER_CDN;

const NEXT_PASS_TYPENAME = 'FireDB:satellite_next_pass_northamerica';
const NEXT_PASS_MAX_KM = 100;
const NEXT_PASS_TLE_STALE_H = 48;
const NEXT_PASS_RUN_STALE_H = 6;
const NEXT_PASS_MAX_FEATURES = 200;
const NEXT_PASS_MAX_ROWS = Infinity;
const NEXT_PASS_HEADLINE_TIERS = ['excellent', 'good', 'fair'];
const NP_CACHE_TTL_MS = 5 * 60 * 1000;

const NP_CARD_STYLE_ID = 'npCardStyles';
const NP_FDR_STYLE_ID = 'np-fdr-styles';

const _npCache = new Map();
let _npTicker = null;
let _npTickMs = 0;
let _npAbort = null;
let _npToken = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _npNum(v) {
  if (v === null || typeof v === 'undefined' || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function _npIsYes(v) {
  return String(v || '').trim().toLowerCase() === 'yes';
}

function _npNowUtc() {
  return Date.now();
}

function _npUtcMs(v) {
  if (!v) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(' ', 'T');
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function _npEsc(s) {
  return String(s === null || typeof s === 'undefined' ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _npKm(lon1, lat1, lon2, lat2) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function _npCountdown(msUntilPeak, inProgress, msUntilEnd) {
  if (msUntilEnd !== null && typeof msUntilEnd !== 'undefined' && msUntilEnd <= 0) {
    return 'pass complete';
  }
  if (inProgress || msUntilPeak <= 0) return 'in view now';

  const totalSec = Math.floor(msUntilPeak / 1000);
  const min = Math.floor(totalSec / 60);

  if (min < 10) return `in ${min} min ${String(totalSec % 60).padStart(2, '0')} s`;
  if (min < 90) return `in ${min} min`;
  if (min < 360) return `in ${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
  return `in ${Math.round(min / 60)} hours`;
}

function _npLocalTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function _npLocalFull(ms) {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
}

function _npUtcLabel(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

const NP_TIER_LABEL = { excellent: 'Best', good: 'Good', fair: 'OK', marginal: 'Poor' };
const NP_TIER_HINT = {
  excellent: 'Best viewing conditions for this pass',
  good: 'Good viewing conditions for this pass',
  fair: 'Usable viewing conditions for this pass',
  marginal: 'Weak viewing conditions for this pass'
};

function _npTier(p) {
  const t = String((p && p.detection_tier) || '').trim().toLowerCase();
  return ['excellent', 'good', 'fair', 'marginal'].includes(t) ? t : null;
}

function _npReason(p) {
  const sf = _npNum(p.swath_frac);
  const geom = sf === null ? 'View geometry unknown'
    : sf < 0.3 ? 'Near nadir'
      : sf < 0.7 ? 'Mid-swath'
        : 'Near the swath edge';

  const light = _npIsYes(p.is_night) ? 'at night' : 'in daylight';
  const tier = _npTier(p);
  if (!tier) return `${geom} ${light}.`;

  const verdict = tier === 'excellent' ? 'the best look ahead, cloud permitting'
    : tier === 'good' ? 'a solid look, cloud permitting'
      : tier === 'fair' ? 'a usable look, cloud permitting'
        : 'a weak look at best';

  return `${geom} ${light} — ${verdict}.`;
}

function _npTierBadge(p) {
  const t = _npTier(p);
  return t
    ? `<span class="np-tier np-tier-${t}" title="${_npEsc(NP_TIER_HINT[t])}">` +
      `${NP_TIER_LABEL[t]}</span>`
    : '';
}

function _npTierText(p) {
  const t = _npTier(p);
  if (!t) return '';
  return `<span class="np-tt np-tt-${t}" title="${_npEsc(NP_TIER_HINT[t])}">${NP_TIER_LABEL[t]}</span>`;
}

function _npGlyph(p) {
  const night = _npIsYes(p.is_night);
  const solar = _npNum(p.solar_elev_deg);
  const detail = solar === null ? '' : ` (sun ${solar.toFixed(0)}° at the fire)`;
  const label = night ? `Night pass${detail}` : `Daylight pass${detail}`;
  return `<span class="np-glyph ${night ? 'np-glyph-night' : 'np-glyph-day'}" role="img" ` +
    `aria-label="${_npEsc(label)}" title="${_npEsc(label)}">${night ? '\u263E' : '\u2600'}</span>`;
}

function _npParseAll(features) {
  return (features || [])
    .map((f) => {
      const p = (f && f.properties) || {};
      const peak = _npUtcMs(p.pass_peak_utc);
      const end = _npUtcMs(p.pass_end_utc);
      let lon = null;
      let lat = null;
      if (f && f.geometry && f.geometry.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
        lon = _npNum(f.geometry.coordinates[0]);
        lat = _npNum(f.geometry.coordinates[1]);
      }
      return { p, peak, end, lon, lat, inProgress: _npIsYes(p.in_progress) };
    })
    .filter((r) => r.peak !== null)
    .sort((a, b) => a.peak - b.peak);
}

function _npUpcoming(rows) {
  const now = _npNowUtc();
  return rows.filter((r) => (r.end !== null ? r.end : r.peak) > now - 60000);
}

function _npPickGroup(rows, coordinates) {
  if (!rows.length) return { rows: [], rejected: false };

  const groups = new Map();
  rows.forEach((r) => {
    const k = (r.p.fire_id === null || typeof r.p.fire_id === 'undefined')
      ? '_nofireid'
      : String(r.p.fire_id);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  });

  const haveCoords = Array.isArray(coordinates) &&
    _npNum(coordinates[0]) !== null && _npNum(coordinates[1]) !== null;

  if (!haveCoords) {
    return groups.size === 1 ? { rows, rejected: false } : { rows: [], rejected: true };
  }

  let best = null;
  let bestKm = Infinity;
  groups.forEach((g) => {
    const pts = g.filter((r) => r.lon !== null && r.lat !== null);
    if (!pts.length) return;
    const km = Math.min(...pts.map((r) => _npKm(coordinates[0], coordinates[1], r.lon, r.lat)));
    if (km < bestKm) {
      bestKm = km;
      best = g;
    }
  });

  if (!best) return { rows: groups.size === 1 ? rows : [], rejected: groups.size > 1 };
  if (bestKm > NEXT_PASS_MAX_KM) {
    console.warn(`[next-pass] nearest name match is ${bestKm.toFixed(0)} km away — discarded`);
    return { rows: [], rejected: true };
  }
  return { rows: best, rejected: false };
}

function _npTick() {
  const card = document.getElementById('nextPassCard');
  if (!card) {
    clearNextPassCard();
    return;
  }

  const now = _npNowUtc();
  let soonest = Infinity;

  card.querySelectorAll('[data-np-peak]').forEach((el) => {
    const peak = Number(el.dataset.npPeak);
    const endRaw = el.dataset.npEnd;
    const end = endRaw ? Number(endRaw) : null;
    const diff = peak - now;
    if (diff > 0 && diff < soonest) soonest = diff;
    el.textContent = _npCountdown(diff, el.dataset.npInprogress === '1', end === null ? null : end - now);
    if (end !== null && end - now <= 0) el.classList.add('np-done');
  });

  const want = soonest < 10 * 60 * 1000 ? 1000 : 20000;
  if (want !== _npTickMs) {
    clearInterval(_npTicker);
    _npTickMs = want;
    _npTicker = setInterval(_npTick, want);
  }
}

function _npStartTicker() {
  if (_npTicker) clearInterval(_npTicker);
  _npTickMs = 1000;
  _npTicker = setInterval(_npTick, _npTickMs);
  _npTick();
}

function _npMount(html) {
  const box = document.getElementById('infoBox');
  if (!box) return null;
  const existing = document.getElementById('nextPassCard');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const node = wrap.firstElementChild;
  const slot = document.getElementById('npCardSlot');
  if (slot) slot.appendChild(node);
  else box.appendChild(node);
  return node;
}

function _npShell(inner, title) {
  return `<section id="nextPassCard" class="np-card" role="region" aria-labelledby="npCardTitle">
    <h3 id="npCardTitle" class="np-title">${title || 'Hotspot forecast'}</h3>
    ${inner}
  </section>`;
}

function _npNote(text) {
  return _npShell(`<p class="np-note">${_npEsc(text)}</p>`);
}

function _npCountdownEl(row, cls) {
  return `<span class="${cls}" data-np-peak="${row.peak}"` +
    (row.end !== null ? ` data-np-end="${row.end}"` : '') +
    (row.inProgress ? ` data-np-inprogress="1"` : '') + `>…</span>`;
}

function _npHeadlineIndex(rows) {
  const i = rows.findIndex((r) => NEXT_PASS_HEADLINE_TIERS.includes(_npTier(r.p)));
  return i >= 0 ? i : 0;
}

function _npBuild(rows) {
  const headIdx = _npHeadlineIndex(rows);
  const head = rows[headIdx];
  const p = head.p;
  const isQuality = NEXT_PASS_HEADLINE_TIERS.includes(_npTier(p));
  const anyTiers = rows.some((r) => _npTier(r.p));

  const platform = _npEsc(p.platform || 'Unknown platform');
  const sensor = _npEsc(p.sensor || '');

  const headline = `
    <div class="np-headline">
      <div class="np-count" aria-hidden="true">${_npCountdownEl(head, 'np-count-val')}</div>
      <p class="np-sr">Peak at ${_npEsc(_npLocalFull(head.peak))}, ${_npEsc(_npUtcLabel(head.peak))}.</p>
      <div class="np-meta">
        <span class="np-plat">${platform}</span>
        ${sensor ? `<span class="np-sep" aria-hidden="true">·</span><span class="np-sensor">${sensor}</span>` : ''}
        ${_npGlyph(p)}
        ${_npTierBadge(p)}
      </div>
      <p class="np-when">${_npEsc(_npLocalFull(head.peak))}
        <span class="np-utc">${_npEsc(_npUtcLabel(head.peak))}</span></p>
      <p class="np-reason">${_npEsc(_npReason(p))}</p>
    </div>`;

  const remaining = rows.filter((r, i) => i !== headIdx);
  const rest = remaining.slice(0, Math.max(0, NEXT_PASS_MAX_ROWS - 1));
  const hidden = remaining.length - rest.length;
  let timeline = '';
  if (rest.length) {
    const body = rest.map((r) => {
      const q = r.p;
      const tier = _npTierText(q);
      const sens = _npEsc(q.sensor || '');
      const sub = sens && tier ? `${sens} · ${tier}` : (sens || tier);
      return `<tr>
        <th scope="row" class="np-c-time" title="${_npEsc(_npUtcLabel(r.peak))}">${_npEsc(_npLocalTime(r.peak))}${_npGlyph(q)}</th>
        <td class="np-c-sat">${_npEsc(q.platform || '—')}${sub ? `<span class="np-c-sensor">${sub}</span>` : ''}</td>
        <td class="np-c-in">${_npCountdownEl(r, 'np-row-count')}</td>
      </tr>`;
    }).join('');

    timeline = `
      <details class="np-timeline">
        <summary>${hidden > 0
    ? `Showing ${rest.length} of ${remaining.length} other passes`
    : `${rest.length} other pass${rest.length === 1 ? '' : 'es'} ahead`}</summary>
        <table class="np-table">
          <caption class="np-sr">Upcoming satellite passes over this fire, soonest first. Times are local.</caption>
          <thead><tr>
            <th scope="col" class="np-w-time">Time</th>
            <th scope="col" class="np-w-sat">Satellite</th>
            <th scope="col" class="np-w-in">In</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </details>`;
  }

  const marginalNote = (anyTiers && !isQuality)
    ? `<p class="np-advisory">No strong pass ahead. Showing the soonest.</p>`
    : '';

  const maxTle = rows.reduce((m, r) => {
    const epoch = _npUtcMs(r.p.tle_epoch_utc);
    const a = epoch !== null ? (_npNowUtc() - epoch) / 3600000 : _npNum(r.p.tle_age_h);
    return a !== null && a > m ? a : m;
  }, 0);
  const tleNote = maxTle > NEXT_PASS_TLE_STALE_H
    ? `<p class="np-advisory">Orbital elements are ${Math.round(maxTle)} h old. Timings may drift.</p>`
    : '';

  const runMs = _npUtcMs(head.p.datetimenow);
  const runAgeH = runMs !== null ? (_npNowUtc() - runMs) / 3600000 : null;
  const runNote = (runAgeH !== null && runAgeH > NEXT_PASS_RUN_STALE_H)
    ? `<p class="np-advisory">Predictions generated ${Math.round(runAgeH)} h ago.</p>`
    : '';

  return _npShell(headline + timeline + marginalNote + runNote + tleNote, 'Hotspot forecast');
}

export function injectNextPassStyles() {
  if (document.getElementById(NP_CARD_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = NP_CARD_STYLE_ID;
  s.textContent = `
  #npCardSlot:empty { display: none; }

  .np-card {
    margin-top: 10px; padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.15);
  }
  .np-title {
    font-size: 11px !important; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em;
    color: #FF6347; margin: 0 0 6px 0 !important;
  }
  .np-note { font-size: 10px; color: #C9C9C9; margin: 0; line-height: 1.35; }

  .np-headline {
    background: rgba(255,255,255,0.05);
    border-left: 2px solid #FF6347;
    border-radius: 4px; padding: 7px 8px;
  }
  .np-count { font-size: 20px; font-weight: 700; line-height: 1.1; color: #FFFFFF; }
  .np-count .np-done { color: #9A9A9A; }
  .np-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 4px; }
  .np-plat { font-size: 11px; font-weight: 700; color: #FFFFFF; }
  .np-sensor { font-size: 10px; color: #C9C9C9; }
  .np-sep { color: #7A7A7A; font-size: 10px; }
  .np-when { font-size: 10px; color: #C9C9C9; margin: 4px 0 0 0 !important; line-height: 1.3; }
  .np-utc { display: block; font-size: 9px; color: #8F8F8F; }
  .np-reason { font-size: 10px; color: #E8E8E8; margin: 5px 0 0 0 !important; line-height: 1.35; }

  .np-glyph { font-size: 11px; line-height: 1; cursor: help; }
  .np-glyph-night { color: #9EC5FF; }
  .np-glyph-day   { color: #FFD37A; }

  .np-tier {
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 1px 5px; border-radius: 3px; color: #FFFFFF; white-space: nowrap;
  }
  .np-tier-excellent { background: #28a745; }
  .np-tier-good      { background: #007bff; }
  .np-tier-fair      { background: #ffc107; color: #2b2b2b; }
  .np-tier-marginal  { background: #6c757d; }
  .np-tier-unknown   { background: #4a4a4a; }

  .np-timeline { margin-top: 8px; }
  .np-timeline > summary {
    font-size: 10px; color: #FF6347; cursor: pointer;
    padding: 3px 0; list-style: none; user-select: none;
  }
  .np-timeline > summary::-webkit-details-marker { display: none; }
  .np-timeline > summary::before { content: '▸ '; display: inline-block; transition: none; }
  .np-timeline[open] > summary::before { content: '▾ '; }
  .np-timeline > summary:focus-visible,
  .np-timeline > summary:focus { outline: 2px solid #FF6347; outline-offset: 2px; border-radius: 2px; }

  .np-table { width: 100%; border-collapse: collapse; margin-top: 3px; table-layout: fixed; }
  .np-w-time { width: 28%; } .np-w-sat { width: 42%; } .np-w-in { width: 30%; }
  .np-table th, .np-table td {
    text-align: left; font-size: 10px; font-weight: normal;
    padding: 3px 4px 3px 0; vertical-align: middle;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .np-table thead th {
    font-size: 9px; color: #8F8F8F; text-transform: uppercase; letter-spacing: 0.04em;
    border-bottom: 1px solid rgba(255,255,255,0.15);
  }
  .np-c-time { color: #FFFFFF; font-weight: 700 !important; white-space: nowrap; }
  .np-c-time .np-glyph { margin-left: 4px; font-size: 10px; }
  .np-c-sat { color: #E8E8E8; line-height: 1.2; }
  .np-c-sensor { display: block; font-size: 9px; color: #8F8F8F; }
  .np-c-in { color: #C9C9C9; text-align: right; white-space: nowrap; padding-right: 0 !important; }

  .np-tt { font-weight: 700; font-size: 10px; }
  .np-tt-excellent { color: #5FD07C; }
  .np-tt-good      { color: #5AA9FF; }
  .np-tt-fair      { color: #FFC94D; }
  .np-tt-marginal  { color: #C2C9D0; }
  .np-row-count.np-done { color: #7A7A7A; }

  .np-advisory {
    font-size: 9px; color: #FFC107; margin: 6px 0 0 0 !important; line-height: 1.35;
  }

  .np-sr {
    position: absolute !important; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0;
  }

  @media (max-width: 768px) {
    .np-card { margin-top: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.15); }
    .np-count { font-size: 17px; }
    .np-table th, .np-table td { font-size: 9px; }
    .np-c-sensor, .np-utc { font-size: 8px; }
  }
  `;
  document.head.appendChild(s);
}

export function clearNextPassCard() {
  if (_npTicker) {
    clearInterval(_npTicker);
    _npTicker = null;
    _npTickMs = 0;
  }
  if (_npAbort) {
    _npAbort.abort();
    _npAbort = null;
  }
  _npToken++;
  const el = document.getElementById('nextPassCard');
  if (el) el.remove();
}

async function _npFetchFeatures(fireName) {
  const cql = `fire_name='${String(fireName).replace(/'/g, "''")}'`;
  const buildUrl = (base) =>
    base +
    '?service=WFS&version=1.0.0&request=GetFeature' +
    '&typeName=' + encodeURIComponent(NEXT_PASS_TYPENAME) +
    '&outputFormat=' + encodeURIComponent('application/json') +
    '&maxFeatures=' + NEXT_PASS_MAX_FEATURES +
    '&cql_filter=' + encodeURIComponent(cql);

  _npAbort = new AbortController();
  let res = await fetch(buildUrl(NEXT_PASS_WFS), { signal: _npAbort.signal });
  if (!res.ok && NEXT_PASS_WFS === GEOSERVER_CDN) {
    console.warn(`[next-pass] CDN WFS HTTP ${res.status}; retrying geo-origin`);
    NEXT_PASS_WFS = GEOSERVER_ORIGIN;
    res = await fetch(buildUrl(NEXT_PASS_WFS), { signal: _npAbort.signal });
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data && data.features) || [];
}

/**
 * Fetch next-pass predictions for a fire and mount the Hotspot forecast card
 * into #npCardSlot (or append to #infoBox).
 */
export async function renderNextPassCard(fireProps, coordinates) {
  clearNextPassCard();
  injectNextPassStyles();

  const box = document.getElementById('infoBox');
  if (!box) return;

  const fireName = fireProps && fireProps.fire_name;
  if (!fireName || !String(fireName).trim()) return;

  const token = _npToken;
  _npMount(_npNote('Checking upcoming passes…'));

  const cached = _npCache.get(fireName);
  let features;

  if (cached && Date.now() - cached.t < NP_CACHE_TTL_MS) {
    features = cached.features;
  } else {
    try {
      features = await _npFetchFeatures(fireName);
      _npCache.set(fireName, { t: Date.now(), features });
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.warn('[next-pass] WFS request failed:', err);
      if (token === _npToken) {
        _npMount(_npNote('Pass predictions did not load. Reselect the fire to retry.'));
      }
      return;
    }
    if (token !== _npToken) return;
  }

  const parsed = _npParseAll(features);
  const upcoming = _npUpcoming(parsed);
  const picked = _npPickGroup(upcoming, coordinates);

  if (!picked.rows.length) {
    let msg;
    if (picked.rejected) {
      msg = 'No pass predictions matched this fire location.';
    } else if (parsed.length) {
      const last = parsed[parsed.length - 1];
      msg = `Every predicted pass has already run — the last was ${_npLocalFull(last.peak)}. ` +
        'The prediction run is behind.';
    } else {
      msg = 'No passes predicted in the next 24 hours. Predictions cover North America only.';
    }
    _npMount(_npNote(msg));
    return;
  }

  _npMount(_npBuild(picked.rows));
  _npStartTicker();
}

// ---------------------------------------------------------------------------
// Fire Danger Rating card (props already on agency features — no fetch)
// Unicode trends (DisasterDB only vendors FA hurricane glyph).
// ---------------------------------------------------------------------------

const NP_FDR_TODAY_MINUS = false;

const NP_FDR_RATINGS = {
  low: { label: 'Low', bg: '#57A639', fg: '#0f2405', rank: 0 },
  moderate: { label: 'Moderate', bg: '#F2C744', fg: '#332600', rank: 1 },
  high: { label: 'High', bg: '#F28C28', fg: '#2b1600', rank: 2 },
  vhigh: { label: 'V. high', bg: '#E5484D', fg: '#ffffff', rank: 3 },
  extreme: { label: 'Extreme', bg: '#8B1A1A', fg: '#ffffff', rank: 4 }
};

const NP_FDR_ALIASES = {
  low: 'low', verylow: 'low', vlow: 'low',
  moderate: 'moderate', mod: 'moderate', medium: 'moderate',
  high: 'high',
  veryhigh: 'vhigh', vhigh: 'vhigh', vh: 'vhigh',
  extreme: 'extreme', veryextreme: 'extreme'
};

const NP_FDR_TRENDS = {
  up: '\u2191',
  down: '\u2193',
  steady: '\u2212'
};

function npNormFDRRating(v) {
  if (v === null || typeof v === 'undefined' || v === '') return null;
  const s = String(v).trim().toLowerCase().replace(/[\s._\-/]+/g, '');
  if (!s) return null;
  if (NP_FDR_ALIASES[s]) return NP_FDR_ALIASES[s];
  const n = Number(String(v).trim());
  if (!Number.isNaN(n)) {
    if (n < 5.2) return 'low';
    if (n < 11.2) return 'moderate';
    if (n < 21.3) return 'high';
    if (n < 38.0) return 'vhigh';
    return 'extreme';
  }
  return null;
}

function npInjectFDRStyles() {
  if (document.getElementById(NP_FDR_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = NP_FDR_STYLE_ID;
  s.textContent =
    '.np-fdr-card{background:#1F1F1F;border:1px solid #3a3a3a;border-radius:12px;' +
      'padding:10px 12px;color:#EDEDED;font-family:inherit;' +
      'width:100%;box-sizing:border-box;margin-top:8px;}' +
    '.np-fdr-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;}' +
    '.np-fdr-title{font-size:13px;font-weight:600;letter-spacing:.02em;}' +
    '.np-fdr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}' +
    '.np-fdr-day{text-align:center;}' +
    '.np-fdr-daylbl{font-size:11px;color:#9a9a9a;margin-bottom:4px;}' +
    '.np-fdr-chip{font-size:11.5px;font-weight:600;border-radius:6px;padding:3px 2px;' +
      'display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;}' +
    '.np-fdr-trend{font-size:11px;line-height:1;}' +
    '.np-fdr-source{margin:8px 0 0;font-size:10px;color:#9aa4ae;line-height:1.35;}' +
    '.np-fdr-source strong{color:#cfc8e8;font-weight:650;}';
  document.head.appendChild(s);
}

function npFDRDayLabels() {
  const labels = ['Today'];
  for (let i = 1; i <= 2; i++) {
    labels.push(new Date(Date.now() + i * 86400000)
      .toLocaleDateString(undefined, { weekday: 'short' }));
  }
  return labels;
}

function npFDRDaysFromProps(p) {
  if (!p) return [];

  const d1 = (p.fdr_daily !== undefined && p.fdr_daily !== null) ? p.fdr_daily
    : ((p.fwi_daily !== undefined && p.fwi_daily !== null) ? p.fwi_daily
      : ((p.fwi_d1 !== undefined && p.fwi_d1 !== null) ? p.fwi_d1 : p.fwi));

  const d2 = (p.fdr_nextday !== undefined && p.fdr_nextday !== null) ? p.fdr_nextday
    : ((p.fwi_d2 !== undefined && p.fwi_d2 !== null) ? p.fwi_d2
      : ((p.fwi_nextday !== undefined && p.fwi_nextday !== null) ? p.fwi_nextday : null));

  const d3 = (p.fdr_nextday_plus1 !== undefined && p.fdr_nextday_plus1 !== null) ? p.fdr_nextday_plus1
    : ((p.fwi_d3 !== undefined && p.fwi_d3 !== null) ? p.fwi_d3
      : ((p.fwi_nextday_plus1 !== undefined && p.fwi_nextday_plus1 !== null) ? p.fwi_nextday_plus1
        : ((p.fwi_d2_plus1 !== undefined && p.fwi_d2_plus1 !== null) ? p.fwi_d2_plus1 : null)));

  const raw = [d1, d2, d3];
  const labels = npFDRDayLabels();
  const out = [];
  let prevRank = null;

  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === null || typeof raw[i] === 'undefined' || raw[i] === '') continue;
    const key = npNormFDRRating(raw[i]);
    if (!key) continue;
    const rank = NP_FDR_RATINGS[key].rank;
    let trend = null;
    if (prevRank !== null) trend = rank > prevRank ? 'up' : rank < prevRank ? 'down' : 'steady';
    else if (NP_FDR_TODAY_MINUS && i === 0) trend = 'steady';
    out.push({ label: labels[i], rating: key, trend });
    prevRank = rank;
  }
  return out;
}

function npBuildFDRDay(day) {
  const key = NP_FDR_RATINGS[day.rating] ? day.rating : npNormFDRRating(day.rating);
  if (!key) return '';
  const r = NP_FDR_RATINGS[key];
  const icon = day.trend && NP_FDR_TRENDS[day.trend]
    ? ` <span class="np-fdr-trend" aria-hidden="true">${NP_FDR_TRENDS[day.trend]}</span>`
    : '';
  return (
    '<div class="np-fdr-day">' +
      '<div class="np-fdr-daylbl">' + _npEsc(day.label) + '</div>' +
      '<div class="np-fdr-chip" style="background:' + r.bg + ';color:' + r.fg + ';">' +
        r.label + icon +
      '</div>' +
    '</div>'
  );
}

function npUpdateFDR(days) {
  const grid = document.querySelector('#infoBox .np-fdr-grid') ||
    document.querySelector('.np-fdr-grid');
  if (!grid || !Array.isArray(days)) return;
  const rows = days.slice(0, 3);
  grid.style.gridTemplateColumns = 'repeat(' + Math.max(1, rows.length) + ',minmax(0,1fr))';
  grid.innerHTML = rows.map(npBuildFDRDay).join('');
}

export function npClearFDRCard() {
  const el = document.querySelector('#infoBox .np-fdr-card');
  if (el) el.remove();
}

/** Mount FDR chip card from fire feature properties (no network). */
export function npRenderFDRCard(fireProps) {
  const box = document.getElementById('infoBox');
  if (!box) return;
  npClearFDRCard();
  const days = npFDRDaysFromProps(fireProps);
  if (!days.length) return;
  npInjectFDRStyles();
  const card = document.createElement('div');
  card.className = 'np-fdr-card';
  card.innerHTML =
    '<div class="np-fdr-head">' +
      '<span class="np-fdr-title">Fire danger rating</span>' +
    '</div>' +
    '<div class="np-fdr-grid"></div>' +
    '<p class="np-fdr-source" role="note">' +
      '<strong>Source:</strong> Natural Resources Canada \u2014 ' +
      'Canadian Wildland Fire Information System (CWFIS)' +
    '</p>';
  const primary = box.querySelector('.np-primary');
  if (primary) primary.insertAdjacentElement('afterend', card);
  else box.appendChild(card);
  npUpdateFDR(days);
}
