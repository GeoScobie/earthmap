// Lean place search for EarthMap — Photon via DisasterDB geocoder (no FireMap).
const GEOCODER_BASE = String(
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env.VITE_GEOCODER_URL || import.meta.env.GEOCODER_URL)) ||
    'https://geocode.disasterdb.com'
).replace(/\/$/, '');

const ZOOM_BY_TYPE = {
  continent: 2.5,
  country: 5,
  state: 6.5,
  region: 6.5,
  province: 6.5,
  county: 9,
  city: 11,
  town: 12,
  village: 13,
  hamlet: 13,
  district: 13,
  locality: 14,
  street: 15,
  house: 16
};

const REGION_TYPES = new Set([
  'continent',
  'country',
  'state',
  'region',
  'county',
  'province',
  'territory'
]);

function label(props) {
  if (!props) return 'Unknown';
  const parts = [];
  if (props.name) parts.push(props.name);
  if (props.city && props.city !== props.name) parts.push(props.city);
  if (props.state) parts.push(props.state);
  if (props.country) parts.push(props.country);
  return parts.join(', ') || 'Unknown';
}

function placeKind(props) {
  if (!props) return '';
  const t = String(props.type || '').toLowerCase();
  const osm = String(props.osm_value || props.osm_key || '').toLowerCase();
  if (t && t !== 'other') return t;
  return osm || t;
}

function typeKeys(props) {
  if (!props) return [];
  return [props.osm_value, props.type, props.osm_key]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());
}

function meaningfulBounds(extent) {
  if (!Array.isArray(extent) || extent.length !== 4) return null;
  const minLon = Number(extent[0]);
  const maxLat = Number(extent[1]);
  const maxLon = Number(extent[2]);
  const minLat = Number(extent[3]);
  if (![minLon, maxLat, maxLon, minLat].every(Number.isFinite)) return null;
  if (!(minLon < maxLon) || !(minLat < maxLat)) return null;
  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;
  if (lonSpan >= 120) return null;
  if (lonSpan <= 0.05 && latSpan <= 0.05) return null;
  return [
    [minLon, minLat],
    [maxLon, maxLat]
  ];
}

function flyTo(map, feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return;
  const props = feature.properties || {};
  const fitOpts = { padding: 48, maxZoom: 14, duration: 1200, essential: true };
  const bounds = meaningfulBounds(props.extent);
  if (bounds) {
    map.fitBounds(bounds, fitOpts);
    return;
  }
  for (const k of typeKeys(props)) {
    if (ZOOM_BY_TYPE[k] != null && REGION_TYPES.has(k)) {
      map.flyTo({ center: coords, zoom: ZOOM_BY_TYPE[k], duration: 1200, essential: true });
      return;
    }
  }
  const kind = placeKind(props);
  map.flyTo({
    center: coords,
    zoom: ZOOM_BY_TYPE[kind] ?? 12,
    duration: 1200,
    essential: true
  });
}

/**
 * Wire logo + search bar chrome. Returns helpers for optional external use.
 */
export function setupSearch(map) {
  const wrap = document.getElementById('searchWrap');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  const logoBtn = document.getElementById('logoBtn');
  if (!wrap || !input || !results) return;

  let timer = 0;
  let seq = 0;

  const setOpen = (open) => {
    wrap.classList.toggle('search-open', open);
    results.hidden = !open || results.childElementCount === 0;
  };

  const clearResults = () => {
    results.innerHTML = '';
    results.hidden = true;
  };

  const appendMsg = (msg) => {
    const li = document.createElement('li');
    li.className = 'search-msg';
    li.textContent = msg;
    results.append(li);
  };

  const render = (feats, opts = {}) => {
    results.innerHTML = '';
    if (opts.loading) {
      appendMsg('Searching…');
      results.hidden = false;
      wrap.classList.add('search-open');
      return;
    }
    if (opts.error) {
      appendMsg(opts.error);
      results.hidden = false;
      wrap.classList.add('search-open');
      return;
    }
    const list = Array.isArray(feats) ? feats : [];
    if (!list.length) {
      appendMsg(opts.emptyMsg || 'No places found.');
      results.hidden = false;
      wrap.classList.add('search-open');
      return;
    }
    for (const f of list) {
      const props = f.properties || {};
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.tabIndex = 0;
      const kind = document.createElement('span');
      kind.className = 'search-item-kind';
      kind.textContent = placeKind(props) || 'place';
      const title = document.createElement('span');
      title.className = 'search-item-title';
      title.textContent = label(props);
      li.append(kind, title);
      const pick = () => {
        flyTo(map, f);
        input.value = label(props);
        clearResults();
        wrap.classList.remove('search-open');
        input.blur();
      };
      li.addEventListener('click', pick);
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      });
      results.append(li);
    }
    results.hidden = false;
    wrap.classList.add('search-open');
  };

  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) {
      clearResults();
      wrap.classList.remove('search-open');
      return;
    }
    const my = ++seq;
    render([], { loading: true });
    try {
      const res = await fetch(
        `${GEOCODER_BASE}/api?q=${encodeURIComponent(q)}&limit=6`,
        { method: 'GET', headers: { Accept: 'application/json' } }
      );
      if (my !== seq) return;
      if (!res.ok) {
        render([], { error: `Geocoder error (${res.status}). Try again.` });
        return;
      }
      const data = await res.json();
      if (my !== seq) return;
      const feats = Array.isArray(data?.features) ? data.features : [];
      render(feats, { emptyMsg: 'No places found.' });
    } catch (err) {
      if (my !== seq) return;
      render([], { error: 'Geocoder unreachable. Check network.' });
      console.warn('[earthmap] geocode', err);
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 280);
  });
  input.addEventListener('focus', () => {
    if (results.childElementCount) setOpen(true);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearResults();
      wrap.classList.remove('search-open');
      input.blur();
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      clearResults();
      wrap.classList.remove('search-open');
    }
  });

  logoBtn?.addEventListener('click', () => {
    map.flyTo({ center: [-20, 20], zoom: 2.2, duration: 1000, essential: true });
  });
}
