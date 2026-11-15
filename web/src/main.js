// Router: 5 sections (Story / Evidence / Explore / Ask / About). A section page is an optional scrolly story on top
// and the interactive view(s) below it. Every old tab hash still works and lands on its interactive view:
//   #start, #evidence, #explore, #ask, #about             section from the top (story first)
//   #<section>/s=<step>                                     a story step
//   #<section>/view                                         the section's first interactive view
//   #evidence/gap=... | #evidence/at=... | #ask/<question>  first view with an argument
//   #sandbox[/...] #clips #catalog #ranking #compare[/...] #gaps #controls #limits #references #earth   that view
import { chipify } from './chips.js';

const VIEWS = {
  start: ['Overview', () => import('./tabs/start.js')],
  evidence: ['Evidence Map', () => import('./tabs/evidence.js')],
  sandbox: ['Flame Sandbox', () => import('./tabs/sandbox.js')],
  clips: ['Clips', () => import('./tabs/clips.js')],
  catalog: ['Catalog', () => import('./tabs/catalog.js')],
  ranking: ['Ranking', () => import('./tabs/ranking.js')],
  compare: ['Compare', () => import('./tabs/compare.js')],
  gaps: ['Habitat Gaps', () => import('./tabs/gaps.js')],
  controls: ['Prevent · Detect · Suppress', () => import('./tabs/controls.js')],
  ask: ['Ask', () => import('./tabs/ask.js')],
  limits: ['Known Limits', () => import('./tabs/limits.js')],
  references: ['References', () => import('./tabs/references.js')],
  earth: ['On Earth', () => import('./tabs/earth.js')],
};
const SECTIONS = [
  { id: 'start', label: 'Story', views: ['start'], story: () => import('./stories/start.js') },
  { id: 'evidence', label: 'Evidence', views: ['evidence', 'sandbox', 'clips'], story: () => import('./stories/evidence.js') },
  { id: 'explore', label: 'Explore', views: ['catalog', 'ranking', 'compare', 'gaps', 'controls'], story: () => import('./stories/explore.js') },
  { id: 'ask', label: 'Ask', views: ['ask'], story: () => import('./stories/ask.js') },
  { id: 'about', label: 'About', views: ['limits', 'references', 'earth'], story: () => import('./stories/about.js') },
];
export const viewHref = (sec, v) => (v === sec.id ? `#${v}/view` : `#${v}`);

// Stale-tab guard. Navigation is hash-only, so a tab left open (or restored from the back/forward cache) keeps running
// the build it first loaded, and after a deploy its lazy chunks no longer exist. Compare this build's ID with the
// server's /version.json (never cached) and reload once if they differ. The hash survives the reload.
const BUILD = __BUILD_ID__;
let lastCheck = 0;
async function checkVersion(force = false) {
  if (import.meta.env.DEV || (!force && Date.now() - lastCheck < 30000)) return false;
  lastCheck = Date.now();
  try {
    const r = await fetch('/version.json', { cache: 'no-store' });
    const { build } = r.ok ? await r.json() : {};
    if (!build || build === BUILD) return false;
    const key = `ff-reload-${build}`;
    try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1'); } catch { /* storage blocked: still reload */ }
    location.reload();
    return true;
  } catch { return false; }   // offline: keep the running build
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) checkVersion(true); });

const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const panel = document.querySelector('#panel');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function parse(hash) {
  if (/^gap-[\w-]+$/.test(hash)) hash = `gaps/${hash.slice(4)}`;   // old in-page anchors (#gap-rover) open that card
  const [a, rest] = hash.split(/\/(.*)/s);
  let sec = SECTIONS.find((s) => s.id === a);
  if (sec) {
    const v = sec.views[0];
    if (rest?.startsWith('s=')) return { sec, view: v, step: decodeURIComponent(rest.slice(2)), target: 'step' };
    if (rest === 'view') return { sec, view: v, target: 'view' };
    if (rest) return { sec, view: v, arg: rest, target: 'view' };
    return { sec, view: v, target: sec.story ? 'top' : 'view0' };
  }
  sec = SECTIONS.find((s) => s.views.includes(a));
  if (sec) return { sec, view: a, arg: rest, target: 'view' };
  return { sec: SECTIONS[0], view: 'start', target: 'top' };
}

// Section navigation: header (desktop) and bottom bar (phone).
const navs = [...document.querySelectorAll('.secnav')];
for (const n of navs) n.innerHTML = SECTIONS.map((s) => `<a href="#${s.id}" data-sec="${s.id}"><span class="ni" aria-hidden="true">${{ start: '◉', evidence: '◎', explore: '▦', ask: '?', about: 'ⓘ' }[s.id]}</span><span>${s.label}</span></a>`).join('');

