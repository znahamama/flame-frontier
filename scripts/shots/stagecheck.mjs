// Stage composition check for scrolly stories: for every step at every size and scheme, measures how much of the pinned
// stage the active visual leaves empty (top/bottom/left/right margin as a share of the stage) and finds text labels
// that overlap each other or are struck through by a drawn line. Read-only.
// Usage: node scripts/shots/stagecheck.mjs <baseURL> [sections=start,evidence,explore,ask,about] [sizes=1280x760,1440x900,1920x1080,375x812] [schemes=light,dark]
import { chromium } from 'playwright-core';

const [base, secs = 'start,evidence,explore,ask,about', sizes = '1280x760,1440x900,1920x1080,375x812', sc = 'light,dark'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
let bad = 0; let n = 0;
for (const size of sizes.split(',')) for (const scheme of sc.split(',')) for (const section of secs.split(',')) {
  const [width, height] = size.split('x').map(Number);
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
  await page.goto(`${base}/#${section}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const ids = await page.$$eval('.step', (els) => els.map((e) => e.id.split('-s-')[1]));
  for (const id of ids) {
    await page.evaluate((h) => { location.hash = h; }, `${section}/s=${id}`);
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => {
      const inner = document.querySelector('.stage-inner'); if (!inner) return { err: 'no stage' };
      const S = inner.getBoundingClientRect();
      const scene = [...inner.querySelectorAll('.scene')].find((s) => s.classList.contains('on')) ?? inner;
      const vis = (el) => { const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; let e = el; while (e && e !== scene) { if (+getComputedStyle(e).opacity < 0.05) return false; e = e.parentElement; } return true; };
      const leaves = [...scene.querySelectorAll('text, circle, rect, path, polyline, line, canvas, li, td, th, p, i, img')].filter((e) => !e.closest('defs') && vis(e));
      let L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
      for (const e of leaves) { const b = e.getBoundingClientRect(); if (b.width < 1 && b.height < 1) continue; if (b.right < S.left - 40 || b.left > S.right + 40 || b.bottom < S.top - 40 || b.top > S.bottom + 40) continue; L = Math.min(L, b.left); T = Math.min(T, b.top); R = Math.max(R, b.right); B = Math.max(B, b.bottom); }
      const m = { top: (T - S.top) / S.height, bottom: (S.bottom - B) / S.height, left: (L - S.left) / S.width, right: (S.right - R) / S.width };
      // Text-on-text overlaps (visible SVG text only), ignoring identical positions inside one group.
      const texts = [...scene.querySelectorAll('svg text')].filter(vis).map((e) => ({ e, b: e.getBoundingClientRect(), t: e.textContent.trim() })).filter((x) => x.t && x.b.width > 0);
      const over = [];
      for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i].b, c = texts[j].b; const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left); const iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (ix > 2 && iy > 3) over.push(`"${texts[i].t.slice(0, 24)}" x "${texts[j].t.slice(0, 24)}"`);
      }
      // HTML overflow inside stage cards (content cut off).
      const cut = [...scene.querySelectorAll('.stagecard')].filter((c) => c.scrollHeight > c.clientHeight + 4).length;
      return { m, over, cut };
    });
    n++;
    const worst = r.m ? Math.max(r.m.top + r.m.bottom, r.m.left + r.m.right) : 1;
    const side = r.m ? Math.max(r.m.top, r.m.bottom, r.m.left, r.m.right) : 1;
    const flags = [];
    if (r.err) flags.push(r.err);
    if (side > 0.25) flags.push(`empty ${Object.entries(r.m).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(' ')}`);
    if (r.over?.length) flags.push(`text overlap: ${r.over.join('; ')}`);
    if (r.cut) flags.push(`${r.cut} card(s) cut off`);
    if (flags.length) { bad++; console.log(`${section}/s=${id} ${size} ${scheme}: ${flags.join(' | ')}`); }
  }
  await page.close();
}
await browser.close();
console.log(`${n} step views checked, ${bad} with problems`);
process.exitCode = bad ? 1 : 0;
