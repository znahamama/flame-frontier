import { loadJSON, cite } from '../data.js';
import { loadGlossary, g } from '../plain.js';

// Flame Sandbox. Two halves with a hard line between them:
// 1. The picture: a Three.js TEACHING MODEL (web/src/flame/flame3d.js). It computes nothing the page states.
// 2. The evidence panel: every number, verdict and badge is computed from sandbox.json (built by
//    scripts/05_build_sandbox.py from the same processed data as the Evidence Map, Panel 2 and Habitat Gaps),
//    using the display rules printed under "How this panel decides". No data -> "Unknown: no data".
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, '');
const f2 = (x) => (Math.round(x * 100) / 100).toString();
const plural = (n, w, ws = `${w}s`) => `${n} ${n === 1 ? w : ws}`;

const GRAVITY = [
  ['earth', 'Earth', '1 g'],
  ['micro', 'ISS', 'microgravity'],
  ['moon', 'Moon', 'partial g'],
  ['mars', 'Mars', 'partial g'],
];
const STATE_LABEL = { tested: 'Tested', thin: 'Thin', none: 'None', unknown: 'Unknown: no data', fit: 'Fit applies', scope: 'Outside our sources' };
// Earth gravity is a scope limit, not missing evidence: every solid test on this site flew in space, and NASA's
// normal-gravity screening tests are not among our sources. A count there would read as "0 tests", so none is shown.
const SCOPE_EARTH = 'Outside our sources: every solid test here flew in space. Earth (1 g) flammability tests exist but aren\'t in this site.';

