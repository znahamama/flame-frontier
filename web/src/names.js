// Short investigation names (names.json, built by scripts/02_build_names.py): the challenge page's name, else the
// acronym PSI prints after the title, else (5 ground studies with no acronym) our label from the title's words.
// Names lead; the PSI number follows, small. The full PSI title stays in the hover text.
import { loadJSON } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let N = null;
export async function loadNames() { N ??= (await loadJSON('names.json')).names; return N; }
/** Short name, plain text ("BASS-II"); the PSI ID if names are not loaded. */
export const nm = (id) => N?.[id]?.short ?? id;
/** Full PSI title (without the acronym). */
export const fullTitle = (id) => N?.[id]?.title ?? '';
/** "BASS-II PSI-25" as text (for aria labels, tooltips, option text). */
export const nmid = (id) => (N?.[id] ? `${N[id].short} (${id})` : id);
/** HTML: short name first, PSI number small and secondary, full title on hover. */
export function nameHTML(id, { tag = 'span', cls = '' } = {}) {
  const n = N?.[id];
  if (!n) return `<${tag} class="iname ${cls}">${esc(id)}</${tag}>`;
  const tip = `${n.title}${n.basis === 'our_label' ? ' (short label ours: PSI gives no acronym)' : ''}`;
  return `<${tag} class="iname ${cls}" title="${esc(tip)}"><span class="in-s">${esc(n.short)}</span> <small class="in-id">${esc(id)}</small></${tag}>`;
}