let cur = { sec: null, view: null, arg: undefined, story: null, viewCleanup: null, mo: null };

function shell(sec) {
  panel.innerHTML = `${sec.story ? '<div class="story-host"></div>' : ''}
    <section class="viewwrap" id="viewtop" tabindex="-1" aria-label="${esc(sec.label)}: interactive view">
      ${sec.views.length > 1 ? `<div class="viewhead"><p class="viewsec">${esc(sec.label)}</p>
        <nav class="subnav" aria-label="${esc(sec.label)} views">${sec.views.map((v) => `<a href="${viewHref(sec, v)}" data-v="${v}">${esc(VIEWS[v][0])}</a>`).join('')}</nav></div>` : ''}
      <div id="view" class="viewgrid"></div>
    </section>`;
}

async function renderView(r) {
  const host = panel.querySelector('#view');
  if (typeof cur.viewCleanup === 'function') cur.viewCleanup();
  cur.viewCleanup = null;
  cur.mo?.disconnect();
  panel.querySelectorAll('.subnav a').forEach((a) => (a.dataset.v === r.view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  host.innerHTML = `<section class="card loading" aria-busy="true"><p class="muted">Loading ${esc(VIEWS[r.view][0])}…</p></section>`;
  const mod = await VIEWS[r.view][1]();
  cur.viewCleanup = await mod.render(host, r.arg);
  chipify(host);
  cur.mo = new MutationObserver(() => chipify(host));
  cur.mo.observe(host, { childList: true, subtree: true });
}

let navSeq = 0;
async function show(hash) {
  const nav = ++navSeq;   // views may rewrite the hash with replaceState while they load; only a newer show() cancels this one
  const r = parse(hash);
  navs.forEach((n) => n.querySelectorAll('a').forEach((a) => (a.dataset.sec === r.sec.id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'))));
  const vlabel = VIEWS[r.view][0];
  document.title = r.sec.id === 'start' && r.target !== 'view' ? 'Flame Frontier: where NASA\'s space-fire evidence ends' : `${r.view === r.sec.id || r.sec.views.length === 1 ? r.sec.label : vlabel} · Flame Frontier`;
  try {
    const newSec = r.sec !== cur.sec;
    if (newSec) {
      cur.story?.dispose?.(); cur.story = null;
      if (typeof cur.viewCleanup === 'function') cur.viewCleanup();
      cur.viewCleanup = null; cur.view = null;
      shell(r.sec);
      cur.sec = r.sec;
    }
    // Story and view load in parallel (their data files are independent).
    const jobs = [];
    if (newSec && r.sec.story) {
      jobs.push(r.sec.story().then(async (mod) => {
        if (cur.sec !== r.sec) return;
        cur.story = await mod.render(panel.querySelector('.story-host'));
      }));
    }
    if (newSec || r.view !== cur.view || r.arg !== cur.arg) {
      cur.view = r.view; cur.arg = r.arg;
      jobs.push(renderView(r));
    }
    await Promise.all(jobs);
    if (cur.sec !== r.sec) return;
    // Let the new story's height reach a frame before scrolling past it, so the jump is a scroll, not a layout shift.
    if (newSec) await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    if (nav !== navSeq) return;   // the user navigated again while this loaded
    const smooth = !newSec && !reduced();
    if (r.target === 'step') cur.story?.goTo(r.step, smooth);
    else if (r.target === 'view' || (r.target === 'view0' && !newSec)) {
      const vt = panel.querySelector('#viewtop');
      // A view can name a spot inside itself for this link (e.g. #limits/panel2, #catalog/PSI-25) with data-goto.
      const spot = panel.querySelector('#view [data-goto]');
      spot?.removeAttribute('data-goto');
      (spot ?? vt).scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      if (!newSec) (spot ?? vt).focus({ preventScroll: true });   // keyboard users continue from the view
    }
    else if (newSec || r.target === 'top') scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  } catch (err) {
    if (await checkVersion(true)) return;   // a missing chunk usually means a newer deploy: reload into it
    cur.sec = null;
    panel.innerHTML = `<section class="card error" role="alert"><h2>This section could not load</h2>
      <p>${esc(err.message)}</p><p class="note">The site's data files are static; reloading usually fixes this. <button type="button" class="retry">Try again</button></p></section>`;
    panel.querySelector('.retry').onclick = () => show(hash);
    console.error(err);
  }
}

window.addEventListener('hashchange', () => { checkVersion(); show(location.hash.slice(1)); });
show(location.hash.slice(1));
