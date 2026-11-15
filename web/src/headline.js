// The headline is a template over external_tests.json: count, test names and airflow are never typed by hand.
// Shared by the Start screen and the Evidence Map so both always show the same sentence.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const inMoonZone = (ext) => ext.tests.filter((t) => t.in_moon_zone && t.kind === 'point');

export function headline(inZone) {
  const flows = [...new Set(inZone.map((t) => t.flow_cm_s))];
  // Name each program once: "Saffire VI-2 and VI-3".
  const names = inZone.map((t, i) => (i && inZone[i - 1].program === t.program ? t.sample : `${t.program} ${t.sample}`)).join(' and ');
  const flow = flows.length === 1 ? `one airflow (${flows[0]} cm/s)` : `${flows.length} airflows`;
  const all = inZone.length === 2 ? 'both' : 'all';
  return `Of the solid-material space fire tests in our sources, only ${inZone.length} burned in Moon-base air `
    + `(${esc(names)}), ${all} at ${flow}, none in partial gravity.`;
}
