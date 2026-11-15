// Static design mockups for docs/ui/UI_PLAN.md. NOT site code: nothing here ships.
// Every mark is drawn from data/processed (tests.csv, reference.json, ranking.json, gaps.json, catalog.json,
// compare.json, controls.json, external_tests.json); no numbers are typed except layout constants.
// Usage: node docs/ui/mockups/build.mjs   -> docs/ui/mockups/*.html + docs/ui/mockups/png/*.png
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const D = 'data/processed/';
const J = (f) => JSON.parse(readFileSync(D + f, 'utf8'));
const csv = (f) => {
  const [head, ...lines] = readFileSync(D + f, 'utf8').trim().split('\n').map((l) => {
    const out = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out;
  });
  return lines.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};
const tests = csv('export/tests.csv');
const solids = tests.filter((t) => t.fuel_state === 'solid');
const ref = J('reference.json');
const ranking = J('ranking.json');
const gaps = J('gaps.json');
const catalog = J('catalog.json');
const compare = J('compare.json');
const controls = J('controls.json');
const ext = J('external_tests.json');
const zone = ref.panel1.moon_base_zone;
const habitat = (id) => gaps.habitats.find((h) => h.habitat.id === id);
const inWin = (t, h) => { const o = +t.o2_pct, p = +t.pressure_kpa; return o >= h.o2_pct[0] && o <= h.o2_pct[1] && p >= h.p_kpa[0] && p <= h.p_kpa[1]; };
const moonIn = solids.filter((t) => +t.o2_pct >= zone.o2_min_pct && +t.pressure_kpa <= zone.p_max_kpa);
const issIn = solids.filter((t) => inWin(t, habitat('iss').habitat));
const suitIn = solids.filter((t) => inWin(t, habitat('spacesuit').habitat));
const other = solids.filter((t) => !moonIn.includes(t) && !issIn.includes(t) && !suitIn.includes(t));
const ssce = ext.tests.filter((t) => t.kind !== 'point');
// Headline: exact template wording (web/src/headline.js), filled from external_tests.json.
const zIn = ext.tests.filter((t) => t.in_moon_zone && t.kind === 'point');
const HEAD = `Of the solid-material space fire tests in our sources, only ${zIn.length} burned in Moon-base air (Saffire ${zIn.map((t) => t.sample).join(' and ')}), both at one airflow (${zIn[0].flow_cm_s} cm/s), none in partial gravity.`;
const SUIT = ref.panel1.spacesuit;
const prog = (t) => (t.program === 'BASS-II' ? 'bass' : 'saf');

// ---------- tokens (same values as web/src/style.css; dark from the same ramps) ----------
const TOK = `
:root{--s0:#f4f3f0;--s1:#fcfcfb;--s2:#efeee9;--t1:#0b0b0b;--t2:#52514e;--t3:#7a7975;--grid:#d6d4ce;--hair:#e4e2dc;
--c1:#2a78d6;--c2:#eb6834;--c3:#1baf7a;--acc:#eb6834;--zone:#16161a;--zonet:#f0efec;--ok:#1baf7a;--gap:#e34948;--na:#c9c7c0}
.dark{--s0:#0e0e10;--s1:#17171a;--s2:#1f1f23;--t1:#f0efec;--t2:#c3c2b7;--t3:#8d8c85;--grid:#34343a;--hair:#26262b;
--c1:#3987e5;--c2:#d95926;--c3:#199e70;--acc:#d95926;--zone:#000;--zonet:#f0efec;--ok:#199e70;--gap:#e66767;--na:#4a4a50}
*{box-sizing:border-box}body{margin:0;background:#888;font:15px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",system-ui,sans-serif;color:var(--t1)}
.frame{background:var(--s0);color:var(--t1);overflow:hidden;position:relative;margin:0 0 40px}
.chip{display:inline-flex;align-items:center;gap:4px;font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--t2);background:var(--s2);border:1px solid var(--hair);border-radius:999px;padding:4px 8px;white-space:nowrap}
.chip::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--t3)}
.tag{font:600 11px/1 system-ui;letter-spacing:.08em;text-transform:uppercase;color:var(--t2)}
.num{font-weight:700;letter-spacing:-.03em;font-variant-numeric:proportional-nums}
.card{background:var(--s1);border:1px solid var(--hair);border-radius:14px}
.anno{font:500 12px/1.3 system-ui;fill:var(--t2)}
.annob{font:700 13px/1.3 system-ui;fill:var(--t1)}
.ax{font:11px system-ui;fill:var(--t3)} .axn{font:12px system-ui;fill:var(--t2)}
.navlink{color:var(--t2);text-decoration:none;font-weight:500}.navlink.on{color:var(--t1);box-shadow:inset 0 -2px 0 var(--acc)}
.mockflag{position:absolute;right:12px;bottom:10px;font:11px system-ui;color:var(--t3)}
`;

