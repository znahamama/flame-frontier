// Source chips and the one shared popover.
// A chip is a small button with a short locator ("Table 1 · p.3", "BASS-II.csv L52"); hover, focus or tap opens the
// full citation, word for word. Chart marks drawn by the story visuals use the same popover as a tooltip
// (data-tip on the mark). Nothing is shortened in the popover: the full text is always one interaction away.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Short label for a citation string. Display only; the popover shows the full string.
export function shortCite(raw) {
  const s = String(raw ?? '').replace(/^\s*(Source|Row|Video):\s*/i, '').trim();
  const parts = [];
  const doc = s.match(/ICES-\d{4}-\d+|NASA\/TM-\d+|NTRS \d+|BASS-II Summary Report|Space Apps 2026 challenge page|challenge page|NASA Spinoff|Comment\[[^\]]+\]/);
  const files = [...s.matchAll(/([\w.\-() ]+)\.(csv|json|txt|xlsx|pdf|mp4|docx|md)\b/g)];
  const file = files.length ? files[files.length - 1] : null;
  const page = s.match(/\bp\.\s?(\d+)/);
  const line = s.match(/\b(?:line|L|row)\s?(\d+)/);
  const sec = s.match(/\bsec\.\s?([\d.]+\d)/);
  const eq = s.match(/\beq\.\s?([\d.]+\d)/);
  const table = s.match(/\bTable \d+/);
  if (doc) parts.push(doc[0].replace('Space Apps 2026 challenge page', 'challenge page').replace('BASS-II Summary Report', 'BASS-II report'));
  if (table) parts.push(table[0]);
  if (eq) parts.push(`eq. ${eq[1]}`); else if (sec && !table) parts.push(`sec. ${sec[1]}`);
  if (page) parts.push(`p.${page[1]}`);
  if (!doc && file) parts.push(`${file[1].trim().replace(/^PSI-\d+_(Experimental table_|metadata_)?/, '')}.${file[2]}`);
  if (line && !page) parts.push(`L${line[1]}`);
  const out = parts.slice(0, 3).join(' · ');
  if (out) return out;
  return s.length > 28 ? `${s.slice(0, 26)}…` : s;
}

let seq = 0;
const store = new Map();   // chip id -> full HTML (kept out of attributes so links survive)

// HTML for a chip. `full` is plain text unless `html` is true.
export function chip(full, label, { html = false } = {}) {
  const id = `c${++seq}`;
  store.set(id, html ? full : esc(full));
  return `<button type="button" class="chip" data-cite="${id}" aria-expanded="false" aria-controls="citepop">${esc(label ?? shortCite(html ? full.replace(/<[^>]+>/g, '') : full))}</button>`;
}

// Convert existing inline source text (.src) into chips. Only real citations are converted: spans with a title
// (label = their short text, full = title + text) and blocks that start with "Source:", "Row:", "Video:" or
// "Real flight video". Other .src text (notes, column lists) is left as it is.
export function chipify(root) {
  for (const el of root.querySelectorAll('.src:not([data-chipped])')) {
    el.dataset.chipped = '1';
    const text = el.textContent.trim();
    const title = el.getAttribute('title');
    if (el.tagName === 'SPAN' && title) {
      const full = title === text ? title : `${title}${text && !title.includes(text) ? ` (${text})` : ''}`;
      el.outerHTML = chip(full, text.length > 34 ? shortCite(text) : text);
    } else if (el.tagName === 'SPAN' && !el.querySelector('a, br')) {
      el.outerHTML = chip(text, text.length > 34 ? shortCite(text) : text);
    } else if (/^(Source:|Row:|Video:|Real flight video)/.test(text) && !el.querySelector('br')) {
      el.outerHTML = `<p class="chiprow">${chip(el.innerHTML, null, { html: true })}</p>`;
    }
  }
}

// ---------- the popover (one per page) ----------
let pop; let anchor = null; let pinned = false; let hideT = 0;
function ensure() {
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'citepop'; pop.className = 'citepop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Source');
  document.body.append(pop);
  pop.addEventListener('pointerenter', () => clearTimeout(hideT));
  pop.addEventListener('pointerleave', () => { if (!pinned) hideSoon(); });
  return pop;
}
function place(x, y, below = true) {
  const r = pop.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  let left = Math.min(Math.max(8, x - r.width / 2), vw - r.width - 8);
  let top = below ? y + 10 : y - r.height - 10;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  if (top < 8) top = 8;
  pop.style.left = `${left + scrollX}px`; pop.style.top = `${top + scrollY}px`;
}
export function showPop(el, html, at) {
  ensure();
  clearTimeout(hideT);
  if (anchor && anchor !== el) anchor.setAttribute?.('aria-expanded', 'false');
  anchor = el;
  pop.innerHTML = html;
  pop.hidden = false;
  if (el.classList?.contains('chip')) el.setAttribute('aria-expanded', 'true');
  if (at) place(at.x, at.y);
  else { const r = el.getBoundingClientRect(); place(r.left + r.width / 2, r.bottom); }
}
export function hidePop() {
  if (!pop) return;
  pop.hidden = true; pinned = false;
  anchor?.setAttribute?.('aria-expanded', 'false');
  anchor = null;
}
const hideSoon = () => { clearTimeout(hideT); hideT = setTimeout(hidePop, 160); };

const tipHTML = (el) => `${el.dataset.tip}${el.dataset.src ? `<div class="popsrc">Source: ${el.dataset.src}</div>` : ''}`;
const coarse = matchMedia('(hover: none)');

document.addEventListener('click', (e) => {
  const c = e.target.closest('.chip[data-cite]');
  if (c) {
    e.preventDefault();
    if (anchor === c && pinned) { hidePop(); return; }
    showPop(c, `<div class="popsrc">${store.get(c.dataset.cite) ?? ''}</div>`); pinned = true;
    return;
  }
  const m = e.target.closest('[data-tip]');
  if (m) { showPop(m, tipHTML(m), { x: e.clientX, y: e.clientY }); pinned = true; return; }
  if (pop && !pop.contains(e.target)) hidePop();
});
document.addEventListener('pointerover', (e) => {
  if (coarse.matches || pinned) return;
  const c = e.target.closest('.chip[data-cite]');
  if (c) { showPop(c, `<div class="popsrc">${store.get(c.dataset.cite) ?? ''}</div>`); return; }
  const m = e.target.closest('[data-tip]');
  if (m) showPop(m, tipHTML(m), { x: e.clientX, y: e.clientY });
});
document.addEventListener('pointerout', (e) => {
  if (coarse.matches || pinned) return;
  if (e.target.closest('.chip[data-cite], [data-tip]') && !pop?.contains(e.relatedTarget)) hideSoon();
});
document.addEventListener('focusin', (e) => {
  const c = e.target.closest?.('.chip[data-cite]');
  if (c) { showPop(c, `<div class="popsrc">${store.get(c.dataset.cite) ?? ''}</div>`); return; }
  const m = e.target.closest?.('[data-tip][tabindex]');
  if (m) { showPop(m, tipHTML(m)); return; }
  if (pop && !pop.contains(e.target)) hidePop();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop && !pop.hidden) { const a = anchor; hidePop(); a?.focus?.(); } });
addEventListener('scroll', () => { if (!pinned) hidePop(); }, { passive: true });
