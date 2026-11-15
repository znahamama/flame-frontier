import { loadJSON } from '../data.js';
import { inMoonZone } from '../headline.js';
import { exportLinks } from '../export.js';
import { chip } from '../chips.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Overview (the end of the Start story): stat tiles and the ways into each section.
// Every number is computed from data/processed (the same files the other views use). No typed numbers.
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
    [cat.investigations.length, 'NASA PSI combustion investigations', `${perTest} with per-test data tables`, '#catalog', 'data/processed/catalog.json (from the PSI Combustion Science listing, data/manual/psi_combustion_index.csv)'],
    [mapped, 'tests placed by O2 and pressure',
      `${bass2.count} BASS-II + ${saffire} Saffire solids, ${flex.count} FLEX droplets, ${cfig.count} CFI-G gas flames${ranges ? `; ${ranges} SSCE ranges` : ''}`, '#evidence/view', 'data/processed/export/tests.csv (one row per placed test, each with its source)'],
    [zone.length, 'solid-material tests in Moon-base air', `${zone.map((t) => t.sample).join(', ')}, at ${[...new Set(zone.map((t) => t.flow_cm_s))].join(', ')} cm/s; plus ${cfig.moon_zone.count} gas-flame and ${flex.moon_zone.count} droplet tests`, '#evidence/gap=moon_base.flow', zone.map((t) => `${t.program} ${t.sample}: ${t.source.doc}, ${t.source.locator}, p.${t.source.printed_page}`).join(' | ')],
    // 0 comes from the gap rule in gaps.json (every point is microgravity), stated by the challenge page.
    ...(moon.gaps.some((g) => g.id === 'gravity') ? [[0, 'combustion tests in partial gravity', `"${gq}"`, '#evidence/gap=moon_base.gravity', `Space Apps 2026 challenge page: "${gq}"`]] : []),
  ];
  const links = await exportLinks();
  const sample = qa.answers.slice(0, 2);
  root.innerHTML = `<section class="card overview">
      <h2 class="vtitle">Overview</h2>
      <ul class="tiles">${tiles.map(([n, label, cap, href, src]) => `<li class="tile">
        <a class="tilelink" href="${href}"><span class="tilenum">${n.toLocaleString('en-US')}</span><span class="tilelabel">${esc(label)}</span></a>
        <span class="tilecap">${esc(cap)}</span>${chip(src)}</li>`).join('')}</ul>
    </section>
    <ul class="entries">
      <li class="card entry"><span class="entryicon" aria-hidden="true">◎</span><div><h3><a href="#evidence">Evidence</a></h3>
        <p>Every test on one oxygen-pressure map, and NASA's flammability boundary for PMMA rods.</p>
        <p class="more"><a href="#evidence/view">Evidence Map</a> · <a href="#sandbox">Flame Sandbox</a> · <a href="#clips">Flight video</a></p></div></li>
      <li class="card entry"><span class="entryicon" aria-hidden="true">▦</span><div><h3><a href="#explore">Explore</a></h3>
        <p>All ${cat.investigations.length} investigations: ranked by rule, compared, and checked against each crew habitat.</p>
        <p class="more"><a href="#catalog">Catalog</a> · <a href="#ranking">Ranking</a> · <a href="#compare">Compare</a> · <a href="#gaps">Habitat Gaps</a> · <a href="#controls">Prevent · Detect · Suppress</a></p></div></li>
      <li class="card entry"><span class="entryicon" aria-hidden="true">?</span><div><h3><a href="#ask">Ask</a></h3>
        <p>Plain-English questions; every sentence of the answer cites a NASA passage.</p>
        <p class="more">${sample.map((a) => `<a href="#ask/${encodeURIComponent(a.question)}">${esc(a.question)}</a>`).join('<br>')}</p></div></li>
      <li class="card entry"><span class="entryicon" aria-hidden="true">ⓘ</span><div><h3><a href="#about">About</a></h3>
        <p>What the data cannot tell you, every source we used, and NASA fire safety on Earth.</p>
        <p class="more"><a href="#limits">Known Limits</a> · <a href="#references">References</a> · <a href="#earth">On Earth</a></p></div></li>
    </ul>
    <section class="card downloads" id="downloads"><h2 class="vtitle">Download the data</h2>
      <p class="note">CSV, every row with its source, for your own models.</p>
      <ul class="dllist">${links.map((l) => `<li>${l}</li>`).join('')}</ul></section>`;
}
