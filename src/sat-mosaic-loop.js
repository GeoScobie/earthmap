// /satellite-loop/ only. Steps the live Sat layers together. Does not stitch images.
import { goesGeocolor } from './theme.js';
import { applySatLoopFrames, floorUtcToOwnedFrame } from './goes.js';

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

function formatLocalSceneClock(unix) {
  if (!Number.isFinite(unix)) return 'Sat —';
  const d = new Date(unix * 1000);
  try {
    return d.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    const pad = (n) => String(n).padStart(2, '0');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

export function startSatMosaicLoop(map) {
  const bar = document.getElementById('satMosaicLoop');
  const playBtn = document.getElementById('satMosaicPlay');
  const whenEl = document.getElementById('satMosaicWhen');
  const playIcon = playBtn?.querySelector('.sat-mosaic-play-icon--play');
  const pauseIcon = playBtn?.querySelector('.sat-mosaic-play-icon--pause');
  if (!bar || !map) return;
  bar.hidden = false;
  document.title = 'Satellite loop';

  let steps = [];
  let catalogs = {};
  let index = 0;
  let playing = false;
  let timer = null;

  const syncPlayUi = () => {
    if (!playBtn) return;
    playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    playBtn.disabled = steps.length < 2;
    playBtn.title = playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-label', playing ? 'Pause Sat loop' : 'Play Sat loop');
    if (playIcon) playIcon.hidden = playing;
    if (pauseIcon) pauseIcon.hidden = !playing;
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
    if (whenEl) {
      const label = frameFromUnix(target);
      whenEl.textContent = formatLocalSceneClock(target);
      whenEl.dateTime = label ? label.iso : '';
    }
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
    syncPlayUi();
    if (playing) tick();
    else stop();
  };

  playBtn?.addEventListener('click', () => setPlaying(!playing));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (playing) tick();
  });

  syncPlayUi();
  if (whenEl) whenEl.textContent = 'Sat —';
  const url = `${String(goesGeocolor.timesJson || 'https://sat.disasterdb.com/geocolor/times.json').replace(/\/$/, '')}?t=${Date.now()}`;
  fetch(url, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('times ' + res.status);
      return res.json();
    })
    .then((data) => {
      // Every real stamp on file for the four disks (union). No hour window.
      // Do not invent gaps. Exclude himawari / goes-west-widl.
      const union = new Set();
      catalogs = {};
      for (const slug of SLUGS) {
        const all = stampsOf(data, slug);
        catalogs[slug] = all;
        for (const t of all) union.add(t);
      }
      steps = [...union].sort((a, b) => a - b);
      if (!steps.length) {
        if (whenEl) whenEl.textContent = 'Sat —';
        syncPlayUi();
        return;
      }
      paint(0);
      setPlaying(true);
    })
    .catch(() => {
      if (whenEl) whenEl.textContent = 'Sat —';
      syncPlayUi();
    });
}
