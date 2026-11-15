import { loadJSON } from '../data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const OFFLINE = new URLSearchParams(location.search).has('offline');
const NOT_IN_DATA = 'Not in the data.';

// Same tokenizer and BM25 as api/ask.py (config comes from qa_chunks.json), for offline mode.
function tokenizer(stop) {
  const S = new Set(stop);
  return (t) => (String(t).toLowerCase().match(/[a-z0-9]+(?:[-.][a-z0-9]+)*/g) ?? []).filter((w) => !S.has(w));
}
function buildIndex(data) {
  const R = data.retrieval;
  const tok = tokenizer(R.stopwords);
  const docs = data.chunks.map((c) => tok(`${c.text} ${c.source} ${c.id}`));
  const avg = docs.reduce((a, d) => a + d.length, 0) / Math.max(1, docs.length);
  const df = new Map();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const idf = new Map([...df].map(([t, f]) => [t, Math.log(1 + (docs.length - f + 0.5) / (f + 0.5))]));
  const tfs = docs.map((d) => d.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map()));
  const norm = (q) => tok(q).join(' ');
  const search = (query) => {
    const q = new Map(tok(query).map((t) => [t, 1]));
    for (const t of [...q.keys()]) for (const s of R.synonyms[t] ?? []) if (!q.has(s)) q.set(s, R.synonym_weight);
    const scored = [];
    tfs.forEach((tf, i) => {
      let s = 0;
      for (const [t, w] of q) {
        const f = tf.get(t);
        if (f) s += w * (idf.get(t) ?? 0) * f * (R.k1 + 1) / (f + R.k1 * (1 - R.b + R.b * docs[i].length / avg));
      }
      if (data.chunks[i].tier === 'derived') s *= R.derived_weight;
      if (s > 0) scored.push([s, i]);
    });
    scored.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const top = scored.slice(0, R.top_k).map(([s, i]) => ({ ...data.chunks[i], score: Math.round(s * 1000) / 1000 }));
    return [...top.filter((c) => c.tier !== 'derived'), ...top.filter((c) => c.tier === 'derived')];   // primary first, as in api/ask.py
  };
  return { search, norm };
}

const where = (c) => [c.page != null && `p.${c.page}`, c.line != null && `line ${c.line}`].filter(Boolean).join(', ');

function answerHTML(text, chunks) {
  const n = new Map(chunks.map((c, i) => [c.id, i + 1]));
  return esc(text).replace(/\[([^[\]]+)\]/g, (m, grp) => grp.split(',').map((id) => {
    const k = n.get(id.trim());
    return k ? `<a class="cite" href="#" data-ref="${k}" title="${esc(id.trim())}">[${k}]</a>` : `<span class="flag">[${esc(id.trim())}: not a retrieved passage]</span>`;
  }).join(''));
}

function resultHTML(r, meta) {
  const chunks = r.chunks ?? [];
  const cited = new Set(r.checks?.cited ?? []);
  const live = r.mode === 'live' || r.mode === 'cached';
  const badge = { cached: 'Precomputed answer', live: 'Live answer', offline: 'Offline: passages only, no AI answer' }[r.mode];
  const chk = r.checks ? (r.flagged
    ? `<p class="warnbox"><b>This answer failed an automatic check</b> and may be wrong: ${esc(r.checks.problems.join('; '))}. Read the passages below.</p>`
    : `<p class="checks">✓ every sentence cites a retrieved passage · ✓ every number appears in a cited passage · ✓ Flame Frontier's own readings are credited to Flame Frontier, NASA text to NASA</p>`) : '';
  return `<section class="card answer" aria-live="polite">
    <p class="qline"><span class="badge ${esc(r.mode)}">${esc(badge)}</span> <b>${esc(r.question)}</b></p>
    ${live ? `<div class="answertext">${answerHTML(r.answer, chunks)}</div>
      <p class="src">AI-written by ${esc(r.model ?? meta.model)} from the passages below only; checked by code, not by a person. AI text never feeds a chart or a number elsewhere on this site.</p>${chk}`
      : `<p class="note">${esc(r.reason ?? '')}${r.answer === NOT_IN_DATA ? ` ${NOT_IN_DATA}` : ''} These are the passages that best match your question (keyword search, no AI).</p>`}
    <h3>Passages${live ? ' (numbered as cited)' : ''}</h3>
    ${chunks.length ? `<ol class="passages">${chunks.map((c, i) => `<li id="ref-${i + 1}" class="${cited.has(c.id) ? 'cited' : ''}">
      <p class="psrc"><span class="tier ${c.tier === 'derived' ? 'derived' : 'primary'}">${c.tier === 'derived' ? 'Derived' : 'Primary'}</span> <b>${esc(c.source)}</b>${where(c) ? ` · ${esc(where(c))}` : ''} <span class="muted">· ${esc(c.file ?? '')} · <code>${esc(c.id)}</code></span></p>
      ${c.tier === 'derived' && c.derived_from ? `<p class="dfrom">derived from: ${c.derived_from.map(esc).join('; ')}</p>` : ''}
      <p class="ptext">${esc(c.text.length > 700 ? `${c.text.slice(0, 700)}…` : c.text)}</p></li>`).join('')}</ol>`
      : '<p class="muted">No passage matches these words.</p>'}
  </section>`;
}

