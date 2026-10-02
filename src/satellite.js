// ---------------------------------------------------------------------------
// Satellite Subpoint Tracks — FireMap.live 1:1 port
//
// FireDB:satellite_orbit_12hr is a 12 h forward subpoint forecast (~9 platforms,
// ~15.8k points). Ported from firemap-script.js NP_SAT_* block into MapLibre.
// Default marker is the SVG "satellite" (no Font Awesome required).
// ---------------------------------------------------------------------------

const TYPENAME = 'FireDB:satellite_orbit_12hr';
const WFS = 'https://geo-origin.firemap.live/geoserver/ows';


function _npNum(v) {
  if (v === null || typeof v === 'undefined' || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function _npIsYes(v) {
  return String(v || '').trim().toLowerCase() === 'yes';
}

function _npEsc(s) {
  return String(s === null || typeof s === 'undefined' ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function npInfoBoxLayout(primaryHtml, restHtml) {
  return `<div class="info-primary">${primaryHtml}</div><div class="info-rest">${restHtml}</div>`;
}

let map = null;
let maplibreglRef = null;


  // Master switch. false skips the fetch entirely - no 11 MB download, no
  // markers, no ticker, no refresh timer. When flipping this, also comment
  // or un-comment the Layer List entry and legend group in index.html.
  // master switch
const NP_SAT_ENABLED = true;

  // TYPENAME/WFS set above
  
  const NP_SAT_MAX_FEATURES = 20000;
  const NP_SAT_REFRESH_MIN = 30;
  // A single failed fetch used to take the layer out until the next 30 min
  // refresh. Cold starts and brief server restarts are exactly when it
  // fails, so back off quickly at first rather than waiting half an hour.
  const NP_SAT_RETRY_MS = [8000, 20000, 45000, 120000];
  const NP_SAT_RETRY_MAX = 6;
  const NP_SAT_HORIZON_H = 12;
  const NP_SAT_TICK_MS = 100;
  const NP_SAT_STALE_MIN = 90;
  const NP_SAT_TOGGLE_ID = 'lyr-satellite';
  var NP_SAT_STYLE_ID     = 'np-sat-styles';
  var NP_SAT_PATH_SRC     = 'satellite-path-src';
  var NP_SAT_PATH_ID      = 'satellite-path';
  var NP_SAT_TICK_SRC     = 'satellite-path-ticks-src';
  var NP_SAT_TICK_ID      = 'satellite-path-ticks';
  var NP_SAT_TICKLBL_ID   = 'satellite-path-tick-labels';
  var NP_SAT_TICK_MINZOOM = 2;
  var NP_SAT_TICK_MIN     = 15;   // minutes between pass-time marks
  var NP_SAT_LEAD_SRC     = 'satellite-lead-src';
  var NP_SAT_LEAD_ID      = 'satellite-lead';
  var NP_SAT_CHORD_KM      = 60;       // max chord when following the great circle
  var NP_SAT_LEAD_MIN_S    = 10 * 60;  // trail never shorter than this
  var NP_SAT_LEAD_MAX_S    = 25 * 60;  // nor longer, so nine trails stay readable

  // Solar-elevation anchor solver (see _satSolveAnchor).
  var NP_SAT_SEARCH_BACK_S    = 6 * 3600;
  var NP_SAT_SEARCH_FWD_S     = 900;
  var NP_SAT_ANCHOR_PER_SAT   = 30;
  var NP_SAT_ANCHOR_MAX_RMS   = 0.5;  // deg; observed fit is ~1e-3
  var NP_SAT_ANCHOR_WINDOW_S  = 90;   // solar refinement may not move the TLE answer further

  // Marker shape. Switch live with npSatMarkerStyle('dart') etc.
  var NP_SAT_MARKER_STYLE = 'satellite';
  var NP_SAT_STYLES = {
    satellite:
      '<svg viewBox="0 0 32 32">'
      + '<path d="M11.6 16H20.4" stroke="#6E7681" stroke-width="1.5"/>'
      + '<g stroke="#0F1626" stroke-width="0.9">'
      +   '<rect x="0.9" y="10.6" width="10.4" height="10.8" rx="0.7" fill="#243A66"/>'
      +   '<rect x="20.7" y="10.6" width="10.4" height="10.8" rx="0.7" fill="#243A66"/>'
      + '</g>'
      + '<g stroke="#415F97" stroke-width="0.55" opacity="0.85" fill="none">'
      +   '<path d="M4.4 10.6v10.8M7.8 10.6v10.8M0.9 16h10.4"/>'
      +   '<path d="M24.2 10.6v10.8M27.6 10.6v10.8M20.7 16h10.4"/>'
      + '</g>'
      + '<path d="M16 8.6V4.4" stroke="#8A929B" stroke-width="1.3"/>'
      + '<circle cx="16" cy="3.5" r="1.6" fill="#AEB6C0" stroke="#23272E" stroke-width="0.7"/>'
      + '<rect x="11.7" y="8.5" width="8.6" height="15" rx="1.7" fill="#CBBFA3" '
      +   'stroke="#4A4536" stroke-width="1"/>'
      + '<path d="M11.7 13H20.3M11.7 19H20.3" stroke="#A3977A" stroke-width="0.7"/>'
      + '<circle cx="16" cy="16" r="2.6" fill="currentColor" stroke="#23272E" stroke-width="0.8"/>'
      + '</svg>',
    // Sleek delta with a notched tail. Reads as heading even at 14 px.
    dart: '<svg viewBox="0 0 24 24"><path d="M12 1.4 L20.4 21.8 L12 17.4 L3.6 21.8 Z" '
        + 'fill="currentColor" stroke="#12181C" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    // Minimal stroked chevron, no fill. Quietest option over busy basemap.
    chevron: '<svg viewBox="0 0 24 24"><path d="M4.4 18.6 L12 5.4 L19.6 18.6" fill="none" '
        + 'stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    // The honest one: the datum is a subpoint, so draw a point, and let a
    // leading chevron carry the heading instead of deforming the mark.
    subpoint: '<svg viewBox="0 0 24 24"><path d="M6.2 9.4 L12 3.4 L17.8 9.4" fill="none" '
        + 'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<circle cx="12" cy="16.2" r="4.2" fill="currentColor" stroke="#12181C" stroke-width="1.3"/></svg>',
    // Head plus a tapering wake, so direction reads from the trail.
    comet: '<svg viewBox="0 0 24 24"><path d="M12 4.5 C14.1 10.5 14.6 15.5 12 22.4 '
        + 'C9.4 15.5 9.9 10.5 12 4.5 Z" fill="currentColor" opacity="0.42"/>'
        + '<circle cx="12" cy="7" r="3.7" fill="currentColor" stroke="#12181C" stroke-width="1.2"/></svg>',
    // The original, kept for comparison. Recognisable as a satellite but it
    // has no nose, so heading rotation is meaningless on it.
    classic: '<i class="fa-solid fa-satellite"></i>'
  };

  var NP_SAT_SENSOR_COLOR = {
    'MODIS': '#C98A45', 'VIIRS': '#5C9E97', 'SLSTR': '#6486B4',
    'OLI': '#9A7AAE', 'OLI-2': '#9A7AAE', _default: '#8C939A'
  };

  // Per-platform constants. The subpoint view carries none of these, and they
  // are fixed properties of the spacecraft, so they live here rather than
  // riding along on 15.8k identical copies. half_width_km agrees with the
  // numbers quoted in the layer brief (VIIRS 1520, OLI 92.5).
  var NP_SAT_PLATFORMS = {
    'Terra':       { sensor: 'MODIS', altKm: 705,   swathKm: 2330, halfWidthKm: 1165,
                     resolutionM: 1000, duty: 'continuous',    firms: 'global' },
    'Aqua':        { sensor: 'MODIS', altKm: 705,   swathKm: 2330, halfWidthKm: 1165,
                     resolutionM: 1000, duty: 'continuous',    firms: 'global' },
    'Suomi NPP':   { sensor: 'VIIRS', altKm: 834,   swathKm: 3040, halfWidthKm: 1520,
                     resolutionM: 375,  duty: 'continuous',    firms: 'global' },
    'NOAA-20':     { sensor: 'VIIRS', altKm: 834,   swathKm: 3040, halfWidthKm: 1520,
                     resolutionM: 375,  duty: 'continuous',    firms: 'global' },
    'NOAA-21':     { sensor: 'VIIRS', altKm: 834,   swathKm: 3040, halfWidthKm: 1520,
                     resolutionM: 375,  duty: 'continuous',    firms: 'global' },
    'Sentinel-3A': { sensor: 'SLSTR', altKm: 814.5, swathKm: 1420, halfWidthKm: 710,
                     resolutionM: 1000, duty: 'continuous',    firms: 'global' },
    'Sentinel-3B': { sensor: 'SLSTR', altKm: 814.5, swathKm: 1420, halfWidthKm: 710,
                     resolutionM: 1000, duty: 'continuous',    firms: 'global' },
    'Landsat 8':   { sensor: 'OLI',   altKm: 705,   swathKm: 185,  halfWidthKm: 92.5,
                     resolutionM: 30,   duty: 'daylight_land', firms: 'us_canada' },
    'Landsat 9':   { sensor: 'OLI-2', altKm: 705,   swathKm: 185,  halfWidthKm: 92.5,
                     resolutionM: 30,   duty: 'daylight_land', firms: 'us_canada' }
  };

  var NP_SAT_FALLBACK = { sensor: null, altKm: null, swathKm: null, halfWidthKm: null,
                          resolutionM: null, duty: 'continuous', firms: 'global' };

  var _sats      = new Map();   // catnr -> track
  var _lastFetch = 0;
  var _fetching  = false;
  var _runEpoch  = null;        // seconds; recovered by _satSolveAnchor
  var _anchorRms = null;
  var _anchorN   = 0;
  var _anchorSrc = null;
  var _refresher = null;
  var _dismissBound = false;
  var _retryIdx   = 0;
  var _retryTimer = null;
  var _markers   = new Map();   // catnr -> { marker, el, scaleEl, icon }
  var _lastScale = null;
  var _sizeRaf   = null;
  var _zoomBound = false;
  var _ticker    = null;
  var _visBound  = false;
  var _selected  = null;   // catnr of the satellite whose path is shown
  var _pathIndex = null;
  var _trackKey  = null;

  var D2R = Math.PI / 180, R2D = 180 / Math.PI;

  // --- vector helpers -------------------------------------------------

  function _satUnit(lon, lat) {
    var la = lat * D2R, lo = lon * D2R, c = Math.cos(la);
    return [c * Math.cos(lo), c * Math.sin(lo), Math.sin(la)];
  }

  function _satNorm(v) {
    var m = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    return m > 0 ? [v[0] / m, v[1] / m, v[2] / m] : [0, 0, 0];
  }

  function _satCross(a, b) {
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]];
  }

  function _satBearing(lon1, lat1, lon2, lat2) {
    var p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) * R2D + 360) % 360;
  }

  function _satArcKm(a, b) {
    var d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    return Math.acos(d) * 6371;
  }

  // --- fetch / ingest -------------------------------------------------

  function _satFetch() {
    if (_fetching) return;
    _fetching = true;
    var url = WFS + '?service=WFS&version=1.0.0&request=GetFeature' +
      '&typeName=' + encodeURIComponent(TYPENAME) +
      '&outputFormat=' + encodeURIComponent('application/json') +
      '&maxFeatures=' + NP_SAT_MAX_FEATURES;
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      _fetching = false;
      _lastFetch = Date.now();
      _retryIdx = 0;
      if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
      _satIngest((d && d.features) || []);
    }).catch(function (e) {
      _fetching = false;
      console.error('Satellite Err:', e.message);
      _satScheduleRetry();
    });
  }

  // Retry only while there is nothing to draw. Once a run is in hand a failed
  // refresh is harmless - the existing track stays on screen and the ordinary
  // 30 min timer picks it up - so there is no reason to hammer the server.
  function _satScheduleRetry() {
    if (_retryTimer || _sats.size || _retryIdx >= NP_SAT_RETRY_MAX) return;
    var wait = NP_SAT_RETRY_MS[Math.min(_retryIdx, NP_SAT_RETRY_MS.length - 1)];
    _retryIdx++;
    console.warn('[satellite] fetch failed; retry ' + _retryIdx + '/' + NP_SAT_RETRY_MAX +
                 ' in ' + Math.round(wait / 1000) + ' s');
    _retryTimer = setTimeout(function () {
      _retryTimer = null;
      if (!_sats.size) _satFetch();
    }, wait);
  }

  // WFS returns each platform contiguous and already in track order, so the
  // array index is the ordinal the view fails to publish as pt_index.
  // Everything below is derived from geometry; nothing is invented.
  function _satIngest(features) {
    var next = new Map();

    features.forEach(function (f) {
      var p = (f && f.properties) || {};
      if (!f.geometry || f.geometry.type !== 'Point') return;
      var c = f.geometry.coordinates;
      var lon = _npNum(c[0]), lat = _npNum(c[1]);
      if (lon === null || lat === null) return;

      var key = String(p.catnr || p.platform || '?');
      var tr = next.get(key);
      if (!tr) {
        var meta = NP_SAT_PLATFORMS[p.platform] || NP_SAT_FALLBACK;
        tr = {
          catnr: key,
          platform: String(p.platform || 'Unknown'),
          sensor: String(p.sensor || meta.sensor || ''),
          altKm: meta.altKm, swathKm: meta.swathKm, halfWidthKm: meta.halfWidthKm,
          resolutionM: meta.resolutionM, duty: meta.duty, firms: meta.firms,
          tleEpochUtc: p.tle_epoch_utc || null,
          tleAgeH: _npNum(p.tle_age_h),
          sampleS: null, groundSpeedKms: null, pts: []
        };
        next.set(key, tr);
      }

      var u = _satUnit(lon, lat);
      tr.pts.push({
        i: tr.pts.length, lon: lon, lat: lat,
        ux: u[0], uy: u[1], uz: u[2],
        rx: 0, ry: 0, rz: 0,
        heading: 0, direction: null,
        solarElev: _npNum(p.solar_elev_deg),
        isNight: _npIsYes(p.is_night)
      });
    });

    // Second pass: sample interval, cross-track basis, heading, direction.
    next.forEach(function (tr) {
      var pts = tr.pts, n = pts.length;
      if (n < 2) return;

      // The track spans exactly NP_SAT_HORIZON_H, so spacing falls out of the
      // point count: 1441 pts -> 30 s, 2881 -> 15 s.
      tr.sampleS = Math.round(NP_SAT_HORIZON_H * 3600 / (n - 1));

      for (var i = 0; i < n; i++) {
        var a = pts[i], b = pts[i < n - 1 ? i + 1 : i - 1];
        var ua = [a.ux, a.uy, a.uz], ub = [b.ux, b.uy, b.uz];

        // Tangent along travel, orthogonalised against the radial component.
        var d = [ub[0] - ua[0], ub[1] - ua[1], ub[2] - ua[2]];
        if (i === n - 1) { d = [-d[0], -d[1], -d[2]]; }
        var dot = d[0] * ua[0] + d[1] * ua[1] + d[2] * ua[2];
        var t = _satNorm([d[0] - dot * ua[0], d[1] - dot * ua[1], d[2] - dot * ua[2]]);

        // Right of travel is tangent x position (check: heading north at the
        // equator yields east).
        var r = _satNorm(_satCross(t, ua));
        a.rx = r[0]; a.ry = r[1]; a.rz = r[2];

        if (i < n - 1) {
          a.heading = _satBearing(a.lon, a.lat, b.lon, b.lat);
          a.direction = b.lat >= a.lat ? 'ascending' : 'descending';
        } else {
          a.heading = pts[i - 1].heading;
          a.direction = pts[i - 1].direction;
        }
      }

      tr.groundSpeedKms = _satArcKm([pts[0].ux, pts[0].uy, pts[0].uz],
                                    [pts[1].ux, pts[1].uy, pts[1].uz]) / tr.sampleS;
    });

    _sats = next;
    _satSolveAnchor();
    _satSummary();
    _satSyncMarkers();
    _satInstallVisibility();
    if (_selected !== null && !_sats.has(_selected)) { _selected = null; _satClearPath(); }
    _satRender();
    _satStartTicker();
    _satRedrawTracks(true);
  }

  // --- time anchor ----------------------------------------------------
  //
  // The view publishes no t_epoch / run_epoch, so the anchor is recovered from
  // the one time-bearing quantity it does carry: solar_elev_deg at each
  // subpoint. For a candidate anchor t0 the elevation at point i is fully
  // determined by (lat, lon, t0 + i * sample_s), so a least-squares fit over a
  // few hundred points spread across all 9 platforms and the full 12 h pins t0
  // down. Fitting one point would be ambiguous (a given elevation occurs twice
  // a day) and degenerate near solar noon; fitting the whole spread is neither.
  //
  // This is a workaround for a missing column, not a design. If run_epoch is
  // ever published, _satSolveAnchor should be replaced by reading it.

  function _satSolarElev(lat, lon, epochSec) {
    var n   = epochSec / 86400.0 + 2440587.5 - 2451545.0;
    var L   = (((280.460 + 0.9856474 * n) % 360) + 360) % 360 * D2R;
    var g   = (((357.528 + 0.9856003 * n) % 360) + 360) % 360 * D2R;
    var lam = L + 1.915 * D2R * Math.sin(g) + 0.020 * D2R * Math.sin(2 * g);
    var eps = (23.439 - 0.0000004 * n) * D2R;
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    var ra  = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
    var gm  = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24;
    var H   = (gm * 15 + lon) * D2R - ra;
    var la  = lat * D2R;
    return Math.asin(Math.max(-1, Math.min(1,
      Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H)))) * R2D;
  }

  function _satAnchorSamples() {
    var out = [];
    _sats.forEach(function (tr) {
      var n = tr.pts.length;
      if (n < 2 || !tr.sampleS) return;
      var stride = Math.max(1, Math.floor(n / NP_SAT_ANCHOR_PER_SAT));
      for (var i = 0; i < n; i += stride) {
        var p = tr.pts[i];
        if (p.solarElev === null) continue;
        out.push({ lat: p.lat, lon: p.lon, obs: p.solarElev, dt: i * tr.sampleS });
      }
    });
    return out;
  }

  function _satSSE(samples, t0) {
    var e = 0;
    for (var i = 0; i < samples.length; i++) {
      var s = samples[i];
      var d = _satSolarElev(s.lat, s.lon, t0 + s.dt) - s.obs;
      e += d * d;
    }
    return e;
  }

  function _satRefine(samples, t, step) {
    var bt = t, be = _satSSE(samples, t);
    for (var pass = 0; pass < 4; pass++) {
      var s2 = step / 10;
      for (var u = bt - step; u <= bt + step + 1e-9; u += s2) {
        var e = _satSSE(samples, u);
        if (e < be) { be = e; bt = u; }
      }
      step = s2;
    }
    return { sse: be, t: bt };
  }

  // run_epoch is not published, but it is directly recoverable from two
  // fields that are: tle_age_h is the age of the orbital elements AT run
  // time, so run_epoch = tle_epoch_utc + tle_age_h * 3600.
  //
  // Nine platforms give nine independent derivations - TLE epochs spanning
  // more than half a day, ages from 12.9 h to 24.3 h - and on the run this
  // was written against they agreed to within 25 s, which is just the
  // rounding of tle_age_h to two decimals. The median is the anchor.
  //
  // This is strictly better than fitting solar elevation: no twice-a-day
  // ambiguity, no flat gradient near solar noon, no multi-hour blind scan
  // that can settle on a spurious minimum, and it still works if
  // solar_elev_deg is ever dropped.
  function _satRunEpochFromTle() {
    var vals = [];
    _sats.forEach(function (tr) {
      if (!tr.tleEpochUtc || tr.tleAgeH === null) return;
      var ms = Date.parse(tr.tleEpochUtc);
      if (isNaN(ms)) return;
      vals.push(ms / 1000 + tr.tleAgeH * 3600);
    });
    if (!vals.length) return null;
    vals.sort(function (a, b) { return a - b; });
    return {
      t: vals[Math.floor(vals.length / 2)],
      n: vals.length,
      spread: vals[vals.length - 1] - vals[0]
    };
  }

  function _satSolveAnchor() {
    _runEpoch = null; _anchorRms = null; _anchorN = 0; _anchorSrc = null;
    var samples = _satAnchorSamples();
    var tle = _satRunEpochFromTle();

    if (tle) {
      _runEpoch = Math.round(tle.t);
      _anchorSrc = 'tle (' + tle.n + ' platforms, ' + tle.spread.toFixed(0) + ' s spread)';
      // tle_age_h is rounded to 0.01 h, i.e. 36 s. Solar elevation resolves
      // finer than that, so use it to refine - but only within a tight
      // window, which removes every failure mode a free search has.
      if (samples.length >= 20) {
        var r = _satRefine(samples, tle.t, 60);
        var rmsT = Math.sqrt(r.sse / samples.length);
        if (isFinite(rmsT) && rmsT <= NP_SAT_ANCHOR_MAX_RMS &&
            Math.abs(r.t - tle.t) <= NP_SAT_ANCHOR_WINDOW_S) {
          _runEpoch = Math.round(r.t);
          _anchorRms = rmsT;
          _anchorN = samples.length;
          _anchorSrc = 'tle + solar refine';
        }
      }
      return;
    }

    // Fallback only: no usable TLE fields, so search solar elevation blind.
    if (samples.length < 20) {
      console.warn('[satellite] no TLE fields and too few solar_elev_deg samples to anchor:',
                   samples.length);
      return;
    }
    var now = Math.floor(Date.now() / 1000);
    var cand = [];
    for (var t = now - NP_SAT_SEARCH_BACK_S; t <= now + NP_SAT_SEARCH_FWD_S; t += 60) {
      cand.push({ sse: _satSSE(samples, t), t: t });
    }
    cand.sort(function (a, b) { return a.sse - b.sse; });

    // Refine the best few coarse minima, not just the first, so a narrow true
    // minimum next to a broad shallow one is not missed.
    var best = null;
    for (var k = 0; k < Math.min(3, cand.length); k++) {
      var r = _satRefine(samples, cand[k].t, 60);
      if (!best || r.sse < best.sse) best = r;
    }

    var rms = Math.sqrt(best.sse / samples.length);
    if (!isFinite(rms) || rms > NP_SAT_ANCHOR_MAX_RMS) {
      console.warn('[satellite] solar anchor rejected: rms ' + rms.toFixed(3) +
                   ' deg over ' + samples.length + ' samples exceeds ' +
                   NP_SAT_ANCHOR_MAX_RMS + '. Not animating.');
      return;
    }
    _runEpoch  = Math.round(best.t);
    _anchorRms = rms;
    _anchorN   = samples.length;
    _anchorSrc = 'solar scan (no TLE fields)';
  }

  // --- time grid / state ----------------------------------------------

  function _satTimeAt(tr, i) { return _runEpoch + i * tr.sampleS; }

  function _satEndEpoch(tr) { return _satTimeAt(tr, tr.pts.length - 1); }

  function _satRunAgeMin() {
    return _runEpoch === null ? null : (Date.now() / 1000 - _runEpoch) / 60;
  }

  // Fractional index into a track for a wall-clock time. Points are evenly
  // spaced, so this is arithmetic, not a search.
  function _satIndexAt(tr, nowSec) {
    return (nowSec - _runEpoch) / tr.sampleS;
  }

  function _satExpired() {
    if (_runEpoch === null) return true;
    var age = _satRunAgeMin();
    if (age > NP_SAT_STALE_MIN) return true;
    var now = Date.now() / 1000;
    var live = false;
    _sats.forEach(function (tr) { if (now <= _satEndEpoch(tr)) live = true; });
    return !live;
  }

  // --- markers ---------------------------------------------------------

  function _satOn() {
    var cb = document.getElementById(NP_SAT_TOGGLE_ID);
    return cb ? cb.checked : true;
  }

  function _satColor(tr) {
    return NP_SAT_SENSOR_COLOR[tr.sensor] || NP_SAT_SENSOR_COLOR._default;
  }

  function _satScale() {
    var z = (typeof map !== 'undefined' && map.getZoom) ? map.getZoom() : 4;
    if (z <= 3) return 0.95;
    if (z >= 9) return 1.5;
    return 0.95 + ((z - 3) / 6) * 0.55;
  }

  function _satApplySizes() {
    var s = _satScale();
    if (_lastScale !== null && Math.abs(s - _lastScale) < 0.01) return;
    _lastScale = s;
    var t = 'scale(' + s.toFixed(3) + ')';
    _markers.forEach(function (m) { if (m.scaleEl) m.scaleEl.style.transform = t; });
  }

  function _satQueueSizes() {
    if (_sizeRaf) return;
    _sizeRaf = requestAnimationFrame(function () { _sizeRaf = null; _satApplySizes(); });
  }

  function _satSyncMarkers() {
    Array.from(_markers.keys()).forEach(function (id) {
      if (!_sats.has(id)) { _markers.get(id).marker.remove(); _markers.delete(id); }
    });
    _sats.forEach(function (tr, id) {
      if (_markers.has(id)) return;
      var el = document.createElement('div');
      el.className = 'np-sat-marker';
      el.innerHTML = '<span class="np-sat-scale"><span class="np-sat-rot">' +
                     NP_SAT_STYLES[NP_SAT_MARKER_STYLE] + '</span></span>';
      el.title = tr.platform + ' (' + tr.sensor + ')';
      el.style.display = _satOn() ? 'block' : 'none';
      el.addEventListener('click', function (e) { e.stopPropagation(); _satSelect(id); });
      var marker = new maplibreglRef.Marker({
        element: el,
        rotationAlignment: 'map',
        pitchAlignment: 'viewport'
      }).setLngLat([tr.pts[0].lon, tr.pts[0].lat]).addTo(map);
      var scaleEl = el.firstElementChild;
      var icon = scaleEl.firstElementChild;   // the rotated wrapper
      scaleEl.style.transform = 'scale(' + _satScale().toFixed(3) + ')';
      el.style.color = _satColor(tr);         // svg inherits via currentColor
      _markers.set(id, { marker: marker, el: el, scaleEl: scaleEl, icon: icon, hdg: null });
    });

    if (!_zoomBound && typeof map !== 'undefined' && map.on) {
      _zoomBound = true;
      map.on('zoom', _satQueueSizes);
      map.on('zoomend', _satApplySizes);
    }
  }

  function _satHideMarkers() {
    _markers.forEach(function (m) { m.el.style.display = 'none'; });
  }

  // Phase 2: nearest published point to now, no interpolation yet.
  function _satRender() {
    if (typeof map === 'undefined' || !map.getStyle) return;
    if (_satExpired()) { _satHideMarkers(); return; }
    var now = Date.now() / 1000;
    var on = _satOn();
    _sats.forEach(function (tr, id) {
      var m = _markers.get(id);
      if (!m) return;
      var i = Math.round(_satIndexAt(tr, now));
      if (i < 0 || i > tr.pts.length - 1) { m.el.style.display = 'none'; return; }
      m.el.style.display = on ? 'block' : 'none';
      if (!on) return;
      var p = tr.pts[i];
      m.marker.setLngLat([p.lon, p.lat]);
      if (m.hdg === null || Math.abs(p.heading - m.hdg) > 0.5) {
        m.hdg = p.heading;
        m.marker.setRotation(p.heading);
      }
      tr.now = { lon: p.lon, lat: p.lat, i: i, p: p };
    });
  }

  // --- interpolation ---------------------------------------------------

  // Great-circle interpolation between two subpoint records. Exact on a
  // sphere and well behaved across +/-180 and over the poles, because it
  // never touches lon/lat until the final conversion.
  function _satSlerp(a, b, f) {
    var d = a.ux * b.ux + a.uy * b.uy + a.uz * b.uz;
    d = Math.max(-1, Math.min(1, d));
    var th = Math.acos(d);
    if (th < 1e-9) return [a.lon, a.lat];
    var s = Math.sin(th);
    var p = Math.sin((1 - f) * th) / s;
    var q = Math.sin(f * th) / s;
    var x = p * a.ux + q * b.ux, y = p * a.uy + q * b.uy, z = p * a.uz + q * b.uz;
    return [Math.atan2(y, x) * R2D, Math.asin(Math.max(-1, Math.min(1, z))) * R2D];
  }

  // Shortest-arc angle blend, so a track crossing north does not spin the
  // icon the long way round through 359 -> 0.
  function _satLerpDeg(a, b, f) {
    var d = ((b - a + 540) % 360) - 180;
    return (a + d * f + 360) % 360;
  }

  // Current interpolated state for one track, or null if now falls outside it.
  function _satStateAt(tr, nowSec) {
    var idx = _satIndexAt(tr, nowSec);
    var n = tr.pts.length;
    if (idx < 0 || idx > n - 1) return null;
    var i0 = Math.min(n - 2, Math.floor(idx));
    var f = idx - i0;
    var a = tr.pts[i0], b = tr.pts[i0 + 1];
    var c = _satSlerp(a, b, f);
    return {
      lon: c[0], lat: c[1], i: i0, f: f, a: a, b: b,
      heading: _satLerpDeg(a.heading, b.heading, f),
      direction: a.direction,
      solarElev: (a.solarElev !== null && b.solarElev !== null)
        ? a.solarElev + (b.solarElev - a.solarElev) * f : a.solarElev,
      epoch: nowSec
    };
  }

  function _satAcquiring(tr, st) {
    if (tr.duty !== 'daylight_land') return true;
    return st.solarElev !== null && st.solarElev > 0;
  }

  // --- forward path ----------------------------------------------------

  // Sit immediately under FIRMS hotspots (FireMap: global-firms-hotspots /
  // usa-nasa-firms-24hrs-pt). Preferring fire-historical first parked the lead
  // trail under wind-10m / other context layers, so the forward line vanished.
  function _satBeforeId() {
    return ['fire-hotspots', 'fire-points-active', 'fire-perimeter-fill',
            'fire-historical-fill', 'fire-smoke', 'hurricane-tracks']
      .find(function (id) { return map.getLayer(id); });
  }

  // Re-assert path/lead/tick order after wind/GOES/agency reshuffles.
  function _satRestackPathLayers() {
    if (!map.getLayer(NP_SAT_PATH_ID)) return;
    var before = _satBeforeId();
    [NP_SAT_PATH_ID, NP_SAT_LEAD_ID, NP_SAT_TICK_ID, NP_SAT_TICKLBL_ID].forEach(function (lid) {
      if (!map.getLayer(lid)) return;
      try {
        if (before) map.moveLayer(lid, before);
        else map.moveLayer(lid);
      } catch (err) { /* style mid-swap */ }
    });
  }

  function _satEnsurePathLayers() {
    if (map.getSource(NP_SAT_PATH_SRC)) {
      _satRestackPathLayers();
      return;
    }
    var before = _satBeforeId();

    map.addSource(NP_SAT_PATH_SRC, { type: 'geojson', data: _satEmptyFC() });
    map.addLayer({
      id: NP_SAT_PATH_ID, type: 'line', source: NP_SAT_PATH_SRC,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1, 4, 1.4, 9, 2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.68, 6, 0.62, 10, 0.56]
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    }, before);

    map.addSource(NP_SAT_LEAD_SRC, { type: 'geojson', data: _satEmptyFC() });
    map.addLayer({
      id: NP_SAT_LEAD_ID, type: 'line', source: NP_SAT_LEAD_SRC,
      paint: {
        'line-color': ['get', 'color'],
        // Forward/in-front trail — keep readable over light topo water + wind.
        'line-width': ['interpolate', ['linear'], ['zoom'], 0, 1.1, 4, 1.5, 9, 2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.72, 6, 0.66, 10, 0.58]
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    }, before);

    map.addSource(NP_SAT_TICK_SRC, { type: 'geojson', data: _satEmptyFC() });
    map.addLayer({
      id: NP_SAT_TICK_ID, type: 'circle', source: NP_SAT_TICK_SRC,
      minzoom: NP_SAT_TICK_MINZOOM,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
          NP_SAT_TICK_MINZOOM, ['match', ['get', 'rank'], 0, 2.5, 1, 2, 1.6],
          9, ['match', ['get', 'rank'], 0, 4.4, 1, 3.5, 2.8]],
        'circle-color': ['get', 'color'],
        'circle-opacity': ['match', ['get', 'rank'], 0, 0.95, 1, 0.85, 0.75],
        'circle-stroke-color': '#1F1F1F',
        'circle-stroke-width': 1
      }
    }, before);
    map.addLayer({
      id: NP_SAT_TICKLBL_ID, type: 'symbol', source: NP_SAT_TICK_SRC,
      minzoom: NP_SAT_TICK_MINZOOM,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Lexend Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'],
          NP_SAT_TICK_MINZOOM, ['match', ['get', 'rank'], 0, 9, 7.8],
          9, ['match', ['get', 'rank'], 0, 12, 10.4]],
        'text-offset': [0, 0.8],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-padding': 3,
        'symbol-sort-key': ['get', 'rank']
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#1F1F1F',
        'text-halo-width': 1.4,
        'text-halo-blur': 0.4
      }
    }, before);
  }

  function _satEmptyFC() { return { type: 'FeatureCollection', features: [] }; }

  // A 12 h polar track laps the planet about seven times, so the line has to
  // be cut at every antimeridian crossing. Accumulating the unwrapped
  // longitude instead (what the hurricane layer does over its short track)
  // would run to several thousand degrees and smear across world copies.
  function _satSplitAntimeridian(coords) {
    var parts = [], cur = [];
    for (var i = 0; i < coords.length; i++) {
      if (cur.length && Math.abs(coords[i][0] - cur[cur.length - 1][0]) > 180) {
        if (cur.length > 1) parts.push(cur);
        cur = [];
      }
      cur.push(coords[i]);
    }
    if (cur.length > 1) parts.push(cur);
    return parts;
  }

  // Hour marks carry the weekday so a track running past midnight stays
  // readable; the quarter marks between them stay short.
  function _satPathLabel(epochSec, isHour) {
    var d = new Date(epochSec * 1000);
    return isHour
      ? d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric' })
      : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  // Chase a roughly constant on-screen gap, so the trail reads as a dotted
  // line at world zoom instead of falling apart into isolated specks close in.
  // Subdivide each sample interval so the polyline hugs the great circle
  // rather than cutting the chord. A 207 km step deviates ~0.8 km from the true
  // arc; 60 km chords bring that under 70 m. Fixed subdivision, not zoom
  // dependent, so panning and zooming never trigger a rebuild.
  function _satTrackLine(tr, i0, i1) {
    var pts = tr.pts, out = [];
    if (i1 <= i0) return out;
    var stepKm = (tr.groundSpeedKms || 6.7) * tr.sampleS;
    var sub = Math.max(1, Math.ceil(stepKm / NP_SAT_CHORD_KM));
    for (var i = i0; i < i1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (sub === 1) { out.push([a.lon, a.lat]); continue; }
      for (var k = 0; k < sub; k++) out.push(_satSlerp(a, b, k / sub));
    }
    out.push([pts[i1].lon, pts[i1].lat]);
    return out;
  }

  function _satLineFeatures(tr, coords) {
    var color = _satColor(tr), out = [];
    _satSplitAntimeridian(coords).forEach(function (part) {
      out.push({
        type: 'Feature',
        properties: { catnr: tr.catnr, color: color },
        geometry: { type: 'LineString', coordinates: part }
      });
    });
    return out;
  }

  // Latitude turning point: the top or bottom of the orbit, i.e. the next
  // polar crossing.
  function _satNextApex(tr, i0) {
    var pts = tr.pts, n = pts.length;
    var i = Math.max(0, Math.min(n - 2, i0));
    var rising = pts[i + 1].lat >= pts[i].lat;
    for (var j = i + 1; j < n - 1; j++) {
      if ((pts[j + 1].lat >= pts[j].lat) !== rising) return j;
    }
    return n - 1;
  }

  // The trail ends at the next polar crossing, clamped between MIN and MAX.
  //
  // Ending exactly at the apex, with a guard that skipped to the following one
  // when the pole was close, produced a sawtooth: the trail shrank steadily for
  // 41 minutes and then snapped back 49 minutes in a single step, twice per
  // orbit. Clamping instead keeps the length inside a fixed band, so it eases
  // down to MIN as the pole approaches, slides through it at constant length,
  // and steps back up by only MAX-MIN once past.
  function _satLeadEnd(tr, i0) {
    var n = tr.pts.length;
    var apex = _satNextApex(tr, i0);
    var lo = i0 + Math.round(NP_SAT_LEAD_MIN_S / tr.sampleS);
    var hi = i0 + Math.round(NP_SAT_LEAD_MAX_S / tr.sampleS);
    return Math.min(n - 1, Math.max(lo, Math.min(apex, hi)));
  }

  // Everything from the next sample to the end of the forecast.
  function _satBuildPath(tr, st) {
    var color = _satColor(tr);
    var n = tr.pts.length;
    var i0 = st.i;            // sample behind the marker, so the line runs through it

    var line = { type: 'FeatureCollection', features: [] };
    line.features = _satLineFeatures(tr, _satTrackLine(tr, i0, n - 1));

    // Pass-time marks along the forward path.
    //
    // Placed on round clock times rather than on sample indices: the run
    // epoch is an arbitrary second (08:50:01 on the run I tested), so marks
    // stepped off the samples would read 8:50, 9:05, 9:20 and never land on
    // an hour. Stepping wall clock and interpolating the position instead
    // gives real :00 / :15 / :30 / :45 marks.
    //
    // They are emitted every NP_SAT_TICK_MIN and thinned by Mapbox's own
    // label collision rather than by us guessing a spacing per zoom. rank
    // feeds symbol-sort-key, so when marks collide the round times win and
    // zooming out degrades to the hours.
    var ticks = { type: 'FeatureCollection', features: [] };
    var stepS = NP_SAT_TICK_MIN * 60;
    var endT = _satEndEpoch(tr);
    for (var t = Math.ceil(_satTimeAt(tr, i0) / stepS) * stepS; t <= endT; t += stepS) {
      var idx = (t - _runEpoch) / tr.sampleS;
      var k = Math.floor(idx);
      if (k < 0 || k >= n - 1) continue;
      var c = _satSlerp(tr.pts[k], tr.pts[k + 1], idx - k);
      var mins = Math.round((((t % 3600) + 3600) % 3600) / 60);
      var rank = mins === 0 ? 0 : (mins === 30 ? 1 : 2);
      ticks.features.push({
        type: 'Feature',
        properties: {
          catnr: tr.catnr, color: color, rank: rank,
          label: _satPathLabel(t, rank === 0)
        },
        geometry: { type: 'Point', coordinates: c }
      });
    }
    return { line: line, ticks: ticks };
  }

  // Leading trail for every satellite, ending at its next polar crossing.
  //
  // Selecting a satellite drops all of them, not just its own: at that point
  // its 12 h path is the subject, and eight other trails crossing it are noise.
  // They come back on deselection.
  function _satBuildLead() {
    var fc = _satEmptyFC();
    if (_selected !== null) return fc;
    var now = Date.now() / 1000;
    _sats.forEach(function (tr) {
      var st = _satStateAt(tr, now);
      if (!st) return;
      var i0 = st.i;          // as above: keeps the trail welded to the marker
      var coords = _satTrackLine(tr, i0, _satLeadEnd(tr, i0));
      if (coords.length < 2) return;
      fc.features = fc.features.concat(_satLineFeatures(tr, coords));
    });
    return fc;
  }

  function _satDrawLead() {
    if (typeof map === 'undefined' || !map.getStyle) return;
    if (!_satOn() || _satExpired()) {
      if (map.getSource(NP_SAT_LEAD_SRC)) map.getSource(NP_SAT_LEAD_SRC).setData(_satEmptyFC());
      return;
    }
    _satEnsurePathLayers();
    map.getSource(NP_SAT_LEAD_SRC).setData(_satBuildLead());
  }

  function _satDrawPath() {
    if (typeof map === 'undefined' || !map.getStyle) return;
    var tr = _selected === null ? null : _sats.get(_selected);
    if (!tr || !_satOn() || _satExpired()) { _satClearSelectedPath(); return; }
    var st = _satStateAt(tr, Date.now() / 1000);
    if (!st) { _satClearPath(); return; }
    _satEnsurePathLayers();
    var d = _satBuildPath(tr, st);
    map.getSource(NP_SAT_PATH_SRC).setData(d.line);
    map.getSource(NP_SAT_TICK_SRC).setData(d.ticks);
    _pathIndex = st.i;
  }

  function _satClearSelectedPath() {
    _pathIndex = null;
    if (typeof map === 'undefined' || !map.getStyle) return;
    if (map.getSource(NP_SAT_PATH_SRC)) map.getSource(NP_SAT_PATH_SRC).setData(_satEmptyFC());
    if (map.getSource(NP_SAT_TICK_SRC)) map.getSource(NP_SAT_TICK_SRC).setData(_satEmptyFC());
  }

  function _satClearPath() {
    _satClearSelectedPath();
    if (typeof map !== 'undefined' && map.getStyle && map.getSource(NP_SAT_LEAD_SRC)) {
      map.getSource(NP_SAT_LEAD_SRC).setData(_satEmptyFC());
    }
  }

  // Now that the dots sit on fixed ground positions there is nothing to
  // animate between rebuilds, so rebuild only when the geometry actually
  // changes: a satellite passes a sample, the zoom band shifts, or the
  // selection moves. This is what removes the streaming-out-of-the-marker
  // artefact, and it is far cheaper than the old timed redraw.
  function _satTrackKey() {
    if (_runEpoch === null) return 'x';
    var now = Date.now() / 1000, k = [];
    _sats.forEach(function (tr) { k.push(Math.floor(_satIndexAt(tr, now))); });
    k.push(_selected === null ? '-' : _selected);
    return k.join('|');
  }

  function _satRedrawTracks(force) {
    var key = _satTrackKey();
    if (!force && key === _trackKey) return;
    _trackKey = key;
    _satDrawLead();
    if (_selected !== null) _satDrawPath();
  }

  // Is the info box still showing this layer's content, or has something
  // else (a fire, a hotspot) already taken it over?
  function _satOwnsInfoBox() {
    var box = document.getElementById('infoBox');
    return !!(box && box.querySelector('.np-sat-info'));
  }

  // closeBox is only passed when the info box is still ours. A click that
  // landed on a fire has already refilled it, and closing then would wipe
  // out the thing the user actually asked for.
  function _satDeselect(closeBox) {
    if (_selected === null) return;
    _selected = null;
    _markers.forEach(function (m) { m.el.classList.remove('np-sat-sel'); });
    _satClearSelectedPath();
    _satDrawLead();
    if (closeBox) {
      var box = document.getElementById('infoBox');
      if (box) { box.style.display = 'none'; box.classList.remove('active'); }
      if (typeof window.closeInfoBox === 'function') window.closeInfoBox();
    }
  }

  function _satSelect(catnr) {
    if (_selected === catnr) { _satDeselect(true); return; }
    _selected = catnr;
    _markers.forEach(function (m, id) { m.el.classList.toggle('np-sat-sel', id === _selected); });
    _satRedrawTracks(true);
    _satShowInfo(_selected);
  }

  // Selecting a satellite should not be a one-way door. Three ways out:
  // click it again, dismiss the info box, or click anywhere on the map.
  function _satInstallDismiss() {
    if (_dismissBound) return;
    _dismissBound = true;

    // The close button and the Escape key both route through closeInfoBox,
    // so wrapping it covers every dismissal path without editing that code.
    // DisasterDB has no global closeInfoBox; dismiss via map click only.
    // If a host page defines one later, wrap it.
    if (typeof window.closeInfoBox === 'function' && !window.closeInfoBox._npSatWrapped) {
      var orig = window.closeInfoBox;
      window.closeInfoBox = function () {
        orig.apply(this, arguments);
        _satDeselect(false);
      };
      window.closeInfoBox._npSatWrapped = true;
    }

    if (typeof map !== 'undefined' && map.on) {
      map.on('click', function () {
        if (_selected === null) return;
        // Deferred one tick so any fire or hotspot handler bound to the same
        // click has already run; only then can we tell whether the info box
        // still belongs to us.
        setTimeout(function () { _satDeselect(_satOwnsInfoBox()); }, 0);
      });
    }
  }

  // --- info box --------------------------------------------------------

  function _satLstH(lon, epochSec) {
    var utcH = (epochSec % 86400) / 3600;
    return ((utcH + lon / 15) % 24 + 24) % 24;
  }

  function _satFmtLst(h) {
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
    return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function _satShowInfo(catnr) {
    var tr = _sats.get(catnr);
    var box = document.getElementById('infoBox');
    if (!tr || !box) return;
    var st = _satStateAt(tr, Date.now() / 1000);
    if (!st) return;
    // next-pass / hotspot ticker UI not ported

    var acq = _satAcquiring(tr, st);
    var color = _satColor(tr);
    var endsMin = Math.max(0, (_satEndEpoch(tr) - Date.now() / 1000) / 60);

    var primary =
      '<strong>Sensor:</strong> <span style="color:' + color + ';font-weight:bold;">' +
        _npEsc(tr.sensor) + '</span><br>' +
      '<strong>Collecting now:</strong> ' +
        (acq ? '<span style="color:#7CD992;font-weight:bold;">Yes</span>'
             : '<span style="color:#9AA4AD;font-weight:bold;">No &mdash; daylight only</span>') + '<br>' +
      (tr.resolutionM !== null ? '<strong>Resolution:</strong> ' + tr.resolutionM + ' m<br>' : '') +
      (tr.swathKm !== null ? '<strong>Swath:</strong> ' + tr.swathKm + ' km<br>' : '') +
      '<strong>Direction:</strong> ' + _npEsc(st.direction || '—') + '<br>';

    var rest =
      (tr.altKm !== null ? '<strong>Altitude:</strong> ' + tr.altKm + ' km<br>' : '') +
      (tr.groundSpeedKms ? '<strong>Ground speed:</strong> ' + tr.groundSpeedKms.toFixed(2) + ' km/s<br>' : '') +
      '<strong>Mean local solar time:</strong> ' + _satFmtLst(_satLstH(st.lon, st.epoch)) + '<br>' +
      '<strong>Sun elevation below:</strong> ' +
        (st.solarElev === null ? '—' : st.solarElev.toFixed(1) + '°') + '<br>' +
      '<strong>Catalogue no:</strong> ' + _npEsc(tr.catnr) + '<br>' +
      (tr.tleAgeH !== null ? '<strong>Orbit element age:</strong> ' + tr.tleAgeH.toFixed(1) + ' h' +
        (tr.tleAgeH > 24 ? ' <span style="color:#FFB84D;">(ageing)</span>' : '') + '<br>' : '') +
      '<strong>Track ends:</strong> in ' + (endsMin / 60).toFixed(1) + ' h<br>';

    // FIRMS does not distribute Landsat detections outside the US and Canada.
    // The ground track drawn here is global; the data it feeds is not.
    if (tr.firms === 'us_canada') {
      rest += '<p class="np-sat-caveat">FIRMS distributes ' + _npEsc(tr.platform) +
              ' fire detections for the <strong>United States and Canada only</strong>. ' +
              'This ground track is global, but no detections are published for passes ' +
              'elsewhere.</p>';
    }

    box.innerHTML = '<h3 class="np-sat-info">' + _npEsc(tr.platform) + '</h3>' +
                    npInfoBoxLayout(primary, rest);
    box.style.display = 'block';
    box.classList.add('active');
  }

  // --- ticker ----------------------------------------------------------

  function _satTick() {
    if (_runEpoch === null) return;
    if (_satExpired()) { _satHideMarkers(); _satClearPath(); _satStopTicker(); return; }
    var now = Date.now() / 1000;
    var on = _satOn();
    _sats.forEach(function (tr, id) {
      var m = _markers.get(id);
      if (!m) return;
      var st = _satStateAt(tr, now);
      if (!st || !on) { m.el.style.display = 'none'; return; }
      m.el.style.display = 'block';
      m.marker.setLngLat([st.lon, st.lat]);
      if (m.hdg === null || Math.abs(st.heading - m.hdg) > 0.5) {
        m.hdg = st.heading;
        m.marker.setRotation(st.heading);
      }
      var acq = _satAcquiring(tr, st);
      if (m.acq !== acq) { m.acq = acq; m.el.classList.toggle('np-sat-idle', !acq); }
      tr.now = st;
    });

    _satRedrawTracks(false);
  }

  function _satStartTicker() {
    if (_ticker || document.hidden) return;
    _ticker = setInterval(_satTick, NP_SAT_TICK_MS);
    _satTick();
  }

  function _satStopTicker() {
    if (!_ticker) return;
    clearInterval(_ticker);
    _ticker = null;
  }

  function _satInstallVisibility() {
    if (_visBound) return;
    _visBound = true;
    // Nothing moves that anyone can see while the tab is hidden, and a
    // background 10 Hz timer is pure battery cost.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) _satStopTicker();
      else if (_sats.size && _satOn()) _satStartTicker();
    });
  }

  function _satInjectStyles() {
    if (document.getElementById(NP_SAT_STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = NP_SAT_STYLE_ID;
    st.textContent =
      '.np-sat-marker{cursor:pointer;line-height:1;color:#4DD0C7;}' +
      '.np-sat-scale{display:block;will-change:transform;}' +
      '.np-sat-rot{display:block;will-change:transform;transition:opacity .25s ease;}' +
      '.np-sat-rot svg{display:block;width:26px;height:26px;overflow:visible;' +
        'filter:drop-shadow(0 0 1.5px rgba(255,255,255,0.55)) ' +
        'drop-shadow(0 1px 2px rgba(0,0,0,0.8));}' +
      '.np-sat-rot i{display:block;font-size:17px;' +
        'text-shadow:0 1px 2px rgba(0,0,0,0.75);}' +
      '.np-sat-marker.np-sat-idle .np-sat-rot{opacity:0.55;}' +
      '.np-sat-marker.np-sat-idle .np-sat-rot svg{filter:grayscale(0.75) ' +
        'drop-shadow(0 1px 2px rgba(0,0,0,0.7));}' +
      '.np-sat-marker.np-sat-sel .np-sat-rot svg{' +
        'filter:drop-shadow(0 0 3px rgba(255,255,255,0.9)) ' +
        'drop-shadow(0 1px 2px rgba(0,0,0,0.75));}' +
      '.np-sat-caveat{margin:8px 0 0;padding:7px 9px;border-radius:7px;' +
        'background:rgba(255,184,77,0.12);border-left:3px solid #FFB84D;' +
        'font-size:11px;line-height:1.45;color:#EDEDED;}';
    document.head.appendChild(st);
  }

  // Swap the mark without tearing down the markers, so the animation and
  // any drawn path survive the change.
  function npSatMarkerStyle(name) {
    if (!NP_SAT_STYLES[name]) {
      console.warn('[satellite] unknown marker style "' + name + '". Options: ' +
                   Object.keys(NP_SAT_STYLES).join(', '));
      return null;
    }
    NP_SAT_MARKER_STYLE = name;
    _markers.forEach(function (m) { m.icon.innerHTML = NP_SAT_STYLES[name]; });
    return name;
  }

  function npToggleSatellites(on) {
    if (!NP_SAT_ENABLED) return;
    _markers.forEach(function (m) { m.el.style.display = on ? 'block' : 'none'; });
    [NP_SAT_PATH_ID, NP_SAT_LEAD_ID, NP_SAT_TICK_ID, NP_SAT_TICKLBL_ID].forEach(function (lid) {
      if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', on ? 'visible' : 'none');
    });
    if (on) { _satRender(); _satStartTicker(); _satRedrawTracks(true); }
    else _satStopTicker();
  }

  function _satSummary() {
    var rows = [];
    _sats.forEach(function (tr) {
      rows.push({
        platform: tr.platform, sensor: tr.sensor, catnr: tr.catnr,
        points: tr.pts.length,
        sample_s: tr.sampleS,
        span_h: tr.sampleS ? +((tr.pts.length - 1) * tr.sampleS / 3600).toFixed(2) : null,
        speed_kms: tr.groundSpeedKms ? +tr.groundSpeedKms.toFixed(3) : null,
        half_width_km: tr.halfWidthKm,
        res_m: tr.resolutionM,
        duty: tr.duty,
        firms: tr.firms,
        tle_age_h: tr.tleAgeH
      });
    });
    rows.sort(function (a, b) { return a.platform < b.platform ? -1 : 1; });

    var total = rows.reduce(function (s, r) { return s + r.points; }, 0);
    console.log('[satellite] platforms:', rows.length, '| points:', total,
                '| run_epoch:', _runEpoch === null ? 'UNRESOLVED'
                  : new Date(_runEpoch * 1000).toISOString() +
                    ' (' + _satRunAgeMin().toFixed(1) + ' min old, via ' + _anchorSrc +
                    (_anchorRms === null ? ''
                      : ', rms ' + _anchorRms.toFixed(4) + ' deg over ' + _anchorN + ' pts') + ')');
    if (console.table) console.table(rows); else console.log(rows);
    if (_runEpoch === null) {
      console.warn('[satellite] ' + TYPENAME + ' publishes no t_epoch / run_epoch / ' +
                   'pt_index column and the solar anchor could not be recovered, so the ' +
                   'track cannot be placed on the wall clock. Layer hidden.');
    } else if (_satRunAgeMin() > NP_SAT_STALE_MIN) {
      console.warn('[satellite] run is ' + _satRunAgeMin().toFixed(0) + ' min old (limit ' +
                   NP_SAT_STALE_MIN + '). Layer hidden rather than extrapolated.');
    }
  }

  function _satInstallRefresh() {
    if (_refresher || NP_SAT_REFRESH_MIN <= 0) return;
    _refresher = setInterval(function () { _satFetch(); }, NP_SAT_REFRESH_MIN * 60000);
  }

  function npAddSatelliteLayer() {
    if (!NP_SAT_ENABLED) return;
    _satInjectStyles();
    _satInstallRefresh();
    _satInstallDismiss();
    var freshMs = Math.max(NP_SAT_REFRESH_MIN, 5) * 60000;
    if (_sats.size && Date.now() - _lastFetch < freshMs) {
      _satSummary(); _satSyncMarkers(); _satInstallVisibility();
      _satRender(); _satStartTicker(); _satRedrawTracks(true); return;
    }
    _satFetch();
  }

  
export const SATELLITE_LAYER_IDS = [NP_SAT_PATH_ID, NP_SAT_LEAD_ID, NP_SAT_TICK_ID, NP_SAT_TICKLBL_ID];

/** Start satellite tracks: CSS, fetch, refresh timer. Pass maplibre-gl for Marker. */
export function addSatelliteLayers(mapInstance, maplibregl) {
  map = mapInstance;
  maplibreglRef = maplibregl;
  npAddSatelliteLayer();
}

export function toggleSatellites(on) {
  npToggleSatellites(on);
}

export function wireSatelliteToggle(mapInstance) {
  if (mapInstance) map = mapInstance;
  const box = document.getElementById(NP_SAT_TOGGLE_ID);
  if (!box) return;
  const apply = () => npToggleSatellites(box.checked);
  box.addEventListener('change', apply);
  apply();
}

export function refreshSatellites() {
  _satFetch();
}
