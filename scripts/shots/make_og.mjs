// Social preview (1200x630) and PNG icons, rendered from the built site with the system Chrome.
// Usage: node scripts/shots/make_og.mjs <baseURL>   (e.g. http://localhost:4173 after `npm run build && npm run preview`)
// Writes web/public/og.png, web/public/favicon-32.png, web/public/apple-touch-icon.png. Rebuild afterwards.
// The OG card is the live Evidence Map (headline + Panel 1), so its numbers come from the data like the page's.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173';
const pub = new URL('../../web/public/', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' });
await og.goto(`${base}/#evidence/view`, { waitUntil: 'networkidle' });
await og.waitForSelector('#view #p1 canvas');
await og.addStyleTag({ content: `
  .top, .skip, .foot, .botnav, .viewhead, .layers, details, #view > section:not(:first-child) { display: none !important; }
  main, #panel, .viewwrap { padding: 0 !important; max-width: none !important; margin: 0 !important; }
  #view > section:first-child { border: 0; border-radius: 0; padding: 22px 32px 0; height: 630px; }
  .headline { font-size: 1.35rem !important; margin: 0 0 4px; }
  .chart.tall { height: 520px !important; }
  .ogmark { position: fixed; right: 28px; bottom: 16px; font: 600 15px system-ui; color: #52514e; }` });
await og.evaluate(() => {
  const m = document.createElement('div');
  m.className = 'ogmark';
  m.textContent = 'Flame Frontier · flame-frontier.vercel.app';
  document.body.append(m);
  window.dispatchEvent(new Event('resize'));
});
await og.waitForTimeout(900);
await og.screenshot({ path: `${pub}og.png` });

const svg = readFileSync(`${pub}favicon.svg`, 'utf8');
for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await p.screenshot({ path: `${pub}${name}`, omitBackground: true });
  await p.close();
}
await browser.close();
console.log('wrote og.png, favicon-32.png, apple-touch-icon.png');
