// /satellite-loop/ only. Steps the live Sat layers together. Does not stitch images.
// UI: same chip → expand transport as the homepage (bottom center). Play walks
// real times.json stamps, up to SAT_PLAY_WINDOW_HOURS (21 days) back from tip.
import { goesGeocolor } from './theme.js';
import {
  applySatLoopFrames,
  floorUtcToOwnedFrame,
  formatSpanLabel,
  SAT_PLAY_WINDOW_HOURS
} from './goes.js';

const DWELL_MS = 500;
const SLUGS = ['goes-east', 'goes-west', 'meteosat', 'gk2a'];

export function isSatMosaicPage() {
  let path = (location.pathname || '/').replace(/\/+$/, '') || '/';
  if (path === '/earthmap/satellite-loop') path = '/satellite-loop';
  return path === '/satellite-loop';
}

function stampsOf(manifest, slug) {
  const list = manifest && manifest[slug];
  if (!Array.isArray(list)) return [];
  return list.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}

/** Closest real stamp. On a tie, keep the earlier one. Never invent a time. */
function nearestStamp(list, target) {
  if (!list.length || !Number.isFinite(target)) return null;
  let best = list[0];
  let bestDist = Math.abs(list[0] - target);
  for (let i = 1; i < list.length; i++) {
    const t = list[i];
    const dist = Math.abs(t - target);
    if (dist < bestDist || (dist === bestDist && t < best)) {
      best = t;
      bestDist = dist;
    }
  }
  return best;
}

function frameFromUnix(unix) {
  if (!Number.isFinite(unix)) return null;
  return floorUtcToOwnedFrame(unix * 1000);
}

