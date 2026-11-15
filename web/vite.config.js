import { defineConfig } from 'vite';
import { cpSync, existsSync, createReadStream, statSync } from 'node:fs';
import { resolve, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { headline, inMoonZone } from './src/headline.js';

const here = dirname(fileURLToPath(import.meta.url));
const PROCESSED = resolve(here, '../data/processed');

// Serves data/processed/* at /data/* in dev and copies it into dist/data on build,
// so pipeline output stays in data/processed (single location) and the site stays static.
function processedData() {
  return {
    name: 'processed-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const file = normalize(resolve(PROCESSED, '.' + decodeURIComponent(req.url.split('?')[0])));
        if (!file.startsWith(PROCESSED + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : file.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      cpSync(PROCESSED, resolve(here, 'dist/data'), { recursive: true });
    },
  };
}

// The meta/OG description uses the same headline template as the page (no number typed into index.html).
function metaHeadline() {
  return {
    name: 'meta-headline',
    transformIndexHtml(html) {
      const ext = JSON.parse(readFileSync(resolve(PROCESSED, 'external_tests.json'), 'utf8'));
      return html.replaceAll('%HEADLINE%', headline(inMoonZone(ext)));
    },
  };
}

export default defineConfig({
  root: here,
  plugins: [processedData(), metaHeadline()],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 700 }, // echarts ~180 kB gzip
});
