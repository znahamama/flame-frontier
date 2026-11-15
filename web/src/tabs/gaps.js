import { loadJSON } from '../data.js';
import { coverageHTML, mergedHabitats } from '../viz/explore.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const srcText = (s) => (s ? [s.doc, s.locator, s.printed_page && `p.${s.printed_page}`, s.file, s.line != null && `line ${s.line}`].filter(Boolean).join(', ') : '');

// Habitat gap report: every sentence is a template filled from gaps.json (scripts/05_build_gaps.py). No AI text.
export async function render(root) {
  const [g, rank] = await Promise.all([loadJSON('gaps.json'), loadJSON('ranking.json')]);
  const S = rank.sources;
  const tgt = (t) => `"${esc(t.quote)}" <span class="src">${esc(S[t.source]?.short ?? t.source)}${t.page ? `, p.${t.page}` : ''}</span>`;
  // Habitats with the same window and the same gaps (Moon base, pressurized rover) share one card; both anchors stay.
  root.innerHTML = `<section class="card"><h2>Habitat gap report</h2>
    <p class="note">For each crew environment: the target atmosphere, what was tested there, and where the data runs out. ${esc(g.note)}
    "Show on map" opens the Evidence Map with that region highlighted.</p>
    ${coverageHTML(g)}
    <p class="note">✕ = a gap under that rule (click it to see it on the map); ✓ = no gap under that rule. Hover any cell for its sentence.</p></section>
    ${mergedHabitats(g).map(({ h, also, name }) => `<section class="card habitat" id="gap-${esc(h.habitat.id)}">${also.map((a) => `<span id="gap-${esc(a.habitat.id)}" class="anchor"></span>`).join('')}
      <h2>${esc(name)}: ${esc(h.window)}, ${h.habitat.gravity === 'micro' ? 'microgravity' : 'partial gravity'}</h2>
      ${also.length ? `<p class="note">${esc(also.map((a) => a.habitat.name).join(', '))} ${also.length === 1 ? 'has' : 'have'} the same target air and the same gaps as ${esc(h.habitat.name)}, so they share this card.</p>` : ''}
      <details class="targets"><summary>Where the target comes from</summary><ul class="note">
        ${[h, ...also].map((x) => `${also.length ? `<li><b>${esc(x.habitat.name)}</b></li>` : ''}<li>O2: ${tgt(x.target_sources.o2)}</li><li>Pressure${x.target_sources.p.as_stated ? ` (${esc(x.target_sources.p.as_stated)})` : ''}: ${tgt(x.target_sources.p)}</li>
        <li>Gravity: ${tgt(x.target_sources.gravity)}${x.target_sources.gravity.note ? ` <i>${esc(x.target_sources.gravity.note)}</i>` : ''}</li>`).join('')}</ul></details>
      <p class="tested"><b>${h.tested.solids_inside}</b> solid-material test${h.tested.solids_inside === 1 ? '' : 's'} in this window${h.tested.solids_inside ? ` (${h.tested.materials.length} material${h.tested.materials.length === 1 ? '' : 's'})` : ''}.
        <span class="muted">${esc(h.context[0])}</span></p>
      ${h.gaps.length ? `<h3>Gaps in the data (${h.gaps.length})</h3><ol class="gaps">${h.gaps.map((x) => `<li><span>${esc(x.text)}</span>
        ${x.detail ? `<br><small class="muted">${esc(x.detail)}</small>` : ''}
        ${x.evidence?.length ? `<br><span class="src" title="${esc(x.evidence.map(srcText).join(' | '))}">${esc(srcText(x.evidence[0]))}${x.evidence.length > 1 ? ` +${x.evidence.length - 1}` : ''}</span>` : ''}
        <a class="maplink" href="#evidence/gap=${esc(h.habitat.id)}.${esc(x.id)}">Show on map →</a>${also.map((a) => ` <a class="maplink" href="#evidence/gap=${esc(a.habitat.id)}.${esc(x.id)}">(${esc(a.habitat.name)}) →</a>`).join('')}</li>`).join('')}</ol>`
        : '<p class="ok">No gap found by these rules.</p>'}
      ${h.covered.length ? `<details><summary>What is covered (${h.covered.length})</summary><ul class="note">${h.covered.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul></details>` : ''}
    </section>`).join('')}`;
}
