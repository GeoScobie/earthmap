// ---------------------------------------------------------------------------
// USA Fire Weather Index (FWI) — live GEFF-on-feature card for #infoBox
//
// Layer: FireDB:usa_fire_pt_active_2026 (agency-fires.js USA stack).
// Values: feature props fwi_0 … fwi_6 (today = index 0, then +1…+6 local
// calendar days — same day-strip labeling as before).
//
// UI: Canada FDR day-strip look (next-pass.js .np-fdr-* / npRenderFDRCard)
//   — Title: "Fire Weather Index by day"
//   — Today + 2 weekday chips (days 0–2 when present), class colors, ↑↓− trends
//   — Compact ⓘ source note (Copernicus / ECMWF GEFF — live from layer)
//   — 7-day bar chart collapsed by default (<details>)
//
// Schema:
//   {
//     source: 'geff',          // live GEFF on WFS feature (not placeholder)
//     units: 'FWI',
//     days: number,            // count of usable days in series
//     series: [ { date: 'YYYY-MM-DD', fwi: number, dayOffset: 0..6 }, … ]
//   }
//
// If a fire has no usable fwi_* values, the card is hidden (no fake seed).
// buildPlaceholderFwiForecast remains as a legacy fallback helper only.
// Wired only for usa-fire-points clicks (see agency-fires.js).
// ---------------------------------------------------------------------------

const STYLE_ID = 'np-us-fwi-styles';
const CARD_SEL = '#infoBox .np-us-fwi-card';

/** Canadian FWI danger-class thresholds (approx.), same bins / chrome as FDR. */
const FWI_BANDS = [
  { key: 'low', max: 5.2, label: 'Low', chip: 'Low', color: '#57A639', fg: '#0f2405', rank: 0 },
  { key: 'moderate', max: 11.2, label: 'Moderate', chip: 'Moderate', color: '#F2C744', fg: '#332600', rank: 1 },
  { key: 'high', max: 21.3, label: 'High', chip: 'High', color: '#F28C28', fg: '#2b1600', rank: 2 },
  { key: 'vhigh', max: 38.0, label: 'Very High', chip: 'V. high', color: '#E5484D', fg: '#ffffff', rank: 3 },
  { key: 'extreme', max: Infinity, label: 'Extreme', chip: 'Extreme', color: '#8B1A1A', fg: '#ffffff', rank: 4 }
];

const TRENDS = {
  up: '\u2191',
  down: '\u2193',
  steady: '\u2212'
};

const FORECAST_DAYS = 7;
/** Visible FDR-style strip (matches Canada FDR card) — local day offsets 0–2. */
const DISPLAY_DAYS = 3;

