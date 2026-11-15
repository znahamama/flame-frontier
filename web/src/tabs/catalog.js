import { loadJSON } from '../data.js';
import { tilesHTML } from '../viz/explore.js';

let mode = 'tiles';   // 'tiles' | 'table' (kept while the page is open)

// Catalog: every value is quoted from PSI ISA-Tab metadata (file + line + key) or derived from files on disk.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (p) => p.split('/').slice(-2).join('/');
const srcText = (s) => (s ? `${s.file}, line ${s.line}, ${s.key}` : 'not in metadata');
const srcTag = (s) => `<span class="src" title="${esc(srcText(s))}">${s ? `${esc(short(s.file))} L${s.line}` : 'not in metadata'}</span>`;
const cell = (v, s) => `<td title="${esc(srcText(s))}">${v == null || v === '' ? '<span class="muted">—</span>' : esc(v)}</td>`;

function testLevel(c) {
  if (!c.tables.length) return { short: 'No', long: 'No experimental table in our PSI download.' };
  const long = c.tables.map((t) => `${t.file}: ${t.kind_reason}`).join(' | ');
  if (c.test_level === 'yes') return { short: `Yes: ${c.test_rows} per-test rows`, long };
  return { short: `Summary only: ${c.summary_rows} rows`, long };
}

function card(c) {
  const f = c.fields;
  const row = (k) => (f[k].value ? `<dt>${esc(f[k].label)} ${srcTag(f[k].source)}</dt><dd>${esc(f[k].value)}</dd>` : '');
  const tl = testLevel(c);
  const pubs = c.publications.value;
  return `<details class="inv" id="${esc(c.psi_id)}"><summary><b>${esc(c.psi_id)}</b> ${esc(f.title.value)}</summary>
    <dl>
      ${['objective', 'approach', 'hypothesis', 'impacts', 'hardware', 'platform', 'center', 'area', 'subarea', 'released', 'doi'].map(row).join('')}
      <dt>Keywords ${srcTag(c.keywords.source)}</dt><dd>${c.keywords.value.map(esc).join(' · ')}</dd>
      <dt>People and roles ${srcTag(c.people.source)}</dt><dd>${c.people.value.map((p) => `${esc(p.name)} (${esc(p.role ?? 'no role given')})`).join(', ')}</dd>
      <dt>Publications ${srcTag(c.publications.source)}</dt><dd>${pubs.length} listed, ${pubs.filter((p) => p.doi).length} with a DOI
        <ul class="pubs">${pubs.map((p) => `<li>${esc(p.title)}${p.doi ? ` <a href="https://doi.org/${encodeURI(p.doi)}" target="_blank" rel="noopener">doi:${esc(p.doi)}</a>` : ''}</li>`).join('')}</ul></dd>
      <dt>Test-level data on disk <span class="src">our check of data/raw</span></dt><dd>${esc(tl.short)}${c.tables.map((t) => `<br><small>${esc(t.file)} (${t.data_rows} data rows, ${t.columns.length} columns: ${esc(t.columns.join(', '))}). ${esc(t.kind_reason)}</small>`).join('')}</dd>
    </dl></details>`;
}

export async function render(root, arg) {
  const [cat, controls] = await Promise.all([loadJSON('catalog.json'), loadJSON('controls.json')]);
  const cov = cat.coverage;
  const inv = cat.investigations;
  const n = (lvl) => cov.slots.filter((x) => x.test_level === lvl).length;
  const gone = cov.slots.filter((x) => !x.on_disk);

  root.innerHTML = `
    <section class="card"><h2>Catalog</h2>
      <p class="headline">${cov.on_disk === cov.combustion_total ? `All ${cov.combustion_total}` : `${cov.on_disk} of the ${cov.combustion_total}`} PSI combustion investigations are catalogued. ${n('yes')} have per-test data; ${n('summary only')} have summary tables only; ${n('no')} have no experimental table.</p>
      <div class="seg viewmode" role="group" aria-label="Show as"><button type="button" data-m="tiles">Tiles</button><button type="button" data-m="table">Table</button></div>
      <div id="cat-tiles">${tilesHTML(cat, controls)}
      <p class="note"><span class="key2 tests"></span> per-test table on disk · <span class="key2 summary"></span> summary table only · <span class="key2 none"></span> no experimental table${gone.length ? ` · not downloaded: ${gone.map((x) => esc(x.psi_id)).join(', ')}` : ''}.
        Badges: <span class="rb rb-prevention">P</span> prevent, <span class="rb rb-detection">D</span> detect, <span class="rb rb-suppression">S</span> suppress, where the challenge page or the PSI record links the investigation to that role (<a href="#controls">Prevent · Detect · Suppress</a>). Open a tile for its full record.</p></div>
      <p class="note">The ${cov.combustion_total} come from the PSI Combustion Science index (${esc(cov.index_source.file)}); the count matches the challenge video (${esc(cov.combustion_total_source.locator)}: "${esc(cov.combustion_total_source.quote)}").
        ${cov.index_rows_not_combustion.length ? `Left out: ${cov.index_rows_not_combustion.map((r) => `${esc(r.psi_id)} (${esc(r.research_area)})`).join(', ')}.` : ''}</p>
      <div id="cat-table">
      <div class="table-wrap"><table class="cat">
        <thead><tr><th>PSI ID</th><th>Investigation</th><th>Type</th><th>Platform</th><th>Hardware</th><th>PI</th><th>Released</th><th>Publications</th><th>Test-level data?</th></tr></thead>
        <tbody>${inv.map((c) => {
          const f = c.fields; const tl = testLevel(c);
          return `<tr><td class="id"><a href="#catalog" data-open="${esc(c.psi_id)}">${esc(c.psi_id)}</a></td>${cell(f.title.value, f.title.source)}${cell(c.index_type?.value?.replace(' Investigation', ''), c.index_type?.source)}${cell(f.platform.value, f.platform.source)}${cell(f.hardware.value, f.hardware.source)}
            ${cell(c.pi.value.join(', ') || null, c.pi.source)}${cell(f.released.value, f.released.source)}${cell(`${c.publications.value.length} (${c.publications.value.filter((p) => p.doi).length} DOI)`, c.publications.source)}
            <td title="${esc(tl.long)}" class="${c.test_level === 'yes' ? 'yes' : ''}">${esc(tl.short)}</td></tr>`;
        }).join('')}</tbody></table></div>
      <p class="note">Hover any cell for its source (file, line, ISA-Tab key). An empty PI cell means the metadata assigns no PI role. "Test-level data?" reflects the files in our PSI download, not everything on PSI.</p></div>
    </section>
    <section class="card"><h2>Investigation details</h2>
      <p class="note">Verbatim from each investigation's PSI metadata (i_Investigation.txt). Each field shows its file and line. Contact details are not shown.</p>
      ${inv.map(card).join('')}
    </section>`;
  const setMode = (m) => {
    mode = m;
    root.querySelector('#cat-tiles').hidden = m !== 'tiles'; root.querySelector('#cat-table').hidden = m !== 'table';
    root.querySelectorAll('.viewmode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
  };
  root.querySelectorAll('.viewmode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
  setMode(mode);
  // #catalog/<PSI-ID>: open that investigation's full record (the drawer) and bring it into view.
  const want = /^PSI-\d+$/.test(arg ?? '') && root.querySelector(`#${CSS.escape(arg)}`);
  if (want) { want.open = true; want.dataset.goto = ''; want.tabIndex = -1; }
  root.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const d = root.querySelector(`#${CSS.escape(a.dataset.open)}`);
    d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}
