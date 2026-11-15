import * as echarts from 'echarts/core';
import { ScatterChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { headline } from '../headline.js';
import { loadJSON, cite } from '../data.js';
import { tokens } from '../theme.js';

echarts.use([ScatterChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, CanvasRenderer]);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const axis = (c, name, extra = {}) => ({
  name, nameLocation: 'middle', nameGap: 32, nameTextStyle: { color: c.text2 },
  axisLine: { lineStyle: { color: c.grid } }, axisLabel: { color: c.text2 },
  splitLine: { lineStyle: { color: c.grid, opacity: 0.5 } }, ...extra,
});

// Every data item carries {tip, src}. Line-level hovers (triggerLineEvent) fall back to series-level tips.
const tip = (c, seriesTips = {}) => ({
  trigger: 'item', confine: true, backgroundColor: c.surface, borderColor: c.grid,
  textStyle: { color: c.text }, extraCssText: 'max-width:360px;white-space:normal;',
  formatter: (p) => {
    const d = (p.data && p.data.tip) ? p.data : seriesTips[p.seriesIndex] ?? {};
    return `<b>${esc(p.seriesName)}</b><br>${d.tip ?? ''}<br><small>Source: ${esc(d.src ?? 'SOURCE MISSING')}</small>`;
  },
});

const srcLine = (s) => [s.short, s.locator, s.printed_page && `p.${s.printed_page}`].filter(Boolean).join(', ');

function saffireItem(t) {
  return {
    value: [t.pressure_kpa[0], t.o2_pct[0]],
    tip: `${esc(t.mission)}, sample ${esc(t.sample)}: ${esc(t.material)}<br>`
      + `O2 ${esc(t.o2_as_stated[0])} ${esc(t.o2_basis)} at ${esc(t.pressure_conversion[0])}<br>`
      + `pO2 ${t.po2_kpa} kPa. Flow ${t.flow_cm_s} cm/s ${esc(t.flow_direction).toLowerCase()}<br>`
      + `${t.in_moon_zone ? '<b>Inside the Moon-base zone</b>' : 'Outside the Moon-base zone'}`
      + `${t.notes ? `<br><i>${esc(t.notes)}</i>` : ''}`,
    src: `${srcLine(t.source)}. ${t.source.doc}`,
  };
}

const FLEX_NAME = 'FLEX droplets (liquid, PSI-69)';
const CFIG_NAME = 'Gas flames (ACME CFI-G, PSI-159)';
const LAYERS = [['flex', 'FLEX droplets (liquid, PSI-69)'], ['cfig', 'CFI-G gas flames (PSI-159)']];
const OUTCOME = { extinguished: 'extinguished', blowoff: 'blowoff', no_ignition: 'no ignition', not_sustained: 'would not stay lit', unclear: 'unclear (flagged for review)', not_stated: 'not stated in the table' };
const bassSrc = (t) => `${t.source.file}, line ${t.source.line}`
  + (t.source_xlsx ? `; ${t.source_xlsx.file}, tab "${t.source_xlsx.tab}", row ${t.source_xlsx.row}` : '');

function bass2Item(t) {
  const fin = t.o2_final_pct == null ? 'none' : `${t.o2_final_pct}%${t.o2_final_flag ? ` (${t.o2_final_flag.replace(/_/g, ' ')})` : ''}`;
  return {
    value: [t.pressure_kpa, t.o2_initial_pct],
    tip: `BASS-II ${esc(t.id)} (${esc(t.pi)}), ${esc(t.date_actual)}<br>${esc(t.geometry.label)}<br>`
      + `Initial O2 ${t.o2_initial_pct}% by vol; final ${esc(fin)}<br>`
      + `Pressure 1 atm = 101.325 kPa (stated in the report, not measured per test)<br>`
      + `Outcome: ${OUTCOME[t.outcome.value]}${t.outcome.evidence.length ? ` ("${esc(t.outcome.evidence[0].quote)}")` : ''}<br>`
      + `Air display: "${esc(t.air_display.raw)}"`,
    src: bassSrc(t),
  };
}

// SSCE gives O2 and pressure SETS per fuel, not per-flight pairs: one range bar per stated O2 level,
// spanning the stated pressures. Fuels sharing an O2 level share one bar (no fake offsets).
function ssceBars(tests) {
  const byO2 = new Map();
  for (const t of tests) for (const o2 of t.o2_pct) {
    if (!byO2.has(o2)) byO2.set(o2, []);
    byO2.get(o2).push(t);
  }
  return [...byO2.entries()].sort((a, b) => a[0] - b[0]).map(([o2, ts]) => {
    const ps = ts.flatMap((t) => t.pressure_kpa);
    const lines = ts.map((t) => `${esc(t.material)} (${esc(t.mission)}): O2 one of {${t.o2_pct.join(', ')}}% `
      + `at one of {${t.pressure_conversion.map(esc).join('; ')}}`);
    const d = {
      tip: `Range marker, not a test point. ${lines.join('<br>')}<br><i>Which O2 went with which pressure on which flight is not given. `
        + `Flow and O2 basis not stated.</i>`,
      src: ts.map((t) => `${srcLine(t.source)}: "${t.source.quote}"`).join(' / '),
    };
    return { o2, d, data: [Math.min(...ps), Math.max(...ps)].map((p) => ({ value: [p, o2], ...d })) };
  });
}

function panel1(el, ref, ext, bass2, flex, cfig, c, hl, layers, pick) {
  const p = ref.panel1;
  const zone = p.moon_base_zone;
  const saffire = ext.tests.filter((t) => t.program === 'Saffire');
  const ssce = ext.tests.filter((t) => t.program === 'SSCE');
  const bars = ssceBars(ssce);
  const seriesTips = {};
  const series = [];

  // Constant-pO2 guides: neutral, direct-labelled, not in the legend.
  for (const l of p.pp_o2_lines) {
    series.push({
      name: l.label, type: 'line', showSymbol: false, silent: true, z: 1,
      lineStyle: { width: 1.5, type: 'dotted', color: c.text2 },
      endLabel: { show: true, color: c.text2, fontSize: 11, formatter: `pO2 ${l.pp_o2_kpa} kPa` },
      data: l.points,
    });
  }

  // SSCE range bars (one series so the legend has one entry).
  bars.forEach((bar, i) => {
    const name = 'SSCE (range, pairing not given)';
    seriesTips[series.length] = bar.d;
    series.push({
      name, type: 'line', triggerEvent: true, z: 3,
      lineStyle: { width: 3, color: c.s2, type: 'dashed' }, itemStyle: { color: c.s2 },
      symbol: 'rect', symbolSize: [3, 14], showSymbol: true,
      data: bar.data, ...(i === 0 ? {} : { legendHoverLink: false }),
    });
  });

  series.push({
    name: 'Saffire (per-test point)', type: 'scatter', z: 5, symbol: 'circle', symbolSize: 11,
    itemStyle: { color: c.s1, borderColor: c.surface, borderWidth: 2 },
    data: saffire.map(saffireItem),
  });

  // BASS-II: every PSI-25 test at the report's stated 1 atm. Same x for all (pressure was not measured
  // per test), so markers are small and translucent rather than jittered to a false pressure.
  series.push({
    name: `BASS-II (${bass2.count} tests, PSI-25)`, type: 'scatter', z: 4, symbol: 'circle', symbolSize: 8,
    itemStyle: { color: c.s3, opacity: 0.55, borderColor: c.surface, borderWidth: 1 },
    data: bass2.tests.filter((t) => t.o2_initial_pct != null).map(bass2Item),
  });

  // FLEX liquid droplets: a 4th source, so it is encoded by SHAPE in a neutral colour (max 3 hues per chart).
  const layerData = {};
  layerData.flex = flex.tests.map((t) => ({
      value: [t.pressure_kpa, t.o2_pct],
      tip: `FLEX test ${esc(t.id)} (${esc(t.flex_identifier)}), ${esc(t.date)}<br>${esc(t.fuel)} droplet (liquid, not a solid material)<br>`
        + `${t.pressure_mmhg} mmHg = ${t.pressure_kpa} kPa; initial O2 ${t.o2_pct}% (mole fraction ${t.o2_pct / 100})`
        + `${t.he_frac ? `; He ${t.he_frac}` : ''}<br>Test end: ${esc(t.test_end)}`,
      src: `${t.source.file}, line ${t.source.line}`,
    }));
  series.push({
    id: 'flex', name: FLEX_NAME, type: 'scatter', z: 3, symbol: 'triangle', symbolSize: 8,
    itemStyle: { color: 'transparent', borderColor: c.text2, borderWidth: 1.2 },
    data: layers.flex ? layerData.flex : [],
  });

  // CFI-G normal flames: chamber O2 before each test (see o2_sweep.json for why it is ambient). Gas, not solid:
  // a 5th source, encoded by SHAPE (hollow square) in the same neutral colour as FLEX.
  layerData.cfig = cfig.tests.map((t) => ({
      value: [t.pressure_kpa, t.o2_pct],
      tip: `CFI-G normal flame ${esc(t.id)}, day ${esc(t.day)}: ${esc(t.fuel)} from a spherical burner (gas flame, not a solid material)<br>`
        + `Chamber O2 before test ${t.o2_pct}% (mole fraction ${esc(t.o2_raw)} in the file); after ${t.o2_after_pct ?? 'n/a'}%<br>`
        + `Pressure approx ${t.p_bar} bar = ${t.pressure_kpa} kPa; pO2 ${t.po2_kpa} kPa<br>`
        + `Hot ignition: ${esc(t.hot_ignition || 'not stated')}${t.comment ? `<br><i>"${esc(t.comment)}"</i>` : ''}`
        + `<br>${t.in_moon_zone ? '<b>Inside the Moon-base zone</b>' : 'Outside the Moon-base zone'}`,
      src: `${t.source.file}, line ${t.source.line} (columns "XO2 before test", "approx p (bar)")`,
    }));
  series.push({
    id: 'cfig', name: CFIG_NAME, type: 'scatter', z: 3, symbol: 'rect', symbolSize: 6,
    itemStyle: { color: 'transparent', borderColor: c.text2, borderWidth: 0.9, opacity: 0.8 },
    data: layers.cfig ? layerData.cfig : [],
  });

  // Callout: names the solid tests inside the zone (template over external_tests.json). Desktop: inside the
  // box; phones: the box is ~40 px wide, so the callout sits in the empty upper right with a leader line.
  const zIn = saffire.filter((t) => t.in_moon_zone && t.kind === 'point');
  if (zIn.length) {
    const narrow = el.clientWidth < 600;
    const flows = [...new Set(zIn.map((t) => t.flow_cm_s))];
    const tgt = [zIn.reduce((a, t) => a + t.pressure_kpa[0], 0) / zIn.length, zIn.reduce((a, t) => a + t.o2_pct[0], 0) / zIn.length];
    const names = `${zIn[0].program} ${zIn.map((t) => t.sample).join(' and ')}`;
    const text = narrow
      ? `Shaded box = Moon-base air.\nSolids inside: ${names}\n(${flows.join(', ')} cm/s)`
      : `${names}:\nthe only solid tests\nin Moon-base air\n(${zIn.length === 2 ? 'both' : 'all'} at ${flows.join(', ')} cm/s)`;
    // Phones: anchor straight above the points so the leader line is vertical; the text box hangs to the right.
    const at = narrow ? [tgt[0], 80] : [zone.p_max_kpa * 0.55, (zone.o2_min_pct + 100) / 2 - 4];
    series.push({
      name: 'callout', type: 'line', silent: true, z: 7, legendHoverLink: false,
      lineStyle: { width: 1, color: c.text }, symbol: 'circle', symbolSize: 1, itemStyle: { color: c.text },
      data: [
        { value: at, label: { show: true, position: 'inside', color: c.text, fontSize: 11, lineHeight: 15, fontWeight: 600, align: narrow ? 'left' : 'center', offset: narrow ? [-24, 0] : [0, 0],
          backgroundColor: c.surface, borderColor: c.text2, borderWidth: 1, borderRadius: 4, padding: [5, 7], formatter: text } },
        { value: tgt },
      ],
    });
  }

  series.push({
    name: 'Spacesuit', type: 'scatter', symbol: 'diamond', symbolSize: 13, z: 5, itemStyle: { color: c.text2 },
    label: { show: true, position: 'bottom', distance: 4, color: c.text2, fontSize: 11, formatter: 'Spacesuit' },
    data: [{ value: [p.spacesuit.p_kpa, p.spacesuit.o2_pct], tip: esc(p.spacesuit.label), src: cite(p.spacesuit.source) }],
    // Reference areas hang off this series.
    markArea: {
      silent: false,
      data: [
        [{ name: 'Moon-base air', xAxis: 0, yAxis: zone.o2_min_pct,
           itemStyle: { color: c.zone, borderColor: c.text, borderWidth: 1.5 },
           label: { show: el.clientWidth >= 600, position: 'insideBottomLeft', distance: 6, align: 'left', color: c.text2, lineHeight: 15,
             // bottom-left: clear of the spacesuit marker, the pO2 curves and the Saffire points
             formatter: `Moon-base air\n≥${zone.o2_min_pct}% O2\n≤10.2 psi (${zone.p_max_kpa} kPa)` } },
         { xAxis: zone.p_max_kpa, yAxis: 100 }],
      ],
      tooltip: {
        formatter: () => `<b>Moon-base zone</b><br>${esc(zone.label)}<br><small>Source: ${esc(cite(zone.source))}</small>`,
      },
    },
  });

  // Gap highlight (#evidence/gap=<habitat>.<gap>): the habitat window as a dashed accent box.
  if (hl?.region?.panel === 1) {
    const r = hl.region.all ? { o2: [0, 100], p_kpa: [0, p.x_max] } : hl.region;
    series.push({
      name: 'gap', type: 'scatter', data: [], silent: true, z: 6,
      markArea: { silent: true, data: [[{ xAxis: r.p_kpa[0], yAxis: r.o2[0], itemStyle: { color: 'transparent', borderColor: c.accent, borderWidth: 2.5, borderType: 'dashed' },
        label: { show: true, position: hl.region.all ? 'insideBottomRight' : (r.o2[1] >= 100 && r.p_kpa[1] - r.p_kpa[0] < 20 ? 'bottom' : 'top'), color: c.accent, fontWeight: 600, formatter: hl.label } }, { xAxis: r.p_kpa[1], yAxis: r.o2[1] }]] },
    });
  }

  // Flame Sandbox pick (#evidence/at=<kPa>,<O2>): a user-chosen point, NOT a test; drawn as an accent ring.
  if (pick) {
    series.push({
      name: 'Your sandbox conditions', type: 'scatter', z: 8, symbol: 'circle', symbolSize: 18, legendHoverLink: false,
      itemStyle: { color: 'transparent', borderColor: c.accent, borderWidth: 3 },
      label: { show: el.clientWidth >= 600, position: pick.o2 > 85 ? 'bottom' : 'top', color: c.accent, fontWeight: 600, formatter: 'Your conditions' },
      data: [{ value: [pick.p, pick.o2], tip: `${pick.o2}% O2 at ${pick.p} kPa, picked in the Flame Sandbox. Not a test.`, src: 'your input in the Flame Sandbox (not data)' }],
    });
  }

  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 48, right: el.clientWidth < 600 ? 72 : 96, top: el.clientWidth < 600 ? 84 : 40, bottom: 52 },   // 3-entry legend: 1 line on desktop, 3 on phones
    tooltip: tip(c, seriesTips),
    legend: { top: 0, textStyle: { color: c.text2 }, data: ['Saffire (per-test point)', 'SSCE (range, pairing not given)', `BASS-II (${bass2.count} tests, PSI-25)`] },
    xAxis: axis(c, p.x_axis, { min: 0, max: p.x_max, axisLabel: { color: c.text2, showMaxLabel: false } }),
    yAxis: axis(c, p.y_axis, { min: 0, max: 100, nameGap: 36 }),
    series,
  });
  // Screenshot/QA hook: ?tip=<seriesIndex>,<dataIndex> opens that tooltip.
  const q = new URLSearchParams(location.search).get('tip');
  if (q) {
    const [si, di] = q.split(',').map(Number);
    setTimeout(() => chart.dispatchAction({ type: 'showTip', seriesIndex: si, dataIndex: di }), 300);
  }
  chart.layerData = layerData;
  return chart;
}

