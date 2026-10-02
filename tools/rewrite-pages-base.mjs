#!/usr/bin/env node
/**
 * Rewrite absolute-root href/src in static country HTML for GitHub Pages
 * project base (/earthmap/). Vite already handles index.html assets.
 */
import fs from 'node:fs';
import path from 'node:path';

const base = (process.env.VITE_BASE || '/earthmap/').replace(/\/?$/, '/');
const root = path.resolve('dist');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (!fs.existsSync(root)) {
  console.error('dist/ missing — run vite build first');
  process.exit(1);
}

const files = walk(root);
let n = 0;
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  // /css/... → /earthmap/css/...
  html = html.replace(/(href|src)="\/(?!\/)(css\/[^"]*)"/g, `$1="${base}$2"`);
  // href="/" and href="/countries/..." but not //cdn
  html = html.replace(/href="\/(?!\/)([^"]*)"/g, (_, rest) => {
    if (rest.startsWith('earthmap/')) return `href="/${rest}"`;
    return `href="${base}${rest}"`;
  });
  // canonical stay earthmap.live for SEO intent; leave alone
  if (html !== before) {
    fs.writeFileSync(file, html);
    n++;
  }
}
console.log(`rewrite-pages-base: base=${base} touched ${n}/${files.length} html`);
