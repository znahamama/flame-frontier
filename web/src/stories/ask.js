// Ask story: how one real precomputed answer was made. Passages -> keyword search picks 6 -> the model writes with
// citations -> code checks -> offline fallback. Everything shown is read from qa_chunks.json and qa_cache.json.
import { loadJSON } from '../data.js';
import { mountStory } from '../story.js';
import { loadGlossary, g } from '../plain.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KIND = { meta: 'PSI metadata', report: 'BASS-II report pages', paper: 'paper pages', ntrs: 'NTRS record', brief: 'challenge page', data: 'Saffire table rows', limits: "this site's summaries" };

function createVisual(P) {
  let root; let last = null;
  const scenes = ['corpus', 'pick', 'answer', 'checks', 'offline'];
  const html = (k) => {
    if (k === 'corpus' || k === 'pick') {
      return `<div class="stagecard askcorp ${k === 'pick' ? 'picked' : ''}"><p class="stagetitle">${P.total} passages${k === 'pick' ? `: the ${P.picked.length} picked for this question` : ', one square each'}</p>
        <div class="qgrid" role="img" aria-label="${esc(`${P.total} passages; ${P.derived} are this site's own summaries`)}">${P.chunks.map((c) => `<i class="${c.tier === 'derived' ? 'dv' : 'pr'}${P.pickedIds.has(c.id) ? ' on' : ''}" data-tip="${esc(`<b>${c.id}</b>: ${c.source}`)}" data-src="${esc(`qa_chunks.json · ${c.file ?? c.source}`)}"></i>`).join('')}</div>
        <p class="splegend"><span><i class="sw sq-pr"></i>NASA and challenge text (${P.total - P.derived})</span><span><i class="sw sq-dv"></i>this site's summaries (${P.derived}), ranked lower</span></p>
        ${k === 'pick' ? `<ol class="picklist">${P.picked.map((c) => `<li><code>${esc(c.id)}</code> <span class="muted">${esc(c.source)}</span></li>`).join('')}</ol>` : ''}</div>`;
    }
    if (k === 'answer') {
      const n = new Map(P.picked.map((c, i) => [c.id, i + 1]));
      const text = esc(P.a.answer).replace(/\[([^[\]]+)\]/g, (m, g) => g.split(',').map((id) => `<sup class="cite">[${n.get(id.trim()) ?? '?'}]</sup>`).join(''));
      return `<div class="stagecard qcenter"><p class="stagetitle">Q: ${esc(P.a.question)}</p><p class="qans">${text}</p>
        <p class="note">Written by ${esc(P.a.model)} from the ${P.picked.length} passages only. Numbers in brackets = passage numbers.</p></div>`;
    }
    if (k === 'checks') {
      return `<div class="stagecard qcenter"><p class="stagetitle">Checks run by code on every answer</p><ul class="qchecks">${P.checks.map((c) => `<li><span class="cv-ok" aria-hidden="true">✓</span> ${esc(c)}</li>`).join('')}</ul>
        <p class="note">This answer: ${P.a.checks.ok ? 'passed' : 'flagged'}; it cites ${P.a.checks.cited.length} of the ${P.picked.length} passages. A failed answer is retried once, then shown with a warning.</p></div>`;
    }
    return `<div class="stagecard qcenter qoff"><p class="stagetitle">Works with no AI key</p><ol class="picklist">${P.qs.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
      <p class="note">${P.qs.length} precomputed answers, checked again on every build. Any other question offline: the matching passages, no AI text.</p></div>`;
  };
  return {
    mount(el) { root = el; el.innerHTML = scenes.map((k) => `<div class="scene scene-x" data-k="${k}">${html(k)}</div>`).join(''); if (last) this.set(last); },
    set(state) { last = state; root?.querySelectorAll('.scene-x').forEach((e) => e.classList.toggle('on', e.dataset.k === state.scene)); },
    snapshot(state) { return `<div class="snapx">${html(state.scene)}</div>`; },
    dispose() {},
  };
}

export async function render(host) {
  const [Q, C] = await Promise.all([loadJSON('qa_chunks.json'), loadJSON('qa_cache.json'), loadGlossary()]);
  const a = C.answers[0];
  const picked = a.chunks;
  const counts = Object.entries(Q.chunks.reduce((m, c) => { const k = c.id.split(':')[0]; m[k] = (m[k] ?? 0) + 1; return m; }, {}));
  const derived = Q.chunks.filter((c) => c.tier === 'derived').length;
  const P = {
    a, picked, pickedIds: new Set(picked.map((c) => c.id)), chunks: Q.chunks, total: Q.count, derived,
    qs: C.answers.map((x) => x.question),
    checks: ['every cited passage was among the retrieved ones', 'every sentence cites a passage', 'every number appears in a cited passage', "this site's own readings are credited to Flame Frontier, NASA text to NASA"],
  };
  const steps = [
    { id: 'corpus', title: 'The passages', state: { scene: 'corpus' },
      html: `Answers come only from <b>${Q.count}</b> short passages of text: NASA's records, report and paper pages, the challenge page, and ${derived} clearly labelled summaries of our own.`,
      chips: [[counts.map(([k, n]) => `${KIND[k] ?? k}: ${n}`).join(' · '), 'qa_chunks.json']] },
    { id: 'pick', title: 'Keyword search', state: { scene: 'pick' },
      html: `A ${g('bm25', 'keyword search (BM25)')}, with no AI, picks the <b>${Q.retrieval.top_k}</b> best matches. Our own summaries count ${Q.retrieval.derived_weight}× as much and come after NASA's text.`,
      chips: [[`BM25 k1 ${Q.retrieval.k1}, b ${Q.retrieval.b}; derived passages × ${Q.retrieval.derived_weight}; same code in api/ask.py and the browser`, 'retrieval config']] },
    { id: 'answer', title: 'A cited answer', state: { scene: 'answer' },
      html: `An AI model (${esc(a.model)}) then writes a short answer from those passages only. Every sentence must name the passage it comes from.`,
      chips: [['api/ask.py: max_tokens 450, called server-side only; the browser never calls the Anthropic API', 'api/ask.py']] },
    { id: 'checks', title: 'Code checks', state: { scene: 'checks' },
      html: 'Before an answer is shown, plain code checks it: its sources, its numbers, and who said what. A failing answer gets one retry, then a warning.',
      chips: [['api/ask.py checks; scripts/precompute_qa.py re-checks every cached answer with the current rules', 'checks']] },
    { id: 'offline', title: 'Without an AI key', state: { scene: 'offline' },
      html: `It works without an AI key: <b>${C.answers.length}</b> answers are saved in advance, and with no key any other question gets the matching passages.`,
      chips: [['data/llm_cache/qa/*.json (committed) -> qa_cache.json; ?offline or any API failure -> BM25 in the browser', 'qa_cache.json']] },
  ];
  return mountStory(host, {
    section: 'ask', title: 'Ask', viewHash: 'ask/view', viewLabel: 'Ask',
    intro: `<p class="eyebrow">Ask</p><h1 class="story-h1">Ask the evidence, with a source on every sentence</h1>
      <p class="story-sub">How one real answer was made, then the question box.</p>`,
    steps, visual: createVisual(P),
  });
}
