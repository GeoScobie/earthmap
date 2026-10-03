// Sat overview player. Swaps prebuilt 0/0/0 PNGs. Does not stitch tiles.
(function () {
  var FOUR_H = 4 * 60 * 60;
  var DWELL_MS = 500;
  var root = document.querySelector('[data-sat-slug]');
  if (!root) return;
  var slug = root.getAttribute('data-sat-slug');
  var title = root.getAttribute('data-sat-title') || slug;
  var img = document.getElementById('satFrame');
  var whenEl = document.getElementById('satWhen');
  var statusEl = document.getElementById('satStatus');
  var playBtn = document.getElementById('satPlay');
  if (!img || !slug) return;

  var frames = [];
  var index = 0;
  var playing = false;
  var timer = null;

  function pad(n) { return String(n).padStart(2, '0'); }

  function frameFromStamp(sec) {
    var d = new Date(sec * 1000);
    var ymd = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    var hhmm = pad(d.getUTCHours()) + pad(d.getUTCMinutes());
    var label = ymd + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ' UTC';
    return {
      t: sec,
      label: label,
      iso: d.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      url: 'https://sat.disasterdb.com/geocolor/' + slug + '/' + ymd + '/' + hhmm + '/0/0/0.png'
    };
  }

  function selectStamps(list, nowSec) {
    var stamps = (list || []).filter(function (t) { return Number.isFinite(t); }).map(Number).sort(function (a, b) { return a - b; });
    var recent = stamps.filter(function (t) { return t >= nowSec - FOUR_H && t <= nowSec + 120; });
    if (recent.length) return { stamps: recent, fallback: false };
    if (!stamps.length) return { stamps: [], fallback: true };
    var newest = stamps[stamps.length - 1];
    var older = stamps.filter(function (t) { return t >= newest - FOUR_H && t <= newest; });
    return { stamps: older.length ? older : [newest], fallback: true };
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function show(i) {
    if (!frames.length) return;
    index = (i + frames.length) % frames.length;
    var frame = frames[index];
    img.src = frame.url;
    img.alt = title + ' Sat ' + frame.label;
    if (whenEl) {
      whenEl.textContent = frame.label + ' · ' + (index + 1) + '/' + frames.length;
      whenEl.setAttribute('datetime', frame.iso);
    }
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function tick() {
    stop();
    if (!playing || frames.length < 2) return;
    timer = setTimeout(function () {
      show(index + 1);
      tick();
    }, DWELL_MS);
  }

  function setPlaying(on) {
    playing = on && frames.length > 1;
    if (playBtn) {
      playBtn.textContent = playing ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      playBtn.disabled = frames.length < 2;
    }
    if (playing) tick();
    else stop();
  }

  function preload(frame) {
    return new Promise(function (resolve) {
      var probe = new Image();
      probe.onload = function () { resolve(frame); };
      probe.onerror = function () { resolve(null); };
      probe.src = frame.url;
    });
  }

  if (playBtn) {
    playBtn.addEventListener('click', function () {
      setPlaying(!playing);
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else if (playing) tick();
  });

  setStatus('Loading Sat scenes…');

  var timesUrl = 'https://sat.disasterdb.com/geocolor/times.json?t=' + Date.now();
  fetch(timesUrl, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('times ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var chosen = selectStamps(data && data[slug], Date.now() / 1000);
      var built = chosen.stamps.map(frameFromStamp);
      return Promise.all(built.map(preload)).then(function (loaded) {
        frames = loaded.filter(Boolean);
        if (!frames.length) {
          setStatus(chosen.stamps.length
            ? 'Scenes are listed, but the images did not load.'
            : 'No scenes on file for this satellite.');
          if (playBtn) playBtn.disabled = true;
          return;
        }
        if (chosen.fallback) {
          setStatus('No scenes in the last 4 hours. Showing the newest scenes on file. New scenes are about every 10 minutes.');
        } else {
          setStatus('4-hour Sat loop. New scenes are about every 10 minutes.');
        }
        show(0);
        setPlaying(true);
      });
    })
    .catch(function () {
      setStatus('Could not load scene times.');
      if (playBtn) playBtn.disabled = true;
    });
})();
