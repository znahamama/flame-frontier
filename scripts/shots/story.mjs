// Visual QA for scrolly stories: one viewport screenshot per story step (via its deep link) and of the view.
// Usage: node scripts/shots/story.mjs <baseURL> <outDir> <section> [sizes=1440,375] [schemes=light,dark] [motion=on,off]
// A size is a width (height 900, or 812 under 600 px) or WxH, e.g. 1280x760,1920x1080.
// Reports horizontal overflow, console errors and failed requests per shot.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [base, out, section, w = '1440,375', sc = 'light,dark', mo = 'on,off'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
let problems = 0;
for (const size of w.split(',')) for (const scheme of sc.split(',')) for (const motion of mo.split(',')) {
  const [width, hh] = size.split('x').map(Number);
  const height = hh || (width < 600 ? 812 : 900);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, colorScheme: scheme, reducedMotion: motion === 'off' ? 'reduce' : 'no-preference' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(`${base}/#${section}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const ids = await page.$$eval('.step', (els) => els.map((e) => e.id.split('-s-')[1]));
  const tag = `${section}-${hh ? size : width}-${scheme}-${motion}`;
  const shots = [['top', null], ...ids.map((id) => [id, `${section}/s=${id}`]), ['view', `${section}/view`]];
  for (const [name, hash] of shots) {
    if (hash) { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(motion === 'on' ? 1900 : 500); }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: `${out}/${tag}-${name}.jpg`, type: 'jpeg', quality: 70 });
    if (overflow > 0) { problems++; console.log(`${tag}-${name}: HORIZONTAL OVERFLOW ${overflow}px`); }
  }
  if (errors.length) { problems++; console.log(`${tag}: ERRORS ${[...new Set(errors)].join(' | ')}`); }
  console.log(`${tag}: ${shots.length} shots`);
  await page.close();
}
await browser.close();
process.exitCode = problems ? 1 : 0;