// ---------- Panel 1: atmosphere map (solids default view) ----------
function panel1({ w, h, pad = { l: 44, r: 16, t: 14, b: 36 }, focusZone = false, dimOthers = false, labels = true, missing = false, xmax = ref.panel1.x_max }) {
  const X = (p) => pad.l + (p / xmax) * (w - pad.l - pad.r);
  const Y = (o) => h - pad.b - (o / 100) * (h - pad.t - pad.b);
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="O2 against total pressure, solid-material tests">`;
  for (let o = 0; o <= 100; o += 20) s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(o)}" y2="${Y(o)}" stroke="var(--hair)"/><text class="ax" x="${pad.l - 6}" y="${Y(o) + 4}" text-anchor="end">${o}</text>`;
  for (let p = 0; p <= xmax; p += xmax > 200 ? 50 : 20) s += `<text class="ax" x="${X(p)}" y="${h - pad.b + 16}" text-anchor="middle">${p}</text>`;
  s += `<text class="axn" x="${(pad.l + w - pad.r) / 2}" y="${h - 4}" text-anchor="middle">Total pressure (kPa)</text>`;
  s += `<text class="axn" transform="translate(12 ${(pad.t + h - pad.b) / 2}) rotate(-90)" text-anchor="middle">O2 before ignition (%)</text>`;
  // constant-pO2 line: sea-level air (from reference.json)
  const line = ref.panel1.pp_o2_lines[0].points.filter(([o, p]) => p <= xmax);
  s += `<path d="M${line.map(([o, p]) => `${X(p)},${Y(o)}`).join('L')}" fill="none" stroke="var(--t3)" stroke-width="1" stroke-dasharray="2 3"/>`;
  if (labels) s += `<text class="anno" x="${X(line.at(-1)[1]) - 4}" y="${Y(line.at(-1)[0]) - 6}" text-anchor="end">same O2 partial pressure as sea-level air</text>`;
  // Moon-base zone: dark, empty
  const zx = X(0), zy = Y(100), zw = X(zone.p_max_kpa) - X(0), zh = Y(zone.o2_min_pct) - Y(100);
  s += `<rect x="${zx}" y="${zy}" width="${zw}" height="${zh}" fill="var(--zone)" opacity="${focusZone ? 0.94 : 0.9}" rx="3"/>`;
  if (zw > 110) s += `<text x="${zx + 10}" y="${zy + 22}" fill="var(--zonet)" style="font:700 13px system-ui">Moon-base air</text><text x="${zx + 10}" y="${zy + 38}" fill="var(--zonet)" opacity=".7" style="font:12px system-ui">≥${zone.o2_min_pct}% O2 · ≤${zone.p_max_kpa} kPa</text>`;
  // spacesuit point (reference mark, not a test)
  s += `<g><rect x="${X(SUIT.p_kpa) - 5}" y="${Y(100) - 5}" width="10" height="10" transform="rotate(45 ${X(SUIT.p_kpa)} ${Y(100)})" fill="none" stroke="var(--zonet)" stroke-width="1.5"/></g>`;
  if (labels) s += `<text class="anno" x="${X(zone.p_max_kpa) + 8}" y="${Y(100) + 4}">◇ spacesuit: ${SUIT.o2_pct}% O2 at ${SUIT.p_kpa} kPa (reference mark, 0 tests)</text>`;
  // Earth sea level
  s += `<line x1="${X(101.35)}" x2="${X(101.35)}" y1="${pad.t}" y2="${h - pad.b}" stroke="var(--grid)" stroke-dasharray="1 0"/>`;
  // SSCE ranges (unpaired sets) as range bars
  for (const t of ssce) {
    const ps = t.pressure_kpa, os = t.o2_pct;
    for (const o of os) s += `<line x1="${X(Math.min(...ps))}" x2="${X(Math.max(...ps))}" y1="${Y(o)}" y2="${Y(o)}" stroke="var(--c2)" stroke-width="2" stroke-linecap="round" opacity="${dimOthers ? .25 : .9}"/>`;
  }
  // points
  const dot = (t, r = 4.5) => `<circle cx="${X(+t.pressure_kpa)}" cy="${Y(+t.o2_pct)}" r="${r}" fill="var(--${prog(t) === 'bass' ? 'c3' : 'c1'})" stroke="var(--s1)" stroke-width="1.5" opacity="${dimOthers && !moonIn.includes(t) ? .25 : 1}"/>`;
  s += solids.filter((t) => !moonIn.includes(t)).map((t) => dot(t)).join('');
  s += moonIn.map((t) => dot(t, 6)).join('');
  if (labels) {
    const b = X(101.325);
    s += `<text class="anno" x="${b + 10}" y="${Y(13)}">129 BASS-II tests, all at 1 atm</text>`;
    s += `<text class="anno" x="${X(Math.max(...ssce[0].pressure_kpa)) + 8}" y="${Y(52)}">SSCE: O2 and pressure listed, not paired</text>`;
  }
  // callout on the two in-zone tests
  const m = moonIn[0];
  if (labels) s += `<g><line x1="${X(+m.pressure_kpa) + 6}" y1="${Y(+m.o2_pct) - 4}" x2="${X(zone.p_max_kpa) + 26}" y2="${Y(46)}" stroke="var(--t1)" stroke-width="1"/>
    <text class="annob" x="${X(zone.p_max_kpa) + 30}" y="${Y(46) - 2}">Saffire ${moonIn.map((t) => t.test_id).join(' & ')}</text>
    <text class="anno" x="${X(zone.p_max_kpa) + 30}" y="${Y(46) + 14}">the only solids in Moon-base air · ${moonIn[0].flows_cm_s} cm/s</text></g>`;
  if (missing) {
    const hx = X(zone.p_max_kpa) + 30, hy = Y(93);
    const mg = habitat('moon_base');
    s += `<foreignObject x="${hx}" y="${hy}" width="270" height="150"><div xmlns="http://www.w3.org/1999/xhtml" style="background:var(--s1);border:1px solid var(--grid);border-radius:10px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.12);font:12px/1.35 system-ui;color:var(--t1)">
      <div style="font-weight:700;margin-bottom:4px">Hover: what's missing here</div>
      ${mg.gaps.map((g) => `<div style="display:flex;gap:6px;align-items:baseline"><span style="color:var(--gap)">✕</span><span>${{ flow: `Only one airflow (${mg.tested.flows_cm_s.join(', ')} cm/s)`, materials: `Only ${mg.tested.materials.length} materials`, boundary: 'No flammability boundary', gravity: 'No partial-gravity test' }[g.id]}</span></div>`).join('')}
      <div style="margin-top:6px"><span class="chip">gaps.json · 4 rules</span></div></div></foreignObject>`;
  }
  return `${s}</svg>`;
}

