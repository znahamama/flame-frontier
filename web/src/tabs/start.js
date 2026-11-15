import { loadJSON } from '../data.js';
import { headline, inMoonZone } from '../headline.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Start screen: every number is computed from data/processed (the same files the tabs use). No typed numbers.
export async function render(root) {
  const [ext, bass2, flex, cfig, cat, gaps, qa] = await Promise.all(
    ['external_tests.json', 'bass2_tests.json', 'flex_tests.json', 'cfig_tests.json', 'catalog.json', 'gaps.json', 'qa_cache.json'].map(loadJSON));
  const zone = inMoonZone(ext);
  const saffire = ext.tests.filter((t) => t.kind === 'point').length;
  const ranges = ext.tests.filter((t) => t.kind !== 'point').length;
  const mapped = bass2.count + saffire + flex.count + cfig.count;
  const perTest = cat.investigations.filter((i) => i.test_level === 'yes').length;
  const moon = gaps.habitats.find((h) => h.habitat.id === 'moon_base');
  const gq = moon.target_sources.gravity.quote;
  const tiles = [
    [cat.investigations.length, 'NASA PSI combustion investigations', `${perTest} with per-test data tables`, '#catalog'],
    [mapped, 'tests placed by O2 and pressure',
      `${bass2.count} BASS-II + ${saffire} Saffire solids, ${flex.count} FLEX droplets, ${cfig.count} CFI-G gas flames${ranges ? `; ${ranges} SSCE ranges` : ''}`, '#evidence'],
    [zone.length, 'solid-material tests in Moon-base air', `${zone.map((t) => t.sample).join(', ')}, at ${[...new Set(zone.map((t) => t.flow_cm_s))].join(', ')} cm/s; plus ${cfig.moon_zone.count} gas-flame and ${flex.moon_zone.count} droplet tests`, '#evidence/gap=moon_base.flow'],
    // 0 comes from the gap rule in gaps.json (every point is microgravity), stated by the challenge page.
    ...(moon.gaps.some((g) => g.id === 'gravity') ? [[0, 'combustion tests in partial gravity', `Challenge page: "${gq}"`, '#evidence/gap=moon_base.gravity']] : []),
  ];
  const sample = qa.answers.slice(0, 2);
  root.innerHTML = `<section class="card hero">
      <p class="eyebrow">NASA Space Apps 2026 · Flame in Freefall</p>
      <h2 class="herohead">${headline(zone)}</h2>
      <p class="note">Moon-base air, from the challenge page: ${esc(moon.window)} (${esc(moon.target_sources.p.as_stated)}), with more oxygen than Earth's air at lower pressure.
        Flame Frontier maps every NASA microgravity fire test we could place against it, and shows where the evidence ends.</p>
      <ul class="tiles">${tiles.map(([n, label, cap, href]) => `<li><a class="tile" href="${href}">
        <span class="tilenum">${n.toLocaleString('en-US')}</span><span class="tilelabel">${esc(label)}</span><span class="tilecap">${esc(cap)}</span></a></li>`).join('')}</ul>
    </section>
    <ol class="entries">
      <li class="card entry"><span class="entrynum" aria-hidden="true">1</span><div>
        <h3><a href="#evidence">Evidence</a></h3>
        <p>Every test on one map of oxygen against pressure, with the Moon-base zone drawn in, and NASA's only published flammability boundary for these solids (BASS-II, at 1 atm).</p>
        <p class="more"><a href="#evidence">Open the Evidence Map →</a> · <a href="#sandbox/earth">Flame Sandbox</a> · <a href="#gaps">Habitat gaps</a> · <a href="#clips">Flight video</a></p></div></li>
      <li class="card entry"><span class="entrynum" aria-hidden="true">2</span><div>
        <h3><a href="#catalog">Investigations</a></h3>
        <p>All ${cat.investigations.length} combustion investigations in NASA's PSI repository: what each tested, ranked against a habitat with a visible rule table, and compared side by side.</p>
        <p class="more"><a href="#catalog">Catalog →</a> · <a href="#ranking">Ranking</a> · <a href="#compare">Compare</a> · <a href="#earth">On Earth</a></p></div></li>
      <li class="card entry"><span class="entrynum" aria-hidden="true">3</span><div>
        <h3><a href="#ask">Ask</a></h3>
        <p>Ask in plain English. Answers quote NASA text and cite every sentence; if the sources don't say, the answer is "Not in the data."</p>
        <p class="more">${sample.map((a) => `<a href="#ask/${encodeURIComponent(a.question)}">${esc(a.question)}</a>`).join('<br>')}</p></div></li>
    </ol>
    <p class="note footnote">Every number on this site is computed from NASA files or cited papers and carries its source; see <a href="#limits">Known Limits</a> for what the data cannot tell you, and <a href="#references">References</a>. <a href="/data/export/tests.csv" download>Download all ${mapped.toLocaleString('en-US')} placed tests (CSV, with sources)</a>.</p>`;
}