function table1(ref, ext) {
  const rows = ext.tests.map((t) => `<tr><td>${esc(t.program)}</td><td>${esc(t.sample ?? t.mission)}</td><td>${esc(t.material)}</td>
    <td>${t.o2_as_stated.map(esc).join(' or ')}</td><td>${esc(t.o2_basis)}</td><td>${t.pressure_conversion.map(esc).join('<br>')}</td>
    <td>${t.flow_cm_s ?? 'not stated'}</td><td>${t.in_moon_zone ? 'yes' : 'no'}</td>
    <td>${esc(srcLine(t.source))}</td></tr>`).join('');
  return `<details class="table-view"><summary>Data table (${ext.tests.length} rows) and unit notes</summary>
    <ul class="note">${ext.unit_notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    <div class="scroll"><table><thead><tr><th>Program</th><th>Test</th><th>Material</th><th>O2 %</th><th>O2 basis</th>
    <th>Pressure (as stated → kPa)</th><th>Flow cm/s</th><th>In Moon zone</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

function panel2(el, ref, bass2, c) {
  const p = ref.panel2;
  const [lo, hi] = p.tested_a_range ?? [Infinity, -Infinity];
  const src = cite(p.source);
  const mk = (pts) => pts.map(([a, x]) => ({ value: [a, x], tip: `a = ${a} 1/s, X_O2 = ${x}%<br>${p.equation}`, src }));
  // Split into three runs so the solid part spans exactly the tested range (endpoints shared, no gaps).
  const at = (a) => [Math.round(a * 1000) / 1000, Math.round((6 * Math.exp(-0.5 * a) + 0.0167 * a + 13.4) * 1e4) / 1e4];
  const below = [...p.curve.filter(([a]) => a < lo), at(lo)];
  const tested = [at(lo), ...p.curve.filter(([a]) => a > lo && a < hi), at(hi)];
  const above = [at(hi), ...p.curve.filter(([a]) => a > hi)];
  const pts = (kind) => bass2.panel2_points.filter((q) => q.kind === kind).map((q) => {
    const t = bass2.tests.find((x) => x.id === q.test);
    return {
      value: [q.a_per_s, q.o2_final_pct],
      tip: `${esc(q.test)}: ${t.geometry.rod_diameter_in}" ${esc(t.geometry.color ?? '')} PMMA rod (r = ${q.r_cm} cm)<br>`
        + `${q.kind === 'blowoff_upper_bound' ? 'Blowoff; flow at most' : 'Last stable flow before extinction:'} Air ${q.air_cm_s} cm/s → U = 1.0066 × Air = ${q.u_cm_s} cm/s<br>`
        + `a ${q.kind === 'blowoff_upper_bound' ? '≤' : '='} (3/2)(U/r)(r/0.318)^0.5 = ${q.a_per_s} 1/s<br>Post-burn O2 ${q.o2_final_pct}% by vol (initial ${t.o2_initial_pct}%)<br>`
        + `<i>${esc(q.method)}</i>`,
      src: bassSrc(q) + (q.source_calibration ? `; ${q.source_calibration.file} (${q.source_calibration.date}, restrictor ${q.source_calibration.restrictor})` : ''),
    };
  });
  const dashed = { width: 2, type: 'dashed', color: c.s1 };
  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 56, right: 24, top: el.clientWidth < 600 ? 112 : 48, bottom: 52 },
    tooltip: tip(c),
    legend: { top: 0, textStyle: { color: c.text2 },
      data: ['NASA boundary, eq. 6.1 (tested range)', 'NASA boundary (beyond recorded flows)', 'Last stable flow before extinction (Olson rod)', 'Blowoff, flow ≤ marker (Olson rod)'] },
    xAxis: axis(c, p.x_axis, { type: 'log', min: 0.25, max: 200 }),
    yAxis: axis(c, p.y_axis, { min: 12, max: 22 }),
    series: [
      { name: 'NASA boundary (beyond recorded flows)', type: 'line', showSymbol: false, symbolSize: 10, lineStyle: dashed, itemStyle: { color: c.s1 }, data: mk(below) },
      { name: 'NASA boundary (beyond recorded flows)', type: 'line', showSymbol: false, symbolSize: 10, lineStyle: dashed, itemStyle: { color: c.s1 }, data: mk(above) },
      { name: 'NASA boundary, eq. 6.1 (tested range)', type: 'line', showSymbol: false, symbolSize: 10, lineStyle: { width: 2.5, color: c.s1 }, itemStyle: { color: c.s1 }, data: mk(tested) },
      { name: 'Last stable flow before extinction (Olson rod)', type: 'scatter', symbol: 'circle', symbolSize: 11, z: 5,
        itemStyle: { color: c.s3, borderColor: c.surface, borderWidth: 2 }, data: pts('stable_observed') },
      // Left-pointing: the true blowoff stretch rate lies at or left of the marker.
      { name: 'Blowoff, flow ≤ marker (Olson rod)', type: 'scatter', symbol: 'triangle', symbolRotate: 90, symbolSize: 14, z: 5,
        itemStyle: { color: c.s2, borderColor: c.surface, borderWidth: 2 }, data: pts('blowoff_upper_bound') },
    ],
  });
  const q = new URLSearchParams(location.search).get('tip2');   // QA hook, same as ?tip= on Panel 1
  if (q) {
    const [si, di] = q.split(',').map(Number);
    setTimeout(() => chart.dispatchAction({ type: 'showTip', seriesIndex: si, dataIndex: di }), 300);
  }
  return chart;
}

