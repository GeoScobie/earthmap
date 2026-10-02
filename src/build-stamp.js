// ---------------------------------------------------------------------------
// Build stamp — version / sha / builtAt from window.__DDB_BUILD__
// (injected at static build time by tools/build_static.py).
//
// Re-attaches a subtle footer under #infoBox whenever that box is populated
// (agency fires, FIRMS, hurricane, satellite, etc.) via MutationObserver so
// callers do not each need to know about the stamp.
// ---------------------------------------------------------------------------

const FOOTER_CLASS = 'ddb-build-stamp';
let installed = false;

/** @returns {{ version: string, sha: string, builtAt: string|null }} */
export function getBuildStamp() {
  const b =
    typeof window !== 'undefined' && window.__DDB_BUILD__ && typeof window.__DDB_BUILD__ === 'object'
      ? window.__DDB_BUILD__
      : {};
  return {
    version: String(b.version || '0.1.0'),
    sha: String(b.sha || 'dev'),
    builtAt: b.builtAt ? String(b.builtAt) : null
  };
}

/** e.g. "EarthMap v0.1.0 · build f8380d7" */
export function formatBuildStampLabel() {
  const { version, sha } = getBuildStamp();
  return `EarthMap v${version} · build ${sha}`;
}

function hasInfoContent(box) {
  for (const n of box.childNodes) {
    if (n.nodeType === 3 && n.textContent.trim()) return true;
    if (n.nodeType !== 1) continue;
    if (n.classList.contains('np-close-rail')) continue;
    if (n.classList.contains(FOOTER_CLASS)) continue;
    return true;
  }
  return false;
}

/** Append / refresh the footer at the end of #infoBox when it has content. */
export function ensureInfoBoxBuildFooter() {
  const box = document.getElementById('infoBox');
  if (!box) return;
  if (box.style.display === 'none') return;
  if (!box.innerHTML.trim() || !hasInfoContent(box)) return;

  const label = formatBuildStampLabel();
  let foot = box.querySelector(`.${FOOTER_CLASS}`);
  if (!foot) {
    foot = document.createElement('div');
    foot.className = FOOTER_CLASS;
    foot.setAttribute('aria-hidden', 'true');
    box.appendChild(foot);
  } else if (foot !== box.lastElementChild) {
    box.appendChild(foot);
  }
  if (foot.textContent !== label) foot.textContent = label;
}

/** Fill About panel build line if present. */
export function fillAboutBuildStamp() {
  const el = document.getElementById('aboutBuildStamp');
  if (!el) return;
  el.textContent = formatBuildStampLabel();
  const { builtAt } = getBuildStamp();
  if (builtAt) el.title = `Built ${builtAt}`;
}

/**
 * Watch #infoBox and keep the build footer attached after every populate.
 * Safe to call once from initUI.
 */
export function installInfoBoxBuildStamp() {
  if (installed || typeof document === 'undefined') return;
  const box = document.getElementById('infoBox');
  if (!box) return;
  installed = true;

  const run = () => {
    try {
      ensureInfoBoxBuildFooter();
    } catch (e) {
      /* ignore */
    }
  };

  new MutationObserver(run).observe(box, {
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  fillAboutBuildStamp();
  run();
}
