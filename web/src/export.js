import { loadJSON } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Download links for the evidence export (scripts/05_build_export.py -> data/processed/export/). Counts come from its manifest.
export async function exportLinks() {
  const m = await loadJSON('export/manifest.json');
  return m.files.map((f) => `<a href="/data/export/${esc(f.file)}" download>${esc(f.file)}</a>${f.rows != null ? ` (${f.rows} rows)` : ''}: ${esc(f.what)}`);
}
