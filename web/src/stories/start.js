// Start: the main story. Pinned visual: the 134 solid-material tests fall in as dots and settle by crew air,
// then a teaching-model candle shows Earth vs microgravity, then partial gravity (no data). Every number and quote
// is read from data/processed (sandbox.json, gaps.json, external_tests.json); none is typed here.
import { loadJSON } from '../data.js';
import { headline, inMoonZone } from '../headline.js';
import { mountStory } from '../story.js';
import { binsModel, binsSVG } from '../viz/bins.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Static teaching drawings (reduced motion and no-WebGL). Qualitative only, like the 3D model.
function flameSVG(g) {
  const candle = (x) => `<rect x="${x - 13}" y="150" width="26" height="70" rx="3" fill="#eee4cf"/><rect x="${x - 1.5}" y="140" width="3" height="12" fill="#2b2622"/>`;
  const tear = (x, fill, dash) => `<path d="M${x} 40 C${x + 22} 86 ${x + 24} 118 ${x} 146 C${x - 24} 118 ${x - 22} 86 ${x} 40Z" ${fill ? 'fill="url(#ffy)"' : `fill="none" stroke="#ffa63a" stroke-width="3" ${dash ? 'stroke-dasharray="6 5"' : ''}`}/>`;
  const ball = (x, fill, dash) => `<circle cx="${x}" cy="124" r="30" ${fill ? 'fill="url(#ffb)"' : `fill="none" stroke="#5b7cff" stroke-width="3" ${dash ? 'stroke-dasharray="6 5"' : ''}`}/>`;
  const defs = '<defs><radialGradient id="ffy" cx="50%" cy="78%" r="70%"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#ffb347"/><stop offset="1" stop-color="#e2541b" stop-opacity=".2"/></radialGradient><radialGradient id="ffb" cx="50%" cy="60%" r="55%"><stop offset="0" stop-color="#0b1030"/><stop offset=".7" stop-color="#3a5bff" stop-opacity=".55"/><stop offset="1" stop-color="#7d95ff" stop-opacity=".9"/></radialGradient></defs>';
  const body = g === 'earth' ? `${candle(160)}${tear(160, true)}`
    : g === 'micro' ? `${candle(160)}${ball(160, true)}`
      : `${candle(160)}${tear(160, false, true)}${ball(160, false, true)}<text x="160" y="28" fill="#f0efec" font-size="13" text-anchor="middle" font-weight="600">Unknown: no data</text>`;
  const label = { earth: 'Earth, 1 g', micro: 'Microgravity (ISS)', partial: 'Moon or Mars: only the two bounds are drawn' }[g];
  return `<figure class="flamefig"><svg viewBox="0 0 320 220" role="img" aria-label="Teaching drawing: ${esc(label)}"><rect width="320" height="220" fill="#07080b"/>${defs}${body}</svg>
    <figcaption><span class="tm">Teaching model, not a simulation</span> ${esc(label)}</figcaption></figure>`;
}

