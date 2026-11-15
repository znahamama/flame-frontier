// Explore story: the 24 investigations as tiles -> which hold per-test data and which inform fire safety ->
// ranking by rule (stacked components) -> tested ranges vs Moon-base air -> habitat coverage -> FLEX suppressant tests.
// Every number is computed here from data/processed; sentences are templates.
import { loadJSON } from '../data.js';
import { mountStory } from '../story.js';
import { loadGlossary, g } from '../plain.js';
import { loadNames, nm } from '../names.js';
import { tilesHTML, rankBarsHTML, rangeBarsSVG, coverageHTML, suppSVG, rolesByPsi, mergedHabitats } from '../viz/explore.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function createVisual(parts) {
  let root; let ro; let narrow = null; let last = null;
  const scenes = ['tiles', 'rank', 'ranges', 'cover', 'supp'];
  const html = (k, hl, nar) => {
    if (k === 'tiles') return `<div class="stagecard tilescene" data-hl="${esc(hl ?? '')}">${parts.tiles}</div>`;
    if (k === 'rank') return `<div class="stagecard" data-hl="${esc(hl ?? '')}">${parts.rank}</div>`;
    if (k === 'ranges') return `<div class="stagecard"><p class="stagetitle">Tested O2 and pressure vs ${esc(parts.win.name)} air (shaded)</p>${rangeBarsSVG(parts.rangeRows, parts.win, nar ? { narrow: true } : { stacked: true, rowH: 44 })}</div>`;
    if (k === 'cover') return `<div class="stagecard">${parts.cover}</div>`;
    return `<div class="stagecard"><p class="stagetitle">FLEX tests with CO2 or helium, by O2 and pressure</p>${suppSVG(parts.flex, parts.win, { narrow: nar })}</div>`;
  };
  const draw = () => {
    narrow = root.clientWidth < 560;
    root.innerHTML = scenes.map((k) => `<div class="scene scene-x" data-k="${k}">${html(k, '', narrow)}</div>`).join('');
    if (last) apply(last);
  };
  const apply = (state) => {
    last = state;
    root.querySelectorAll('.scene-x').forEach((el) => el.classList.toggle('on', el.dataset.k === state.scene));
    const card = root.querySelector(`.scene-x[data-k="${state.scene}"] .stagecard`);
    if (card) card.dataset.hl = state.hl ?? '';
    if (state.mark) root.querySelectorAll(`.scene-x[data-k="${state.scene}"] [data-psi]`).forEach((el) => el.classList.toggle('mark', state.mark.includes(el.dataset.psi)));
    else root.querySelectorAll('.mark').forEach((el) => el.classList.remove('mark'));
  };
  return {
    mount(el) { root = el; draw(); ro = new ResizeObserver(() => { if ((root.clientWidth < 560) !== narrow) draw(); }); ro.observe(el); },
    set(state) { apply(state); },
    snapshot(state) {
      const div = document.createElement('div');
      div.innerHTML = html(state.scene, state.hl, matchMedia('(max-width: 760px)').matches);
      if (state.mark) div.querySelectorAll('[data-psi]').forEach((x) => x.classList.toggle('mark', state.mark.includes(x.dataset.psi)));
      return `<div class="snapx">${div.innerHTML}</div>`;
    },
    dispose() { ro?.disconnect(); },
  };
}

