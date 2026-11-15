import { loadJSON } from '../data.js';

// Real BASS-II flight video (PSI-25, CC0), trimmed. Each clip is tied to its test row and, where it has one, its Panel 2 point.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const OUT = { extinguished: 'extinguished', blowoff: 'blowoff', not_stated: 'not stated in the table' };

function clip(c) {
  const t = c.test_info;
  const p = c.panel2;
  return `<article class="clip">
    <video src="${esc(c.clip)}" poster="${esc(c.clip.replace(/\.mp4$/, ".jpg"))}" controls muted playsinline preload="metadata" aria-label="${esc(c.title)}"></video>
    <h3>${esc(c.title)}</h3>
    <p>${esc(c.what_to_watch)}</p>
    <dl class="facts">
      <dt>Test</dt><dd>${esc(c.test)} · ${esc(t.pi)} · ${esc(t.date_actual)} · ${esc(t.geometry)}${t.rod_diameter_in ? ` (${t.rod_diameter_in}")` : ''}</dd>
      <dt>O2 (PSI table)</dt><dd>initial ${t.o2_initial_pct}%, post-burn ${t.o2_final_pct}% by vol</dd>
      <dt>Outcome (PSI table)</dt><dd>${esc(OUT[t.outcome] ?? t.outcome)}</dd>
      <dt>Crew notes</dt><dd>Fan: "${esc(t.fan_raw)}" · Air: "${esc(t.air_raw)}"</dd>
      ${p ? `<dt>On Panel 2</dt><dd>${p.kind === 'blowoff_upper_bound' ? `Blowoff at a flow of at most Air ${p.air_cm_s} cm/s: a ≤` : `Last stable flow before extinction, Air ${p.air_cm_s} cm/s (the extinction flow itself is below the fan calibration): a =`} ${p.a_per_s} 1/s at ${p.o2_final_pct}% post-burn O2 · <a href="#evidence">Evidence Map</a></dd>` : ''}
    </dl>
    <p class="src">Video: ${esc(c.source_name)} (PSI-25), ${c.start_s}–${c.start_s + c.duration_s} s, re-encoded. Row: ${esc(t.source.file)}, line ${t.source.line}.</p>
  </article>`;
}

export async function render(root) {
  const d = await loadJSON('clips.json');
  root.innerHTML = `<section class="card"><h2>Clips: BASS-II flames on the ISS</h2>
    <p class="note">Flight video from NASA PSI (BASS-II, PSI-25). The on-screen date is one day ahead of the test date (the FAQ says leap year was not set on board). FUEL, AIR, FAN and RAD are the on-board displays; nothing here is read off the video by software.</p>
    <div class="clips">${d.clips.map(clip).join('')}</div>
    <p class="note">${esc(d.provenance)}</p></section>`;
  return () => root.querySelectorAll('video').forEach((v) => v.pause());
}
