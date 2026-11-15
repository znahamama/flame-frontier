// Visuals for the Explore section, shared by its story and its views. All values are read from data/processed
// (catalog.json, controls.json, ranking.json, gaps.json, flex_tests.json); every mark has data-tip + data-src.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const n = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0$/, ''));
const short = (f) => String(f ?? '').split('/').slice(-1)[0];
import { nm, nmid, nameHTML } from '../names.js';

// ---------- Catalog tiles ----------
export const ROLE = { prevention: ['Prevent', 'P'], detection: ['Detect', 'D'], suppression: ['Suppress', 'S'] };
export function rolesByPsi(controls) {
  const m = {};
  for (const r of controls.roles) for (const i of r.investigations) (m[i.psi_id] ??= []).push(r.id);
  return m;
}
const DATA = { yes: ['per-test table', 'tests'], 'summary only': ['summary table only', 'summary'], no: ['no experimental table', 'none'] };
export function tileHTML(c, roles, { href = `#catalog/${c.psi_id}` } = {}) {
  const f = c.fields;
  const [dl, dk] = DATA[c.test_level] ?? [c.test_level, 'none'];
  const rs = roles[c.psi_id] ?? [];
  const tip = `<b>${esc(nmid(c.psi_id))}</b>: ${esc(f.title.value)}<br>${esc(c.index_type?.value ?? '')} · ${esc(f.platform.value ?? 'platform not in metadata')}<br>Data: ${esc(dl)}${c.test_rows ? ` (${c.test_rows} rows)` : ''}${rs.length ? `<br>Fire-safety role: ${rs.map((r) => ROLE[r][0]).join(', ')} (quoted link, Prevent · Detect · Suppress)` : ''}`;
  return `<li class="tile2 d-${dk}" data-psi="${esc(c.psi_id)}"><a href="${href}" data-tip="${esc(tip)}" data-src="${esc(`${f.title.source?.file ?? ''}, line ${f.title.source?.line ?? ''}`)}">
    <span class="t2n">${esc(nm(c.psi_id).replace(/-/g, '\u2011'))}</span><span class="t2id">${esc(c.psi_id)}</span>
    <span class="t2foot"><span class="t2data" title="${esc(dl)}"><i aria-hidden="true"></i>${esc(dk === 'tests' ? `${c.test_rows} tests` : dk === 'summary' ? 'summary' : 'no table')}</span>
      ${rs.map((r) => `<span class="rb rb-${r}" title="${ROLE[r][0]}">${ROLE[r][1]}</span>`).join('')}</span></a></li>`;
}
export function tilesHTML(cat, controls, opts) {
  const roles = rolesByPsi(controls);
  return `<ul class="tiles2" aria-label="${cat.investigations.length} PSI combustion investigations">${cat.investigations.map((c) => tileHTML(c, roles, opts)).join('')}</ul>`;
}

