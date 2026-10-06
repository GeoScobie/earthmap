// ---------------------------------------------------------------------------
// GFS weather layers: placeholders, not on the toolbar yet.
//
// Wind is the only GFS field with real data behind it, and it stays on the
// rail as #windBtn (wind.js / wind-ui.js). The fields below used to sit on the
// toolbar as makeup buttons that only showed a "Not on the map yet" card.
// They are off the toolbar until their data is wired.
//
// To bring them back:
//   1. Flip GFS_LAYERS_ENABLED to true. mountGfsPlaceholders() then rebuilds
//      the same buttons, the Advanced (ellipsis) bar, and the legend card, and
//      wireGfsMakeup() in ui.js handles clicks/positioning exactly as before.
//   2. To ship one field early, set `enabled: true` on just that entry and
//      keep GFS_LAYERS_ENABLED true. Disabled entries are skipped.
//   3. When a field gets real tiles, hook its click to the map layer instead
//      of the text legend (see wireGfsMakeup in ui.js).
//
// CSS for .gfs-layer-btn / .gfs-advanced-bar / .gfs-legend-card is still in
// ui.css so nothing needs restyling when these come back.
// ---------------------------------------------------------------------------

export const GFS_LAYERS_ENABLED = false;

// group: 'primary' sits on the rail next to Wind; 'advanced' goes in the
// horizontal bar opened by the ellipsis button.
export const GFS_PLACEHOLDER_LAYERS = [
  { id: 'gfs-precip',   group: 'primary',  label: 'Precipitation',      icon: 'fa-cloud-rain',       gfs: 'APCP / PRATE',           unit: 'mm',   enabled: true },
  { id: 'gfs-temp',     group: 'primary',  label: 'Temperature',        icon: 'fa-temperature-half', gfs: 'TMP 2 m',                unit: '°C',   enabled: true },
  { id: 'gfs-humidity', group: 'primary',  label: 'Humidity',           icon: 'fa-droplet',          gfs: 'RH 2 m',                 unit: '%',    enabled: true },
  { id: 'gfs-pressure', group: 'primary',  label: 'Pressure',           icon: 'fa-gauge-high',       gfs: 'PRMSL',                  unit: 'hPa',  enabled: true },
  { id: 'gfs-clouds',   group: 'advanced', label: 'Cloud cover',        icon: 'fa-cloud',            gfs: 'TCDC entire atmosphere', unit: '%',    enabled: true },
  { id: 'gfs-dewpoint', group: 'advanced', label: 'Dew point',          icon: 'fa-temperature-low',  gfs: 'DPT 2 m',                unit: '°C',   enabled: true },
  { id: 'gfs-gust',     group: 'advanced', label: 'Wind gusts',         icon: 'fa-wind',             gfs: 'GUST surface',           unit: 'm/s',  enabled: true },
  { id: 'gfs-snow',     group: 'advanced', label: 'Snow',               icon: 'fa-snowflake',        gfs: 'SNOD / WEASD',           unit: 'mm',   enabled: true },
  { id: 'gfs-cape',     group: 'advanced', label: 'Instability',        icon: 'fa-bolt',             gfs: 'CAPE surface',           unit: 'J/kg', enabled: true },
  { id: 'gfs-pwat',     group: 'advanced', label: 'Precipitable water', icon: 'fa-glass-water',      gfs: 'PWAT',                   unit: 'mm',   enabled: true }
];

function layerButton(layer) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toolbar-btn gfs-layer-btn';
  btn.id = layer.id;
  btn.setAttribute('aria-label', layer.label);
  btn.title = layer.label;
  btn.setAttribute('aria-pressed', 'false');
  btn.dataset.gfs = layer.gfs;
  btn.dataset.unit = layer.unit;
  const i = document.createElement('i');
  i.className = `fa-solid ${layer.icon}`;
  i.setAttribute('aria-hidden', 'true');
  btn.appendChild(i);
  return btn;
}

/**
 * Build the GFS placeholder controls into the DOM. Returns false (and adds
 * nothing) while GFS_LAYERS_ENABLED is false, so the toolbar has no gaps.
 */
export function mountGfsPlaceholders() {
  if (!GFS_LAYERS_ENABLED) return false;
  if (document.querySelector('.gfs-layer-btn')) return true; // already mounted
  const rail = document.querySelector('.vertical-toolbar');
  const windBtn = document.getElementById('windBtn');
  if (!rail || !windBtn) return false;

  const layers = GFS_PLACEHOLDER_LAYERS.filter((l) => l.enabled);
  const primary = layers.filter((l) => l.group === 'primary');
  const advanced = layers.filter((l) => l.group === 'advanced');
  if (!layers.length) return false;

  // Primary fields go right after Wind, in list order.
  let anchor = windBtn;
  for (const layer of primary) {
    const btn = layerButton(layer);
    anchor.after(btn);
    anchor = btn;
  }

  if (advanced.length) {
    const adv = document.createElement('button');
    adv.type = 'button';
    adv.className = 'toolbar-btn';
    adv.id = 'gfsAdvancedBtn';
    adv.setAttribute('aria-label', 'Advanced');
    adv.title = 'Advanced';
    adv.setAttribute('aria-expanded', 'false');
    adv.setAttribute('aria-controls', 'gfsAdvancedBar');
    adv.innerHTML = '<i class="fa-solid fa-ellipsis" aria-hidden="true"></i>';
    anchor.after(adv);

    const bar = document.createElement('div');
    bar.id = 'gfsAdvancedBar';
    bar.className = 'gfs-advanced-bar';
    bar.hidden = true;
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Advanced GFS layers');
    for (const layer of advanced) bar.appendChild(layerButton(layer));
    rail.after(bar);
  }

  const card = document.createElement('div');
  card.id = 'gfsLegendCard';
  card.className = 'gfs-legend-card';
  card.hidden = true;
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  card.innerHTML =
    '<p class="gfs-legend-name"></p>' +
    '<p class="gfs-legend-field"></p>' +
    '<p class="gfs-legend-unit"></p>' +
    '<p class="gfs-legend-note">Not on the map yet</p>';
  (document.getElementById('gfsAdvancedBar') || rail).after(card);
  return true;
}
