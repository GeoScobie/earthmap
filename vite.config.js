import { defineConfig } from 'vite';

// GitHub Pages project site: https://geoscobie.github.io/earthmap/
// Override with VITE_BASE=/ for custom domain / local root later.
const base = process.env.VITE_BASE || '/earthmap/';

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 5174
  }
});