// ---------- Unit-dot bins: every dot is one solid test ----------
function dotBins({ w, h, cols = 10, r = 6, gap = 4, dark = false, compact = false }) {
  const hb = (id) => habitat(id).habitat;
  const win = (id) => { const x = hb(id); return x.o2_pct[0] === x.o2_pct[1] ? [`${x.o2_pct[0]}% O2`, `${x.p_kpa[0]} kPa`] : id === 'moon_base' ? [`≥${x.o2_pct[0]}% O2`, `≤${x.p_kpa[1].toFixed(1)} kPa`] : [`${x.o2_pct[0]}–${x.o2_pct[1]}% O2`, `${x.p_kpa[0].toFixed(1)}–${x.p_kpa[1].toFixed(1)} kPa`]; };
  const bins = [
    { k: 'other', label: 'No crew-air window', sub: [`${other.filter((t) => t.program === 'BASS-II').length} BASS-II below 21% O2`, `${other.filter((t) => t.program !== 'BASS-II').length} Saffire (V-2, VI-4)`], items: other },
    { k: 'iss', label: 'ISS cabin air', sub: win('iss'), items: issIn },
    { k: 'moon', label: 'Moon base & rover', sub: win('moon_base'), items: moonIn, hl: true },
    { k: 'suit', label: 'Spacesuit', sub: win('spacesuit'), items: suitIn },
  ];
  const step = r * 2 + gap, colW = cols * step;
  const bw = (w - 20) / bins.length;
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Solid-material tests binned by crew-air window">`;
  const fs = compact ? 0.82 : 1;
  const base = h - 70 * fs;
  bins.forEach((b, i) => {
    const cx = 10 + bw * i + bw / 2, x0 = cx - colW / 2 + r;
    const n = b.items.length;
    const top = base - (Math.ceil(Math.max(n, 1) / cols) - 1) * step - r;
    const ny = (b.hl ? base - 3 * step : top) - 10;
    if (b.hl) s += `<rect x="${10 + bw * i + 4}" y="${ny - 34 * fs}" width="${bw - 8}" height="${base - ny + 34 * fs + r + 10}" rx="10" fill="var(--zone)" opacity=".92"/>`;
    b.items.forEach((t, j) => {
      const few = n <= 2;
      const x = few ? cx + (j - (n - 1) / 2) * (step + 6) : x0 + (j % cols) * step, y = base - (few ? 0 : Math.floor(j / cols) * step);
      s += `<circle cx="${x}" cy="${y}" r="${few ? r + 2 : r}" fill="var(--${prog(t) === 'bass' ? 'c3' : 'c1'})" stroke="${b.hl ? 'var(--zone)' : 'var(--s1)'}" stroke-width="1.5"/>`;
    });
    if (!n) s += `<circle cx="${cx}" cy="${base}" r="${r + 2}" fill="none" stroke="var(--t3)" stroke-dasharray="3 3"/>`;
    s += `<text x="${cx}" y="${ny}" text-anchor="middle" class="num" style="font-size:${30 * fs}px;fill:${b.hl ? 'var(--zonet)' : 'var(--t1)'}">${n}</text>`;
    if (b.hl) s += `<text x="${cx}" y="${base - step - 2}" text-anchor="middle" style="font:600 ${11 * fs}px system-ui;fill:var(--zonet)">${moonIn.map((t) => t.test_id).join(' · ')}</text>`;
    s += `<text x="${cx}" y="${base + 28 * fs}" text-anchor="middle" style="font:600 ${13 * fs}px system-ui;fill:var(--t1)">${b.label}</text>`;
    b.sub.forEach((l, k) => { s += `<text x="${cx}" y="${base + (44 + k * 14) * fs}" text-anchor="middle" style="font:${11 * fs}px system-ui;fill:var(--t2)">${l}</text>`; });
  });
  return `${s}</svg>`;
}

// Phone variant: one row per bin (count + label left, dots right).
function dotRows({ w, r = 3.4, gap = 2 }) {
  const rows = [['No crew-air window', other, `${other.filter((t) => t.program === 'BASS-II').length} BASS-II below 21% O2 · 2 Saffire`], ['ISS cabin air', issIn, habitat('iss').window], ['Moon base & rover', moonIn, habitat('moon_base').window, true], ['Spacesuit', suitIn, habitat('spacesuit').window]];
  const lw = 44, step = r * 2 + gap, per = Math.floor((w - lw - 8) / step);
  let y = 6, s = '';
  for (const [label, items, sub, hl] of rows) {
    const nrows = Math.max(1, Math.ceil(items.length / per)), hgt = 40 + nrows * step + 6;
    if (hl) s += `<rect x="0" y="${y - 4}" width="${w}" height="${hgt}" rx="8" fill="var(--zone)"/>`;
    const tc = hl ? 'var(--zonet)' : 'var(--t1)', sc = hl ? 'var(--zonet)' : 'var(--t2)';
    s += `<text x="8" y="${y + 18}" class="num" style="font-size:20px;fill:${tc}">${items.length}</text><text x="44" y="${y + 13}" style="font:600 11px system-ui;fill:${tc}">${label}</text><text x="44" y="${y + 27}" style="font:10px system-ui;fill:${sc};opacity:.9">${sub}</text>`;
    items.forEach((t, j) => { s += `<circle cx="${lw + r + (j % per) * step + (items.length <= 2 ? j * 10 : 0)}" cy="${y + 40 + Math.floor(j / per) * step}" r="${items.length <= 2 ? r + 3 : r}" fill="var(--${prog(t) === 'bass' ? 'c3' : 'c1'})"/>`; });
    if (!items.length) s += `<circle cx="${lw + r + 2}" cy="${y + 40}" r="${r + 2}" fill="none" stroke="var(--t3)" stroke-dasharray="2 2"/>`;
    if (hl) s += `<text x="${lw + 40}" y="${y + 44}" style="font:600 11px system-ui;fill:var(--zonet)">${moonIn.map((t) => t.test_id).join(' · ')}</text>`;
    y += hgt + 8;
  }
  return `<svg width="${w}" height="${y}" viewBox="0 0 ${w} ${y}">${s}</svg>`;
}

// ---------- Panel 2: BASS-II boundary (log x), regions labelled ----------
function panel2({ w, h }) {
  const pad = { l: 44, r: 14, t: 16, b: 38 };
  const [amin, amax, omin, omax] = [1, 400, 12, 20];
  const X = (a) => pad.l + (Math.log10(a / amin) / Math.log10(amax / amin)) * (w - pad.l - pad.r);
  const Y = (o) => h - pad.b - ((o - omin) / (omax - omin)) * (h - pad.t - pad.b);
  const f = (a) => 6 * Math.exp(-0.5 * a) + 0.0167 * a + 13.4;
  const [ta0, ta1] = ref.panel2.tested_a_range;
  const pts = []; for (let a = amin; a <= amax; a *= 1.03) pts.push([a, Math.min(f(a), omax)]);
  const path = (sel) => `M${pts.filter(sel).map(([a, o]) => `${X(a)},${Y(o)}`).join('L')}`;
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  // regions
  s += `<path d="M${X(amin)},${Y(omax)} ${pts.map(([a, o]) => `L${X(a)},${Y(o)}`).join('')} L${X(amax)},${Y(omax)}Z" fill="var(--c2)" opacity=".10"/>`;
  s += `<path d="M${X(amin)},${Y(omin)} ${pts.map(([a, o]) => `L${X(a)},${Y(o)}`).join('')} L${X(amax)},${Y(omin)}Z" fill="var(--c1)" opacity=".08"/>`;
  for (const o of [12, 14, 16, 18, 20]) s += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(o)}" y2="${Y(o)}" stroke="var(--hair)"/><text class="ax" x="${pad.l - 6}" y="${Y(o) + 4}" text-anchor="end">${o}</text>`;
  for (const a of [1, 10, 100]) s += `<text class="ax" x="${X(a)}" y="${h - pad.b + 15}" text-anchor="middle">${a}</text>`;
  s += `<text class="axn" x="${(pad.l + w) / 2}" y="${h - 4}" text-anchor="middle">Stretch rate a (1/s), log scale</text>`;
  s += `<text class="axn" transform="translate(11 ${(pad.t + h - pad.b) / 2}) rotate(-90)" text-anchor="middle">Post-burn O2 (%)</text>`;
  s += `<path d="${path(([a]) => a <= ta0)}" fill="none" stroke="var(--t1)" stroke-width="2" stroke-dasharray="5 4"/>`;
  s += `<path d="${path(([a]) => a >= ta1)}" fill="none" stroke="var(--t1)" stroke-width="2" stroke-dasharray="5 4"/>`;
  s += `<path d="${path(([a]) => a >= ta0 * 0.99 && a <= ta1 * 1.01)}" fill="none" stroke="var(--t1)" stroke-width="2.2"/>`;
  s += `<text class="annob" x="${X(30)}" y="${Y(18.6)}" text-anchor="middle">🔥 Burns</text>`;
  s += `<text class="anno" x="${X(1.1)}" y="${Y(13.1)}">Goes out</text><text class="anno" x="${X(1.1)}" y="${Y(12.5)}">quenching (slow flow)</text>`;
  s += `<text class="anno" x="${X(amax) - 4}" y="${Y(13.1)}" text-anchor="end">Goes out</text><text class="anno" x="${X(amax) - 4}" y="${Y(12.5)}" text-anchor="end">blowoff (fast flow)</text>`;
  const pb = csv('export/bass2_boundary_points.csv');
  for (const p of pb) {
    const x = X(+p.stretch_rate_a_per_s), y = Y(+p.o2_post_burn_pct);
    if (p.kind === 'stable_observed') s += `<circle cx="${x}" cy="${y}" r="5.5" fill="var(--c3)" stroke="var(--s1)" stroke-width="1.5"/>`;
    else s += `<g><line x1="${x}" x2="${x - 14}" y1="${y}" y2="${y}" stroke="var(--c2)" stroke-width="1.5"/><path d="M${x - 14},${y - 3.5}L${x - 19},${y}L${x - 14},${y + 3.5}Z" fill="var(--c2)"/><rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" fill="var(--c2)" stroke="var(--s1)" stroke-width="1.5"/></g>`;
  }
  const m = ref.panel2.minimum;
  s += `<circle cx="${X(m.a)}" cy="${Y(m.x_o2)}" r="3" fill="var(--t1)"/>`;
  return `${s}</svg>`;
}