export async function render(root, arg) {
  const [chunks, cache] = await Promise.all([loadJSON('qa_chunks.json'), loadJSON('qa_cache.json')]);
  const idx = buildIndex(chunks);
  const byQ = new Map(cache.answers.map((a) => [idx.norm(a.question), a]));
  const kinds = [...new Set(chunks.chunks.map((c) => c.id.split(':')[0]))];
  const counts = Object.fromEntries(kinds.map((k) => [k, chunks.chunks.filter((c) => c.id.startsWith(`${k}:`)).length]));
  root.innerHTML = `<section class="card"><h2>Ask the evidence</h2>
    <p class="note">Answers come only from ${chunks.count} cited passages: PSI metadata text (${counts.meta ?? 0}), BASS-II report and paper pages (${(counts.report ?? 0) + (counts.paper ?? 0) + (counts.ntrs ?? 0)}),
      the challenge page (${counts.brief ?? 0}), the Saffire table restated row by row (${counts.data ?? 0}), and this site's own derived summaries (${counts.limits ?? 0}), which rank below the primary text and name what they were derived from. A keyword search (BM25) picks the ${chunks.retrieval.top_k} best passages;
      an AI model (${esc(cache.model)}) writes a short answer that must cite a passage in every sentence and copy every number from one. If the passages don't answer it, the reply is "${NOT_IN_DATA}"
      ${OFFLINE ? '<br><b>Offline mode</b> (<code>?offline</code>): no AI calls; precomputed answers and matching passages only.' : ''}</p>
    <form class="askform"><label for="q" class="vh">Question</label>
      <input id="q" name="q" type="text" maxlength="300" autocomplete="off" placeholder="e.g. Which solids burned at Moon-base oxygen?" required>
      <button type="submit">Ask</button></form>
    <p class="note">Try a precomputed question:</p>
    <ul class="demoqs">${cache.answers.map((a) => `<li><button type="button" class="demoq" data-q="${esc(a.question)}">${esc(a.question)}</button></li>`).join('')}</ul>
  </section><div id="askout"></div>`;
  const out = root.querySelector('#askout');
  const input = root.querySelector('#q');

  const offlineResult = (q, reason) => {
    const hit = byQ.get(idx.norm(q));
    if (hit) return { ...hit, mode: 'cached' };
    return { question: q, mode: 'offline', chunks: idx.search(q), reason };
  };

  async function ask(q) {
    q = q.trim().slice(0, 300);
    if (!q) return;
    input.value = q;
    history.replaceState(null, '', `${location.search}#ask/${encodeURIComponent(q)}`);
    out.innerHTML = '<section class="card"><p class="muted">Searching the passages…</p></section>';
    let r;
    const local = byQ.get(idx.norm(q));
    if (local) r = { ...local, mode: 'cached' };
    else if (OFFLINE) r = offlineResult(q, 'Offline mode: no AI answer.');
    else {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 30000);
        const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }), signal: ctl.signal });
        clearTimeout(t);
        const body = await res.json();
        if (body.error) throw new Error(body.error);
        r = body;
      } catch (e) {
        r = offlineResult(q, `The answer service is unavailable (${e.name === 'AbortError' ? 'timeout' : 'error'}), so no AI answer.`);
      }
    }
    out.innerHTML = resultHTML(r, cache);
    out.querySelectorAll('a.cite').forEach((a) => a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const li = out.querySelector(`#ref-${a.dataset.ref}`);
      li?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      li?.classList.add('flash');
      setTimeout(() => li?.classList.remove('flash'), 1200);
    }));
  }

  root.querySelector('.askform').addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  root.querySelectorAll('.demoq').forEach((b) => b.addEventListener('click', () => ask(b.dataset.q)));
  if (arg) ask(decodeURIComponent(arg));
}
