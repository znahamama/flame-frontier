// Demo assets for the Space Apps submission.
//
//   node scripts/shots/demo.mjs <baseURL> [outDir=media/demo] [--tabs] [--story] [--tour]
//
//   --tabs   1920x1080 screenshot of every tab, light and dark          -> <outDir>/tabs/<tab>-<scheme>.png
//   --story  one 1920x1080 still per shot of the 30 s video, both themes -> <outDir>/story/<nn>-<id>-<scheme>.png
//   --tour   opens a visible Chrome window at 1920x1080 and plays the 30 s shot list live (with the real timings),
//            so you can screen-record it (macOS: Cmd+Shift+5, "Record Selected Portion" over the window).
//   (no flag = --tabs --story)
// Always (re)writes docs/demo/SHOT_LIST.md. Every number in it is read from data/processed, never typed here.
// outDir defaults to media/ (gitignored): screenshots are build outputs, not source.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [base, outArg] = args.filter((a) => !a.startsWith('--'));
if (!base) { console.error('usage: node scripts/shots/demo.mjs <baseURL> [outDir] [--tabs] [--story] [--tour]'); process.exit(2); }
const OUT = resolve(ROOT, outArg ?? 'media/demo');
const all = !flags.has('--tabs') && !flags.has('--story') && !flags.has('--tour');
const W = 1920; const H = 1080;

// ---------- Numbers for the shot list, from the same files the site reads ----------
const J = (n) => JSON.parse(readFileSync(resolve(ROOT, 'data/processed', n), 'utf8'));
const [ext, bass2, flex, cfig, cat, gaps, qa, sbx] = ['external_tests.json', 'bass2_tests.json', 'flex_tests.json', 'cfig_tests.json',
  'catalog.json', 'gaps.json', 'qa_cache.json', 'sandbox.json'].map(J);
const zone = ext.tests.filter((t) => t.in_moon_zone && t.kind === 'point');
const placed = bass2.count + ext.tests.filter((t) => t.kind === 'point').length + flex.count + cfig.count;
const moon = gaps.habitats.find((h) => h.habitat.id === 'moon_base');
const flows = [...new Set(zone.map((t) => t.flow_cm_s))];
const names = `${zone[0].program} ${zone.map((t) => t.sample).join(' and ')}`;
const q1 = qa.answers.find((a) => /Moon-base air/.test(a.question)) ?? qa.answers[0];
const moonPreset = sbx.presets.find((p) => p.id === 'moon_base');
// Panel 1 series order: pO2 guides, one SSCE bar per O2 level, then Saffire. Tooltip on the first in-zone Saffire point.
const ssceLevels = new Set(ext.tests.filter((t) => t.kind !== 'point').flatMap((t) => t.o2_pct)).size;
const saffire = ext.tests.filter((t) => t.program === 'Saffire');
const tip = `${2 + ssceLevels},${saffire.findIndex((t) => t.in_moon_zone)}`;
const habitatGapCount = moon.gaps.length;
const nInv = cat.investigations.length;

// Each shot: what is on screen, the on-screen caption (<= 9 words), optional voice-over, and how to reach the state.
const SHOTS = [
  { id: 'problem', t: [0, 4], hash: 'start', caption: `${nInv} NASA fire investigations. Moon bases need answers.`,
    vo: `NASA's PSI database holds ${nInv} combustion investigations. Moon bases will breathe ${moonPreset.o2}% oxygen or more at ${(moonPreset.p_kpa / sbx.units.psi_to_kpa).toFixed(1)} psi or less: more oxygen than Earth's air, at lower pressure.`,
    screen: `Start tab: the headline and the four stat tiles (${placed} tests placed; ${zone.length} solids in Moon-base air; 0 in partial gravity).` },
  { id: 'feel', t: [4, 10], hash: 'sandbox/earth', act: 'iss', caption: 'In space, fire changes shape.',
    vo: `In microgravity, NASA's challenge page says, "a candle flame becomes a ghostly blue sphere".`,
    screen: 'Flame Sandbox: Earth teardrop; at 0:06 click "ISS microgravity" and let the flame morph (teaching model, labelled).' },
  { id: 'moon', t: [10, 15], hash: 'sandbox/moon_base', caption: 'Moon-base air: no data.',
    vo: `Set it to Moon-base air: no test matches all of these conditions, and partial gravity is unknown.`,
    screen: `Flame Sandbox, "Moon base" preset (${moonPreset.o2}% O2, ${moonPreset.p_kpa} kPa, Moon gravity): the two outline bounds next to "0 solid-material tests match" and the badges (Gravity, Airflow, Boundary: "Unknown: no data").` },
  { id: 'empty-zone', t: [15, 20], hash: 'evidence', query: `tip=${tip}`, caption: `Only ${zone.length} solid tests in Moon-base air.`,
    vo: `Across ${placed} tests we could place, only ${zone.length} solid-material tests burned in Moon-base air, ${zone.length === 2 ? 'both' : 'all'} at ${flows.join(', ')} centimetres per second.`,
    screen: `Evidence Map Panel 1: the shaded Moon-base box with only ${names}; tooltip open on ${zone[0].program} ${zone[0].sample} showing its source (paper, table, page).` },
  { id: 'trace-ask', t: [20, 25], hash: `ask/${encodeURIComponent(q1.question)}`, caption: 'Every number traced. Ask, and see sources.',
    vo: 'Every point links to its NASA file and row. Ask a question and every sentence cites its source.',
    screen: `Ask tab: the cached answer to "${q1.question}" with its numbered citations and passages.` },
  { id: 'gap', t: [25, 30], hash: 'gaps', scrollTo: '#gap-moon_base', caption: 'The gap NASA can close next.',
    vo: `That leaves ${habitatGapCount} gaps in the Moon-base data. Lunar-gravity experiments such as LUCI and FM2 can start closing them. Flame Frontier: flame-frontier.vercel.app.`,
    screen: `Habitat Gaps, Moon base card: ${habitatGapCount} gaps (${moon.gaps.map((g) => g.id).join(', ')}). End card: site URL.` },
];

