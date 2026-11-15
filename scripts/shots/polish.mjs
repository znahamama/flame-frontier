// Before/after stills for the polish batch (hero, names, collapsed detail, dot legend, story->view band, plain text).
// Usage: node scripts/shots/polish.mjs <baseURL> <outDir>
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SIZES = { d: [1440, 900], w: [1920, 1080], s: [1280, 760], p: [375, 812] };
// name, hash, size, scheme, action ('top' | 'end' = scroll so the last step and the view top share the screen | 'full')
const SHOTS = [
  ['1-hero', 'start', 'd', 'light', 'top'], ['1-hero', 'start', 'p', 'dark', 'top'], ['1-hero', 'start', 'w', 'dark', 'top'],
  ['2-ranking', 'ranking', 'd', 'light', 'view'], ['2-catalog', 'catalog', 'd', 'dark', 'view'], ['2-compare', 'compare', 'd', 'light', 'view'],
  ['2-explore-rank', 'explore/s=top', 'd', 'light', 'step'], ['2-explore-tiles', 'explore/s=tiles', 'p', 'dark', 'step'],
  ['3-gaps', 'gaps', 'd', 'light', 'full'], ['3-controls', 'controls', 'p', 'dark', 'full'], ['3-catalog', 'catalog', 'p', 'light', 'full'],
  ['4-legend', 'start/s=dots', 'd', 'dark', 'step'], ['4-legend', 'start/s=dots', 'p', 'light', 'step'],
  ['5-band', 'start/s=next', 'd', 'light', 'end'], ['5-band', 'evidence/s=atm', 's', 'dark', 'end'], ['5-band', 'explore/s=next', 'p', 'dark', 'end'],
  ['6-plain', 'start/s=moon', 'd', 'light', 'step'], ['6-plain', 'evidence/s=branches', 'd', 'dark', 'step'], ['6-plain', 'evidence/s=zone', 'p', 'light', 'step'],
];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [name, hash, sz, scheme, act] of SHOTS) {
  const [w, h] = SIZES[sz];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 600 ? 2 : 1, colorScheme: scheme });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${base}/#${hash}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  if (act === 'end') {
    // Scroll until the top of the interactive view reaches the bottom quarter of the screen: what lies between the
    // last step card and the view is the band.
    await page.evaluate(() => { const v = document.querySelector('#viewtop'); const c = [...document.querySelectorAll('.step-card')].pop(); const y = c.getBoundingClientRect().top + scrollY - 120; scrollTo(0, y); });
    await page.waitForTimeout(700);
  }
  const band = await page.evaluate(() => { const c = [...document.querySelectorAll('.step-card')].pop(); const v = document.querySelector('#viewtop'); return c && v ? Math.round(v.getBoundingClientRect().top - c.getBoundingClientRect().bottom) : null; });
  const file = `${out}/${name}-${hash.replace(/[/=]/g, '_')}-${w}x${h}-${scheme}.png`;
  await page.screenshot({ path: file, fullPage: act === 'full' });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(`${file.split('/').pop()}${act === 'end' ? `  band=${band}px` : ''}${ov > 0 ? `  OVERFLOW ${ov}` : ''}${errs.length ? `  ERR ${errs.join(' | ')}` : ''}`);
  await page.close();
}
await browser.close();
