// Plain-language helpers for story text.
// - g(id, text): a glossary term (data/processed/glossary.json, quotes checked by scripts/07_build_glossary.py).
//   Dotted underline; hover, tap or keyboard focus opens the shared popover with the exact term, its definition and
//   its source. The visible text is the plain wording unless `text` is given.
// - alt(kpa): "about the air pressure 3,000 m up" from the U.S. Standard Atmosphere 1976 (computed, not typed).
// Interactive views, tooltips, Known Limits and exports keep the technical wording; only story text uses these.
import { loadJSON } from './data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let G = null;
export async function loadGlossary() { G ??= await loadJSON('glossary.json'); return G; }

export function g(id, text) {
  const t = G?.terms?.[id];
  if (!t) return esc(text ?? id);
  const tip = `<b>${esc(t.term)}</b>: ${esc(t.def)}`;
  return `<dfn class="gl" tabindex="0" data-tip="${esc(tip)}" data-src="${esc(t.src)}" aria-label="${esc(`${text ?? t.plain} (${t.term}: ${t.def})`)}">${esc(text ?? t.plain)}</dfn>`;
}

// U.S. Standard Atmosphere 1976, inverted for height. Lower layer 0-11 km (lapse rate -6.5 K/km), then the
// isothermal layer to 20 km. Returns metres (geopotential), or null above sea-level pressure or above 20 km.
const P0 = 101.325, T0 = 288.15, L = -0.0065, G0 = 9.80665, M0 = 0.0289644, R = 8.31432;
const EXP = (G0 * M0) / (R * -L);          // 5.25588
const P11 = P0 * ((T0 + L * 11000) / T0) ** EXP;   // 22.632 kPa at 11 km
export function altitudeM(kpa) {
  if (!(kpa > 0) || kpa >= P0) return null;
  if (kpa >= P11) return (T0 / -L) * (1 - (kpa / P0) ** (1 / EXP));
  const h = 11000 + ((R * 216.65) / (G0 * M0)) * Math.log(P11 / kpa);
  return h <= 20000 ? h : null;
}
export const ALT_SRC = 'U.S. Standard Atmosphere, 1976 (NOAA-S/T 76-1562 / NASA-TM-X-74335, NTRS 19770009539): P = 101.325 kPa × (1 − 0.0065 h / 288.15)^5.25588 below 11 km; height inverted from pressure and rounded to 100 m.';
/** Plain companion for a pressure: "about the air pressure 3,000 m up" / "Earth's sea-level air pressure" / "2× ...". */
export function alt(kpa) {
  if (Math.abs(kpa - P0) < 0.5) return "Earth's air pressure at sea level";
  if (kpa > P0) return `${Math.round((kpa / P0) * 10) / 10}× Earth's sea-level air pressure`;
  const h = altitudeM(kpa);
  if (h == null) return '';
  return `about the air pressure ${(Math.round(h / 100) * 100).toLocaleString('en-US')} m above sea level`;
}
/** Same, as HTML with a hover source. */
export function altHTML(kpa) {
  const s = alt(kpa);
  return s ? `<span class="alt" tabindex="0" data-tip="${esc(`${kpa} kPa: ${s}.`)}" data-src="${esc(ALT_SRC)}">${esc(s)}</span>` : '';
}
