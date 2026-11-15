// Word counts as a visitor lands: visible words inside the viewport where the link lands (not the page top),
// words in the interactive view (#view) and in the story (.story), outside closed <details>.
// Usage: node scripts/shots/words.mjs <baseURL> <hash,hash,...> [widths=1440,375]
import { chromium } from 'playwright-core';
const [base, hashes, w = '1440,375'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', headless: true });
for (const width of w.split(',').map(Number)) for (const h of hashes.split(',')) {
  const p = await b.newPage({ viewport: { width, height: width < 600 ? 812 : 900 } });
  await p.goto(`${base}/?offline#${h}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const m = await p.evaluate(() => {
    const words = (s) => (s.match(/[A-Za-z0-9][A-Za-z0-9'’.,%/+\-–]*/g) || []).length;
    const count = (root, inView) => {
      if (!root) return 0;
      let n = 0; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) {
        const t = tw.currentNode; const el = t.parentElement;
        if (!el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const d = el.closest('details'); if (d && !d.open && !el.closest('summary')) continue;
        if (el.closest('svg')) continue;
        const r = document.createRange(); r.selectNodeContents(t); const rc = r.getBoundingClientRect();
        if (inView && (rc.bottom < 0 || rc.top > innerHeight || rc.height === 0)) continue;
        n += words(t.textContent);
      }
      return n;
    };
    return { fold: count(document.querySelector('#panel'), true), view: count(document.querySelector('#view')), story: count(document.querySelector('.story')) };
  });
  console.log(`${String(width).padEnd(5)} #${h.padEnd(16)} landing viewport ${String(m.fold).padStart(4)}  view ${String(m.view).padStart(5)}  story ${String(m.story).padStart(4)}`);
  await p.close();
}
await b.close();
