// Unit-dot bins: every dot is one solid-material test from sandbox.json `tests` (the 134 solids placed on Panel 1,
// built by 05_build_sandbox.py via 05_build_gaps.solid_points). Bins are the crew-air windows in gaps.json
// (inclusive, the same rule as Panel 1 and Habitat Gaps). Habitats with an identical window (Moon base and
// pressurized rover) share one bin. Tests in no window go to "No crew-air window". No size encoding: one dot = one test.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const inWin = (t, h) => h.o2_pct[0] <= t.o2 && t.o2 <= h.o2_pct[1] && h.p_kpa[0] <= t.p_kpa && t.p_kpa <= h.p_kpa[1];
const srcName = (k) => (k === 'challenge_brief' ? 'Space Apps 2026 challenge page' : String(k).replace(/^ntrs_/, 'NTRS '));
const prog = (t) => (t.id.startsWith('BASS-II') ? 'bass' : 'saf');

export function binsModel(S, gaps) {
  const groups = [];
  for (const h of S.habitats) {
    const g = groups.find((x) => String(x.o2_pct) === String(h.o2_pct) && String(x.p_kpa) === String(h.p_kpa));
    if (g) g.habs.push(h); else groups.push({ o2_pct: h.o2_pct, p_kpa: h.p_kpa, window: h.window, habs: [h] });
  }
  const used = new Set();
  const bins = groups.map((g) => {
    const items = S.tests.filter((t) => inWin(t, g));
    items.forEach((t) => used.add(t));
    const ids = g.habs.map((h) => h.id);
    const name = g.habs.length === 1 ? g.habs[0].name : g.habs.map((h) => h.name.replace(/^Pressurized /i, '')).join(' & ');
    const ts = gaps.habitats.filter((h) => ids.includes(h.habitat.id)).map((h) => {
      const o = h.target_sources.o2, p = h.target_sources.p;
      return `${h.habitat.name}: O2 "${o.quote}" (${srcName(o.source)}${o.page ? `, p.${o.page}` : ''}); pressure "${p.quote}" (${srcName(p.source)}${p.page ? `, p.${p.page}` : ''})`;
    });
    const [a, b] = g.window.split(' at ');
    return { key: ids[0], ids, label: name, sub: [a, b], items, window: g.window, sources: ts.join(' | ') };
  });
  const rest = S.tests.filter((t) => !used.has(t));
  const bass = rest.filter((t) => prog(t) === 'bass');
  const others = rest.filter((t) => prog(t) !== 'bass');
  const o2s = bass.map((t) => t.o2);
  const fmt = (x) => String(Math.round(x * 10) / 10);
  const restBin = { key: 'none', ids: [], label: 'No crew-air window', items: rest,
    sub: [bass.length ? `${bass.length} BASS-II, ${fmt(Math.min(...o2s))}–${fmt(Math.max(...o2s))}% O2` : '',
      others.length ? `+ ${others.map((t) => t.id).join(', ')}` : ''].filter(Boolean),
    sources: '' };
  const order = ['none', 'iss', 'moon_base', 'spacesuit'];
  const all = [restBin, ...bins].sort((x, y) => order.indexOf(x.key) - order.indexOf(y.key));
  return { bins: all, total: S.tests.length, zoneKey: 'moon_base' };
}

export const dotTip = (t) => `<b>${esc(t.id)}</b>: ${esc(t.material)}<br>${t.o2}% O2 at ${t.p_kpa} kPa${t.flows?.length ? ` · flow ${t.flows.join(', ')} cm/s` : ''}`;

