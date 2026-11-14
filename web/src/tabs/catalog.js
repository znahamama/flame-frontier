import { loadJSON } from '../data.js';

// Catalog: every value is quoted from PSI ISA-Tab metadata (file + line + key) or derived from files on disk.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (p) => p.split('/').slice(-2).join('/');
const srcText = (s) => (s ? `${s.file}, line ${s.line}, ${s.key}` : 'not in metadata');
const srcTag = (s) => `<span class="src" title="${esc(srcText(s))}">${s ? `${esc(short(s.file))} L${s.line}` : 'not in metadata'}</span>`;
const cell = (v, s) => `<td title="${esc(srcText(s))}">${v == null || v === '' ? '<span class="muted">—</span>' : esc(v)}</td>`;

function testLevel(c) {
  if (!c.tables.length) return { short: 'No', long: 'No experimental table in our PSI download.' };
  const t = c.tables[0];
  const what = t.kind === 'per_test' ? 'per-test rows' : t.kind === 'summary' ? 'summary rows' : 'rows (unreviewed)';
  return { short: `${c.test_level === 'yes' ? 'Yes' : 'Summary only'}: ${t.test_rows} ${what}`, long: `${t.file}: ${t.kind_reason}` };
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

export async function render(root) {
  const cat = await loadJSON('catalog.json');
  const cov = cat.coverage;
  const inv = cat.investigations;
  const missing = cov.named_in_brief.filter((n) => !n.on_disk);
  const notDownloaded = cov.combustion_total - inv.length;
  const slots = Array.from({ length: cov.combustion_total }, (_, i) => `<span class="slot ${i < inv.length ? 'have' : ''}" title="${i < inv.length ? esc(`${inv[i].psi_id}: ${inv[i].fields.title.value}`) : 'not downloaded yet'}"></span>`).join('');

  root.innerHTML = `
    <section class="card"><h2>Catalog</h2>
      <p class="headline">We have ${inv.length} of the ${cov.combustion_total} PSI combustion investigations. ${notDownloaded} are not downloaded yet.</p>
      <div class="slots" role="img" aria-label="${inv.length} of ${cov.combustion_total} investigations on disk">${slots}</div>
      <p class="note">Total of ${cov.combustion_total}: ${esc(cov.combustion_total_source.doc)} ${esc(cov.combustion_total_source.locator)}, "${esc(cov.combustion_total_source.quote)}".</p>
      <p class="note"><b>Named in the challenge brief but not downloaded:</b> ${missing.map((n) => `<span class="chip" title="${esc(`Brief: "${n.quote}"${n.note ? ` · ${n.note}` : ''}`)}">${esc(n.name)}${n.note ? '*' : ''}</span>`).join(' ')}</p>
      <p class="note">${esc(cov.note)} *May not be filed under Combustion Science.</p>
      <div class="table-wrap"><table class="cat">
        <thead><tr><th>PSI ID</th><th>Investigation</th><th>Platform</th><th>Hardware</th><th>PI</th><th>Released</th><th>Publications</th><th>Test-level data?</th></tr></thead>
        <tbody>${inv.map((c) => {
          const f = c.fields; const tl = testLevel(c);
          return `<tr><td class="id"><a href="#catalog" data-open="${esc(c.psi_id)}">${esc(c.psi_id)}</a></td>${cell(f.title.value, f.title.source)}${cell(f.platform.value, f.platform.source)}${cell(f.hardware.value, f.hardware.source)}
            ${cell(c.pi.value.join(', ') || null, c.pi.source)}${cell(f.released.value, f.released.source)}${cell(`${c.publications.value.length} (${c.publications.value.filter((p) => p.doi).length} DOI)`, c.publications.source)}
            <td title="${esc(tl.long)}" class="${c.test_level === 'yes' ? 'yes' : ''}">${esc(tl.short)}</td></tr>`;
        }).join('')}</tbody></table></div>
      <p class="note">Hover any cell for its source (file, line, ISA-Tab key). An empty PI cell means the metadata assigns no PI role. "Test-level data?" reflects the files in our PSI download, not everything on PSI.</p>
    </section>
    <section class="card"><h2>Investigation details</h2>
      <p class="note">Verbatim from each investigation's PSI metadata (i_Investigation.txt). Each field shows its file and line. Contact details are not shown.</p>
      ${inv.map(card).join('')}
    </section>`;
  root.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const d = root.querySelector(`#${CSS.escape(a.dataset.open)}`);
    d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}
