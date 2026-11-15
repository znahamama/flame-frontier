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
export function binsSVG(model, mode, layout, { pre = false } = {}) {
  const wide = layout === 'cols';
  const W = wide ? 820 : 360;
  const r = wide ? 7 : 4.2, gap = wide ? 3.6 : 2.2, step = r * 2 + gap;
  const hl = model.bins.some((b) => b.key === mode) ? mode : null;
  let H; let dots = ''; let deco = ''; let labels = '';
  const seed = (i) => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const dot = (t, x, y, i, bin, big) => {
    const y0 = -40 - seed(i) * 260;
    const d = Math.round(seed(i + 7) * 500 + (big ? 700 : 0));
    return `<circle class="dot ${prog(t)}${big ? ' big' : ''}" r="${big ? r + 3 : r}" style="--x:${x.toFixed(1)}px;--y:${y.toFixed(1)}px;--y0:${y0.toFixed(1)}px;--d:${d}ms" data-bin="${bin.key}" data-tip="${esc(dotTip(t))}" data-src="${esc(t.src)}"/>`;
  };
  let i = 0;
  if (wide) {
    H = 560; const bw = W / model.bins.length, base = H - 104, cols = 9, rows = 13;
    model.bins.forEach((b, k) => {
      const cx = bw * k + bw / 2, x0 = cx - ((cols - 1) * step) / 2;
      const n = b.items.length;
      const isZone = b.key === model.zoneKey;
      if (isZone) deco += `<rect class="zonebox" x="${bw * k + 10}" y="${base - rows * step - 30}" width="${bw - 20}" height="${rows * step + 30 + r + 18}" rx="14"/>`;
      b.items.forEach((t, j) => {
        const few = n <= 3;
        const x = few ? cx + (j - (n - 1) / 2) * (step + 8) : x0 + (j % cols) * step;
        const y = base - (few ? 0 : Math.floor(j / cols) * step);
        dots += dot(t, x, y, i++, b, few);
      });
      if (!n) deco += `<circle class="emptyring" cx="${cx}" cy="${base}" r="${r + 3}"/>`;
      const top = isZone ? base - rows * step - 4 : base - (Math.ceil(Math.max(n, 1) / cols) - 1) * step - r - 14;
      labels += `<g class="blabel ${isZone ? 'onzone' : ''}" data-bin="${b.key}">
        <text class="bnum" x="${cx}" y="${top}" text-anchor="middle">${n}</text>
        ${isZone && n ? `<text class="bnames" x="${cx}" y="${base - step - 6}" text-anchor="middle">${esc(b.items.map((t) => t.id.replace(/^Saffire /, '')).join(' · '))}</text>` : ''}
        <text class="bname" x="${cx}" y="${base + 36}" text-anchor="middle">${esc(b.label)}</text>
        ${b.sub.map((l, q) => `<text class="bsub" x="${cx}" y="${base + 56 + q * 18}" text-anchor="middle">${esc(l)}</text>`).join('')}</g>`;
    });
  } else {
    const per = Math.floor((W - 16) / step);
    let y = 8;
    model.bins.forEach((b) => {
      const n = b.items.length; const nrows = Math.max(1, Math.ceil(n / per));
      const hgt = 44 + nrows * step + 8; const isZone = b.key === model.zoneKey;
      if (isZone) deco += `<rect class="zonebox" x="0" y="${y - 4}" width="${W}" height="${hgt + 4}" rx="10"/>`;
      labels += `<g class="blabel ${isZone ? 'onzone' : ''}" data-bin="${b.key}"><text class="bnum" x="10" y="${y + 24}">${n}</text>
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
  }
  const aria = `${model.total} solid-material tests by crew air: ${model.bins.map((b) => `${b.items.length} ${b.label}`).join(', ')}.`;
  return `<svg class="bins ${layout} ${pre ? 'pre' : ''}" data-mode="${esc(mode)}" ${hl ? `data-hl="${esc(hl)}"` : ''} viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">
    ${deco}<g class="dots">${dots}</g>${labels}</svg>`;
}
