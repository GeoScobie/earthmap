/* EarthMap Consent Mode v2 banner.
   Defaults and the remembered choice are applied in the head snippet
   before gtag.js. This file only paints the banner and updates consent. */
(function () {
  var KEY = 'em_consent_v2';

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function write(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
  }

  function update(state) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state
    });
  }

  function removeBanner() {
    var el = document.getElementById('em-consent');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /* Embedded globe (?embed=1) shares this origin's choice via the head
     snippet. Don't cover the small map; the parent page has the banner. */
  function inEmbed() {
    return document.documentElement.classList.contains('embed-mode')
      || document.body.classList.contains('embed-mode');
  }

  function show() {
    if (document.getElementById('em-consent') || inEmbed()) return;
    var style = document.createElement('style');
    style.id = 'em-consent-style';
    style.textContent = [
      '#em-consent{position:fixed;right:12px;bottom:44px;z-index:1100;',
      'max-width:min(300px,calc(100vw - 24px));',
      'padding:12px 14px;border-radius:12px;',
      'background:rgba(22,24,28,.82);color:#f4f6f8;',
      'border:1px solid rgba(255,255,255,.16);',
      'box-shadow:0 8px 28px rgba(0,0,0,.35);',
      'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
      'font:14px/1.4 Nunito,system-ui,sans-serif;}',
      '#em-consent p{margin:0 0 10px;}',
      '#em-consent .em-consent-actions{display:flex;gap:8px;justify-content:flex-end;}',
      '#em-consent button{font:600 13px/1 Nunito,system-ui,sans-serif;',
      'border-radius:8px;padding:8px 12px;cursor:pointer;}',
      '#em-consent [data-em="reject"]{background:transparent;color:#f4f6f8;',
      'border:1px solid rgba(255,255,255,.35);}',
      '#em-consent [data-em="accept"]{background:#f4f6f8;color:#16181c;border:0;}',
      '#em-consent button:focus-visible{outline:2px solid #8fd0ff;outline-offset:2px;}'
    ].join('');
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'em-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML = '<p>We use cookies for measurement and ads.</p>'
      + '<div class="em-consent-actions">'
      + '<button type="button" data-em="reject">Reject</button>'
      + '<button type="button" data-em="accept">Accept</button>'
      + '</div>';
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn || !bar.contains(btn)) return;
      var choice = btn.getAttribute('data-em') === 'accept' ? 'granted' : 'denied';
      update(choice);
      write(choice);
      removeBanner();
    });
    document.body.appendChild(bar);
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    if (e.newValue === 'granted' || e.newValue === 'denied') {
      update(e.newValue);
      removeBanner();
    }
  });

  function boot() {
    var saved = read();
    if (saved === 'granted' || saved === 'denied') return;
    show();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
