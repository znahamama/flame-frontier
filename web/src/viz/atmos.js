// Lightweight SVG versions of the two Evidence Map panels, for the Evidence story (the full ECharts panels stay in the
// interactive view). Same data, same rules:
//   map:   every solid-material test placed on Panel 1 (sandbox.json `tests`, built by 05_build_gaps.solid_points:
//          BASS-II at the report's stated 1 atm with INITIAL O2, Saffire per Table 1) plus SSCE as range bars
//          (one bar per stated O2 level across the stated pressures; pairing not given). Reference marks from reference.json.
//   curve: BASS-II eq. 6.1 (reference.json panel2.curve), solid over the tested a-range and dashed beyond it, log x;
//          Panel 2 points from bass2_tests.json (POST-BURN O2). Blowoff markers point left: the true value is at or left.
// Every mark carries data-tip + data-src (chips.js shows them on hover, tap or focus).
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const r1 = (x) => Math.round(x * 10) / 10;

// Wide (desktop) and narrow (phone) frames: same data, a smaller viewBox on phones so text stays readable.
const MAP = { W: 640, H: 440, l: 50, r: 18, t: 14, b: 44 };
const MAPN = { W: 360, H: 400, l: 40, r: 10, t: 12, b: 42 };
const CV = { amin: 0.25, amax: 200, ymin: 12, ymax: 22 };
const CURVE = { W: 640, H: 440, l: 50, r: 18, t: 14, b: 50, ...CV };
const CURVEN = { W: 360, H: 400, l: 40, r: 10, t: 12, b: 48, ...CV };

export function eq61(a) { return 6 * Math.exp(-0.5 * a) + 0.0167 * a + 13.4; }

export function atmosModel({ S, ext, ref, bass2 }) {
  const p1 = ref.panel1; const p2 = ref.panel2;
  const ssce = ext.tests.filter((t) => t.program === 'SSCE');
  const levels = [...new Set(ssce.flatMap((t) => t.o2_pct))].sort((a, b) => a - b);
  const bars = levels.map((o2) => {
    const rows = ssce.filter((t) => t.o2_pct.includes(o2));
    const ps = rows.flatMap((t) => t.pressure_kpa);
    return { o2, p: [Math.min(...ps), Math.max(...ps)], rows };
  });
  const pts = bass2.panel2_points.map((q) => ({ ...q, t: bass2.tests.find((x) => x.id === q.test) }));
  return { tests: S.tests, bars, p1, p2, pts };
}

