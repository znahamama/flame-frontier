import { loadJSON } from '../data.js';

// Ranking: a visible rule table, no AI. Every score = sum of per-component points; each component has a template explanation.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const n = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0$/, ''));
const MAT = { solid: 'solid materials', liquid: 'liquid droplets', gas: 'gas flames', gas_emulating_solid: 'gas flames emulating solids', solid_smoke: 'solids heated for smoke', dust: 'dust' };
let current = null;
const ORDER = ['o2', 'pressure', 'flow', 'gravity', 'material', 'data'];

function srcLabel(id, d) {
  const s = d.sources[id];
  return s?.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.short)}</a>` : esc(s?.short ?? id);
}

function habitatCard(h, d) {
  const page = (p) => (p ? `, p.${p}` : '');
  return `<dl class="hab">
    <dt>O2</dt><dd>${h.o2_pct[0] === h.o2_pct[1] ? `${h.o2_pct[0]}%` : `${h.o2_pct[0]}–${h.o2_pct[1]}%`}: "${esc(h.o2_quote)}" (${srcLabel(h.o2_source, d)}${page(h.o2_page)})${h.o2_note ? ` <span class="muted">${esc(h.o2_note)}</span>` : ''}</dd>
    <dt>Pressure</dt><dd>${h.p_kpa[0] > 0 ? `${h.p_kpa[0]}–${h.p_kpa[1]}` : `≤ ${h.p_kpa[1]}`} kPa (${esc(h.p_as_stated)}): "${esc(h.p_quote)}" (${srcLabel(h.p_source, d)}${page(h.p_page)})</dd>
    <dt>Gravity</dt><dd>${h.gravity === 'micro' ? 'microgravity' : 'partial (lunar)'}: "${esc(h.gravity_quote)}" (${srcLabel(h.gravity_source, d)})${h.gravity_note ? ` <span class="muted">${esc(h.gravity_note)}</span>` : ''}</dd>
  </dl>`;
}

function headline(H) {
  const h = H.habitat;
  const j = H.joint_investigations;
  const solid = j.filter((x) => x.material === 'solid');
  const total = H.rows.length;
  if (!j.length) return `${esc(h.name)}: none of the ${total} PSI combustion investigations ran a test with both O2 and pressure inside this window.`;
  const list = j.map((x) => `${esc(x.psi_id)} (${x.n} test${x.n === 1 ? '' : 's'}, ${esc(MAT[x.material] ?? x.material)})`).join(', ');
  return `${esc(h.name)}: ${j.length} of the ${total} PSI combustion investigations ran a test with both O2 and pressure inside this window: ${list}. ${solid.length ? `${solid.length} used solid materials.` : 'None used solid materials.'}`;
}

function table(H, d) {
  const keys = ORDER.filter((k) => d.rules[k]);
  const max = d.max_score;
  const rows = H.rows.map((r) => {
    const parts = keys.map((k) => r.parts.find((p) => p.key === k));
    const cells = parts.map((p) => `<td class="num${p.points === 0 ? ' zero' : ''}" title="${esc(`${p.label}: ${p.why}`)}">${n(p.points)}</td>`).join('');
    const why = parts.map((p) => `<li><b>${esc(p.label)}</b> ${n(p.points)} of ${p.weight} (× ${p.factor}): ${esc(p.why)}</li>`).join('');
    const cols = [...r.o2_cols.map((c) => `O2: ${c.file}, column "${c.column}"`), ...r.p_cols.map((c) => (c.column ? `Pressure: ${c.file}, column "${c.column}"` : `Pressure: ${c.fixed} (${c.why})`)),
      ...r.excluded_cols.map((c) => `Not used: ${c.file}, column "${c.column}" (${c.why})`)];
    const joint = r.joint_rows.length ? `<p class="src">Tests inside both windows: ${r.joint_rows.slice(0, 8).map((x) => `${esc(x.file.split('/').pop())} line ${x.line} (${x.o2_pct}% O2, ${x.p_kpa} kPa)`).join('; ')}${r.joint_tests > 8 ? ` and ${r.joint_tests - 8} more` : ''}.</p>` : '';
    return `<tr class="rk" data-id="${esc(r.psi_id)}">
      <td class="num">${r.rank}</td>
      <td><button class="linkish" aria-expanded="false" title="${esc(r.title)}">${esc(r.psi_id)}</button> <span class="t">${esc(r.title)}</span></td>
      <td class="bar"><span style="width:${(100 * r.score) / max}%"></span><b>${n(r.score)}</b></td>
      ${cells}
      <td class="num">${r.joint_tests || '<span class="muted">0</span>'}</td></tr>
      <tr class="why" hidden><td></td><td colspan="${keys.length + 3}"><p class="t-full">${esc(r.title)}</p><ul>${why}</ul>${cols.length ? `<p class="src">${cols.map(esc).join('<br>')}</p>` : ''}${joint}
        ${r.notes.length ? `<p class="src">${r.notes.map(esc).join(' ')}</p>` : ''}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="rank">
    <thead><tr><th>#</th><th>Investigation</th><th>Score / ${max}</th>${keys.map((k) => `<th class="num" title="${esc(d.rules[k].rule)}">${esc(d.rules[k].label)}<br><small>max ${d.rules[k].weight}</small></th>`).join('')}<th class="num" title="Tests whose O2 and pressure were both inside the habitat's windows (per-test tables only).">Tests in both windows</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function rules(d) {
  return `<table class="rules"><thead><tr><th>Component</th><th class="num">Weight</th><th>Rule</th><th>Why it matters</th></tr></thead><tbody>
    ${ORDER.map((k) => d.rules[k]).map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${r.weight}</td><td>${esc(r.rule)}</td><td>${r.why ? `"${esc(r.why.quote)}" (${srcLabel(r.why.source, d)})` : '<span class="muted">our choice</span>'}</td></tr>`).join('')}
  </tbody></table>`;
}

function draw(root, d, id) {
  current = id;
  const H = d.habitats.find((h) => h.habitat.id === id) ?? d.habitats[0];
  root.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.h === H.habitat.id)));
  root.querySelector('#hab-body').innerHTML = `
    <p class="headline">${headline(H)}</p>
    ${habitatCard(H.habitat, d)}
    ${table(H, d)}
    <p class="note">Click an investigation for the explanation behind each number. Hover a number for its rule. "Tests in both windows" is counted from per-test tables only.</p>`;
  root.querySelectorAll('tr.rk button').forEach((b) => b.addEventListener('click', () => {
    const tr = b.closest('tr').nextElementSibling;
    tr.hidden = !tr.hidden;
    b.setAttribute('aria-expanded', String(!tr.hidden));
  }));
}

export async function render(root) {
  const d = await loadJSON('ranking.json');
  const want = new URLSearchParams(location.search).get('hab') ?? current ?? 'moon_base';
  root.innerHTML = `
    <section class="card"><h2>Ranking: which NASA tests match each habitat's air?</h2>
      <p class="note">Each PSI combustion investigation is scored against a habitat's O2, pressure and gravity with the fixed rules below. No AI is involved. ${esc(d.note)}</p>
      <div class="seg" role="group" aria-label="Habitat">${d.habitats.map((h) => `<button data-h="${esc(h.habitat.id)}">${esc(h.habitat.name)}</button>`).join('')}</div>
      <div id="hab-body"></div>
    </section>
    <section class="card"><h2>Rule table</h2>${rules(d)}
      <p class="note">Score = sum over components of weight × factor. Unknown values score 0, which is not evidence of safety. Ties are broken by the number of tests in both windows, then by PSI ID.</p></section>`;
  root.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => draw(root, d, b.dataset.h)));
  draw(root, d, want);
}