// FLEX sentence is a template over flex_tests.json; liquid droplets never enter the solid-material headline.
function flexLine(flex) {
  const z = flex.moon_zone; const nm = z.near_misses;
  const closest = nm.length ? Math.min(...nm.map((t) => t.pressure_kpa)) : null;
  return `FLEX (liquid droplets, not solids): ${z.count} of ${flex.count} tests in Moon-base air.`
    + (nm.length ? ` ${nm.length} reached ≥${z.o2_min_pct}% O2 within 2 kPa above the zone's ${z.p_max_kpa} kPa limit (closest ${closest} kPa).` : '')
    + (flex.skipped.length ? ` ${flex.skipped.length} row not plotted (pressure recorded as 0 mmHg).` : '');
}

function cfigLine(cfig) {
  const z = cfig.moon_zone;
  return `ACME CFI-G (gas flames, not solids): ${z.count} of ${cfig.count} normal-flame tests ran in Moon-base air `
    + `(${z.o2_range_pct.join('–')}% O2 at ${z.pressure_kpa.join(', ')} kPa; ${z.fuels.join(', ')}). Their O2 is the chamber atmosphere; `
    + `the "up to 85%" in the brief is the inverse flames' burner stream and is not plotted.`;
}

// Layer toggles for the non-solid sources (off by default: the headline is about solids). Each label carries
// the layer's marker shape, so it doubles as that layer's legend entry.
const ICON = {
  flex: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5 11 10.5H1Z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  cfig: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
};
function layerToggles(chart, box, counts, layers) {
  box.innerHTML = `<span class="muted">Add non-solid tests:</span> ${LAYERS.map(([id, label]) =>
    `<label><input type="checkbox" data-id="${id}"${layers[id] ? ' checked' : ''}> ${ICON[id]} ${esc(label)} <span class="muted">(+${counts[id]} tests)</span></label>`).join(' ')}`;
  box.querySelectorAll('input').forEach((i) => {
    i.onchange = () => { layers[i.dataset.id] = i.checked; chart.setOption({ series: [{ id: i.dataset.id, data: i.checked ? chart.layerData[i.dataset.id] : [] }] }); };
  });
}