function parseArg(arg, S) {
  const preset = S.presets.find((p) => p.id === arg);
  if (preset) return { g: preset.gravity, o2: preset.o2, p: preset.p_kpa, u: preset.flow };
  const q = new URLSearchParams(arg ?? '');
  const def = S.presets[0];
  const num = (k, d, lo, hi) => { const v = Number(q.get(k)); return q.has(k) && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  const g = GRAVITY.some(([id]) => id === q.get('g')) ? q.get('g') : def.gravity;
  return { g, o2: num('o2', def.o2, 10, 100), p: num('p', def.p_kpa, 5, S.x_max_kpa), u: num('u', def.flow, 0, 60) };
}
const argOf = (st) => `g=${st.g}&o2=${f2(st.o2)}&p=${f2(st.p)}&u=${f2(st.u)}`;

// ---------- Evidence (pure functions over sandbox.json) ----------
const inWin = (o2, p, h) => h.o2_pct[0] <= o2 && o2 <= h.o2_pct[1] && h.p_kpa[0] <= p && p <= h.p_kpa[1];

function assess(S, st, G) {
  const R = S.rules;
  const near = S.tests.filter((t) => Math.abs(t.o2 - st.o2) <= R.near_o2_pts && Math.abs(t.p_kpa - st.p) <= R.near_p_kpa);
  const dist = (t) => Math.hypot((t.o2 - st.o2) / R.near_o2_pts, (t.p_kpa - st.p) / R.near_p_kpa);
  const nearest = [...S.tests].sort((a, b) => dist(a) - dist(b))[0];
  const habs = S.habitats.filter((h) => inWin(st.o2, st.p, h));
  const ssce = S.ssce.filter((t) => t.o2_levels.some((o) => Math.abs(o - st.o2) <= R.near_o2_pts)
    && st.p >= Math.min(...t.p_kpa) - R.near_p_kpa && st.p <= Math.max(...t.p_kpa) + R.near_p_kpa);
  const flowOk = (t) => t.flows.some((f) => Math.abs(f - st.u) <= R.flow_tol_cm_s);
  const flowMatch = near.filter(flowOk);
  const gravityOk = st.g === 'micro';   // every solid test in our sources flew in microgravity (gaps.json rule)
  const all = gravityOk ? flowMatch : [];

  const badges = [];
  // 1. Atmosphere (O2 + pressure)
  const names = (ts) => ts.slice(0, 5).map((t) => esc(t.id)).join(', ') + (ts.length > 5 ? ` and ${ts.length - 5} more` : '');
  badges.push({
    key: 'Atmosphere', sub: `${f1(st.o2)}% O2 at ${f1(st.p)} kPa`,
    state: near.length === 0 ? 'none' : near.length <= R.thin_max ? 'thin' : 'tested',
    html: (near.length
      ? `${plural(near.length, 'solid test')} within ±${R.near_o2_pts} points O2 and ±${R.near_p_kpa} kPa: ${names(near)}.`
      : `No solid test within ±${R.near_o2_pts} points O2 and ±${R.near_p_kpa} kPa. Nearest: <b>${esc(nearest.id)}</b> (${esc(nearest.material)}), ${f1(nearest.o2)}% O2 at ${f1(nearest.p_kpa)} kPa
         <button type="button" class="linkish go" data-o2="${nearest.o2}" data-p="${nearest.p_kpa}" data-u="${nearest.flows[0] ?? st.u}">Go there</button>`)
      + (habs.length ? `<br>Inside the ${habs.map((h) => esc(h.name)).join(' / ')} window (${esc(habs[0].window)}): ${plural(habs[0].solids_inside, 'solid test')} in that whole window (<a href="#gaps">Habitat Gaps</a>).` : '')
      + (ssce.length ? `<br>SSCE may have run near here (${ssce.map((t) => esc(t.material)).join('; ')}), but NASA does not say which O2 went with which pressure, so it is not counted.` : ''),
    src: near.length ? `${near[0].src}${near.length > 1 ? ` (+${near.length - 1} more rows; hover a point on the Evidence Map for each)` : ''}` : nearest.src,
  });
  // 2. Gravity
  const q = S.quotes;
  badges.push({
    key: 'Gravity', sub: GRAVITY.find(([id]) => id === st.g).slice(1).join(', '),
    state: st.g === 'micro' ? (near.length ? (near.length <= R.thin_max ? 'thin' : 'tested') : 'none') : st.g === 'earth' ? 'scope' : 'unknown',
    html: st.g === 'micro' ? `Every solid test in our sources flew in microgravity, so all ${plural(near.length, 'nearby test')} ${near.length === 1 ? 'counts' : 'count'}.`
      : st.g === 'earth' ? `${SCOPE_EARTH.replace("Earth (1 g) flammability tests", g('earthtests', 'Earth (1 g) flammability tests'))} This is a limit of the site, not a finding.`
      : `Challenge page: "${esc(q.partial.text)}". ${esc(q.future.text)}`
        + (st.g === 'mars' ? ` The challenge names "${esc(q.mars.text)}" but gives no Martian target atmosphere.` : ''),
    src: st.g === 'micro' ? 'Habitat Gaps gravity rule (gaps.json): every point on both panels is from microgravity'
      : st.g === 'earth' ? `Habitat Gaps gravity rule (gaps.json): every point on both panels is from microgravity. ${G.terms.earthtests.src}` : `${q.partial.source}, sec. ${q.partial.section}`,
  });
  // 3. Airflow
  const flows = [...new Set(near.flatMap((t) => t.flows))].sort((a, b) => a - b);
  badges.push({
    key: 'Airflow', sub: `${f1(st.u)} cm/s`,
    state: !near.length ? 'unknown' : !flowMatch.length ? 'none' : flows.length <= R.thin_max ? 'thin' : 'tested',
    html: !near.length ? 'Unknown: no nearby solid test to compare flows with.'
      : `${flowMatch.length ? `${plural(flowMatch.length, 'nearby test')} ran within ±${R.flow_tol_cm_s} cm/s of your flow.` : `No nearby test ran within ±${R.flow_tol_cm_s} cm/s of your flow.`}
         Recorded flows nearby: ${flows.length ? `${flows.map(f1).join(', ')} cm/s` : 'none recorded'}${flows.length && flows.length <= R.thin_max ? ' only' : ''}.`,
    src: near.length ? 'Saffire Table 1 (flow); BASS-II Air display (cm/s), PSI-25 table' : '',
  });
  // 4. Flammability boundary (BASS-II eq. 6.1, Panel 2)
  const B = S.boundary;
  const pIn = st.p >= B.p_window_kpa[0] && st.p <= B.p_window_kpa[1];
  const uIn = st.u >= B.u_range_cm_s[0] && st.u <= B.u_range_cm_s[1];
  let bb;
  if (st.g === 'earth') bb = { state: 'scope', html: 'Outside our sources: the only boundary on this site (BASS-II eq. 6.1, PMMA rods) was measured in microgravity. Earth-gravity boundaries come from ground tests this site does not include. Boundary unknown here.' };
  else if (st.g !== 'micro') bb = { state: 'unknown', html: `The only boundary in our sources (BASS-II eq. 6.1, PMMA rods) was measured in microgravity. At ${esc(GRAVITY.find(([id]) => id === st.g)[1])} gravity there is none: boundary unknown here.` };
  else if (!pIn) bb = { state: 'unknown', html: `Measured at 1 atm only (we accept ${f1(B.p_window_kpa[0])}–${f1(B.p_window_kpa[1])} kPa, the ISS cabin range BASS-II flew in). Your ${f1(st.p)} kPa is outside it: boundary unknown here.` };
  else if (!uIn) bb = { state: 'unknown', html: `${st.u <= 0 ? 'No airflow: BASS-II never measured a boundary in still air. ' : ''}Your flow is outside the flows BASS-II recorded (${B.u_range_cm_s.join('–')} cm/s for a ${B.r0_cm} cm rod radius, a = ${B.tested_a_range.join('–')} 1/s). We do not extend the fit: boundary unknown here.` };
  else {
    const a = 1.5 * st.u / B.r0_cm;
    const x = 6 * Math.exp(-0.5 * a) + 0.0167 * a + 13.4;
    const above = st.o2 > x;
    bb = { state: 'fit', verdict: above ? 'above' : 'below',
      html: `At ${f1(st.u)} cm/s, a = (3/2)(U/r0) = ${f1(a)} 1/s and NASA's fit puts the boundary at <b>${f2(x)}% O2</b> (post-burn O2). Your ${f1(st.o2)}% is ${above
        ? '<b>above</b> it: the side where a ¼-inch PMMA rod kept burning.' : '<b>below</b> it: the side where a ¼-inch PMMA rod went out.'} PMMA rods only; other materials differ.` };
  }
  badges.push({ key: 'Flammability boundary', sub: 'BASS-II eq. 6.1', ...bb, src: cite(B.source) });

  // Filmed tests: match = microgravity, 1 atm window, O2 within +/-1 pt and a recorded flow within +/-2 cm/s.
  const clipScore = (c) => Math.abs(c.o2_initial_pct - st.o2) / R.clip_o2_pts + Math.min(...c.flows.map((f) => Math.abs(f - st.u))) / R.clip_flow_cm_s
    + (st.g === 'micro' ? 0 : 3) + (pIn ? 0 : 3);
  const clips = S.clips.filter((c) => c.flows.length).map((c) => ({ c, s: clipScore(c),
    match: st.g === 'micro' && pIn && Math.abs(c.o2_initial_pct - st.o2) <= R.clip_o2_pts && c.flows.some((f) => Math.abs(f - st.u) <= R.clip_flow_cm_s) }))
    .sort((a, b) => a.s - b.s);
  return { near, all, badges, habs, clip: clips[0], boundary: bb };
}

// ---------- Rendering ----------
function clipCard(S, st, best) {
  const { c, match } = best;
  const flowTxt = c.flow_bound === 'upper' ? `flow at most ${c.flows.map(f1).join(', ')} cm/s (blowoff)` : `Air display ${c.flows.map(f1).join(', ')} cm/s`;
  const diffs = [];
  if (st.g !== 'micro') diffs.push('gravity (filmed on the ISS)');
  if (!(st.p >= S.boundary.p_window_kpa[0] && st.p <= S.boundary.p_window_kpa[1])) diffs.push(`pressure (filmed at 1 atm, ${f1(c.p_kpa)} kPa)`);
  if (Math.abs(c.o2_initial_pct - st.o2) > S.rules.clip_o2_pts) diffs.push(`O2 (${f1(c.o2_initial_pct)}% initial)`);
  if (!c.flows.some((f) => Math.abs(f - st.u) <= S.rules.clip_flow_cm_s)) diffs.push(`flow (${flowTxt})`);
  return `<div class="sbx-clip ${match ? 'match' : ''}">
    <p class="sbx-cliphead">${match ? '<b>Your conditions match a filmed BASS-II test.</b>' : `<b>Nearest filmed test</b> <span class="muted">(differs in ${esc(diffs.join(', '))})</span>`}</p>
    <video src="${esc(c.clip)}" poster="${esc(c.poster)}" controls muted playsinline preload="none" aria-label="${esc(c.title)}"></video>
    <p class="sbx-cliptitle">${esc(c.title)}</p>
    <p class="note">${esc(c.geometry)}${c.rod_diameter_in ? ` (${c.rod_diameter_in}")` : ''} · initial O2 ${f1(c.o2_initial_pct)}% · ${esc(flowTxt)} · 1 atm · microgravity.
      ${match ? '' : `<button type="button" class="linkish go" data-g="micro" data-o2="${c.o2_initial_pct}" data-p="${c.p_kpa}" data-u="${c.flows[0]}">Set the sandbox to ${esc(c.test)}</button>`}
      · <a href="#clips">All clips</a></p>
    <p class="src">Real flight video, NASA PSI-25 (CC0). Row: ${esc(c.src)}</p>
  </div>`;
}

function caption(S, st, A, G) {
  const b = A.boundary;
  const o2 = `<span class="sbx-o2note">Oxygen sets the flame's size, brightness and flicker here (qualitative): the challenge page says more oxygen means ${g('o2fire', '"making materials much more flammable"')}.</span>`;
  const bnd = b.verdict === 'below'
    ? `<b class="sbx-out">Below NASA's measured boundary (BASS-II eq. 6.1, p.75): the flame goes out.</b> <a href="#evidence/panel2">See Panel 2 →</a>`
    : b.verdict === 'above' ? `Above NASA's measured boundary (BASS-II eq. 6.1, p.75) at this airflow: the flame keeps burning. <a href="#evidence/panel2">Panel 2 →</a>`
    : '<span class="muted">Boundary unknown here: the picture never draws the flame going out.</span>';
  return `${captionBase(S, st)} ${st.g === 'earth' || st.g === 'micro' ? o2 : ''}<br>${bnd}`;
}
function captionBase(S, st) {
  const v = S.video;
  const q = S.quotes;
  const vid = `<a href="${esc(v.url)}" target="_blank" rel="noopener">official challenge video, ${esc(v.from)}–${esc(v.to)}</a>`;
  if (st.g === 'earth') return `<b>Earth:</b> hot gas rises, pulling the flame into a flickering teardrop; soot carried upward glows yellow (${vid}).`;
  if (st.g === 'micro') return `<b>Microgravity:</b> "${esc(q.candle.text)}" (challenge page; ${vid}).${st.u > 0 ? ' A forced flow, like the fan-driven duct in BASS-II, feeds oxygen from one side and pushes the flame downstream.' : ''}`;
  return `<b>${st.g === 'moon' ? 'Moon' : 'Mars'}: unknown, no data.</b> The model draws only two outlines: the Earth shape (yellow) and the microgravity shape (blue). "${esc(q.bound.text)}" (challenge page). The real shape between them has not been measured.`;
}

const SVG_FALLBACK = `<svg viewBox="0 0 320 220" role="img" aria-label="Static drawing: a yellow teardrop flame (Earth) beside a blue sphere flame (microgravity)">
  <rect width="320" height="220" fill="#07080b"/><g stroke="none">
  <rect x="68" y="150" width="24" height="70" fill="#eee4cf"/><path d="M80 40 C100 90 102 120 80 150 C58 120 60 90 80 40Z" fill="#ffb347"/>
  <rect x="228" y="150" width="24" height="70" fill="#eee4cf"/><circle cx="240" cy="132" r="34" fill="none" stroke="#5b7cff" stroke-width="5"/></g>
  <text x="80" y="30" fill="#ccc" font-size="12" text-anchor="middle">Earth</text><text x="240" y="84" fill="#ccc" font-size="12" text-anchor="middle">Microgravity</text></svg>`;

export async function render(root, arg) {
  const [S, G] = await Promise.all([loadJSON('sandbox.json'), loadGlossary()]);
  const st = parseArg(arg, S);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const psi = S.units.psi_to_kpa;
  const anchors = [...new Set([...S.presets.map((p) => p.p_kpa), S.boundary.p_tested_kpa])];

  root.innerHTML = `
  <section class="card"><h2>Flame Sandbox</h2>
    <p class="note">Pick the gravity and the air. The picture shows why fire in space looks different; the panel beside it shows how much real NASA evidence exists for exactly those conditions.</p>
    <div class="sbx">
      <div class="sbx-stage">
        <div class="sbx-canvaswrap">
          <canvas id="sbx-canvas" role="img" aria-label=""></canvas>
          <p class="sbx-badge">Teaching model, not a simulation</p>
          <button type="button" class="sbx-pause" aria-pressed="false" ${reduced ? 'hidden' : ''}>Pause</button>
          <p class="sbx-legend" hidden><span class="lg-y">Earth outline</span> <span class="lg-b">Microgravity outline</span></p>
        </div>
        <p class="sbx-caption note" id="sbx-caption" aria-live="polite"></p>
        <details class="table-view"><summary>What the picture does and does not show</summary><ul class="note">
          <li>Gravity sets shape, colour and flicker, following NASA's description: ${esc(S.video.summary)} <span class="src">${esc(S.video.summary_note)}</span></li>
          <li>Airflow pushes the flame sideways. This illustrates the challenge page's point ("${esc(S.quotes.flow.text)}"); the angle and length are not computed.</li>
          <li>O2 sets the flame's size, brightness and flicker (qualitative: small and dim near 15%, large and bright from 30% up), after the challenge page's "making materials much more flammable". In microgravity the flame does not flicker at any O2. Pressure changes nothing in the picture: its effect on the flame isn't measured in our sources.</li>
          <li>Moon and Mars: no data, so no flame is drawn, only the two outlines the challenge page says could bound it.</li>
          <li>The picture never decides whether something burns. It draws the flame going out only when the evidence panel's NASA boundary check (BASS-II eq. 6.1: microgravity, BASS-II's 1 atm window, a recorded airflow) puts your O2 below the line. Everywhere else no extinction is drawn: boundary unknown.</li>
        </ul></details>
      </div>
      <div class="sbx-side">
        <div class="seg sbx-presets" role="group" aria-label="Presets">${S.presets.map((p) => `<button type="button" data-preset="${esc(p.id)}" aria-pressed="false">${esc(p.name)}</button>`).join('')}</div>
        <fieldset class="sbx-ctl"><legend>Gravity</legend>
          <div class="seg sbx-grav" role="radiogroup" aria-label="Gravity">${GRAVITY.map(([id, name, sub]) => `<button type="button" role="radio" data-g="${id}" aria-checked="false">${name} <small>${sub}</small></button>`).join('')}</div></fieldset>
        <label class="sbx-ctl"><span>Oxygen <output id="o-o2"></output></span>
          <input type="range" id="in-o2" min="10" max="100" step="0.1"></label>
        <label class="sbx-ctl"><span>Total pressure <output id="o-p"></output></span>
          <input type="range" id="in-p" min="5" max="${S.x_max_kpa}" step="0.01" aria-describedby="p-note">
          <small class="sbx-pnote" id="p-note">Pressure's effect on the flame isn't measured in our sources; it changes the evidence count only.</small></label>
        <label class="sbx-ctl"><span>Airflow <output id="o-u"></output></span>
          <input type="range" id="in-u" min="0" max="60" step="0.5"></label>
        <p class="note sbx-po2" id="o-po2"></p>
        <div class="sbx-sum" id="sbx-sum" aria-live="polite"></div>
      </div>
    </div>
  </section>
  <section class="card sbx-ev" aria-live="polite" id="sbx-ev"></section>
  <section class="card"><details class="table-view"><summary>How this panel decides</summary><ul class="note">
    <li>Tests: the ${S.tests.length} solid-material tests the Evidence Map plots with both O2 and pressure (Saffire per-test points and every BASS-II row), the same set the Habitat Gaps tab counts. SSCE gives O2 and pressure only as unpaired sets, so it is mentioned, never counted.</li>
    <li>"Nearby" = within ±${S.rules.near_o2_pts} percentage points O2 and ±${S.rules.near_p_kpa} kPa. A flow "matches" within ±${S.rules.flow_tol_cm_s} cm/s. "Thin" = ${S.rules.thin_max} or fewer, the threshold the Habitat Gaps rules use. These tolerances are our display rules, not NASA's.</li>
    <li>Gravity: every solid test in our sources flew in microgravity. Earth gravity is outside our sources; Moon and Mars have no data in PSI (challenge page).</li>
    <li>Boundary: BASS-II eq. 6.1 (${esc(S.boundary.equation)}), the Evidence Map's Panel 2, with ${esc(S.boundary.a_formula)} = ${S.boundary.r0_cm} cm. It is used only in microgravity, at ${f1(S.boundary.p_window_kpa[0])}–${f1(S.boundary.p_window_kpa[1])} kPa (BASS-II's stated 1 atm; the window is the ISS cabin range, ${esc(S.boundary.p_window_source.short)} p.${S.boundary.p_window_source.page}), and for flows inside the recorded a = ${S.boundary.tested_a_range.join('–')} 1/s. The fit is in post-burn O2. ${esc(cite(S.boundary.source))}.</li>
    <li>Filmed test "match": microgravity, the 1 atm window, initial O2 within ±${S.rules.clip_o2_pts} point and a recorded flow within ±${S.rules.clip_flow_cm_s} cm/s. Otherwise the closest of the ${S.clips.length} clips is shown with what differs.</li>
    <li>Presets: ${S.presets.map((p) => `${esc(p.name)} ${f1(p.o2)}% at ${f2(p.p_kpa)} kPa (${p.sources.map((s) => `${esc(s.short)}${s.page ? ` p.${s.page}` : ''}: "${esc(s.quote)}"`).join('; ')})`).join('. ')}.</li>
  </ul></details></section>`;

  const $ = (s) => root.querySelector(s);
  const inO2 = $('#in-o2'); const inP = $('#in-p'); const inU = $('#in-u');
  const canvas = $('#sbx-canvas');
  let flame = null;

  const describe = () => (st.g === 'earth' ? 'Teaching model: a yellow, flickering, teardrop-shaped candle flame (Earth gravity).'
    : st.g === 'micro' ? `Teaching model: a dim, steady, blue, near-spherical candle flame (microgravity)${st.u > 0 ? ', pushed sideways by a forced flow' : ''}.`
    : 'Teaching model: no flame drawn, only a yellow Earth outline and a blue microgravity outline, because partial-gravity data do not exist.');

  function paint() {
    inO2.value = st.o2; inP.value = st.p; inU.value = st.u;
    $('#o-o2').textContent = `${f1(st.o2)}%`;
    $('#o-p').textContent = `${f1(st.p)} kPa (${f1(st.p / psi)} psi)`;
    $('#o-u').textContent = `${f1(st.u)} cm/s`;
    const po2 = st.o2 * st.p / 100;
    $('#o-po2').textContent = `Oxygen partial pressure ${f1(po2)} kPa (sea-level air: ${S.po2_sea_level.kpa} kPa).`;
    root.querySelectorAll('.sbx-grav button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.g === st.g)));
    const on = S.presets.find((p) => p.gravity === st.g && Math.abs(p.o2 - st.o2) < 0.05 && Math.abs(p.p_kpa - st.p) < 0.01 && Math.abs(p.flow - st.u) < 0.01);
    root.querySelectorAll('.sbx-presets button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === on?.id)));
    
    $('.sbx-legend').hidden = !(st.g === 'moon' || st.g === 'mars');
    const A = assess(S, st, G);
    // The flame goes out in the picture only where NASA's boundary applies (microgravity, BASS-II's 1 atm window,
    // a recorded flow) and the panel computes O2 below it. Everywhere else no extinction is drawn.
    const out = A.boundary.verdict === 'below' && st.u > 0;
    $('#sbx-caption').innerHTML = caption(S, st, A, G);
    canvas.setAttribute('aria-label', `${describe()}${out ? ' The flame goes out: these conditions are below NASA\'s measured boundary.' : ''}`);
    flame?.set({ gravity: st.g, o2: st.o2, flow: st.u, out });
    const pill = (b) => (b.verdict ? (b.verdict === 'above' ? 'Above boundary' : 'Below boundary') : STATE_LABEL[b.state]);
    $('#sbx-sum').innerHTML = `${st.g === 'earth' ? `<div class="sbx-total sbx-scope"><span class="sbx-scopetag">Earth, 1 g</span>
        <span>${SCOPE_EARTH.replace("Earth (1 g) flammability tests", g('earthtests', 'Earth (1 g) flammability tests'))}</span></div>` : `<div class="sbx-total"><span class="sbx-num">${A.all.length}</span>
        <span>${A.all.length ? `solid-material ${A.all.length === 1 ? 'test' : 'tests'} in our sources ${A.all.length === 1 ? 'matches' : 'match'} all of these conditions: ${A.all.slice(0, 6).map((t) => esc(t.id)).join(', ')}${A.all.length > 6 ? ` and ${A.all.length - 6} more` : ''}.`
          : 'solid-material tests in our sources match all of these conditions (atmosphere, gravity and airflow together).'}</span></div>`}
      <ul class="sbx-mini">${A.badges.map((b) => `<li class="st-${b.state}"><span>${esc(b.key)}</span> <span class="sbx-pill">${pill(b)}</span></li>`).join('')}</ul>
      <p class="note"><a href="#sbx-ev" class="sbx-jump">Why: evidence details${A.clip?.match ? ' and the matching flight video' : ''} ↓</a></p>`;
    $('#sbx-ev').innerHTML = `<h2>Evidence for these conditions</h2>
      <ul class="sbx-badges">${A.badges.map((b) => `<li class="st-${b.state}${b.verdict ? ` v-${b.verdict}` : ''}">
        <div class="sbx-bhead"><span class="sbx-bkey">${esc(b.key)}</span> <span class="muted">${esc(b.sub)}</span>
          <span class="sbx-pill">${pill(b)}</span></div>
        <p>${b.html}</p>${b.src ? `<p class="src">Source: ${esc(b.src)}</p>` : ''}</li>`).join('')}</ul>
      ${A.clip ? clipCard(S, st, A.clip) : ''}
      <p class="sbx-links"><a href="#evidence/at=${f2(st.p)},${f2(st.o2)},${st.g},${f2(st.u)}">Show these conditions on the Evidence Map →</a>
        ${A.habs.length ? ` · <a href="#gaps">${esc(A.habs[0].name)} gaps</a>` : ''} · <a href="#limits">Known Limits</a></p>`;
    history.replaceState(null, '', `#sandbox/${argOf(st)}`);
  }

  const snapP = (v) => { const a = anchors.find((x) => Math.abs(x - v) <= 1); return a ?? v; };
  inO2.oninput = () => { st.o2 = Number(inO2.value); paint(); };
  inP.oninput = () => { st.p = snapP(Number(inP.value)); paint(); };
  inU.oninput = () => { st.u = Number(inU.value); paint(); };
  root.querySelectorAll('.sbx-grav button').forEach((b) => { b.onclick = () => { st.g = b.dataset.g; paint(); }; });
  // Arrow keys move within the gravity radio group.
  $('.sbx-grav').addEventListener('keydown', (e) => {
    const bs = [...root.querySelectorAll('.sbx-grav button')];
    const i = bs.findIndex((b) => b.dataset.g === st.g);
    const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    const b = bs[(j + bs.length) % bs.length];
    b.click(); b.focus();
  });
  root.querySelectorAll('.sbx-presets button').forEach((b) => {
    b.onclick = () => { const p = S.presets.find((x) => x.id === b.dataset.preset); Object.assign(st, { g: p.gravity, o2: p.o2, p: p.p_kpa, u: p.flow }); paint(); };
  });
  root.addEventListener('click', (e) => {
    if (e.target.closest('a.sbx-jump')) { e.preventDefault(); $('#sbx-ev').scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }); return; }
    const b = e.target.closest('button.go');
    if (!b) return;
    if (b.dataset.g) st.g = b.dataset.g;
    st.o2 = Number(b.dataset.o2); st.p = Number(b.dataset.p); st.u = Number(b.dataset.u);
    paint();
    canvas.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  });
  const pause = $('.sbx-pause');
  pause.onclick = () => { const on = pause.getAttribute('aria-pressed') !== 'true'; pause.setAttribute('aria-pressed', String(on)); pause.textContent = on ? 'Play' : 'Pause'; flame?.setPaused(on); };

  paint();
  // The 3D module (and three.js) loads after the controls and evidence are on screen.
  try {
    const { createFlame } = await import('../flame/flame3d.js');
    if (!root.isConnected) return undefined;
    flame = createFlame(canvas, { reduced });
    flame.set({ gravity: st.g, o2: st.o2, flow: st.u });
  } catch (err) {
    console.warn('Flame Sandbox: WebGL unavailable, showing a static drawing.', err);
    canvas.replaceWith(Object.assign(document.createElement('div'), { className: 'sbx-fallback', innerHTML: `${SVG_FALLBACK}<p class="note">3D view unavailable on this device (WebGL). The evidence panel works the same.</p>` }));
    pause.hidden = true;
  }
  return () => { flame?.dispose(); root.querySelectorAll('video').forEach((v) => v.pause()); };
}
