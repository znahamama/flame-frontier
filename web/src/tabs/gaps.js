import { loadJSON } from '../data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const srcText = (s) => (s ? [s.doc, s.locator, s.printed_page && `p.${s.printed_page}`, s.file, s.line != null && `line ${s.line}`].filter(Boolean).join(', ') : '');

// Habitat gap report: every sentence is a template filled from gaps.json (scripts/05_build_gaps.py). No AI text.
export async function render(root) {
  const [g, rank] = await Promise.all([loadJSON('gaps.json'), loadJSON('ranking.json')]);
  const S = rank.sources;
  const tgt = (t) => `"${esc(t.quote)}" <span class="src">${esc(S[t.source]?.short ?? t.source)}${t.page ? `, p.${t.page}` : ''}</span>`;
  root.innerHTML = `<section class="card"><h2>Habitat gap report</h2>
    <p class="note">For each crew environment: the target atmosphere, what was tested there, and where the data runs out. ${esc(g.note)}
    "Show on map" opens the Evidence Map with that region highlighted.</p></section>
    ${g.habitats.map((h) => `<section class="card habitat" id="gap-${esc(h.habitat.id)}">
      <h2>${esc(h.habitat.name)}: ${esc(h.window)}, ${h.habitat.gravity === 'micro' ? 'microgravity' : 'partial gravity'}</h2>
      <details class="targets"><summary>Where the target comes from</summary><ul class="note">
        <li>O2: ${tgt(h.target_sources.o2)}</li><li>Pressure${h.target_sources.p.as_stated ? ` (${esc(h.target_sources.p.as_stated)})` : ''}: ${tgt(h.target_sources.p)}</li>
        <li>Gravity: ${tgt(h.target_sources.gravity)}${h.target_sources.gravity.note ? ` <i>${esc(h.target_sources.gravity.note)}</i>` : ''}</li></ul></details>
      <p class="tested"><b>${h.tested.solids_inside}</b> solid-material test${h.tested.solids_inside === 1 ? '' : 's'} in this window${h.tested.solids_inside ? ` (${h.tested.materials.length} material${h.tested.materials.length === 1 ? '' : 's'})` : ''}.
        <span class="muted">${esc(h.context[0])}</span></p>
      ${h.gaps.length ? `<h3>Gaps in the data (${h.gaps.length})</h3><ol class="gaps">${h.gaps.map((x) => `<li><span>${esc(x.text)}</span>
        ${x.detail ? `<br><small class="muted">${esc(x.detail)}</small>` : ''}
        ${x.evidence?.length ? `<br><span class="src" title="${esc(x.evidence.map(srcText).join(' | '))}">${esc(srcText(x.evidence[0]))}${x.evidence.length > 1 ? ` +${x.evidence.length - 1}` : ''}</span>` : ''}
        <a class="maplink" href="#evidence/gap=${esc(h.habitat.id)}.${esc(x.id)}">Show on map →</a></li>`).join('')}</ol>`
        : '<p class="ok">No gap found by these rules.</p>'}
      ${h.covered.length ? `<details><summary>What is covered (${h.covered.length})</summary><ul class="note">${h.covered.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul></details>` : ''}
    </section>`).join('')}`;
}
