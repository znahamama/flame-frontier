// UI audit: per tab and width, screenshots + visible word counts (total and above the fold) + text blocks.
// Usage: node scripts/shots/audit.mjs <baseURL> <outDir> [widths=1440,375]
// Writes <outDir>/shots/<tab>-<w>-fold.jpg (first viewport), <tab>-<w>-full.jpg (whole page, capped) and <outDir>/audit.json.
// Read-only tooling: it never changes the site. "Visible" = rendered text (closed <details>, hidden tooltips excluded).
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const [base, out, w = '1440,375', only] = process.argv.slice(2);
const widths = w.split(',').map(Number);
// Hashes to audit (old tab hashes by default; they all still resolve). Optional 4th arg: comma-separated hashes.
const TABS = only ? only.split(',') : ['start', 'evidence', 'sandbox', 'catalog', 'ranking', 'compare', 'gaps', 'controls', 'ask', 'earth', 'clips', 'limits', 'references'];
mkdirSync(`${out}/shots`, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const result = [];
for (const width of widths) {
  const height = width < 600 ? 812 : 900;
  for (const tab of TABS) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto(`${base}/?offline#${tab}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const H = window.innerHeight;
      const words = (s) => (s.match(/[A-Za-z0-9][A-Za-z0-9'’.,%/+\-–]*/g) || []).length;
      let total = 0, fold = 0;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let n; (n = walker.nextNode());) {
        const t = n.textContent.trim();
        if (!t) continue;
        const el = n.parentElement;
        if (!el || el.closest('script,style,noscript,.skip')) continue;
        const shut = el.closest('details:not([open])');
        if (shut && !el.closest('summary')) continue;   // inside a closed <details>: on demand, not visible
        if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        range.selectNodeContents(n);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        if (!rects.length) continue;   // not rendered (e.g. inside closed <details>)
        const c = words(t);
        total += c;
        if (rects[0].top + window.scrollY < H) fold += c;
      }
      // Hidden-but-present text (closed details, collapsed sections): available on demand.
      let hidden = 0;
      document.querySelectorAll('#panel details:not([open])').forEach((d) => {
        if (d.parentElement.closest('details:not([open])')) return;   // count nested ones once
        const s = d.querySelector('summary');
        hidden += words(d.textContent) - (s ? words(s.textContent) : 0);
      });
      // Text blocks: leaf-ish block elements with their own text, in document order.
      const sel = '#panel h2,#panel h3,#panel h4,#panel p,#panel li,#panel figcaption,#panel summary,#panel dt,#panel dd,#panel label,#panel th,#panel caption,#panel blockquote';
      const blocks = [];
      for (const el of document.querySelectorAll(sel)) {
        if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY') continue;
        if (el.querySelector('p,li,dd,h2,h3,h4')) continue;   // keep the innermost blocks only
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const text = el.innerText.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        blocks.push({ tag: el.tagName.toLowerCase(), cls: el.className || '', words: words(text), top: Math.round(r.top + window.scrollY), text: text.length > 400 ? `${text.slice(0, 400)}…` : text });
      }
      const visuals = {
        canvas: document.querySelectorAll('#panel canvas').length,
        svg: [...document.querySelectorAll('#panel svg')].filter((s) => s.getBoundingClientRect().width > 60).length,
        img: document.querySelectorAll('#panel img').length,
        video: document.querySelectorAll('#panel video').length,
        tables: document.querySelectorAll('#panel table').length,
        tableRows: document.querySelectorAll('#panel tr').length,
        details: document.querySelectorAll('#panel details').length,
      };
      return { total, fold, hidden, pageHeight: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth - window.innerWidth, blocks, visuals };
    });
    const name = `${tab.replace(/[^a-z0-9]+/gi, "_")}-${width}`;
    await page.screenshot({ path: `${out}/shots/${name}-fold.jpg`, type: 'jpeg', quality: 72 });
    const full = Math.min(m.pageHeight, width < 600 ? 9000 : 6000);
    await page.screenshot({ path: `${out}/shots/${name}-full.jpg`, type: 'jpeg', quality: 60, fullPage: true, clip: { x: 0, y: 0, width, height: full }, scale: 'css' });
    result.push({ tab, width, ...m });
    console.log(`${name.padEnd(16)} fold ${String(m.fold).padStart(4)}  total ${String(m.total).padStart(5)}  hidden ${String(m.hidden).padStart(5)}  h ${m.pageHeight}  ${JSON.stringify(m.visuals)}${m.overflow > 0 ? `  OVERFLOW ${m.overflow}` : ''}`);
    await page.close();
  }
}
await browser.close();
writeFileSync(`${out}/audit.json`, JSON.stringify(result, null, 1));