function fmt(d, opts) {
  try {
    return d.toLocaleString([], opts);
  } catch {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

function formatLocalSceneClock(unix) {
  if (!Number.isFinite(unix)) return 'Sat —';
  return fmt(new Date(unix * 1000), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function tzOf(d) {
  try {
    const parts = new Intl.DateTimeFormat([], { timeZoneName: 'short' }).formatToParts(d);
    const z = parts.find((p) => p.type === 'timeZoneName');
    return z ? z.value : '';
  } catch {
    return '';
  }
}

function formatAge(unix) {
  if (!Number.isFinite(unix)) return '—';
  const min = Math.max(0, Math.floor((Date.now() / 1000 - unix) / 60));
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return min % 60 ? `${hr}h ${min % 60}m ago` : `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function startSatMosaicLoop(map) {
  const bar = document.getElementById('satMosaicLoop');
  const transport = document.getElementById('satMosaicTransport');
  const chipBtn = document.getElementById('satMosaicChip');
  const hideBtn = document.getElementById('satMosaicHideBtn');
  const playBtn = document.getElementById('satMosaicPlayBtn');
  const latestBtn = document.getElementById('satMosaicLatestBtn');
  const range = document.getElementById('satMosaicScrubRange');
  const whenEl = document.getElementById('satMosaicWhen');
  const localEl = document.getElementById('satMosaicLocal');
  const utcEl = document.getElementById('satMosaicUtc');
  const ageEl = document.getElementById('satMosaicAge');
  const metaEl = document.getElementById('satMosaicTransportMeta');
  const playIcon = playBtn?.querySelector('.goes-time-play-icon--play');
  const pauseIcon = playBtn?.querySelector('.goes-time-play-icon--pause');
  if (!bar || !map) return;
  bar.hidden = false;
  if (transport) transport.hidden = false;
  document.title = 'Satellite loop';

  let steps = [];
  let catalogs = {};
  let index = 0;
  let playing = false;
  let timer = null;
  let expanded = true;

  const atTip = () => !steps.length || index >= steps.length - 1;

  const setExpanded = (on) => {
    expanded = !!on;
    if (!transport) return;
    transport.classList.toggle('minimized', !expanded);
    transport.setAttribute('aria-label', expanded ? 'Sat time' : 'Sat time — tap to expand');
  };

  const syncUi = () => {
    if (playBtn) {
      playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      playBtn.disabled = steps.length < 2;
      playBtn.classList.toggle('playing', playing);
      playBtn.classList.toggle('active', playing || !atTip());
      const span = spanLabel();
      playBtn.title = playing ? 'Pause' : span ? `Play Sat scenes on file (last ${span})` : 'Play Sat scenes on file';
      playBtn.setAttribute('aria-label', playing ? 'Pause Sat loop' : 'Play Sat loop');
    }
    if (playIcon) playIcon.hidden = playing;
    if (pauseIcon) pauseIcon.hidden = !playing;
    if (latestBtn) latestBtn.hidden = atTip() && !playing;
    if (range) {
      const max = Math.max(0, steps.length - 1);
      range.max = String(max);
      range.disabled = max < 1;
      range.value = String(Math.min(index, max));
    }
    const pill = whenEl?.closest('.goes-time-chip-pill');
    if (pill) pill.classList.toggle('scrubbed', steps.length > 0 && !atTip());
  };

  const spanLabel = () =>
    steps.length > 1 ? formatSpanLabel((steps[steps.length - 1] - steps[0]) / 3600) : '';

  const paintMeta = () => {
    if (!metaEl) return;
    const span = spanLabel();
    const parts = ['Sat'];
    if (steps.length > 1) parts.push(`${steps.length} scenes`);
    if (span) parts.push(`last ${span}`);
    metaEl.textContent = parts.join(' · ');
    metaEl.title = span ? `${steps.length} Sat scenes on file, last ${span}` : 'Sat scenes on file';
  };

  const paintClock = (target) => {
    if (whenEl) whenEl.textContent = formatLocalSceneClock(target);
    if (!Number.isFinite(target)) return;
    const d = new Date(target * 1000);
    const zone = tzOf(d);
    if (localEl) localEl.textContent = `${formatLocalSceneClock(target)}${zone ? ' ' + zone : ''}`;
    if (utcEl) {
      utcEl.textContent = `(${fmt(d, { timeZone: 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit' })} UTC)`;
    }
    if (ageEl) ageEl.textContent = formatAge(target);
  };

  const paint = (i) => {
    if (!steps.length) return;
    index = (i + steps.length) % steps.length;
    const target = steps[index];
    const frames = {
      east: frameFromUnix(nearestStamp(catalogs['goes-east'], target)),
      west: frameFromUnix(nearestStamp(catalogs['goes-west'], target)),
      met: frameFromUnix(nearestStamp(catalogs.meteosat, target)),
      gk: frameFromUnix(nearestStamp(catalogs.gk2a, target))
    };
    applySatLoopFrames(map, frames);
    paintClock(target);
    syncUi();
  };

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const tick = () => {
    stop();
    if (!playing || steps.length < 2) return;
    timer = setTimeout(() => {
      paint(index + 1);
      tick();
    }, DWELL_MS);
  };

  const setPlaying = (on) => {
    playing = on && steps.length > 1;
    syncUi();
    if (playing) tick();
    else stop();
  };

  playBtn?.addEventListener('click', () => {
    if (!playing && atTip()) paint(0); // from tip: restart at oldest in window
    setPlaying(!playing);
  });
  chipBtn?.addEventListener('click', () => setExpanded(!expanded));
  hideBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(false);
  });
  latestBtn?.addEventListener('click', () => {
    setPlaying(false);
    paint(steps.length - 1);
  });
  range?.addEventListener('pointerdown', () => setPlaying(false));
  range?.addEventListener('input', () => {
    setPlaying(false);
    paint(Number(range.value) || 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (playing) tick();
  });
  setInterval(() => {
    if (!playing && steps.length && ageEl) ageEl.textContent = formatAge(steps[index]);
  }, 30000);

  setExpanded(true);
  syncUi();
  if (whenEl) whenEl.textContent = 'Sat —';
  const url = `${String(goesGeocolor.timesJson || 'https://sat.disasterdb.com/geocolor/times.json').replace(/\/$/, '')}?t=${Date.now()}`;
  fetch(url, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('times ' + res.status);
      return res.json();
    })
    .then((data) => {
      // Real stamps on file for the four disks (union), capped at the play
      // window (21 days back from the newest). Do not invent gaps.
      // Exclude himawari / goes-west-widl.
      const union = new Set();
      catalogs = {};
      for (const slug of SLUGS) {
        const all = stampsOf(data, slug);
        catalogs[slug] = all;
        for (const t of all) union.add(t);
      }
      const all = [...union].sort((a, b) => a - b);
      const tip = all.length ? all[all.length - 1] : null;
      const hours =
        Number(goesGeocolor.gkPlayHours) > 0 ? Number(goesGeocolor.gkPlayHours) : SAT_PLAY_WINDOW_HOURS;
      steps = tip == null ? [] : all.filter((t) => t >= tip - hours * 3600);
      paintMeta();
      if (!steps.length) {
        if (whenEl) whenEl.textContent = 'Sat —';
        syncUi();
        return;
      }
      console.info(
        '[sat-loop]',
        steps.length,
        'scenes',
        `(window ${hours}h, on file ${((steps[steps.length - 1] - steps[0]) / 3600).toFixed(1)}h)`
      );
      paint(0);
      setPlaying(true);
    })
    .catch(() => {
      if (whenEl) whenEl.textContent = 'Sat —';
      syncUi();
    });
}