// "#evidence/gap=moon_base.flow" -> {habitat, gap, region, label}
async function gapFromArg(arg) {
  const m = /^gap=([\w-]+)\.([\w-]+)$/.exec(arg ?? '');
  if (!m) return null;
  const g = await loadJSON('gaps.json');
  const h = g.habitats.find((x) => x.habitat.id === m[1]);
  const gap = h?.gaps.find((x) => x.id === m[2]);
  return gap ? { h, gap, region: gap.region, label: gap.region.all ? 'All points: microgravity' : `${h.habitat.name} window` } : null;
}

export async function render(root, arg) {
  const [ref, ext, bass2, flex, cfig] = await Promise.all(['reference.json', 'external_tests.json', 'bass2_tests.json', 'flex_tests.json', 'cfig_tests.json'].map(loadJSON));
  const hl = await gapFromArg(arg);
  const pm = /^at=([\d.]+),([\d.]+)(?:,(earth|micro|moon|mars),([\d.]+))?$/.exec(arg ?? '');
  const pick = pm ? { p: Number(pm[1]), o2: Number(pm[2]), g: pm[3] ?? 'micro', u: Number(pm[4] ?? 0) } : null;
  const c = tokens();
  const inZone = ext.tests.filter((t) => t.in_moon_zone && t.kind === 'point');
  root.innerHTML = `
    <section class="card"><h2 class="vh">Where the tests are</h2>
      <p class="headline">${headline(inZone)}</p>
      ${hl ? `<p class="gapbanner" id="gapbanner"><b>Gap (${esc(hl.h.habitat.name)}):</b> ${esc(hl.gap.text)} ${hl.region.panel === 2 ? 'See Panel 2 below: it is the only boundary, at 1 atm.' : 'Highlighted with a dashed box.'} <a href="#gaps">Back to the gap report</a></p>` : ''}
      ${pick ? `<p class="gapbanner" id="gapbanner"><b>Your Flame Sandbox conditions:</b> ${pick.o2}% O2 at ${pick.p} kPa, the ringed point. Real tests are the filled markers. <a href="#sandbox/g=${pick.g}&o2=${pick.o2}&p=${pick.p}&u=${pick.u}">Back to the sandbox</a></p>` : ''}
      <div class="layers" id="p1-layers"></div>
      <div class="chart tall" id="p1" role="img" aria-label="Scatter of O2 against total pressure for every placed test, with the Moon-base zone shaded"></div>
      <details class="table-view"><summary>About these layers</summary>
        <p class="note">Solid materials are shown by default; the headline is about them. Tick a box above to add the non-solid tests.</p>
        <p class="note">BASS-II: all ${bass2.count} PSI-25 tests, plotted at the report's stated 1 atm (pressure was not logged per test).</p>
        <p class="note">${flexLine(flex)}</p>
        <p class="note">${cfigLine(cfig)}</p></details>
      ${table1(ref, ext)}</section>
    <section class="card"><h2>BASS-II published flammability boundary (PMMA rods)</h2>
      <p class="note">NASA's published fit (report sec. 6.1.4.4, p.75), solid over a = ${ref.panel2.tested_a_range.join('–')} 1/s: the stretch rates of every Olson flow recorded in cm/s.
      Computed minimum ${ref.panel2.minimum.x_o2}% O2 at a = ${ref.panel2.minimum.a} 1/s. Points: ${bass2.panel2_points.length} Olson tests whose flow can be read from PSI files without extrapolation: the last flow recorded in cm/s at which the flame was still burning before the crew turned it down to extinction, and blowoffs whose flow is only bounded from above by the same-day fan calibration.
</p>
      <div class="p2-honest">
        <div><p class="callout">Only ${bass2.panel2_points.length} of NASA's ~${ref.panel2.nasa_figure.iss_points_approx} ISS boundary points can be reconstructed from the public PSI files.</p>
          <ul class="note">${ref.panel2.nasa_figure.why_not_reproducible.map((w) => `<li>${esc(w)}</li>`).join('')}
            <li>${esc(ref.panel2.nasa_figure.iss_points_note)}</li></ul></div>
        <figure><a href="${ref.panel2.nasa_figure.image}" target="_blank" rel="noopener"><img src="${ref.panel2.nasa_figure.image}" alt="NASA Figure 6.10: BASS-II flammability boundary with ISS and drop-tower points, log stretch-rate axis" loading="lazy" width="900" height="834"></a>
          <figcaption>NASA's own plot, for comparison (image only; points not digitized). ${esc(cite(ref.panel2.nasa_figure.source))}</figcaption></figure>
      </div>
      <div class="chart" id="p2"></div></section>`;
  const layers = { flex: false, cfig: false };
  const charts = [panel1(root.querySelector('#p1'), ref, ext, bass2, flex, cfig, c, hl, layers, pick), panel2(root.querySelector('#p2'), ref, bass2, c)];
  if (hl || pick) requestAnimationFrame(() => root.querySelector(hl?.region.panel === 2 ? '#p2' : '#gapbanner')?.scrollIntoView({ block: 'start' }));
  layerToggles(charts[0], root.querySelector('#p1-layers'), { flex: flex.count, cfig: cfig.count }, layers);
  const ro = new ResizeObserver(() => charts.forEach((ch) => ch.resize()));
  ro.observe(root);
  return () => { ro.disconnect(); charts.forEach((ch) => ch.dispose()); };
}
