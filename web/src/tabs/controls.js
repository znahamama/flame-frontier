import { loadJSON } from '../data.js';
import { suppSVG } from '../viz/explore.js';
import { loadNames, nm, nameHTML } from '../names.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (f) => String(f ?? '').split('/').slice(-1)[0];
const pct = (x) => `${+(x * 100).toFixed(1)}%`;
const GAPNAME = { solid_window: 'no solid test', flow: 'airflow gap', materials: 'materials gap', boundary: 'boundary gap', gravity: 'partial-gravity gap' };
const KIND = { per_test: 'per-test table', summary: 'summary table only', none: 'no table' };

// Challenge objective 3 (prevention, detection, suppression). Every quote is checked and every count computed by
// scripts/06_build_controls.py; the connecting words here are fixed templates. No AI text.
function srcOf(q) {
  if (q.basis === 'brief') return { label: 'challenge page', title: 'docs/ref/challenge_brief.md, sec. 1 (verbatim challenge page)' };
  return { label: `${q.src.key}, ${short(q.src.file)} L${q.src.line}`, title: `${q.src.file}, line ${q.src.line}` };
}

function investigation(i) {
  return `<li>${nameHTML(i.psi_id, { tag: 'b' })} <span class="muted">${esc(i.title)}</span>
    <span class="badge" title="${esc(i.table.what)}">${esc(KIND[i.table.kind] ?? i.table.kind)}</span>
    ${i.doi ? `<a href="https://doi.org/${esc(i.doi)}" target="_blank" rel="noopener">DOI</a>` : ''}
    ${i.quotes.some((q) => q.basis === 'brief') ? `<span class="badge" title="${esc(i.quotes.find((q) => q.basis === 'brief').quote)}">named by the challenge page</span>` : ''}
    <ul class="ctl-quotes">${i.quotes.filter((q) => q.basis !== 'brief').map((q) => {
      const s = srcOf(q);
      return `<li><span class="muted">${esc(q.relation)}:</span> "${esc(q.quote)}" <span class="src" title="${esc(s.title)}">${esc(s.label)}</span></li>`;
    }).join('')}</ul></li>`;
}

function extreme(x) {
  const gas = [x.co2 ? `CO2 ${pct(x.co2)}` : '', x.he ? `He ${pct(x.he)}` : ''].filter(Boolean).join(', ');
  return `<li>${esc(x.what)}: FLEX test ${esc(x.id)}, ${esc(x.o2)}% O2 at ${esc(x.p_kpa)} kPa, ${esc(gas)}, ${esc(x.fuel.toLowerCase())}, ended in ${esc(x.end.toLowerCase())}
    <span class="src" title="${esc(`${x.src.file}, line ${x.src.line}`)}">${esc(short(x.src.file))} L${esc(x.src.line)}</span></li>`;
}

function role(r, win, flex) {
  const m = r.moon;
  return `<section class="card ctl" id="ctl-${esc(r.id)}" aria-labelledby="ctl-h-${esc(r.id)}">
    <h2 id="ctl-h-${esc(r.id)}">${esc(r.name)}</h2>
    <blockquote>"${esc(r.brief_quote)}" <span class="src">challenge page</span></blockquote>
    ${[...new Set(r.investigations.flatMap((i) => i.quotes.filter((q) => q.basis === 'brief').map((q) => q.quote)))].filter((q) => q !== r.brief_quote)
      .map((q) => `<blockquote>"${esc(q)}" <span class="src">challenge page</span></blockquote>`).join('')}
    <div class="ctl-moon">
      <h3>For a Moon base <span class="muted">(${esc(win.text)})</span></h3>
      <p>${esc(m.text)}</p>
      ${m.gaps?.length ? `<p class="gapchips">${m.gaps.map((g) => `<a class="gapchip" href="${esc(g.href)}" data-tip="${esc(g.text)}" data-src="gaps.json (Habitat Gaps rules)">✕ ${esc(GAPNAME[g.id] ?? g.id)}</a>`).join('')}</p>` : ''}
      ${r.id === 'suppression' && flex ? `<figure class="suppfig">${suppSVG(flex, win)}</figure>` : ''}
      ${r.extremes?.length ? `<details class="more"><summary>Closest suppressant tests to that air (${r.extremes.length})</summary><ul class="note">${r.extremes.map(extreme).join('')}</ul></details>` : ''}
      ${m.links.length ? `<p>${m.links.map((l) => `<a class="maplink" href="${esc(l.href)}">${esc(l.label)} →</a>`).join(' ')}</p>` : ''}
    </div>
    <details class="more"><summary>What the PSI tables hold (${r.facts.length} facts)</summary>
    <ul class="ctl-facts">${r.facts.map((f) => `<li><span class="ctl-val">${esc(f.value)}</span>
      <span class="ctl-label">${esc(f.label)}</span>
      <span class="ctl-detail">${esc(f.detail)}</span>
      ${f.note ? `<span class="ctl-detail"><i>${esc(f.note)}</i></span>` : ''}
      <span class="src" title="${esc(f.src)}">${esc(f.src)}</span></li>`).join('')}</ul></details>
    <details class="ctl-invs"><summary><h3>Investigations that inform it (${r.investigations.length})</h3> <span class="muted">${r.investigations.map((i) => esc(nm(i.psi_id))).join(', ')}</span></summary>
    <ul class="related ctl-inv">${r.investigations.map(investigation).join('')}</ul></details>
    <p>${r.compare.length >= 2 ? `<a class="maplink" href="#compare/${r.compare.map(esc).join(',')}">Compare ${r.compare.map((x) => esc(nm(x))).join(', ')} →</a>` : ''}
      ${r.earth ? `<a class="maplink" href="#earth">On Earth: ${esc(r.earth.title)} →</a>` : ''}</p>
  </section>`;
}

export async function render(root) {
  const [d, flex, ref] = await Promise.all([loadJSON('controls.json'), loadJSON('flex_tests.json'), loadJSON('reference.json'), loadNames()]);
  const z = ref.panel1.moon_base_zone;
  const win = { ...d.window, o2: [z.o2_min_pct, 100], p: [0, z.p_max_kpa] };
  root.innerHTML = `<section class="card"><h2>Fire safety controls: prevent, detect, suppress</h2>
    <blockquote>"${esc(d.intro.quote)}" <span class="src">challenge page</span></blockquote>
    <p class="note">For each of the three, the PSI investigations that inform it (linked only where the challenge page or the investigation's own
      PSI record says so, quoted), what their experimental tables actually hold, and where that leaves a ${esc(d.window.name)} (${esc(d.window.text)}).
      Counts are computed from the PSI files; the sentences are fixed templates, not AI text.</p>
    <nav class="ctl-jump" aria-label="Jump to a role">${d.roles.map((r) => `<button type="button" data-to="ctl-${esc(r.id)}">${esc(r.name)}</button>`).join('')}</nav>
  </section>
  ${d.roles.map((r) => role(r, win, flex)).join('')}`;
  // In-page jumps without touching the hash (the hash names the tab).
  root.querySelector('.ctl-jump').addEventListener('click', (e) => {
    const id = e.target.closest('button')?.dataset.to;
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });
}