// SVG markup for a mode: 'rain' (dots only), 'bins' (labels), or a bin key to highlight ('iss', 'moon_base', ...).
// layout 'cols' (desktop) or 'rows' (phone).
export function binsSVG(model, mode, layout, { pre = false, cols: colsOpt, rowsAspect } = {}) {
  const wide = layout === 'cols';
  const W = wide ? 820 : 360;
  let r = wide ? 7 : 4.2, gap = wide ? 3.6 : 2.2, step = r * 2 + gap;
  // Phone rows: when the stage shape is known (width / height), use the largest dots that still fit its height.
  let perOpt;
  if (!wide && rowsAspect) {
    const target = W / rowsAspect;
    for (let per = 12; per <= 31; per++) {
      const st = (W - 16) / per;
      const h = model.bins.reduce((a, b) => a + 44 + Math.max(1, Math.ceil(b.items.length / per)) * st + 18 + (b.key === model.zoneKey ? 6 : 0), 8);
      if (h <= target || per === 31) { perOpt = per; step = st; r = Math.min(9, st * 0.4); gap = st - 2 * r; break; }
    }
  }
  const hl = model.bins.some((b) => b.key === mode) ? mode : null;
  let H; let VB; let dots = ''; let deco = ''; let labels = '';
  const seed = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const dot = (t, x, y, i, bin, big) => {
    const y0 = (wide ? -320 : -40) - seed(i) * 260;   // rain starts above the drawn area (wide frames have y = 0 at the baseline)
    const d = Math.round(seed(i + 7) * 500 + (big ? 700 : 0));
    return `<circle class="dot ${prog(t)}${big ? ' big' : ''}" r="${big ? r + 3 : r}" style="--x:${x.toFixed(1)}px;--y:${y.toFixed(1)}px;--y0:${y0.toFixed(1)}px;--d:${d}ms" data-bin="${bin.key}" data-tip="${esc(dotTip(t))}" data-src="${esc(t.src)}"/>`;
  };
  let i = 0;
  // The highlight card for the Moon-base bin hugs its content: count, a sentence built from the data, names, dots.
  const zoneMsg = (b) => [`of ${model.total}. This is all the`, 'evidence in our sources', `for ${b.label} air.`];
  if (wide) {
    const bw = W / model.bins.length, cols = colsOpt ?? 9, base = 0;
    let minY = 0; let maxY = 0;
    model.bins.forEach((b, k) => {
      const cx = bw * k + bw / 2, x0 = cx - ((cols - 1) * step) / 2;
      const n = b.items.length;
      const isZone = b.key === model.zoneKey && n > 0;
      let top;
      let inner = '';
      if (isZone) {
        const msg = zoneMsg(b);
        const namesY = base - step - 6;
        const msgY0 = namesY - 30 - (msg.length - 1) * 19;
        top = msgY0 - 30;
        const cardTop = top - 40;
        inner = `<rect class="zonebox" data-bin="${b.key}" x="${bw * k + 10}" y="${cardTop}" width="${bw - 20}" height="${base + r + 18 - cardTop}" rx="14"/>
          ${msg.map((l, q) => `<text class="bmsg${q === 0 ? ' first' : ''}" x="${cx}" y="${msgY0 + q * 19}" text-anchor="middle">${esc(l)}</text>`).join('')}`;
        minY = Math.min(minY, cardTop);
      } else {
        top = base - (Math.ceil(Math.max(n, 1) / cols) - 1) * step - r - 14;
        minY = Math.min(minY, top - 34);
      }
      b.items.forEach((t, j) => {
        const few = n <= 3;
        const x = few ? cx + (j - (n - 1) / 2) * (step + 8) : x0 + (j % cols) * step;
        const y = base - (few ? 0 : Math.floor(j / cols) * step);
        dots += dot(t, x, y, i++, b, few);
      });
      if (!n) deco += `<circle class="emptyring" cx="${cx}" cy="${base}" r="${r + 3}"/>`;
      const subEnd = base + 56 + (b.sub.length - 1) * 18;
      maxY = Math.max(maxY, subEnd + 8);
      labels += `<g class="blabel ${isZone ? 'onzone' : ''}" data-bin="${b.key}">${inner}
        <text class="bnum" x="${cx}" y="${top}" text-anchor="middle">${n}</text>
        ${isZone ? `<text class="bnames" x="${cx}" y="${base - step - 6}" text-anchor="middle">${esc(b.items.map((t) => t.id.replace(/^Saffire /, '')).join(' · '))}</text>` : ''}
        <text class="bname" x="${cx}" y="${base + 36}" text-anchor="middle">${esc(b.label)}</text>
        ${b.sub.map((l, q) => `<text class="bsub" x="${cx}" y="${base + 56 + q * 18}" text-anchor="middle">${esc(l)}</text>`).join('')}</g>`;
    });
    // Crop the viewBox to what is drawn, so the visual can scale up to fill the stage.
    const y0 = minY - 10;
    H = maxY - y0;
    VB = `0 ${y0.toFixed(1)} ${W} ${H.toFixed(1)}`;
  } else {
    const per = perOpt ?? Math.floor((W - 16) / step);
    let y = 8;
    model.bins.forEach((b) => {
      const n = b.items.length; const nrows = Math.max(1, Math.ceil(n / per));
      const isZone = b.key === model.zoneKey && n > 0;
      const hgt = 44 + nrows * step + 8 + (isZone ? 6 : 0);
      let inner = '';
      if (isZone) {
        const msg = zoneMsg(b);
        const mx = 16 + n * (step + 14) + 4;
        inner = `<rect class="zonebox" data-bin="${b.key}" x="0" y="${y - 4}" width="${W}" height="${hgt + 4}" rx="10"/>
          <text class="bmsg first" x="${mx}" y="${y + 44}">${esc(`${n} ${msg[0]} ${msg[1]}`)}</text>
          <text class="bmsg" x="${mx}" y="${y + 58}">${esc(msg[2])}</text>`;
      }
      labels += `<g class="blabel ${isZone ? 'onzone' : ''}" data-bin="${b.key}">${inner}<text class="bnum" x="10" y="${y + 24}">${n}</text>
        <text class="bname" x="54" y="${y + 14}">${esc(b.label)}</text><text class="bsub" x="54" y="${y + 30}">${esc(b.sub.join(' · '))}</text></g>`;
      b.items.forEach((t, j) => {
        const few = n <= 3;
        const x = few ? 16 + j * (step + 14) : 8 + r + (j % per) * step;
        dots += dot(t, x, y + 46 + Math.floor(j / per) * step, i++, b, few);
      });
      if (!n) deco += `<circle class="emptyring" cx="${16}" cy="${y + 46}" r="${r + 2}"/>`;
      y += hgt + 10;
    });
    H = y;
    VB = `0 0 ${W} ${H}`;
  }
  const aria = `${model.total} solid-material tests by crew air: ${model.bins.map((b) => `${b.items.length} ${b.label}`).join(', ')}.`;
  return `<svg class="bins ${layout} ${pre ? 'pre' : ''}" data-mode="${esc(mode)}" ${hl ? `data-hl="${esc(hl)}"` : ''} viewBox="${VB}" role="img" aria-label="${esc(aria)}">
    ${deco}<g class="cards">${labels.match(/<rect class="zonebox"[^>]*\/>/g)?.join('') ?? ''}</g><g class="dots">${dots}</g>${labels.replace(/<rect class="zonebox"[^>]*\/>/g, '')}</svg>`;
}