// ---------- Panel 1 (atmosphere map) ----------
export function mapSVG(m, { hl = '', zone = false, card = null, narrow = false } = {}) {
  const { W, H, l, r, t, b } = narrow ? MAPN : MAP;
  const xMax = m.p1.x_max;
  const X = (p) => l + (p / xMax) * (W - l - r);
  const Y = (o) => H - b - (o / 100) * (H - t - b);
  const z = m.p1.moon_base_zone; const suit = m.p1.spacesuit; const sea = m.p1.earth_sea_level;
  const grid = [0, 20, 40, 60, 80, 100].map((o) => `<line class="ag" x1="${l}" x2="${W - r}" y1="${Y(o)}" y2="${Y(o)}"/><text class="at" x="${l - 8}" y="${Y(o) + 4}" text-anchor="end">${o}</text>`).join('')
    + Array.from({ length: Math.floor(xMax / 50) + 1 }, (_, i) => i * 50).map((p) => `<text class="at" x="${X(p)}" y="${H - b + 18}" text-anchor="middle">${p}</text>`).join('');
  const axes = `<text class="al" x="${(l + W - r) / 2}" y="${H - 6}" text-anchor="middle">${esc(m.p1.x_axis)}</text>
    <text class="al" transform="translate(13 ${(t + H - b) / 2}) rotate(-90)" text-anchor="middle">O2 before ignition (%)</text>`;
  const pline = m.p1.pp_o2_lines.map((ln) => {
    const pp = Number((ln.label.match(/pO2 = ([\d.]+) kPa/) ?? [])[1]);
    const pEnd = /sea-level/.test(ln.label) ? xMax : xMax * 0.8; const yEnd = 100 * pp / pEnd;
    return `<g class="ppo2 ${/sea-level/.test(ln.label) ? 'sealvl' : ''}"><polyline points="${ln.points.filter(([p]) => p <= xMax).map(([p, o]) => `${X(p)},${Y(o)}`).join(' ')}"/>
    <text x="${X(pEnd)}" y="${Y(yEnd) - 8}" text-anchor="end">pO2 ${pp} kPa${/sea-level/.test(ln.label) ? ' (sea-level air)' : ''}</text></g>`;
  }).join('');
  const zoneTip = `<b>Moon base and pressurized rover air</b><br>${esc(z.label)}`;
  const zoneBox = `<g class="zonegrp ${zone ? 'on' : ''}"><rect class="zonerect" x="${X(0)}" y="${Y(100)}" width="${X(z.p_max_kpa) - X(0)}" height="${Y(z.o2_min_pct) - Y(100)}" tabindex="0" data-tip="${esc(zoneTip)}" data-src="${esc(z.source)}"/>
    <text class="zonelab" x="${X(z.p_max_kpa / 2)}" y="${Y(62)}" text-anchor="middle">Moon base</text><text class="zonelab" x="${X(z.p_max_kpa / 2)}" y="${Y(62) + 16}" text-anchor="middle">&amp; rover</text></g>`;
  const seaLine = `<g class="sea"><line x1="${X(sea.p_kpa)}" x2="${X(sea.p_kpa)}" y1="${Y(100)}" y2="${Y(0)}"/><text x="${X(sea.p_kpa) + 6}" y="${Y(96)}">${esc(sea.label)}</text></g>`;
  const suitMark = `<g class="suit"><path d="M${X(suit.p_kpa)} ${Y(suit.o2_pct) - 8} l8 8 l-8 8 l-8 -8z" tabindex="0" data-tip="${esc(suit.label)}" data-src="${esc(suit.source)}"/>
    <text x="${X(suit.p_kpa) + 12}" y="${Y(suit.o2_pct) + 4}">Spacesuit</text></g>`;
  const bars = m.bars.map((bar) => {
    const tip = `<b>SSCE</b>: ${bar.o2}% O2 stated with ${bar.p.map((p) => `${r1(p)}`).join('–')} kPa; which O2 went with which pressure is not given.<br>${bar.rows.map((x) => `${esc(x.material)}: "${esc(x.source.quote)}"`).join('<br>')}`;
    return `<g class="ssce"><line x1="${X(bar.p[0])}" x2="${X(bar.p[1])}" y1="${Y(bar.o2)}" y2="${Y(bar.o2)}"/><line class="hit" x1="${X(bar.p[0])}" x2="${X(bar.p[1])}" y1="${Y(bar.o2)}" y2="${Y(bar.o2)}" tabindex="0" data-tip="${esc(tip)}" data-src="${esc(`${bar.rows[0].source.short}, ${bar.rows[0].source.locator}; ${bar.rows[0].source.file}`)}"/></g>`;
  }).join('');
  const dots = m.tests.map((x) => {
    const bass = x.id.startsWith('BASS-II');
    const inZ = x.o2 >= z.o2_min_pct && x.p_kpa <= z.p_max_kpa;
    const tip = `<b>${esc(x.id)}</b>: ${esc(x.material)}<br>${x.o2}% O2 (initial) at ${x.p_kpa} kPa${x.flows?.length ? ` · flow ${x.flows.join(', ')} cm/s` : ''}${inZ ? '<br><b>Inside the Moon-base zone</b>' : ''}`;
    return `<circle class="pt ${bass ? 'bass' : 'saf'}${inZ ? ' inz' : ''}" cx="${X(x.p_kpa).toFixed(1)}" cy="${Y(x.o2).toFixed(1)}" r="${bass ? 4 : 6.5}" data-tip="${esc(tip)}" data-src="${esc(x.src)}"/>`;
  }).join('');
  let cardSVG = '';
  if (card) {
    const cx = X(z.p_max_kpa) + 10; const cy = Y(97); const w = narrow ? 200 : 248;
    const lines = card.lines;
    const h = 30 + lines.length * 19;
    cardSVG = `<g class="zcard ${zone ? 'on' : ''}" aria-hidden="true"><rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="10"/>
      <text class="zct" x="${cx + 12}" y="${cy + 20}">${esc(card.title)}</text>
      ${lines.map((ln, i) => `<text class="zcl" x="${cx + 12}" y="${cy + 40 + i * 19}">✕ ${esc(ln)}</text>`).join('')}
      <line class="zcline" x1="${cx}" y1="${cy + 14}" x2="${X(z.p_max_kpa)}" y2="${cy + 14}"/></g>`;
  }
  const aria = `Atmosphere map: ${m.tests.length} solid-material tests by O2 and total pressure, plus ${m.bars.length} SSCE range bars.`;
  return `<svg class="atmos map${narrow ? ' narrow' : ''}" viewBox="0 0 ${W} ${H}" data-hl="${esc(hl)}" role="img" aria-label="${esc(aria)}">
    ${grid}${zoneBox}${pline}${seaLine}${bars}<g class="pts">${dots}</g>${suitMark}${axes}${cardSVG}</svg>`;
}

