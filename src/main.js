// ---------------------------------------------------------------------------
// Vite entry point. Requires Node + `npm install` + `npm run dev`.
// If you have no Node toolchain, use /standalone.html instead — same map,
// same style.js, resolved off a CDN with no build step.
//
// The map itself lives in app.js; this file only does build-tool wiring.
// ---------------------------------------------------------------------------

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';

import { createMap } from './app.js';
import './ui.css';

// MapLibre v6 is ESM-only and loads its parser in a Web Worker. If the worker
// URL is wrong, tiles silently never appear — no error, just an empty map.
// Vite needs `?worker&url` here, NOT plain `?url`.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);

window.map = createMap(maplibregl, Protocol); // handy in the browser console