function createVisual(model, S) {
  let root; let binsHost; let flameHost; let canvas; let flame = null; let flameTried = false; let layout = '';
  let mode = 'rain'; let fell = false; let ro;
  const cap = { earth: 'Earth, 1 g', micro: 'Microgravity (ISS)', partial: 'Moon or Mars: no data, only the two bounds' };
  const drawBins = (instant) => {
    const L = root.clientWidth < 560 ? 'rows' : 'cols';
    const first = !fell && !instant;
    if (L !== layout || first) {
      layout = L;
      binsHost.innerHTML = binsSVG(model, mode, L, { pre: first });
      if (first) { fell = true; binsHost.querySelector('svg').getBoundingClientRect(); requestAnimationFrame(() => requestAnimationFrame(() => binsHost.querySelector('svg')?.classList.remove('pre'))); }
      fell = true;
    } else {
      const svg = binsHost.querySelector('svg');
      svg.dataset.mode = mode;
      if (model.bins.some((b) => b.key === mode)) svg.dataset.hl = mode; else delete svg.dataset.hl;
    }
  };
  async function loadFlame() {
    if (flameTried) return; flameTried = true;
    try {
      const { createFlame } = await import('../flame/flame3d.js');
      flame = createFlame(canvas, { reduced: false });
      flame.set({ gravity: 'earth', o2: 21, flow: 0 });
      flame.setPaused(!flameHost.classList.contains('on'));   // render only while the flame scene is shown
    } catch {
      canvas.replaceWith(Object.assign(document.createElement('div'), { className: 'flamefallback', innerHTML: flameSVG('earth') }));
      canvas = null;
    }
  }
  return {
    mount(el) {
      root = el;
      el.innerHTML = `<div class="scene scene-bins on"></div>
        <div class="scene scene-flame"><canvas class="flamecanvas" aria-label="Teaching-model candle flame"></canvas>
          <p class="sbx-badge">Teaching model, not a simulation</p>
          <p class="sbx-legend" hidden><span class="lg-y">Earth outline</span><span class="lg-b">Microgravity outline</span></p>
          <p class="flamecap"></p></div>`;
      binsHost = el.querySelector('.scene-bins'); flameHost = el.querySelector('.scene-flame'); canvas = el.querySelector('canvas');
      ro = new ResizeObserver(() => { if (layout && (root.clientWidth < 560 ? 'rows' : 'cols') !== layout) drawBins(true); });
      ro.observe(el);
    },
    near(i) { if (i >= 3) loadFlame(); },
    set(state, { instant }) {
      const onFlame = state.scene === 'flame';
      binsHost.classList.toggle('on', !onFlame); flameHost.classList.toggle('on', onFlame);
      flame?.setPaused(!onFlame);
      if (!onFlame) { mode = state.mode; drawBins(instant); return; }
      flameHost.querySelector('.flamecap').textContent = cap[state.g];
      flameHost.querySelector('.sbx-legend').hidden = state.g !== 'partial';
      const fb = flameHost.querySelector('.flamefallback');
      if (fb) fb.innerHTML = flameSVG(state.g);
      loadFlame().then(() => { if (!flameHost.classList.contains('on')) return; flame?.setPaused(false); flame?.set({ gravity: state.g === 'partial' ? 'moon' : state.g, o2: 21, flow: 0 }); });
    },
    snapshot(state) {
      if (state.scene === 'flame') return flameSVG(state.g);
      return `<div class="snapbins">${binsSVG(model, state.mode, 'rows')}</div>`;
    },
    dispose() { ro?.disconnect(); flame?.dispose(); },
  };
}