// ---------- Ranking: stacked component bars (Moon base) ----------
const COMP = [['o2', 'O2 overlap', 'var(--c1)'], ['pressure', 'Pressure overlap', 'var(--c2)'], ['flow', 'Flow regime', 'var(--c3)'], ['gravity', 'Gravity', '#eda100'], ['material', 'Material class', '#e87ba4'], ['data', 'Test-level data', '#6250d6']];
function rankBars({ w, rows = 8 }) {
  const hab = ranking.habitats.find((x) => x.habitat.id === 'moon_base');
  const rs = hab.rows.slice(0, rows); const lw = 200, bh = 18, gapY = 12, maxW = w - lw - 60;
  let s = `<svg width="${w}" height="${rs.length * (bh + gapY) + 56}" viewBox="0 0 ${w} ${rs.length * (bh + gapY) + 56}">`;
  rs.forEach((r, i) => {
    const y = 8 + i * (bh + gapY); let x = lw;
    s += `<text x="0" y="${y + 13}" style="font:600 12px system-ui;fill:var(--t1)">${r.rank}. ${r.psi_id}</text><text x="74" y="${y + 13}" style="font:11px system-ui;fill:var(--t2)">${r.material_class.replace(/_/g, ' ')}</text>`;
    r.parts.forEach((p, k) => {
      const pw = (p.points / 100) * maxW;
      if (pw > 0) s += `<rect x="${x}" y="${y}" width="${Math.max(pw - 2, 1)}" height="${bh}" rx="3" fill="${COMP[k][2]}"/>`;
      x += pw;
    });
    s += `<text x="${x + 6}" y="${y + 13}" style="font:600 12px system-ui;fill:var(--t1)">${r.score}</text>`;
  });
  const ly = rs.length * (bh + gapY) + 14;
  COMP.forEach(([, l, c], k) => { const lx = (k % 3) * 175, yy = ly + Math.floor(k / 3) * 18; s += `<rect x="${lx}" y="${yy}" width="10" height="10" rx="2" fill="${c}"/><text x="${lx + 14}" y="${yy + 9}" style="font:11px system-ui;fill:var(--t2)">${l} (max ${ranking.rules[COMP[k][0]].weight})</text>`; });
  return `${s}</svg>`;
}

// ---------- Habitat coverage strip: 5 gap rules per habitat ----------
function coverage({ w }) {
  const rules = [['solid_window', 'Solid in window'], ['flow', 'Airflows >2'], ['materials', 'Materials >2'], ['boundary', 'Boundary'], ['gravity', 'Gravity']];
  const hs = gaps.habitats; const lw = w < 600 ? 120 : 150, cw = (w - lw) / rules.length;
  let s = `<svg width="${w}" height="${hs.length * 34 + 40}" viewBox="0 0 ${w} ${hs.length * 34 + 40}">`;
  rules.forEach(([, l], k) => { s += `<text x="${lw + cw * k + cw / 2}" y="14" text-anchor="middle" style="font:11px system-ui;fill:var(--t2)">${l}</text>`; });
  hs.forEach((h, i) => {
    const y = 26 + i * 34; const gs = h.gaps.map((g) => g.id); const none = h.tested.solids_inside === 0;
    s += `<text x="0" y="${y + 17}" style="font:600 13px system-ui;fill:var(--t1)">${h.habitat.name}</text>`;
    rules.forEach(([id], k) => {
      const st = gs.includes(id) ? 'gap' : (none && (id === 'flow' || id === 'materials') ? 'na' : 'ok');
      const fill = { ok: 'var(--ok)', gap: 'transparent', na: 'var(--s2)' }[st];
      s += `<rect x="${lw + cw * k + 3}" y="${y}" width="${cw - 6}" height="24" rx="6" fill="${fill}" stroke="${st === 'gap' ? 'var(--gap)' : 'none'}" stroke-dasharray="${st === 'gap' ? '4 3' : ''}" stroke-width="1.5"/>`;
      s += `<text x="${lw + cw * k + cw / 2}" y="${y + 16}" text-anchor="middle" style="font:600 11px system-ui;fill:${st === 'ok' ? '#fff' : st === 'gap' ? 'var(--gap)' : 'var(--t3)'}">${{ ok: '✓ covered', gap: '✕ no data', na: 'n/a' }[st]}</text>`;
    });
  });
  return `${s}</svg>`;
}

