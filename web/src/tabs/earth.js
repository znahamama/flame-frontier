import { loadJSON } from '../data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (f) => String(f ?? '').split('/').slice(-1)[0];

// Earth applications: every quote is checked by scripts/05_build_earth.py; the connecting words are templates. No AI text.
// Small line icons per application (decorative; the title says what each is).
const ICON = {
  water_mist: '<path d="M12 3c3 4.5 5 7.3 5 10a5 5 0 0 1-10 0c0-2.7 2-5.5 5-10z"/><path d="M5 20h2M11 21h2M17 20h2"/>',
  fire_detector: '<circle cx="12" cy="9" r="6"/><circle cx="12" cy="9" r="1.6"/><path d="M6 18c1.5 1.5 3.5 2 6 2s4.5-.5 6-2"/>',
  air_tanks: '<rect x="8" y="5" width="8" height="16" rx="4"/><path d="M10 5V3h4v2M16 9h3v4"/>',
  fire_attire: '<path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/><path d="M8 15h8"/>',
};
const icon = (id) => `<svg class="eicon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[id] ?? '<circle cx="12" cy="12" r="8"/>'}</svg>`;

export async function render(root, arg) {
  const d = await loadJSON('earth_apps.json');
  root.innerHTML = `<section class="card"><h2>Fire safety on Earth</h2>
    <p class="note">The challenge page names these Earth uses of NASA fire-safety work. For each: the page's words, the NASA source it links,
      and the PSI investigations on the same topic, each with a quote from its own PSI metadata. A shared topic is not a claim of origin.</p>
    <ul class="ecards">${d.applications.map((a) => { const ids = [...new Set(a.related.map((x) => x.psi_id))]; return `<li><a href="#earth/${esc(a.id)}">${icon(a.id)}
      <span class="etheme">${esc(a.theme)}</span><b>${esc(a.title)}</b><span class="erel">${ids.length ? `${ids.length} related PSI investigation${ids.length === 1 ? '' : 's'}` : 'no PSI link in our sources'}</span></a></li>`; }).join('')}</ul></section>
    ${d.applications.map((a) => {
      const ids = [...new Set(a.related.map((x) => x.psi_id))];
      return `<section class="card earthapp" id="earth-${esc(a.id)}">
      <p class="qline"><span class="badge">${esc(a.theme)}</span></p>
      <h2 class="ehead">${icon(a.id)}${esc(a.title)}</h2>
      <blockquote>"${esc(a.brief_quote)}" <span class="src">challenge page</span></blockquote>
      <p class="note">Source: ${a.source.description
        ? `<a href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.title)} (NASA Spinoff)</a>: "${esc(a.source.description)}" <span class="src">${esc(a.source.where)}</span>`
        : `<a href="${esc(a.source.url)}" target="_blank" rel="noopener">${esc(a.source.title)}</a> <span class="src">${esc(a.source.where)}</span>`}</p>
      ${a.origin ? `<p class="note">${esc(a.origin)}</p>` : ''}
      ${a.link_quote ? `<p class="note">The challenge page links the two: "${esc(a.link_quote)}"</p>` : ''}
      ${a.note ? `<p class="note"><b>${esc(a.note)}</b></p>` : ''}
      ${a.related.length ? `<h3>Related PSI investigations</h3><ul class="related">${a.related.map((x) => `<li>
        <b>${esc(x.psi_id)}</b> ${esc(x.title)}${x.doi ? ` · <a href="https://doi.org/${esc(x.doi)}" target="_blank" rel="noopener">DOI</a>` : ''}
        <br><span class="muted">${esc(x.relation)}:</span> "${esc(x.quote)}"
        <span class="src" title="${esc(`${x.src.file}, line ${x.src.line}`)}">${esc(x.src.key)}, ${esc(short(x.src.file))} L${x.src.line}</span></li>`).join('')}</ul>
        ${ids.length >= 2 ? `<a class="maplink" href="#compare/${ids.slice(0, 3).map(esc).join(',')}">Compare ${ids.slice(0, 3).map(esc).join(', ')} →</a>` : ''}` : ''}
      ${a.context ? `<p class="note">Context: "${esc(a.context.quote)}" <span class="src">challenge page</span>
        <a class="maplink" href="${esc(a.context.link)}">Spacesuit atmosphere vs tested data →</a></p>` : ''}
    </section>`;
    }).join('')}`;
  const want = arg && root.querySelector(`#earth-${CSS.escape(arg)}`);
  if (want) { want.dataset.goto = ''; want.tabIndex = -1; }
}