// ---------- Panel 2 (BASS-II boundary, eq. 6.1) ----------
export function curveSVG(m, { stage = 'curve', bassSrc, narrow = false }) {
  const { W, H, l, r, t, b, amin, amax, ymin, ymax } = narrow ? CURVEN : CURVE;
  const lx = (a) => Math.log10(a);
  const X = (a) => l + ((lx(a) - lx(amin)) / (lx(amax) - lx(amin))) * (W - l - r);
  const Y = (o) => H - b - ((o - ymin) / (ymax - ymin)) * (H - t - b);
  const [lo, hi] = m.p2.tested_a_range;
  const seg = (a0, a1) => { const n = 60; return Array.from({ length: n + 1 }, (_, i) => { const a = 10 ** (lx(a0) + (i / n) * (lx(a1) - lx(a0))); return `${i ? 'L' : 'M'}${X(a).toFixed(1)} ${Y(eq61(a)).toFixed(1)}`; }).join(''); };
  const below = `${seg(amin, amax)}L${X(amax)} ${Y(ymin)}L${X(amin)} ${Y(ymin)}Z`;
  const src = `${m.p2.source.doc}, sec. ${m.p2.source.section}, eq. ${m.p2.source.equation_no}, p.${m.p2.source.printed_page}`;
  const ticks = [0.25, 1, 10, 100, 200].map((a) => `<text class="at" x="${X(a)}" y="${H - b + 18}" text-anchor="middle">${a}</text>`).join('')
    + [12, 14, 16, 18, 20, 22].map((o) => `<line class="ag" x1="${l}" x2="${W - r}" y1="${Y(o)}" y2="${Y(o)}"/><text class="at" x="${l - 8}" y="${Y(o) + 4}" text-anchor="end">${o}</text>`).join('');
  const axes = `<text class="al" x="${(l + W - r) / 2}" y="${H - 8}" text-anchor="middle">Stretch rate a (1/s), log scale</text>
    <text class="al" transform="translate(13 ${(t + H - b) / 2}) rotate(-90)" text-anchor="middle">Post-burn O2 (%)</text>`;
  const mn = m.p2.minimum;
  const mk = (q) => {
    const tip = `<b>${esc(q.test)}</b>: ${q.t.geometry.rod_diameter_in}" PMMA rod (r = ${q.r_cm} cm)<br>${q.kind === 'blowoff_upper_bound' ? `Blowoff; flow at most Air ${q.air_cm_s} cm/s, so a ≤ ${q.a_per_s} 1/s` : `Last stable flow before extinction: Air ${q.air_cm_s} cm/s, a = ${q.a_per_s} 1/s`}<br>Post-burn O2 ${q.o2_final_pct}%`;
    const x = X(q.a_per_s); const y = Y(q.o2_final_pct);
    return q.kind === 'blowoff_upper_bound'
      ? `<path class="p2pt bo" d="M${x - 8} ${y} L${x + 6} ${y - 7} L${x + 6} ${y + 7}Z" tabindex="0" data-tip="${esc(tip)}" data-src="${esc(bassSrc(q))}"/>`
      : `<circle class="p2pt st" cx="${x}" cy="${y}" r="6.5" tabindex="0" data-tip="${esc(tip)}" data-src="${esc(bassSrc(q))}"/>`;
  };
  const ctip = `<b>NASA flammability boundary</b>, ${esc(m.p2.equation)}<br>a = (3/2)(U/r)(r/r0)^0.5, r0 = ${m.p2.r0_cm} cm. Solid over the tested a = ${lo}–${hi} 1/s, dashed beyond.`;
  return `<svg class="atmos curve${narrow ? ' narrow' : ''}" viewBox="0 0 ${W} ${H}" data-stage="${esc(stage)}" role="img" aria-label="NASA BASS-II flammability boundary for PMMA rods: post-burn O2 against stretch rate, U-shaped with a minimum of ${mn.x_o2}% at a = ${mn.a} 1/s.">
    ${ticks}
    <path class="below" d="${below}"/>
    <text class="reg burn" x="${X(1.2)}" y="${Y(19.9)}">Burns (above the boundary)</text>
    <text class="reg out" x="${X(16)}" y="${Y(12.55)}" text-anchor="middle">Goes out (below)</text>
    <path class="cv dash" d="${seg(amin, lo)}"/><path class="cv dash" d="${seg(hi, amax)}"/>
    <path class="cv draw" pathLength="1" d="${seg(lo, hi)}"/>
    <path class="cvhit" d="${seg(amin, amax)}" tabindex="0" data-tip="${esc(ctip)}" data-src="${esc(src)}"/>
    <g class="branch"><text x="${X(0.32)}" y="${Y(eq61(0.32)) + 24}">quenching branch (low flow)</text>
      <text x="${X(170)}" y="${Y(eq61(170)) - 14}" text-anchor="end">blowoff branch (high flow)</text></g>
    <g class="minmk"><circle cx="${X(mn.a)}" cy="${Y(mn.x_o2)}" r="5" tabindex="0" data-tip="${esc(`Computed minimum of eq. 6.1: ${mn.x_o2}% O2 at a = ${mn.a} 1/s.<br>${mn.note}`)}" data-src="${esc(src)}"/>
      <text x="${X(mn.a)}" y="${Y(mn.x_o2) + 22}" text-anchor="middle">min ${mn.x_o2}% at a = ${mn.a}</text></g>
    <g class="p2pts">${m.pts.map(mk).join('')}</g>
    <g class="atm"><rect x="${X(0.3)}" y="${Y(21.7)}" width="${narrow ? 236 : 250}" height="30" rx="8"/><text x="${X(0.3) + 12}" y="${Y(21.7) + 20}">All BASS-II tests: 1 atm (101.3 kPa)</text></g>
    ${axes}</svg>`;
}