// ---------- Catalog tiles: area ∝ per-test rows (only where a per-test table exists) ----------
function catalogTiles({ w }) {
  const inv = catalog.investigations; const roles = Object.fromEntries(controls.roles.map((r) => [r.id, new Set(r.investigations.map((x) => x.psi_id))]));
  const maxRows = Math.max(...inv.map((i) => i.test_rows)); const maxSide = 92;
  const sorted = [...inv].sort((a, b) => (b.test_rows - a.test_rows) || (b.summary_rows - a.summary_rows));
  let html = `<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;width:${w}px">`;
  for (const i of sorted) {
    const side = i.test_rows ? Math.max(Math.sqrt(i.test_rows / maxRows) * maxSide, 26) : 40;
    const kind = i.test_level === 'yes' ? 'have' : i.test_level === 'summary only' ? 'sum' : 'none';
    const style = kind === 'have' ? 'background:var(--c1);color:#fff' : kind === 'sum' ? 'background:var(--s1);border:1.5px solid var(--c1);color:var(--t1)' : 'background:transparent;border:1.5px dashed var(--t3);color:var(--t2)';
    const badges = ['prevention', 'detection', 'suppression'].filter((r) => roles[r].has(i.psi_id)).map((r) => ({ prevention: 'P', detection: 'D', suppression: 'S' }[r]));
    html += `<div style="text-align:center;font:10px system-ui;color:var(--t2)"><div style="width:${side}px;height:${side}px;border-radius:6px;${style};display:flex;align-items:center;justify-content:center;font:600 10px system-ui;margin:0 auto">${side > 40 ? i.test_rows : ''}</div>
      <div style="margin-top:3px;font-weight:600;color:var(--t1)">${i.psi_id.replace('PSI-', '')}</div><div style="height:14px">${badges.map((b) => `<span style="display:inline-block;width:13px;height:13px;border-radius:50%;border:1px solid var(--t2);font:700 8px/12px system-ui;margin:0 1px">${b}</span>`).join('')}</div></div>`;
  }
  return `${html}</div>`;
}

// ---------- Compare: aligned range bars on shared axes ----------
function compareBars({ w }) {
  const picks = compare.default.map((id) => compare.investigations.find((x) => x.psi_id === id));
  const num = (t) => ((t || "").match(/[\d.]+/g) || []).map(Number);
  const rowsDef = [['o2', 'Ambient O2 (%)', 0, 40], ['pressure', 'Pressure (kPa)', 0, 320]];
  const lw = 120, bw = w - lw - 20;
  let s = `<svg width="${w}" height="${rowsDef.length * 110 + 10}" viewBox="0 0 ${w} ${rowsDef.length * 110 + 10}">`;
  rowsDef.forEach(([key, label, lo, hi], r) => {
    const y0 = 10 + r * 110; const X = (v) => lw + ((v - lo) / (hi - lo)) * bw;
    s += `<text x="0" y="${y0 + 12}" style="font:600 12px system-ui;fill:var(--t1)">${label}</text>`;
    const z = key === 'o2' ? [zone.o2_min_pct, hi] : [0, zone.p_max_kpa];
    s += `<rect x="${X(z[0])}" y="${y0}" width="${X(z[1]) - X(z[0])}" height="84" fill="var(--zone)" opacity=".1"/><text x="${X(z[0]) + 4}" y="${y0 + 82}" style="font:10px system-ui;fill:var(--t2)">Moon-base window</text>`;
    picks.forEach((p, i) => {
      const cell = p.cells[key]; const y = y0 + 20 + i * 20; const v = cell ? num(cell.text) : [];
      s += `<text x="${lw - 8}" y="${y + 9}" text-anchor="end" style="font:11px system-ui;fill:var(--t2)">${p.psi_id}</text>`;
      if (v.length) { const a = v[0], b = v.length > 1 && v[1] > a ? v[1] : a; s += `<rect x="${X(a) - (a === b ? 3 : 0)}" y="${y}" width="${Math.max(X(b) - X(a), 6)}" height="11" rx="5.5" fill="var(--c${i + 1})"/>`; }
      else s += `<text x="${lw + 4}" y="${y + 9}" style="font:italic 11px system-ui;fill:var(--t3)">not in our data</text>`;
    });
    for (let v = lo; v <= hi; v += (hi - lo) / 4) s += `<text class="ax" x="${X(v)}" y="${y0 + 98}" text-anchor="middle">${v}</text>`;
  });
  return `${s}</svg>`;
}

// ---------- Clips: crew-noted step strip (ordered steps, NO time axis) ----------
function clipSteps({ w }) {
  // From clips.json / the PSI row for O4: Fan "5, 0.7, 0.5, 0.4, 0.36 ext" · Air "5, down to ext". Pot settings are
  // a control input, not a flow, so the strip is ordinal (equal chips), never a bar height.
  const steps = [['Air 5 cm/s', 'last flow in cm/s'], ['pot 0.7', 'fan pot'], ['pot 0.5', 'fan pot'], ['pot 0.4', '< lowest calibrated (0.5)'], ['pot 0.36', '< lowest calibrated (0.5)']];
  const sw = (w - 70) / steps.length;
  let s = `<svg width="${w}" height="96" viewBox="0 0 ${w} 96"><text x="0" y="14" style="font:600 12px system-ui;fill:var(--t1)">O4: crew-noted steps (order only, no time, no magnitude)</text>`;
  steps.forEach(([v, sub], i) => {
    const x = i * sw;
    s += `<rect x="${x}" y="30" width="${sw - 18}" height="34" rx="17" fill="${i ? 'var(--s2)' : 'var(--c3)'}" stroke="var(--grid)"/><text x="${x + (sw - 18) / 2}" y="52" text-anchor="middle" style="font:600 12px system-ui;fill:${i ? 'var(--t1)' : '#fff'}">${v}</text>`;
    s += `<text x="${x + (sw - 18) / 2}" y="80" text-anchor="middle" style="font:10px system-ui;fill:var(--t2)">${sub}</text><text x="${x + sw - 14}" y="52" style="font:12px system-ui;fill:var(--t3)">›</text>`;
  });
  s += `<text x="${steps.length * sw}" y="52" style="font:700 13px system-ui;fill:var(--gap)">ext ✕</text></svg>`;
  return s;
}

// ===================== pages =====================
const nav5 = (on, style = '') => ['Story', 'Evidence', 'Explore', 'Ask', 'About'].map((n) => `<a class="navlink ${n === on ? 'on' : ''}" style="padding:8px 2px;${style}">${n}</a>`).join('');
const P = [];
const page = (id, w, h, body, cls = '') => P.push({ id, html: `<section class="frame ${cls}" id="${id}" style="width:${w}px;height:${h}px">${body}</section>` });

