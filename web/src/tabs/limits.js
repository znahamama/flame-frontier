import { loadJSON } from '../data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const list = (items) => `<ul class="limits">${items.filter(Boolean).map((x) => `<li>${x}</li>`).join('')}</ul>`;

const rng = (r, u) => (r ? `${r[0]}${r[0] === r[1] ? '' : `–${r[1]}`}${u}` : 'not recorded');
// Per-test tables with ambient O2 that Panel 1 does not draw (ranges from ranking.json, not typed here).
function notPlotted(moon) {
  const rows = moon.rows.filter((r) => ['PSI-10', 'PSI-39'].includes(r.psi_id));
  return `Not drawn on Panel 1 although their O2 is ambient: ${rows.map((r) => `${esc(r.psi_id)} ${esc(r.title)} (${rng(r.o2_range_pct, '% O2')}, ${rng(r.p_range_kpa, ' kPa')}; ${r.joint_tests} tests in the Moon-base window)`).join('; ')}. Both are scored in the Ranking tab.`;
}

// Known Limits: what the site and each source cannot tell you. Numbers come from the pipeline JSON, not typed here.
export async function render(root) {
  const [ext, flex, bass2, ref, cat, rank, cfig, sweep] = await Promise.all(
    ['external_tests.json', 'flex_tests.json', 'bass2_tests.json', 'reference.json', 'catalog.json', 'ranking.json', 'cfig_tests.json', 'o2_sweep.json'].map(loadJSON));
  const sbx = await loadJSON('sandbox.json');
  const cz = cfig.moon_zone;
  const VERDICT = { ambient: 'Atmosphere around the flame', oxidizer_stream: 'Burner oxidizer stream (NOT the atmosphere)', not_o2: 'Not oxygen (fuel concentration)' };
  const zone = ext.tests.filter((t) => t.in_moon_zone);
  const rv = bass2.review_summary;
  const fig = ref.panel2.nasa_figure;
  const cov = cat.coverage;
  const lvl = (l) => cov.slots.filter((x) => x.test_level === l).length;
  const moon = rank.habitats.find((h) => h.habitat.id === 'moon_base');
  const skipped = flex.skipped.map((s) => `test ${esc(s.test)} (line ${s.line}: ${esc(s.issue)})`).join('; ');

  root.innerHTML = `
  <section class="card"><h2>Known Limits</h2>
    <p class="note">What this site and its sources cannot tell you, so nothing on a chart implies more than the sources say.</p>

    <h3>The headline</h3>
    ${list([
      `It counts <b>solid-material</b> tests only, and only those <b>in our sources</b> (PSI downloads plus ${Object.keys(ext.sources).length} cited papers and pages). We do not claim to have seen every test ever run.`,
      `The ${zone.length} tests inside the Moon-base zone (${zone.map((t) => `${esc(t.id.replace(/^saffire-/, 'Saffire '))}, ${esc(t.material)}`).join('; ')}) ran at ${[...new Set(zone.map((t) => t.flow_cm_s))].map((f) => `${f} cm/s`).join(' and ')} airflow, in microgravity. None ran in partial gravity: "${esc('there is currently no partial-gravity combustion data available in PSI')}" (challenge page).`,
      'Two tests are not a flammability boundary. They show that these materials burned under those conditions, not where they stop burning.',
    ])}

    <h3>Evidence Map, Panel 1 (initial O2 vs pressure)</h3>
    ${list([
      `BASS-II: all ${bass2.count} PSI-25 rows are plotted at 1 atm (${bass2.constants.pressure_kpa} kPa) because the report states 1 atm; pressure is not logged per test. O2 is the calibrated INITIAL value.`,
      `FLEX (PSI-69) is liquid droplets, not solid materials, so it is drawn as its own layer and never counted in the headline. ${flex.count} tests plotted; ${flex.moon_zone.count} inside the Moon-base zone; ${flex.moon_zone.near_misses.length} near misses at ≥30% O2 just above 70.3 kPa (closest ${Math.min(...flex.moon_zone.near_misses.map((t) => t.pressure_kpa))} kPa). Skipped: ${skipped || 'none'}.`,
      'SSCE: NASA gives O2 and pressure lists for flights 1-8 without saying which went together, so they are drawn as range markers, not per-flight points. All are at ≥1 atm.',
      `ACME CFI-G's "up to 85% oxygen" (challenge page) is the oxidizer flowing out of the burner in INVERSE flames (${cfig.evidence.inverse.tests} rows, max XO2 ${cfig.evidence.inverse.xo2_max_pct}%), while the chamber held fuel and N2. It is not an atmosphere, so it is kept off the charts. The same applies to PSI-10's inverse-flame XO2.`,
      `ACME CFI-G NORMAL flames are different: fuel flows out of the burner into an O2/N2 chamber, and "XO2 before test" is that chamber atmosphere. Evidence: it is logged before and after every test, and on ${cfig.evidence.chain.chained} of ${cfig.evidence.chain.pairs} same-day consecutive pairs one test's "after" equals the next test's "before" (the chamber O2 being used up run by run). ${cz.count} of ${cfig.count} normal-flame tests sit inside the Moon-base zone (${cz.o2_range_pct.join('–')}% O2 at ${cz.pressure_kpa.join(', ')} kPa, test days ${cz.days.join(', ')}; ${cz.hot_ignition.Yes ?? 0} with hot ignition, ${cz.hot_ignition.No ?? 0} without). They are drawn on Panel 1 as a hollow-square layer, are gas flames (not solids), and never enter the headline.`,
      moon?.joint_investigations.length ? `Ranking agrees: same-test O2+pressure overlap with the Moon-base window comes only from ${moon.joint_investigations.map((j) => `${esc(j.psi_id)} (${j.n} tests, ${esc(j.material)})`).join(', ')}.` : '',
      notPlotted(moon),
      'O2 is plotted as mol % (= vol % for an ideal gas). Saffire VI\'s O2 is given in mol %.',
    ])}

    <h3>Evidence Map, Panel 2 (BASS-II flammability boundary)</h3>
    ${list([
      `Only ${bass2.panel2_points.length} PSI-25 tests can be placed on NASA's boundary; NASA's Figure 6.10 shows about ${fig.iss_points_approx} ISS points (${esc(fig.iss_points_note)}). Why: ${fig.why_not_reproducible.map(esc).join(' ')}`,
      '"Last stable flow before extinction" markers are the last flow recorded in cm/s at which the flame was still burning; the crew then turned the flow down (pot settings below the fan calibration) until it went out, so the extinction flow itself is not plotted. Blowoff markers come from same-day fan calibration at the exact pot setting; the air probe needs about 1 minute to respond, so the true blowoff flow is at or below the marker.',
      `The curve is solid only over the stretch rates the PSI table actually recorded (${ref.panel2.tested_a_range.map((x) => x.toFixed(2)).join('–')} 1/s) and dashed outside it.`,
      `Post-burn O2 readings flagged as sensor errors are kept in the data but never plotted: ${rv.o2_final_flagged.map(esc).join(', ')}.`,
      `Review: ${rv.accepted.length} flagged rows accepted, ${rv.excluded.length} excluded from all charts (${rv.excluded.map(esc).join(', ')}), ${rv.open} open (${esc(rv.file)}).`,
      'Panel 2 y-axis is POST-BURN O2, as in NASA\'s Figure 6.9; Panel 1 uses initial O2.',
    ])}

    <h3>Catalog</h3>
    ${list([
      `The list of ${cov.combustion_total} investigations is the PSI Combustion Science listing transcribed by hand (${esc(cov.index_source.file)}); its count matches the challenge video. ${cov.index_rows_not_combustion.map((r) => `${esc(r.psi_id)} (${esc(r.research_area)})`).join(' and ')} were in the same listing but are filed under other research areas, so they are left out.`,
      `"Test-level data" means a per-test table in our PSI download: ${lvl('yes')} yes, ${lvl('summary only')} summary only, ${lvl('no')} none. PSI raw data (video, sensor logs) runs to terabytes and is not all downloaded.`,
      'BASS (PSI-26) has a per-test table but no O2, pressure or flow columns, so it cannot be placed on the Evidence Map.',
      'Metadata quirks are shown as-is, not fixed: Saffire-I and III list the ISS as flight platform though they flew in Cygnus; Saffire I-III share one Hypothesis text; BASS-II assigns no PI role; PSI folder names carry a second number whose meaning we do not know, so it is never used as an ID.',
    ])}

    <h3>Ranking</h3>
    ${list([
      `Weights (${['o2', 'pressure', 'flow', 'gravity', 'material', 'data'].map((k) => rank.rules[k]).map((r) => `${esc(r.label)} ${r.weight}`).join(', ')}) are our design choice, not a NASA rating. Change them and the order changes; the per-component points are shown so you can recompute.`,
      'Unknown scores 0. A low score means "the data does not show it", not "it is safe" or "it is dangerous".',
      'Values from summary tables get half credit, because a summary row may list O2 and pressure separately without saying which ran together.',
      'The ISS window comes from two NASA reports (NTRS 20160001047 p.3 and 20150010425 p.1). The rover uses the Moon-base window because the brief gives one atmosphere for both. The spacesuit is scored as used on lunar excursions (partial gravity).',
      'Material class and flow regime are our classification, each tied to a quoted word in the metadata, table or brief (data/manual/investigation_features.csv).',
    ])}

    <h3>Clips</h3>
    ${list([
      'Three of 129 BASS-II tests, trimmed and re-encoded (macOS avconvert) to stay small. Nothing is measured from the video by software; the facts beside each clip come from the PSI table.',
      'The on-screen date is one day ahead of the test date (BASS-II FAQ: leap year was not set on board).',
    ])}

    <h3>Flame Sandbox</h3>
    ${list([
      'The flame picture is a teaching model, not a simulation. It follows NASA\'s qualitative description (official challenge video 2:37–3:12; challenge page) and computes nothing: no temperature, size, spread rate or extinction. O2 changes only its brightness; pressure changes nothing in it.',
      'Moon and Mars gravity: no flame is drawn, only the Earth and microgravity outlines, because PSI has no partial-gravity combustion data (challenge page). The sandbox never interpolates between them.',
      `Its evidence panel counts the same ${sbx.tests.length} solid tests as the Habitat Gaps tab. "Nearby" (±${sbx.rules.near_o2_pts} points O2, ±${sbx.rules.near_p_kpa} kPa), flow match (±${sbx.rules.flow_tol_cm_s} cm/s) and "thin" (≤${sbx.rules.thin_max}) are our display tolerances, not NASA criteria.`,
      `The boundary verdict uses BASS-II eq. 6.1 for a ${sbx.boundary.r0_cm} cm radius PMMA rod only, in microgravity, at ${sbx.boundary.p_window_kpa.join('–')} kPa and flows ${sbx.boundary.u_range_cm_s.join('–')} cm/s (the recorded stretch rates). Outside that it says "Unknown: no data". The fit is in post-burn O2 while the slider is the cabin O2.`,
    ])}
  </section>

  <section class="card"><h2>Whose oxygen? Every O2 column in our PSI tables</h2>
    <p class="note">${esc(sweep.question)} An O2 value only belongs on the Evidence Map if it is the atmosphere around the flame. Each quote below is checked against its file by the pipeline (${esc(sweep.source)}).</p>
    <div class="scroll"><table><thead><tr><th>PSI</th><th>Table, column</th><th>Verdict</th><th>Evidence (exact quote)</th><th>Reading</th></tr></thead><tbody>
    ${sweep.rows.map((r) => `<tr><td>${esc(r.psi_id)}</td><td>${esc(r.table)}: "${esc(r.column)}"</td><td>${esc(VERDICT[r.verdict] ?? r.verdict)}</td>
      <td>"${esc(r.evidence_quote)}"<br><span class="src">${esc(r.evidence_file)}</span></td><td>${esc(r.reading)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="note">Investigations with no O2 column in our download are not listed. Saffire IV-VI and SSCE values come from the cited papers (see Sources below).</p>
  </section>

  <section class="card"><h2>Sources: what each gives and does not give</h2>
    ${Object.values(ext.sources).map((s) => `<h3>${esc(s.short)}</h3><p class="note">${esc(s.citation)}</p>
      <p><b>Gives:</b> ${esc(s.gives)}</p>${list(s.does_not_give.map(esc))}`).join('')}
  </section>`;
}
