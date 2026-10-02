/** EarthMap stub — no sat major-roads overlay yet; App wires roads-simple. */
export function syncSatRoadsVisibility(_map, _imageryOn) {}
export function geocolorCheckboxesOn() {
  for (const id of [
    'lyr-goes-east-demo',
    'lyr-goes-west-demo',
    'lyr-goes-meteosat-demo',
    'lyr-goes-gk2a-demo'
  ]) {
    if (document.getElementById(id)?.checked) return true;
  }
  return false;
}
