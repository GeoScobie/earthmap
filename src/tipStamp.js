/**
 * Mirror App transport tip/observation stamps into the search-bar tip clock.
 * goes.js paints #goesTimeLocal / #goesTimeUtc / #goesTimeAge / chip scrubbed.
 */
export function wireTipStampMirror() {
  const tipClock = document.getElementById('tipClock');
  const tipLocal = document.getElementById('tipObsLocal');
  const tipUtc = document.getElementById('tipObsUtc');
  const tipAge = document.getElementById('tipObsAge');
  if (!tipClock || !tipLocal || !tipUtc || !tipAge) return;

  const sync = () => {
    const local = document.getElementById('goesTimeLocal')?.textContent?.trim();
    const utc = document.getElementById('goesTimeUtc')?.textContent?.trim();
    const age =
      document.getElementById('goesTimeAge')?.textContent?.trim() ||
      document.getElementById('goesTimeAgeChip')?.textContent?.trim();
    if (local && local !== '—') tipLocal.textContent = local;
    if (utc && utc !== '—') tipUtc.textContent = utc.includes('UTC') ? utc : `${utc} UTC`;
    if (age && age !== '—') tipAge.textContent = age;
    const scrubbed = document
      .querySelector('.goes-time-chip-pill')
      ?.classList.contains('scrubbed');
    tipClock.classList.toggle('scrubbed', Boolean(scrubbed));
  };

  sync();
  setInterval(sync, 1000);

  // Also watch transport DOM mutations for snappier updates.
  const transport = document.getElementById('goesTimeTransport');
  if (transport && typeof MutationObserver === 'function') {
    const mo = new MutationObserver(sync);
    mo.observe(transport, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'hidden']
    });
  }
}
