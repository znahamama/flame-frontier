// Start: the main story. Pinned visual: the 134 solid-material tests fall in as dots and settle by crew air,
// then a teaching-model candle shows Earth vs microgravity, then partial gravity (no data). Every number and quote
// is read from data/processed (sandbox.json, gaps.json, external_tests.json); none is typed here.
import { loadJSON } from '../data.js';
import { headline, inMoonZone } from '../headline.js';
import { mountStory, reducedMotion } from '../story.js';
import { chip } from '../chips.js';
import { loadGlossary, g, alt, altHTML } from '../plain.js';
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
  // Dots per row adapt to the stage's shape, so the columns grow to fill a tall stage instead of leaving it empty.
  const maxN = Math.max(...model.bins.map((b) => b.items.length));
  const pickCols = () => {
    const w = binsHost.clientWidth || root.clientWidth; const h = binsHost.clientHeight || root.clientHeight;
    if (!w || !h) return 9;
    const rows = Math.max(6, Math.floor((820 * h / w - 190) / 17.6));
    return Math.min(11, Math.max(3, Math.ceil(maxN / rows)));
  };
  const aspect = () => { const w = binsHost.clientWidth || root.clientWidth; const h = binsHost.clientHeight || root.clientHeight; return w && h ? w / h : null; };
  const layoutKey = () => (root.clientWidth < 560 ? `rows:${(aspect() ?? 0).toFixed(2)}` : `cols:${pickCols()}`);
  const drawBins = (instant) => {
    const key = layoutKey();
    const L = key.startsWith('cols') ? 'cols' : 'rows';
    const first = !fell && !instant;
    if (key !== layout || first) {
      layout = key;
      binsHost.innerHTML = binsSVG(model, mode, L, { pre: first, cols: L === 'cols' ? Number(key.split(':')[1]) : undefined, rowsAspect: L === 'rows' ? aspect() : undefined });
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
      ro = new ResizeObserver(() => { if (layout && layoutKey() !== layout) drawBins(true); });
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

// Dot colours (same classes as the bins): BASS-II rows come from NASA's PSI data files, Saffire rows from a paper.
const DOT_LEGEND = `<p class="dotlegend"><span><i class="lgdot bass"></i>BASS-II · NASA PSI data table</span><span><i class="lgdot saf"></i>Saffire · NASA paper (ICES-2024-365, Table 1)</span></p>`;

// Hero: a big count from external_tests.json and a real BASS-II flight clip (clips.json `hero`). The clip is
// decorative and is NOT one of the counted tests; its caption says so. Reduced motion: the poster image only.
function heroHTML(h, zone, G) {
  const t = h.test_info;
  const cap = `Real flight video: ${g('bass2', 'BASS-II')} test ${esc(h.test)}, ${g('pmma', 'an acrylic rod')} burning on the space station (${esc(t.date_actual.slice(0, 4))}) in ${t.o2_initial_pct}% oxygen at ${g('atm', '1 atm')}. It is not one of the ${zone.length}.`;
  const src = `Video: ${h.source_name} (PSI-25, BASS-II, CC0-1.0, DOI 10.60555/4qc4-de67), ${h.start_s}–${h.start_s + h.duration_s} s, re-encoded with macOS avconvert, looped, no sound. `
    + `Row: ${t.source.file}, line ${t.source.line} (test ${h.test}, ${t.pi}, ${t.date_actual}, ${t.material_raw}, initial O2 ${t.o2_initial_pct}%). Pressure: ${t.pressure_basis}.`;
  const media = reducedMotion()
    ? `<img class="hero-media" src="${esc(h.poster)}" alt="BASS-II test ${esc(h.test)}: a bright, smooth flame around the tip of an acrylic rod, on the space station" width="654" height="480">`
    : `<video class="hero-media" muted loop playsinline preload="none" poster="${esc(h.poster)}" data-src="${esc(h.clip)}" aria-label="Looping flight video, BASS-II test ${esc(h.test)}: a flame around the tip of an acrylic rod on the space station" width="654" height="480"></video>`;
  return `<figure class="shero">
      <div class="hero-box">${media}
        <h1 class="hero-h1"><span class="hero-n">${zone.length}</span><span class="hero-line">solid-material fire tests in ${g('moonair', 'Moon-base air')} <small class="hero-src">in our sources</small></span></h1></div>
      <figcaption class="hero-cap">${cap} ${chip(src, `PSI-25 · test ${h.test} video`)}</figcaption></figure>`;
}
// Load the clip only after the page has painted, and play it only while it is on screen.
function startHero(host) {
  const v = host.querySelector('video.hero-media');
  if (!v) return;
  const go = () => {
    if (!v.isConnected) return;
    v.src = v.dataset.src;
    const io = new IntersectionObserver(([e]) => { if (!v.isConnected) { io.disconnect(); return; } if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); });
    io.observe(v);
  };
  if (document.readyState === 'complete') setTimeout(go, 400); else addEventListener('load', () => setTimeout(go, 200), { once: true });
}

export async function render(host) {
  const [S, gaps, ext, clips, G] = await Promise.all([...['sandbox.json', 'gaps.json', 'external_tests.json', 'clips.json'].map(loadJSON), loadGlossary()]);
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
  const mh = S.habitats.find((h) => h.id === 'moon_base');
  const moonO2 = mh.o2_pct[0]; const moonP = Math.round(mh.p_kpa[1] * 10) / 10;
  const suitP = Math.round(S.habitats.find((h) => h.id === 'spacesuit').p_kpa[0] * 10) / 10;
  const hero = heroHTML(clips.hero, zone, G);
  const steps = [
    { id: 'dots', title: 'One dot per test', state: { scene: 'bins', mode: 'rain' },
      html: `Each dot is one fire test on a ${g('solids', 'solid material')}, like fabric or plastic: <b>${model.total}</b> tests in our sources. Hover or tap a dot for its source.`,
      extra: DOT_LEGEND,
      chips: [['Every dot: one row of sandbox.json tests (BASS-II CSV rows and Saffire ICES-2024-365 Table 1 rows); hover a dot for its own file and line.', 'one row each']] },
    { id: 'bins', title: 'Where the tests burned', state: { scene: 'bins', mode: 'bins' },
      html: 'Now the tests are sorted by the air they burned in, and matched to the air planned for each kind of crew home.',
      chips: model.bins.filter((b) => b.sources).map((b) => [b.sources, b.label]) },
    { id: 'none', title: 'No crew air', state: { scene: 'bins', mode: 'none' },
      html: `<b>${none.items.length}</b> match no crew home's air. ${bassNone.length} of them are ${g('bass2', 'BASS-II')} tests at Earth's sea-level pressure (${g('atm', '1 atm')})${bassNone.every((t) => t.o2 < issLo) ? `, all with less oxygen than space-station air (${issLo}% or more)` : ''}.`,
      chips: [['BASS-II Summary Report, NASA/TM-20210011385 (Oct 2021): "pressure P = 1 atm" (printed p.11), "Ambient pressure was 1 atm" (p.94); not measured per test. O2: data/raw/PSI-25/PSI-25_Experimental table_BASS-II.csv (calibrated initial O2)', 'BASS-II report · p.11']] },
    { id: 'iss', title: 'ISS cabin air', state: { scene: 'bins', mode: 'iss' },
      html: `<b>${iss.items.length}</b> burned in air like the space station's cabin: ${esc(iss.window)}, close to Earth's air (21% oxygen, ${esc(alt(101.325))}).`,
      chips: [[iss.sources, 'NTRS sources'], [G.terms.o2pct.src, "Earth's air 21%"]] },
    { id: 'moon', title: 'Moon-base air', state: { scene: 'bins', mode: 'moon_base' },
      html: `${g('moonair', 'Moon-base air')} will be ${moonO2}% oxygen or more (Earth's air: 21%) at ${moonP} kPa or less, ${altHTML(moonP)}. Only <b>${moon.items.length}</b> solid tests burned in it: ${esc(zone.map((t) => `${t.program} ${t.sample}`).join(' and '))}, ${moon.items.length === 2 ? 'both' : 'all'} with the air moving at the same speed, ${flows.join(', ')} ${g('cms', 'cm/s')}.`,
      chips: [qchip('moon'), [zone.map((t) => `${t.program} ${t.sample}: ${t.o2_as_stated[0]}% O2 (${t.o2_basis}) at ${t.pressure_conversion[0]}, ${t.flow_cm_s} cm/s. ${t.source.doc}, ${t.source.locator}, p.${t.source.printed_page}`).join(' | '), 'ICES-2024-365 · Table 1 · p.3']] },
    { id: 'suit', title: 'Spacesuit air', state: { scene: 'bins', mode: 'spacesuit' },
      html: `Spacesuits hold pure oxygen (${esc(suit.window)}; ${g('kpa', 'kPa')} is a unit of air pressure: ${altHTML(suitP)}). <b>${suit.items.length === 0 ? 'No' : suit.items.length}</b> solid test in our sources burned in that air.`,
      chips: [[suit.sources, 'challenge page']] },
    { id: 'earth', title: 'A flame on Earth', state: { scene: 'flame', g: 'earth' },
      html: 'Gravity changes fire too. On Earth, rising hot gas pulls a candle flame into a flickering yellow teardrop.',
      chips: [[`Official challenge video ${vid.from}–${vid.to}: ${vid.summary} (${vid.summary_note}) ${vid.url}`, `challenge video ${vid.from}–${vid.to}`]] },
    { id: 'micro', title: 'A flame in microgravity', state: { scene: 'flame', g: 'micro' },
      html: `In ${g('micro')}, "${esc(q.candle.text.replace(/^Instead of a flickering teardrop, /, ''))}"`, chips: [qchip('candle')] },
    { id: 'partial', title: 'Partial gravity', state: { scene: 'flame', g: 'partial' },
      html: `${g('partial', 'Moon and Mars gravity')} lies in between, and "${esc(q.partial.text)}".`, chips: [qchip('partial'), qchip('bound')] },
    { id: 'next', title: 'Where next', state: { scene: 'bins', mode: 'moon_base' },
      html: 'Where next? Follow the evidence, explore the 24 investigations, try any air in the sandbox, or ask.',
      extra: `<p class="step-links"><a href="#evidence">Evidence</a><a href="#explore">Explore</a><a href="#sandbox">Flame Sandbox</a><a href="#ask">Ask</a><a href="#about">About</a></p>` },
  ];
  const story = mountStory(host, {
    section: 'start', title: 'Flame Frontier', label: 'Story', viewHash: 'start/view', viewLabel: 'the overview',  // the Skip link reads "Skip to the overview"
    intro: `<p class="eyebrow">NASA Space Apps 2026 · Flame in Freefall</p>
      ${hero}
      <p class="story-why">Astronauts will live in ${g('moonair', 'Moon bases')} whose air holds more oxygen than Earth's. ${g('o2fire', 'More oxygen makes materials burn more easily')}, so crews need to know which materials are safe.</p>
      <p class="story-headline">${headline(zone)}</p>
      <p class="story-sub">Scroll to see it, one dot per test.</p>`,
    steps, visual: createVisual(model, S),
  });
  startHero(host);
  return story;
}
