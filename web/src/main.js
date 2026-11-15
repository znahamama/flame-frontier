import { render as evidence } from './tabs/evidence.js';
import { render as limits } from './tabs/limits.js';
import { render as catalog } from './tabs/catalog.js';
import { render as clips } from './tabs/clips.js';
import { render as ranking } from './tabs/ranking.js';
import { render as references } from './tabs/references.js';
import { render as compare } from './tabs/compare.js';

const TABS = [
  ['evidence', 'Evidence Map', { render: evidence }],
  ['catalog', 'Catalog', { render: catalog }],
  ['ranking', 'Ranking', { render: ranking }],
  ['compare', 'Compare', { render: compare }],
  ['clips', 'Clips', { render: clips }],
  ['limits', 'Known Limits', { render: limits }],
  ['references', 'References', { render: references }],
];

const nav = document.querySelector('.tabs');
const panel = document.querySelector('#panel');
let cleanup = null;

// Hash = "<tab>" or "<tab>/<arg>" (e.g. #compare/PSI-25,PSI-69,PSI-98).
async function show(hash) {
  const [id, arg] = hash.split(/\/(.*)/s);
  const tab = TABS.find((t) => t[0] === id) ?? TABS[0];
  nav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === tab[0])));
  if (typeof cleanup === 'function') cleanup();
  panel.innerHTML = '';
  try {
    cleanup = await tab[2].render(panel, arg);
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
