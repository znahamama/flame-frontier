import * as echarts from 'echarts/core';
import { ScatterChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
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

function panel1(el, ref, ext, c) {
  const p = ref.panel1;
  const zone = p.moon_base_zone;
  const b2 = p.bass2_placeholder;
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
    data: saffire.map((t) => {
      const it = saffireItem(t);
      if (t.sample === 'VI-2') it.label = { show: true, position: 'right', color: c.text, fontSize: 11, formatter: 'Saffire VI-2, VI-3' };
      return it;
    }),
  });

  series.push({
    name: 'Spacesuit', type: 'scatter', symbol: 'diamond', symbolSize: 13, z: 5, itemStyle: { color: c.s3 },
    data: [{ value: [p.spacesuit.p_kpa, p.spacesuit.o2_pct], tip: esc(p.spacesuit.label), src: cite(p.spacesuit.source) }],
    // Reference areas hang off this series.
    markArea: {
      silent: false,
      data: [
        [{ name: 'Moon-base air', xAxis: 0, yAxis: zone.o2_min_pct,
           itemStyle: { color: c.zone, borderColor: c.text, borderWidth: 1.5 },
           label: { show: true, position: 'insideTopRight', color: c.text2, formatter: el.clientWidth < 600 ? 'Moon-base air' : 'Moon-base air\n≥30% O2, ≤10.2 psi (70.33 kPa)' } },
         { xAxis: zone.p_max_kpa, yAxis: 100 }],
        [{ name: b2.label, xAxis: b2.x0, yAxis: b2.y0,
           itemStyle: { color: c.pending, borderColor: c.text2, borderWidth: 1, borderType: 'dashed' },
           label: { show: true, position: 'bottom', color: c.text2, formatter: 'BASS-II\npending data' } },
         { xAxis: b2.x1, yAxis: b2.y1 }],
      ],
      tooltip: {
        formatter: (q) => (q.name === b2.label
          ? `<b>${esc(b2.label)}</b><br>${esc(b2.tip)}<br><small>Source: ${esc(cite(b2.source))}</small>`
          : `<b>Moon-base zone</b><br>${esc(zone.label)}<br><small>Source: ${esc(cite(zone.source))}</small>`),
      },
    },
  });

  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 56, right: 96, top: 48, bottom: 52 },
    tooltip: tip(c, seriesTips),
    legend: { top: 0, textStyle: { color: c.text2 }, data: ['Saffire (per-test point)', 'SSCE (range, pairing not given)', 'Spacesuit'] },
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

function panel2(el, ref, c) {
  const p = ref.panel2;
  const [lo, hi] = p.tested_a_range ?? [Infinity, -Infinity];
  const tested = p.curve.filter(([a]) => a >= lo && a <= hi);
  const src = cite(p.source);
  const mk = (pts) => pts.map(([a, x]) => ({ value: [a, x], tip: `a = ${a} 1/s, X_O2 = ${x}%<br>${p.equation}`, src }));
  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 56, right: 24, top: 40, bottom: 52 },
    tooltip: tip(c),
    legend: { top: 0, textStyle: { color: c.text2 } },
    xAxis: axis(c, p.x_axis, { type: 'log', min: 0.25, max: 200 }),
    yAxis: axis(c, p.y_axis, { min: 12, max: 22 }),
    series: [
      { name: 'Published boundary (beyond tested range)', type: 'line', showSymbol: false, symbolSize: 10,
        lineStyle: { width: 2, type: 'dashed', color: c.s1 }, itemStyle: { color: c.s1 }, data: mk(p.curve) },
      { name: 'Published boundary (tested range)', type: 'line', showSymbol: false, symbolSize: 10,
        lineStyle: { width: 2, color: c.s1 }, itemStyle: { color: c.s1 }, data: mk(tested) },
    ],
  });
  return chart;
}

// Headline is a template over the data: count, test names and airflow are never typed by hand.
function headline(inZone) {
  const flows = [...new Set(inZone.map((t) => t.flow_cm_s))];
  // Name each program once: "Saffire VI-2 and VI-3".
  const names = inZone.map((t, i) => (i && inZone[i - 1].program === t.program ? t.sample : `${t.program} ${t.sample}`)).join(' and ');
  const flow = flows.length === 1 ? `one airflow (${flows[0]} cm/s)` : `${flows.length} airflows`;
  const all = inZone.length === 2 ? 'both' : 'all';
  return `Of the solid-material space fire tests in our sources, only ${inZone.length} burned in Moon-base air `
    + `(${esc(names)}), ${all} at ${flow}, none in partial gravity.`;
}

export async function render(root) {
  const [ref, ext] = await Promise.all([loadJSON('reference.json'), loadJSON('external_tests.json')]);
  const c = tokens();
  const inZone = ext.tests.filter((t) => t.in_moon_zone && t.kind === 'point');
  root.innerHTML = `
    <section class="card"><h2>Where the tests are</h2>
      <p class="headline">${headline(inZone)}</p>
      <p class="note">BASS-II points pending.</p>
      <div class="chart tall" id="p1"></div>${table1(ref, ext)}</section>
    <section class="card"><h2>BASS-II published flammability boundary (PMMA rods)</h2>
      <p class="note">Min. of eq. ${ref.panel2.source.equation_no}: ${ref.panel2.minimum.x_o2}% O2 at a = ${ref.panel2.minimum.a} 1/s (computed).
      ${ref.panel2.tested_a_range ? '' : 'Tested range not loaded yet, so the whole curve is dashed.'}</p>
      <div class="chart" id="p2"></div></section>`;
  const charts = [panel1(root.querySelector('#p1'), ref, ext, c), panel2(root.querySelector('#p2'), ref, c)];
  const ro = new ResizeObserver(() => charts.forEach((ch) => ch.resize()));
  ro.observe(root);
  return () => { ro.disconnect(); charts.forEach((ch) => ch.dispose()); };
}
