// ---------------------------------------------------------------------------
// exifreader — deliberate no-op stub.
//
// mapbox-exif-layer imports exifreader and calls `load()` on every image it
// decodes, to look for velocity ranges in the EXIF ImageDescription tag. We do
// not use that path: the library's own docs call EXIF-in-PNG unreliable, and
// our ranges travel in /wind/gfs_10m/latest.json instead, passed to the layer
// as the explicit `velocityRange` option.
//
// The real package is ~160 KB and pulls a Node Buffer polyfill for a code path
// we never take. Returning an empty tag set makes the library's own fallback
// fire: `ImageDescription` is undefined, so it uses `velocityRange`.
//
// IF YOU EVER SWITCH TO EXIF-CARRIED METADATA, replace this with the real
// package -- the failure would be silent, showing as wrong wind magnitudes
// rather than an error.
// ---------------------------------------------------------------------------
export async function load() { return {}; }
export default { load };
