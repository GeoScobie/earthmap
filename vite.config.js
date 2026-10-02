import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.VITE_BASE || '/';

// Same resolve aliases as disasterdb-app so the shared map client bundles.
// geotiff is an optional dynamic import inside mapbox-exif-layer.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, ['VITE_', 'GEOCODER_']);
  const geocodeTarget = (
    env.VITE_GEOCODER_PROXY_TARGET ||
    env.VITE_GEOCODER_URL ||
    env.GEOCODER_URL ||
    'https://geocode.disasterdb.com'
  ).replace(/\/$/, '');

  return {
    base,
    envPrefix: ['VITE_', 'GEOCODER_'],
    resolve: {
      alias: {
        'mapbox-exif-layer': path.resolve(root, 'public/vendor/mapbox-exif-layer.mjs'),
        exifreader: path.resolve(root, 'public/vendor/exifreader.mjs')
      }
    },
    build: {
      rollupOptions: {
        external: ['geotiff']
      }
    },
    server: {
      port: 5174,
      proxy: {
        '/geocode': {
          target: geocodeTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/geocode/, '')
        }
      }
    }
  };
});
