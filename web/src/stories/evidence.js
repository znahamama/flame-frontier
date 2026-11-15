// Evidence story: the atmosphere map (Panel 1, solids only) with the Moon-base zone and what is missing inside it,
// then NASA's BASS-II flammability boundary drawing itself (Panel 2). Numbers come from sandbox.json, reference.json,
// external_tests.json, bass2_tests.json and gaps.json; sentences are templates over them.
import { loadJSON } from '../data.js';
import { inMoonZone } from '../headline.js';
import { mountStory } from '../story.js';
import { atmosModel, mapSVG, curveSVG } from '../viz/atmos.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const bassSrc = (q) => `${q.source.file}, line ${q.source.line}${q.source_xlsx ? `; ${q.source_xlsx.file}, tab "${q.source_xlsx.tab}", row ${q.source_xlsx.row}` : ''}${q.source_calibration ? `; ${q.source_calibration.file} (${q.source_calibration.date}, restrictor ${q.source_calibration.restrictor})` : ''}`;

function createVisual(m, card) {
  let root; let mapHost; let curveHost; let ro; let narrow = null; let last = null; let curStage = '';
  const isNarrow = () => root.clientWidth < 560;
  function draw() {
    narrow = isNarrow(); curStage = '';
    mapHost.innerHTML = mapSVG(m, { card, narrow });
    curveHost.innerHTML = curveSVG(m, { stage: 'none', bassSrc, narrow });
    if (last) apply(last, true);
  }
  function apply(state, instant) {
    last = state;
    const onCurve = state.scene === 'curve';
    mapHost.classList.toggle('on', !onCurve); curveHost.classList.toggle('on', onCurve);
    if (!onCurve) {
      const svg = mapHost.querySelector('svg');
      svg.dataset.hl = state.hl ?? '';
      svg.querySelector('.zonegrp').classList.toggle('on', !!state.zone);
      svg.querySelector('.zcard')?.classList.toggle('on', !!state.card);
      return;
    }
    const svg = curveHost.querySelector('svg');
    if (curStage === state.stage) return;
    curStage = state.stage;
    if (instant) { svg.dataset.stage = state.stage; return; }
    svg.getBoundingClientRect();   // the draw-on starts from 0
    requestAnimationFrame(() => { svg.dataset.stage = state.stage; });
  }
  return {
    mount(el) {
      root = el;
      el.innerHTML = '<div class="scene scene-map on"></div><div class="scene scene-curve"></div>';
      mapHost = el.querySelector('.scene-map'); curveHost = el.querySelector('.scene-curve');
      draw();
      ro = new ResizeObserver(() => { if (isNarrow() !== narrow) draw(); });
      ro.observe(el);
    },
    set(state, { instant }) { apply(state, instant); },
    snapshot(state) {
      const narrowSnap = matchMedia('(max-width: 760px)').matches;
      if (state.scene === 'curve') return curveSVG(m, { stage: state.stage, bassSrc, narrow: narrowSnap });
      return mapSVG(m, { hl: state.hl, zone: state.zone, card: state.card ? card : null, narrow: narrowSnap });
    },
    dispose() { ro?.disconnect(); root = null; },
  };
}

