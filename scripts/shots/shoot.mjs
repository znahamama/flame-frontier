// Visual QA and slide screenshots with the system Chrome (playwright-core, no browser download).
// Usage: node scripts/shots/shoot.mjs <baseURL> <outDir> <spec...>
//   spec = name:hash:width[:light|dark][:fullpage|viewport][:query]
//   e.g. ev-desk:evidence:1440   ev-phone:evidence:390:dark   ev-tip:evidence:1440:light:viewport:tip=4,10
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [base, out, ...specs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const spec of specs) {
  const [name, hash, w, scheme = 'light', mode = 'fullpage', query = ''] = spec.split(':');
  const width = Number(w);
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 1080 }, deviceScaleFactor: width < 600 ? 2 : 1, colorScheme: scheme });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/${query ? `?${query}` : ''}#${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: mode === 'fullpage' });
  console.log(`${name}.png${overflow > 0 ? `  HORIZONTAL OVERFLOW ${overflow}px` : ''}${errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''}`);
  await page.close();
}
await browser.close();