// ---- A: Story-first scrollytelling ----
page('A-start', 1440, 900, `
  <header style="display:flex;align-items:center;justify-content:space-between;padding:18px 48px">
    <b style="font-size:17px">Flame Frontier</b><nav style="display:flex;gap:28px">${nav5('Story')}</nav><span class="chip">tests.csv · 586 rows</span></header>
  <div style="display:grid;grid-template-columns:500px 1fr;gap:40px;padding:40px 48px 0">
    <div><div class="tag">NASA Space Apps 2026 · Flame in Freefall</div>
      <h1 style="font-size:38px;line-height:1.12;letter-spacing:-.02em;margin:14px 0 18px">${HEAD.replace(/only (\d+)/, 'only <span style="color:var(--acc)">$1</span>')}</h1>
      <p style="color:var(--t2);font-size:17px;margin:0 0 18px">Each dot is one NASA fire test on a solid material. Watch where they land.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="chip">external_tests.csv · Saffire Table 1 p.3</span><span class="chip">gaps.json · windows</span></div>
      <div style="margin-top:120px;display:flex;align-items:center;gap:14px;color:var(--t2)"><div style="width:2px;height:60px;background:linear-gradient(var(--acc) 20%,var(--hair) 20%)"></div><div><b style="color:var(--t1)">1 / 5</b> The evidence<br>Scroll ↓</div></div></div>
    <div class="card" style="padding:18px 10px 6px">${dotBins({ w: 820, h: 460 })}
      <div style="font:11px system-ui;color:var(--t3);padding:0 12px 6px">Motion: dots fall from the top and settle into their bin (~1.2 s). Reduced motion: this end state. Hover a dot: test ID + source row.</div></div>
  </div><div class="mockflag">Mockup A · Story-first · Start (1440)</div>`);
page('A-evidence', 1440, 900, `
  <header style="display:flex;align-items:center;justify-content:space-between;padding:18px 48px"><b style="font-size:17px">Flame Frontier</b><nav style="display:flex;gap:28px">${nav5('Evidence')}</nav><span class="chip">tests.csv · 586 rows</span></header>
  <div style="display:grid;grid-template-columns:360px 1fr;gap:36px;padding:28px 48px 0">
    <div style="display:flex;flex-direction:column;gap:14px;padding-top:30px">
      ${['Earth air: most tests sit on the 1-atm line.', `Moon-base air is up here: ≥${zone.o2_min_pct}% O2, ≤${zone.p_max_kpa} kPa.`, `Only ${moonIn.length} solids made it in.`, 'Where does a solid stop burning? (Panel 2)'].map((t, i) => `<div class="card" style="padding:16px 18px;${i === 2 ? 'border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)' : 'opacity:.45'}"><div class="tag" style="margin-bottom:6px">Step ${i + 2} of 5</div><div style="font-size:${i === 2 ? 20 : 15}px;font-weight:${i === 2 ? 700 : 500}">${t}</div>${i === 2 ? `<p style="color:var(--t2);margin:8px 0 10px">Saffire ${moonIn.map((t) => t.test_id).join(' and ')}: ${moonIn.map((t) => t.material_or_fuel).join(', ')}, both at ${moonIn[0].flows_cm_s} cm/s, in microgravity.</p><span class="chip">ICES-2024-365 · Table 1 · p.3</span>` : ''}</div>`).join('')}
    </div>
    <div class="card" style="padding:14px">${panel1({ w: 960, h: 700, focusZone: true, dimOthers: true })}</div></div>
  <div class="mockflag">Mockup A · Story-first · Evidence (1440): sticky chart, text steps scroll past</div>`);

// ---- B: Mission dashboard (dark) ----
const side = (on) => `<aside style="width:200px;border-right:1px solid var(--hair);padding:22px 16px;display:flex;flex-direction:column;gap:4px">
  <b style="font-size:16px;margin:0 8px 18px">🔥 Flame Frontier</b>
  ${[['◉', 'Story'], ['⌖', 'Evidence'], ['▦', 'Explore'], ['?', 'Ask'], ['ⓘ', 'About']].map(([i, n]) => `<div style="padding:9px 10px;border-radius:8px;${n === on ? 'background:var(--s2);color:var(--t1)' : 'color:var(--t2)'};font-weight:500"><span style="display:inline-block;width:22px">${i}</span>${n}</div>`).join('')}
  <div style="margin-top:auto;font:11px system-ui;color:var(--t3);padding:8px">Explore = Catalog · Ranking · Compare · Habitat gaps · Prevent/Detect/Suppress · Clips · Sandbox</div></aside>`;
const tile = (n, label, viz, src) => `<div class="card" style="padding:16px 18px;display:flex;flex-direction:column;gap:6px"><div class="num" style="font-size:40px;line-height:1">${n}</div><div style="font-weight:600">${label}</div><div style="flex:1;display:flex;align-items:flex-end">${viz}</div><span class="chip" style="align-self:flex-start">${src}</span></div>`;
const progBar = (() => {
  const parts = [['BASS-II', tests.filter((t) => t.program === 'BASS-II').length, 'var(--c3)'], ['Saffire', tests.filter((t) => t.program.startsWith('Saffire')).length, 'var(--c1)'], ['FLEX', tests.filter((t) => t.program === 'FLEX').length, 'var(--t3)'], ['CFI-G', tests.filter((t) => t.program.startsWith('ACME')).length, 'var(--na)']];
  const tot = parts.reduce((a, p) => a + p[1], 0);
  return `<div style="width:100%"><div style="display:flex;gap:2px;height:12px">${parts.map(([, n, c]) => `<div style="flex:${n};background:${c};border-radius:3px"></div>`).join('')}</div><div style="display:flex;gap:10px;font:11px system-ui;color:var(--t2);margin-top:6px;flex-wrap:wrap">${parts.map(([l, n]) => `<span>${l} ${n}</span>`).join('')}</div></div>`;
})();
const grav = `<div style="display:flex;gap:4px;width:100%">${[['micro', 1], ['Moon 0.17 g', 0], ['Mars 0.38 g', 0], ['Earth 1 g', 0]].map(([l, on]) => `<div style="flex:1;text-align:center"><div style="height:12px;border-radius:3px;${on ? 'background:var(--c1)' : 'border:1.5px dashed var(--t3)'}"></div><div style="font:10px system-ui;color:var(--t2);margin-top:4px">${l}</div></div>`).join('')}</div>`;
const sq24 = `<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:3px;width:100%">${catalog.investigations.map((i) => `<div style="aspect-ratio:1;border-radius:2px;${i.test_level === 'yes' ? 'background:var(--c1)' : i.test_level === 'summary only' ? 'border:1.5px solid var(--c1)' : 'border:1.5px dashed var(--t3)'}"></div>`).join('')}</div>`;
page('B-start', 1440, 900, `<div style="display:flex;height:100%">${side('Story')}
  <main style="flex:1;padding:26px 30px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:auto 1fr 1fr;gap:16px">
    <div class="card" style="grid-column:1/5;padding:22px 26px;display:flex;gap:30px;align-items:center"><div style="flex:1"><div class="tag">Headline · computed from data</div><h1 style="font-size:26px;line-height:1.2;margin:8px 0 0;letter-spacing:-.01em">${HEAD}</h1></div><span class="chip">external_tests.json</span></div>
    ${tile(catalog.investigations.length, 'NASA PSI combustion investigations', sq24, 'catalog.json')}
    ${tile(tests.length, 'tests placed by O2 and pressure', progBar, 'export/tests.csv')}
    ${tile(moonIn.length, 'solids in Moon-base air', `<div style="width:100%">${panel1({ w: 270, h: 120, pad: { l: 4, r: 4, t: 4, b: 4 }, labels: false }).replace(/<text[^>]*class="(ax|axn|anno|annob)"[^>]*>[^<]*<\/text>/g, '')}</div>`, 'Saffire Table 1 p.3')}
    ${tile(0, 'combustion tests in partial gravity', grav, 'challenge page')}
    <div class="card" style="grid-column:1/3;padding:16px 18px"><div style="font-weight:600;margin-bottom:8px">Habitat coverage: where the data runs out</div>${coverage({ w: 560 })}</div>
    <div class="card" style="grid-column:3/5;padding:16px 18px;display:flex;flex-direction:column;gap:10px"><div style="font-weight:600">Ask the evidence</div>
      <div style="border:1px solid var(--grid);border-radius:10px;padding:12px 14px;color:var(--t3)">Which solids burned in Moon-base air?</div>
      ${['Is there any partial-gravity combustion data in PSI?', 'What is the minimum O2 on the BASS-II boundary?'].map((q) => `<div style="color:var(--c1);font-size:14px">↳ ${q}</div>`).join('')}
      <div style="margin-top:auto;font:12px system-ui;color:var(--t2)">Every sentence cites a NASA passage · works offline</div></div>
  </main></div><div class="mockflag">Mockup B · Mission dashboard (dark) · Start (1440)</div>`, 'dark');
