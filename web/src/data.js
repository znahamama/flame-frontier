// All UI data comes from data/processed via /data/*. Fails loudly: no silent fallbacks.
const cache = new Map();
export async function loadJSON(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`/data/${name}`).then((r) => {
      if (!r.ok) throw new Error(`/data/${name}: HTTP ${r.status}. Run "make data".`);
      return r.json();
    }));
  }
  return cache.get(name);
}

export function cite(src) {
  if (!src) return 'SOURCE MISSING';
  if (typeof src === 'string') return src;
  const parts = [src.doc, src.section && `sec. ${src.section}`, src.equation_no && `eq. ${src.equation_no}`,
    src.printed_page && `p. ${src.printed_page}`, src.file && src.row != null && `${src.file} row ${src.row}`];
  return parts.filter(Boolean).join(', ');
}
