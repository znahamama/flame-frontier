import { loadJSON } from '../data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (f) => String(f ?? '').split('/').slice(-1)[0];

// Earth applications: every quote is checked by scripts/05_build_earth.py; the connecting words are templates. No AI text.
export async function render(root) {
  const d = await loadJSON('earth_apps.json');
  root.innerHTML = `<section class="card"><h2>Fire safety on Earth</h2>
    <p class="note">The challenge page names these Earth uses of NASA fire-safety work. For each: the page's words, the NASA source it links,
      and the PSI investigations on the same topic, each with a quote from its own PSI metadata. A shared topic is not a claim of origin.</p></section>
    ${d.applications.map((a) => {
      const ids = [...new Set(a.related.map((x) => x.psi_id))];
      return `<section class="card earthapp" id="earth-${esc(a.id)}">
      <p class="qline"><span class="badge">${esc(a.theme)}</span></p>
      <h2>${esc(a.title)}</h2>
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
}
