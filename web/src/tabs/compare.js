import { loadJSON } from '../data.js';
import { rangeBarsSVG } from '../viz/explore.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (f) => (f ? f.split('/').slice(-1)[0] : '');
const LONG = new Set(['objective', 'measurements']);

// One source entry -> readable text (file + line/key/column, or a note).
function srcText(s) {
  if (!s) return 'no source';
  const one = (x) => [x.file, x.line != null && `line ${x.line}`, x.key, x.column && `column "${x.column}"`, x.where && `quote found in the ${x.where}`, x.note]
    .filter(Boolean).join(', ');
  return Array.isArray(s) ? s.map(one).join(' | ') : one(s);
}
const srcTag = (s) => {
  const first = Array.isArray(s) ? s[0] : s;
  return `<span class="src" title="${esc(srcText(s))}">${esc(first?.file ? `${short(first.file)}${first.line != null ? ` L${first.line}` : ''}` : 'source')}${Array.isArray(s) && s.length > 1 ? ` +${s.length - 1}` : ''}</span>`;
};

function cellHTML(cell, rowKey) {
  if (!cell.text) return `<span class="muted">${esc(cell.missing ?? 'Not in metadata')}</span>${cell.src ? ` ${srcTag(cell.src)}` : ''}`;
  const body = LONG.has(rowKey) && cell.text.length > 180
    ? `<details><summary>${esc(cell.text.slice(0, 160))}…</summary>${esc(cell.text)}</details>` : esc(cell.text);
  return `${body}${cell.quote ? `<br><small>"${esc(cell.quote)}"</small>` : ''}${cell.flag ? `<br><small class="flag">${esc(cell.flag)}</small>` : ''} ${srcTag(cell.src)}`;
}

export async function render(root, arg) {
  const [d, rank] = await Promise.all([loadJSON('compare.json'), loadJSON('ranking.json')]);
  const moonH = rank.habitats.find((h) => h.habitat.id === 'moon_base') ?? rank.habitats[0];
  const win = { name: moonH.habitat.name, text: `≥${moonH.habitat.o2_pct[0]}% O2 at ≤${moonH.habitat.p_kpa[1]} kPa`, o2: moonH.habitat.o2_pct, p: moonH.habitat.p_kpa };
  const rowOf = Object.fromEntries(moonH.rows.map((r) => [r.psi_id, r]));
  const by = Object.fromEntries(d.investigations.map((i) => [i.psi_id, i]));
  const fromHash = (arg ?? '').split(',').filter((x) => by[x]);
  let sel = fromHash.length >= 2 ? fromHash.slice(0, 3) : [...d.default];
  const opts = (cur, allowNone) => `${allowNone ? `<option value="">(none)</option>` : ''}${d.investigations.map((i) =>
    `<option value="${esc(i.psi_id)}" ${i.psi_id === cur ? 'selected' : ''}>${esc(i.psi_id)}: ${esc(i.title.length > 60 ? `${i.title.slice(0, 58)}…` : i.title)}</option>`).join('')}`;

  root.innerHTML = `<section class="card"><h2>Compare investigations</h2>
    <p class="note">Pick two or three of the ${d.investigations.length} PSI combustion investigations. Rows marked <span class="diffkey">differs</span> have different values across your picks. Hover a grey tag for its exact source. ${esc(d.note)}</p>
    <div class="pickers">${[0, 1, 2].map((k) => `<label>Investigation ${k + 1}<select data-k="${k}">${opts(sel[k], k === 2)}</select></label>`).join('')}</div>
    <div id="cmp"></div></section>`;

  const draw = () => {
    const picks = sel.filter(Boolean).map((p) => by[p]);
    const rows = d.rows.map((r) => {
      const keys = picks.map((i) => i.cells[r.key].key);
      const differs = keys.every((k) => k != null) && new Set(keys).size > 1;
      return `<tr class="${differs ? 'diff' : ''}"><th scope="row">${esc(r.label)}${differs ? ' <span class="diffkey">differs</span>' : ''}</th>
        ${picks.map((i) => `<td data-label="${esc(i.psi_id)}">${cellHTML(i.cells[r.key], r.key)}</td>`).join('')}</tr>`;
    }).join('');
    const rr = picks.map((i) => rowOf[i.psi_id]).filter(Boolean);
    root.querySelector('#cmp').innerHTML = `<figure class="rangefig">${rangeBarsSVG(rr, win, { narrow: root.clientWidth < 560 })}<figcaption class="note">Tested ranges (min–max of each table's O2 and pressure columns, from ranking.json) against ${esc(win.name)} air (shaded: ${esc(win.text)}). Hover a bar for the columns it comes from.</figcaption></figure><div class="scroll"><table class="compare"><thead><tr><th></th>${picks.map((i) =>
      `<th scope="col">${esc(i.psi_id)}<br><span class="coltitle">${esc(i.title)}</span></th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
    history.replaceState(null, '', `#compare/${sel.filter(Boolean).join(',')}`);
  };
  root.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => {
    sel[Number(s.dataset.k)] = s.value;
    if (sel.filter(Boolean).length < 2) { sel[Number(s.dataset.k)] = d.default.find((x) => !sel.includes(x)); s.value = sel[Number(s.dataset.k)]; }
    draw();
  }));
  draw();
}
