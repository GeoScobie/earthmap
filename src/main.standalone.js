// ---------------------------------------------------------------------------
// No-build entry point. Used by /standalone.html, which resolves the two bare
// specifiers below through an <script type="importmap"> pointing at jsDelivr.
// No Node, no npm, no Vite — serve this directory over any static server.
//
// The Vite entry (main.js) is the equivalent for a real build. Both are thin;
// the map lives in app.js.
// ---------------------------------------------------------------------------

import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { createMap } from './app.js';

// NO setWorkerUrl CALL, deliberately.
//
// MapLibre derives the worker URL from its own import.meta.url — with the
// library at /vendor/maplibre-gl.mjs it looks for /vendor/maplibre-gl-worker.mjs
// and finds it. Overriding it is only needed when the worker lives somewhere
// else, and getting the override wrong hangs style loading with no error at
// all: raster tiles still appear (main thread) while vector tiles never parse
// (worker), which looks like a data problem rather than a wiring one.

window.map = createMap(maplibregl, Protocol); // handy in the browser console