export async function render(host) {
  const [cat, controls, rank, gaps, flex, compare] = await Promise.all([...['catalog.json', 'controls.json', 'ranking.json', 'gaps.json', 'flex_tests.json', 'compare.json'].map(loadJSON), loadGlossary(), loadNames()]);
  const inv = cat.investigations;
  const perTest = inv.filter((c) => c.test_level === 'yes');
  const roles = rolesByPsi(controls);
  const H = rank.habitats.find((h) => h.habitat.id === 'moon_base');
  const top = H.rows[0];
  const bestSolid = H.rows.find((r) => r.material_class === 'solid');
  const MAT = { solid: 'solid materials', liquid: 'liquid droplets', gas: 'gas flames', gas_emulating_solid: 'gas flames emulating solids' };
  const win = { name: H.habitat.name, text: `≥${H.habitat.o2_pct[0]}% O2 at ≤${H.habitat.p_kpa[1]} kPa`, o2: H.habitat.o2_pct, p: H.habitat.p_kpa };
  const rowOf = Object.fromEntries(H.rows.map((r) => [r.psi_id, r]));
  const rangeRows = compare.default.map((id) => rowOf[id]).filter(Boolean);
  // A row whose O2 and pressure ranges both touch the window but has no test inside it (the point of the step).
  const touch = rangeRows.find((r) => r.o2_range_pct && r.p_range_kpa && r.o2_range_pct[1] >= win.o2[0] && r.p_range_kpa[0] <= win.p[1] && !r.joint_tests);
  const merged = mergedHabitats(gaps);
  const clean = merged.filter((m) => !m.h.gaps.length).map((m) => m.name);
  const gappy = merged.filter((m) => m.h.gaps.length).map((m) => `${m.name} (${m.h.gaps.length})`);
  const supp = flex.tests.filter((x) => (x.co2_frac ?? 0) > 0 || (x.he_frac ?? 0) > 0);
  const inZone = supp.filter((x) => x.o2_pct >= win.o2[0] && x.pressure_kpa <= win.p[1]).length;
  const hi = [...supp].sort((a, b) => b.o2_pct - a.o2_pct || a.pressure_kpa - b.pressure_kpa)[0];
  const parts = {
    tiles: tilesHTML(cat, controls, {}),
    rank: rankBarsHTML(H, rank, { top: 6 }),
    cover: coverageHTML(gaps),
    flex, win, rangeRows,
  };
  const steps = [
    { id: 'tiles', title: 'The investigations', state: { scene: 'tiles' },
      html: `${g('psi', "NASA's public archive, PSI,")} lists <b>${inv.length}</b> fire (combustion) investigations. Each tile is one; open it for NASA's full record.`,
      chips: [[`${cat.coverage.index_source.file}; count matches the challenge video (${cat.coverage.combustion_total_source.locator}: "${cat.coverage.combustion_total_source.quote}")`, 'PSI index']] },
    { id: 'data', title: 'Per-test tables', state: { scene: 'tiles', hl: 'tests' },
      html: `Only <b>${perTest.length}</b> left a table with one row per test. Those rows are what let us place a test by its oxygen and air pressure.`,
      chips: [['catalog.json: test_level per investigation, from the experimental tables in data/raw (data/manual/psi_tables.csv)', 'our check of data/raw']] },
    { id: 'roles', title: 'Fire-safety roles', state: { scene: 'tiles', hl: 'roles' },
      html: `<b>${Object.keys(roles).length}</b> are linked to preventing, detecting or putting out (suppressing) fires, each by a quote from the challenge page or NASA's record.`,
      chips: [['controls.json (scripts/06_build_controls.py): every link needs an exact quote from the challenge page sec. 1 or a named PSI metadata field (data/manual/safety_roles.csv)', 'quoted links']] },
    { id: 'rank', title: 'Ranked for Moon-base air', state: { scene: 'rank' },
      html: `Each is scored against ${g('moonair', `${esc(H.habitat.name)} air`)} with six fixed rules, no AI. Each bar shows where its points, out of ${rank.max_score}, come from.`,
      chips: [[Object.values(rank.rules).map((r) => `${r.label} (${r.weight}): ${r.rule}`).join(' | '), 'rule table']] },
    { id: 'top', title: 'First vs best solid', state: { scene: 'rank', hl: 'mark', mark: [top.psi_id, bestSolid?.psi_id].filter(Boolean) },
      html: top.material_class === 'solid' ? `${esc(nm(top.psi_id))} ranks first, with ${esc(MAT.solid)}.`
        : `${esc(nm(top.psi_id))} ranks first on oxygen and pressure, but it burned ${esc(MAT[top.material_class] ?? top.material_class)}, not solids. The best study of ${g('solids', 'solid materials')} is ${esc(nm(bestSolid.psi_id))} (#${bestSolid.rank}).`,
      chips: [[`${nm(top.psi_id)} (${top.psi_id}): ${top.parts.map((p) => `${p.label} ${p.points}/${p.weight}`).join(', ')}`, `${nm(top.psi_id)} points`]] },
    { id: 'ranges', title: 'Tested ranges', state: { scene: 'ranges' },
      html: touch ? `A study can reach the box's oxygen and its pressure with no single test doing both: ${esc(nm(touch.psi_id))} reached ${touch.o2_range_pct[1]}% oxygen and ${touch.p_range_kpa[0]} kPa, but no single test had both Moon-base oxygen and Moon-base pressure.`
        : `Tested ranges of ${esc(rangeRows.map((r) => nm(r.psi_id)).join(', '))} against ${esc(win.name)} air.`,
      chips: touch ? [[`ranking.json: ${nm(touch.psi_id)} (${touch.psi_id}) O2 ${touch.o2_range_pct.join('–')}%, pressure ${touch.p_range_kpa.join('–')} kPa, ${touch.joint_tests} tests with both inside the window (per-test table)`, `${nm(touch.psi_id)} ranges`]] : [] },
    { id: 'cover', title: 'Habitat coverage', state: { scene: 'cover' },
      html: `Crew home by crew home: ${esc(clean.join(', ') || 'none')} ${clean.length === 1 ? 'passes' : 'pass'} every gap check. Gaps remain for ${esc(gappy.join(', '))}.`,
      chips: [['gaps.json (scripts/05_build_gaps.py): no solid in window; <= 2 flows; <= 2 materials; boundary pressure outside window; partial gravity', 'gap rules']] },
    { id: 'supp', title: 'Suppressant tests', state: { scene: 'supp' },
      html: `Putting fires out: <b>${supp.length}</b> FLEX tests burned fuel droplets in an atmosphere that also held carbon dioxide (CO2) or helium. ${inZone} ran in ${esc(win.name)} air; the closest had ${hi.o2_pct}% oxygen at ${hi.pressure_kpa} kPa.`,
      chips: [[`${hi.source.file}, line ${hi.source.line} (FLEX test ${hi.id})`, `FLEX test ${hi.id}`]] },
    { id: 'next', title: 'Open a view', state: { scene: 'cover' },
      html: 'Open any view below: the full catalog, the rule table, side-by-side comparison, every gap, and the fire-safety roles.',
      extra: '<p class="step-links"><a href="#catalog">Catalog</a><a href="#ranking">Ranking</a><a href="#compare">Compare</a><a href="#gaps">Habitat Gaps</a><a href="#controls">Prevent · Detect · Suppress</a></p>' },
  ];
  return mountStory(host, {
    section: 'explore', title: 'Explore', viewHash: 'catalog', viewLabel: 'the Catalog',
    intro: `<p class="eyebrow">Explore</p><h1 class="story-h1">${inv.length} NASA investigations, ranked against the air crews will breathe</h1>
      <p class="story-sub">Which tests exist, which can be placed, and what they leave open.</p>`,
    steps, visual: createVisual(parts),
  });
}