// ---------- Ranking: stacked rule components ----------
export const COMPONENTS = ['o2', 'pressure', 'flow', 'gravity', 'material', 'data'];
export function stackHTML(r, d) {
  const segs = COMPONENTS.map((k) => r.parts.find((p) => p.key === k)).filter((p) => p && p.points > 0);
  return `<span class="stack" role="img" aria-label="${esc(`${nmid(r.psi_id)}: ${n(r.score)} of ${d.max_score}: ${segs.map((p) => `${p.label} ${n(p.points)}`).join(', ')}`)}">${segs.map((p) =>
    `<span class="sg sg-${p.key}" style="width:${(100 * p.points) / d.max_score}%" data-tip="${esc(`<b>${nmid(r.psi_id)}</b> · ${p.label}: ${n(p.points)} of ${p.weight} (× ${p.factor})<br>${p.why}`)}" data-src="${esc(`ranking.json rule "${d.rules[p.key]?.label ?? p.key}": ${d.rules[p.key]?.rule ?? ''}`)}"></span>`).join('')}</span>`;
}
export function stackLegend(d) {
  return `<p class="stacklegend">${COMPONENTS.filter((k) => d.rules[k]).map((k) => `<span><i class="sw sg-${k}"></i>${esc(d.rules[k].label)} <small>(max ${d.rules[k].weight})</small></span>`).join('')}</p>`;
}
export function rankBarsHTML(H, d, { top = 6 } = {}) {
  return `${stackLegend(d)}<ol class="rankbars">${H.rows.slice(0, top).map((r) => `<li data-psi="${esc(r.psi_id)}"><span class="rbid">#${r.rank} ${nameHTML(r.psi_id)}</span>${stackHTML(r, d)}<b class="rbn">${n(r.score)}</b></li>`).join('')}</ol>
    <p class="note">${esc(H.habitat.name)}: top ${top} of ${H.rows.length}, out of ${d.max_score} points.</p>`;
}

// ---------- Compare: tested O2 and pressure ranges vs a habitat window ----------
// Ranges come from ranking.json rows (o2_range_pct, p_range_kpa: min-max over the condition columns named in o2_cols/p_cols).
export function rangeBarsSVG(rows, win, { narrow = false, stacked = false, rowH = 26 } = {}) {
  // Desktop view: the two panels side by side. Phone, or a tall story stage: stacked, each full width.
  const W = narrow ? 360 : 640; const lw = narrow ? 64 : 92; const pad = 30;
  narrow = narrow || stacked;
  const pMax = Math.max(120, ...rows.flatMap((r) => r.p_range_kpa ?? []), win.p[1]) * 1.05;
  const axes = [{ key: 'o2', label: 'O2 tested (%)', max: 100, w: win.o2, get: (r) => r.o2_range_pct, cols: (r) => r.o2_cols },
    { key: 'p', label: 'Pressure tested (kPa)', max: pMax, w: win.p, get: (r) => r.p_range_kpa, cols: (r) => r.p_cols }];
  const panelW = narrow ? W - lw - 12 : (W - lw - 40) / 2;
  const barH = Math.min(18, Math.max(10, rowH * 0.4));
  const blockH = pad + rows.length * rowH + 30;
  let out = '';
  axes.forEach((ax, k) => {
    const x0 = narrow ? lw : lw + k * (panelW + 40); const oy = narrow ? k * blockH : 0; const X = (v) => x0 + (v / ax.max) * panelW;
    const H = rows.length * rowH;
    out += `<g transform="translate(0 ${oy})">`;
    out += `<text class="rgl" x="${x0}" y="14">${ax.label}</text>
      <rect class="rgwin" data-tip="${esc(`Shaded: ${win.name} ${win.text}`)}" data-src="NASA Space Apps 2026 challenge page, Flame in Freefall" x="${X(ax.w[0])}" y="${pad - 6}" width="${Math.max(2, X(ax.w[1]) - X(ax.w[0]))}" height="${H + 6}"/>
      <line class="rgax" x1="${x0}" x2="${x0 + panelW}" y1="${pad + H}" y2="${pad + H}"/>
      ${[0, ax.max / 2, ax.max].map((v, j) => `<text class="rgt" x="${X(v)}" y="${pad + H + 14}" text-anchor="${j === 0 ? 'start' : j === 2 ? 'end' : 'middle'}">${Math.round(v)}</text>`).join('')}`;
    rows.forEach((r, i) => {
      const y = pad + i * rowH + rowH / 2 - 4; const v = ax.get(r);
      const cols = (ax.cols(r) ?? []).map((c) => (c.column ? `${c.file}, column "${c.column}"` : `${c.fixed} (${c.why})`)).join('; ');
      if (!v) { out += `<text class="rgna" x="${x0 + 4}" y="${y + 4}">not in table</text>`; return; }
      const tip = `<b>${esc(nmid(r.psi_id))}</b>: ${ax.key === 'o2' ? 'O2' : 'pressure'} ${v[0]}–${v[1]} ${ax.key === 'o2' ? '%' : 'kPa'} (min–max over the table's condition columns)`;
      out += v[0] === v[1]
        ? `<circle class="rgpt" cx="${X(v[0])}" cy="${y}" r="${barH / 2}" tabindex="0" data-tip="${esc(tip)}" data-src="${esc(cols)}"/>`
        : `<rect class="rgbar" x="${X(v[0])}" y="${y - barH / 2}" width="${Math.max(3, X(v[1]) - X(v[0]))}" height="${barH}" rx="3" tabindex="0" data-tip="${esc(tip)}" data-src="${esc(cols)}"/>`;
    });
    if (narrow || k === 0) rows.forEach((r, i) => { out += `<text class="rgid" x="0" y="${pad + i * rowH + rowH / 2 - 2}">${esc(nm(r.psi_id))}<title>${esc(nmid(r.psi_id))}</title></text><text class="rgpid" x="0" y="${pad + i * rowH + rowH / 2 + 11}">${esc(r.psi_id)}</text>`; });
    out += '</g>';
  });
  const H = narrow ? 2 * blockH - 10 : pad + rows.length * rowH + 20;
  return `<svg class="rangebars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Tested O2 and pressure ranges against ${win.name}: ${win.text}`)}">${out}