page('B-evidence', 1440, 900, `<div style="display:flex;height:100%">${side('Evidence')}
  <main style="flex:1;padding:22px 26px;display:grid;grid-template-columns:1fr 330px;gap:16px">
    <div class="card" style="padding:16px 16px 8px"><div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><b style="margin-right:auto">Where the tests burned · O2 vs pressure</b>
      ${[['Solids', 1], [`+ FLEX droplets ${tests.filter((t) => t.program === 'FLEX').length}`, 0], [`+ CFI-G gas ${tests.filter((t) => t.program.startsWith('ACME')).length}`, 0]].map(([l, on]) => `<span style="padding:6px 12px;border-radius:999px;font:500 12px system-ui;${on ? 'background:var(--t1);color:var(--s0)' : 'border:1px solid var(--grid);color:var(--t2)'}">${l}</span>`).join('')}
      <span style="padding:6px 12px;border-radius:999px;font:500 12px system-ui;border:1px solid var(--grid);color:var(--t2)">Panel 2 · boundary →</span></div>
      ${panel1({ w: 820, h: 740 })}</div>
    <aside class="card" style="padding:18px;display:flex;flex-direction:column;gap:12px"><div class="tag">Inspector · selected test</div>
      <div style="font-size:22px;font-weight:700">Saffire ${moonIn[0].test_id}</div><div style="color:var(--t2)">${moonIn[0].material_or_fuel} · microgravity (Cygnus)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${[['O2', `${moonIn[0].o2_pct}%`], ['Pressure', `${moonIn[0].pressure_kpa} kPa`], ['Airflow', `${moonIn[0].flows_cm_s} cm/s`], ['pO2', `${(+moonIn[0].o2_pct * +moonIn[0].pressure_kpa / 100).toFixed(1)} kPa`]].map(([k, v]) => `<div style="background:var(--s2);border-radius:10px;padding:10px"><div style="font:11px system-ui;color:var(--t2)">${k}</div><div class="num" style="font-size:20px">${v}</div></div>`).join('')}</div>
      <div style="padding:10px;border-radius:10px;border:1px solid var(--acc);font-size:13px">Inside the Moon-base zone</div>
      <div><div style="font:11px system-ui;color:var(--t2);margin-bottom:6px">Source</div><span class="chip">ICES-2024-365 · Table 1 · p.3</span> <span class="chip">external_tests.csv row ${tests.indexOf(moonIn[0]) + 1}</span></div>
      <div style="margin-top:auto;font:12px system-ui;color:var(--t2)">Click any dot to inspect · ↑↓ to step through tests · table view ▸</div></aside>
  </main></div><div class="mockflag">Mockup B · Mission dashboard (dark) · Evidence (1440)</div>`, 'dark');

// ---- C: Editorial data-journalism (recommended frame) ----
const topC = (on) => `<header style="display:flex;align-items:center;gap:36px;padding:18px 56px;border-bottom:1px solid var(--hair)"><b style="font-size:17px;margin-right:auto">Flame Frontier</b>${nav5(on)}<span style="color:var(--t2);font-size:13px">◐</span></header>`;
page('C-start', 1440, 900, `${topC('Story')}
  <div style="padding:30px 56px 0;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start">
    <div><div class="tag">NASA Space Apps 2026 · Flame in Freefall</div>
      <h1 style="font-size:34px;line-height:1.15;letter-spacing:-.02em;margin:12px 0 14px">${HEAD}</h1>
      <span class="chip">template over external_tests.json</span>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:26px">
        ${[[catalog.investigations.length, 'investigations in NASA PSI', 'catalog.json'], [tests.length, 'tests placed on one map', 'tests.csv'], [moonIn.length, 'solids in Moon-base air', 'Saffire Table 1'], [0, 'tests in partial gravity', 'challenge page']].map(([n, l, s]) => `<div style="border-top:2px solid var(--t1);padding-top:8px"><div class="num" style="font-size:44px;line-height:1">${n}</div><div style="color:var(--t2)">${l}</div><span class="chip" style="margin-top:6px">${s}</span></div>`).join('')}</div>
      <div style="display:flex;gap:10px;margin-top:26px">${['See the evidence →', 'Explore the 24 →', 'Ask →'].map((t, i) => `<span style="padding:10px 16px;border-radius:999px;font-weight:600;${i ? 'border:1px solid var(--grid)' : 'background:var(--t1);color:var(--s0)'}">${t}</span>`).join('')}</div></div>
    <div class="card" style="padding:12px">${dotBins({ w: 620, h: 430, cols: 8, r: 6.5 })}</div></div>
  <div class="mockflag">Mockup C · Editorial (recommended) · Start (1440) with A's dot bins as hero</div>`);
