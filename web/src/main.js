
const TABS = [
  ['start', 'Start', () => import('./tabs/start.js')],
  ['evidence', 'Evidence Map', () => import('./tabs/evidence.js')],
  ['sandbox', 'Flame Sandbox', () => import('./tabs/sandbox.js')],
  ['catalog', 'Catalog', () => import('./tabs/catalog.js')],
  ['ranking', 'Ranking', () => import('./tabs/ranking.js')],
  ['compare', 'Compare', () => import('./tabs/compare.js')],
  ['gaps', 'Habitat Gaps', () => import('./tabs/gaps.js')],
  ['ask', 'Ask', () => import('./tabs/ask.js')],
  ['earth', 'On Earth', () => import('./tabs/earth.js')],
  ['clips', 'Clips', () => import('./tabs/clips.js')],
  ['limits', 'Known Limits', () => import('./tabs/limits.js')],
  ['references', 'References', () => import('./tabs/references.js')],
];

const nav = document.querySelector('.tabs');
const panel = document.querySelector('#panel');
let cleanup = null;

// Hash = "<tab>" or "<tab>/<arg>" (e.g. #compare/PSI-25,PSI-69,PSI-98).
async function show(hash) {
  const [id, arg] = hash.split(/\/(.*)/s);
  const tab = TABS.find((t) => t[0] === id) ?? TABS[0];
  nav.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.id === tab[0];
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;   // roving tabindex: Tab enters the bar on the current tab, arrows move within it
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
  document.title = tab[0] === 'start' ? 'Flame Frontier: where NASA\'s space-fire evidence ends' : `${tab[1]} · Flame Frontier`;
  if (typeof cleanup === 'function') cleanup();
  panel.innerHTML = `<section class="card loading" aria-busy="true"><p class="muted">Loading ${tab[1]}…</p></section>`;
  panel.setAttribute('aria-labelledby', `tab-${tab[0]}`);
  try {
    const mod = await tab[2]();   // each tab is its own chunk (ECharts loads only with a chart tab)
    if (location.hash.slice(1) !== hash && hash !== '') return;   // user moved on while it loaded
    cleanup = await mod.render(panel, arg);
  } catch (err) {
    const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    panel.innerHTML = `<section class="card error" role="alert"><h2>This section could not load</h2>
      <p>${esc(err.message)}</p><p class="note">The site's data files are static; reloading usually fixes this. <button type="button" class="retry">Try again</button></p></section>`;
    panel.querySelector('.retry').onclick = () => show(hash);
    console.error(err);
  }
}

for (const [id, label] of TABS) {
  const b = document.createElement('button');
  b.role = 'tab'; b.dataset.id = id; b.textContent = label; b.id = `tab-${id}`; b.setAttribute('aria-controls', 'panel');
  b.onclick = () => { location.hash = id; };
  nav.append(b);
}
// Arrow keys / Home / End move between tabs (WAI-ARIA tabs pattern, automatic activation).
nav.addEventListener('keydown', (e) => {
  const bs = [...nav.querySelectorAll('button')];
  const i = bs.indexOf(document.activeElement);
  if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: bs.length - 1 }[e.key];
  if (j === undefined) return;
  e.preventDefault();
  const b = bs[(j + bs.length) % bs.length];
  b.focus();
  b.click();
});
// Fade edges on the scrollable tab bar only where more tabs are hidden.
const wrap = nav.parentElement;
const edges = () => {
  wrap.classList.toggle('more-left', nav.scrollLeft > 4);
  wrap.classList.toggle('more-right', nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4);
};
nav.addEventListener('scroll', edges, { passive: true });
window.addEventListener('resize', edges);
window.addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1)).then(edges);
