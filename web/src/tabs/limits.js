import { loadJSON } from '../data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Per-source "what this source does NOT give us", from data/manual/sources.json via the pipeline.
export async function render(root) {
  const ext = await loadJSON('external_tests.json');
  root.innerHTML = `<section class="card"><h2>Known Limits</h2>
    <p class="note">What each source cannot tell us. These limits are shown so nothing on the charts implies more than the sources say.</p>
    ${Object.values(ext.sources).map((s) => `<h3>${esc(s.short)}</h3><p class="note">${esc(s.citation)}</p>
      <p><b>Gives:</b> ${esc(s.gives)}</p><ul class="limits">${s.does_not_give.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}
  </section>`;
}
