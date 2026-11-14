import * as echarts from 'echarts/core';
import { ScatterChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { loadJSON, cite } from '../data.js';
import { tokens } from '../theme.js';

echarts.use([ScatterChart, LineChart, GridComponent, TooltipComponent, LegendComponent, MarkAreaComponent, CanvasRenderer]);

const axis = (c, name, extra = {}) => ({
  name, nameLocation: 'middle', nameGap: 32, nameTextStyle: { color: c.text2 },
  axisLine: { lineStyle: { color: c.grid } }, axisLabel: { color: c.text2 },
  splitLine: { lineStyle: { color: c.grid, opacity: 0.5 } }, ...extra,
});
const tip = (c) => ({ trigger: 'item', backgroundColor: c.surface, borderColor: c.grid, textStyle: { color: c.text },
  formatter: (p) => `<b>${p.seriesName}</b><br>${p.data.tip ?? ''}<br><small>Source: ${p.data.src ?? 'SOURCE MISSING'}</small>` });

function panel1(el, ref, c) {
  const p = ref.panel1;
  const zone = p.moon_base_zone;
  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 56, right: 24, top: 40, bottom: 48 },
    tooltip: tip(c),
    legend: { top: 0, textStyle: { color: c.text2 } },
    xAxis: axis(c, p.x_axis, { min: 0, max: 110 }),
    yAxis: axis(c, p.y_axis, { min: 0, max: 100 }),
    series: [
      ...p.pp_o2_lines.map((l, i) => ({
        name: l.label, type: 'line', showSymbol: false, silent: true,
        lineStyle: { width: 2, type: 'dotted', color: i ? c.s2 : c.s1 }, itemStyle: { color: i ? c.s2 : c.s1 },
        data: l.points,
      })),
      {
        name: 'Spacesuit', type: 'scatter', symbol: 'diamond', symbolSize: 12, itemStyle: { color: c.s3 },
        data: [{ value: [p.spacesuit.p_kpa, p.spacesuit.o2_pct], tip: p.spacesuit.label, src: cite(p.spacesuit.source) }],
        markArea: {
          silent: false, itemStyle: { color: c.zone },
          label: { show: true, color: c.text2, position: 'insideTop', formatter: 'Moon-base air' },
          tooltip: { formatter: `${zone.label}<br><small>Source: ${cite(zone.source)}</small>` },
          data: [[{ xAxis: 0, yAxis: zone.o2_min_pct }, { xAxis: zone.p_max_kpa, yAxis: 100 }]],
        },
      },
    ],
  });
  return chart;
}

function panel2(el, ref, c) {
  const p = ref.panel2;
  const [lo, hi] = p.tested_a_range ?? [Infinity, -Infinity];
  const tested = p.curve.filter(([a]) => a >= lo && a <= hi);
  const src = cite(p.source);
  const mk = (pts) => pts.map(([a, x]) => ({ value: [a, x], tip: `a = ${a} 1/s, X_O2 = ${x}%<br>${p.equation}`, src }));
  const chart = echarts.init(el);
  chart.setOption({
    grid: { left: 56, right: 24, top: 40, bottom: 48 },
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

export async function render(root) {
  const ref = await loadJSON('reference.json');
  const c = tokens();
  root.innerHTML = `
    <section class="card"><h2>Where the tests are</h2>
      <p class="note">Reference layer only. Test points from every source are added by the pipeline.</p>
      <div class="chart" id="p1"></div></section>
    <section class="card"><h2>BASS-II published flammability boundary (PMMA rods)</h2>
      <p class="note">Min. of eq. ${ref.panel2.source.equation_no}: ${ref.panel2.minimum.x_o2}% O2 at a = ${ref.panel2.minimum.a} 1/s (computed).
      ${ref.panel2.tested_a_range ? '' : 'Tested range not loaded yet, so the whole curve is dashed.'}</p>
      <div class="chart" id="p2"></div></section>`;
  const charts = [panel1(root.querySelector('#p1'), ref, c), panel2(root.querySelector('#p2'), ref, c)];
  const ro = new ResizeObserver(() => charts.forEach((ch) => ch.resize()));
  ro.observe(root);
  return () => { ro.disconnect(); charts.forEach((ch) => ch.dispose()); };
}
