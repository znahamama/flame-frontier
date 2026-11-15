// Feature checklist: every feature's old hash link (and its new link) must land on a working view.
// Usage: node scripts/shots/links.mjs <baseURL> [width=1440]
// For each link: loads it fresh, waits, and checks that the expected element exists and is visible, that no error
// card is shown, and that there are no console errors or failed requests. Exit code 1 on any failure.
import { chromium } from 'playwright-core';

const [base, w = '1440'] = process.argv.slice(2);
const Q = encodeURIComponent('Which solid materials have been burned in Moon-base air, at 30% oxygen or more and 10.2 psi or less?');
// [feature, hash, selector that proves the feature works]
const LINKS = [
  ['Start story', 'start', '.story .step'],
  ['Start overview + downloads', 'start/view', '#view .overview .tile'],
  ['Story step deep link', 'start/s=moon', '#start-s-moon.on'],
  ['Evidence story', 'evidence', '.story .step'],
  ['Evidence story step', 'evidence/s=zone', '#evidence-s-zone.on'],
  ['Evidence Map (old)', 'evidence', '#view #p1 canvas'],
  ['Evidence Map (view)', 'evidence/view', '#view #p2 canvas'],
  ['Evidence gap highlight', 'evidence/gap=moon_base.flow', '#view #gapbanner'],
  ['Evidence ringed point', 'evidence/at=54.1,31,micro,20', '#view #p1 canvas'],
  ['Evidence data table', 'evidence/view', '#view details table'],
  ['NASA figure thumbnail', 'evidence/view', '#view img[src*="bass2_fig6_10"]'],
  ['Downloads on Evidence', 'evidence/view', '#view a[href="/data/export/tests.csv"]'],
  ['Flame Sandbox', 'sandbox', '#view .sbx-ctl input[type="range"]'],
  ['Sandbox preset', 'sandbox/moon_base', '#view .sbx-total'],
  ['Sandbox URL state', 'sandbox/g=micro&o2=21&p=101.4&u=20', '#view .sbx-badges li'],
  ['Clips', 'clips', '#view video'],
  ['Clips step strip', 'clips', '#view .steps li'],
  ['Catalog', 'catalog', '#view table.cat'],
  ['Ranking', 'ranking', '#view table.rank'],
  ['Compare default', 'compare', '#view table.compare'],
  ['Compare picks', 'compare/PSI-25,PSI-69,PSI-98', '#view table.compare'],
  ['Habitat Gaps', 'gaps', '#view .maplink'],
  ['Prevent · Detect · Suppress', 'controls', '#view .ctl'],
  ['Ask', 'ask', '#view .askform input'],
  ['Ask cached answer', `ask/${Q}`, '#view .answertext'],
  ['Known Limits', 'limits', '#view .limits, #view h2'],
  ['References', 'references', '#view ul.refs, #view table'],
  ['On Earth', 'earth', '#view .earthapp'],
  ['Explore story', 'explore', '.story .step'],
  ['Explore story step', 'explore/s=ranges', '#explore-s-ranges.on'],
  ['Explore section', 'explore', '#view table.cat'],
  ['Catalog tiles + record link', 'catalog/PSI-25', '#view details#PSI-25[open]'],
  ['Ranking stacked bars', 'ranking', '#view .stack .sg'],
  ['Compare range bars', 'compare/PSI-25,PSI-69', '#view .rangebars'],
  ['Gaps coverage strip', 'gaps', '#view table.cover'],
  ['Gaps rover anchor', 'gaps', '#view #gap-rover'],
  ['Controls suppressant map', 'controls', '#view .suppfig svg'],
  ['About section', 'about', '#view h2'],
];
const FILES = ['/data/export/tests.csv', '/data/export/bass2_boundary_points.csv', '/data/export/ssce_ranges.csv', '/data/export/README.md'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let fail = 0;
for (const [feature, hash, sel] of LINKS) {
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(w) < 600 ? 812 : 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(`${base}/?offline#${hash}`, { waitUntil: 'networkidle' });
  let ok = true; let why = '';
  try { await page.waitForSelector(sel, { timeout: 8000, state: 'attached' }); } catch { ok = false; why = `missing ${sel}`; }
  if (await page.$('#panel .error')) { ok = false; why += ' error card'; }
  // A view link (not a story top or step) must land with the interactive view at the top of the screen.
  const story = /^(start|evidence|explore)$/.test(hash) || /\/s=/.test(hash);   // sections with a story open at the top
  if (!story) {
    await page.waitForTimeout(400);
    const [top, vh] = await page.evaluate(() => [document.querySelector('#viewtop')?.getBoundingClientRect().top, innerHeight]);
    if (top == null || top < -20 || top > vh * 0.4) { ok = false; why += ` view not on screen (top ${Math.round(top)})`; }
  }
  if (errors.length) { ok = false; why += ` ${[...new Set(errors)].join(' | ')}`; }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${feature.padEnd(30)} #${hash.length > 50 ? `${hash.slice(0, 47)}...` : hash}${ok ? '' : `  -> ${why.trim()}`}`);
  if (!ok) fail++;
  await page.close();
}
const page = await browser.newPage();
for (const f of FILES) {
  const r = await page.request.get(`${base}${f}`);
  const ok = r.ok() && (await r.body()).length > 100;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${'Download'.padEnd(30)} ${f}`);
  if (!ok) fail++;
}
await browser.close();
console.log(fail ? `${fail} FAILED` : 'ALL PASS');
process.exitCode = fail ? 1 : 0;
