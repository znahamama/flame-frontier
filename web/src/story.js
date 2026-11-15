// Scrolly-story engine. Native scrolling only: steps are ordinary blocks in the page; an IntersectionObserver
// watches a thin line across the viewport (middle on desktop, lower part on phones where the visual is pinned on top)
// and tells the pinned visual which step is active. No wheel/touch interception, no scroll-jacking.
//
// Every step has a deep link (#<section>/s=<step>), a "Next" link (keyboard path) and the section has a
// "Skip to the interactive view" link. Under prefers-reduced-motion the pinned visual is not used: each step shows
// its own static snapshot of the final state (visual.snapshot), as a plain sequence of panels.
import { chip } from './chips.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => matchMedia('(max-width: 760px)').matches;

/**
 * @param {HTMLElement} host
 * @param {{section: string, title: string, label?: string, intro?: string, viewHash: string, viewLabel: string,
 *   steps: {id: string, title: string, html: string, chips?: (string|[string,string])[], state: any, extra?: string}[],
 *   visual: {mount: (el: HTMLElement) => void, set: (state: any, o: {instant: boolean, index: number}) => void,
 *            snapshot: (state: any) => string, dispose?: () => void, near?: (i: number) => void}}} cfg
 */
export function mountStory(host, cfg) {
  const { section, steps, visual } = cfg;
  const stat = reducedMotion();
  const sid = (s) => `${section}-s-${s.id}`;
  const chipsHTML = (s) => (s.chips ?? []).map((c) => (Array.isArray(c) ? chip(c[0], c[1]) : chip(c))).join(' ');
  host.innerHTML = `<section class="story ${stat ? 'story--static' : ''}" aria-label="${esc(cfg.title)}: story">
    <div class="story-grid">
      <header class="story-head">
        ${cfg.intro ?? ''}
        <p class="story-tools"><a class="skipview" href="#${cfg.viewHash}">Skip to ${esc(cfg.viewLabel)} ↓</a></p>
      </header>
      ${stat ? '' : `<div class="story-stage"><div class="stage-head" aria-hidden="true"><p class="stage-title"><span class="stage-sec">${esc(cfg.label ?? cfg.title)}</span><span class="stage-step"></span></p><p class="stage-count"></p></div><div class="stage-inner"></div></div>`}
      <ol class="story-steps">
        ${steps.map((s, i) => `<li class="step" id="${sid(s)}" data-i="${i}" tabindex="-1">
          <div class="step-card">
            <p class="step-n"><a href="#${section}/s=${s.id}" title="Link to this step">${i + 1} / ${steps.length}</a>${s.title ? `<span class="step-title"> · ${esc(s.title)}</span>` : ''}</p>
            <p class="step-text">${s.html}</p>
            ${s.extra ?? ''}
            ${s.chips?.length ? `<p class="step-chips">${chipsHTML(s)}</p>` : ''}
            ${stat ? `<div class="step-static">${visual.snapshot(s.state)}</div>` : ''}
            <p class="step-nav">${i < steps.length - 1
              ? `<a class="step-next" href="#${section}/s=${steps[i + 1].id}">Next ↓</a>`
              : `<a class="step-next" href="#${cfg.viewHash}">Go to ${esc(cfg.viewLabel)} ↓</a>`}</p>
          </div></li>`).join('')}
      </ol>
    </div>
  </section>`;
  if (stat) {
    return {
      goTo(id) { const el = host.querySelector(`#${CSS.escape(`${section}-s-${id}`)}`); el?.scrollIntoView({ block: 'start' }); el?.focus({ preventScroll: true }); },
      dispose() { visual.dispose?.(); },
    };
  }

  const stage = host.querySelector('.stage-inner');
  const count = host.querySelector('.stage-count');
  const stepTitle = host.querySelector('.stage-step');
  visual.mount(stage);
  const items = [...host.querySelectorAll('.step')];
  let active = -1; let userScrolled = false; let io;

  function activate(i, instant = false) {
    if (i === active || i < 0) return;
    active = i;
    items.forEach((el, k) => el.classList.toggle('on', k === i));
    count.textContent = `${i + 1} / ${steps.length}`;
    stepTitle.textContent = steps[i].title ? ` · ${steps[i].title}` : '';
    visual.near?.(i);
    visual.set(steps[i].state, { instant, index: i });
    // Keep the address bar on the current step (shareable), without a history entry or a route change.
    if (userScrolled && location.hash.slice(1).split('/')[0] === section && !/^#[^/]+\/(view|gap=|at=)/.test(location.hash)) {
      history.replaceState(null, '', `${location.search}#${section}/s=${steps[i].id}`);
    }
  }
  // The active step is the one crossing a line: on desktop, the vertical centre of the visual (so the caption card
  // sits level with it); on phones, low in the screen below the pinned visual.
  const line = () => {
    if (narrow()) return 0.74;
    const r = stage.getBoundingClientRect();
    const top = Math.max(r.top, 0);
    const c = r.height ? (Math.min(r.bottom, innerHeight) + top) / 2 : innerHeight / 2;
    return Math.min(0.7, Math.max(0.3, c / innerHeight));
  };
  function observe() {
    io?.disconnect();
    const l = line();
    io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) activate(Number(e.target.dataset.i));
    }, { rootMargin: `-${Math.round(l * 100)}% 0px -${Math.round((1 - l) * 100) - 1}% 0px`, threshold: 0 });
    items.forEach((el) => io.observe(el));
  }
  observe();
  const mq = matchMedia('(max-width: 760px)');
  const onMq = () => observe();
  mq.addEventListener('change', onMq);
  let rt; const onResize = () => { clearTimeout(rt); rt = setTimeout(observe, 200); };
  addEventListener('resize', onResize);
  const onScroll = () => { userScrolled = true; };
  addEventListener('wheel', onScroll, { passive: true, once: true });
  addEventListener('touchmove', onScroll, { passive: true, once: true });
  addEventListener('keydown', onScroll, { once: true });
  // Before any step reaches the line (page top), show the first step's state.
  activate(0, true);

  return {
    goTo(id, smooth = true) {
      const i = steps.findIndex((s) => s.id === id);
      if (i < 0) return;
      const el = items[i];
      const card = el.querySelector('.step-card');
      const y = card.getBoundingClientRect().top + scrollY + card.offsetHeight / 2 - innerHeight * line();
      scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
      activate(i, !smooth);
      el.focus({ preventScroll: true });
      userScrolled = true;
    },
    dispose() {
      io?.disconnect(); mq.removeEventListener('change', onMq); removeEventListener('resize', onResize);
      removeEventListener('wheel', onScroll); removeEventListener('touchmove', onScroll); removeEventListener('keydown', onScroll);
      visual.dispose?.();
    },
  };
}