export async function render(host) {
  const [S, gaps, ext] = await Promise.all(['sandbox.json', 'gaps.json', 'external_tests.json'].map(loadJSON));
  const model = binsModel(S, gaps);
  const bin = (k) => model.bins.find((b) => b.key === k);
  const none = bin('none'), iss = bin('iss'), moon = bin('moon_base'), suit = bin('spacesuit');
  const zone = inMoonZone(ext);
  const flows = [...new Set(moon.items.flatMap((t) => t.flows))];
  const q = S.quotes;
  const qchip = (k) => [`"${q[k].text}" (${q[k].source}, sec. ${q[k].section}; ${q[k].file})`, 'challenge page'];
  const vid = S.video;
  const bassNone = none.items.filter((t) => t.id.startsWith('BASS-II'));
  const issLo = S.habitats.find((h) => h.id === 'iss').o2_pct[0];
  const steps = [
    { id: 'dots', state: { scene: 'bins', mode: 'rain' },
      html: `Each dot is one solid-material fire test in our sources: <b>${model.total}</b>. Hover one for its source.`,
      chips: [['Every dot: one row of sandbox.json tests (BASS-II CSV rows and Saffire ICES-2024-365 Table 1 rows); hover a dot for its own file and line.', 'one row each']] },
    { id: 'bins', state: { scene: 'bins', mode: 'bins' },
      html: 'Sorted by the air each test burned in, matched to the crew-air windows our sources give.',
      chips: model.bins.filter((b) => b.sources).map((b) => [b.sources, b.label]) },
    { id: 'none', state: { scene: 'bins', mode: 'none' },
      html: `<b>${none.items.length}</b> match no crew habitat. ${bassNone.length} of them are BASS-II tests at 1 atm${bassNone.every((t) => t.o2 < issLo) ? `, all below the ISS window's ${issLo}% O2` : ''}.`,
      chips: [['BASS-II Summary Report, NASA/TM-20210011385 (Oct 2021): "pressure P = 1 atm" (printed p.11), "Ambient pressure was 1 atm" (p.94); not measured per test. O2: data/raw/PSI-25/PSI-25_Experimental table_BASS-II.csv (calibrated initial O2)', 'BASS-II report · p.11']] },
    { id: 'iss', state: { scene: 'bins', mode: 'iss' },
      html: `<b>${iss.items.length}</b> burned in ISS cabin air: ${esc(iss.window)}.`,
      chips: [[iss.sources, 'NTRS sources']] },
    { id: 'moon', state: { scene: 'bins', mode: 'moon_base' },
      html: `Moon-base air: ${esc(moon.window)}. Only <b>${moon.items.length}</b> solid tests burned there: ${esc(zone.map((t) => `${t.program} ${t.sample}`).join(' and '))}, ${moon.items.length === 2 ? "both" : "all"} at ${flows.join(', ')} cm/s.`,
      chips: [qchip('moon'), [zone.map((t) => `${t.program} ${t.sample}: ${t.o2_as_stated[0]}% O2 (${t.o2_basis}) at ${t.pressure_conversion[0]}, ${t.flow_cm_s} cm/s. ${t.source.doc}, ${t.source.locator}, p.${t.source.printed_page}`).join(' | '), 'ICES-2024-365 · Table 1 · p.3']] },
    { id: 'suit', state: { scene: 'bins', mode: 'spacesuit' },
      html: `Spacesuits: ${esc(suit.window)}. <b>${suit.items.length === 0 ? 'No' : suit.items.length}</b> solid test in our sources burned in that air.`,
      chips: [[suit.sources, 'challenge page']] },
    { id: 'earth', state: { scene: 'flame', g: 'earth' },
      html: 'Gravity changes fire too. On Earth, rising hot gas pulls a candle flame into a flickering yellow teardrop.',
      chips: [[`Official challenge video ${vid.from}–${vid.to}: ${vid.summary} (${vid.summary_note}) ${vid.url}`, `challenge video ${vid.from}–${vid.to}`]] },
    { id: 'micro', state: { scene: 'flame', g: 'micro' },
      html: `In microgravity, "${esc(q.candle.text.replace(/^Instead of a flickering teardrop, /, ''))}"`, chips: [qchip('candle')] },
    { id: 'partial', state: { scene: 'flame', g: 'partial' },
      html: `Moon and Mars lie in between, and "${esc(q.partial.text)}".`, chips: [qchip('partial'), qchip('bound')] },
    { id: 'next', state: { scene: 'bins', mode: 'moon_base' },
      html: 'Where next? Follow the evidence, explore the 24 investigations, try any air in the sandbox, or ask.',
      extra: `<p class="step-links"><a href="#evidence">Evidence</a><a href="#explore">Explore</a><a href="#sandbox">Flame Sandbox</a><a href="#ask">Ask</a><a href="#about">About</a></p>` },
  ];
  return mountStory(host, {
    section: 'start', title: 'Flame Frontier', viewHash: 'start/view', viewLabel: 'the overview',  // the Skip link reads "Skip to the overview"
    intro: `<p class="eyebrow">NASA Space Apps 2026 · Flame in Freefall</p>
      <h1 class="story-h1">${headline(zone)}</h1>
      <p class="story-sub">Scroll to see it, one dot per test.</p>`,
    steps, visual: createVisual(model, S),
  });
}