export async function render(host) {
  const [S, ext, ref, bass2, gaps] = await Promise.all(['sandbox.json', 'external_tests.json', 'reference.json', 'bass2_tests.json', 'gaps.json'].map(loadJSON));
  const m = atmosModel({ S, ext, ref, bass2 });
  const bass = S.tests.filter((t) => t.id.startsWith('BASS-II'));
  const o2s = bass.map((t) => t.o2);
  const zone = inMoonZone(ext);
  const z = ref.panel1.moon_base_zone;
  const moon = gaps.habitats.find((h) => h.habitat.id === 'moon_base');
  const inZ = S.tests.filter((t) => t.o2 >= z.o2_min_pct && t.p_kpa <= z.p_max_kpa);
  const flows = [...new Set(inZ.flatMap((t) => t.flows))];
  const mats = [...new Set(inZ.map((t) => t.material))];
  // Card lines: one per gap in gaps.json (ids decide which lines exist; values are counted here).
  const short = { flow: `one airflow only (${flows.join(', ')} cm/s)`, materials: `${mats.length} materials only`, boundary: 'no flammability boundary', gravity: 'no partial-gravity test' };
  const card = { title: `Inside: ${inZ.length} solid tests. Missing:`, lines: moon.gaps.map((g) => short[g.id] ?? g.id) };
  const ssceLv = m.bars.map((b) => b.o2);
  const ssceP = [Math.min(...m.bars.flatMap((b) => b.p)), Math.max(...m.bars.flatMap((b) => b.p))];
  const atm = (kpa) => Math.round((kpa / 101.325) * 10) / 10;
  const sea = ref.panel1.earth_sea_level; const suit = ref.panel1.spacesuit;
  const pp = ref.panel1.pp_o2_lines[0];
  const ppZone = Math.round(z.o2_min_pct * z.p_max_kpa) / 100;
  const p2 = ref.panel2; const src2 = `${p2.source.doc}, sec. ${p2.source.section}, eq. ${p2.source.equation_no}, p.${p2.source.printed_page}`;
  const nSt = bass2.panel2_points.filter((q) => q.kind === 'stable_observed').length;
  const nBo = bass2.panel2_points.filter((q) => q.kind === 'blowoff_upper_bound').length;
  const bassReport = 'BASS-II Summary Report, NASA/TM-20210011385 (Oct 2021): "pressure P = 1 atm" (printed p.11), "Ambient pressure was 1 atm" (p.94); not measured per test';
  const steps = [
    { id: 'map', title: 'Every test, by its air', state: { scene: 'map', hl: '' },
      html: `Every solid-material test we could place: oxygen before ignition (up) against total pressure (across). <b>${S.tests.length}</b> tests, one dot each.`,
      chips: [['Dots: sandbox.json tests (the solids on Evidence Map Panel 1): BASS-II rows of data/raw/PSI-25/PSI-25_Experimental table_BASS-II.csv and Saffire rows of ICES-2024-365 Table 1 (p.3). Hover a dot for its own row.', 'one row each']] },
    { id: 'bass', title: 'BASS-II at 1 atm', state: { scene: 'map', hl: 'bass' },
      html: `BASS-II on the ISS: all <b>${bass.length}</b> tests at 1 atm, the pressure of Earth's air, from ${Math.min(...o2s)}% to ${Math.max(...o2s)}% O2.`,
      chips: [[bassReport, 'BASS-II report · p.11'], [`${sea.label} (${sea.source})`, 'challenge page']] },
    { id: 'ssce', title: 'SSCE as ranges', state: { scene: 'map', hl: 'ssce' },
      html: `SSCE: ${ssceLv.join(', ')}% O2 at ${atm(ssceP[0])}–${atm(ssceP[1])} atm. NASA does not say which O2 went with which pressure, so these are ranges.`,
      chips: [[m.bars[0].rows.map((x) => `${x.material}: "${x.source.quote}"`).join(' | ') + ` (${m.bars[0].rows[0].source.doc})`, 'NTRS 20050177200']] },
    { id: 'zone', title: 'The Moon-base box', state: { scene: 'map', hl: 'zone', zone: true, card: true },
      html: `Moon bases and rovers: ≥${z.o2_min_pct}% O2 at ≤${z.p_max_kpa} kPa. Inside, only ${esc(zone.map((t) => `${t.program} ${t.sample}`).join(' and '))}. Hover the box for what is missing.`,
      chips: [[`${z.label} (${z.source})`, 'challenge page'], [moon.gaps.map((g) => g.text).join(' | '), 'gaps.json rules']] },
    { id: 'breath', title: 'Same oxygen per breath', state: { scene: 'map', hl: 'ppo2', zone: true },
      html: `Same oxygen per breath: along the dotted line, pO2 equals sea-level air's ${pp.label.match(/[\d.]+ kPa/)[0]}. ${z.o2_min_pct}% at ${z.p_max_kpa} kPa gives ${ppZone} kPa.`,
      chips: [['pO2 = O2 fraction × total pressure (ideal gas); line built by scripts/04_build_reference.py', 'pO2 = O2% × P']] },
    { id: 'suit', title: 'Spacesuit air', state: { scene: 'map', hl: 'suit', zone: true },
      html: `Spacesuits: ${suit.o2_pct}% O2 at ${suit.p_kpa} kPa. No solid test in our sources burned in that air.`,
      chips: [[`${suit.label} (${suit.source})`, 'challenge page']] },
    { id: 'curve', title: 'One measured boundary', state: { scene: 'curve', stage: 'curve' },
      html: 'Our sources hold one measured flammability boundary: NASA\'s fit for PMMA rods in BASS-II. Above the line flames burn; below, they go out.',
      chips: [[`${p2.equation}. ${src2}. The report uses the blowoff line's O2 at a = 0 as "an accurate but conservative estimate of the minimum O2 concentration for material flammability in space" (p.75).`, 'BASS-II eq. 6.1 · p.75']] },
    { id: 'branches', title: 'Quenching and blowoff', state: { scene: 'curve', stage: 'branches' },
      html: `Too little flow quenches the flame; too much blows it off. Lowest point: <b>${p2.minimum.x_o2}%</b> O2 at a = ${p2.minimum.a} 1/s.`,
      chips: [['"The O2 concentration (XO2) versus a boundary is defined by the combined empirical equations shown by the red (quenching branch, exponential expression) and black (blowoff branch, linear expression) dashed lines." BASS-II report p.75', 'report p.75'], [`Computed from eq. 6.1. ${p2.minimum.note}`, 'minimum']] },
    { id: 'points', title: 'Rebuilt flight tests', state: { scene: 'curve', stage: 'points' },
      html: `Only <b>${nSt + nBo}</b> flight tests can be rebuilt from public PSI files: ${nSt} last stable flows (●) and ${nBo} blowoffs, true value at or left of the marker (◂).`,
      chips: [[`${p2.nasa_figure.why_not_reproducible.join(' ')} ${p2.nasa_figure.iss_points_note}`, `of ~${p2.nasa_figure.iss_points_approx} NASA points`]] },
    { id: 'atm', title: 'Only at 1 atm', state: { scene: 'curve', stage: 'atm' },
      html: 'Every BASS-II test ran at 1 atm. Our sources hold no flammability boundary at Moon-base pressure.',
      chips: [[bassReport, 'BASS-II report · p.11'], [moon.gaps.find((g) => g.id === 'boundary')?.text ?? '', 'boundary gap']] },
  ];
  return mountStory(host, {
    section: 'evidence', title: 'Evidence', viewHash: 'evidence/view', viewLabel: 'the Evidence Map',
    intro: `<p class="eyebrow">Evidence</p><h1 class="story-h1">Where the fire tests are, and where they stop</h1>
      <p class="story-sub">Two NASA views of the same evidence: the air each test burned in, and the one measured flammability boundary.</p>`,
    steps, visual: createVisual(m, card),
  });
}