function shotList() {
  const mmss = (s) => `0:${String(s).padStart(2, '0')}`;
  const rows = SHOTS.map((s, i) => `| ${i + 1} | ${mmss(s.t[0])}–${mmss(s.t[1])} | ${s.screen} | **${s.caption}** | ${s.vo} | \`#${s.hash}${s.query ? `\` + \`?${s.query}` : ''}\` |`).join('\n');
  return `# 30-second demo video: shot list

Generated by \`scripts/shots/demo.mjs\` from \`data/processed\` (do not hand-edit numbers; re-run the script).
Story: **problem → feel the difference → the empty Moon-base zone → trace and ask → the gap NASA can close.**

| # | Time | On screen | Caption (burned in) | Voice-over (optional) | URL state |
|---|---|---|---|---|---|
${rows}

## How to record
1. \`node scripts/shots/demo.mjs https://flame-frontier.vercel.app --tour\` opens Chrome at 1920×1080 and plays these shots with these timings.
2. Record the window (macOS: Cmd+Shift+5 → "Record Selected Portion"), trim to 30 s, add the captions (white on dark, bottom third).
3. Stills for every shot, light and dark: \`node scripts/shots/demo.mjs https://flame-frontier.vercel.app --story\` → \`media/demo/story/\`.

## Rules for the edit
- Keep the "Teaching model, not a simulation" badge visible in shots 2–3.
- Say "in our sources" if the headline is read aloud; never say "no test at Moon-base oxygen" (retired claim).
- Numbers in captions come from this file; if the data change, re-run the script.
- Music or narration added in the edit must be listed in References (all external resources).
`;
}

// ---------- Browser helpers ----------
async function settle(page, hash) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('#panel .loading'));
  await page.waitForTimeout(hash.startsWith('sandbox') ? 1600 : 900);   // charts animate in; the flame morph settles
}
async function open(page, s, scheme) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(`${base}/${s.query ? `?${s.query}` : ''}#${s.hash}`, { waitUntil: 'networkidle' });
  await settle(page, s.hash);
  if (s.act === 'iss') { await page.click('.sbx-grav button[data-g="micro"]'); await page.waitForTimeout(1500); }
  if (s.scrollTo) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }), s.scrollTo);
  await page.waitForTimeout(300);
}

async function capture(browser, list, dir) {
  mkdirSync(dir, { recursive: true });
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: scheme });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
    for (const s of list) {
      errors.length = 0;
      await open(page, s, scheme);
      const file = `${dir}/${s.file}-${scheme}.png`;
      await page.screenshot({ path: file });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(`${file.replace(`${ROOT}/`, '')}${overflow > 0 ? `  HORIZONTAL OVERFLOW ${overflow}px` : ''}${errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''}`);
    }
    await page.close();
  }
}

async function tour(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  // Preload every tab once so the recorded run has no loading states.
  for (const s of SHOTS) { await page.goto(`${base}/${s.query ? `?${s.query}` : ''}#${s.hash}`, { waitUntil: 'networkidle' }); }
  await page.goto(`${base}/#start`, { waitUntil: 'networkidle' });
  console.log('Start recording now. The tour begins in 5 s.');
  await page.waitForTimeout(5000);
  const t0 = Date.now();
  for (const s of SHOTS) {
    const at = (sec) => page.waitForTimeout(Math.max(0, t0 + sec * 1000 - Date.now()));
    await at(s.t[0]);
    console.log(`${s.t[0]}s  ${s.id}`);
    if (s.query) await page.goto(`${base}/?${s.query}#${s.hash}`, { waitUntil: 'networkidle' });
    else await page.evaluate((h) => { location.hash = h; }, s.hash);
    await page.waitForTimeout(500);
    if (s.act === 'iss') { await at(s.t[0] + 2); await page.click('.sbx-grav button[data-g="micro"]'); }
    if (s.scrollTo) await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), s.scrollTo);
  }
  await page.waitForTimeout(Math.max(0, t0 + 30000 - Date.now()));
  console.log('30 s: stop recording.');
  await page.waitForTimeout(1500);
}

mkdirSync(resolve(ROOT, 'docs/demo'), { recursive: true });
writeFileSync(resolve(ROOT, 'docs/demo/SHOT_LIST.md'), shotList());
console.log('wrote docs/demo/SHOT_LIST.md');

const headed = flags.has('--tour');
const browser = await chromium.launch({ channel: 'chrome', headless: !headed, args: headed ? [`--window-size=${W},${H + 87}`] : [] });
try {
  if (all || flags.has('--tabs')) {
    const main = readFileSync(resolve(ROOT, 'web/src/main.js'), 'utf8');
    const tabs = [...main.matchAll(/\['([a-z]+)', '([^']+)', \(\) => import/g)].map(([, id]) => ({ id, hash: id, file: id }));
    await capture(browser, tabs, `${OUT}/tabs`);
  }
  if (all || flags.has('--story')) await capture(browser, SHOTS.map((s, i) => ({ ...s, file: `${String(i + 1).padStart(2, '0')}-${s.id}` })), `${OUT}/story`);
  if (headed) await tour(browser);
} finally {
  await browser.close();
}