function esc(s) {
  return String(s === null || typeof s === 'undefined' ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fwiBand(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return FWI_BANDS[0];
  for (let i = 0; i < FWI_BANDS.length; i++) {
    if (v < FWI_BANDS[i].max) return FWI_BANDS[i];
  }
  return FWI_BANDS[FWI_BANDS.length - 1];
}

/** FNV-1a 32-bit — stable across sessions (placeholder fallback only). */
function hash32(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ymdUTC(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local calendar YYYY-MM-DD for dayOffset (noon local avoids DST skew). */
function ymdLocal(offsetDays) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Day strip label: Today, then short weekday in the user's local timezone.
 * Noon local avoids DST / midnight skew when offsetting days.
 */
function dayStripLabel(offsetDays) {
  if (offsetDays === 0) return 'Today';
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
}

/** Short weekday for chart axis (local). */
function localDow(offsetDays) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
}

function parseFwiProp(v) {
  if (v === null || typeof v === 'undefined' || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Live forecast from WFS feature props fwi_0 … fwi_6 on
 * FireDB:usa_fire_pt_active_2026. Missing days are omitted; returns null when
 * nothing usable (caller hides the card — no invented numbers).
 *
 * @returns {null | { source: string, units: string, days: number, series: Array<{date:string,fwi:number,dayOffset:number}>, layer: string }}
 */
export function buildLiveFwiForecast(fireProps) {
  const p = fireProps || {};
  const series = [];
  for (let i = 0; i < FORECAST_DAYS; i++) {
    const fwi = parseFwiProp(p[`fwi_${i}`]);
    if (fwi === null) continue;
    series.push({ date: ymdLocal(i), fwi, dayOffset: i });
  }
  if (!series.length) return null;
  return {
    source: 'geff',
    units: 'FWI',
    days: series.length,
    series,
    layer: 'FireDB:usa_fire_pt_active_2026'
  };
}

/**
 * Legacy deterministic stand-in. Not used by the default render path once
 * fwi_* props are present on usa_fire_pt_active_2026; kept for fallback /
 * tests only — do not invent FWI when live props exist.
 *
 * @returns {{ source: string, units: string, days: number, series: Array<{date:string,fwi:number,dayOffset:number}> }}
 */
export function buildPlaceholderFwiForecast(fireProps, coordinates) {
  const p = fireProps || {};
  const idBits = [
    p.fire_id,
    p.fire_id_source,
    p.unique_fire_identifier,
    p.irwin_id,
    p.fire_name
  ].filter((v) => v !== null && typeof v !== 'undefined' && String(v).trim() !== '');

  let seedKey;
  if (idBits.length) {
    seedKey = idBits.map(String).join('|');
  } else if (coordinates && coordinates.length >= 2) {
    const lon = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    seedKey = `${lon.toFixed(3)},${lat.toFixed(3)}`;
  } else {
    seedKey = 'usa-fwi-fallback';
  }

  const rand = mulberry32(hash32(seedKey));
  let level = 8 + rand() * 28;
  const series = [];
  const start = new Date();
  start.setUTCHours(12, 0, 0, 0);

  for (let i = 0; i < FORECAST_DAYS; i++) {
    const drift = (rand() - 0.48) * 6.5;
    level = Math.max(0.5, Math.min(55, level + drift));
    if (rand() > 0.72) level = Math.min(55, level + 2 + rand() * 4);
    const d = new Date(start.getTime() + i * 86400000);
    series.push({
      date: ymdUTC(d),
      fwi: Math.round(level * 10) / 10,
      dayOffset: i
    });
  }

  return {
    source: 'placeholder',
    units: 'FWI',
    days: FORECAST_DAYS,
    series
  };
}

/** Class-rank trend (FDR-style ↑ / ↓ / −) vs previous entry in the shown series. */
function classTrend(series, i) {
  if (i === 0) return { dir: 'steady', arrow: TRENDS.steady, label: 'Outlook start' };
  const prev = fwiBand(series[i - 1].fwi).rank;
  const cur = fwiBand(series[i].fwi).rank;
  if (cur > prev) return { dir: 'up', arrow: TRENDS.up, label: 'Rising class' };
  if (cur < prev) return { dir: 'down', arrow: TRENDS.down, label: 'Falling class' };
  return { dir: 'steady', arrow: TRENDS.steady, label: 'Steady class' };
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent =
    '.np-us-fwi-card{background:#1F1F1F;border:1px solid #3a3a3a;border-radius:12px;' +
      'padding:10px 12px;color:#EDEDED;font-family:inherit;' +
      'width:100%;box-sizing:border-box;margin-top:8px;cursor:default;}' +
    '.np-us-fwi-head{display:flex;align-items:center;gap:6px;margin-bottom:8px;}' +
    '.np-us-fwi-title{font-size:13px;font-weight:600;letter-spacing:.02em;}' +
    '.np-us-fwi-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}' +
    '.np-us-fwi-grid[data-cols="1"]{grid-template-columns:minmax(0,1fr);}' +
    '.np-us-fwi-grid[data-cols="2"]{grid-template-columns:repeat(2,minmax(0,1fr));}' +
    '.np-us-fwi-day{text-align:center;}' +
    '.np-us-fwi-daylbl{font-size:11px;color:#9a9a9a;margin-bottom:4px;}' +
    '.np-us-fwi-chip{font-size:11.5px;font-weight:600;border-radius:6px;padding:3px 2px;' +
      'display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;}' +
    '.np-us-fwi-trend{font-size:11px;line-height:1;}' +
    '.np-us-fwi-card details.np-us-fwi-more{' +
      'margin-top:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:8px;}' +
    '.np-us-fwi-card details.np-us-fwi-more > summary{' +
      'cursor:pointer;font-size:12px;font-weight:600;color:#cfc8e8;' +
      'list-style:none;user-select:none;}' +
    '.np-us-fwi-card details.np-us-fwi-more > summary::-webkit-details-marker{display:none;}' +
    '.np-us-fwi-card details.np-us-fwi-more > summary::before{content:"▸ ";font-size:10px;opacity:.8;}' +
    '.np-us-fwi-card details.np-us-fwi-more[open] > summary::before{content:"▾ ";}' +
    '.np-us-fwi-card .np-firms-note{margin-top:8px;}' +
    '.np-us-fwi-card .np-firms-note > summary{' +
      'font-size:10px;color:#FF6347;cursor:pointer;padding:3px 0;' +
      'list-style:none;user-select:none;}' +
    '.np-us-fwi-card .np-firms-note > summary::-webkit-details-marker{display:none;}' +
    '.np-us-fwi-card .np-firms-note > summary::before{content:"▸ ";}' +
    '.np-us-fwi-card .np-firms-note[open] > summary::before{content:"▾ ";}' +
    '.np-us-fwi-card .np-firms-note-body p{' +
      'font-size:10px;color:#C9C9C9;line-height:1.35;margin:4px 0;}' +
    '.np-us-fwi-card .np-firms-note-body strong{color:#E8E8E8;}' +
    '.np-us-fwi-card .np-firms-note-body .np-firms-note-warn{' +
      'color:#FFC107;font-weight:600;}' +
    '.np-us-fwi-outlook{margin-top:8px;}' +
    '.np-us-fwi-outlook svg{width:100%;height:80px;display:block;}' +
    '.np-us-fwi-tz{font-size:10px;color:#9aa4ae;margin:6px 0 0;line-height:1.35;}' +
    '@media (max-width:380px){.np-us-fwi-card{max-width:none;}}';
  document.head.appendChild(s);
}

/** FDR-style day cell: label + class chip (+ trend when not first shown day). */
function buildFdrDayHtml(series, i) {
  const d = series[i];
  const off = typeof d.dayOffset === 'number' ? d.dayOffset : i;
  const band = fwiBand(d.fwi);
  const t = classTrend(series, i);
  const showTrend = i > 0;
  const icon = showTrend
    ? ` <span class="np-us-fwi-trend" aria-hidden="true">${t.arrow}</span>`
    : '';
  const title = `${dayStripLabel(off)} · FWI ${d.fwi} · ${band.label}` +
    (showTrend ? ` · ${t.label}` : '');
  return (
    '<div class="np-us-fwi-day" title="' + esc(title) + '">' +
      '<div class="np-us-fwi-daylbl">' + esc(dayStripLabel(off)) + '</div>' +
      '<div class="np-us-fwi-chip" style="background:' + band.color + ';color:' + band.fg + ';">' +
        esc(band.chip) + icon +
      '</div>' +
    '</div>'
  );
}

/** Bar chart for available days (up to 7) in the collapsed details outlook. */
function barChart(series) {
  const w = 320;
  const h = 80;
  const padX = 12;
  const padY = 10;
  const vals = series.map((d) => d.fwi);
  const n = vals.length;
  const max = Math.max(...vals, 1);
  const gap = 6;
  const barW = (w - padX * 2 - gap * Math.max(n - 1, 0)) / Math.max(n, 1);
  const bars = series.map((d, i) => {
    const off = typeof d.dayOffset === 'number' ? d.dayOffset : i;
    const band = fwiBand(d.fwi);
    const bh = Math.max(4, (d.fwi / max) * (h - padY * 2 - 14));
    const x = padX + i * (barW + gap);
    const y = h - padY - 14 - bh;
    const lbl = off === 0 ? 'Td' : localDow(off).slice(0, 2);
    return (
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" ` +
        `height="${bh.toFixed(1)}" rx="3" fill="${band.color}">` +
        `<title>${esc(dayStripLabel(off))} (${esc(localDow(off))}): FWI ${d.fwi} (${band.label})</title></rect>` +
      `<text x="${(x + barW / 2).toFixed(1)}" y="${(h - 4).toFixed(1)}" ` +
        `text-anchor="middle" fill="#9aa4ae" font-size="9" ` +
        `font-family="Lexend,sans-serif">${esc(lbl)}</text>`
    );
  }).join('');
  return (
    `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="FWI outlook bar chart">` +
      bars +
    `</svg>`
  );
}

export function clearUsFwiPlaceholder() {
  const el = document.querySelector(CARD_SEL);
  if (el) el.remove();
}

/**
 * Mount FDR-style FWI card into #infoBox (USA fires only).
 * Live path: fwi_0…fwi_6 on the feature. Hide card when none usable.
 */
export function renderUsFwiPlaceholder(fireProps, coordinates) {
  const box = document.getElementById('infoBox');
  if (!box) return;
  clearUsFwiPlaceholder();

  const forecast = buildLiveFwiForecast(fireProps);
  // Prefer hide over inventing numbers when the 2026 layer has no fwi_*.
  if (!forecast) return;

  injectStyles();

  const series = forecast.series;
  // Chips: available days among offsets 0–2; chart: all available (0–6).
  const strip = series.filter((d) => d.dayOffset < DISPLAY_DAYS);
  if (!strip.length) return;

  const card = document.createElement('div');
  card.className = 'np-us-fwi-card';
  card.setAttribute('data-fwi-source', forecast.source);
  card.setAttribute('data-fwi-days', String(strip.length));
  card.setAttribute('data-fwi-variant', 'fdr-by-day');
  card.setAttribute('data-fwi-layer', forecast.layer || '');
  card.title = 'Fire Weather Index by day (Copernicus / ECMWF fire weather forecast).';

  const cols = Math.min(3, Math.max(1, strip.length));
  card.innerHTML =
    '<div class="np-us-fwi-head">' +
      '<span class="np-us-fwi-title">Fire Weather Index by day</span>' +
    '</div>' +
    '<div class="np-us-fwi-grid" data-cols="' + cols + '" role="group" aria-label="FWI by day">' +
      strip.map((_, i) => buildFdrDayHtml(strip, i)).join('') +
    '</div>' +
    '<details class="np-firms-note">' +
      '<summary>\u24d8 About this forecast</summary>' +
      '<div class="np-firms-note-body">' +
        '<p>Fire Weather Index is based on <strong>Copernicus / ECMWF</strong> ' +
          'global fire weather forecasts.</p>' +
        '<p class="np-firms-note-warn">Not for operational or evacuation use. ' +
          'Follow your local fire agency.</p>' +
      '</div>' +
    '</details>' +
    '<details class="np-us-fwi-more">' +
      '<summary>7-day chart</summary>' +
      '<div class="np-us-fwi-outlook">' +
        barChart(series) +
        '<p class="np-us-fwi-tz">Day names use your local timezone. ' +
          'Values update with the daily forecast.</p>' +
      '</div>' +
    '</details>';

  const fdr = box.querySelector('.np-fdr-card');
  const primary = box.querySelector('.np-primary');
  const slot = box.querySelector('#npCardSlot');
  if (fdr) fdr.insertAdjacentElement('afterend', card);
  else if (primary) primary.insertAdjacentElement('afterend', card);
  else if (slot) slot.insertAdjacentElement('beforebegin', card);
  else box.appendChild(card);
}