</svg>`;
}

// ---------- Habitat Gaps: coverage strip ----------
export const RULES = [['solid_window', 'Solid tests in this air'], ['flow', 'More than 2 airflows'], ['materials', 'More than 2 materials'], ['boundary', 'Boundary at this pressure'], ['gravity', 'This gravity tested']];
// Habitats with the same window and the same gaps share a row (Moon base and pressurized rover).
export function mergedHabitats(gaps) {
  const out = [];
  for (const h of gaps.habitats) {
    const sig = `${h.window}|${h.habitat.gravity}|${h.gaps.map((g) => g.text.replace(h.habitat.name, '')).join('|')}`;
    const m = out.find((x) => x.sig === sig);
    if (m) m.also.push(h); else out.push({ sig, h, also: [] });
  }
  return out.map(({ h, also }) => ({ h, also, name: [h, ...also].map((x) => x.habitat.name).join(' & ') }));
}
export function coverageHTML(gaps, { links = true } = {}) {
  const rows = mergedHabitats(gaps);
  return `<div class="table-wrap"><table class="cover"><thead><tr><th>Crew air</th>${RULES.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(({ h, name }) => `<tr><th scope="row"><a href="#gaps/${esc(h.habitat.id)}">${esc(name)}</a><small>${esc(h.window)}</small></th>${RULES.map(([id]) => {
      const g = h.gaps.find((x) => x.id === id);
      const cov = h.covered.find((x) => x.id === id);
      const tip = g ? g.text : cov ? cov.text : 'No gap under this rule.';
      const src = g?.evidence?.length ? g.evidence.map((e) => [e.doc, e.locator, e.printed_page && `p.${e.printed_page}`].filter(Boolean).join(', ')).join(' | ') : 'gaps.json (scripts/05_build_gaps.py rules)';
      const body = g ? '<span class="cv-x" aria-hidden="true">✕</span> gap' : '<span class="cv-ok" aria-hidden="true">✓</span> covered';
      return `<td class="${g ? 'cgap' : 'cok'}">${g && links ? `<a href="#evidence/gap=${esc(h.habitat.id)}.${esc(id)}" data-tip="${esc(tip)}" data-src="${esc(src)}">${body}</a>` : `<span data-tip="${esc(tip)}" data-src="${esc(src)}" tabindex="0">${body}</span>`}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ---------- FLEX suppressant map ----------
export function suppSVG(flex, win, { narrow = false } = {}) {
  const W = narrow ? 360 : 640; const Hh = narrow ? 300 : 340; const l = 44; const r = 12; const t = 12; const b = 40;
  const tests = flex.tests.filter((x) => (x.co2_frac ?? 0) > 0 || (x.he_frac ?? 0) > 0);
  const pMax = Math.ceil(Math.max(...tests.map((x) => x.pressure_kpa)) / 50) * 50; const oMax = 40;
  const X = (p) => l + (p / pMax) * (W - l - r); const Y = (o) => Hh - b - (o / oMax) * (Hh - t - b);
  const pct = (x) => `${+(x * 100).toFixed(1)}%`;
  const dots = tests.map((x) => {
    const gas = [x.co2_frac ? `CO2 ${pct(x.co2_frac)}` : '', x.he_frac ? `He ${pct(x.he_frac)}` : ''].filter(Boolean).join(', ');
    return `<circle class="sp ${x.co2_frac ? 'co2' : 'he'}" cx="${X(x.pressure_kpa).toFixed(1)}" cy="${Y(x.o2_pct).toFixed(1)}" r="3.6" data-tip="${esc(`<b>FLEX test ${x.id}</b>: ${x.fuel} droplet, ${x.o2_pct}% O2 at ${x.pressure_kpa} kPa, ${gas}; ended in ${String(x.test_end).toLowerCase()}`)}" data-src="${esc(`${x.source.file}, line ${x.source.line}`)}"/>`;
  }).join('');
  const grid = [0, 10, 20, 30, 40].map((o) => `<line class="ag" x1="${l}" x2="${W - r}" y1="${Y(o)}" y2="${Y(o)}"/><text class="at" x="${l - 6}" y="${Y(o) + 4}" text-anchor="end">${o}</text>`).join('')
    + Array.from({ length: pMax / 50 + 1 }, (_, i) => i * 50).filter((p, i) => !narrow || i % 2 === 0).map((p) => `<text class="at" x="${X(p)}" y="${Hh - b + 16}" text-anchor="middle">${p}</text>`).join('');
  const zone = `<rect class="spzone" x="${X(0)}" y="${Y(oMax)}" width="${X(win.p[1]) - X(0)}" height="${Y(win.o2[0]) - Y(oMax)}" data-tip="${esc(`<b>${win.name}</b>: ${win.text}. 0 FLEX suppressant tests inside.`)}" data-src="NASA Space Apps 2026 challenge page, Flame in Freefall"/>
    ${narrow ? `<text class="spzl" x="${X(win.p[1]) + 5}" y="${Y(oMax) + 14}">${esc(win.name)}</text>`
    : `<text class="spzl" x="${X(win.p[1] / 2)}" y="${Y(oMax) + 16}" text-anchor="middle">${esc(win.name)}</text>`}`;
  return `<svg class="atmos supp" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(`${tests.length} FLEX tests with CO2 or helium, by O2 and pressure; none inside ${win.name} air.`)}">
    ${grid}${zone}${dots}
    <text class="al" x="${(l + W - r) / 2}" y="${Hh - 4}" text-anchor="middle">Total pressure (kPa)</text>
    <text class="al" transform="translate(12 ${(t + Hh - b) / 2}) rotate(-90)" text-anchor="middle">O2 (%)</text></svg>
    <p class="splegend"><span><i class="sw sp-co2"></i>with CO2</span><span><i class="sw sp-he"></i>with helium (no CO2)</span> · ${tests.length} of ${flex.count} FLEX tests, liquid droplets</p>`;
}