page('C-evidence', 1440, 900, `${topC('Evidence')}
  <div style="padding:20px 56px 0"><div style="display:flex;align-items:baseline;gap:16px"><h2 style="margin:0;font-size:24px;letter-spacing:-.01em">Where solids have burned, and where Moon-base air is</h2><span style="margin-left:auto;display:flex;gap:6px"><span class="chip">Solids ✓</span><span class="chip">+FLEX</span><span class="chip">+CFI-G</span><span class="chip">↓ CSV</span></span></div>
  <div style="display:grid;grid-template-columns:1fr 420px;gap:22px;margin-top:14px">
    <div class="card" style="padding:12px">${panel1({ w: 900, h: 640, missing: true })}</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="card" style="padding:14px"><div style="font-weight:700;margin-bottom:2px">Where does a solid stop burning?</div><div style="color:var(--t2);font-size:13px;margin-bottom:6px">NASA's BASS-II boundary, PMMA rods, 1 atm</div>${panel2({ w: 390, h: 300 })}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><span class="chip">eq. 6.1 · p.75</span><span class="chip">min ${ref.panel2.minimum.x_o2}% at a = ${ref.panel2.minimum.a} 1/s</span><span class="chip">7 PSI-25 points</span></div></div>
      <details open class="card" style="padding:12px 14px;font-size:13px;color:var(--t2)"><summary style="font-weight:600;color:var(--t1)">3 caveats</summary>Initial O2 here, post-burn O2 on the boundary · BASS-II pressure stated once (1 atm) · SSCE pairs not given → <u>Known limits</u></details>
    </div></div></div>
  <div class="mockflag">Mockup C · Editorial · Evidence (1440): direct labels, hover card on the empty zone, Panel 2 beside</div>`);
// phone (recommended)
page('C-start-phone', 375, 812, `<header style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--hair)"><b>Flame Frontier</b><span style="margin-left:auto;font-size:20px">☰</span></header>
  <div style="padding:16px"><div class="tag">Space Apps 2026</div><h1 style="font-size:22px;line-height:1.2;margin:8px 0 10px;letter-spacing:-.01em">${HEAD}</h1><span class="chip">external_tests.json</span>
  <div class="card" style="margin-top:14px;padding:6px 0"><div style="padding:8px">${dotRows({ w: 325 })}</div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">${[[catalog.investigations.length, 'investigations'], [tests.length, 'tests placed']].map(([n, l]) => `<div style="border-top:2px solid var(--t1);padding-top:6px"><div class="num" style="font-size:30px;line-height:1">${n}</div><div style="color:var(--t2);font-size:13px">${l}</div></div>`).join('')}</div></div>
  <nav style="position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-around;padding:10px 0 18px;background:var(--s1);border-top:1px solid var(--hair);font:600 11px system-ui">${['Story', 'Evidence', 'Explore', 'Ask', 'About'].map((n, i) => `<span style="color:${i ? 'var(--t2)' : 'var(--acc)'}">${n}</span>`).join('')}</nav>`);
page('C-evidence-phone', 375, 812, `<header style="display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid var(--hair)"><b>Evidence</b><span style="margin-left:auto" class="chip">↓ CSV</span></header>
  <div style="padding:14px 16px"><div style="font-weight:700;font-size:17px;margin-bottom:8px">Where solids have burned</div>
  <div class="card" style="padding:6px">${panel1({ w: 331, h: 400, labels: false, pad: { l: 34, r: 8, t: 10, b: 34 } })}</div>
  <div class="card" style="margin-top:12px;padding:12px 14px;border-color:var(--acc)"><div style="font-weight:700">Moon-base air: ${moonIn.length} solid tests</div><div style="color:var(--t2);font-size:13px;margin:4px 0 8px">Missing: other airflows · more materials · a boundary · partial gravity</div><span class="chip">gaps.json</span> <span class="chip">Table 1 p.3</span></div>
  <div style="display:flex;gap:6px;margin-top:12px;overflow:hidden"><span class="chip">Solids ✓</span><span class="chip">+FLEX</span><span class="chip">+CFI-G</span><span class="chip">Boundary ›</span></div></div>
  <nav style="position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-around;padding:10px 0 18px;background:var(--s1);border-top:1px solid var(--hair);font:600 11px system-ui">${['Story', 'Evidence', 'Explore', 'Ask', 'About'].map((n, i) => `<span style="color:${i === 1 ? 'var(--acc)' : 'var(--t2)'}">${n}</span>`).join('')}</nav>`);

// ---- Visual gallery (any direction) ----
const g = (t, sub, body) => `<div class="card" style="padding:16px 18px"><div style="font-weight:700">${t}</div><div style="color:var(--t2);font-size:12.5px;margin-bottom:10px">${sub}</div>${body}</div>`;
page('gallery', 1440, 1330, `<div style="padding:24px 40px"><h2 style="margin:0 0 14px">Visual gallery: one picture per section (real data, static)</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
  ${g('Panel 2 · the U-curve draws itself, then the 7 points pop in', `Solid curve = tested a-range ${ref.panel2.tested_a_range.join('–')} 1/s, dashed beyond. Squares with ◂ = blowoff upper bounds (true a ≤ value).`, panel2({ w: 640, h: 330 }))}
  ${g('Ranking · why, without reading (Moon base)', 'Each bar = the 6 rule components, from zero, max 100. Switching habitat animates the reorder.', rankBars({ w: 640 }))}
  ${g('Habitat gaps · coverage strip', 'One cell per gap rule (gaps.json). n/a = rule cannot apply with no solid in the window.', coverage({ w: 640 }))}
  ${g('Catalog · 24 tiles', 'Filled = per-test table; area ∝ per-test rows (square root of count → side). Outline = summary only; dashed = no table (no size: no test count). P/D/S = role links from controls.json.', catalogTiles({ w: 640 }))}
  ${g('Compare · ranges on shared axes', 'Default picks (compare.json). Point = single stated value; bar = tested range; Moon-base window shaded.', compareBars({ w: 640 }))}
  ${g('Clips · step strip under the video', 'Crew-noted steps from the PSI table, in order. Equal chips: Air (cm/s) and fan pot are different units, and the table has no timestamps.', clipSteps({ w: 640 }))}
  </div></div>`);

// ---------- write + render ----------
const out = 'docs/ui/mockups';
mkdirSync(`${out}/png`, { recursive: true });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Flame Frontier mockups</title><style>${TOK}</style></head><body>${P.map((p) => p.html).join('\n')}</body></html>`;
writeFileSync(`${out}/mockups.html`, html);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const pg = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5 });
await pg.setContent(html, { waitUntil: 'load' });
for (const p of P) { await pg.locator(`#${p.id}`).screenshot({ path: `${out}/png/${p.id}.png` }); console.log(p.id); }
await browser.close();
console.log({ solids: solids.length, iss: issIn.length, moon: moonIn.length, suit: suitIn.length, other: other.length });
