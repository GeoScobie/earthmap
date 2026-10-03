// /satellites/ only. Steps the live Sat layers together. Does not stitch images.
import { goesGeocolor } from './theme.js';
import { applySatLoopFrames, floorUtcToOwnedFrame } from './goes.js';

const FOUR_H = 4 * 60 * 60;
const DWELL_MS = 500;
const SLUGS = ['goes-east', 'goes-west', 'meteosat', 'gk2a'];

export function isSatMosaicPage() {
  let path = (location.pathname || '/').replace(/\/+$/, '') || '/';
  if (path === '/earthmap/satellites') path = '/satellites';
  return path === '/satellites';
}

function stampsOf(manifest, slug) {
  const list = manifest && manifest[slug];
  if (!Array.isArray(list)) return [];
  return list.map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}

function inLastFourHours(list, nowSec) {
  return list.filter((t) => t >= nowSec - FOUR_H && t <= nowSec + 120);
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

export function startSatMosaicLoop(map) {
  const bar = document.getElementById('satMosaicLoop');
  const playBtn = document.getElementById('satMosaicPlay');
  const whenEl = document.getElementById('satMosaicWhen');
  const statusEl = document.getElementById('satMosaicStatus');
  const scrub = document.getElementById('satMosaicScrub');
  if (!bar || !map) return;
  bar.hidden = false;
  document.title = 'Sat · EarthMap';

  let steps = [];
  let catalogs = {};
  let index = 0;
  let playing = false;
  let timer = null;

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text;
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
    if (scrub && Number(scrub.value) !== index) scrub.value = String(index);
    if (whenEl) {
      const label = frameFromUnix(target);
      whenEl.textContent = label
        ? `${label.ymd} ${label.hhmm.slice(0, 2)}:${label.hhmm.slice(2)} UTC · ${index + 1}/${steps.length}`
        : '—';
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
    if (playBtn) {
      playBtn.textContent = playing ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      playBtn.disabled = steps.length < 2;
    }
    if (playing) tick();
    else stop();
  };

  playBtn?.addEventListener('click', () => setPlaying(!playing));
  scrub?.addEventListener('input', () => {
    if (!steps.length) return;
    setPlaying(false);
    paint(Number(scrub.value));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (playing) tick();
  });

  setStatus('Loading Sat scenes…');
  const url = `${String(goesGeocolor.timesJson || 'https://sat.disasterdb.com/geocolor/times.json').replace(/\/$/, '')}?t=${Date.now()}`;
  fetch(url, { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('times ' + res.status);
      return res.json();
    })
    .then((data) => {
      const nowSec = Date.now() / 1000;
      const union = new Set();
      let usedFallback = false;
      catalogs = {};
      for (const slug of SLUGS) {
        const all = stampsOf(data, slug);
        let recent = inLastFourHours(all, nowSec);
        if (!recent.length && all.length) {
          const newest = all[all.length - 1];
          recent = all.filter((t) => t >= newest - FOUR_H && t <= newest);
          usedFallback = true;
        }
        catalogs[slug] = recent.length ? recent : all;
        for (const t of catalogs[slug]) union.add(t);
      }
      steps = [...union].sort((a, b) => a - b);
      if (!steps.length) {
        setStatus('No scenes on file.');
        if (playBtn) playBtn.disabled = true;
        if (scrub) scrub.disabled = true;
        return;
      }
      if (scrub) {
        scrub.min = '0';
        scrub.max = String(Math.max(0, steps.length - 1));
        scrub.value = '0';
        scrub.disabled = steps.length < 2;
      }
      setStatus(usedFallback
        ? 'No scenes in the last 4 hours for every disk. Showing the newest scenes on file. About every 10 minutes.'
        : '4-hour Sat loop. Each disk uses its nearest scene. About every 10 minutes.');
      paint(0);
      setPlaying(true);
    })
    .catch(() => {
      setStatus('Could not load scene times.');
      if (playBtn) playBtn.disabled = true;
    });
}
