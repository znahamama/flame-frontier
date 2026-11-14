import { render as evidence } from './tabs/evidence.js';
import { placeholder } from './tabs/placeholder.js';
import { render as limits } from './tabs/limits.js';

const TABS = [
  ['evidence', 'Evidence Map', { render: evidence }],
  ['catalog', 'Catalog', placeholder('Catalog', 'PSI combustion investigations. Coming next.')],
  ['ranking', 'Ranking', placeholder('Ranking', 'Visible rule table with per-component contributions. Coming next.')],
  ['clips', 'Clips', placeholder('Clips', 'Real BASS-II flame clips. Coming next.')],
  ['limits', 'Known Limits', { render: limits }],
];

const nav = document.querySelector('.tabs');
const panel = document.querySelector('#panel');
let cleanup = null;

async function show(id) {
  const tab = TABS.find((t) => t[0] === id) ?? TABS[0];
  nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === tab[0])));
  if (typeof cleanup === 'function') cleanup();
  panel.innerHTML = '';
  try {
    cleanup = await tab[2].render(panel);
  } catch (err) {
    panel.innerHTML = `<section class="card error"><h2>Could not load</h2><p>${err.message}</p></section>`;
    console.error(err);
  }
}

for (const [id, label] of TABS) {
  const b = document.createElement('button');
  b.role = 'tab'; b.dataset.id = id; b.textContent = label;
  b.onclick = () => { location.hash = id; };
  nav.append(b);
}
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1));
